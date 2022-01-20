import { getEnv, getEnvAsync } from "./getEnv.js";
import {hasRemotePath, isRemotePath} from "./helper.js";
import { kConfigIsStrict, kConfigTimeout } from "./constans.js";

/**
 * 入口
 *
 * @param {String} envPath 本地env文件路径或者远程env文件链接
 * @param {Object} [options] 配置对象，可选
 * @param {Boolean} [options.isStrict] 是否是严格模式，严格模式下env文件找不到会抛错
 * @param {Number} [options.timeout] 加载远程env文件的超时时间，单位为ms， 缺省为1秒
 * @return {(Object|Promise<Object>)}
 */
export default (envPath, options) => {
    if (options && {}.toString.call(options) === "[object Object]") {
        const { isStrict, timeout } = options;
        if (isStrict !== undefined && typeof isStrict === "boolean") {
            global[kConfigIsStrict] = isStrict;
        }
        if (timeout && (typeof timeout === "number") && timeout > 0) {
            global[kConfigTimeout] = timeout;
        }
    }
    const context = {};
    if (isRemotePath(envPath) || hasRemotePath(envPath)) {
        return getEnvAsync.call(context, envPath).then(() => context);
    } else {
        getEnv.call(context, envPath);
        return context;
    }
};