declare module "parseenv" {

    // envPath 为.env文件的路径
    // 可以是绝对路径，也可以是基于当前进程cwd的相对路径
    export default function (envPath: String): parseenvResult;

    export interface parseenvResult {
        [key: String]: String|Number|Array<String|Number>
    }
}
