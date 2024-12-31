import hashlib
import httpx
import time
import sys

def cookies_to_string(cookies):
    return '; '.join([f"{key}={value}" for key, value in cookies.items()])

def create_headers(cookies, xbc, user_agent, app_token, static_param, checksum_constant, checksum_indexes, prefix, suffix, path, user_id):
    timestamp = str(int(time.time() * 1000))
    sha = hashlib.sha1(f"{static_param}\n{timestamp}\n{path}\n{user_id}".encode('utf-8')).hexdigest()
    checksum = sum(ord(sha[n]) for n in checksum_indexes) + checksum_constant
    sign = f"{prefix}:{sha}:{checksum:x}:{suffix}"
    cookie_string = cookies_to_string(cookies)
    
    return {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'it-IT,it;q=0.9',
        'app-token': app_token,
        'sign': sign,
        'time': timestamp,
        'user-id': user_id,
        'user-agent': user_agent,
        'x-bc': xbc,
        'cookie': cookie_string
    }

def call_api(cookies, xbc, user_agent, path):
    time.sleep(1)
    rules = httpx.get("https://raw.githubusercontent.com/Lovi-0/Turn-it-off/refs/heads/main/output/data.json", timeout=10).json()

    app_token = rules['app_token']
    static_param = rules['msg']
    checksum_constant = int(rules['constant_checksum_sum'])
    checksum_indexes = [int(x) for x in rules['sha1_index'].split(',')]
    prefix = rules['prefix']
    suffix = rules['suffix']

    user_id = cookies.get('auth_id', '')
    headers = create_headers(cookies, xbc, user_agent, app_token, static_param, checksum_constant, checksum_indexes, prefix, suffix, path, user_id)
    response = httpx.get(f'https://onlyfans.com{path}', headers=headers)

    if response.status_code == 200:
        return response.json()
    
    else:
        print(f'Error: {response.status_code}, response text: {response.text}', file=sys.stderr)
        return None


# Main
cookies = {}
xbc = ''
user_agent = ''
print(call_api(cookies, xbc, user_agent, '/api2/v2/users/me'))
