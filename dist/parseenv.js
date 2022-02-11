
/**
 * Parseenv v4.1.7
 * Author lilindog<lilin@lilin.site>
 * Last-Modify 2022/2/11
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

const kConfigIsStrict = Symbol("k_config_is_strict");
const kConfigTimeout = Symbol("k_config_timeout");

/**
 * handle value env insert
 *
 * @return {String}
 * @private
 */
function handleValue () {
    let value = this.value;
    let insert_letter = "";
    let index = 0;
    const results = [];
    while (index < value.length) {
        const char = value[index];
        if (insert_letter) {
            if (char === "}" && value[index - 1] !== "\\") {
                insert_letter += "}";
                results.push(insert_letter);
                insert_letter = "";
            } else {
                insert_letter += char;
            }
        } else {
            if (char === "{" && value[index - 1] !== "\\") {
                insert_letter = "{";
            }
        }
        index++;
    }
    results.forEach(key => {
        let field = key.slice(1, -1);
        field = process.env?.[field] ? String(process.env?.[field]) : "NONE";
        value = value.replace(key, field);
    });
    // "123" -> Number or "123c" -> String
    value = isNaN(Number(value)) ? value : Number(value);
    return value;
}

/**
 * rowType base class
 *
 * @private
 */
class RowBase {
    static Fields = {
        // statement 起始位置
        position: -1
    };

    constructor (options = {}) {
        const Fields = JSON.parse(JSON.stringify(
            Object.assign({}, RowBase.Fields, new.target.Fields)
        ));
        Reflect.ownKeys(Fields).forEach(k => this[k] = options[k] !== undefined ? options[k] : Fields[k]);
    }
}

/**
 * key - value
 *
 * @public
 */
class KVStatement extends RowBase {
    static Types = {
        KEY: "KEY",
        LIST: "LIST",
        MAP: "MAP",
        DEFAULT: "DEFAULT" // 未指定
    };

    static Fields = {
        type: KVStatement.Types.DEFAULT,
        field: "",
        property: "", // Type == MAP 才有
        value: ""
    };

    constructor (props) {
        super(props);
    }

    getValue () {
        return handleValue.call(this);
    }
}

/**
 * operater
 *
 * @public
 */
class Operator extends RowBase {
    static Types = {
        EQUAL: "EQUAL",
        NO_EQUAL: "NO_EQUAL",
        DEFAULT: "DEFAULT"
    };

    static Fields = {
        type: Operator.Types.DEFAULT
    } ;

    constructor (props) {
        super(props);
    }
}

/**
 * condition
 *
 * @public
 */
class Condition extends RowBase {
    static Types = {
        LITERAL: "LITERAL",
        USE_VARIABLE: "USE_VARIABLE",
        USE_ENV: "USE_ENV",
        DEFAULT: "DEFAULT"
    };

    static Fields = {
        type: Condition.Types.DEFAULT,
        field: "",
        property: "" // 使用变量map时才需要指定该字段
    };

    constructor (props) {
        super(props);
    }
}

/**
 * if statement
 *
 * @public
 */
class IfStatement extends RowBase {
    static Fields = {
        conditions: []
    };

    constructor (props) {
        super(props);
    }

    get lastCondition () {
        return this.conditions[this.conditions.length - 1];
    }

    /**
     * 将条件转换为函数
     */
    convert2function () {
        let preConditionCode = "";
        let code = "";
        this.conditions.forEach((condition, index) => {
            // compute operator
            if (condition instanceof Operator) {
                const operator =
                    condition.type === Operator.Types.EQUAL ? "===" :
                        condition.type === Operator.Types.NO_EQUAL ? "!==" :
                            "";
                if (index > 1) code += ` && ${preConditionCode} ${operator} `;
                else code += operator;
            }
            // condition statement
            else {
                switch (condition.type) {
                    case Condition.Types.LITERAL: {
                        preConditionCode = isNaN(Number(condition.field)) ? ` "${condition.field}" ` : ` ${condition.field} `;
                        code += preConditionCode;
                        break;
                    }
                    case Condition.Types.USE_ENV: {
                        preConditionCode = ` 
                            (
                                isNaN(Number(process.env?.${condition.field})) ? 
                                process.env?.${condition.field} : 
                                Number(process.env?.${condition.field})
                            ) 
                        `;
                        code += preConditionCode;
                        break;
                    }
                    case Condition.Types.USE_VARIABLE: {
                        preConditionCode = ` this?.${condition.field}`;
                        if (condition.property) preConditionCode += `?.${condition.property}`;
                        code += preConditionCode;
                        break;
                    }
                }
            }
        });
        return new Function ("return ( " + code + " );");
    }
}

/**
 * else if statement
 *
 * @public
 */
class ElseIfStatement extends IfStatement {
    static Fields = Object.assign({}, IfStatement.Fields);
    constructor (props) {
        super(props);
    }
}

/**
 * else
 *
 * @public
 */
class ElseStatement extends RowBase {
    static Fields = {};
    constructor (props) {
        super(props);
    }
}

/**
 * endif
 *
 * @public
 */
class EndifStatement extends RowBase {
    static Fields = {};
    constructor (props) {
        super(props);
    }
}

/**
 * include statement
 *
 * @public
 */
class IncludeStatement extends RowBase {
    static Fields = {
        value: "" // 可以换为编译好的函数处理环境变量插值后返回真正的值
    };

    constructor (props) {
        super(props);
    }

    getValue () {
        return handleValue.call(this);
    }
}

/**
 * comment statement
 *
 * @public
 */
class CommentStatement extends RowBase {
    static Fields = {
        value: ""
    };

    constructor (props) {
        super(props);
    }
}

let INDEX = 0;
let result = [];
let statement = null;
let input = "";
let ERR_MSG = "";

/**
 * parse env string content to statement
 *
 * @param input {String}
 * @returns {RowBase[]}
 * @public
 */
function parse (content = "") {
    input = content;

    let STATE = "START"; // START\KEY\VALUE\CONDITION\EQUA\COMMENT\END\DONE\CALC
    let IN_LIST = false;
    let IN_MAP = false;
    let IN_USE_VARIABLE = false;
    let IN_ENV_INSERT = false;
    let IN_USE_VARIABLE_MAP = false;
    let IN_VALUE_ENV_INSERT = false;
    let pre_condition_statement = null;

    while (STATE !== "DONE") {
        let char = input[INDEX];
        switch (STATE) {

            case "START": {
                skipSpaceAndCRLF();
                char = input[INDEX];
                if (char === "#") {
                    STATE = "COMMENT";
                    statement = new CommentStatement({ position: INDEX });
                    break;
                }

                const howIf = readCharByCount(3).toLowerCase();
                const howElse = readCharByCount(4).toLowerCase();
                const howElseIf = readCharByCount(7).toLowerCase();
                const howEndIf = readCharByCount(5).toLowerCase();
                const howInclude = readCharByCount(8).toLowerCase();
                let skipLen = 0;
                if (howIf === "if ") {
                    INDEX += 3;
                    skipLen = skipSpace();
                    char = input[INDEX];
                    if (char === "=") {
                        STATE = "KEY";
                    } else {
                        STATE = "IF";
                    }
                    INDEX -= (skipLen + 3);
                } else if (howElseIf === "else if") {
                    STATE = "ELSEIF";
                } else if (howElse === "else") {
                    INDEX += 4;
                    skipLen = skipSpace();
                    char = input[INDEX];
                    INDEX -= (skipLen + 4);
                    if (char === "=") {
                        STATE = "KEY";
                    } else {
                        STATE = "ELSE";
                    }
                } else if (howEndIf === "endif") {
                    INDEX += 5;
                    skipLen = skipSpace();
                    char = input[INDEX];
                    INDEX -= (skipLen + 5);
                    if (char === "=") {
                        STATE = "KEY";
                    } else {
                        STATE = "ENDIF";
                    }
                } else if (howInclude === "include ") {
                    INDEX += 8;
                    skipLen = skipSpace();
                    char = input[INDEX];
                    if (char === "=") {
                        INDEX -= (skipLen + 8);
                        STATE = "KEY";
                    } else {
                        STATE = "VALUE";
                        statement = new IncludeStatement({ position: INDEX - (skipLen + 8) });
                    }
                } else if (char === undefined) {
                    STATE = "END";
                } else {
                    STATE = "KEY";
                }
                break;
            }

            case "IF": {
                if (
                    pre_condition_statement &&
                    !(pre_condition_statement instanceof EndifStatement)
                ) {
                    ERR_MSG = "if 语句不应该出现在此处";
                    STATE = "";
                    break;
                }
                pre_condition_statement = statement = new IfStatement({ position: INDEX });
                const s = readIdentifier();
                if (s !== "if") {
                    STATE = "";
                    break;
                }
                STATE = "CONDITION";
                break;
            }

            case "ELSEIF": {
                if (
                    readIdentifier().toLowerCase() !== "else" ||
                    skipSpace() === 0 ||
                    readIdentifier().toLowerCase() !== "if" ||
                    skipSpace() === 0
                ) {
                    STATE = "";
                    break;
                }
                if (
                    !pre_condition_statement ||
                    (
                        !(pre_condition_statement instanceof ElseIfStatement) &&
                        !(pre_condition_statement instanceof IfStatement)
                    )
                ) {
                    ERR_MSG = "else if 语句不应该出现在此处";
                    STATE = "";
                    break;
                }
                pre_condition_statement = statement = new ElseIfStatement({ position: INDEX });
                STATE = "CONDITION";
                break;
            }

            case "ELSE": {
                if (
                    !pre_condition_statement ||
                    (
                        !(pre_condition_statement instanceof IfStatement) &&
                        !(pre_condition_statement instanceof ElseIfStatement)
                    )
                ) {
                    ERR_MSG = "else 语句不应该出现在此处";
                    STATE = "";
                    break;
                }
                pre_condition_statement = statement = new ElseStatement({ position: INDEX });
                if (readIdentifier().toLowerCase() === "else") {
                    STATE = "END";
                } else {
                    STATE = "";
                }
                break;
            }

            case "ENDIF": {
                if (
                    !pre_condition_statement ||
                    (
                        !(pre_condition_statement instanceof IfStatement) &&
                        !(pre_condition_statement instanceof ElseIfStatement) &&
                        !(pre_condition_statement instanceof ElseStatement)
                    )
                ) {
                    ERR_MSG = "endif 语句不应该出现在此处";
                    STATE = "";
                    break;
                }
                pre_condition_statement = statement = new EndifStatement({ position: INDEX });
                if (readIdentifier().toLowerCase() === "endif") {
                    STATE = "END";
                } else {
                    STATE = "";
                }
                break;
            }

            case "END": {
                skipSpace();
                char = input[INDEX];
                if (isCRLF(char)) {
                    skipSpaceAndCRLF();
                    STATE = "START";
                    append();
                } else if (char === undefined) {
                    // check condition statements
                    if (
                        pre_condition_statement &&
                        !(pre_condition_statement instanceof EndifStatement)
                    ) {
                        ERR_MSG = "缺少endif";
                        STATE = "";
                        INDEX = pre_condition_statement.position; // 指定报错位置
                        break;
                    }
                    // done exit while loop
                    STATE = "DONE";
                    append();
                } else {
                    STATE = "";
                }
                break;
            }

            case "COMMENT": {
                let s = "";
                while (INDEX < input.length) {
                    char = input[INDEX];
                    if (isCRLF(char)) {
                        break;
                    } else {
                        s += char;
                        INDEX++;
                    }
                }
                statement.value = s;
                STATE = "END";
                break;
            }

            case "KEY": {
                if (IN_LIST) {
                    if (char === "]") {
                        INDEX++;
                        IN_LIST = false;
                        STATE = "EQUA";
                    } else {
                        STATE = "";
                    }
                } else if (IN_MAP) {
                    if (!isLetter(char)) {
                        STATE = "";
                        break;
                    }
                    const s = readIdentifier();
                    statement.property = s;
                    char = input[INDEX];
                    if (char === "}") {
                        STATE = "EQUA";
                        IN_MAP = false;
                        INDEX++;
                    } else {
                        STATE = "";
                    }
                } else {
                    statement = new KVStatement({ position: INDEX });
                    if (!isLetter(char)) {
                        STATE = "";
                        break;
                    }
                    const s = readIdentifier();
                    statement.field = s;
                    char = input[INDEX];
                    if (char === "{") {
                        INDEX++;
                        IN_MAP = true;
                        statement.type = KVStatement.Types.MAP;
                    } else if (char === "[") {
                        INDEX++;
                        IN_LIST = true;
                        statement.type = KVStatement.Types.LIST;
                    } else if (isSpace(char) || char === "=") {
                        statement.type = KVStatement.Types.KEY;
                        STATE = "EQUA";
                    } else {
                        STATE = "";
                    }
                }
                break;
            }

            case "EQUA": {
                skipSpace();
                char = input[INDEX];
                if (char === "=") {
                    INDEX++;
                    STATE = "VALUE";
                } else {
                    STATE = "";
                }
                break;
            }

            // path or value
            case "VALUE": {
                /**
                 * 暂时对value里的env insert 只做语法检测
                 * 不做解析处理，在statement类型里边做解析处理
                 */
                if (IN_VALUE_ENV_INSERT) {
                    if (!isLetter(char)) {
                        STATE = "";
                        break;
                    }
                    const s = readIdentifier();
                    statement.value += s;
                    char = input[INDEX];
                    if (char !== "}") {
                        STATE = "";
                        break;
                    }
                    statement.value += "}";
                    IN_VALUE_ENV_INSERT = false;
                    INDEX++;
                    char = input[INDEX];
                    if (isSpace(char) || isCRLF(char)) {
                        STATE = "END";
                    }
                } else {
                    skipSpace();
                    let s = "";
                    while (INDEX < input.length) {
                        char = input[INDEX];
                        if (
                            isSpace(char) || isCRLF(char) ||
                            (char === "{" && input[INDEX - 1] !== "\\") ||
                            // 不需要处理“}”, 仅当检测到未转义符的“}”时让出，好让后续逻辑抛错！
                            (char === "}" && input[INDEX - 1] !== "\\")
                        ) {
                            break;
                        } else {
                            s += char;
                            INDEX++;
                        }
                    }
                    char = input[INDEX];
                    if (char === "{") {
                        statement.value += s + "{";
                        INDEX++;
                        IN_VALUE_ENV_INSERT = true;
                    } else if (s || statement.value) { // 本意本来不让statement参与判断，这里我不愿定义其它flag变量，暂时先这样了！
                        statement.value += s || "";
                        STATE = "END";
                    } else {
                        STATE = "";
                    }
                }
                break;
            }

            /**
             * 条件语句中的条件处理（不包含运算符=、！=）
             * !!! 逻辑出口部分记得处理end状态（有可能没有下次循环，需要在本次循环内处理end逻辑）
             */
            case "CONDITION": {
                skipSpace();
                char = input[INDEX];
                // 使用声明变量中的map字段
                if (IN_USE_VARIABLE_MAP) {
                    if (!isLetter(char)) {
                        STATE = "";
                        break;
                    }
                    const s = readIdentifier();
                    statement.lastCondition.property = s;
                    char = input[INDEX];
                    // use variable map end
                    if (char !== "}") {
                        STATE = "";
                        break;
                    }
                    INDEX++;
                    char = input[INDEX];
                    if (char === "]") {
                        INDEX++;
                        IN_USE_VARIABLE_MAP = false;
                        IN_USE_VARIABLE = false;
                        STATE = "CALC";
                    } else {
                        STATE = "";
                    }
                }
                // 使用声明变量
                else if (IN_USE_VARIABLE) {
                    if (!isLetter(char)) {
                        STATE = "";
                        break;
                    }
                    const s = readIdentifier();
                    statement.lastCondition.field = s;
                    char = input[INDEX];
                    // use variable结束
                    if (char === "]") {
                        IN_USE_VARIABLE = false;
                        INDEX++;
                        STATE = "CALC";
                    }
                    // use variable map 开始
                    else if (char === "{") {
                        IN_USE_VARIABLE_MAP = true;
                        INDEX++;
                    } else {
                        STATE = "";
                    }
                }
                // 使用环境变量插值
                else if (IN_ENV_INSERT) {
                    if (!isLetter(char)) {
                        STATE = "";
                        break;
                    }
                    const s = readIdentifier();
                    statement.lastCondition.field = s;
                    char = input[INDEX];
                    if (char === "}") {
                        INDEX++;
                        IN_ENV_INSERT = false;
                        STATE = "CALC";
                    } else {
                        STATE = "";
                    }
                }
                // 字面量
                else {
                    // 字面量, 允许数字开头
                    if (isLetter(char) || isNumber(char)) {
                        const s = readIdentifier();
                        const condition = new Condition({
                            type: Condition.Types.LITERAL,
                            field: s
                        });
                        statement.conditions.push(condition);
                        STATE = "CALC";
                    }
                    // use variable start
                    else if (char === "[") {
                        INDEX++;
                        IN_USE_VARIABLE = true;
                        const condition = new Condition({
                            type: Condition.Types.USE_VARIABLE
                        });
                        statement.conditions.push(condition);
                    }
                    // use envvariable start
                    else if (char === "{") {
                        INDEX++;
                        IN_ENV_INSERT = true;
                        const condition = new Condition({
                            type: Condition.Types.USE_ENV
                        });
                        statement.conditions.push(condition);
                    } else {
                        STATE = "";
                    }
                }
                break;
            }

            /**
             * =、!= 处理
             */
            case "CALC": {
                skipSpace();
                char = input[INDEX];
                if (char === "=") {
                    INDEX++;
                    STATE = "CONDITION";
                    statement.conditions.push(
                        new Operator({type: Operator.Types.EQUAL})
                    );
                } else if (char === "!") {
                    const next = readCharByCount(2);
                    if (next === "!=") {
                        INDEX += 2;
                        STATE = "CONDITION";
                        statement.conditions.push(
                            new Operator({type: Operator.Types.NO_EQUAL})
                        );
                    } else {
                        STATE = "";
                    }
                } else if (char === undefined || isCRLF(char) || isSpace(char)) {
                    STATE = "END";
                } else {
                    STATE = "";
                }
                break;
            }

            default: {
                throw ERR_MSG + getErrorText(input, INDEX);
            }
        }
        // switch end
    }
    // while end

    const return_result = result;
    result = [];
    INDEX = 0;
    statement = undefined;
    input = "";
    ERR_MSG = "";

    return return_result;
}

// debug begin =============
// const st = parse(content);
// const cds = st.filter(i => i instanceof IfStatement || i instanceof ElseIfStatement);
// cds.forEach(i => console.log(i.convert2function().toString()));
// debug end ===============

function readCharByCount (count) {
    return input.slice(INDEX, INDEX + count);
}

function readIdentifier () {
    let s = "";
    while (INDEX < input.length) {
        const char = input[INDEX];
        if (isLetter(char) || isNumber(char) || char === "_") {
            s += char;
            INDEX++;
        } else {
            break;
        }
    }
    return s;
}

function append () {
    if (!statement) return;
    result.push(statement);
    statement = undefined;
}

function isSpace (char) {
    return char === undefined ? false : char.codePointAt(0) === 32;
}

function isCRLF (char) {
    return ["\r", "\n"].includes(char);
}

function isLetter (char = "") {
    const point = char.toLowerCase().codePointAt(0);
    return (point < 123 && point > 96) || ["_"].includes(char);
}

function isNumber (char = "") {
    if (char === undefined) return false;
    const point = char.codePointAt(0);
    return point > 47 && point < 58;
}

function skipSpace () {
    let count = 0;
    while (INDEX < input.length) {
        if (isSpace(input[INDEX])) {
            INDEX++;
            count++;
        } else {
            break;
        }
    }
    return count;
}

function skipSpaceAndCRLF () {
    let count = 0;
    while (INDEX < input.length) {
        const char = input[INDEX];
        if (isSpace(char) || isCRLF(char)) {
            INDEX++;
            count++;
        } else {
            break;
        }
    }
    return count;
}

function getErrorText (text = "", position = -1) {
    text = text || input;
    const lines = [/* "xxxx\n", "xxxx\n", ... */];
    const positions = [/* [1,2,3,4], ... */];
    let index = 0;
    let line = "";
    let spots = [];
    while (index < text.length + 1) {
        const char = text[index];
        if (char === "\n" || char === "\r") {
            if (char === "\r") {
                if (text[index + 1] !== "\n") throw new Error("此处应为'\n'!");
                spots.push(index, index + 1);
                index += 2;
            } else {
                spots.push(index);
                index += 1;
            }
            lines.push(line);
            line = "";
            positions.push(spots);
            spots = [];
        } else if (char === undefined) {
            lines.push(line);
            line = "";
            positions.push(spots);
            spots = [];
            break;
        } else {
            spots.push(index);
            line += char;
            index++;
        }
    }
    const PRE_LINE_COUNT = 2; // 带上前面多少行
    line = -1;
    index = 0;
    let preSpaceLen = 0;
    while (index < positions.length) {
        spots = positions[index];
        if (spots.includes(position)) {
            preSpaceLen = position - spots[0];
            line = index;
            break;
        }
        index++;
    }
    if (line === -1) {
        line = positions.length - 1;
        preSpaceLen = positions[positions.length - 1].length;
    }
    index = PRE_LINE_COUNT > line ? 0 : line - PRE_LINE_COUNT;
    let tips = "\r\n";
    let lastLinePreLen = 0;
    for (; index <= line; index++) {
        const pre = "line" + (index + 1) + " >  ";
        lastLinePreLen = pre.length;
        tips += pre + lines[index] + "\r\n";
    }
    lastLinePreLen += preSpaceLen;
    tips += " ".repeat(lastLinePreLen) + "^\r\n";
    tips += " ".repeat(lastLinePreLen) + "语法错误\r\n";
    tips += " ".repeat(lastLinePreLen) + "语法规则参考：https://github.com/lilindog/parseenv/blob/master/doc/grammar.md\r\n";
    return tips;
}

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
    let statements = [];
    try {
        statements = parse(fs__default["default"].readFileSync(envPath).toString("utf8")).filter(i => i instanceof IncludeStatement);
    } catch (err) {
        log(envPath + "\r\n" + err, true);
    }
    for (let include of statements) {
        if (isRemotePath(include.value)) return true;
        const envPathDir = path__default["default"].dirname(envPath);
        if (hasRemotePath(path__default["default"].resolve(envPathDir, include.getValue()))) return true;
    }
    return false;
};

/**
 * 该模块主要处理env（包括嵌套的）文件为字符串数组
 * 嵌套的按照嵌套的优先级处理
 */

function mergePath (left, right) {
    if (isRemotePath(right)) {
        return right;
    }
    if (isRemotePath(left)) {
        return new url__default["default"].URL(right, left).toString();
    } else {
        return path__default["default"].resolve(path__default["default"].dirname(left), right);
    }
}

function handleKVStatement2Context (statement = {}) {
    ({
        [KVStatement.Types.KEY] () {
            this[statement.field] = statement.getValue();
        },
        [KVStatement.Types.MAP] () {
            if (!this[statement.field]) this[statement.field] = {};
            this[statement.field][statement.property] = statement.getValue();
        },
        [KVStatement.Types.LIST] () {
            if (!this[statement.field]) this[statement.field] = [];
            this[statement.field].push(statement.getValue());
        }
    })[statement.type].call(this);
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
    if (!path__default["default"].isAbsolute(envPath)) {
        envPath = path__default["default"].resolve(envPath);
    }
    if (!fs__default["default"].existsSync(envPath)) {
        log(`"${envPath}" env文件不存在！`);
        return;
    }
    const content = fs__default["default"].readFileSync(envPath).toString("utf8");
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
            handleKVStatement2Context.call(this, statement);
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
        if (!path__default["default"].isAbsolute(envPath)) envPath = path__default["default"].resolve(envPath);
        if (!fs__default["default"].existsSync(envPath)) {
            log(`"${envPath}" env文件不存在！`);
            return;
        }
        content = fs__default["default"].readFileSync(envPath).toString("utf8");
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
            handleKVStatement2Context.call(this, statement);
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
 * 入口
 *
 * @param {String} envPath 本地env文件路径或者远程env文件链接
 * @param {Object} [options] 配置对象，可选
 * @param {Boolean} [options.isStrict] 是否是严格模式，严格模式下env文件找不到会抛错
 * @param {Number} [options.timeout] 加载远程env文件的超时时间，单位为ms， 缺省为1秒
 * @return {(Object|Promise<Object>)}
 */
var main = (envPath, options) => {
    if (options && {}.toString.call(options) === "[object Object]") {
        const { isStrict, timeout } = options;
        if (isStrict !== undefined && typeof isStrict === "boolean") {
            global[kConfigIsStrict] = isStrict;
        }
        if (timeout && (typeof timeout === "number") && timeout > 0) {
            global[kConfigTimeout] = timeout;
        }
    }
    const context = {};
    if (isRemotePath(envPath) || hasRemotePath(envPath)) {
        return getEnvAsync.call(context, envPath).then(() => context);
    } else {
        getEnv.call(context, envPath);
        return context;
    }
};

module.exports = main;
//# sourceMappingURL=parseenv.js.map
