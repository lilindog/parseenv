const parseenv = require("../dist/parseenv");

function run (path) {
    const res = parseenv(path);
    if (res instanceof Promise) {
        res.then(res => {
            console.log("async:");
            console.log(res);
        })
        .catch(err => {
            console.log("fail:");
            console.log(err);
        });
    } else {
        console.log("sync:");
        console.log(res);
    }
}

run("index.env");
//run("index.env");