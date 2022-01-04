import { getEnvAsync, getEnv } from "./getEnv.js";
import getFragments from "./parseIFStatements.js";
import { STATEMENT } from "./regs.js";
import { parseKV2Context, hasRemotePath, isRemotePath } from "./helper.js";
import { kConfigIsStrict } from "./constans.js";

function main (context = {}, envNode = {}) {
    const fragments = getFragments(envNode);
    for (let fragment of fragments) {
        let fragmentContent = "";
        if (typeof fragment === "function") {
            fragmentContent = fragment.call(context) || "";
        } else {
            fragmentContent = fragment;
        }
        let rows = fragmentContent.match(STATEMENT) || [];
        for (let row of rows) {
            // include statement
            if (row.toLocaleLowerCase().startsWith("include")) {
                row = row.replace(/ +/g, " ");
                const [, path] = row.split(" ");
                const node = envNode.includes.find(node => {
                    return node.name === path;
                });
                if (node) main(context, node);
            }
            // KV statement
            else {
                parseKV2Context(context, row);
            }
        }
    }
}

/**
 * 入口
 *
 * @param {String} envPath 本地env文件路径或者远程env文件链接
 * @param {Object} [options] 配置对象，可选
 * @param {Boolean} [options.isStrict] 是否是严格模式，严格模式下env文件找不到会抛错
 * @return {(Object|Promise<Object>)}
 */
export default (envPath, options) => {
    if (options && {}.toString.call(options) === "[object Object]") {
        const { isStrict } = options;
        global[kConfigIsStrict] = isStrict;
    }
    const context = {};
    if (isRemotePath(envPath)) {
        return getEnvAsync(envPath)
            .then(node => {
                main(context, node);
                return context;
            });
    }
    if (hasRemotePath(envPath)) {
        return getEnvAsync(envPath)
            .then(node => {
                main(context, node);
                return context;
            });
    } else {
        const node = getEnv(envPath);
        main(context, node);
        return context;
    }
};