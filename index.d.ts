declare module "parseenv" {
    type Options = {
        // 严格模式，缺省为false
        // 严格模式下，警告会按错误来处理
        isStrict?: Boolean,
        // include远程env时的超时时间（单位ms），缺省为1000ms
        timeout?: Number
    };
    export default function (envPath: String, options?: Options): Promise<object>|object;
}