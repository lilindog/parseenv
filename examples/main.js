const fs = require("fs");
const input = fs.readFileSync("test.env").toString("utf8");
console.log(input.split("").map((i, index) => `(${index}) -> ${i}`));
// 接下来接着解决if else 语句解析问题

let INDEX = 0;
let STATE = "START"; // identifier、value、equa、
let IN_LIST = false;
let IN_MAP = false;
let IN_USE_VARIABLE = false;
let IN_ENV_INSERT = false;
let IN_USER_VARABLE_MAP = false;
const result = [];
let row = [];
let temp = [];

while (STATE !== "DONE") {
    let char = input[INDEX];
    switch (STATE) {
        /**
         * 左侧语句，注释、key声明
         */
        case "START": {
            temp = [""];
            skipSpaceAndCRLF();
            char = input[INDEX];
            if (char === "#") {
                STATE = "COMMENT";
            } else {
                const howIf = readCharByCount(3).toLowerCase();
                const howElse = readCharByCount(4).toLowerCase();
                const howElseIf = readCharByCount(8).toLowerCase();
                const howEndIf = readCharByCount(6).toLowerCase();
                let skipLen = 0;
                if (howIf === "if ") {
                    INDEX += 3;
                    skipLen = skipSpace();
                    char = input[INDEX];
                    if (char === "=") {
                        STATE = "KEY";
                        INDEX -= (skipLen + 3);
                    } else {
                        STATE = "CONDITION";
                    }
                } else if (howElseIf === "else if ") {
                    INDEX += 8;
                    STATE = "CONDITION";
                } else if (howElse === "else") {
                    INDEX += 4;
                    skipLen = skipSpace();
                    char = input[INDEX];
                    if (char === "=") {
                        STATE = "KEY";
                        INDEX -= (skipLen + 4);
                    } else {
                        // else 处理
                        result.push({ type: "ELSE" });
                        STATE = "END";
                        // 这里也需要处理END
                    }
                } else if (howEndIf === "endif") {
                    INDEX += 6;
                    skipLen = skipSpace();
                    char = input[INDEX];
                    if (char === "=") {
                        INDEX -= (skipLen + 6);
                        STATE = "KEY";
                    } else {
                        // endif 处理
                        result.push({ type: "ENDIF" });
                        STATE = "END";
                    }
                } else if (char === undefined) {
                    STATE = "END";
                } else {
                    STATE = "KEY";
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
            } else if (char === undefined) {
                STATE = "DONE";
            } else {
                STATE = "";
            }
            break;
        }

        /**
         * 注释
         */
        case "COMMENT": {
            temp = [""];
            while (INDEX < input.length) {
                char = input[INDEX];
                if (isCRLF(char)) {
                    break;
                } else {
                    append(char);
                    INDEX++;
                }
            }
            result.push({ type: "COMMENT", value: temp[0] });
            temp = [];
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
                    result.push({ type: "LIST", field: temp[0] });
                    temp = [""];
                    INDEX++;
                    IN_LIST = false;
                    STATE = "EQUA";
                } else {
                    STATE = "";
                }
            } else if (!isLetter(char)) {
                STATE = "";
            } else {
                if (!temp.length) temp = [""];
                append(char);
                INDEX++;
                const s = readIdentifier();
                if (s) append(s);
                char = input[INDEX];
                if (IN_MAP) {
                    if (char === "}") {
                        result.push({ type: "MAP", field: temp[0], property: temp[1] });
                        temp = [""];
                        IN_MAP = false;
                        INDEX++;
                        STATE = "EQUA";
                    } else {
                        STATE = "";
                    }
                } else {
                    if (char === "[") {
                        temp.push("");
                        INDEX++;
                        IN_LIST = true;
                    } else if (char === "{") {
                        temp.push("");
                        INDEX++;
                        IN_MAP = true;
                    } else if (isSpace(char) || char === "=") {
                        result.push({ type: "KEY", field: temp[0] });
                        temp = [""];
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
                result.push({ type: "EQUA" });
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
            temp = [""];
            while (INDEX < input.length) {
                char = input[INDEX];
                if (isSpace(char) || isCRLF(char)) {
                    break;
                } else {
                    append(char);
                    INDEX++;
                }
            }
            if (temp[0]) {
                result.push({ type: "VALUE", value: temp[0] });
                temp = [""];
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
            if (IN_USER_VARABLE_MAP) {
                if (!isLetter(char)) {
                    STATE = "";
                    break;
                }
                const s = readIdentifier();
                if (s) append(s);
                char = input[INDEX];
                // use variable map 结束
                if (char === "}") {
                    INDEX++;
                    IN_USER_VARABLE_MAP = false;
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
                append(char);
                INDEX++;
                const s = readIdentifier();
                if (s) append(s);
                char = input[INDEX];
                // use variable结束
                if (char === "]") {
                    IN_USE_VARIABLE = false;
                    INDEX++;
                    result.push({ type: "CONDITION", value: temp[0] });
                    temp = [""];
                    STATE = "CALC";
                }
                // use variable map 开始
                else if (char === "{") {
                    IN_USER_VARABLE_MAP = true;
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
                if (s) append(s);
                char = input[INDEX];
                if (char === "}") {
                    INDEX++;
                    result.push({ type: "CONDITION", value: temp[0] });
                    temp = [""];
                    STATE = "CALC";
                } else {
                    STATE = "";
                }
            }
            // 字面量
            else {
                temp = [""];
                // 字面量, 允许数字开头
                if (isLetter(char) || isNumber(char)) {
                    append(char);
                    INDEX++;
                    const s = readIdentifier();
                    if (s) append(s);
                    result.push({ type: "CONDITION", value: temp[0] });
                    temp = [""];
                    STATE = "CALC";
                }
                // use variable start
                else if (char === "[") {
                    INDEX++;
                    IN_USE_VARIABLE = true;
                }
                // use envvariable start
                else if (char === "{") {
                    INDEX++;
                    IN_ENV_INSERT = true;
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
                result.push({ type: "CONDITION", value: char });
                INDEX++;
                STATE = "CONDITION";
            } else if (char === "!") {
                const next = readCharByCount(2);
                if (next === "!=") {
                    result.push({ type: "CONDITION", value: next });
                    INDEX += 2;
                    STATE = "CONDITION";
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

console.log(STATE, INDEX);
console.log(result);

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

function append (char = "") {
    temp[temp.length - 1] += char;
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
    console.log(positions, lines);
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
    tips += " ".repeat(lastLinePreLen) + "这里书写有问题\r\n";
    return tips;
}
// 测试getErrorText
// getErrorText(undefined, 17);