// import { getEnvAsync, getEnv } from "../src/getEnv.js";
// import { isRemotePath } from "../src/helper.js";
// import fs from "fs";

// function run (path) {
//     let parseenv;
//     if (isRemotePath(path)) {
//         console.log("远程get");
//         parseenv = getEnvAsync;
//     } else {
//         console.log("本地get");
//         parseenv = getEnv;
//     }

//     const res = parseenv(path);
//     if (res instanceof Promise) {
//         res.then(res => {
//             console.log("ok:");
//             console.log(res);
//         })
//             .catch(err => {
//                 console.log("fail:");
//                 console.log(err);
//             });
//     } else {
//         console.log(res);
//         // console.log(JSON.stringify(res));
//         // fs.writeFileSync("out.json", JSON.stringify(res));
//     }
// }

// run("http://localhost/config/index.env");
// // run("index.env");