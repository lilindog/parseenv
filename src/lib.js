"use strict";

const 
    { 
        ENV_INJECTION,
        ROW_REG,
        INCLUDE_REG
    } = require("./regs"),
    url = require("url"),
    path = require("path"),
    { get: httpGet } = require("http"),
    { get: httpsGet } = require("https");

exports.isRemotePath = path => path.startsWith("http");

exports.log = msg => {
    process.stdout.write(`[Parseenv] ${msg}\n`);
};

/**
 * 处理value中的环境变量和其转义符 
 * 
 * @param  {String} value
 * @return {String}
 */
exports.handleEnvironmentVariable = (value = "") => {
    const envInjectTags = value.match(ENV_INJECTION);
    let field, property;
    if (!envInjectTags) return value;
    [...new Set(envInjectTags)].forEach(tag => {
        field = tag.replace(/[\{\}]/g, "");
        property = process.env[field];
        if (property === undefined) exports.log(`环境变量 "${field}" 不存在！`);
        value = value.replace(new RegExp(tag, "g"), property);
    });
    return value;
};

/**
 * 加载远程env文件的内容
 * 
 * @param  {String} remoteUrl 
 * @param  {Number} timeout
 * @return {String|undefined}
 */
exports.getRemoteEnv = (remoteUrl = "", timeout = 2000) => {
    const allowContentTypes = [ 
        "text/env",
        "text/html",
        "text/plain"
    ];
    return new Promise(resolve => {
        let data = [], s, request, id, failed = false, 
            resolveUndefined = msg => {
                if (failed) return;
                failed = true;
                exports.log(remoteUrl + (msg || "的env文件加载失败,请检查资源！"));
                resolve();
            };
        request = ({ "http:": httpGet, "https:": httpsGet })[new url.URL(remoteUrl).protocol](remoteUrl, res => {
            if (!allowContentTypes.includes(res.headers["content-type"])) {
                return resolveUndefined(remoteUrl + "的资源返回头Content-Type " + res.headers["content-type"] + "不合法！");
            }
            res.on("error", resolveUndefined);
            res.on("data", chunk => data.push(...chunk));
            res.on("end", () => {
                clearTimeout(id);
                s = Buffer.from(data).toString();
                if (s.match(ROW_REG) || s.match(INCLUDE_REG)) resolve(s);
                else resolveUndefined();
            });
        }).on("error", resolveUndefined);
        id = setTimeout(() => {
            clearTimeout(id);
            resolveUndefined();
            request.destroy();
        }, timeout);
    });
};

/**
 * 合并远程路径的include路径
 * 
 * @param  {String} originPath 当前文件url
 * @param  {String} targetPath include的路径
 * @return {String} 合并后的url路径
 */
exports.mergeRemotePath = (originPath, targetPath) => {
    let base, paths, leftStep;
    let { pathname, origin } = new url.URL(originPath);
    if (path.isAbsolute(targetPath)) {
        return origin + (targetPath.endsWith(".env") ? targetPath : targetPath + ".env");
    }
    else if (!/^(?:\.\/|\.\.\/)*(\w)+?(?:\.env)?$/.test(targetPath)) {
        return exports.log("originPath: " + originPath + " -> " + targetPath + " include路径不合法！");
    }
    base = path.parse(targetPath).base;
    pathname = path.dirname(pathname);
    leftStep = (targetPath.match(/\.\.\//g) || []).length;
    paths = pathname.split("/").filter(i => i);
    if (paths.length < leftStep) return exports.log("路径错误：" + originPath + " -> " + targetPath);
    while (leftStep > 0) {
        paths.pop();
        leftStep--;
    }
    return origin + paths.join("/") + "/" + (base.endsWith(".env") ? base : base + ".env");
};