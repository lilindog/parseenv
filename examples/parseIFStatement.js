import parseIFStatements from "../src/parseIFStatements.js";
import fs from "fs";
import { EnvNode } from "../src/getEnv.js";
import { IF_STATEMENT, STATEMENT } from "../src/regs.js";
import getFragments from "../src/parseIFStatements.js";
const content = fs.readFileSync("./ifstatement1.env").toString("utf8");


// 模拟解析后的envNode
// const envNode = new EnvNode({
//     path: "ifstatement.env",
//     content,
//     includes: []
// });

// const res = getFragments(envNode);
// console.log(res);

console.log(content.match(STATEMENT));