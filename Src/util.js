import { parse as parseHTML } from 'node-html-parser';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import randomUserAgent from 'random-useragent';
import js_beautify from 'js-beautify';

import parser from '@babel/parser';
import _traverse from "@babel/traverse";

const traverse = _traverse.default;
const MAX_RETRIES = 5;
const RETRY_DELAY = 2000;



function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


export function getRandomUserAgent() {
    const browsers = ['Firefox', 'Chrome', 'Safari'];
    return randomUserAgent.getRandom(browsers, { exclude: 'bot' });
}


export function writeScript(filePath, fileContent) {
    const beautifiedCode = js_beautify(fileContent, {
        indent_size: 2,
        space_in_empty_paren: true,
        max_preserve_newlines: 2
    });

    try {
        fs.writeFileSync(filePath, beautifiedCode, 'utf8');
    } catch (err) {
        console.error(`[ERROR] Failed to write file: ${filePath}`, err);
    }
}


export function createFolderIfNotExist(folderPath) {
    const resolvedPath = path.resolve(folderPath);

    if (!fs.existsSync(resolvedPath))
        fs.mkdirSync(resolvedPath, { recursive: true });
}


export async function getHtmlText(url) {
    let attempts = 0;
    
    while (attempts < MAX_RETRIES) {
        attempts++;

        try {
            console.log(`[DEBUG] Attempt ${attempts} of ${MAX_RETRIES} for URL: ${url}`);
            
            const headers = {
                'User-Agent': getRandomUserAgent(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
                'sec-ch-ua': '"Chromium";v="130", "Opera";v="115", "Not?A_Brand";v="99"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'document',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-site': 'same-origin',
                'sec-fetch-user': '?1',
                'upgrade-insecure-requests': '1',
                'Referer': new URL(url).origin,
                'Origin': new URL(url).origin
            };

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const req = await fetch(url, {
                method: 'GET',
                signal: controller.signal,
                headers: headers,
                redirect: 'follow',
                mode: 'cors'
            });

            clearTimeout(timeoutId);

            if (req.ok) {
                return await req.text();
            } else if (req.status === 403) {
                console.error(`[ERROR] 403 Forbidden for ${url}`);

                if (attempts < MAX_RETRIES) {
                    console.log(`[DEBUG] Retrying in ${RETRY_DELAY / 1000} seconds...`);
                    await sleep(RETRY_DELAY);
                }
            } else {
                console.error(`[ERROR] Request failed for ${url}. Status: ${req.status}`);
                console.error(`Response headers: ${JSON.stringify(Object.fromEntries(req.headers))}`);
                return null;
            }

        } catch (error) {
            if (error.name === 'AbortError') {
                console.error(`[ERROR] Timeout for ${url}`);
            } else {
                console.error(`[ERROR] Network error during request to ${url}`, error);
            }

            if (attempts < MAX_RETRIES) {
                console.log(`[DEBUG] Retrying in ${RETRY_DELAY / 1000} seconds...`);
                await sleep(RETRY_DELAY);
            }
        }
    }

    console.error(`[ERROR] Maximum retry attempts exceeded for ${url}`);
    return null;
}


export async function parseHtmlScript(html, id1, id2) {
    const scripts = parseHTML(html).querySelector('head').querySelectorAll('script');
    const results = { main: null, app: null };
    
    for (let script of scripts) {
        const scriptSrc = script.rawAttributes.src;
        
        if (scriptSrc !== undefined) {
            if (scriptSrc.includes(id1)) {
                console.log(`[INFO] Found main script: ${scriptSrc}`);
                const scriptText = await getHtmlText(scriptSrc);
                results.main = { scriptText, scriptName: scriptSrc };
            }

            if (scriptSrc.includes(id2)) {
                console.log(`[INFO] Found app script: ${scriptSrc}`);
                const scriptText = await getHtmlText(scriptSrc);
                results.app = { scriptText, scriptName: scriptSrc };
            }
        }
    }
    
    return results;
}


export function generateChecksum(message) {
    const hash = crypto.createHash('sha1');
    hash.update(message);

    return {
        messageSha1: hash.digest('hex'),
        messageString: message.split("\n")[0]
    };
}


export function calculateChecksum(sha1Message, listConstantChecksum, listSha1Index) {
    let checksum = 0;

    for (let i = 0; i < listConstantChecksum.length; i++)
        checksum += (sha1Message.charCodeAt(listSha1Index[i]) + listConstantChecksum[i]);
    
    return checksum.toString(16);
}


export function parseOperationLog(log) {
    let checksum = [];
    let checkIndex = [];

    for (let i = 0; i < log.length; i++) {
        const operation = {
            'math_op': log[i][0], 
            'var_a': log[i][1], 
            'var_b': log[i][2], 
            'math_res': log[i][3]
        };

        if (operation.math_op === 'mod') {
            console.log(`[DEBUG] Analyzing row:`, operation);
            checkIndex.push(operation.math_res);

            const nextOperation = {
                'math_op': log[i+1][0], 
                'var_a': log[i+1][1], 
                'var_b': log[i+1][2], 
                'math_res': log[i][3]
            };

            if (nextOperation.math_op === 'add')
                checksum.push(+nextOperation.var_b);

            if (nextOperation.math_op === 'sub')
                checksum.push(-nextOperation.var_b);
        }
    }

    return { 
        'checksum': checksum, 
        'checksum_index': checkIndex 
    };
}


export function findAppToken(scriptText) {
    const ast = parser.parse(scriptText);
    let appToken = null;

    traverse(ast, {
        StringLiteral(path) {
            if (path.node.value === '/api2/v2') {

                let parent = path.parentPath;
                while (parent) {
                    parent.traverse({
                        StringLiteral(innerPath) {
                            if (innerPath.node.value.length === 32 && 
                                /^[a-f0-9]{32}$/.test(innerPath.node.value)) {
                                appToken = innerPath.node.value;
                                return;
                            }
                        }
                    });

                    if (appToken) 
                        break;
                    
                    parent = parent.parentPath;
                }
            }
        }
    });

    return appToken;
}
