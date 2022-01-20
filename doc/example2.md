有时候有这么一个应用场景，就是多个同事之间打包/开发项目要求环境变量统一，又不想每次修改都来回同步；那么把env配置放在远程就是很好的方案。      

第1步把env文件放在远程服务器。
记得远程服务器http返回头`Content-Type`必须是`text/`开头才行， 建议设置为`text/env`，当然其它的也行只要确保是`text/`开头就行。   

远程env文件： 
```text
# 名为index.env的远程文件

# 这里的_MODE_是环境变量插值，具体请看语法说明：https://github.com/lilindog/parseenv/blob/master/doc/grammar.md
if {_MODE_} = production
    HOST = https://xxx.com/api
else if {_MODE_} = development
    HOST = https://xxx.com/test/api
endif
```

---

第2步，在本地env文件中引入远程env文件即可：   
```text
# 本地名为.env的配置文件
# 就一句话，引入远程env，当然可以根据项目不同配置也不一样
include http://xxx.com/static/index.env
```
当然这种一句话且还是include远程env的，你可以省略本地env文件，直接在parseenv的api函数中传入远程env路径也可以。   

---

第3步，加载env文件：  
你也可以在webpack中痛经过插件注入到内部变量。   
```js
// 这里仅演示怎么解析
// 当然webpack插件注入到变量也很简单，跟这个无异
// cjs
const parseenv = require("parseenv");
!void async function () {
    const res = await parseenv(".env");
    // 也可以直接传入远程env文件路径
    // const res = await parseenv("http://xxx.com/static/index.env");
    
    console.log(res);
}();
```