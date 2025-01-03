// 03.01.25

import parser from '@babel/parser';
import _generator from '@babel/generator';
import _traverse from "@babel/traverse";
import fs from 'fs';
import vm from 'vm';

import * as utils from './Src/util.js';

const generator = _generator.default;
const traverse = _traverse.default;

const POSSIBLE_MATH_OPERATIONS = {
    '+': '_add', 
    '-': '_sub', 
    '%': '_mod'
};
const SCRIPT_MAIN = '2313';
const SCRIPT_APP = 'app';



function findMathFunction(ast) {
    let mathFunction = null;

    traverse(ast, {
        ReturnStatement(path) {
            path.traverse({
                Identifier(innerPath) {
                    if (innerPath.node.name === 'Math') {
                        mathFunction = path;
                        innerPath.stop();
                    }
                }
            });
        }
    });

    if (mathFunction) {
        console.log('[INFO] Math function found');
    }

    return mathFunction;
}


function findMathVariableNames(ast) {
    const mathNames = new Set();

    ast.traverse({
        MemberExpression(path) {
            const name = path.node.object.name;

            if (name !== undefined && name !== 'Math') {
                mathNames.add(name);
                path.node.object.name = `_${name}`;
            }
        }
    });

    if (mathNames.size !== 0) {
        console.log('[INFO] Math variable names found:', mathNames);
    }

    return mathNames;
}


function replaceOperations(ast) {
    ast.traverse({
        BinaryExpression(path) {
            const expressionOperator = path.node.operator;
            const replaceOperator = POSSIBLE_MATH_OPERATIONS[expressionOperator];
            
            console.log(`[DEBUG] Replacing operation: ${expressionOperator} => ${replaceOperator}`);

            if (replaceOperator !== undefined) {
                path.replaceWith({
                    type: 'CallExpression',
                    callee: {
                        type: 'Identifier',
                        name: replaceOperator
                    },
                    arguments: [
                        path.node.left,
                        path.node.right
                    ]
                });
            }
        }
    });
}


function addOperationDefinitions(ast, mathNames) {
    const newLines = [`
        function _add(a, b) {
            log.push(['add', a, b, a + b]);
            return a + b;
        }
        function _sub(a, b) {
            log.push(['sub', a, b, a - b]);
            return a - b;
        }
        function _mod(a, b) {
            log.push(['mod', a, b, a % b]);
            return a % b;
        }

        function createProxy(obj, name) {
            return new Proxy({ obj }, {
                get(proxy, prop) {
                    const { obj } = proxy;
                    const value = obj[prop];
                    if (typeof value === 'function') {
                        const code = value.toString();
        
                        if (code.includes('+')) return _add;
                        else if (code.includes('-')) return _sub;
                        else if (code.includes('%')) return _mod;
                    } 
                    return value;
                }
            });
        }
    `];

    for (const name of mathNames.values()) {
        newLines.push(`const _${name} = createProxy(${name}, '_${name}'); `);
    }
    
    const newAstLines = parser.parse(newLines.join('')).program.body;
    ast.insertBefore(newAstLines);
}


function executeScript(scriptCode) {
    console.log('[DEBUG] Executing script');

    const context = {
        self: { webpackChunkof_vue: [] },
        window: {'navigator.userAgent': 'browser'},
        String, 
        parseInt, 
        decodeURIComponent,
        Date, 
        Math, 
        Proxy, 
        log: [], 
        isNaN
    };

    vm.createContext(context);
    vm.runInContext(scriptCode, context);
    return context;
}


function callMainScript(contextExe, moduleNumber) {
    const mainFunctionToCall = contextExe[0][1][moduleNumber];
    const W = {};
    const n = {};
    let messagePass = null;
    let messageSha1 = null;

    function t(mod) {
        console.log(`[DEBUG] Importing module: ${mod}`);

        if (mod === 89668) {
            return function (e) {
                messagePass = e;
                const { messageSha1: sha1 } = utils.generateChecksum(e);
                messageSha1 = sha1;
                return messageSha1;
            };
        } else if (mod === 858156) {
            return function (n, t, r) {
                console.log("RETURN : ", r )
                return r;
            };
        } else {
            return {};
        }
    }

    t.n = function(obj) { return () => obj; };

    mainFunctionToCall(W, n, t);
    const mainReturnFunction = n.A;
    return { 
        output: mainReturnFunction({url: 'il gatto ci cova'}), 
        messagePass, 
        messageSha1 
    };
}


async function main() {
    utils.createFolderIfNotExist("output");

    const htmlText = await utils.getHtmlText('https://onlyfans.com');
    const scripts = await utils.parseHtmlScript(htmlText, SCRIPT_MAIN, SCRIPT_APP);
    
    if (!scripts.main || !scripts.app) {
        console.error('[ERROR] Failed to retrieve scripts');
        return;
    }

    const { scriptText, scriptName } = scripts.main;
    const revisionDate = scriptName.split("-")[0].split("/").at(-1).replace(/^(\d{4})(\d{2})(\d{2}).*$/, "$1-$2-$3");
    const revisionKey = scriptName.split("/").at(-2);
    utils.writeScript(`output/${SCRIPT_MAIN}.js`, scriptText);

    const appToken = utils.findAppToken(scripts.app.scriptText);
    console.log('[INFO] Found app token:', appToken);

    const modueleNumber = utils.findModuleNumber(scriptText, SCRIPT_MAIN);
    const ast = parser.parse(scriptText);
    const mathFunction = findMathFunction(ast);
    const mathNames = findMathVariableNames(mathFunction);
    
    replaceOperations(mathFunction);
    addOperationDefinitions(mathFunction, mathNames);
    
    const newCode = generator(ast).code;
    utils.writeScript(`output/decrypt.js`, newCode);

    const contextExe = executeScript(newCode);
    const { output: outputSign, messagePass, messageSha1 } = callMainScript(contextExe.self.webpackChunkof_vue, modueleNumber);

    const { checksum: arrNumConstantChecksum, checksum_index: arrSha1Index } = utils.parseOperationLog(contextExe.log);
    const constantChecksum = arrNumConstantChecksum.reduce((acc, val) => acc + val, 0);
    console.log("Output log:", contextExe.log);
    console.log("Output sign:", messagePass);
    console.log("Output msg:", messageSha1);

    const output = {
        rev_date: revisionDate,
        rev_full: revisionKey,
        module_name: SCRIPT_MAIN,
        module_number: modueleNumber,
        app_token: appToken,
        msg: messagePass.split("\n")[0],
        prefix: outputSign.sign.split(":")[0],
        suffix: outputSign.sign.split(":")[3],
        sign_format: `${outputSign.sign.split(":")[0]}:{sha}:{checksum}:${outputSign.sign.split(":")[3]}`,
        sha1_index: arrSha1Index,
        constant_checksum: arrNumConstantChecksum,
        constant_checksum_sum: constantChecksum
    };
    
    console.log(`Save information to: output/data.json`);
    const outputJSON = JSON.stringify(output, (key, value) => {
        if (Array.isArray(value)) {
            return `[${value.join(', ')}]`;
        }
        return value;
    }, 4).replace(/"\[/g, '[').replace(/\]"/g, ']');
    
    fs.writeFileSync(`output/data.json`, outputJSON);
}


main().catch(err => {
    console.error('[FATAL] Unhandled error:', err);
});
