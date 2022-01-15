/**
 * rowType base class
 *
 * @private
 */
class RowBase {
    constructor (options = {}) {
        const Fields = JSON.parse(JSON.stringify(new.target.Fields));
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
        // value: "[object Function]", // value函数，主要处理环境和变量插值，若没有直接返回value
    };

    constructor (props) {
        super(props);
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
    static  Fields = {};
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
        value: "", // 可以换为编译好的函数处理环境变量插值后返回真正的值
    };

    constructor (props) {
        super(props);
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

module.exports = {
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