## 自定义ENV文件解析器

#### env文件要求：
1.每行一对key value；用等于号分割<br>
2.每行以#号开头代表注释

示例：

```js

#这是注释

key = value

NAME = LILIN

# 使用非常简单明了
# 类似于python的单行注释方式

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
