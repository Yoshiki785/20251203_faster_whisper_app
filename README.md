# Local Faster-Whisper Transcription API

A lightweight FastAPI server that exposes an OpenAI-compatible `/v1/audio/transcriptions` endpoint backed by [faster-whisper](https://github.com/guillaumekln/faster-whisper).

## Requirements
- Python 3.9+
- (Optional) A CUDA-enabled GPU for faster inference.

## Setup
1. Create and activate a virtual environment (optional but recommended):
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the server:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```

## Usage
Send an audio file to the transcription endpoint using `curl`:

```bash
curl -X POST http://localhost:8000/v1/audio/transcriptions \
  -F "file=@sample.mp3" \
  -F "model=medium" \
  -F "language=ja"
```

The server responds with JSON similar to OpenAI's Whisper API, including the full transcription text, detected language, audio duration, and segmented timestamps.

### Configuration
- `DEFAULT_WHISPER_MODEL` (env): override the model loaded at startup (default: `medium`).
- CORS is enabled for localhost origins to simplify local web development.

## Notes
- Only the `json` response format is supported.
- Models are cached in memory after first load; the default model loads during startup.
