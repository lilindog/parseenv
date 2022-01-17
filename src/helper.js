import { kConfigIsStrict } from "./constans.js";
import path from "path";
import fs from "fs";
import { parse } from "./parse.js";
import { IncludeStatement } from "./statementTypes.js";

export const log = (msg, isErr) => {
    const prefix = "[Parseenv]";
    /* eslint-disable no-console */
    if (global[kConfigIsStrict] || isErr) {
        console.log("\x1b[41m", "\x1b[37m", prefix, "\x1b[40m", "\x1b[31m", msg, "\x1b[0m");
        process.exit(1);
    } else {
        console.log("\x1b[45m", "\x1b[37m", prefix, "\x1b[40m", "\x1b[33m", msg, "\x1b[0m");
    }
    /* eslint-disable no-console */
};

export const isRemotePath = path => path.startsWith("http");

/**
 * 检测本地env文件中是否包含远程include路径（包含嵌套env中的include）
 *
 * @param {String} envPath 主env文件路径
 * @return {Boolean}
 * @public
 */
export const hasRemotePath = envPath => {
    if (!path.isAbsolute(envPath)) {
        envPath = path.resolve(envPath);
    }
    if (!fs.existsSync(envPath)) {
        return false;
    }
    let statements = [];
    try {
        statements = parse(fs.readFileSync(envPath).toString("utf8")).filter(i => i instanceof IncludeStatement);
    } catch (err) {
        log(envPath + "\r\n" + err, true);
    }
    for (let include of statements) {
        if (isRemotePath(include.value)) return true;
        const envPathDir = path.dirname(envPath);
        if (hasRemotePath(path.resolve(envPathDir, include.getValue()))) return true;
    }
    return false;
};