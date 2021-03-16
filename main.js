"use strict"

const fs = require("fs");
const path = require("path");

const INCLUDE_REG = /include\s+[^\n]+/ig;

function errorMSG (msg) {
    return `[Parseenv] 报错：${msg}`;
}

function checkFile (path) {
    return fs.existsSync(path);
}

/**
 * 解析include, 返回解析好的kv对文本
 * 
 * @param  {String} str
 * @return {String}
 */
function parseInclude (envpath, res = []) {
    if (!checkFile(envpath)) throw errorMSG(`${envpath} 不存在！`);
    let 
    str = fs.readFileSync(envpath).toString(),
    includes = (str.match(INCLUDE_REG) || []).map(statement => statement.replace(/\s+/g, " ").split(" ")[1]);
    if (includes.length) res.unshift(str.replace(INCLUDE_REG, ""));
    else res.unshift(str);
    includes.forEach(include => {
        const p = `${path.parse(envpath).dir}/${include}${/.env$/i.test(include) ? "" : ".env"}`;
        parseInclude(p, res);
    });
    return res.join("\n");
}

/**
 * 解析键值对
 * 
 * @param  {Stirng} str
 * @return {Object} 
 */
function parseKV (str = "") {
    let data = {};
    str = str.replace(/\n{2,}/g, "\n");
    str = str.split("\n").map(item => item.replace(/\s+$|^\s+|\s+(?=\=)|(?<=\=)\s+/g, ""));
    str = str.filter(item => item.charAt(0) !== "#" && ~item.indexOf("=") && item.indexOf("#") < item.length - 1);
    str = str.map(item => {
        data[item.split("=")[0]] = item.split("=")[1];
    });
    return data;
}

module.exports = envpath => parseKV(parseInclude(envpath));