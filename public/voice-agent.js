const sessionId = new URLSearchParams(location.search).get('session_id');
const browserSessionId = new URLSearchParams(location.search).get('browser_session_id');
const status = document.getElementById('status');
const browserPresentation = document.getElementById('browser-presentation');
const browserFrame = document.getElementById('browser-frame');
let stream;
let context;
let source;
let processor;
let socket;
let processingTurn = false;
let browserFrameLoaded = false;
let lastPresentationVisible = null;

function setStatus(message, error = false) {
  status.classList.toggle('error', error);
  status.lastElementChild.textContent = message;
}

function setBrowserPresentationVisible(visible, presentationUrl = '') {
  if (lastPresentationVisible === visible) return;
  lastPresentationVisible = visible;
  document.body.classList.toggle('presenting', visible);
  browserPresentation?.setAttribute('aria-hidden', String(!visible));
  if (visible && !browserFrameLoaded && browserFrame && presentationUrl) {
    browserFrame.src = presentationUrl;
    browserFrameLoaded = true;
  }
}

async function syncBrowserPresentation() {
  if (!sessionId || !browserSessionId) return;
  try {
    const response = await fetch(`/api/meetings/${encodeURIComponent(sessionId)}/screen-state`, { cache: 'no-store' });
    if (!response.ok) return;
    const state = await response.json();
    setBrowserPresentationVisible(Boolean(state.presentationVisible), state.liveViewUrl || state.presentationUrl || '');
  } catch {
    // Audio remains independent of the visual presentation state.
  }
}

function pcm16Frame(samples, sourceSampleRate, targetSampleRate = 16000) {
  const ratio = sourceSampleRate / targetSampleRate;
  const frameLength = Math.ceil(samples.length / ratio);
  const output = new ArrayBuffer(frameLength * 2);
  const view = new DataView(output);
  for (let index = 0; index < frameLength; index += 1) {
    const start = Math.floor(index * ratio);
    const end = Math.min(samples.length, Math.floor((index + 1) * ratio));
    let sum = 0;
    for (let sample = start; sample < Math.max(start + 1, end); sample += 1) sum += samples[Math.min(sample, samples.length - 1)] || 0;
    const normalized = Math.max(-1, Math.min(1, sum / Math.max(1, end - start)));
    view.setInt16(index * 2, normalized < 0 ? normalized * 0x8000 : normalized * 0x7fff, true);
  }
  return output;
}

async function speak(text) {
  if (!text) return;
  setStatus('Speaking in the meeting');
  const response = await fetch('/api/tts', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text })
  });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Speech synthesis failed.');
  const url = URL.createObjectURL(await response.blob());
  const audio = new Audio(url);
  try {
    await audio.play();
    await new Promise((resolve) => { audio.onended = resolve; audio.onerror = resolve; });
  } finally {
    URL.revokeObjectURL(url);
  }
  setStatus('Listening in the meeting');
}

async function processTurn(transcript) {
  // Send every completed turn to the meeting record. The server only generates
  // a reply when Delegate is addressed, but this keeps the live transcript
  // useful even while participants are speaking to one another.
  if (processingTurn || !transcript) return;
  processingTurn = true;
  try {
    setStatus('Checking the meeting brief');
    const response = await fetch(`/api/meetings/${encodeURIComponent(sessionId)}/voice-turn`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Delegate could not process that question.');
    if (!data.ignored && data.response?.action !== 'silent') await speak(data.response?.message);
    else setStatus('Listening in the meeting');
  } catch (error) {
    setStatus(error.message || 'Voice agent needs attention', true);
  } finally {
    processingTurn = false;
  }
}

function handleTranscription(raw) {
  let message;
  try { message = JSON.parse(raw); } catch { return; }
  if (message.type === 'Error' || message.type === 'FatalError') {
    setStatus(message.message || 'Transcription stopped', true);
    return;
  }
  if (message.type !== 'TurnInfo') return;
  if (message.event === 'StartOfTurn') setStatus('Listening in the meeting');
  if (message.event === 'EndOfTurn') void processTurn(String(message.transcript || '').trim());
}

async function start() {
  if (!sessionId) throw new Error('Missing meeting session.');
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!navigator.mediaDevices?.getUserMedia || !AudioContextClass) throw new Error('Microphone capture is unavailable in this meeting container.');
  stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  socket = new WebSocket(`${protocol}//${location.host}/api/live-transcribe`);
  context = new AudioContextClass();
  source = context.createMediaStreamSource(stream);
  processor = context.createScriptProcessor(4096, 1, 1);
  processor.onaudioprocess = (event) => {
    event.outputBuffer.getChannelData(0).fill(0);
    if (socket.readyState === WebSocket.OPEN) socket.send(pcm16Frame(event.inputBuffer.getChannelData(0), context.sampleRate));
  };
  source.connect(processor);
  processor.connect(context.destination);
  socket.onopen = () => { void context.resume(); setStatus('Listening in the meeting'); };
  socket.onmessage = (event) => handleTranscription(event.data);
  socket.onerror = () => setStatus('Meeting transcription connection failed', true);
  socket.onclose = () => setStatus('Meeting audio connection closed', true);
  void syncBrowserPresentation();
  if (browserSessionId) window.setInterval(() => void syncBrowserPresentation(), 1000);
}

void start().catch((error) => setStatus(error.message || 'Delegate voice agent could not start.', true));

window.addEventListener('pagehide', () => {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'CloseStream' }));
  stream?.getTracks().forEach((track) => track.stop());
  if (context?.state !== 'closed') void context.close();
});
