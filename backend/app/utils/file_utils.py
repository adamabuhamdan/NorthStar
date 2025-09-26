import aiofiles
import httpx
import io
import base64
import os
from typing import Optional
from app.config import settings

async def download_file(url: str, timeout: int = 30) -> bytes:
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.content

def validate_file_size(content: bytes) -> bool:
    return len(content) <= settings.MAX_FILE_SIZE

def get_file_type(content: bytes) -> str:
    if content.startswith(b'\xFF\xD8\xFF'):
        return 'image/jpeg'
    elif content.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'image/png'
    elif content.startswith(b'GIF8'):
        return 'image/gif'
    elif content.startswith(b'RIFF') and content[8:12] == b'WEBP':
        return 'image/webp'
    else:
        return 'application/octet-stream'