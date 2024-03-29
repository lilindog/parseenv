const parseenv = require("../src/main.js"); 

function run (path) {
    const res = parseenv(path, { timeout: 2000 });
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