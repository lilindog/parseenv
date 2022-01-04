
/**
 * Parseenv v4.0.0-alpha
 * Author lilindog<lilin@lilin.site>
 * Last-Modify 2022/1/10
 * License ISC
 */

'use strict';

var http = require('http');
var https = require('https');
var url = require('url');
var path = require('path');
var fs = require('fs');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var http__default = /*#__PURE__*/_interopDefaultLegacy(http);
var https__default = /*#__PURE__*/_interopDefaultLegacy(https);
var url__default = /*#__PURE__*/_interopDefaultLegacy(url);
var path__default = /*#__PURE__*/_interopDefaultLegacy(path);
var fs__default = /*#__PURE__*/_interopDefaultLegacy(fs);

// 语句开始
const start = `(?<=(?:^|\\n) *)`;
// 语句结束
const end = `(?= *(?:\\r\\n|\\n|$))`;
// key声明
const identifier = `[a-z]\\w*`;
// 值,不能是空格，换行、中括号、大括号
const value = `[^\\r\\n\\ ]+`;
// list声明
const list = `${identifier}\\[\\]`;
// map语法检测
const map = `${identifier}\\{${identifier}\\}`;
// if语句的等于与不等于
const equa = `(?:=|!=)`;
// if语句使用变量
const usevariable = `\\[(?:${identifier}|${map})\\]`;
// 环境变量插值
const envinsert = `\\{${identifier}\\}`;
// if条件单元
const ifcondition = `(?:${usevariable}|${envinsert}|[^\\[\\]\\{\\}\\r\\n ]+)`;
// if和else if语句
const ifelseif = `${start}(?:if|else *if) *?${ifcondition}(?: *${equa} *${ifcondition})?${end}`;
// if 条件语句包括（if else if else endif）
const if_elseif_else_endif = `(?:${ifelseif}|${start}else${end}|${start}endif${end})`;
const KVStatement = `${start}(?:${identifier}|${map}|${list}) *= *${value}${end}`;
const includeStatement = `${start}include *${value}${end}`;

const IF_STATEMENT = new RegExp(if_elseif_else_endif, "ig");
const ONE_IF_CONDITION = new RegExp(`^(?:if|else *if) +?(${ifcondition})$`, "ig");
const TWO_IF_CONDITION = new RegExp(`^(?:if|else *if) +?(${ifcondition}) *(${equa}) *(${ifcondition})$`, "ig");
const STATEMENT = new RegExp(`(?:${KVStatement}|${includeStatement})`, "ig");
const INCLUDE_REG = new RegExp(includeStatement, "ig");
const ENV_INJECTION = /(?<!\\)\{([^\}]+)\}(?!\\)/ig;

const kConfigIsStrict = Symbol("k_config_is_strict");

const log = (msg, isErr) => {
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
 * 解析键值对到上下文
 *
 * @param {Object} context 结果上下文
 * @param {String} str kv对语句
 * @return {void}
 * @public
 */
const parseKV2Context = (context, str) => {
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
const getIncludePathsFromString = (str, isHandleEnvironmentVariable = true) => {
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
    const isNumber = /^\d+$/.test(value);
    return isNumber ? Number(value) : value;
};

/**
 * 该模块主要处理env（包括嵌套的）文件为字符串数组
 * 嵌套的按照嵌套的优先级处理
 */

/**
 * 解析结果节点
 *
 * @public
 */
class EnvNode {
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
            const u = new url__default["default"].URL(remoteUrl);
            u.hostname = u.hash = u.search = "";
            const redirectUrl = new url__default["default"].URL(res.headers.location, u.href).href;
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
    if (!path__default["default"].isAbsolute(envPath)) {
        envPath = path__default["default"].resolve(envPath);
    }
    if (!fs__default["default"].existsSync(envPath)) {
        log(`"${envPath}" env文件不存在！`);
        return new EnvNode;
    }
    const content = fs__default["default"].readFileSync(envPath).toString("utf8");
    envNode.path = envPath;
    envNode.content = content;
    const includePaths = getIncludePathsFromString(content);
    includePaths.forEach(includePath => {
        const name = includePath;
        includePath = handleEnvironmentVariable(includePath);
        const envPathDir = path__default["default"].dirname(envPath);
        includePath = path__default["default"].resolve(envPathDir, includePath);
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
            includePath = new url__default["default"].URL(includePath, envPath).href;
            envNode.includes.push( (await getEnvAsync(includePath, name)) );
        }
    } else {
        if (!path__default["default"].isAbsolute(envPath)) {
            envPath = path__default["default"].resolve(envPath);
        }
        if (!fs__default["default"].existsSync(envPath)) {
            log(`"${envPath}" env文件不存在！`);
            return new EnvNode;
        }
        const content = fs__default["default"].readFileSync(envPath).toString("utf8");
        envNode.path = envPath;
        envNode.content = content;
        const includePaths = getIncludePathsFromString(content, false);
        for (let includePath of includePaths) {
            const name = includePath;
            includePath = handleEnvironmentVariable(includePath);
            if (isRemotePath(includePath)) {
                envNode.includes.push( (await getEnvAsync(includePath, name)) );
            } else {
                includePath = path__default["default"].resolve(path__default["default"].dirname(envPath), includePath);
                envNode.includes.push( (await getEnvAsync(includePath, name)) );
            }
        }
    }
    return envNode;
};

let node;

class IFStatementInfo {
    static Types = {
        IF: "IF",
        ELSE: "ELSE",
        ELSEIF: "ELSEIF",
        ENDIF: "ENDIF"
    }

    /**
     * IFStatementInfo 字段说明
     *
     * type 表达式类型
     * statement 表达式
     * line 表达式在env内容字符串中的行数
     * position 表达式在env内容字符串中的开始位置索引
     * exec 执行statment条件的函数，返回表达式最终计算结果
     */
    static Fields = {
        type: "",
        statement: "",
        line: -1,
        position: -1,
        exec: ""
    }

    constructor (options = {}) {
        const Fields = JSON.parse(JSON.stringify(IFStatementInfo.Fields));
        Reflect.ownKeys(Fields).forEach(k => this[k] = options[k] ?? Fields[k]);
    }
}

/**
 * 获取ifelse表达式的节点数据 
 * 
 * @param {String} input env内容字符串
 * @param {Array}
 * @public
 */
const getIFStatementInfo = input => {
    const matches = [];
    /* eslint-disable */
    while (true) {
    /* eslint-enable */
        const r = IF_STATEMENT.exec(input);
        r && matches.push(r);
        if (!r) break;
    }
    const lines = getLines();
    const result = [];
    for (let match of matches) {
        for (let i = 0; i < lines.length; i++) {
            const row = lines[i];
            if (row.includes(match.index)) {
                const type = getStatementType(match[0]);
                const isNeedExec = [
                    IFStatementInfo.Types.IF,
                    IFStatementInfo.Types.ELSEIF
                ].includes(type);
                const ifStatementInfo = new IFStatementInfo({
                    type,
                    statement: match[0],
                    line: i + 1,
                    position: match.index,
                    exec: isNeedExec ? getStatementExecFunction(match[0]) : () => {}
                });
                result.push(ifStatementInfo);
                break;
            }
        }
    }
    return result;
    function getStatementExecFunction (statement = "") {
        ONE_IF_CONDITION.lastIndex = 0;
        TWO_IF_CONDITION.lastIndex = 0;
        const oic = ONE_IF_CONDITION.exec(statement);
        const tic = TWO_IF_CONDITION.exec(statement);
        if (oic) {
            const [, condition ] = oic;
            const _ = handleCondition(condition);
            let code = `return ${_};`;
            return new Function(code); // 目前，不是 if、else if 的语句会返回空函数，如：ELSE ENDIF 就会返回空函数
        } else if (tic) {
            const [, leftCondition, flag, rightCondition ] = tic;
            let equa = flag === "!=" ? " !== " : flag === "=" ? " === " : undefined;
            let l = handleCondition(leftCondition);
            let r = handleCondition(rightCondition);
            let code = `return ${l}${equa}${r};`;
            return new Function(code);
        }
        function handleCondition (condition = "") {
            // use variable
            if (condition[0] === "[" && condition.slice(-1)[0] === "]") {
                const l = condition.indexOf("{");
                const r = condition.indexOf("}");
                if (l > -1 && r > -1) {
                    return "this?." + condition.slice(1, l) + "?." + condition.slice(l + 1, r);
                } else {
                    return "this?." + condition.slice(1, -1);
                }
            } 
            // insert env variable`
            else if (condition[0] === "{" && condition.slice(-1)[0] === "}") {
                return `process?.${condition.slice(1, -1)}`;
            } 
            // string
            else {
                const isNumber = /^\d+$/g.test(condition);
                condition = isNumber ? condition : (`"${condition}"`);
                return `${condition}`;
            }
        }
    }
    function getStatementType (statement) {
        statement = statement.replace(/\s+/g, " ").toLocaleLowerCase();
        if (statement.startsWith("if")) return "IF";
        else if (statement.startsWith("else if")) return "ELSEIF";
        else if (statement.startsWith("else")) return "ELSE";
        else if (statement.startsWith("endif")) return "ENDIF";
    }
    function getLines () {
        let i = 0;
        let res = [];
        let temp = [];
        while (i < input.length) {
            if (input[i] === "\n") {
                res.push(temp);
                temp = [];
                i++;
            } else if (input[i] === "\r" && input[i + 1] === "\n") {
                res.push(temp);
                temp = [];
                i += 2;
            } else {
                temp.push(i);
                i++;
            }
        }
        res.push(temp);
        return res;
    }
}; 

/**
 * content转换为行
 *  
 * @param {String} input
 * @return {Array<String>}
 * @private
 */
function content2lines (input = "") {
    let lines = [];
    let str = "";
    for (let i = 0; i < input.length;) {
        const char = input[i];
        if (char === "\n") {
            i++;
            lines.push(str);
            str = "";
        } else if (char === "\r" && input[i + 1] === "\n") {
            lines.push(str);
            str = "";
            i += 2;
        } else {
            i++;
            str += char;
        }
    }
    if (str) lines.push(str);
    return lines;
}

/**
 * 检测if等语法的配套合法性
 * 
 * @param {Array} infos
 * @return {void}
 * @private
 */
function checkIFStatement (infos = []) {
    if (!infos.length) return;
    let current = infos[0];
    if (current.type !== "IF") {
        log(buildErrorTips(current.line, current.position, "应该为if表达式！"), true);
    }
    for (let i = 1; i < infos.length; i++) {
        const info = infos[i];
        if (current.type === IFStatementInfo.Types.IF) {
            if (
                ![
                    IFStatementInfo.Types.ENDIF, 
                    IFStatementInfo.Types.ELSE, 
                    IFStatementInfo.Types.ELSEIF
                ].includes(info.type)
            ) {
                log(buildErrorTips(info.line, info.position, "不应该为if表达式！"), true);
            }
            current = info;
            continue;
        }
        if (current.type === IFStatementInfo.Types.ENDIF) {
            if (info.type !== IFStatementInfo.Types.IF) {
                log(buildErrorTips(info.line, info.position, "应该为if表达式！"), true);
            }
            current = info;
            continue;
        }
        if (current.type === IFStatementInfo.Types.ELSEIF) {
            if (!["ENDIF", "ELSEIF", "ELSE"].includes(info.type)) {
                log(buildErrorTips(info.line, info.position, "不应该为if表达式！"), true);
            }
            current = info;
            continue;
        }
        if (current.type === IFStatementInfo.Types.ELSE) {
            if (info.type !== IFStatementInfo.Types.ENDIF) {
                log(buildErrorTips(info.line, info.position, "应该为endif表达式！"), true);
            }
            current = info;
            continue;
        }
    }
    if (current.type !== IFStatementInfo.Types.ENDIF) {
        log(buildErrorTips(current.line, current.position, "没有对应的结束的endif表达式！"), true);
    }
}

function buildErrorTips (line, position, msg) {
    let tips = `${node.path} 第${line}行${msg}\n`;
    tips += `>>> ${readPositionCodeFragment(node.content, position)}\n`;
    return tips;
}

function readPositionCodeFragment (code = "", position = 0) {
    let s = "";
    while (position < code.length) {
        const char = code[position];
        if (char === "\r") break;
        else s += char;
        position++;
    }
    return s;
}

/**
 * 获取env content的片段
 * 主要为了方便处理ifstatment表达式
 * 返回数组类型，元素为字符串或函数，函数需要执行才能返回字符串
 * 
 * @param {Array<IFStatementInfo>} infos
 * @param {Array<String>} lines
 * @return {Array<Function|String>}
 * @private
 */
function getFragments (infos, lines) {
    if (!infos.length) return [lines.join("\r\n")];
    // 需要注意，info的line是从1开始的，对应0，因为为了方便人读取，所以从1开始
    let res = [];
    let code = "";
    // ifelse statement前面的表达式
    if (infos[0].line !== 1) {
        res.push(
            lines.slice(0, infos[0].line - 1).join("\r\n") // info的line是从1开始的，为了方便人读取
        );
    }
    // ifelse表达式, 此处不用处理ifelse statement的合法检查
    for (let i = 0; i < infos.length; i++) {
        const info = infos[i];
        if (info.type === "IF") {
            const block = lines.slice(info.line, infos[i + 1].line - 1).join("\r\n");
            code += `
                const fcondition${i} = ${info.exec.toString()};
                if (fcondition${i}.call(this)) {
                    return \`${block}\`;
                }
            `;
        } else if (info.type === "ELSEIF") {
            code = `const fcondition${i} = ${info.exec.toString()};\r\n` + code;
            code += `
                else if (fcondition${i}.call(this)) {
                    return \`${lines.slice(info.line, infos[i + 1].line - 1).join("\r\n")}\`;
                }
            `;
        } else if (info.type === "ELSE") {
            code += `
                else {
                    return \`${lines.slice(info.line, infos[i + 1].line - 1).join("\r\n")}\`;
                }
            `;
        } else if (info.type === "ENDIF") {
            res.push(new Function(code));
            code = "";
            // 处理剩下的非ifelse staement语句或下次if statement之间的语句
            if (infos[i + 1]) {
                res.push(lines.slice(info.line, infos[i + 1].line - 1).join("\r\n"));
            } else {
                res.push(lines.slice(info.line).join("\r\n"));
            }
        }
    }
    return res;
}

/**
 * 入口
 * 
 * @param {EnvNode} envNode
 * @param {(void|Array<IFStatementInfo>)}
 * @public
 */
function getFragments$1 (envNode) {
    if (!(envNode instanceof EnvNode)) throw TypeError("envNode 应为 EnvNode类型！");
    node = envNode;
    const infos = getIFStatementInfo(node.content);
    checkIFStatement(infos);
    const lines = content2lines(node.content);
    const fragments = getFragments(infos, lines);
    node = undefined;
    return fragments;
}

function main (context = {}, envNode = {}) {
    const fragments = getFragments$1(envNode);
    for (let fragment of fragments) {
        let fragmentContent = "";
        if (typeof fragment === "function") {
            fragmentContent = fragment.call(context) || "";
        } else {
            fragmentContent = fragment;
        }
        let rows = fragmentContent.match(STATEMENT) || [];
        for (let row of rows) {
            // include statement
            if (row.toLocaleLowerCase().startsWith("include")) {
                row = row.replace(/ +/g, " ");
                const [, path] = row.split(" ");
                const node = envNode.includes.find(node => {
                    return node.name === path;
                });
                if (node) main(context, node);
            }
            // KV statement
            else {
                parseKV2Context(context, row);
            }
        }
    }
}

/**
 * 入口
 *
 * @param {String} envPath 本地env文件路径或者远程env文件链接
 * @param {Object} [options] 配置对象，可选
 * @param {Boolean} [options.isStrict] 是否是严格模式，严格模式下env文件找不到会抛错
 * @return {(Object|Promise<Object>)}
 */
var main$1 = (envPath, options) => {
    if (options && {}.toString.call(options) === "[object Object]") {
        const { isStrict } = options;
        global[kConfigIsStrict] = isStrict;
    }
    const context = {};
    if (isRemotePath(envPath)) {
        return getEnvAsync(envPath)
            .then(node => {
                main(context, node);
                return context;
            });
    }
    if (hasRemotePath(envPath)) {
        return getEnvAsync(envPath)
            .then(node => {
                main(context, node);
                return context;
            });
    } else {
        const node = getEnv(envPath);
        main(context, node);
        return context;
    }
};

module.exports = main$1;
//# sourceMappingURL=parseenv.js.map
