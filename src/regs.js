export const ROW_REG = /(?<=(?:\n|^))[\x20]*?(?:\w+|\w+\[\]|\w+\{\s*\w+\s*\})\s*=\s*.+/i;
export const INCLUDE_REG = /(?<=^|\n)[^#\n]*include\s+[^\n]+/ig;
export const ARRKEY_REG = /^\s*(\w+)\[\]\s*$/i;
export const OBJKEY_REG = /^\s*(\w+)\{\s*(\w+)\s*\}\s*/i;
export const ENV_INJECTION = /(?<!\\)\{([^\}]+)\}(?!\\)/ig;