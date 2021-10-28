"use strict";

/**
 * 解析所用正则集合 
 */
module.exports = {
    ROW_REG:       /^[^#]\s*(?:\w+|\w+\[\]|\w+\{\s*\w+\s*\})\s*=\s*.+?(?:\n|)$/i,
    INCLUDE_REG:   /(?<=^|\n)[^#\n]*include\s+[^\n]+/ig,
    ARRKEY_REG:    /^\s*(\w+)\[\]\s*$/i,
    OBJKEY_REG:    /^\s*(\w+)\{\s*(\w+)\s*\}\s*/i,
    ENV_INJECTION: /(?<!\\)\{([^\}]+)\}(?!\\)/ig
};