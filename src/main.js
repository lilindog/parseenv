import {
    hasRemotePath,
    isRemotePath,
    parseEnv,
    parseEnvAsync,
    parseKV
} from "./lib.js";
import { kConfigIsStrict } from "./constans.js";

const parseAsync = async envPath => {
    const result = await parseEnvAsync(envPath);
    return parseKV(result.join("\n"));
};

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
    if (isRemotePath(envPath)) {
        return parseAsync(envPath);
    }
    if (hasRemotePath(envPath)) {
        return parseAsync(envPath);
    } else {
        const result = parseEnv(envPath);
        return parseKV(result.join("\n"));
    }
};