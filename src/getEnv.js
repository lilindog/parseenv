/**
 * 该模块主要处理env（包括嵌套的）文件为字符串数组
 * 嵌套的按照嵌套的优先级处理
 */

import http from "http";
import https from "https";
import url from "url";
import path from "path";
import fs from "fs";
import {
    getIncludePathsFromString,
    handleEnvironmentVariable,
    isRemotePath,
    log
} from "./helper.js";

/**
 * 解析结果节点
 *
 * @public
 */
export class EnvNode {
    /**
     * EnvNode节点的字段
     *
     * path 节点的路径，http/s链接或者文件绝对路径
     * name include语句时右边的语句，一般是相对路径或者名字
     * content 节点的string内容
     * includes 子节点数组，元素类型为EnvNode
     */
    static Fields = {
        path: "",
        name: "",
        content: "",
        includes: []
    };

    constructor (options = {}) {
        const Fields = JSON.parse(JSON.stringify(EnvNode.Fields));
        Reflect.ownKeys(Fields).forEach(k => this[k] = options[k] ?? Fields[k]);
    }
}

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
            getRemoteEnv(redirectUrl, done, timeout, --redirects);
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
 * 解析本地env
 *
 * @param {String} envPath env入口文件路径，可以是相对也可以是绝对
 * @param {Array<string>} origins 文件的遍历进来的路径集合, 该参数递归传递，无需干预
 * @return {Array<EnvNode>}
 * @public
 */
const getEnv = (envPath, name) => {
    let envNode = new EnvNode({ name: name ?? envPath });
    if (!path.isAbsolute(envPath)) {
        envPath = path.resolve(envPath);
    }
    if (!fs.existsSync(envPath)) {
        log(`"${envPath}" env文件不存在！`);
        return new EnvNode;
    }
    const content = fs.readFileSync(envPath).toString("utf8");
    envNode.path = envPath;
    envNode.content = content;
    const includePaths = getIncludePathsFromString(content);
    includePaths.forEach(includePath => {
        const name = includePath;
        includePath = handleEnvironmentVariable(includePath);
        const envPathDir = path.dirname(envPath);
        includePath = path.resolve(envPathDir, includePath);
        envNode.includes.push(getEnv(includePath, name));
    });
    return envNode;
};

/**
 * 解析含有远程url include的env文件
 *
 * @param {String} envPath 可以是远程url，也可以是本地文件路径path，远程路径必须为http/s， 本地则可以是相对或绝对
 * @return {Promise<String>} 遵循include规则处理后的env文件string内容组成的数组
 * @public
 */
const getEnvAsync = async (envPath, name) => {
    // 暂未考虑include同文件去重，或全局去重（不同包含层级）等问题。
    // 默认还是以后来者居上原则
    let envNode = new EnvNode({ name:  name ?? envPath });
    const isRemoteLink = isRemotePath(envPath);
    if (isRemoteLink) {
        const content = await getRemoteEnv(envPath);
        envNode.path = envPath;
        envNode.content = content;
        const includePaths = getIncludePathsFromString(content);
        for (let includePath of includePaths) {
            const name = includePath;
            includePath = handleEnvironmentVariable(includePath);
            includePath = new url.URL(includePath, envPath).href;
            envNode.includes.push( (await getEnvAsync(includePath, name)) );
        }
    } else {
        if (!path.isAbsolute(envPath)) {
            envPath = path.resolve(envPath);
        }
        if (!fs.existsSync(envPath)) {
            log(`"${envPath}" env文件不存在！`);
            return new EnvNode;
        }
        const content = fs.readFileSync(envPath).toString("utf8");
        envNode.path = envPath;
        envNode.content = content;
        const includePaths = getIncludePathsFromString(content, false);
        for (let includePath of includePaths) {
            const name = includePath;
            includePath = handleEnvironmentVariable(includePath);
            if (isRemotePath(includePath)) {
                envNode.includes.push( (await getEnvAsync(includePath, name)) );
            } else {
                includePath = path.resolve(path.dirname(envPath), includePath);
                envNode.includes.push( (await getEnvAsync(includePath, name)) );
            }
        }
    }
    return envNode;
};

export { getEnvAsync, getEnv };