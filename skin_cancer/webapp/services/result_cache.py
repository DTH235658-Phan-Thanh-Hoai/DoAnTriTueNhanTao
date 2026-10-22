"""Task 8: Cache kết quả theo hash ảnh, lưu trong Redis (có fallback RAM).

Dùng Redis (thay cho dict trong RAM) vì Flask và worker Celery là 2 tiến trình riêng,
cần chung một nơi lưu cache. Nếu chưa có Redis, tự động fallback sang RAM.
"""

import hashlib
import json
import os

try:
    import redis
except ImportError:
    redis = None

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
CACHE_TTL = 7 * 24 * 3600  # giữ 7 ngày
CACHE_VERSION = "v1"  # đổi khi sửa cấu trúc kết quả để bỏ cache cũ

_client = None
_mem_cache = {}


def _get_client():
    global _client
    if redis is None:
        return None
    if _client is None:
        try:
            _client = redis.Redis.from_url(
                REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=1,  # Redis chết thì bỏ qua nhanh, không treo
                socket_timeout=1,
            )
        except Exception:
            return None
    return _client


def image_hash(pil_img):
    """Hash theo nội dung pixel + loại model đang dùng (torch / onnx / onnx_int8)."""
    backend = os.environ.get("MODEL_BACKEND", "torch")
    rgb = pil_img.convert("RGB")
    h = hashlib.sha256()
    h.update(f"{CACHE_VERSION}|{backend}|{rgb.size}".encode())
    h.update(rgb.tobytes())
    return f"analysis-cache:{h.hexdigest()}"


def get_cached(key):
    client = _get_client()
    if client is not None:
        try:
            raw = client.get(key)
            if raw:
                return json.loads(raw)
        except Exception:
            pass
    return _mem_cache.get(key)


def save_cached(key, value):
    client = _get_client()
    saved = False
    if client is not None:
        try:
            client.setex(key, CACHE_TTL, json.dumps(value))
            saved = True
        except Exception:
            saved = False
    if not saved:
        if len(_mem_cache) >= 100:
            _mem_cache.pop(next(iter(_mem_cache)))
        _mem_cache[key] = value
