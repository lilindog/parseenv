const fs = require("fs");
const input = fs.readFileSync("test.env").toString("utf8");
console.log(input.split("").map((i, index) => `(${index}) -> ${i}`));
// 接下来接着解决if else 语句解析问题

const {
    KVStatement,
    IfStatement,
    ElseIfStatement,
    ElseStatement,
    EndifStatement,
    Condition,
    Operator,
    IncludeStatement,
    CommentStatement
} = require("./statementTypes");

let INDEX = 0;
let STATE = "START"; // START\KEY\VALUE\CONDITION\EQUA\COMMENT\END\DONE\CALC
let IN_LIST = false;
let IN_MAP = false;
let IN_USE_VARIABLE = false;
let IN_ENV_INSERT = false;
let IN_USE_VARIABLE_MAP = false;
const result = [];
let statement = null;

while (STATE !== "DONE") {
    let char = input[INDEX];
    switch (STATE) {
        /**
         * 左侧语句，注释、key声明
         */
        case "START": {
            skipSpaceAndCRLF();
            char = input[INDEX];
            if (char === "#") {
                STATE = "COMMENT";
                statement = new CommentStatement;
            } else {
                const howIf = readCharByCount(3).toLowerCase();
                const howElse = readCharByCount(4).toLowerCase();
                const howElseIf = readCharByCount(8).toLowerCase();
                const howEndIf = readCharByCount(5).toLowerCase();
                const howInclude = readCharByCount(7).toLowerCase();
                let skipLen = 0;
                if (howIf === "if ") {
                    INDEX += 3;
                    skipLen = skipSpace();
                    char = input[INDEX];
                    if (char === "=") {
                        STATE = "KEY";
                        INDEX -= (skipLen + 3);
                        statement = new KVStatement;
                    } else {
                        statement = new IfStatement;
                        STATE = "CONDITION";
                    }
                } else if (howElseIf === "else if ") {
                    INDEX += 8;
                    STATE = "CONDITION";
                    statement = new ElseIfStatement;
                } else if (howElse === "else") {
                    INDEX += 4;
                    skipLen = skipSpace();
                    char = input[INDEX];
                    if (char === "=") {
                        STATE = "KEY";
                        INDEX -= (skipLen + 4);
                        statement = new KVStatement;
                    } else {
                        statement = new ElseStatement;
                        STATE = "END";
                    }
                } else if (howEndIf === "endif") {
                    INDEX += 5;
                    skipLen = skipSpace();
                    char = input[INDEX];
                    if (char === "=") {
                        INDEX -= (skipLen + 5);
                        STATE = "KEY";
                        statement = new KVStatement;
                    } else {
                        statement = new EndifStatement;
                        STATE = "END";
                    }
                } else if (howInclude === "include") {
                    skipLen = skipSpace();
                    char = input[INDEX];
                    if (char === "=") {
                        INDEX -= skipLen;
                        STATE = "KEY";
                        statement = new KVStatement;
                    } else {
                        INDEX += 7;
                        STATE = "VALUE";
                        statement = new IncludeStatement;
                    }
                } else if (char === undefined) {
                    STATE = "END";
                } else {
                    STATE = "KEY";
                    statement = new KVStatement;
                }
            }
            break;
        }

        /**
         * 一行语句结束
         */
        case "END": {
            skipSpace();
            char = input[INDEX];
            if (isCRLF(char)) {
                // 此处可以用于处理一行语句的结果生成，这里暂时跳过
                skipSpaceAndCRLF();
                STATE = "START";
                append();
            } else if (char === undefined) {
                STATE = "DONE";
                append();
            } else {
                STATE = "";
            }
            break;
        }

        /**
         * 注释
         */
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

        /**
         * key部分声明
         * 处理list,map声明部分
         */
        case "KEY": {
            if (IN_LIST) {
                if (char === "]") {
                    INDEX++;
                    IN_LIST = false;
                    STATE = "EQUA";
                } else {
                    STATE = "";
                }
            } else if (!isLetter(char)) {
                STATE = "";
            } else {
                const s = readIdentifier();
                if (s) {
                    if (statement.type === KVStatement.Types.MAP) {
                        statement.property = s;
                    } else {
                        statement.field = s;
                    }
                }
                char = input[INDEX];
                if (IN_MAP) {
                    if (char === "}") {
                        IN_MAP = false;
                        INDEX++;
                        STATE = "EQUA";
                    } else {
                        STATE = "";
                    }
                } else {
                    if (char === "[") {
                        statement.type = KVStatement.Types.LIST;
                        INDEX++;
                        IN_LIST = true;
                    } else if (char === "{") {
                        statement.type = KVStatement.Types.MAP;
                        INDEX++;
                        IN_MAP = true;
                    } else if (isSpace(char) || char === "=") {
                        statement.type = KVStatement.Types.KEY;
                        STATE = "EQUA";
                    } else {
                        STATE = "";
                    }
                }
            }
            break;
        }

        /**
         * 等中间等号
         */
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

        /**
         * 右侧value部分解析
         * 需要注意环境变量插值
         */
        case "VALUE": {
            skipSpace();
            let s = "";
            while (INDEX < input.length) {
                char = input[INDEX];
                if (isSpace(char) || isCRLF(char)) {
                    break;
                } else {
                    s += char;
                    INDEX++;
                }
            }
            if (s) {
                statement.value = s;
                STATE = "END";
            } else {
                STATE = "";
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
                    debugger;
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
                    new Operator({ type: Operator.Types.EQUAL })
                );
            } else if (char === "!") {
                const next = readCharByCount(2);
                if (next === "!=") {
                    INDEX += 2;
                    STATE = "CONDITION";
                    statement.conditions.push(
                        new Operator({ type: Operator.Types.NO_EQUAL })
                    );
                } else {
                    STATE = "";
                }
            } else if (char === undefined || isCRLF(char) || isSpace(char)) {
                // 单个condition，去往行结束
                STATE = "END";
            } else {
                STATE = "";
            }
            break;
        }

        default: {
            console.log("报错>>");
            throw getErrorText(undefined, INDEX);
        }
    }
}


// debug start =================================
console.log(STATE, INDEX);
console.log(result);
// const conditionStatements = result.filter(i => i instanceof IfStatement || i instanceof ElseIfStatement);
// conditionStatements.forEach(i => {
//     console.log(i.convert2function().toString());
// });

// debug end   =================================

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
    console.log(position);
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
    tips += " ".repeat(lastLinePreLen) + "这里语法有问题\r\n";
    tips += " ".repeat(lastLinePreLen) + "语法规则参考：https://github.com/lilindog/parseenv\r\n";
    return tips;
}
// 测试getErrorText
// getErrorText(undefined, 17);
