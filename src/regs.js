// 语句开始
const start = `(?<=(?:^|\\n) *)`;
// 语句结束
const end = `(?= *(?:\\r\\n|\\n|$))`;
// key声明
const identifier = `[a-z]\\w*`;
// 值,不能是空格，换行、中括号、大括号
const value = `[^\\r\\n\\ ]+`;
// list声明
const list = `${identifier}\\[\\]`;
// map语法检测
const map = `${identifier}\\{${identifier}\\}`;
// if语句的等于与不等于
const equa = `(?:=|!=)`;
// if语句使用变量
const usevariable = `\\[(?:${identifier}|${map})\\]`;
// 环境变量插值
const envinsert = `\\{${identifier}\\}`;
// if条件单元
const ifcondition = `(?:${usevariable}|${envinsert}|[^\\[\\]\\{\\}\\r\\n ]+)`;
// if和else if语句
const ifelseif = `${start}(?:if|else *if) *?${ifcondition}(?: *${equa} *${ifcondition})?${end}`;
// if 条件语句包括（if else if else endif）
const if_elseif_else_endif = `(?:${ifelseif}|${start}else${end}|${start}endif${end})`;
const KVStatement = `${start}(?:${identifier}|${map}|${list}) *= *${value}${end}`;
const includeStatement = `${start}include *${value}${end}`;

export const IF_STATEMENT = new RegExp(if_elseif_else_endif, "ig");
export const ONE_IF_CONDITION = new RegExp(`^(?:if|else *if) +?(${ifcondition})$`, "ig");
export const TWO_IF_CONDITION = new RegExp(`^(?:if|else *if) +?(${ifcondition}) *(${equa}) *(${ifcondition})$`, "ig");
export const STATEMENT = new RegExp(`(?:${KVStatement}|${includeStatement})`, "ig");
export const INCLUDE_REG = new RegExp(includeStatement, "ig");
export const KV_STATEMENT = new RegExp(KVStatement, "ig");
export const ENV_INJECTION = /(?<!\\)\{([^\}]+)\}(?!\\)/ig;                                   