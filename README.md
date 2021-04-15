# 自定义ENV文件解析器

支持include的.env配置文件解析器。   

### 由来
之前自定义格式用于支持项目的配置，后来才知道也有一种配置文件叫做.env且还有相关的解析库。。。。。。    
将错就错，继续维护，添加一些自己喜欢的特性。   

### 语法
1. 每行一对key value；用等于号分割, key和value两端的空格将被忽略。   
2. 每行以#号开头代表注释。   
3. 包含语法 ```include xxx``` 请正确写明引入env文件，后缀可带可不带。   
4. 支持集合语法，写作 ```KEY[] = value```, 详见示例。   

示例：

comm.env
```js
# 这是公共的.env配置文件
WEB_TITLE = 这是我的网站标题

# 这是数组写法，只支持1维， env的初衷就是不嵌套。
TEST_ARR[] = 1
TEST_ARR[] = 2
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
导出一个函数，直接传入.env 文件路径即可完成解析，返回key、value对象。
```js
//env文件路径
const envFilePath = "./test.env";
//引入parseEnv
const parseEnv = require("./parseEnv");
//输出解析后的env
console.log(parseEnv(envFilePath));
```

*最近更新于 2021-04-15 上午16:13分*