"use strict";

const { writeFileSync, existsSync, readdirSync } =require("fs");
const { parse, resolve, sep } = require("path");
const platform = require("os").platform();
const { execSync } = require("child_process");

cosole.log("=============> debug");
console.log(process);
console.log(process.env);

const log = console.log;

const MESSAGE_MAP = {
    START_INSTALL_GITHOOKS: () => log("开始部署本地githooks ..."),
    INSTALLED_NONE: () => log("githooks 部署完成，没有githook被部署！"),
    INSTALLED_SUCCESS: count => log(`githooks 部署完成，共有${count}个hook被部署`)
};

const 
    SCRIPTS_DIR = resolve(__dirname, '../githooks'),
    GIT_HOOKS_DIR = resolve(__dirname, "../.git/hooks"),
    IS_THIS_PROJECT = process.env.npm_config_in_parseenv_project === "YES";

// IS_THIS_PROJECT && main();

function main () {
    MESSAGE_MAP.START_INSTALL_GITHOOKS();
    const writedScripts = [];
    const reg = /pre-\w+(?=\.js)/;
    readdirSync(SCRIPTS_DIR)
    .filter(i => reg.test(i))
    .map(i => i.match(reg))
    .forEach(name => {
        let script = resolve(SCRIPTS_DIR, `${name}.js`);
        if (sep === "\\") script = script.replaceAll(sep, "\\\\");
        if (!existsSync(script)) return;
        writedScripts.push(script);
        generateHookFile(script, name);
    });
    if (!writedScripts.length) return MESSAGE_MAP.INSTALLED_NONE();
    platform !== "win32" && execSync(`chmod -R 777 ${GIT_HOOKS_DIR}`);
    MESSAGE_MAP.INSTALLED_SUCCESS(writedScripts.length);
    writedScripts.forEach((path, index) => log(`(${index + 1}) -> ${parse(path).name}`));
}

function generateHookFile (script, name) {
    const reg = /[\n\s]+/ig
    writeFileSync(
        `.git/hooks/${name}`,
        `#!/usr/bin/env node\n` +
        `
        const { spawn } = require("child_process");
        const cp = spawn("node", ["${script}"], { stdio: "inherit" });
        cp.on("exit", code => {
            process.exit(code);
        });
        `.replace(/[\n\s]+/g, ' ')
    );
}