import { log } from "./helper.js";
import { EnvNode } from "./getEnv.js";
import { IF_STATEMENT, ONE_IF_CONDITION, TWO_IF_CONDITION } from "./regs.js";

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
export default function (envNode) {
    if (!(envNode instanceof EnvNode)) throw TypeError("envNode 应为 EnvNode类型！");
    node = envNode;
    const infos = getIFStatementInfo(node.content);
    checkIFStatement(infos);
    const lines = content2lines(node.content);
    const fragments = getFragments(infos, lines);
    node = undefined;
    return fragments;
}