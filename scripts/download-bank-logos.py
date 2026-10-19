"""Download and validate the supplied institution logos (standard library only)."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import struct
import time
import urllib.request
import urllib.parse

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'assets/banks/organizze'
institutions = json.loads((DEST / 'institutions.json').read_text())


def image_info(data):
    if data[:8] == b'\x89PNG\r\n\x1a\n' and data[12:16] == b'IHDR':
        return '.png', *struct.unpack('>II', data[16:24])
    if data[:2] == b'\xff\xd8':
        offset = 2
        while offset < len(data):
            if data[offset] != 0xff:
                raise ValueError('Invalid JPEG marker')
            while data[offset] == 0xff:
                offset += 1
            marker = data[offset]
            offset += 1
            length = struct.unpack('>H', data[offset:offset + 2])[0]
            if marker in (0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf):
                height, width = struct.unpack('>HH', data[offset + 3:offset + 7])
                return '.jpg', width, height
            offset += length
    raise ValueError('Response is not a supported PNG/JPEG image')


def download(item):
    identifier, url = item['id'], item['logo_url']
    if not url:
        return None
    if not url.startswith('https://assets.organizze.com.br/institutions/logos/'):
        raise ValueError('Unexpected logo host/path')
    if '/' in identifier or '\\' in identifier or identifier in ('.', '..'):
        raise ValueError('Invalid identifier')
    path = next((DEST / (identifier + ext) for ext in ('.png', '.jpg')
                 if (DEST / (identifier + ext)).exists()), DEST / (identifier + '.png'))
    for attempt in range(3):
        try:
            if path.exists():
                data = path.read_bytes()
            else:
                request = urllib.request.Request(urllib.parse.quote(url, safe=':/%'), headers={'User-Agent': 'Meus-Gastos-logo-import/1.0'})
                with urllib.request.urlopen(request, timeout=30) as response:
                    data = response.read()
            extension, width, height = image_info(data)
            path = DEST / (identifier + extension)
            if not width or not height:
                raise ValueError('Empty image')
            path.write_bytes(data)
            return {'id': identifier, 'name': item['name'], 'url': url,
                    'file': path.name, 'width': width, 'height': height,
                    'sha256': hashlib.sha256(data).hexdigest()}
        except Exception as error:
            if attempt == 2:
                return {'id': identifier, 'url': url, 'error': str(error)}
            time.sleep(attempt + 1)


if __name__ == '__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        results = [r for r in pool.map(download, institutions) if r]
    (DEST / 'sources.json').write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n')
    errors = [r for r in results if 'error' in r]
    print(f'Downloaded: {len(results) - len(errors)}; errors: {len(errors)}', flush=True)
    for error in errors:
        print(error, flush=True)
    raise SystemExit(bool(errors))
