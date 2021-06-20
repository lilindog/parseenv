"use strict";

const chai = require("chai");
const parseenv = require("../src/main");
const path = require("path");

const 
    title = "我是基本配置文件",
    title2 = "我是main配置文件",
    hub = [11111, 22222, 33333],
    map = {
        a: 100,
        b: 200
    };

describe("开始测试！", () => {
    it("解析base.env", () => {
        const env = parseenv(path.resolve(__dirname, "./base.env"));
        chai.assert.isObject(env);
        chai.assert.strictEqual(env.TITLE, title);
    });
    it("解析main.env", () => {
        const env = parseenv(path.resolve(__dirname, "./main.env"));
        chai.assert.isObject(env);
        chai.assert.strictEqual(env.TITLE2, title2);
        chai.assert.isArray(env.HUB);
        env.HUB.forEach((item, index) => {
            chai.assert.strictEqual(item, hub[index]);
        });
        chai.assert.isObject(env.MAP);
        Reflect.ownKeys(env.MAP).forEach(k => {
            chai.assert.strictEqual(env.MAP[k], map[k]);
        });
    });
});