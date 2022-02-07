import {
    KVStatement,
    IfStatement,
    ElseIfStatement,
    ElseStatement,
    EndifStatement,
    Condition,
    Operator,
    IncludeStatement,
    CommentStatement
} from "./statementTypes.js";

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

/**
 * export modules
 */
export {
    parse
};