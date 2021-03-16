## 自定义ENV文件解析器

#### env文件要求：
1. 每行一对key value；用等于号分割。   
2. 每行以#号开头代表注释。   
3. 包含语法 ```include xxx``` 请正确写明引入env文件，后缀可带可不带。   

示例：

```js
#这是注释语句, 注释语句以“#”符号开头。   

# 这是include语句，include按照先后顺序包含。
# 若包含文件与当前文件key重复， 则后声明的key有效。
include pub.key

# 这是key、value声明语句, key、=、value 三者缺一不可，否则会被忽略。   
key = value
NAME = LILIN
```

#### env解析器的使用
```js
//env文件路径
const envFilePath = "./test.env";
//引入parseEnv
const parseEnv = require("./parseEnv");
//输出解析后的env
console.log(parseEnv(envFilePath));
```
