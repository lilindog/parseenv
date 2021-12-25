"use strict";

/**
 * ！！！
 * 接下来彻底转为FP风格，此次改动发现异步处理env部分的副作用部分代码无法抽离集中整合
 * 建议后续在本地env中存在include远程的情况下，先解析所有的远程env地址集合且缓存内容
 * 集中处理异步完成后在统一处理内容部分及其后续逻辑
 */

const util = require("./util");
const fs = require("fs");
const path = require("path");
const { ROW_REG, INCLUDE_REG, ARRKEY_REG, OBJKEY_REG } = require("./regs");
const {
    handleEnvironmentVariable,
    log,
    isRemotePath,
    getRemoteEnv,
    mergeRemotePath
} = require("./lib");

const handleValueType = value => {
    value = value.trim();
    return /^\d+$/.test(value) ? Number(value) : value;
};
const handleValue = util.pipe(handleEnvironmentVariable, handleValueType);
const hasRemotePath = paths => paths.some(isRemotePath);

/**
 * 解析字符串里的所有include的路径集合
 * 
 * @param  {String} str env文件字符串
 * @param  {Function} handleEnvironmentVariable 处理环境变量插值的函数
 * @return {Array<String>} 
 */
const getIncludePathsFromString = (str, handleEnvironmentVariable) => {
    return (str.match(INCLUDE_REG) || [])
        .map(statement => statement.replace(/\s+/g, " ").split(" ")[1])
        .map(handleEnvironmentVariable);
};

/**
 * 解析所有本地env文件中的include路径，返回path集合
 * 
 * @param  {String} envpath 文件路径
 * @param  {Function} getIncludePathsFromString 解析include语句的函数
 * @return {Array<String>}
 */
const parseLocalIncludePaths = (envpath, getIncludePathsFromString) => {
    const includes = [];
    const f = envPath => {
        const resolvePath = path.resolve(envPath);
        if (!fs.existsSync(resolvePath)) {
            log(`include的 "${resolvePath}" env文件不存在！`);
            return;
        }
        const includePaths = getIncludePathsFromString(fs.readFileSync(resolvePath).toString());
        const mergePath = r => path.resolve(path.parse(resolvePath).dir, r.endsWith(".env") ? r : r + ".env");
        includePaths.forEach(
            util.left(
                isRemotePath,
                includes.push.bind(includes),
                util.pipe(mergePath, f)
            )
        );
        includes.push(resolvePath);
    };
    f(envpath);
    return includes;
};

/**
 * 异步解析env文件 （包含远程env和远程include）
 * 
 * @param  {Array} includePaths 要解析文件的所有include
 * @param  {Function} getIncludePathsFromString 获取文件的include 路径的函数
 * @param  {Function} getRemoteEnv 加载远程env
 * @param  {Function} isRemotePath 远程路径判断函数
 * @return {String}
 */
async function parseRemoteFile (
    includePaths,
    getIncludePathsFromString,
    getRemoteEnv,
    isRemotePath
) {
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
        for (let i of getIncludePathsFromString(s).sort(() => -1)) {
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
const parseFile = (includePaths) => {
    return includePaths.reduce((t, c) => {
        t += "\n" + fs.readFileSync(c).toString();
        return t;
    }, "");
};

/**
 * 解析键值对
 * 
 * @param  {Stirng} str env文件的文本字符串
 * @param  {Function} handleValue 处理值部分的函数，包括处理字符串和数字类型和环境变量插值
 * @return {Object} 
 */
const parseKV = (str, handleValue) => {
    return str.replace(/\n{2,}/g, "\n").split("\n").filter(row => ROW_REG.test(row)).reduce((data, item) => {
        let [ key, value ] = item.replace(/\s=\s/, "=").split("=");
        if (OBJKEY_REG.test(key)) {
            let field;
            [ key, field ] = OBJKEY_REG.exec(key).slice(1);
            if (!data[key]) data[key] = {};
            data[key][field] = handleValue(value);
        } else if (ARRKEY_REG.test(key)) {
            key = ARRKEY_REG.exec(key)[1];
            if (!data[key]) data[key] = [];
            data[key].push(handleValue(value));
        } else {
            data[key.trim()] = handleValue(value);
        }
        return data;
    }, {});
};

const parse = util.pipe(parseFile, util.partial(parseKV, undefined, handleValue));
const parseAsync = util.pipe(
    util.partial(
        parseRemoteFile,
        undefined,
        util.partial(
            getIncludePathsFromString,
            undefined,
            handleEnvironmentVariable
        ),
        getRemoteEnv,
        isRemotePath
    ),
    p => p.then(
        util.partial(parseKV, undefined, handleValue)
    )
);

/**
 * 启动函数
 *
 * @param {String} path 主入口.env文件路径
 * @return {Object|Promise<Object>} env中含有远程env文件include时会返回一个promise， 没有则直接返回处理结果
 */
module.exports = util.pipe(
    util.partial(
        parseLocalIncludePaths,
        undefined,
        util.partial(
            getIncludePathsFromString,
            undefined,
            handleEnvironmentVariable
        )
    ),
    util.left(
        hasRemotePath,
        util.partial(
            parseAsync,
            undefined,
            util.partial(
                getIncludePathsFromString,
                undefined,
                handleEnvironmentVariable
            ),
            getRemoteEnv,
            isRemotePath
        ),
        parse
    )
);