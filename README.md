# 自定义ENV文件解析器
.env文件解析器。   
简单能用，符合我自己的使用习惯。   
可能env文件的本意是扩展当前程序/进程的环境变量；我慢慢的习惯了把它当做一种纯粹的配置文件来使用。

## 功能
* 支持`include`语法引入本地.env配置文件。
* 支持`include`语法引入远程.env配置文件。
* 支持列表、字典语法。
* 支持环境变量插值。   

## 语法
```
# 这是一行注释，注释行以#号开头

## 引入本地其它.env文件
include ./base.env

## 引入远程其它.env文件(必须是http/https链接)
include http://source.lilin.site/config/comm.env

# 普通key -> value配置写法
KEY = VALUE

# 列表
LIST[] = 111
LIST[] = 222

# 字典
DICT{name} = lilin
DICT{age}  = 28

# 环境变量插值
# 需使用{}符号包含
# 环境变量插值只能用于value和include的路径
include {comm_config}.env
PASS = {pass}
NAME = {name}
```

## API
模块仅导出一个函数，直接传入本地.env 文件路径即可完成解析，不可以直接传入远程.env的http链接; 返回解析后的结果。   
若传入的.env文件中有远程.env引入，返回结果为Promise<{}>, 反之直接返回结果。  

comm.env
```
include http://source.lilin.site/config/comm.env
TITLE = hello
```
comm1.env
```
include ./root.env
TITLE = world
```
use api
```js
import parseEnv from "parseenv";

/**
 * 解析包含有远程include的.env文件 
 */
!void async function () {
    const r = await parseEnv("./comm.env");
    console.log(r);
    /*
    { ...more, TITLE: "hello" }
    */
}();

/**
 * 解析没有包含include远程.env的文件 
 */
console.log(parseEnv("./comm1.env"));
/* { ...more, TITLE: "world" } */
```

## 一些问题
1.include提升问题：   
>
    一个env文件里的include会优先处理，哪怕include写在了非inc
    lude语句后面也一样；整个文件中的include会从上到下依次处理。   

2.相同变量：  
>
    不管是同一个文件里还是include的文件里，根据出现的顺序来决
    定优先级，后面声明或include的会覆盖前面声明的。后续根据自
    己的使用习惯，可能会引入final 修饰符。      

3.include远程文件中的include会怎么处理：
>
    远程文件中的include也会处理，但与本地文件中的include不同；
    远程文件中的include路径是按照当前远程文件的url中的path来
    计算的，比如引入了链接为`http://a.com/a/b/comm.env`的文
    件，文件中有`include ../root.env` 则会当做`http://a.co
    m/a/root.env`来处理。  

4.远程文件中的环境变量插值：
>
    远程文件中的环境变量插值会替换为当前使用的系统的环境变量来
    替换，并不是远程文件所在系统的环境变量。     

## 使用场景
* [从远程加载数据库账密配置](./doc/example1.md)
