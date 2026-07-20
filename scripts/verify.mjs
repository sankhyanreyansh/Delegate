import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
loadEnv(path.join(root, '.env'));

let failed = false;

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || line.trim().startsWith('#') || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

function pass(message) { console.log(`✓ ${message}`); }
function fail(message) { failed = true; console.error(`✗ ${message}`); }

function run(command, args, input = '') {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: root, stdio: ['pipe', 'pipe', 'pipe'] });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', (error) => resolve({ code: 1, stdout: '', stderr: error.message }));
    child.on('close', (code) => resolve({ code, stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8') }));
    child.stdin.end(input);
  });
}

async function verifyOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return fail('OPENAI_API_KEY is missing from .env');
  const model = process.env.OPENAI_MODEL || 'gpt-5.6-luna';
  const reasoningEffort = process.env.OPENAI_REASONING_EFFORT || 'none';
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        input: 'Return exactly this JSON object: {"status":"ok"}',
        reasoning: { effort: reasoningEffort },
        text: { format: { type: 'json_schema', name: 'provider_verification', strict: true, schema: {
          type: 'object', additionalProperties: false,
          properties: { status: { type: 'string', enum: ['ok'] } }, required: ['status']
        } } }
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || `HTTP ${response.status}`);
    const text = (data.output || []).flatMap((item) => item.content || [])
      .filter((part) => part.type === 'output_text').map((part) => part.text || '').join('');
    if (JSON.parse(text).status !== 'ok') throw new Error('Unexpected verification response.');
    pass(`OpenAI ${model} responded correctly with reasoning effort ${reasoningEffort}`);
    const embeddingModel = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
    const embeddingDimensions = Number(process.env.OPENAI_EMBEDDING_DIMENSIONS || 768);
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: embeddingModel,
        input: 'Delegate verifies source retrieval with semantic embeddings.',
        encoding_format: 'float',
        dimensions: embeddingDimensions
      })
    });
    const embeddingData = await embeddingResponse.json();
    if (!embeddingResponse.ok || !Array.isArray(embeddingData.data?.[0]?.embedding) || embeddingData.data[0].embedding.length !== embeddingDimensions) {
      throw new Error(embeddingData.error?.message || `OpenAI embedding verification did not return a ${embeddingDimensions}-dimensional vector.`);
    }
    pass(`OpenAI embeddings ${embeddingModel} returned a semantic retrieval vector`);
  } catch (error) {
    fail(`OpenAI check failed: ${error.message}`);
  }
}

async function verifyDeepgram() {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) return fail('DEEPGRAM_API_KEY is missing from .env');
  const ttsModel = process.env.DEEPGRAM_BROWSER_TTS_MODEL || 'flux-alexis-en';
  if (!ttsModel.startsWith('flux-')) return fail('DEEPGRAM_BROWSER_TTS_MODEL must be a Flux voice for Demo Mode.');
  try {
    const speech = 'This is a clear speech synthesis verification sentence for the Delegate meeting representative.';
    const response = await fetch(`https://api.deepgram.com/v2/speak?model=${encodeURIComponent(ttsModel)}&encoding=mp3`, {
      method: 'POST',
      headers: { Authorization: `Token ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: speech })
    });
    const audio = Buffer.from(await response.arrayBuffer());
    if (!response.ok) throw new Error(audio.toString('utf8') || `HTTP ${response.status}`);
    if (audio.length < 100) throw new Error('Deepgram returned an empty audio response.');
    pass(`Deepgram Flux Demo TTS ${ttsModel} returned audio`);
  } catch (error) {
    fail(`Deepgram check failed: ${error.message}`);
  }
}

function verifyFluxSocket(url, label) {
  const key = process.env.DEEPGRAM_API_KEY;
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, { headers: { Authorization: `Token ${key}` } });
    const timeout = setTimeout(() => {
      try { socket.close(); } catch { /* noop */ }
      reject(new Error('Timed out waiting for a Deepgram Flux connection.'));
    }, 8000);
    const finish = (error) => {
      clearTimeout(timeout);
      try { socket.close(); } catch { /* noop */ }
      if (error) reject(error); else resolve();
    };
    socket.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'Connected') finish();
        if (message.type === 'Error') finish(new Error(message.description || message.code || 'Deepgram Flux rejected the connection.'));
      } catch { /* Ignore binary or non-JSON data. */ }
    });
    socket.on('error', (error) => finish(error));
    socket.on('close', () => { /* Connected or error handlers settle the promise. */ });
  });
}

async function verifyFlux() {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) return;
  const sttModels = [...new Set([
    process.env.DEEPGRAM_STT_MODEL || 'flux-general-en',
    process.env.DEEPGRAM_BROWSER_STT_MODEL || 'flux-general-en'
  ])];
  const ttsModel = process.env.DEEPGRAM_TTS_MODEL || 'flux-alexis-en';
  if (sttModels.some((model) => !model.startsWith('flux-'))) return fail('DEEPGRAM_STT_MODEL and DEEPGRAM_BROWSER_STT_MODEL must be Flux models.');
  if (!ttsModel.startsWith('flux-')) return fail('DEEPGRAM_TTS_MODEL must be a Flux voice for the Attendee Zoom bot.');
  try {
    for (const sttModel of sttModels) {
      await verifyFluxSocket(`wss://api.deepgram.com/v2/listen?model=${encodeURIComponent(sttModel)}&encoding=linear16&sample_rate=16000`, `Flux STT ${sttModel}`);
      pass(`Deepgram Flux STT ${sttModel} accepted a live connection`);
    }
    await verifyFluxSocket(`wss://api.deepgram.com/v2/speak?model=${encodeURIComponent(ttsModel)}&encoding=linear16&sample_rate=16000`, `Flux TTS ${ttsModel}`);
    pass(`Deepgram Flux TTS ${ttsModel} accepted a live connection`);
  } catch (error) {
    fail(`Deepgram Flux check failed: ${error.message}`);
  }
}

async function verifyAttendee() {
  const key = process.env.ATTENDEE_API_KEY;
  const secret = process.env.ATTENDEE_WEBHOOK_SECRET;
  const base = process.env.PUBLIC_BASE_URL;
  if (!key) return fail('ATTENDEE_API_KEY is missing from .env');
  if (!secret) return fail('ATTENDEE_WEBHOOK_SECRET is missing from .env');
  try {
    const url = new URL(base || '');
    if (url.protocol !== 'https:' || /(^|\.)(localhost|127\.0\.0\.1)$/i.test(url.hostname)) throw new Error('PUBLIC_BASE_URL must be a public https URL, not localhost.');
  } catch (error) {
    return fail(`Attendee public URL check failed: ${error.message}`);
  }
  try {
    const response = await fetch('https://app.attendee.dev/api/v1/bots', { headers: { Authorization: `Token ${key}` } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    pass('Attendee API key and public webhook URL are configured');
  } catch (error) {
    fail(`Attendee check failed: ${error.message}`);
  }
}

async function verifyPdf() {
  const python = process.env.REPORT_PYTHON || 'python3';
  const renderer = path.join(root, 'scripts', 'generate_report.py');
  const payload = JSON.stringify({
    brief: { title: 'Verification meeting', owner: 'Mandate', meetingTime: 'Now', attendees: 'Test', transcript: [] },
    report: { executive_summary: 'Verification report.', decisions: [], owner_actions: [], delegate_position: 'Verified.', escalation_status: 'None.' },
    ledger: [], approvals: []
  });
  const result = await run(python, [renderer], payload);
  if (result.code !== 0 || !result.stdout.startsWith('%PDF-')) {
    return fail(`PDF check failed: ${result.stderr.trim() || 'The renderer did not return a PDF.'}`);
  }
  pass('PDF report renderer returned a valid PDF');
}

async function verifyDependencies() {
  try {
    await import('ws');
    pass('WebSocket dependency is installed');
  } catch {
    fail('WebSocket dependency is missing. Run: npm install');
  }
}

console.log('\nDelegate provider verification\n');
await verifyDependencies();
await verifyOpenAI();
await verifyDeepgram();
await verifyFlux();
await verifyAttendee();
await verifyPdf();

if (failed) {
  console.error('\nFix the failed item above, then run npm run verify again.\n');
  process.exitCode = 1;
} else {
  console.log('\nEverything is ready. Start the app with: npm start\n');
}
