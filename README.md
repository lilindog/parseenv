# 自定义ENV文件解析器
.env文件解析器。   

## 功能
* 支持`include`语法引入其他.env配置文件。
* 支持列表、字典语法。
* 支持环境变量插值。   


## 语法
```
# 这是一行注释，注释行以#号开头

# 普通key -> value配置写法
KEY = VALUE

# 列表
LIST[] = 111
LIST[] = 222

# 字典
DICT[name] = lilin
DICT[age]  = 28

# 环境变量插值
# 需使用{}符号包含
include {comm_config}.env
PASS = {pass}
NAME = {name}
```
## 示例
comm.env
```js
# 这是公共的.env配置文件

# 这是普通key,value写法
WEB_TITLE = 这是我的网站标题

# 这是数组写法，只支持1维， env的初衷就是不嵌套
TEST_ARR[] = 1
TEST_ARR[] = 2

# 这是字典写法，只支持1维
TEST_DICT{name} = lilin
TEST_DICT{age}  = 28

```
dev.env
```js
# 这是开发所使用的.env配置文件
include ./comm.env
MODE = development
```
pro.env
```js
# 这是打包所使用的.env配置文件
include ./comm.env
MODE = production
```

## API使用
导出一个函数，直接传入.env 文件路径即可完成解析，返回解析后的结果。

1.假如有一个名为test.env的配置文件
```sh
PASS         = 1234567
DICT{field1} = hello
DICT{field2} = world
ARR[]        = 1
ARR[]        = 2
```
2.解析上面这个test.env
```js
const parseEnv = require("./parseEnv");
console.log(parseEnv("./test.env"));
// 输出示例：
/*
{
    PASS: 1234567,
    DICT: { field1: "hello", field2: "world" },
    ARR: [ 1, 2 ]
}
*/
```
