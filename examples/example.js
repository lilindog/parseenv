const parseenv = require("../dist/parseenv.js");

function run (path) {
    const res = parseenv(path, {isStrict: !true});
    if (res instanceof Promise) {
        res.then(res => {
            console.log("ok:");
            console.log(res);
        })
            .catch(err => {
                console.log("fail:");
                console.log(err);
            });
    } else {
        console.log(res);
    }
}

run("http://googel.com/config/index.env");
//run("index.env");