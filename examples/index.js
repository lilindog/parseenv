const parseEnv = require("../src/main");

!void async function () {
    const r = await parseEnv("./index.env");
    console.log(JSON.stringify(r, null, 4));
}();