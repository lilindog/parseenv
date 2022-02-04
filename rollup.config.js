"use strict";

const env = process.env;
const version = env.npm_package_version;
const author = env.npm_package_author_name + "<" + env.npm_package_author_email + ">";
const license = env.npm_package_license;
const banner = `+
/**+
 * Parseenv v${version}+
 * Author ${author}+
 * Last-Modify ${new Date().toLocaleDateString()}+
 * License ${license}+
 */+
`;

export default {
    input: "src/main.js",
    external: [
        "url",
        "path",
        "http",
        "https",
        "fs"
    ],
    output: [
        {
            exports: "default",
            file: "dist/parseenv.js",
            format: "cjs",
            banner: banner.replace(/\n+/g, "").replace(/\+/g, "\n"),
            sourcemap: true
        },
        {
            exports: "default",
            file: "dist/parseenv.mjs",
            format: "esm",
            banner: banner.replace(/\n+/g, "").replace(/\+/g, "\n"),
            sourcemap: true
        },
    ]
}