import json
import os
import re
import threading
from typing import Literal

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from cactus import ensure_model, cactus_init, cactus_complete

MODEL_ID = os.getenv("CAPITRITUS_MODEL", "Qwen/Qwen3-0.6B")
API_TOKEN = os.getenv("CAPITRITUS_API_TOKEN", "").strip()
MAX_TOKENS = int(os.getenv("CAPITRITUS_MAX_TOKENS", "220"))

app = FastAPI(title="Capitritus AI", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

_model_lock = threading.Lock()
_model = None
_bundle = None


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
    expected = f"Bearer {API_TOKEN}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="invalid token")


def _load_model():
    global _model, _bundle
    if _model is not None:
        return _model
    with _model_lock:
        if _model is None:
            _bundle = ensure_model(MODEL_ID)
            _model = cactus_init(str(_bundle), None, False)
            if not _model:
                raise RuntimeError(f"failed to initialize {MODEL_ID}")
    return _model


def _extract_json(text: str) -> dict:
    text = text.strip()
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
        "Você é um tutor escolar conciso. Analise a questão com cuidado. "
        "Para multiple_choice, true_false e fill_blank, escolha a opção/termo mais defensável e explique em 1 frase. "
        "Para open_response, NÃO escreva uma resposta final pronta para entregar; forneça somente 2 a 4 pistas conceituais úteis. "
        "Não invente fatos. Retorne SOMENTE JSON válido, sem markdown e sem raciocínio interno."
    )
    payload = {
        "kind": req.kind,
        "subject": req.subject,
        "context": req.context,
        "question": req.question,
        "options": req.options,
        "schema": {
            "choice": {
                "answer_index": "índice inteiro começando em 0, ou null se não houver confiança",
                "confidence": "0 a 1",
                "explanation": "uma frase curta",
            },
            "open_response": {
                "answer_index": None,
                "confidence": "0 a 1",
                "hints": ["pista 1", "pista 2"],
            },
        },
    }
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
    ]


@app.on_event("startup")
def warmup():
    _load_model()


@app.get("/health")
def health():
    return {"ok": True, "model": MODEL_ID, "loaded": _model is not None}


@app.post("/solve", response_model=SolveResponse)
def solve(req: SolveRequest, authorization: str | None = Header(default=None)):
    _auth(authorization)
    model = _load_model()
    options = {
        "max_tokens": MAX_TOKENS,
        "temperature": 0.15,
        "top_p": 0.85,
    }

    with _model_lock:
        result = cactus_complete(model, _prompt(req), options, None, None)

    if not result.get("success", True):
        raise HTTPException(status_code=500, detail=result.get("error") or "model error")

    parsed = _extract_json(str(result.get("response", "")))
    confidence = parsed.get("confidence", result.get("confidence", 0.0))
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
            model=MODEL_ID,
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
        model=MODEL_ID,
    )
