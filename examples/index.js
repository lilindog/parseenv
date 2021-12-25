const parseEnv = require("../src/main");

const r = parseEnv("./index.env");
if (r instanceof Promise) {
    r.then(d => {
        console.log("异步：");
        console.log(d);
    }).catch(console.error);
} else {
    console.log(r);
}
