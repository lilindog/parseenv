
/**
 * Parseenv v3.1.0
 * Author lilindog<lilin@lilin.site>
 * Last-Modify 2022/1/4
 * License ISC
 */

'use strict';

var url = require('url');
var path = require('path');
var http = require('http');
var https = require('https');
var fs = require('fs');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var url__default = /*#__PURE__*/_interopDefaultLegacy(url);
var path__default = /*#__PURE__*/_interopDefaultLegacy(path);
var http__default = /*#__PURE__*/_interopDefaultLegacy(http);
var https__default = /*#__PURE__*/_interopDefaultLegacy(https);
var fs__default = /*#__PURE__*/_interopDefaultLegacy(fs);

const ROW_REG = /(?<=(?:\n|^))[\x20]*?(?:\w+|\w+\[\]|\w+\{\s*\w+\s*\})\s*=\s*.+/i;
const INCLUDE_REG = /(?<=^|\n)[^#\n]*include\s+[^\n]+/ig;
const ARRKEY_REG = /^\s*(\w+)\[\]\s*$/i;
const OBJKEY_REG = /^\s*(\w+)\{\s*(\w+)\s*\}\s*/i;
const ENV_INJECTION = /(?<!\\)\{([^\}]+)\}(?!\\)/ig;

const kConfigIsStrict = Symbol("k_config_is_strict");

const log = msg => {
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

const isRemotePath = path => path.startsWith("http");

/**
 * 检测本地env文件中是否包含远程include路径（包含嵌套env中的include）
 *
 * @param {String} envPath 主env文件路径
 * @return {Boolean}
 * @public
 */
const hasRemotePath = envPath => {
    if (!path__default["default"].isAbsolute(envPath)) {
        envPath = path__default["default"].resolve(envPath);
    }
    if (!fs__default["default"].existsSync(envPath)) {
        return false;
    }
    const includePaths = getIncludePathsFromString(fs__default["default"].readFileSync(envPath).toString("utf8"));
    if (includePaths.some(isRemotePath)) return true;
    for (let includePath of includePaths) {
        const envPathDir = path__default["default"].dirname(envPath);
        if (hasRemotePath(path__default["default"].resolve(envPathDir, includePath))) return true;
    }
    return false;
};

/**
 * 解析键值对
 *
 * @param  {Stirng} str env文件的文本字符串
 * @return {Object}
 */
const parseKV = str => {
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
const getIncludePathsFromString = str => {
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
const handleEnvironmentVariable = value => {
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
const parseEnv = envPath => {
    let result = [];
    if (!path__default["default"].isAbsolute(envPath)) {
        envPath = path__default["default"].resolve(envPath);
    }
    if (!fs__default["default"].existsSync(envPath)) {
        log(`"${envPath}" env文件不存在！`);
        return [];
    }
    const content = fs__default["default"].readFileSync(envPath).toString("utf8");
    const includePaths = getIncludePathsFromString(content);
    includePaths.forEach(includePath => {
        const envPathDir = path__default["default"].dirname(envPath);
        includePath = path__default["default"].resolve(envPathDir, includePath);
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
        ({ get } = https__default["default"]);
    } else if (remoteUrl.startsWith("http:")) {
        ({ get } = http__default["default"]);
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
            const u = new url__default["default"].URL(remoteUrl);
            u.hostname = u.hash = u.search = "";
            const redirectUrl = new url__default["default"].URL(res.headers.location, u.href).href;
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
const parseEnvAsync = async envPath => {
    // 暂未考虑include同文件去重，或全局去重（不同包含层级）等问题。
    // 默认还是以后来者居上原则
    let results = [];
    const isRemoteLink = isRemotePath(envPath);
    if (isRemoteLink) {
        const content = await getRemoteEnv(envPath);
        const includePaths = getIncludePathsFromString(content);
        for (let includePath of includePaths) {
            includePath = handleEnvironmentVariable(includePath);
            includePath = new url__default["default"].URL(includePath, envPath).href;
            results = [ ...results, ...(await parseEnvAsync(includePath)) ];
        }
        results.push(content);
    } else {
        if (path__default["default"].isAbsolute(envPath)) {
            envPath = path__default["default"].resolve(envPath);
        }
        if (!fs__default["default"].existsSync(envPath)) {
            log(`"${envPath}" env文件不存在！`);
            return [];
        }
        const content = fs__default["default"].readFileSync(envPath).toString("utf8");
        const includePaths = getIncludePathsFromString(content);
        for (let includePath of includePaths) {
            includePath = handleEnvironmentVariable(includePath);
            if (isRemotePath(includePath)) {
                results = [ ...results, ...(await parseEnvAsync(includePath)) ];
            } else {
                includePath = path__default["default"].resolve(path__default["default"].dirname(envPath), includePath);
                results = [ ...results, ...(await parseEnvAsync(includePath)) ];
            }
        }
        results.push(content);
    }
    return results;
};

const parseAsync = async envPath => {
    const result = await parseEnvAsync(envPath);
    return parseKV(result.join("\n"));
};

/**
 * 入口
 *
 * @param {String} envPath 本地env文件路径或者远程env文件链接
 * @param {Object} [options] 配置对象，可选
 * @param {Boolean} [options.isStrict] 是否是严格模式，严格模式下env文件找不到会抛错
 * @return {(Object|Promise<Object>)}
 */
var main = (envPath, options) => {
    if (options && {}.toString.call(options) === "[object Object]") {
        const { isStrict } = options;
        global[kConfigIsStrict] = isStrict;
    }
    if (isRemotePath(envPath)) {
        return parseAsync(envPath);
    }
    if (hasRemotePath(envPath)) {
        return parseAsync(envPath);
    } else {
        const result = parseEnv(envPath);
        return parseKV(result.join("\n"));
    }
};

module.exports = main;
//# sourceMappingURL=parseenv.js.map
