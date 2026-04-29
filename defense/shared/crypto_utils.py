import os
from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes


def aes_encrypt(data: bytes) -> bytes:
    key = get_random_bytes(32)
    cipher = AES.new(key, AES.MODE_GCM)
    ciphertext, tag = cipher.encrypt_and_digest(data)
    return cipher.nonce + tag + ciphertext


def aes_encrypt_partial(data: bytes, ratio: float = 0.25) -> bytes:
    split = int(len(data) * ratio)
    encrypted_part = aes_encrypt(data[:split])
    return encrypted_part + data[split:]


def aes_encrypt_with_padding(data: bytes, pad_min: int = 10000, pad_max: int = 20000) -> bytes:
    encrypted = aes_encrypt(data)
    pad_len = int.from_bytes(os.urandom(2), 'big') % (pad_max - pad_min) + pad_min
    return encrypted + b'\x00' * pad_len


def aes_encrypt_with_encoding(data: bytes, encoding: str = 'base64') -> bytes:
    import base64
    encrypted = aes_encrypt(data)
    if encoding == 'base64':
        return base64.b64encode(encrypted)
    elif encoding == 'base32':
        return base64.b32encode(encrypted)
    elif encoding == 'hex':
        return encrypted.hex().encode()
    return encrypted


def aes_encrypt_custom_evasion(data: bytes, target_entropy: float, target_size: int) -> bytes:
    encrypted = aes_encrypt_partial(data, ratio=0.25)
    current_size = len(encrypted)
    if current_size < target_size:
        pad_len = target_size - current_size
        low_entropy_pad = bytes([0x00, 0x01, 0x02, 0x03] * (pad_len // 4 + 1))[:pad_len]
        encrypted = encrypted + low_entropy_pad
    elif current_size > target_size:
        encrypted = encrypted[:target_size]
    return encrypted
