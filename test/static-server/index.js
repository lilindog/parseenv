"use strict";

/**
 * 配合getEnv模块单元测试的远程服务器，提供远程env文件静态服务
 */

const express = require("express");
const path = require("path");

const app = express();
// 测试重定向路由
app.get("/redirect.env", (req, res) => {
    res.setHeader("Location", "http://localhost/index.env");
    res.setHeader("Content-Type", "text/env");
    res.writeHead(301);
    res.end();
});
app.use(express.static(path.resolve(__dirname, "../envfiles"), {
    setHeaders (res) {
        res.setHeader("Content-Type", "text/env");
    }
}));
app.listen("80", () => {
    console.log("env服务运行于80端口...");
});