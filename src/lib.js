"use strict";

const {
    ENV_INJECTION
} = require("./regs");

exports.log = function (msg = "") {
    process.stdout.write(`[Parseenv] ${msg}\n`);
};

/**
 * 处理value中的环境变量和其转义符 
 * 
 * @param  {String} value
 * @return {String}
 */
exports.handleEnvironmentVariable = function (value = "") {
    const envInjectTags = value.match(ENV_INJECTION);
    let field, property;
    if (!envInjectTags) return value;
    [...new Set(envInjectTags)].forEach(tag => {
        field = tag.replace(/[\{\}]/g, "");
        property = process.env[field];
        if (property === undefined) exports.log(`环境变量 "${field}" 不存在！`);
        value = value.replace(new RegExp(tag, "g"), property);
    });
    return value;
};