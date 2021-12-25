"use strict";

exports.partial = (f, ...args) => {
    const partialReturnFunction = (...args1) => {
        const params = Array(f.length).fill().reduce((t, ...[, index]) => {
            t[index] = args[index] !== undefined ? args[index] : args1.shift();
            return t;
        }, []);
        return f.call(this, ...params);
    };
    return partialReturnFunction;
};

exports.pipe = (...fns) => {
    const pipeReturnFunction = v => {
        let index = 1;
        let res = fns[0](v);
        while (index < fns.length - 1) {
            res = fns[index].call(null, res);
            index++;
        }
        return fns[fns.length - 1].call(null, res);
    };
    return pipeReturnFunction;
};

exports.left = (condition, left, right) => v => condition(v) ? left(v) : right(v);

exports.tap = f => v => (f(v), v);