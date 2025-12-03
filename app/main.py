import logging
import os
import shutil
import tempfile
from pathlib import Path
from typing import Dict

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel

logger = logging.getLogger(__name__)

app = FastAPI(title="Local Whisper Transcription API")

# Allow local development origins
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


ModelCache = Dict[str, WhisperModel]
model_cache: ModelCache = {}
default_model_name = os.getenv("DEFAULT_WHISPER_MODEL", "medium")


def _detect_device_and_precision() -> Dict[str, str]:
    """Return device and compute_type options for WhisperModel."""
    device = "cpu"
    compute_type = "int8"
    try:
        import torch

        if torch.cuda.is_available():
            device = "cuda"
            compute_type = "float16"
    except Exception:
        logger.info("PyTorch not available; falling back to CPU with int8 precision")

    return {"device": device, "compute_type": compute_type}


def load_model(model_size: str) -> WhisperModel:
    """Load or return a cached WhisperModel instance."""
    if model_size in model_cache:
        return model_cache[model_size]

    options = _detect_device_and_precision()
    logger.info("Loading Whisper model '%s' with options %s", model_size, options)
    model_cache[model_size] = WhisperModel(model_size, **options)
    return model_cache[model_size]


@app.on_event("startup")
async def startup_event() -> None:
    """Load the default model so it is ready for incoming requests."""
    try:
        load_model(default_model_name)
    except Exception as exc:
        logger.exception("Failed to load default Whisper model '%s'", default_model_name)
        raise RuntimeError("Could not initialize Whisper model") from exc


@app.post("/v1/audio/transcriptions")
async def transcribe_audio(
    file: UploadFile = File(...),
    model: str = default_model_name,
    language: str = "auto",
    response_format: str = "json",
):
    if file is None:
        raise HTTPException(status_code=400, detail="No file provided")

    if response_format.lower() != "json":
        raise HTTPException(status_code=400, detail="Only 'json' response_format is supported")

    suffix = Path(file.filename or "audio").suffix or ".tmp"
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    temp_path = Path(temp_file.name)

    try:
        with temp_file:
            shutil.copyfileobj(file.file, temp_file)

        whisper_model = load_model(model)
        transcription_language = None if language == "auto" else language

        segments, info = whisper_model.transcribe(
            str(temp_path),
            language=transcription_language,
            beam_size=5,
        )

        segment_list = []
        full_text_parts = []
        for idx, segment in enumerate(segments):
            segment_list.append(
                {
                    "id": idx,
                    "start": round(segment.start, 2),
                    "end": round(segment.end, 2),
                    "text": segment.text.strip(),
                }
            )
            full_text_parts.append(segment.text.strip())

        response = {
            "text": " ".join(full_text_parts).strip(),
            "language": transcription_language or info.language,
            "duration": info.duration,
            "segments": segment_list,
        }
        return response
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Transcription failed: %s", exc)
        raise HTTPException(status_code=500, detail="Transcription failed") from exc
    finally:
        try:
            temp_path.unlink(missing_ok=True)
        except Exception:
            logger.warning("Failed to remove temporary file %s", temp_path)
