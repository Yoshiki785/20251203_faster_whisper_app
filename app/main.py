from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Dict, List

import shutil

import ctranslate2
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel

app = FastAPI(title="Local Faster-Whisper Transcription API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost",
        "http://localhost:3000",
        "http://127.0.0.1",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DEFAULT_MODEL_NAME = "medium"
model_cache: Dict[str, WhisperModel] = {}


def _select_device() -> str:
    return "cuda" if ctranslate2.get_device_count("cuda") > 0 else "cpu"


def _compute_type_for_device(device: str) -> str:
    return "float16" if device == "cuda" else "int8"


def _load_model(model_size: str) -> WhisperModel:
    if model_size not in model_cache:
        device = _select_device()
        model_cache[model_size] = WhisperModel(
            model_size,
            device=device,
            compute_type=_compute_type_for_device(device),
        )
    return model_cache[model_size]


@app.on_event("startup")
def preload_default_model() -> None:
    _load_model(DEFAULT_MODEL_NAME)


def _transcribe_file(file_path: str, model_size: str, language: str) -> dict:
    model = _load_model(model_size)
    language_arg = None if language.lower() == "auto" else language

    segments, info = model.transcribe(
        file_path,
        language=language_arg,
        beam_size=5,
    )

    segment_list: List[dict] = []
    full_text_parts: List[str] = []

    for idx, segment in enumerate(segments):
        text = segment.text.strip()
        segment_list.append(
            {
                "id": idx,
                "start": segment.start,
                "end": segment.end,
                "text": text,
            }
        )
        full_text_parts.append(text)

    full_text = " ".join(full_text_parts).strip()

    return {
        "text": full_text,
        "language": language_arg or info.language,
        "duration": info.duration,
        "segments": segment_list,
    }


@app.post("/v1/audio/transcriptions")
async def create_transcription(
    file: UploadFile = File(...),
    model: str = Form(DEFAULT_MODEL_NAME),
    language: str = Form("auto"),
    response_format: str = Form("json"),
):
    if response_format.lower() != "json":
        raise HTTPException(status_code=400, detail="Only json response_format is supported")

    if not file:
        raise HTTPException(status_code=400, detail="No file provided for transcription")

    temp_path = None
    try:
        suffix = Path(file.filename).suffix if file.filename else ".tmp"
        with NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            shutil.copyfileobj(file.file, temp_file)
            temp_path = temp_file.name

        transcription = _transcribe_file(temp_path, model, language)
        return transcription
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - defensive programming
        raise HTTPException(status_code=500, detail="Transcription failed") from exc
    finally:
        if temp_path:
            try:
                Path(temp_path).unlink(missing_ok=True)
            except OSError:
                pass
