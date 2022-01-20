通常自己在写node时候需要把数据库配置写在配置文件里，总是感觉账密写在里边感觉不太合适；
于是乎就把账密的配置放在了远程服务器上通过本地配置文件里include引入。  

远程配置：
```
# 数据库账密
DB{USER} = root
DB{PASS} = 123456
```
本地配置：
```
# 引入远程数据库账密配置
# 远程配置需要账密访问，这里账密使用了环境变量插值
include http://{name}:{pass}@source.lilin.site/config/comm.env

# 本地数据库其它配置
DB{HOST} = 127.0.0.1
DB{PORT} = 3306
```
解析配置：
```js
import parseEnv from "parseenv";

!void async function () {
    const r = await parseEnv("./index.env");
    console.log(JSON.stringify(r, null, 4));
    /*
    打印如下：
    {
        "DB": {
            "USER": "root",
            "PASS": 123456,
            "HOST": "127.0.0.1",
            "PORT": 3306
        }
    }
    */
}();
```
