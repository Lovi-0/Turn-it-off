const axios = require('axios');
const crypto = require('crypto');

function cookiesToString(cookies) {
    return Object.entries(cookies).map(([key, value]) => `${key}=${value}`).join('; ');
}

function createHeaders(cookies, xbc, userAgent, appToken, staticParam, checksumConstant, checksumIndexes, signFormat, path, userId) {
    const timestamp = Date.now();
    const sha = crypto.createHash('sha1').update(`${staticParam}\n${timestamp}\n${path}\n${userId}`).digest('hex');
    
    const checksum = checksumIndexes.reduce((sum, index) => sum + sha.charCodeAt(index), checksumConstant);
    const sign = signFormat.replace('{sha}', sha).replace('{checksum}', checksum.toString(16));
    
    const cookieString = cookiesToString(cookies);
    
    return {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'it-IT,it;q=0.9',
        'app-token': appToken,
        'sign': sign,
        'time': timestamp,
        'user-id': userId,
        'user-agent': userAgent,
        'x-bc': xbc,
        'cookie': cookieString
    };
}

async function fetchRules(url) {
    try {
        const response = await axios.get(url, { timeout: 10000 });
        return response.data;
    } catch (error) {
        console.error(`An error occurred: ${error.message}`);
        return null;
    }
}

async function callApi(cookies, xbc, userAgent, path) {
    await new Promise(resolve => setTimeout(resolve, 1000));

    const rulesUrl = "https://raw.githubusercontent.com/Lovi-0/Turn-it-off/refs/heads/main/output/rules.json";
    const rules = await fetchRules(rulesUrl);

    if (!rules) {
        console.error("Failed to fetch rules.");
        return null;
    }

    const { app_token: appToken, msg: staticParam, constant_checksum_sum: checksumConstant, sha1_index: checksumIndexes, sign_format: signFormat } = rules;

    const userId = cookies.auth_id || '';
    const headers = createHeaders(cookies, xbc, userAgent, appToken, staticParam, checksumConstant, checksumIndexes, signFormat, path, userId);
    
    try {
        const response = await axios.get(`https://onlyfans.com${path}`, { headers });
        
        if (response.status === 200) {
            return response.data;
        } else {
            console.error(`Error: ${response.status}, response text: ${response.data}`);
            return null;
        }
    } catch (error) {
        console.error(`Request failed: ${error.message}`);
        return null;
    }
}

// Main
const cookies = {};
const xbc = '';
const userAgent = '';

callApi(cookies, xbc, userAgent,'/api2/v2/users/me').then(data => console.log(data)).catch(err => console.error(err));
