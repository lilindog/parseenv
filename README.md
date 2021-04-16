# 自定义ENV文件解析器

支持include的.env配置文件解析器。   

### 由来
之前自定义格式用于支持项目的配置，后来才知道也有一种配置文件叫做.env且还有相关的解析库。。。。。。    
将错就错，继续维护，添加一些自己喜欢的特性。   

### 语法
1. 每行以#号开头代表注释。   
2. ```include xxx.env``` 为包含语法，.env后缀可带可不带；用于包含另一个.env文件，支持嵌套；若有同名的key以当前文件中的优先。   
3. 每行一对key value；用等于号分割, key和value两端的空格将被忽略。  
4. 支持集合语法，写作 ```KEY[] = value```, 详见示例。   
5. 支持字典语法，写作 ```DICT{ field } = value```, 详见示例。

示例：

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

### API使用
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

*最近更新于 2021-04-16 AM 10:57*
