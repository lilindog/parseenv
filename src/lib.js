import { ROW_REG, INCLUDE_REG, ENV_INJECTION, OBJKEY_REG, ARRKEY_REG } from "./regs.js";
import { kConfigIsStrict } from "./constans.js";
import url from "url";
import path from "path";
import http from "http";
import https from "https";
import fs from "fs";

export const log = msg => {
    const prefix = "[Parseenv]";
    /* eslint-disable no-console */
    if (global[kConfigIsStrict]) {
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
 * 解析键值对
 *
 * @param  {Stirng} str env文件的文本字符串
 * @return {Object}
 */
export const parseKV = str => {
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

/**
 * 解析字符串里的所有include的路径集合
 *
 * @param {String} str env文件内容
 * @return {Array<String>}
 */
export const getIncludePathsFromString = str => {
    return (str.match(INCLUDE_REG) || [])
        .map(statement => statement.replace(/\s+/g, " ").split(" ")[1])
        .map(handleEnvironmentVariable);
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
    return /^\d+$/.test(value) ? Number(value) : value;
};

/**
 * 解析本地env
 *
 * @param {String} envPath env入口文件
 * @return {Array<string>}
 * @public
 */
export const parseEnv = envPath => {
    let result = [];
    if (!path.isAbsolute(envPath)) {
        envPath = path.resolve(envPath);
    }
    if (!fs.existsSync(envPath)) {
        log(`"${envPath}" env文件不存在！`);
        return [];
    }
    const content = fs.readFileSync(envPath).toString("utf8");
    const includePaths = getIncludePathsFromString(content);
    includePaths.forEach(includePath => {
        const envPathDir = path.dirname(envPath);
        includePath = path.resolve(envPathDir, includePath);
        result = [...result, ...parseEnv(includePath)];
    });
    result.push(content);
    return result;
};

/**
 * 请求远程url的env文件
 *
 * @param {String} remoteUrl http或者https链接
 * @param {Function} resolveCb 递归回调，重定向时内部使用，外部不要传递
 * @param {Number} timeout 超时
 * @param {Number} redirects 重定向次数限制
 * @return {Promise<string>}
 * @private
 */
const getRemoteEnv = (
    remoteUrl,
    resolveCb,
    timeout = 1000,
    redirects = 1
) => {
    let get;
    if (remoteUrl.startsWith("https:")) {
        ({ get } = https);
    } else if (remoteUrl.startsWith("http:")) {
        ({ get } = http);
    }
    let isResolveCb = resolveCb && typeof resolveCb === "function";
    let done;
    let p;
    if (!isResolveCb) {
        p = new Promise(r => done = r);
    } else {
        done = resolveCb;
    }
    let timeoutId = setTimeout(() => {
        log(`"${remoteUrl}" 文件加载超时！`);
        r.destroy();
        done("");
        clearTimeout(timeoutId);
    }, timeout);
    const r = get(remoteUrl, res => {
        if (res.statusCode < 400 && res.statusCode > 300) {
            clearTimeout(timeoutId);
            if (redirects === 0) {
                log(`"${remoteUrl}" 文件重回定向次数溢出！`);
                done("");
                return;
            }
            const u = new url.URL(remoteUrl);
            u.hostname = u.hash = u.search = "";
            const redirectUrl = new url.URL(res.headers.location, u.href).href;
            parseEnvAsync(redirectUrl, done, timeout, --redirects);
            return;
        }
        if (res.statusCode >= 400) {
            clearTimeout(timeoutId);
            log(`"${remoteUrl}" env文件加载失败！code ${res.statusCode}`);
            done("");
            return;
        }
        if (!res.headers["content-type"].startsWith("text/")) {
            log(`"${remoteUrl}" 文件content-type错误，应为text/xxx!`);
            clearTimeout(timeoutId);
            done("");
            return;
        }
        let buf = [];
        res.on("data", chunk => buf.push(...chunk));
        res.on("end", () => {
            clearTimeout(timeoutId);
            done(Buffer.from(buf).toString("utf8"));
        });
    });
    r.on("error", done.bind(null, ""));
    if (!isResolveCb) {
        return p;
    }
};

/**
 * 解析含有远程url include的env文件
 *
 * @param {String} envPath 可以是远程url，也可以是本地文件路径path
 * @return {Promise<String>}
 * @public
 */
export const parseEnvAsync = async envPath => {
    // 暂未考虑include同文件去重，或全局去重（不同包含层级）等问题。
    // 默认还是以后来者居上原则
    let results = [];
    const isRemoteLink = isRemotePath(envPath);
    if (isRemoteLink) {
        const content = await getRemoteEnv(envPath);
        const includePaths = getIncludePathsFromString(content);
        for (let includePath of includePaths) {
            includePath = handleEnvironmentVariable(includePath);
            includePath = new url.URL(includePath, envPath).href;
            results = [ ...results, ...(await parseEnvAsync(includePath)) ];
        }
        results.push(content);
    } else {
        if (path.isAbsolute(envPath)) {
            envPath = path.resolve(envPath);
        }
        if (!fs.existsSync(envPath)) {
            log(`"${envPath}" env文件不存在！`);
            return [];
        }
        const content = fs.readFileSync(envPath).toString("utf8");
        const includePaths = getIncludePathsFromString(content);
        for (let includePath of includePaths) {
            includePath = handleEnvironmentVariable(includePath);
            if (isRemotePath(includePath)) {
                results = [ ...results, ...(await parseEnvAsync(includePath)) ];
            } else {
                includePath = path.resolve(path.dirname(envPath), includePath);
                results = [ ...results, ...(await parseEnvAsync(includePath)) ];
            }
        }
        results.push(content);
    }
    return results;
};