"use strict"

const fs = require("fs");

/**
 * 解析自定义.env配置文件为json
 * 
 * @param {String} path 后缀名为.env的配置文件路径
 * @return {Object}
 */
module.exports = function (envPath) {
    if (!fs.existsSync(envPath)) {
        throw `${envPath} 不存在！`;
    }
    let 
    data = {},
    str = fs.readFileSync(envPath).toString();
    str = str.replace(/\r{2}/g, "\r");
    str = str.replace(/\n/g, "");
    str = str.split("\r");
    str = str.filter(item => !~item.indexOf("#") && item !== "" && ~item.indexOf("="));
    str = str.map(item => item.replace(/\s/g, ""));
    // console.log(str);
    str = str.map(item => {
        data[item.split("=")[0]] = item.split("=")[1];
    });
    // console.log(data);
    return data;
}