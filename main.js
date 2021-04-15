"use strict"

const 
fs = require("fs"),
path = require("path");

const 
INCLUDE_REG = /include\s+[^\n]+/ig,
ARRKEY_REG = /^\s*(\w+)\[\]\s*$/i;

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
    const data = {};
    str.replace(/\n{2,}/g, "\n").split("\n").filter(row => /^\s*(?:\w+|\w+\[\])\s*=\s*[^=]+$/i.test(row))
    .map(item => {
        let [ key, value ] = item.replace(/\s=\s/, "=").split("=");
        if (ARRKEY_REG.test(key)) {
            key = ARRKEY_REG.exec(key)[1];
            if (!data[key]) data[key] = [];
            data[key].push(value);
        } else {
            data[key.trim()] = value.trim();
        }
    });
    return data;
}

module.exports = envpath => parseKV(parseInclude(envpath));