#!/usr/bin/env python3
"""Study Bank Engine v6.4 loader.

Recompõe o fonte completo a partir dos payloads Base85/LZMA,
confere SHA-256 e executa o motor.
"""
from pathlib import Path
import base64, lzma, hashlib

HERE = Path(__file__).resolve().parent
PARTS = 4
EXPECTED_SHA256 = "4e938c47c2eb680a0e0ca24b78cab425a37c583c28c03bc5a88b3f6f6035b8d5"

encoded = "".join(
    (HERE / "payload" / f"part-{i:02d}.b85").read_text(encoding="ascii").strip()
    for i in range(PARTS)
)
source = lzma.decompress(base64.b85decode(encoded.encode("ascii")))
actual = hashlib.sha256(source).hexdigest()
if actual != EXPECTED_SHA256:
    raise RuntimeError(f"Integridade inválida: {actual} != {EXPECTED_SHA256}")

exec(compile(source, str(HERE / "study-bank-engine-v6.4.source.py"), "exec"))
