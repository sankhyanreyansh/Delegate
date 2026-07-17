import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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

async function verifyGemini() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return fail('GEMINI_API_KEY is missing from .env');
  const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Return exactly this JSON object: {"status":"ok"}' }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: {
            type: 'object', additionalProperties: false,
            properties: { status: { type: 'string', enum: ['ok'] } }, required: ['status']
          }
        }
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || `HTTP ${response.status}`);
    const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
    if (JSON.parse(text).status !== 'ok') throw new Error('Unexpected verification response.');
    pass(`Gemini ${model} responded correctly`);
  } catch (error) {
    fail(`Gemini check failed: ${error.message}`);
  }
}

async function verifyDeepgram() {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) return fail('DEEPGRAM_API_KEY is missing from .env');
  const ttsModel = process.env.DEEPGRAM_TTS_MODEL || 'aura-2-thalia-en';
  const sttModel = process.env.DEEPGRAM_STT_MODEL || 'nova-3';
  try {
    const speech = 'This is a clear speech to text verification sentence for the Mandate meeting delegate.';
    const response = await fetch(`https://api.deepgram.com/v1/speak?model=${encodeURIComponent(ttsModel)}&encoding=linear16&container=wav`, {
      method: 'POST',
      headers: { Authorization: `Token ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: speech })
    });
    const audio = Buffer.from(await response.arrayBuffer());
    if (!response.ok) throw new Error(audio.toString('utf8') || `HTTP ${response.status}`);
    if (audio.length < 100) throw new Error('Deepgram returned an empty audio response.');
    pass(`Deepgram TTS ${ttsModel} returned audio`);

    const transcriptResponse = await fetch(`https://api.deepgram.com/v1/listen?model=${encodeURIComponent(sttModel)}&smart_format=true`, {
      method: 'POST',
      headers: { Authorization: `Token ${key}`, 'Content-Type': 'audio/wav' },
      body: audio
    });
    const transcriptData = await transcriptResponse.json();
    if (!transcriptResponse.ok) throw new Error(transcriptData.err_msg || transcriptData.error_message || `HTTP ${transcriptResponse.status}`);
    const transcript = transcriptData.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    if (!/mandate/i.test(transcript)) throw new Error(`Unexpected transcript: ${transcript || '(empty)'}`);
    pass(`Deepgram STT ${sttModel} transcribed the generated audio`);
  } catch (error) {
    fail(`Deepgram check failed: ${error.message}`);
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

console.log('\nMandate provider verification\n');
await verifyDependencies();
await verifyGemini();
await verifyDeepgram();
await verifyPdf();

if (failed) {
  console.error('\nFix the failed item above, then run npm run verify again.\n');
  process.exitCode = 1;
} else {
  console.log('\nEverything is ready. Start the app with: npm start\n');
}
