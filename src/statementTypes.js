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

/**
 * export modules
 */
export {
    KVStatement,
    IfStatement,
    ElseIfStatement,
    ElseStatement,
    EndifStatement,
    Condition,
    Operator,
    IncludeStatement,
    CommentStatement
};