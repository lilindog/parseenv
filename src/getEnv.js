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
    isRemotePath,
    log
} from "./helper.js";
import {
    KVStatement,
    IfStatement,
    ElseIfStatement,
    ElseStatement,
    EndifStatement,
    IncludeStatement
} from "./statementTypes.js";
import { parse } from "./parse.js";
import { kConfigTimeout } from "./constans.js";

function mergePath (left, right) {
    if (isRemotePath(right)) {
        return right;
    }
    if (isRemotePath(left)) {
        return new url.URL(right, left).toString();
    } else {
        return path.resolve(path.dirname(left), right);
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
const requestRemoteEnv = (
    remoteUrl,
    resolveCb,
    timeout = global[kConfigTimeout] || 1000,
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
            requestRemoteEnv(redirectUrl, done, timeout, --redirects);
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
 * @context {result}
 * @param {String} envPath env入口文件路径，可以是相对也可以是绝对
 * @return {void}
 * @public
 */
function getEnv (envPath) {
    if (!path.isAbsolute(envPath)) {
        envPath = path.resolve(envPath);
    }
    if (!fs.existsSync(envPath)) {
        log(`"${envPath}" env文件不存在！`);
        return;
    }
    const content = fs.readFileSync(envPath).toString("utf8");
    let statements = [];
    try {
        statements = parse(content);
    } catch (err) {
        log(`${envPath}\r\n${err}`, true);
    }

    // handle statement
    let pre_condition = false;
    let skip_block = false;
    for (let index = 0; index < statements.length; index++) {
        const statement = statements[index];
        if (skip_block) {
            if (
                [
                    IfStatement,
                    ElseIfStatement,
                    ElseStatement,
                    EndifStatement
                ].some(i => statement instanceof i)
            ) {
                skip_block = false;
            } else {
                continue;
            }
        }

        if (statement instanceof KVStatement) {
            if (statement.property) {
                if (!this[statement.field]) this[statement.field] = {};
                this[statement.field][statement.property] = statement.getValue();
            } else {
                this[statement.field] = statement.getValue();
            }
        }
        else if (statement instanceof IncludeStatement) {
            getEnv.call(
                this,
                mergePath(envPath, statement.getValue())
            );
        }
        else if (statement instanceof ElseIfStatement) {
            if (pre_condition) {
                skip_block = true;
                continue;
            }
            pre_condition = statement.convert2function().call(this);
            if (!pre_condition) {
                skip_block = true;
            }
        }
        else if (statement instanceof IfStatement) {
            pre_condition = statement.convert2function().call(this);
            if (!pre_condition) {
                skip_block = true;
            }
        }
        else if (statement instanceof ElseStatement) {
            if (pre_condition) {
                skip_block = true;
                continue;
            }
        }
        else if (statement instanceof EndifStatement) {
            pre_condition = false;
        }
    }
}

/**
 * 解析含有远程url include的env文件
 *
 * @param {String} envPath 可以是远程url，也可以是本地文件路径path，远程路径必须为http/s， 本地则可以是相对或绝对
 * @return {void}
 * @public
 */
async function getEnvAsync (envPath) {
    let content = "";
    if (isRemotePath(envPath)) {
        content = await requestRemoteEnv(envPath);
    } else {
        if (!path.isAbsolute(envPath)) envPath = path.resolve(envPath);
        if (!fs.existsSync(envPath)) {
            log(`"${envPath}" env文件不存在！`);
            return;
        }
        content = fs.readFileSync(envPath).toString("utf8");
    }

    let statements = [];
    try {
        statements = parse(content);
    } catch (err) {
        log(envPath + "\r\n" + err, true);
    }

    // handle statement
    let pre_condition = false;
    let skip_block = false;
    for (let index = 0; index < statements.length; index++) {
        const statement = statements[index];
        if (skip_block) {
            if (
                [
                    IfStatement,
                    ElseIfStatement,
                    ElseStatement,
                    EndifStatement
                ].some(i => statement instanceof i)
            ) {
                skip_block = false;
            } else {
                continue;
            }
        }

        if (statement instanceof KVStatement) {
            if (statement.property) {
                if (!this[statement.field]) this[statement.field] = {};
                this[statement.field][statement.property] = statement.getValue();
            } else {
                this[statement.field] = statement.getValue();
            }
        }
        else if (statement instanceof IncludeStatement) {
            await getEnvAsync.call(
                this,
                mergePath(envPath, statement.getValue())
            );
        }
        else if (statement instanceof ElseIfStatement) {
            if (pre_condition) {
                skip_block = true;
                continue;
            }
            pre_condition = statement.convert2function().call(this);
            if (!pre_condition) {
                skip_block = true;
            }
        }
        else if (statement instanceof IfStatement) {
            pre_condition = statement.convert2function().call(this);
            if (!pre_condition) {
                skip_block = true;
            }
        }
        else if (statement instanceof ElseStatement) {
            if (pre_condition) {
                skip_block = true;
                continue;
            }
        }
        else if (statement instanceof EndifStatement) {
            pre_condition = false;
        }
    }
}

/**
 * export modules
 */
export { getEnv, getEnvAsync };