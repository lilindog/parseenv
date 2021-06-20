"use strict";

const 
    fs = require("fs"),
    path = require("path");

const 
    ROW_REG = /^\s*(?:\w+|\w+\[\]|\w+\{\s*\w+\s*\})\s*=\s*[^=]+$/i,
    INCLUDE_REG = /include\s+[^\n]+/ig,
    ARRKEY_REG = /^\s*(\w+)\[\]\s*$/i,
    OBJKEY_REG = /^\s*(\w+)\{\s*(\w+)\s*\}\s*/i;

function errorMSG (msg) {
    return `[Parseenv] 报错：${msg}`;
}

function checkFile (path) {
    return fs.existsSync(path);
}

function handleValue (value = "") {
    value = value.trim();
    return /^\d+$/.test(value) ? Number(value) : value;
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
    return str.replace(/\n{2,}/g, "\n").split("\n").filter(row => ROW_REG.test(row)).reduce((data, item) => {
        let [ key, value ] = item.replace(/\s=\s/, "=").split("=");
        if (OBJKEY_REG.test(key)) {
            let field;
            [ key, field ] = OBJKEY_REG.exec(key).slice(1);
            if (!data[key]) data[key] = {};
            data[key][field] = handleValue(value);
        }
        else if (ARRKEY_REG.test(key)) {
            key = ARRKEY_REG.exec(key)[1];
            if (!data[key]) data[key] = [];
            data[key].push(handleValue(value));
        } 
        else {
            data[key.trim()] = handleValue(value);
        }
        return data;
    }, {});
}

module.exports = envpath => parseKV(parseInclude(envpath));