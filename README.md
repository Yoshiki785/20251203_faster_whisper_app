# Local Faster-Whisper Transcription API

A small FastAPI server that exposes an OpenAI-style audio transcription endpoint powered by `faster-whisper`.

## Features
- POST `/v1/audio/transcriptions` compatible with OpenAI's Whisper API style.
- Accepts common audio formats via `multipart/form-data`.
- Uses `faster-whisper` for speech-to-text with configurable model size and language.
- CORS enabled for local development.

## Setup
1. *(Optional)* Create and activate a virtual environment:
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Running the server
Start the FastAPI app with uvicorn:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## API usage
Send audio to the transcription endpoint:
```bash
curl -X POST http://localhost:8000/v1/audio/transcriptions \
  -F "file=@sample.mp3" \
  -F "model=medium" \
  -F "language=ja"
```

### Request parameters
- `file` (required): Audio file upload (mp3, wav, m4a, etc.).
- `model` (optional): Faster-whisper model size/path (default: `medium`).
- `language` (optional): ISO language code (e.g., `en`, `ja`, `zh`) or `auto` (default).
- `response_format` (optional): Only `json` is supported.

### Response format
Example JSON response:
```json
{
  "text": "Full transcription text",
  "language": "en",
  "duration": 12.34,
  "segments": [
    {
      "id": 0,
      "start": 0.0,
      "end": 4.0,
      "text": "Segment text"
    }
  ]
}
```

## Node.js merge backend

An Express-based helper service is included to call the local faster-whisper server in Japanese, English, and Chinese, then merge high-quality transcripts via the OpenAI API.

### Setup
1. Install Node.js dependencies:
   ```bash
   npm install
   ```
2. Copy the environment example and set your OpenAI API key:
   ```bash
   cp .env.example .env
   # edit .env to set OPENAI_API_KEY
   ```
3. Ensure the Python faster-whisper server is running at `LOCAL_TRANSCRIBE_BASE_URL` (default `http://localhost:8000`).

### Running the server
Start the Node.js service:
```bash
npm start
```
The server listens on `PORT` (default `3001`).

### API usage
Send audio to the merge endpoint:
```bash
curl -X POST http://localhost:3001/api/transcribe-and-merge \
  -F "audio=@sample.wav" \
  -F "model=medium"
```

### Response format
The service returns the three candidate transcripts and the merged evaluation:
```json
{
  "candidates": [
    { "lang": "ja", "text": "...", "raw": { /* local server response */ } },
    { "lang": "en", "text": "...", "raw": { /* local server response */ } },
    { "lang": "zh", "text": "...", "raw": { /* local server response */ } }
  ],
  "evaluation": {
    "evaluations": [
      { "lang": "ja", "quality": "good" },
      { "lang": "en", "quality": "good" },
      { "lang": "zh", "quality": "bad" }
    ],
    "final": {
      "ja": "<final merged Japanese>",
      "en": "<final merged English>",
      "zh": "<final merged Chinese>"
    }
  }
}
```
