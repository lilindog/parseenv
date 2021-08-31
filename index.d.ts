declare module "parseenv" {
    export default function (str: String): parseenvReslut;
    export interface parseenvReslut {
        [key: String]: String|Number|Array<String|Number>
    }
}