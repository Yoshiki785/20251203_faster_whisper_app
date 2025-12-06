import dotenv from 'dotenv';
import express from 'express';
import multer from 'multer';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import fetch, { FormData } from 'node-fetch';
import OpenAI from 'openai';
　codex/create-fastapi-audio-transcription-server-dj1nyf
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCAL_TRANSCRIBE_BASE_URL = process.env.LOCAL_TRANSCRIBE_BASE_URL || 'http://localhost:8000';
const PORT = process.env.PORT || 3001;
const uploadDir = path.join(process.cwd(), 'tmp');
const publicDir = path.join(process.cwd(), 'public');

if (!process.env.OPENAI_API_KEY) {
  console.error('[startup] OPENAI_API_KEY is not set in environment variables.');
  process.exit(1);
}

const app = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
=======

dotenv.config();

const LOCAL_TRANSCRIBE_BASE_URL = process.env.LOCAL_TRANSCRIBE_BASE_URL || 'http://localhost:8000';
const PORT = process.env.PORT || 3001;
const uploadDir = path.join(process.cwd(), 'tmp');

await fsPromises.mkdir(uploadDir, { recursive: true });
main

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    const safeName = `${Date.now()}-${file.originalname}`;
    cb(null, safeName);
  },
});

const upload = multer({ storage });

codex/create-fastapi-audio-transcription-server-dj1nyf
app.use(express.static(publicDir));
=======
const app = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
main

async function callLocalTranscribe(languageCode, filePath, model) {
  const formData = new FormData();
  formData.append('file', fs.createReadStream(filePath), path.basename(filePath));
codex/create-fastapi-audio-transcription-server-dj1nyf
  formData.append('model', model || 'small');
  formData.append('language', languageCode);
  formData.append('response_format', 'json');

  let response;
  try {
    response = await fetch(`${LOCAL_TRANSCRIBE_BASE_URL}/v1/audio/transcriptions`, {
      method: 'POST',
      body: formData,
    });
  } catch (err) {
    throw new Error(`Local transcription network error for ${languageCode}: ${err.message}`);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Local transcription failed for ${languageCode}: ${response.status} ${body}`);
=======
  formData.append('model', model || 'medium');
  formData.append('language', languageCode);
  formData.append('response_format', 'json');

  const response = await fetch(`${LOCAL_TRANSCRIBE_BASE_URL}/v1/audio/transcriptions`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Local transcription failed for ${languageCode}: ${response.status} ${text}`);
main
  }

  const data = await response.json();
  return {
    lang: languageCode,
    text: data?.text || '',
    raw: data,
  };
}

function buildUserPrompt(candidates) {
  const candidateLines = candidates
    .map((c, idx) => `${idx + 1}) lang: ${c.lang}, text: "${c.text}"`)
    .join('\n');


  return `We have three candidate transcripts for the same audio.\n${candidateLines}\nFor each candidate, decide if it is "good" (linguistically coherent and meaningful) or "bad" (nonsense, wrong language, or unusable). Using only the "good" candidates, reconstruct the best possible content of the original speech and produce final merged versions in Japanese (ja), English (en), and Chinese (zh). Return JSON only with this schema:\n{\n  "evaluations": [\n    { "lang": "ja", "quality": "good" | "bad" },\n    { "lang": "en", "quality": "good" | "bad" },\n    { "lang": "zh", "quality": "good" | "bad" }\n  ],\n  "final": {\n    "ja": "<final merged Japanese>",\n    "en": "<final merged English>",\n    "zh": "<final merged Chinese>"\n  }\n}`;
=======
  return (
    'We have three candidate transcripts for the same audio.\n' +
    candidateLines +
    '\nFor each candidate, decide if it is "good" (linguistically coherent and meaningful) or "bad" (nonsense, wrong language, or unusable). ' +
    'Using only the "good" candidates, reconstruct the best possible content of the original speech and produce final merged versions in Japanese (ja), English (en), and Chinese (zh). ' +
    'Return JSON only with this schema:\n' +
    '{\n  "evaluations": [\n    { "lang": "ja", "quality": "good" | "bad" },\n    { "lang": "en", "quality": "good" | "bad" },\n    { "lang": "zh", "quality": "good" | "bad" }\n  ],\n  "final": {\n    "ja": "<final merged Japanese>",\n    "en": "<final merged English>",\n    "zh": "<final merged Chinese>"\n  }\n}'
  );

}

app.post('/api/transcribe-and-merge', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Audio file is required' });
  }

  const filePath = req.file.path;
  const requestedModel = req.body?.model;

  try {
    const targetLanguages = ['ja', 'en', 'zh'];
    const candidates = await Promise.all(
      targetLanguages.map((lang) => callLocalTranscribe(lang, filePath, requestedModel))
    );

    const systemMessage = {
      role: 'system',
      content: 'You are a strict evaluator and translator. You must respond with valid JSON only.',
    };

    const userMessage = { role: 'user', content: buildUserPrompt(candidates) };

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [systemMessage, userMessage],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    let evaluation;
    try {
      evaluation = JSON.parse(content);
    } catch (err) {
      throw new Error(`Failed to parse OpenAI JSON: ${err.message}`);
    }

    return res.json({ candidates, evaluation });
  } catch (err) {
    console.error('[transcribe-and-merge] Error:', err);
    return res.status(500).json({ error: 'Transcription or merge failed' });
  } finally {
    if (filePath) {
      await fsPromises.unlink(filePath).catch(() => {});
    }
  }
});


async function start() {
  try {
    await fsPromises.mkdir(uploadDir, { recursive: true });
    console.log(`[startup] uploadDir ensured at ${uploadDir}`);
  } catch (err) {
    console.error('[startup] Failed to ensure uploadDir:', err);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Serving static files from ${publicDir}`);
  });
}

start();
=======
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

