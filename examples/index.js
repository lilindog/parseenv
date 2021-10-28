const parseEnv = require("../src/main");

!void async function () {
    console.log("配置文件：");
    console.log(await parseEnv("./main.env"));
}();