import json
import os
import re
import urllib.error
import urllib.request
from typing import Literal

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

MODEL_SPEC = os.getenv("CAPITRITUS_MODEL_SPEC", "Qwen/Qwen3-0.6B-GGUF:Q8_0")
LLAMA_URL = os.getenv("CAPITRITUS_LLAMA_URL", "http://127.0.0.1:8081").rstrip("/")
API_TOKEN = os.getenv("CAPITRITUS_API_TOKEN", "").strip()
MAX_TOKENS = int(os.getenv("CAPITRITUS_MAX_TOKENS", "220"))

app = FastAPI(title="Capitritus AI", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


class SolveRequest(BaseModel):
    kind: Literal["multiple_choice", "true_false", "fill_blank", "open_response"]
    question: str = Field(min_length=1, max_length=12000)
    options: list[str] = Field(default_factory=list, max_length=40)
    subject: str | None = Field(default=None, max_length=120)
    context: str | None = Field(default=None, max_length=6000)


class SolveResponse(BaseModel):
    kind: str
    answer_index: int | None = None
    answer: str | None = None
    confidence: float = 0.0
    explanation: str | None = None
    hints: list[str] = Field(default_factory=list)
    model: str


def _auth(authorization: str | None):
    if not API_TOKEN:
        return
    if authorization != f"Bearer {API_TOKEN}":
        raise HTTPException(status_code=401, detail="invalid token")


def _extract_json(text: str) -> dict:
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S | re.I).strip()
    try:
        return json.loads(text)
    except Exception:
        pass
    match = re.search(r"\{.*\}", text, flags=re.S)
    if not match:
        return {}
    try:
        return json.loads(match.group(0))
    except Exception:
        return {}


def _prompt(req: SolveRequest) -> list[dict]:
    system = (
        "/no_think\n"
        "Você é um tutor escolar conciso. Analise a questão com cuidado. "
        "Para multiple_choice, true_false e fill_blank, indique a opção/termo mais defensável e explique em uma frase. "
        "Para open_response, não escreva uma resposta final pronta para entregar; forneça somente 2 a 4 pistas conceituais. "
        "Retorne SOMENTE JSON válido, sem markdown."
    )
    payload = {
        "kind": req.kind,
        "subject": req.subject,
        "context": req.context,
        "question": req.question,
        "options": req.options,
        "output": {
            "answer_index": "inteiro começando em 0, ou null",
            "confidence": "número de 0 a 1",
            "explanation": "uma frase curta",
            "hints": ["somente para open_response"],
        },
    }
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
    ]


def _llama_chat(messages: list[dict]) -> str:
    payload = json.dumps(
        {
            "model": "capitritus",
            "messages": messages,
            "temperature": 0.2,
            "top_p": 0.8,
            "max_tokens": MAX_TOKENS,
            "stream": False,
        },
        ensure_ascii=False,
    ).encode("utf-8")
    request = urllib.request.Request(
        f"{LLAMA_URL}/v1/chat/completions",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:1000]
        raise HTTPException(status_code=502, detail=f"llama.cpp HTTP {exc.code}: {detail}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"llama.cpp unavailable: {exc}") from exc

    try:
        return str(data["choices"][0]["message"]["content"])
    except Exception as exc:
        raise HTTPException(status_code=502, detail="invalid llama.cpp response") from exc


def _llama_health() -> bool:
    try:
        with urllib.request.urlopen(f"{LLAMA_URL}/health", timeout=2) as response:
            return 200 <= response.status < 300
    except Exception:
        return False


@app.get("/health")
def health():
    return {"ok": _llama_health(), "model": MODEL_SPEC, "backend": "llama.cpp"}


@app.post("/solve", response_model=SolveResponse)
def solve(req: SolveRequest, authorization: str | None = Header(default=None)):
    _auth(authorization)
    parsed = _extract_json(_llama_chat(_prompt(req)))

    confidence = parsed.get("confidence", 0.0)
    try:
        confidence = max(0.0, min(1.0, float(confidence)))
    except Exception:
        confidence = 0.0

    if req.kind == "open_response":
        hints = parsed.get("hints") or []
        hints = [str(x).strip() for x in hints if str(x).strip()][:4]
        return SolveResponse(
            kind=req.kind,
            confidence=confidence,
            hints=hints,
            explanation=parsed.get("explanation"),
            model=MODEL_SPEC,
        )

    idx = parsed.get("answer_index")
    try:
        idx = int(idx) if idx is not None else None
    except Exception:
        idx = None
    if idx is not None and not (0 <= idx < len(req.options)):
        idx = None

    answer = req.options[idx] if idx is not None else parsed.get("answer")
    return SolveResponse(
        kind=req.kind,
        answer_index=idx,
        answer=answer,
        confidence=confidence,
        explanation=parsed.get("explanation"),
        model=MODEL_SPEC,
    )
