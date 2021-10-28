"use strict";

const 
    fs = require("fs"),
    path = require("path"),
    { 
        handleEnvironmentVariable, 
        log, 
        isRemotePath, 
        getRemoteEnv, 
        mergeRemotePath 
    } = require("./lib"),
    {
        ROW_REG,
        INCLUDE_REG,
        ARRKEY_REG,
        OBJKEY_REG
    } = require("./regs");

function handleValue (value = "") {
    value = value.trim();
    value = handleEnvironmentVariable(value);
    return /^\d+$/.test(value) ? Number(value) : value;
}

/**
 * 解析env文件里的所有include路径
 * 
 * @param  {String} str env文件字符串
 * @return {Array<String>} 
 */
function parseIncludesInFile (str = "") {
    return (str.match(INCLUDE_REG) || [])
        .map(statement => statement.replace(/\s+/g, " ").split(" ")[1])
        .map(handleEnvironmentVariable);
}

/**
 * 解析所有本地env文件中的include路径
 * 
 * @param  {String} envpath
 * @return {String}
 */
function parseIncludesInLocalFiles (envpath, res = []) {
    envpath = path.resolve(envpath);
    if (!fs.existsSync(envpath)) return log(`include的 "${envpath}" env文件不存在！`);
    parseIncludesInFile(
        fs.readFileSync(envpath).toString()
    ).forEach(include => {
        if (isRemotePath(include)) {
            return res.push(include);
        }
        parseIncludesInLocalFiles(path.resolve(path.parse(envpath).dir, include.endsWith(".env") ? include : include + ".env"), res);
    });
    res.push(envpath);
    return res;
}

/**
 * 异步解析env文件 （包含远程env和远程include）
 * 
 * @param  {Array} 要解析文件的所有include
 * @return {String}
 */
async function parseFileAsync (includePaths = []) {
    let s = "";
    while (includePaths.length) {
        const path = includePaths.shift();
        if (isRemotePath(path)) s += "\n" + await f(path);
        else s += "\n" + fs.readFileSync(path).toString();
    }
    return s;
    async function f (remoteUrl = "") {
        let s = await getRemoteEnv(remoteUrl);
        if (!s) return "";
        for (let i of parseIncludesInFile(s).sort(() => -1)) {
            let newRemoteUrl = "";
            if (isRemotePath(i)) newRemoteUrl = i;
            else newRemoteUrl = mergeRemotePath(remoteUrl, i);
            if (newRemoteUrl) s = await f(newRemoteUrl) + "\n" + s;
        }
        return s;
    }
}

/**
 * 解析env文件（仅本地）
 * 
 * @param  {Array<String>} includePaths
 * @return {String}
 */
function parseFile (includePaths = []) {
    return includePaths.reduce((t, c) => {
        t += "\n" + fs.readFileSync(c).toString();
        return t;
    }, "");
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

async function parseKVAsync () {
    return parseKV(await parseFileAsync(arguments[0]));
}

module.exports = envPath => {
    const includePaths = parseIncludesInLocalFiles(envPath);
    if (includePaths.some(isRemotePath)) {
        return parseKVAsync(includePaths);
    } else {
        return parseKV(parseFile(includePaths));
    }
};