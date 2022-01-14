/**
 * rowType base class
 *
 * @private
 */
class RowBase {
    constructor (options = {}) {
        const Fields = JSON.parse(new.target.Fields);
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
        type: KVStatement.DEFAULT,
        field: "",
        property: "" // Type == MAP 才有
    };

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

    /**
     * 将条件转换为函数
     */
    convert2function () {

    }
}

/**
 * else if statement
 *
 * @public
 */
class ElseIfStatement extends IfStatement {
    constructor (props) {
        super(props);
    }
}