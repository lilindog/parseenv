import { INCLUDE_REG, ENV_INJECTION } from "./regs.js";
import { kConfigIsStrict } from "./constans.js";
import path from "path";
import fs from "fs";

export const log = (msg, isErr) => {
    const prefix = "[Parseenv]";
    /* eslint-disable no-console */
    if (global[kConfigIsStrict] || isErr) {
        console.log("\x1b[41m", "\x1b[37m", prefix, "\x1b[40m", "\x1b[31m", msg, "\x1b[0m");
        process.exit(1);
    } else {
        console.log("\x1b[45m", "\x1b[37m", prefix, "\x1b[40m", "\x1b[33m", msg, "\x1b[0m");
    }
    /* eslint-disable no-console */
};

export const isRemotePath = path => path.startsWith("http");

/**
 * 检测本地env文件中是否包含远程include路径（包含嵌套env中的include）
 *
 * @param {String} envPath 主env文件路径
 * @return {Boolean}
 * @public
 */
export const hasRemotePath = envPath => {
    if (!path.isAbsolute(envPath)) {
        envPath = path.resolve(envPath);
    }
    if (!fs.existsSync(envPath)) {
        return false;
    }
    const includePaths = getIncludePathsFromString(fs.readFileSync(envPath).toString("utf8"));
    if (includePaths.some(isRemotePath)) return true;
    for (let includePath of includePaths) {
        const envPathDir = path.dirname(envPath);
        if (hasRemotePath(path.resolve(envPathDir, includePath))) return true;
    }
    return false;
};

/**
 * 解析键值对到上下文
 *
 * @param {Object} context 结果上下文
 * @param {String} str kv对语句
 * @return {void}
 * @public
 */
export const parseKV2Context = (context, str) => {
    str = str.replace(/ +/g, " ");
    let [ key, value ] = str.split("="); // value部分若有=号可能会发生异常
    key = key.trim();
    value = value.trim();
    // map
    if (key.includes("{") && key.slice(-1) === "}") {
        const l_index = key.indexOf("{");
        let field = key.slice(0, l_index);
        let property = key.slice(l_index + 1, -1);
        if (!context[field]) context[field] = {};
        context[field][property] = handleValue(value);
    }
    // list
    else if (key.slice(-2, 1) === "[" && key.slice(-1) === "]") {
        let field = key.slice(0, -2);
        if (!context[field]) context[field] = [];
        context[field].push(handleValue(value));
    }
    // kv
    else {
        context[key] = handleValue(value);
    }
};

/**
 * 解析字符串里的所有include的路径集合
 *
 * @param {String} str env文件内容
 * @return {Array<String>}
 */
export const getIncludePathsFromString = (str, isHandleEnvironmentVariable = true) => {
    return (str.match(INCLUDE_REG) || [])
        .map(statement => statement.replace(/ +/g, " ").split(" ")[1])
        .map(isHandleEnvironmentVariable ? handleEnvironmentVariable : item => item);
};

/**
 * 处理表达式右侧语句的环境变量插值和其转义
 *
 * @param {String} value
 * @return {String}
 * @public
 */
export const handleEnvironmentVariable = value => {
    const envInjectTags = value.match(ENV_INJECTION);
    if (!envInjectTags) return value;
    let field, property;
    [...new Set(envInjectTags)].forEach(tag => {
        field = tag.replace(/[\{\}]/g, "");
        property = process.env[field];
        if (property === undefined) log(`环境变量 "${field}" 不存在！`);
        value = value.replace(new RegExp(tag, "g"), property || tag);
    });
    return value;
};

/**
 * 处理变量值的类型问题
 *
 * @param {String} value
 * @returns {(Number|String)}
 */
const handleValue = value => {
    value = value.trim();
    value = handleEnvironmentVariable(value);
    const isNumber = /^\d+$/.test(value);
    return isNumber ? Number(value) : value;
};