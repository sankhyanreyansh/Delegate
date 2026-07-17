import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv(path.join(__dirname, '.env'));

const PORT = Number(process.env.PORT || 4242);
const PUBLIC_DIR = path.join(__dirname, 'public');
const PDF_RENDERER = path.join(__dirname, 'scripts', 'generate_report.py');
const MAX_BODY = 12 * 1024 * 1024;

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || line.trim().startsWith('#') || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

function send(res, status, data, headers = {}) {
  const body = Buffer.isBuffer(data) ? data : Buffer.from(JSON.stringify(data));
  res.writeHead(status, {
    'Content-Type': Buffer.isBuffer(data) ? 'application/octet-stream' : 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let length = 0;
    req.on('data', (chunk) => {
      length += chunk.length;
      if (length > MAX_BODY) {
        reject(new Error('Request body is too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function requireEnv(name) {
  if (!process.env[name]) {
    const error = new Error(`${name} is not configured. Add it to .env and restart the server.`);
    error.statusCode = 409;
    throw error;
  }
  return process.env[name];
}

function extractGeminiText(data) {
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
  if (text) return text;
  const reason = data.promptFeedback?.blockReason || data.candidates?.[0]?.finishReason;
  throw new Error(reason ? `Gemini did not return a response (${reason}).` : 'Gemini returned no response text.');
}

async function generateGeminiJson({ instruction, prompt, schema, maxOutputTokens }) {
  const apiKey = requireEnv('GEMINI_API_KEY');
  const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: instruction }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        ...(schema ? { responseJsonSchema: schema } : {}),
        ...(maxOutputTokens ? { maxOutputTokens } : {}),
        temperature: 0.15
      }
    })
  });
  const data = await response.json();
  if (!response.ok) {
    const message = data.error?.message || 'Gemini API request failed.';
    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }
  try {
    return JSON.parse(extractGeminiText(data));
  } catch (error) {
    const parsed = error instanceof SyntaxError ? 'Gemini returned malformed JSON.' : error.message;
    const apiError = new Error(parsed);
    apiError.statusCode = 502;
    throw apiError;
  }
}

function normalizeCandidate(candidate, brief, sourceIds = new Set((brief.sources || []).map((source) => source.id))) {
  const allowedEvidence = (candidate.evidence_ids || []).filter((id) => sourceIds.has(id));
  const confidence = Math.max(0, Math.min(1, Number(candidate.confidence) || 0));
  const action = ['speak', 'escalate', 'decline', 'silent'].includes(candidate.action) ? candidate.action : 'escalate';
  const responseType = ['basic', 'brief_grounded', 'defer', 'decline'].includes(candidate.response_type)
    ? candidate.response_type
    : 'defer';
  const message = String(candidate.message || '').trim().slice(0, 700);
  const commitments = /\b(approve|approved|commit|committed|agree to|we will|i will|sign off)\b/i.test(message);
  const hasAuthority = (brief.authority || []).join(' ').trim().length > 0;
  const insufficientEvidence = action === 'speak' && responseType !== 'basic' && allowedEvidence.length === 0;
  const needsApproval = candidate.authority_level === 'needs_approval' || candidate.authority_level === 'blocked';
  const unsafe = !message || (action === 'speak' && confidence < 0.62) || insufficientEvidence || needsApproval || (commitments && !hasAuthority);

  const unableToComment = (rationale) => ({
    action: 'escalate',
    response_type: 'defer',
    message: `I’m unable to comment on that from the current meeting brief. I’ll ask ${brief.owner || 'the owner'} for guidance before making any commitment.`,
    rationale,
    evidence_ids: allowedEvidence,
    authority_level: 'needs_approval',
    confidence
  });

  if (unsafe) {
    return unableToComment(insufficientEvidence
      ? 'The proposed reply did not cite evidence from this meeting brief.'
      : 'The proposed reply is not sufficiently authorized or confident.');
  }

  if (action === 'escalate' || responseType === 'defer') return unableToComment(String(candidate.rationale || 'The request exceeds the current meeting brief.').slice(0, 500));

  if (action === 'decline' || responseType === 'decline') {
    return {
      action: 'decline',
      response_type: 'decline',
      message: 'That request is not authorized by the current meeting brief, so I cannot make that commitment.',
      rationale: String(candidate.rationale || 'The request is outside the delegated authority.').slice(0, 500),
      evidence_ids: allowedEvidence,
      authority_level: 'blocked',
      confidence
    };
  }

  return {
    action,
    response_type: responseType === 'basic' ? 'basic' : 'brief_grounded',
    message,
    rationale: String(candidate.rationale || '').trim().slice(0, 500),
    evidence_ids: allowedEvidence,
    authority_level: ['within_brief', 'needs_approval', 'blocked'].includes(candidate.authority_level)
      ? candidate.authority_level
      : (action === 'speak' ? 'within_brief' : 'needs_approval'),
    confidence
  };
}

const RETRIEVAL_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'could', 'do', 'does', 'for', 'from', 'how',
  'i', 'if', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'our', 'please', 'should', 'that', 'the',
  'their', 'there', 'this', 'to', 'us', 'was', 'we', 'what', 'when', 'where', 'who', 'will', 'with', 'you', 'your'
]);

function queryTerms(value) {
  return [...new Set((String(value || '').toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) || [])
    .filter((term) => term.length > 1 && !RETRIEVAL_STOP_WORDS.has(term)))];
}

function chunkText(text, size = 720, overlap = 110) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const chunks = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(clean.length, start + size);
    if (end < clean.length) {
      const boundary = clean.lastIndexOf(' ', end);
      if (boundary > start + Math.floor(size * 0.55)) end = boundary;
    }
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

function scoreEvidenceChunk(chunk, terms) {
  const body = chunk.text.toLowerCase();
  const name = chunk.source_name.toLowerCase();
  return terms.reduce((score, term) => {
    let count = 0;
    let index = body.indexOf(term);
    while (index !== -1 && count < 3) {
      count += 1;
      index = body.indexOf(term, index + term.length);
    }
    return score + (count * 3) + (name.includes(term) ? 1 : 0);
  }, 0);
}

function retrieveEvidence(sources, question, limit = 4) {
  const terms = queryTerms(question);
  const chunks = (sources || []).flatMap((source) => chunkText(source.text).map((text, index) => ({
    source_id: source.id,
    source_name: source.name,
    source_kind: source.kind,
    excerpt_id: `${source.id}-excerpt-${index + 1}`,
    text,
    index
  })));
  const ranked = chunks.map((chunk) => ({ ...chunk, score: scoreEvidenceChunk(chunk, terms) }))
    .sort((left, right) => right.score - left.score || left.index - right.index);
  const matching = ranked.filter((chunk) => chunk.score > 0);
  return (matching.length ? matching : ranked).slice(0, limit);
}

function citationExcerpts(response, retrievedEvidence) {
  const cited = new Set(response.evidence_ids || []);
  const seen = new Set();
  return retrievedEvidence.filter((excerpt) => cited.has(excerpt.source_id) && !seen.has(excerpt.source_id))
    .map((excerpt) => {
      seen.add(excerpt.source_id);
      return {
        source_id: excerpt.source_id,
        source_name: excerpt.source_name,
        excerpt_id: excerpt.excerpt_id,
        text: excerpt.text
      };
    });
}

async function verifySpeakingCandidate(response, brief, retrievedEvidence, question) {
  const citedEvidence = retrievedEvidence
    .filter((excerpt) => response.evidence_ids.includes(excerpt.source_id))
    .map((excerpt) => ({ id: excerpt.source_id, excerpt_id: excerpt.excerpt_id, name: excerpt.source_name, text: excerpt.text }));
  const review = await generateGeminiJson({
    instruction: `You are a strict evidence and authority verifier for an AI meeting delegate. There are two permitted response types. A "basic" response may answer ordinary meeting interaction such as presence, hearing a received question, the delegate's identity, whom it represents, or its general role. It must not make a professional claim, state an owner preference, introduce a meeting fact, or make a commitment. A "brief_grounded" response is supported=true only when every factual or position claim is directly grounded in the cited evidence and it makes no new commitment beyond the listed authority. Do not infer missing facts. If unsure, return supported=false. Return exactly one JSON object with supported and reason.`,
    prompt: JSON.stringify({
      owner: brief.owner,
      delegated_authority: brief.authority || [],
      escalation_boundaries: brief.escalation || [],
      question,
      response_type: response.response_type,
      cited_evidence: citedEvidence,
      proposed_reply: response.message
    }),
    maxOutputTokens: 128,
    schema: {
      type: 'object', additionalProperties: false,
      properties: { supported: { type: 'boolean' }, reason: { type: 'string' } },
      required: ['supported', 'reason']
    }
  });
  return { supported: review.supported === true, reason: String(review.reason || 'The reply could not be verified.').slice(0, 500) };
}

async function generateDelegateResponse({ brief = {}, transcript = [], question = '' }) {
  requireEnv('GEMINI_API_KEY');
  const evidence = retrieveEvidence(brief.sources || [], question);
  const retrievedSourceIds = new Set(evidence.map((excerpt) => excerpt.source_id));
  const recentTranscript = transcript.slice(-12).map((entry) => `${entry.speaker}: ${entry.text}`).join('\n');
  const meetingContext = JSON.stringify({
    owner: brief.owner,
    meeting: brief.title,
    goals: brief.goals,
    position: brief.position,
    tone: brief.tone,
    authority: brief.authority,
    escalation: brief.escalation,
    evidence
  }, null, 2);
  const candidate = await generateGeminiJson({
    instruction: `You are Mandate, an AI meeting representative for the named owner. Use your judgment to distinguish ordinary meeting interaction from a substantive professional request. You may answer ordinary interaction directly and naturally: presence, hearing a received question, your identity, whom you represent, your general role, or a simple request to repeat or clarify. Mark those replies response_type="basic"; they need no evidence citation, but must not include an owner preference, meeting fact, decision, timeline, cost, approval, or commitment. For substantive professional questions, use only the supplied meeting brief and retrieved evidence excerpts; do not use outside knowledge. Mark an evidence-supported answer response_type="brief_grounded" and cite one or more supplied source_id values in evidence_ids. Do not cite excerpt_id values. If the professional question is uncertain, outside the brief, or seeks a new commitment, choose "escalate" with response_type="defer". Choose "decline" with response_type="decline" only when the request is expressly prohibited. Keep the spoken answer concise and professional. Return exactly one JSON object with: action (speak|escalate|decline|silent), response_type (basic|brief_grounded|defer|decline), message, rationale, evidence_ids (array of source IDs), authority_level (within_brief|needs_approval|blocked), confidence (number 0 to 1).`,
    prompt: `MEETING BRIEF:\n${meetingContext}\n\nRECENT TRANSCRIPT:\n${recentTranscript}\n\nQUESTION OR LATEST TURN:\n${String(question).slice(0, 3500)}`,
    maxOutputTokens: 320,
    schema: {
      type: 'object', additionalProperties: false,
      properties: {
        action: { type: 'string', enum: ['speak', 'escalate', 'decline', 'silent'] },
        response_type: { type: 'string', enum: ['basic', 'brief_grounded', 'defer', 'decline'] },
        message: { type: 'string' }, rationale: { type: 'string' },
        evidence_ids: { type: 'array', items: { type: 'string' } },
        authority_level: { type: 'string', enum: ['within_brief', 'needs_approval', 'blocked'] },
        confidence: { type: 'number' }
      },
      required: ['action', 'response_type', 'message', 'rationale', 'evidence_ids', 'authority_level', 'confidence']
    }
  });
  let response = normalizeCandidate(candidate, brief, retrievedSourceIds);
  if (response.action === 'speak') {
    const review = await verifySpeakingCandidate(response, brief, evidence, question);
    response.verification = review;
    if (!review.supported) {
      response = {
        action: 'escalate',
        response_type: 'defer',
        message: `I’m unable to comment on that from the current meeting brief. I’ll ask ${brief.owner || 'the owner'} for guidance before making any commitment.`,
        rationale: `Evidence gate blocked the reply: ${review.reason}`,
        evidence_ids: response.evidence_ids,
        authority_level: 'needs_approval',
        confidence: response.confidence,
        verification: review
      };
    }
  }
  if (!response.verification) response.verification = { supported: null, reason: response.response_type === 'defer' ? 'Held for owner guidance.' : 'No spoken response was required.' };
  response.citations = response.evidence_ids.length ? citationExcerpts(response, evidence) : [];
  return response;
}

async function delegate(req, res) {
  const raw = await readBody(req);
  const input = JSON.parse(raw.toString('utf8'));
  const response = await generateDelegateResponse(input);
  return send(res, 200, { response, provider: 'gemini', model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite' });
}

async function rehearse(req, res) {
  const { brief = {}, generated_count = 4, manual_questions = [] } = JSON.parse((await readBody(req)).toString('utf8'));
  requireEnv('GEMINI_API_KEY');
  const generatedCount = Math.max(0, Math.min(6, Number(generated_count) || 0));
  const manualQuestions = (Array.isArray(manual_questions) ? manual_questions : [])
    .map((question) => String(question || '').trim().slice(0, 700)).filter(Boolean).slice(0, 6);
  if (!generatedCount && !manualQuestions.length) {
    const error = new Error('Add a question or choose at least one generated scenario.');
    error.statusCode = 400;
    throw error;
  }
  let generatedQuestions = [];
  if (generatedCount) {
    const generated = await generateGeminiJson({
      instruction: `You create a pre-meeting rehearsal for an AI delegate. Return exactly ${generatedCount} realistic questions someone might address to the delegate. When enough questions are requested, cover ordinary meeting interaction, an evidence-supported professional question, an ambiguous or unsupported question, and a request for a new commitment. For fewer questions, prioritize the most useful coverage. Do not include answers.`,
      prompt: JSON.stringify({
        owner: brief.owner,
        meeting: brief.title,
        goals: brief.goals,
        owner_position: brief.position,
        authority: brief.authority || [],
        escalation: brief.escalation || [],
        references: (brief.sources || []).map((source) => ({ name: source.name, kind: source.kind, text: String(source.text || '').slice(0, 900) }))
      }),
      maxOutputTokens: 520,
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          questions: {
            type: 'array', minItems: 1, maxItems: 6,
            items: {
              type: 'object', additionalProperties: false,
              properties: {
                question: { type: 'string' },
                purpose: { type: 'string', enum: ['basic_interaction', 'supported_question', 'ambiguous_question', 'new_commitment'] }
              },
              required: ['question', 'purpose']
            }
          }
        },
        required: ['questions']
      }
    });
    generatedQuestions = generated.questions.slice(0, generatedCount);
  }
  const tests = [];
  const questions = [
    ...manualQuestions.map((question) => ({ question, purpose: 'manual_question' })),
    ...generatedQuestions
  ];
  for (const item of questions) {
    const question = String(item.question || '').trim().slice(0, 700);
    if (!question) continue;
    const response = await generateDelegateResponse({ brief, transcript: [], question });
    tests.push({ id: `rehearsal-${tests.length + 1}`, question, purpose: item.purpose, response });
  }
  return send(res, 200, { tests, provider: 'gemini', model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite' });
}

async function tts(req, res) {
  const apiKey = requireEnv('DEEPGRAM_API_KEY');
  const { text = '' } = JSON.parse((await readBody(req)).toString('utf8'));
  if (!String(text).trim()) {
    const error = new Error('Text is required for speech synthesis.');
    error.statusCode = 400;
    throw error;
  }
  const params = new URLSearchParams({
    model: process.env.DEEPGRAM_TTS_MODEL || 'aura-2-thalia-en',
    encoding: 'mp3'
  });
  const response = await fetch(`https://api.deepgram.com/v1/speak?${params}`, {
    method: 'POST',
    headers: { 'Authorization': `Token ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: String(text).slice(0, 3000) })
  });
  const audio = Buffer.from(await response.arrayBuffer());
  if (!response.ok) {
    const error = new Error(audio.toString('utf8') || 'Deepgram speech synthesis failed.');
    error.statusCode = response.status;
    throw error;
  }
  return send(res, 200, audio, { 'Content-Type': response.headers.get('content-type') || 'audio/mpeg' });
}

const liveTranscription = new WebSocketServer({ noServer: true });

liveTranscription.on('connection', (browserSocket) => {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    browserSocket.send(JSON.stringify({ type: 'Error', message: 'DEEPGRAM_API_KEY is not configured. Add it to .env and restart the server.' }));
    browserSocket.close(1011, 'Deepgram is not configured');
    return;
  }
  const sttModel = process.env.DEEPGRAM_STT_MODEL || 'nova-3';
  const params = new URLSearchParams({
    model: sttModel,
    language: 'en-US',
    smart_format: 'true',
    punctuate: 'true',
    interim_results: 'true',
    endpointing: '250',
    utterance_end_ms: '1000',
    vad_events: 'true'
  });
  if (sttModel.startsWith('nova-3')) {
    const keyterms = [...new Set((process.env.DEEPGRAM_KEYTERMS || 'Delegate').split(',').map((term) => term.trim()).filter(Boolean))];
    for (const term of keyterms) params.append('keyterm', term);
  }
  const deepgramSocket = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, {
    headers: { Authorization: `Token ${apiKey}` }
  });
  const pendingAudio = [];
  let downstreamOpen = false;
  let browserClosed = false;

  const closeBrowser = (message) => {
    if (browserSocket.readyState === WebSocket.OPEN) {
      browserSocket.send(JSON.stringify({ type: 'Error', message }));
      browserSocket.close(1011, 'Deepgram stream failed');
    }
  };

  deepgramSocket.on('open', () => {
    downstreamOpen = true;
    for (const audio of pendingAudio.splice(0)) deepgramSocket.send(audio, { binary: true });
    browserSocket.send(JSON.stringify({ type: 'Ready' }));
  });
  deepgramSocket.on('message', (data) => {
    if (browserSocket.readyState === WebSocket.OPEN) browserSocket.send(data.toString());
  });
  deepgramSocket.on('error', (error) => closeBrowser(`Deepgram live transcription error: ${error.message}`));
  deepgramSocket.on('close', (code) => {
    if (!browserClosed && code !== 1000) closeBrowser('Deepgram live transcription closed unexpectedly.');
  });

  browserSocket.on('message', (data, isBinary) => {
    if (!isBinary) {
      const control = data.toString();
      if (control.includes('CloseStream')) {
        if (deepgramSocket.readyState === WebSocket.OPEN) deepgramSocket.send(JSON.stringify({ type: 'CloseStream' }));
        return;
      }
      return;
    }
    if (downstreamOpen && deepgramSocket.readyState === WebSocket.OPEN) {
      deepgramSocket.send(data, { binary: true });
    } else {
      pendingAudio.push(data);
    }
  });
  browserSocket.on('close', () => {
    browserClosed = true;
    if (deepgramSocket.readyState === WebSocket.OPEN) deepgramSocket.send(JSON.stringify({ type: 'CloseStream' }));
    setTimeout(() => deepgramSocket.close(), 800);
  });
});

function createPdf(input) {
  return new Promise((resolve, reject) => {
    const python = process.env.REPORT_PYTHON || 'python3';
    const child = spawn(python, [PDF_RENDERER], { stdio: ['pipe', 'pipe', 'pipe'] });
    const output = [];
    const errors = [];
    child.stdout.on('data', (chunk) => output.push(chunk));
    child.stderr.on('data', (chunk) => errors.push(chunk));
    child.on('error', (error) => reject(new Error(`Could not start the PDF renderer (${python}): ${error.message}`)));
    child.on('close', (code) => {
      const pdf = Buffer.concat(output);
      if (code !== 0 || !pdf.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
        reject(new Error(`PDF generation failed. ${Buffer.concat(errors).toString('utf8').trim()}`.trim()));
        return;
      }
      resolve(pdf);
    });
    child.stdin.end(JSON.stringify(input));
  });
}

async function report(req, res) {
  const input = JSON.parse((await readBody(req)).toString('utf8'));
  const brief = input.brief || {};
  const reportData = await generateGeminiJson({
    instruction: `You write concise, factual meeting reports for Mandate. Use only the data provided. Do not add decisions, facts, commitments, or evidence. Return exactly one JSON object with: executive_summary (string, maximum 90 words), decisions (array of strings), owner_actions (array of strings), delegate_position (string), escalation_status (string).`,
    prompt: JSON.stringify({
      meeting: brief.title,
      owner: brief.owner,
      goals: brief.goals,
      position: brief.position,
      transcript: (brief.transcript || []).slice(-60),
      ledger: input.ledger || [],
      approvals: input.approvals || []
    }),
    maxOutputTokens: 700,
    schema: {
      type: 'object', additionalProperties: false,
      properties: {
        executive_summary: { type: 'string' }, decisions: { type: 'array', items: { type: 'string' } },
        owner_actions: { type: 'array', items: { type: 'string' } }, delegate_position: { type: 'string' },
        escalation_status: { type: 'string' }
      },
      required: ['executive_summary', 'decisions', 'owner_actions', 'delegate_position', 'escalation_status']
    }
  });
  const pdf = await createPdf({ ...input, report: reportData, generatedAt: new Date().toISOString() });
  const name = String(brief.title || 'meeting-report').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'meeting-report';
  return send(res, 200, pdf, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="mandate-${name}-report.pdf"`
  });
}

function serveFile(req, res) {
  const pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  const requested = pathname === '/' ? '/index.html' : pathname;
  const file = path.resolve(PUBLIC_DIR, `.${requested}`);
  if (!file.startsWith(PUBLIC_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    return send(res, 404, { error: 'Not found' });
  }
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/api/health') {
      return send(res, 200, {
        gemini: Boolean(process.env.GEMINI_API_KEY),
        geminiModel: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
        deepgram: Boolean(process.env.DEEPGRAM_API_KEY),
        deepgramTtsModel: process.env.DEEPGRAM_TTS_MODEL || 'aura-2-thalia-en',
        deepgramSttModel: process.env.DEEPGRAM_STT_MODEL || 'nova-3',
        reportRenderer: fs.existsSync(PDF_RENDERER),
        zoomAudioBridge: true
      });
    }
    if (req.method === 'POST' && req.url === '/api/delegate') return await delegate(req, res);
    if (req.method === 'POST' && req.url === '/api/rehearsal') return await rehearse(req, res);
    if (req.method === 'POST' && req.url === '/api/tts') return await tts(req, res);
    if (req.method === 'POST' && req.url === '/api/report') return await report(req, res);
    if (req.method === 'GET') return serveFile(req, res);
    return send(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    console.error(error);
    return send(res, error.statusCode || 500, { error: error.message || 'Unexpected server error.' });
  }
});

server.on('upgrade', (req, socket, head) => {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
  if (pathname !== '/api/live-transcribe') {
    socket.destroy();
    return;
  }
  liveTranscription.handleUpgrade(req, socket, head, (client) => liveTranscription.emit('connection', client, req));
});

server.listen(PORT, process.env.HOST || '127.0.0.1', () => console.log(`Mandate is running at http://localhost:${PORT}`));
