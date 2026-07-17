import { ElevenLabsLiveWaveform } from './elevenlabs-live-waveform.js';

const STORE_KEY = 'mandate-mvp-state-v2';
const MODE_KEY = 'mandate-mvp-mode';
let liveWaveform = null;

const icon = (name) => {
  const paths = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="11" width="7" height="10" rx="1.5"/><rect x="3" y="13" width="7" height="8" rx="1.5"/>',
    brief: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
    live: '<path d="M4 12a8 8 0 0 1 16 0"/><path d="M7 12a5 5 0 0 1 10 0"/><path d="M10 12a2 2 0 0 1 4 0"/><path d="M12 12v8"/><path d="M9 20h6"/>',
    ledger: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/>',
    settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    play: '<path d="m9 6 10 6-10 6z"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    more: '<circle cx="12" cy="5" r="1.45" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.45" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.45" fill="currentColor" stroke="none"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    shield: '<path d="M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6z"/><path d="m8.5 12 2.2 2.2 4.8-4.8"/>',
    brain: '<path d="M9 5a3 3 0 0 0-5 2 3 3 0 0 0 1 5 3 3 0 0 0 2 5 3 3 0 0 0 5 1 3 3 0 0 0 5-1 3 3 0 0 0 2-5 3 3 0 0 0 1-5 3 3 0 0 0-5-2 3 3 0 0 0-6 0Z"/><path d="M12 5v14M8 8h4M12 11h4M8 15h4"/>',
    speaker: '<path d="M4 10h4l5-4v12l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>'
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.grid}</svg>`;
};

const nowTime = () => new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date());
const uid = (prefix = 'id') => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
const escapeHtml = (text = '') => String(text).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const initialsFor = (name = '') => String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || '?';

function seedState() {
  return {
    profile: { name: '', initials: '?' },
    briefs: [],
    ledger: [],
    approvals: []
  };
}

function loadState() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || seedState(); }
  catch { return seedState(); }
}

let state = loadState();
let ui = {
  view: 'overview', modal: null, activeBriefId: state.briefs[0]?.id, health: null, thinking: false,
  listening: false, pendingSources: [], referenceDrafts: [], briefDraft: null, mediaRecorder: null, micStream: null,
  liveSocket: null, finalTranscriptParts: [], liveInterim: '', lastProvider: 'not connected',
  audioInputs: [], audioInputId: localStorage.getItem('mandate-listening-source') || '', citationExcerpt: null,
  rehearsal: null, returnModal: null, mode: localStorage.getItem(MODE_KEY) || null, briefMenuId: null,
  attendeeEvents: null, attendeePoll: null, attendeeInterim: ''
};

function persist() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
function activeBrief() { return state.briefs.find((brief) => brief.id === ui.activeBriefId) || state.briefs[0]; }
function getBrief(id) { return state.briefs.find((brief) => brief.id === id); }
function countSources() { return state.briefs.reduce((sum, brief) => sum + (brief.sources || []).length, 0); }
function displaySource(id, brief = activeBrief()) { return brief?.sources?.find((source) => source.id === id)?.name || id; }

function setMode(mode) {
  if (ui.mode && ui.mode !== mode) clearLiveDelegateSession();
  ui.mode = mode;
  localStorage.setItem(MODE_KEY, mode);
}

function resetBriefLiveDelegate(brief) {
  if (!brief) return;
  const sessionId = brief.attendeeSession?.id;
  const remoteSessionIsActive = sessionId && !['ended', 'fatal_error', 'data_deleted'].includes(brief.attendeeSession?.status);
  // Changing workflow context should never leave an unseen Zoom delegate running.
  // The server treats an already-ended bot as an idempotent success.
  if (remoteSessionIsActive) {
    void fetch(`/api/meetings/${encodeURIComponent(sessionId)}/end`, { method: 'POST' }).catch(() => {});
  }
  brief.status = 'Ready';
  brief.attendeeSession = null;
  brief.transcript = [];
}

function clearLiveDelegateSession() {
  stopMic();
  stopAttendeeEvents();
  ui.thinking = false;
  ui.listening = false;
  ui.liveInterim = '';
  ui.attendeeInterim = '';
  for (const brief of state.briefs) {
    if (brief.id === ui.activeBriefId || brief.status === 'Live' || brief.attendeeSession?.id) resetBriefLiveDelegate(brief);
  }
  persist();
}

function renderLanding() {
  return `<main class="landing landing-simple">
    <nav class="simple-nav" aria-label="Delegate">
      <div class="simple-brand"><span class="landing-logo"><img src="/assets/logo.png" alt="Delegate" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"/><span class="landing-logo-fallback">D</span></span><span>Delegate</span></div>
      <a class="simple-github" href="https://github.com/sankhyanreyansh/Mandate" target="_blank" rel="noreferrer">GitHub ${icon('arrow')}</a>
    </nav>

    <section class="simple-hero">
      <div class="eyebrow">AI meeting representative</div>
      <h1>Your position,<br/>present with proof.</h1>
      <p>Delegate represents you in meetings using your brief, your sources, and the authority you set.</p>
      <div class="simple-actions"><button class="button primary" data-action="choose-demo">Try the interactive demo ${icon('arrow')}</button><button class="button ghost" data-action="choose-full">Use with Zoom</button></div>
    </section>

    <section class="simple-section simple-value">
      <div class="simple-section-intro"><div class="eyebrow">Why Delegate</div><h2>A representative that shows its work.</h2></div>
      <div class="value-list">
        <article><span>01</span><h3>Transparent decisions</h3><p>Every answer is shown as answered, cited, deferred, or escalated—so the meeting never becomes a black box.</p></article>
        <article><span>02</span><h3>Rehearse before you delegate</h3><p>Pressure-test the brief against likely questions, then refine the boundaries before the call begins.</p></article>
        <article><span>03</span><h3>Defers in real time</h3><p>When a request exceeds your authority, Delegate pauses instead of guessing or making a commitment for you.</p></article>
      </div>
    </section>

    <section class="simple-section simple-workflow">
      <div class="workflow-heading"><div class="eyebrow">Workflow</div><h2>How it works</h2><p>One prepared source of truth follows the entire conversation.</p></div>
      <ol class="workflow-list">
        <li><span>01</span><div><h3>Create a brief</h3><p>Set your position, goals, tone, authority, escalation rules, and references.</p></div></li>
        <li><span>02</span><div><h3>Index the evidence</h3><p>Delegate retrieves the most relevant source excerpts with RAG.</p></div></li>
        <li><span>03</span><div><h3>Rehearse</h3><p>Test questions and inspect how the delegate will answer, cite, or defer.</p></div></li>
        <li><span>04</span><div><h3>Join the meeting</h3><p>Delegate joins Zoom, listens, speaks, and maintains a live transcript.</p></div></li>
        <li><span>05</span><div><h3>Review the ledger</h3><p>Download the post-meeting record of decisions, citations, and commitments.</p></div></li>
      </ol>
    </section>

    <section class="simple-section simple-modes">
      <div class="simple-section-intro"><div class="eyebrow">Choose a path</div></div>
      <div class="simple-mode-grid">
        <article class="simple-mode recommended"><div class="mode-label">Recommended for judging</div><h3>Try the interactive demo</h3><p>Explore the complete brief, rehearsal, citations, decision receipts, and commitment ledger without a live meeting.</p><button class="button primary" data-action="choose-demo">Open interactive demo ${icon('arrow')}</button></article>
        <article class="simple-mode"><div class="mode-label">Full workflow</div><h3>Use with Zoom</h3><p>Launch Delegate into a Zoom meeting through Attendee.dev, then follow the live transcript and post-meeting record.</p><button class="button ghost" data-action="choose-full">Set up Zoom mode ${icon('arrow')}</button></article>
      </div>
    </section>

    <footer class="simple-footer"><span>Delegate</span><span>Evidence, authority, and accountability for every meeting.</span></footer>
  </main>`;
}

function renderShell() {
  return `<div class="shell">
    ${renderSidebar()}
    <main class="main">
      <header class="topbar">
        <div class="crumb">${ui.mode === 'demo' ? 'Demo workspace' : 'Full workspace'} <span> / </span> <b>${escapeHtml(navMeta()[ui.view]?.label || 'Overview')}</b></div>
        <div class="topbar-actions"><button class="workspace-mode" data-action="show-landing">Change mode</button><div class="profile" title="${escapeHtml(state.profile.name)}">${escapeHtml(state.profile.initials)}</div></div>
      </header>
      <section class="content">${renderPage()}</section>
    </main>
    ${ui.modal ? renderModal() : ''}
  </div>`;
}

function navMeta() {
  return {
    overview: { label: 'Overview', icon: 'grid' },
    briefs: { label: 'Meeting briefs', icon: 'brief' },
    live: { label: 'Live delegate', icon: 'live' },
    ledger: { label: 'Commitment ledger', icon: 'ledger' },
    settings: { label: 'Settings', icon: 'settings' }
  };
}

function renderSidebar() {
  const nav = navMeta();
  return `<aside class="sidebar">
    <div class="brand"><span class="brand-mark"><img src="/assets/logo.png" alt="Delegate" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"/><span class="brand-fallback">D</span></span><span>Delegate</span></div>
    <div class="nav-label">Workspace</div>
    <nav class="nav">
      ${Object.entries(nav).map(([key, item]) => `<button data-action="navigate" data-view="${key}" class="${ui.view === key ? 'active' : ''}"><span class="nav-icon">${icon(item.icon)}</span>${item.label}</button>`).join('')}
    </nav>
  </aside>`;
}

function renderPage() {
  if (ui.view === 'briefs') return renderBriefs();
  if (ui.view === 'live') return renderLive();
  if (ui.view === 'ledger') return renderLedger();
  if (ui.view === 'settings') return renderSettings();
  return renderOverview();
}

function renderOverview() {
  const brief = activeBrief();
  const escalations = state.ledger.filter((row) => row.outcome === 'escalated').length + state.approvals.length;
  return `<div class="page-heading"><div><div class="eyebrow">Meeting representation</div><h1>Presence, even when you’re absent.</h1><p>Prepare a brief, then let Delegate represent your position in the meeting.</p></div></div>
    <div class="grid stats">
      ${statCard(String(state.briefs.length).padStart(2, '0'), 'Meeting briefs', 'ready', '')}
      ${statCard(String(escalations).padStart(2, '0'), 'Needs your input', 'amber', '')}
      ${statCard(String(state.ledger.length).padStart(2, '0'), 'Meeting records', 'aqua', '')}
    </div>
    <div class="dashboard-grid">
      <section class="card card-pad"><div class="section-title"><h2>Next representation</h2><a data-action="navigate" data-view="briefs">All briefs</a></div>
        ${brief ? `<div class="brief-highlight"><div class="eyebrow">${escapeHtml(brief.meetingTime)} · ${escapeHtml(brief.attendees)}</div><h3>${escapeHtml(brief.title)}</h3><p>${escapeHtml(brief.goals)}</p><div class="brief-cta"><button class="button primary" data-action="open-live" data-id="${brief.id}">Open live delegate ${icon('arrow')}</button></div></div>` : empty('Create a brief from the Meeting briefs page to get started.')}
      </section>
      <section class="card card-pad"><div class="section-title"><h2>Recent activity</h2><a data-action="navigate" data-view="ledger">View records</a></div><div class="decision-list">${state.ledger.slice(-3).reverse().map((row) => decisionRow(row)).join('') || empty('Meeting activity will appear here.')}</div></section>
    </div>`;
}

function statCard(value, label, tone, trend) {
  const copy = { 'Meeting briefs': 'Ready for upcoming meetings.', 'Needs your input': 'Items waiting for your decision.', 'Meeting records': 'Decisions from your meetings.' }[label] || '';
  return `<section class="card card-pad stat ${tone}"><div class="eyebrow">${label}</div><div class="stat-value">${value}</div><div class="stat-copy">${copy}</div>${trend ? `<span class="stat-trend">${trend}</span>` : ''}</section>`;
}

function renderTimeline() {
  const brief = activeBrief();
  const items = [
    { time: brief?.meetingTime?.split('·')[1]?.trim() || 'Next', title: brief?.title || 'No meeting brief yet', copy: brief ? 'Ready when you are.' : 'Create one from Meeting briefs.' },
    ...state.ledger.slice(0, 2).map((row) => ({ time: row.time, title: row.item, copy: row.detail }))
  ];
  return items.map((item) => `<div class="timeline-row"><div class="timeline-time">${escapeHtml(item.time)}</div><div class="timeline-pin"></div><div class="timeline-main"><b>${escapeHtml(item.title)}</b><span>${escapeHtml(item.copy)}</span></div></div>`).join('');
}

function decisionRow(row) {
  return `<div class="decision"><div class="decision-top"><b>${escapeHtml(row.item)}</b>${badge(row.outcome)}</div><p>${escapeHtml(row.detail)}</p></div>`;
}

function renderBriefs() {
  return `<div class="page-heading"><div><div class="eyebrow">Preparation</div><h1>Meeting briefs</h1><p>Set the context Delegate should use for each meeting.</p></div><button class="button primary" data-action="new-brief">${icon('plus')} New brief</button></div>
    <div class="briefs-toolbar"><input class="search" data-action="filter-briefs" value="${escapeHtml(ui.query || '')}" placeholder="Search meeting briefs…" /></div>
    <div id="brief-list" class="brief-cards">${briefCards()}</div>`;
}

function briefCards() {
  const query = (ui.query || '').toLowerCase();
  const briefs = state.briefs.filter((brief) => [brief.title, brief.attendees, brief.goals, ...(brief.sources || []).map((source) => source.name)].join(' ').toLowerCase().includes(query));
  if (!briefs.length) return `<div class="card empty"><strong>No briefs found</strong>Try a different search or create a new brief.</div>`;
  return briefs.map((brief) => `<article class="card brief-card ${brief.id === ui.activeBriefId ? 'active-card' : ''}"><div class="brief-card-top"><div class="eyebrow">${escapeHtml(brief.meetingTime)} · ${escapeHtml(brief.status)}</div><div class="brief-menu"><button class="button icon-button ghost brief-menu-trigger" aria-label="More options for ${escapeHtml(brief.title)}" aria-expanded="${ui.briefMenuId === brief.id}" data-action="toggle-brief-menu" data-id="${brief.id}">${icon('more')}</button><div class="brief-menu-popover ${ui.briefMenuId === brief.id ? 'open' : ''}"><button data-action="open-rehearsal" data-id="${brief.id}">Rehearse</button><button data-action="edit-brief" data-id="${brief.id}">Edit brief</button><button data-action="open-live" data-id="${brief.id}">Open live delegate</button><button class="menu-danger" data-action="delete-brief" data-id="${brief.id}">Delete brief</button></div></div></div><h3>${escapeHtml(brief.title)}</h3><p>${escapeHtml(brief.goals)}</p><div class="brief-card-footer"><div><div class="avatar-stack"><span class="mini-avatar">${escapeHtml(initialsFor(brief.owner))}</span><span class="mini-avatar">${escapeHtml(brief.attendees.slice(0,2).toUpperCase())}</span></div><div class="source-count">${brief.sources.length} reference${brief.sources.length === 1 ? '' : 's'}</div></div></div></article>`).join('');
}

function renderLive() {
  const brief = activeBrief();
  if (!brief) return `<div class="page-heading"><div><div class="eyebrow">Live representation</div><h1>No meeting brief selected</h1><p>Create a brief before opening a delegate.</p></div><button class="button primary" data-action="new-brief">Create brief</button></div>`;
  const demo = ui.mode === 'demo';
  const pending = state.approvals.find((approval) => approval.briefId === brief.id);
  const live = brief.status === 'Live';
  const attendee = brief.attendeeSession;
  const attendeeState = attendee?.status || 'ready';
  const visualState = ui.thinking
    ? 'thinking'
    : attendeeState === 'speaking'
      ? 'speaking'
      : (demo ? ui.listening : live && attendeeState !== 'error')
        ? 'listening'
        : 'ready';
  const visualLabel = { ready: 'Ready', listening: 'Listening', thinking: 'Checking brief', speaking: 'Speaking' }[visualState];
  const sessionLabel = demo
    ? (live ? 'Demo session active' : 'Ready to test')
    : (attendee?.statusDetail || (live ? 'Delegate is connecting to Zoom.' : 'Ready to join Zoom.'));
  const launchAction = demo ? 'start-demo-session' : 'start-live';
  const launchLabel = demo ? 'Start demo session' : 'Launch to Zoom';
  const statusCopy = ui.thinking
    ? 'Reviewing the meeting brief.'
    : demo
      ? 'Ask Delegate below. Microphone listening starts with the demo session.'
      : attendeeState === 'speaking'
        ? 'Delegate is speaking in the Zoom meeting.'
        : attendeeState === 'thinking'
          ? 'Checking the active brief and evidence.'
          : attendeeState === 'error'
            ? 'The live meeting connection needs attention.'
            : 'Delegate is listening in Zoom. Address “Delegate” before a question.';
  const stageLabel = ui.thinking ? 'Preparing a response' : live ? `Representing ${escapeHtml(brief.owner)}` : demo ? 'Ready to test the brief' : 'Ready to join Zoom';
  return `<div class="page-heading"><div><div class="eyebrow">${live ? (demo ? 'Demo session' : 'Zoom session') : (demo ? 'Demo workspace' : 'Ready to join')}</div><h1>${escapeHtml(brief.title)}</h1><p>${escapeHtml(brief.meetingTime)} · ${escapeHtml(brief.attendees)}</p></div><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end"><button class="button ghost" data-action="select-briefs">Switch brief</button><button class="button ${live ? 'danger' : 'primary'}" data-action="${live ? 'end-live' : launchAction}">${live ? 'End session' : launchLabel}</button></div></div>
    ${pending ? `<div class="approval-banner"><span class="speaker-avatar" style="margin:0">D</span><div><b>Owner approval requested</b><span>${escapeHtml(pending.question)}</span></div><button class="button warn small" data-action="approve-escalation" data-id="${pending.id}">Review decision</button></div>` : ''}
    <div class="live-layout ${ui.thinking ? 'listening' : ''}">
      <section class="card live-panel"><div class="live-panel-header"><h2>Live transcript</h2><span class="badge ${demo ? (ui.listening ? 'approved' : 'ready') : (live && attendeeState !== 'error' ? 'approved' : 'ready')}">${demo ? (ui.listening ? 'LISTENING' : 'READY') : (live ? String(attendeeState).replace(/_/g, ' ').toUpperCase() : 'READY')}</span></div><div class="live-body"><div class="transcript">${renderTranscript(brief)}</div></div><div class="live-footer">${demo ? `<form id="demo-question-form" class="demo-question-form"><input name="question" required autocomplete="off" placeholder="Ask Delegate about this meeting…" /><button class="button primary" type="submit">Ask</button></form><div class="listening-controls">${renderListeningSource()}</div>` : `<div class="live-zoom-note"><span class="dot"></span><span>Audio is connected by the Zoom delegate. No browser microphone or audio routing is required.</span></div>`}</div></section>
      <section class="card live-stage"><div class="stage-top"><span><span class="dot"></span> ${stageLabel}</span></div><div class="stage-content">
        <div class="voice-visual ${visualState}" role="img" aria-label="Delegate is ${visualLabel.toLowerCase()}"><div class="elevenlabs-live-waveform" data-wave-state="${visualState}"><canvas data-elevenlabs-live-waveform aria-hidden="true"></canvas></div><div class="voice-state"><span></span>${visualLabel}</div></div><h2>${ui.thinking ? 'Checking the brief' : 'Delegate is ready'}</h2><p class="status-copy">${statusCopy}</p>
      </div></section>
      <section class="card live-panel"><div class="live-panel-header"><h2>Meeting brief</h2><button class="text-button" data-action="edit-brief" data-id="${brief.id}">Edit</button></div><div class="live-body">
        <div class="authority-block"><div class="meeting-status-row"><h3>Meeting status</h3><span class="brief-status">${escapeHtml(sessionLabel)}</span></div>${!demo && attendee?.botId ? `<div class="hint" style="margin-top:7px">Zoom bot: ${escapeHtml(attendee.botName || 'Delegate')}</div>` : ''}</div>
        <div class="authority-block"><h3>Owner position</h3><div class="position-copy">${escapeHtml(brief.position)}</div></div>
        <div class="authority-block"><h3>May do</h3><ul>${(brief.authority || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('') || '<li>—</li>'}</ul></div>
        <div class="authority-block escalate"><h3>Must escalate</h3><ul>${(brief.escalation || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>
        <div class="authority-block"><h3>References</h3>${brief.sources.map((source) => `<button class="source-row" data-action="view-source" data-id="${escapeHtml(source.id)}"><b>${escapeHtml(source.name)}</b><span>${escapeHtml(source.kind)}</span></button>`).join('')}</div>
      </div></section>
    </div>`;
}

function renderListeningSource() {
  const options = ui.audioInputs.map((device) => `<option value="${escapeHtml(device.id)}" ${device.id === ui.audioInputId ? 'selected' : ''}>${escapeHtml(device.label)}</option>`).join('');
  return `<label class="audio-source"><span>Listening source</span><select data-action="select-audio-input" ${ui.listening ? 'disabled' : ''}><option value="" ${ui.audioInputId ? '' : 'selected'}>Default microphone</option>${options}</select></label>`;
}

function renderCitationButtons(item, brief) {
  return item.citations?.length
    ? item.citations.map((citation) => `<button class="citation" data-action="view-citation" data-id="${escapeHtml(citation.source_id)}" data-excerpt-id="${escapeHtml(citation.excerpt_id)}">${escapeHtml(citation.source_name)}</button>`).join('')
    : (item.evidence_ids || item.evidence || []).map((id) => { const source = brief.sources.find((candidate) => candidate.id === id); return source ? `<button class="citation" data-action="view-source" data-id="${escapeHtml(id)}">${escapeHtml(source.name)}</button>` : ''; }).join('');
}

function renderResponseReceipt(item, brief) {
  const type = item.responseType || item.response_type;
  if (!type) return '';
  const meta = {
    basic: { label: 'ANSWER DIRECTLY', copy: 'Ordinary meeting interaction', tone: 'basic' },
    brief_grounded: { label: 'REFER TO REFERENCES', copy: 'Grounded in the meeting brief', tone: 'grounded' },
    defer: { label: 'DEFER TO OWNER', copy: 'Needs owner guidance', tone: 'defer' },
    decline: { label: 'DECLINE', copy: 'Outside delegated authority', tone: 'decline' }
  }[type] || { label: 'RESPONSE', copy: 'Meeting response', tone: 'grounded' };
  const citations = renderCitationButtons(item, brief);
  const checked = item.verification?.supported === true ? '<span class="receipt-check">Checked</span>' : '';
  return `<div class="response-receipt ${meta.tone}"><span class="receipt-label">${meta.label}</span><span class="receipt-copy">${meta.copy}</span>${checked}${citations ? `<span class="receipt-citations">${citations}</span>` : ''}</div>`;
}

function renderTranscript(brief) {
  const entries = brief.transcript.map((entry) => {
    const citations = renderCitationButtons(entry, brief);
    const receipt = renderResponseReceipt(entry, brief);
    return `<div class="transcript-entry ${entry.type === 'mandate' ? 'delegate' : ''}"><span class="speaker-avatar ${entry.type === 'mandate' ? 'mandate' : entry.type === 'other' ? 'other' : ''}">${escapeHtml(entry.initials || entry.speaker.slice(0,2).toUpperCase())}</span><div class="speaker-copy"><b>${escapeHtml(entry.speaker)}<time>${escapeHtml(entry.time)}</time></b><p>${escapeHtml(entry.text)}</p>${receipt || (citations ? `<div class="citation-row">${citations}</div>` : '')}</div></div>`;
  }).join('');
  const interimText = ui.mode === 'demo' ? ui.liveInterim : ui.attendeeInterim;
  const interim = interimText ? `<div class="transcript-entry interim"><span class="speaker-avatar other">MP</span><div class="speaker-copy"><b>Meeting participant <time>speaking</time></b><p>${escapeHtml(interimText)}</p></div></div>` : '';
  return entries || interim ? `${entries}${interim}` : empty(ui.mode === 'demo' ? 'Ask Delegate a question below. Listening starts with the demo session.' : 'Launch the Zoom delegate, then meeting speech will appear here.');
}

function renderLedger() {
  const rows = [...state.ledger].reverse();
  return `<div class="page-heading"><div><div class="eyebrow">Meeting history</div><h1>Commitment ledger</h1><p>Decisions and follow-ups from your meeting briefs.</p></div><button class="button ghost" data-action="export-ledger">${icon('download')} Export report</button></div>
    <div class="ledger-layout"><section class="card ledger-table"><div class="ledger-row ledger-head"><span>When</span><span>Meeting record</span><span>Outcome</span></div>${rows.length ? rows.map((row) => `<div class="ledger-row"><span style="color:var(--muted);font-family:'DM Mono',monospace;font-size:10px">${escapeHtml(row.time)}</span><div class="ledger-title">${escapeHtml(row.item)}<small>${escapeHtml(row.detail)}</small></div>${badge(row.outcome)}</div>`).join('') : empty('No meeting activity recorded yet.')}</section></div>`;
}

function badge(outcome) { const label = { approved: 'WITHIN BRIEF', escalated: 'ESCALATED', declined: 'DECLINED', ready: 'READY' }[outcome] || String(outcome || 'ready').toUpperCase(); return `<span class="badge ${outcome || 'ready'}">${label}</span>`; }
function empty(text) { return `<div class="empty"><strong>Nothing here yet</strong>${escapeHtml(text)}</div>`; }

function renderSettings() {
  return `<div class="page-heading"><div><div class="eyebrow">Workspace</div><h1>Settings</h1><p>Manage the information saved in this browser.</p></div></div>
    <div class="settings-grid"><section class="card card-pad"><div class="setting-row"><div><h3>Clear workspace</h3><p>Remove all meeting briefs, transcripts, approvals, and records from this browser.</p></div><button class="button danger" data-action="reset-workspace">Clear workspace</button></div></section></div>`;
}

function renderModal() {
  if (ui.modal === 'new-brief' || ui.modal === 'edit-brief') return briefModal();
  if (ui.modal === 'zoom-bridge') return zoomBridgeModal();
  if (ui.modal === 'approval') return approvalModal();
  if (ui.modal === 'source') return sourceModal();
  if (ui.modal === 'rehearsal') return rehearsalModal();
  return '';
}

function briefModal() {
  const editing = ui.modal === 'edit-brief';
  const brief = editing ? getBrief(ui.editingBriefId) : null;
  if (editing && !brief) return '';
  const draft = ui.briefDraft || {};
  const value = (field, fallback = '') => draft[field] ?? fallback;
  const references = ui.referenceDrafts || [];
  const owner = value('owner', brief?.owner || state.profile.name);
  const zoomField = ui.mode !== 'demo' ? `<div class="field full"><label>Zoom meeting link <span style="font-weight:400;text-transform:none">(optional until launch)</span></label><input name="zoomUrl" type="url" value="${escapeHtml(value('zoomUrl', brief?.zoomUrl || ''))}" placeholder="https://zoom.us/j/..." /></div>` : '';
  const referenceFields = references.length
    ? references.map((source, index) => `<section class="reference-draft"><div class="reference-draft-top"><span>Reference ${index + 1}</span><button class="text-button" type="button" data-action="remove-reference" data-index="${index}">Remove</button></div><input data-action="reference-name" data-index="${index}" value="${escapeHtml(source.name || '')}" placeholder="Reference title" /><textarea data-action="reference-text" data-index="${index}" placeholder="Paste the specific excerpt Delegate may rely on.">${escapeHtml(source.text || '')}</textarea></section>`).join('')
    : `<div class="reference-empty">Add a note or upload reference material Delegate may retrieve.</div>`;
  return `<div class="modal-layer" data-action="close-modal-layer"><section class="modal" role="dialog" aria-modal="true" aria-label="${editing ? 'Edit meeting brief' : 'Create meeting brief'}"><header class="modal-header"><div><h2>${editing ? 'Edit meeting brief' : 'Create meeting brief'}</h2><p>${editing ? 'Update the context for this representation.' : 'Add the context Delegate needs for this meeting.'}</p></div><button class="button icon-button ghost" data-action="close-modal">${icon('close')}</button></header>
    <form id="brief-form"><div class="modal-body"><div class="form-grid">
      <div class="field"><label>Your name</label><input name="owner" required value="${escapeHtml(owner)}" placeholder="Name represented by Delegate" /></div><div class="field"><label>Meeting name</label><input name="title" required value="${escapeHtml(value('title', brief?.title || ''))}" placeholder="e.g. Partner strategy review" /></div>
      <div class="field"><label>When</label><input name="meetingTime" required value="${escapeHtml(value('meetingTime', brief?.meetingTime || ''))}" placeholder="e.g. Friday · 11:00 AM" /></div><div class="field"><label>Attendees / context</label><input name="attendees" required value="${escapeHtml(value('attendees', brief?.attendees || ''))}" placeholder="e.g. Client leadership" /></div>
      ${zoomField}
      <div class="field full"><label>Meeting goal</label><textarea name="goals" required placeholder="What should the delegate help this meeting accomplish?">${escapeHtml(value('goals', brief?.goals || ''))}</textarea></div>
      <div class="field full"><label>Your position</label><textarea name="position" required placeholder="What do you believe, prefer, or need to protect?">${escapeHtml(value('position', brief?.position || ''))}</textarea></div>
      <div class="field"><label>May do <span style="font-weight:400;text-transform:none">(one per line)</span></label><textarea name="authority" required placeholder="Recommend approved options&#10;Ask for a decision owner">${escapeHtml(value('authority', (brief?.authority || []).join('\n')))}</textarea></div>
      <div class="field"><label>Must escalate <span style="font-weight:400;text-transform:none">(one per line)</span></label><textarea name="escalation" required placeholder="New spending&#10;Contract commitment">${escapeHtml(value('escalation', (brief?.escalation || []).join('\n')))}</textarea></div>
      <div class="field full"><label>Communication tone</label><input name="tone" value="${escapeHtml(value('tone', brief?.tone || 'Clear, constructive, and professional.'))}" /></div>
      <div class="field full"><label>References</label><div class="reference-tools"><label class="file-upload"><input id="source-files" type="file" multiple accept=".txt,.md,.csv,.json,.pdf,.docx" /><span>Choose files</span></label><button class="button ghost small" type="button" data-action="add-reference">${icon('plus')} Add reference</button></div><span class="hint">Upload a PDF, DOCX, or text file up to 10 MB. Delegate extracts its text into this brief; review or edit it before saving.</span><div class="reference-drafts">${referenceFields}</div></div>
    </div></div><footer class="modal-footer"><button class="button ghost" type="button" data-action="close-modal">Cancel</button><button class="button primary" type="submit">${editing ? 'Save changes' : 'Create brief'}</button></footer></form></section></div>`;
}

function sourceModal() {
  const source = activeBrief()?.sources?.find((item) => item.id === ui.sourceId);
  if (!source) return '';
  const excerpt = ui.citationExcerpt?.source_id === source.id ? ui.citationExcerpt : null;
  return `<div class="modal-layer" data-action="close-modal-layer"><section class="modal source-modal" role="dialog" aria-modal="true" aria-label="Reference"><header class="modal-header"><div><div class="eyebrow">${excerpt ? 'Relevant excerpt' : escapeHtml(source.kind || 'Reference')}</div><h2>${escapeHtml(source.name)}</h2></div><button class="button icon-button ghost" data-action="close-modal">${icon('close')}</button></header><div class="modal-body">${excerpt ? `<p class="source-note">This is the excerpt Delegate used for the cited reply.</p>` : ''}<div class="source-preview">${escapeHtml(excerpt?.text || source.text || 'No text is available for this reference.')}</div></div><footer class="modal-footer"><button class="button primary" data-action="close-modal">Done</button></footer></section></div>`;
}

function zoomBridgeModal() {
  const brief = activeBrief();
  if (!brief) return '';
  const participantName = `Delegate — ${brief.owner}'s representative`;
  return `<div class="modal-layer" data-action="close-modal-layer"><section class="modal" role="dialog" aria-modal="true" aria-label="Launch Delegate in Zoom"><header class="modal-header"><div><div class="eyebrow">Zoom delegate</div><h2>Send Delegate to this meeting</h2><p>Delegate will join Zoom as a participant, receive the meeting audio, and speak directly into the call.</p></div><button class="button icon-button ghost" data-action="close-modal">${icon('close')}</button></header>
    <form id="zoom-bridge-form"><div class="modal-body"><div class="form-grid">
      <div class="field full"><label>Zoom meeting link</label><input name="zoomUrl" type="url" required value="${escapeHtml(brief.zoomUrl || '')}" placeholder="https://zoom.us/j/..." /><span class="hint">For a normal guest-joinable meeting, Delegate joins automatically. Admit it from the Zoom waiting room if your meeting uses one.</span></div>
      <div class="bridge-card full"><div class="eyebrow">Participant name</div><b>${escapeHtml(participantName)}</b><p>Delegate’s live responses will appear in this dashboard with their evidence receipts.</p></div>
      <div class="field full"><label class="check-field"><input type="checkbox" name="consent" required /> <span>I will tell meeting participants that Delegate is an AI representative and obtain any required consent.</span></label></div>
    </div></div><footer class="modal-footer"><button class="button ghost" type="button" data-action="close-modal">Cancel</button><button class="button primary" type="submit">Launch delegate</button></footer></form></section></div>`;
}

function approvalModal() {
  const approval = state.approvals.find((item) => item.id === ui.approvalId);
  if (!approval) return '';
  return `<div class="modal-layer" data-action="close-modal-layer"><section class="modal" role="dialog" aria-modal="true" aria-label="Escalated decision"><header class="modal-header"><div><div class="eyebrow approval-eyebrow">Owner approval needed</div><h2>${escapeHtml(approval.question)}</h2><p>Delegate held this decision because it is outside the active brief.</p></div><button class="button icon-button ghost" data-action="close-modal">${icon('close')}</button></header><div class="modal-body"><div class="card approval-recommendation"><div class="eyebrow">Delegate recommendation</div><p>${escapeHtml(approval.recommendation)}</p></div><div class="approval-note">Choose an outcome for the record. This demo action updates the commitment ledger and gives the delegate a clear response to return to the meeting.</div></div><footer class="modal-footer"><button class="button ghost" data-action="close-modal">Keep pending</button><button class="button danger" data-action="resolve-approval" data-outcome="declined">Decline</button><button class="button primary" data-action="resolve-approval" data-outcome="approved">Approve response</button></footer></section></div>`;
}

function rehearsalModal() {
  const rehearsal = ui.rehearsal;
  const brief = rehearsal ? getBrief(rehearsal.briefId) : activeBrief();
  if (!brief) return '';
  const purposeLabel = {
    manual_question: 'Your question',
    basic_interaction: 'Basic interaction',
    supported_question: 'Supported question',
    ambiguous_question: 'Ambiguous question',
    new_commitment: 'New commitment'
  };
  const generatedCount = Number(rehearsal?.generatedCount ?? 4);
  const controls = `<section class="rehearsal-config"><div class="field"><label>AI-generated questions</label><select data-action="rehearsal-count">${[0, 1, 2, 3, 4, 5, 6].map((count) => `<option value="${count}" ${count === generatedCount ? 'selected' : ''}>${count}</option>`).join('')}</select><span class="hint">Generated from this meeting brief.</span></div><div class="field"><label>Your questions <span style="font-weight:400;text-transform:none">(one per line)</span></label><textarea data-action="rehearsal-questions" placeholder="Can you agree to the new launch date?&#10;What is your position on the proposal?">${escapeHtml(rehearsal?.manualQuestions || '')}</textarea></div></section>`;
  let body = `<div class="rehearsal-loading"><span class="rehearsal-orb"></span><b>Running rehearsal</b><p>Testing each question against this brief.</p></div>`;
  if (!rehearsal?.loading) {
    const results = rehearsal?.tests?.length
      ? `<div class="rehearsal-summary"><b>${rehearsal.tests.length} scenarios tested</b><span>Each result shows whether Delegate would answer, use references, or defer.</span></div><div class="rehearsal-results">${rehearsal.tests.map((test) => `<section class="rehearsal-card"><div class="rehearsal-question"><span>${escapeHtml(purposeLabel[test.purpose] || 'Meeting scenario')}</span><p>${escapeHtml(test.question)}</p></div><div class="rehearsal-response">${escapeHtml(test.response.message || '')}</div>${renderResponseReceipt(test.response, brief)}</section>`).join('')}</div>`
      : `<div class="rehearsal-empty"><strong>Choose what to test</strong><p>Generate scenarios, add your own questions, or combine both.</p></div>`;
    const error = rehearsal?.error ? `<div class="rehearsal-error">${escapeHtml(rehearsal.error)}</div>` : '';
    body = `${controls}${error}${results}`;
  }
  return `<div class="modal-layer" data-action="close-modal-layer"><section class="modal rehearsal-modal" role="dialog" aria-modal="true" aria-label="Rehearse Delegate"><header class="modal-header"><div><div class="eyebrow">Before the meeting</div><h2>Rehearse Delegate</h2><p>Test how Delegate will represent ${escapeHtml(brief.owner)}.</p></div><button class="button icon-button ghost" data-action="close-modal">${icon('close')}</button></header><div class="modal-body">${body}</div><footer class="modal-footer"><button class="button ghost" data-action="close-modal">Done</button>${!rehearsal?.loading ? `<button class="button primary" data-action="run-rehearsal" data-id="${escapeHtml(brief.id)}">Run rehearsal</button>` : ''}</footer></section></div>`;
}

function render() {
  document.getElementById('app').innerHTML = ui.mode ? renderShell() : renderLanding();
  syncLiveWaveform();
}

function syncLiveWaveform() {
  const canvas = document.querySelector('[data-elevenlabs-live-waveform]');
  if (!canvas) {
    liveWaveform?.detach();
    return;
  }
  if (!liveWaveform) liveWaveform = new ElevenLabsLiveWaveform(canvas);
  else liveWaveform.attach(canvas);
  const isDemo = ui.mode === 'demo';
  liveWaveform.update({
    active: isDemo && ui.listening,
    processing: ui.thinking || (!isDemo && activeBrief()?.status === 'Live'),
    stream: isDemo ? ui.micStream : null
  });
}

function toast(title, detail = '') {
  const region = document.getElementById('toast-region');
  const node = document.createElement('div');
  node.className = 'toast'; node.innerHTML = `<b>${escapeHtml(title)}</b>${detail ? `<br>${escapeHtml(detail)}` : ''}`;
  region.appendChild(node); setTimeout(() => node.remove(), 4200);
}

function addTranscript(brief, entry) {
  brief.transcript.push({ id: uid('turn'), time: nowTime(), ...entry });
  persist();
}

function addLedger(brief, item, detail, outcome, evidence = [], remoteTurnId = null) {
  state.ledger.push({ id: uid('ledger'), briefId: brief.id, time: nowTime(), item, detail, outcome, evidence, remoteTurnId });
  persist();
}

async function askDelegate(question, transcriptText = question) {
  const brief = activeBrief();
  if (!brief || !question?.trim() || ui.thinking) return;
  addTranscript(brief, { speaker: 'Meeting participant', initials: 'MP', text: String(transcriptText || question).trim(), type: 'other' });
  ui.thinking = true; render();
  let result; let provider = 'gemini';
  try {
    const response = await fetch('/api/delegate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief, transcript: brief.transcript, question }) });
    if (!response.ok) throw new Error((await response.json()).error || 'Delegate service is unavailable.');
    const data = await response.json(); result = data.response; provider = data.provider;
  } catch (error) {
    ui.thinking = false;
    render();
    toast('Delegate could not respond', error.message || 'Try again in a moment.');
    return;
  }
  ui.thinking = false; ui.lastProvider = provider;
  addTranscript(brief, {
    speaker: 'Delegate', initials: 'D', text: result.message, type: 'mandate', evidence: result.evidence_ids || [],
    citations: result.citations || [], responseType: result.response_type, verification: result.verification, action: result.action
  });
  if (result.action === 'escalate' || result.authority_level === 'needs_approval') {
    const approval = { id: uid('approval'), briefId: brief.id, question: question.trim(), recommendation: result.message, evidence: result.evidence_ids || [], createdAt: nowTime() };
    state.approvals.push(approval);
    addLedger(brief, 'Decision escalated to owner', result.rationale || 'The question fell outside the meeting brief.', 'escalated', result.evidence_ids || []);
    toast('Owner approval requested', 'Delegate did not make an unapproved commitment.');
  } else if (result.action === 'speak') {
    addLedger(brief, result.response_type === 'basic' ? 'Delegate responded in meeting' : 'Position represented in meeting', result.rationale || 'Delegate shared an approved position.', 'approved', result.evidence_ids || []);
  } else if (result.action === 'decline') {
    addLedger(brief, 'Request declined', result.rationale || 'Delegate declined the request.', 'declined', result.evidence_ids || []);
  }
  persist(); render();
  if (result.action !== 'silent') speak(result.message);
}

function openRehearsal(id) {
  const brief = getBrief(id) || activeBrief();
  if (!brief) return;
  ui.activeBriefId = brief.id;
  ui.rehearsal = { briefId: brief.id, loading: false, tests: [], error: '', generatedCount: 4, manualQuestions: '' };
  ui.modal = 'rehearsal';
  render();
}

async function startRehearsal(id) {
  const brief = getBrief(id) || activeBrief();
  if (!brief) return;
  const rehearsal = ui.rehearsal?.briefId === brief.id ? ui.rehearsal : { briefId: brief.id, generatedCount: 4, manualQuestions: '' };
  const generatedCount = Math.max(0, Math.min(6, Number(rehearsal.generatedCount) || 0));
  const manualQuestions = String(rehearsal.manualQuestions || '').split('\n').map((question) => question.trim()).filter(Boolean).slice(0, 6);
  if (!generatedCount && !manualQuestions.length) {
    ui.rehearsal = { ...rehearsal, loading: false, tests: [], error: 'Add a question or choose at least one generated scenario.' };
    ui.modal = 'rehearsal'; render();
    return;
  }
  ui.activeBriefId = brief.id;
  ui.rehearsal = { ...rehearsal, loading: true, tests: [], error: '', generatedCount, manualQuestions: rehearsal.manualQuestions || '' };
  ui.modal = 'rehearsal';
  render();
  try {
    const response = await fetch('/api/rehearsal', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief, generated_count: generatedCount, manual_questions: manualQuestions })
    });
    if (!response.ok) throw new Error((await response.json()).error || 'Rehearsal service is unavailable.');
    const data = await response.json();
    ui.rehearsal = { ...rehearsal, briefId: brief.id, loading: false, tests: data.tests || [], error: '', generatedCount, manualQuestions: rehearsal.manualQuestions || '' };
  } catch (error) {
    ui.rehearsal = { ...rehearsal, briefId: brief.id, loading: false, tests: [], error: error.message || 'Try again in a moment.', generatedCount, manualQuestions: rehearsal.manualQuestions || '' };
  }
  if (ui.modal === 'rehearsal') render();
}

async function speak(text) {
  try {
    const response = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
    if (!response.ok) throw new Error((await response.json()).error || 'Deepgram speech synthesis failed.');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    await audio.play();
  } catch (error) {
    toast('Delegate could not speak', error.message || 'Check your browser audio settings and try again.');
  }
}

async function processFinalUtterance(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return;
  const question = clean.replace(/\bdelegate\b[,:]?\s*/i, '').trim();
  if (/\bdelegate\b/i.test(clean)) await askDelegate(question || clean, clean);
  else {
    addTranscript(activeBrief(), { speaker: 'Meeting participant', initials: 'MP', text: clean, type: 'other' });
    render();
  }
}

async function handleLiveTranscription(raw) {
  const data = JSON.parse(raw);
  if (data.type === 'Ready') { toast('Listening started', 'Say “Delegate” before a question.'); return; }
  if (data.type === 'Error') { toast('Listening stopped', 'Restart listening and try again.'); stopMic(); return; }
  if (data.type !== 'Results') return;
  const text = data.channel?.alternatives?.[0]?.transcript?.trim() || '';
  if (!data.is_final) {
    ui.liveInterim = text;
    render();
    return;
  }
  ui.liveInterim = '';
  if (text) ui.finalTranscriptParts.push(text);
  if (data.speech_final) {
    const utterance = ui.finalTranscriptParts.join(' ');
    ui.finalTranscriptParts = [];
    await processFinalUtterance(utterance);
  } else {
    render();
  }
}

async function startMic() {
  if (ui.mediaRecorder || ui.liveSocket) return;
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    toast('Microphone capture is unavailable', 'Use a modern browser with microphone permission. No browser speech fallback is enabled.');
    return;
  }
  try {
    const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
    if (ui.audioInputId) audio.deviceId = { exact: ui.audioInputId };
    const stream = await navigator.mediaDevices.getUserMedia({ audio });
    void refreshAudioInputs();
    const preferredType = ['audio/webm;codecs=opus', 'audio/webm'].find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = preferredType ? new MediaRecorder(stream, { mimeType: preferredType }) : new MediaRecorder(stream);
    const socketProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const liveSocket = new WebSocket(`${socketProtocol}//${location.host}/api/live-transcribe`);
    ui.micStream = stream;
    ui.mediaRecorder = recorder;
    ui.liveSocket = liveSocket;
    ui.finalTranscriptParts = [];
    liveSocket.onopen = () => {
      if (recorder.state === 'inactive') recorder.start(250);
    };
    liveSocket.onmessage = (event) => handleLiveTranscription(event.data).catch((error) => toast('Live transcription failed', error.message || 'Please restart the microphone.'));
    liveSocket.onerror = () => toast('Listening error', 'Restart listening and try again.');
    liveSocket.onclose = () => {
      if (ui.mediaRecorder === recorder && recorder.state !== 'inactive') recorder.stop();
      ui.liveSocket = null;
    };
    recorder.onstart = () => { ui.listening = true; render(); };
    recorder.ondataavailable = (event) => {
      if (!event.data.size) return;
      if (liveSocket.readyState === WebSocket.OPEN) liveSocket.send(event.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      if (liveSocket.readyState === WebSocket.OPEN) {
        liveSocket.send(JSON.stringify({ type: 'CloseStream' }));
        setTimeout(() => { if (liveSocket.readyState === WebSocket.OPEN) liveSocket.close(); }, 500);
      }
      ui.mediaRecorder = null; ui.micStream = null; ui.listening = false; ui.liveInterim = ''; render();
    };
  } catch (error) {
    toast('Microphone access failed', error.message || 'Allow microphone access and try again.');
  }
}

function stopMic() {
  if (ui.mediaRecorder && ui.mediaRecorder.state !== 'inactive') ui.mediaRecorder.stop();
  else if (ui.liveSocket?.readyState === WebSocket.OPEN) ui.liveSocket.close();
  else liveWaveform?.update({ active: false, processing: false, stream: null });
}

async function refreshAudioInputs() {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    ui.audioInputs = devices.filter((device) => device.kind === 'audioinput').map((device, index) => ({
      id: device.deviceId,
      label: device.label || `Audio input ${index + 1}`
    }));
    if (ui.audioInputId && !ui.audioInputs.some((device) => device.id === ui.audioInputId)) {
      ui.audioInputId = '';
      localStorage.removeItem('mandate-listening-source');
    }
    if (ui.view === 'live') render();
  } catch { /* Device labels are optional until Chrome grants microphone permission. */ }
}

async function healthCheck() {
  try { const response = await fetch('/api/health'); ui.health = await response.json(); render(); }
  catch { toast('Could not reach local server', 'Run npm start, then refresh this page.'); }
}

function saveBrief(form) {
  const data = new FormData(form);
  const splitLines = (value) => String(value || '').split('\n').map((line) => line.trim()).filter(Boolean);
  const position = String(data.get('position') || '').trim();
  const existing = ui.editingBriefId ? getBrief(ui.editingBriefId) : null;
  // A revised active brief is a new representation context. Keep its historic
  // decisions in the ledger, but never carry a prior live conversation into it.
  if (existing?.id === ui.activeBriefId) clearLiveDelegateSession();
  const ownerPosition = existing?.sources?.find((source) => source.name === 'Owner meeting position' && source.kind === 'Position statement');
  const references = (ui.referenceDrafts || []).map((source, index) => ({
    id: source.id || uid('SRC'),
    name: String(source.name || `Reference ${index + 1}`).trim(),
    kind: source.kind || 'Brief note',
    text: String(source.text || '').trim()
  })).filter((source) => source.text);
  const sources = [{ id: ownerPosition?.id || uid('SRC'), name: 'Owner meeting position', kind: 'Position statement', text: position }, ...references];
  const owner = String(data.get('owner') || '').trim();
  state.profile = { name: owner, initials: initialsFor(owner) };
  const brief = {
    id: existing?.id || uid('brief'), title: data.get('title').trim(), owner, attendees: data.get('attendees').trim(), meetingTime: data.get('meetingTime').trim(), status: existing?.status || 'Ready',
    zoomUrl: ui.mode === 'demo' ? existing?.zoomUrl || '' : String(data.get('zoomUrl') || '').trim(), attendeeSession: existing?.attendeeSession || null,
    goals: data.get('goals').trim(), position, tone: data.get('tone').trim(), authority: splitLines(data.get('authority')), escalation: splitLines(data.get('escalation')), sources, transcript: existing?.transcript || []
  };
  if (existing) state.briefs = state.briefs.map((item) => item.id === existing.id ? brief : item);
  else state.briefs.unshift(brief);
  ui.activeBriefId = brief.id; ui.editingBriefId = null; ui.pendingSources = []; ui.referenceDrafts = []; ui.briefDraft = null; ui.modal = null; persist(); render(); toast(existing ? 'Meeting brief updated' : 'Meeting brief created');
}

function deleteBrief(id) {
  const brief = getBrief(id);
  if (!brief || !confirm(`Delete “${brief.title}” and its saved meeting record?`)) return;
  state.briefs = state.briefs.filter((item) => item.id !== id);
  state.ledger = state.ledger.filter((item) => item.briefId !== id);
  state.approvals = state.approvals.filter((item) => item.briefId !== id);
  if (ui.activeBriefId === id) ui.activeBriefId = state.briefs[0]?.id || null;
  persist(); render(); toast('Meeting brief deleted');
}

async function addFiles(files) {
  captureBriefDraft();
  const references = [];
  const failures = [];
  toast('Preparing references', 'Extracting readable text for the meeting brief.');
  for (const file of files) {
    try {
      const response = await fetch('/api/references/extract', {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'X-Mandate-File-Name': encodeURIComponent(file.name)
        },
        body: file
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Delegate could not read this reference.');
      const text = String(payload.text || '').trim();
      if (!text) throw new Error('No readable text was found.');
      references.push({
        id: uid('SRC'),
        name: String(payload.filename || file.name),
        kind: String(payload.kind || 'Uploaded reference'),
        text
      });
    } catch (error) {
      failures.push(`${file.name}: ${error.message || 'could not be read'}`);
    }
  }
  ui.referenceDrafts.push(...references);
  render();
  if (references.length) toast('References added', `${references.length} reference${references.length === 1 ? '' : 's'} is ready for Delegate to retrieve.`);
  if (failures.length) toast(references.length ? 'Some references were not added' : 'References were not added', failures.join(' · '));
}

function captureBriefDraft() {
  const form = document.getElementById('brief-form');
  if (!form) return;
  const data = new FormData(form);
  ui.briefDraft = Object.fromEntries(['owner', 'title', 'meetingTime', 'attendees', 'zoomUrl', 'goals', 'position', 'authority', 'escalation', 'tone']
    .map((field) => [field, String(data.get(field) || '')]));
}

function resolveApproval(outcome) {
  const approval = state.approvals.find((item) => item.id === ui.approvalId); if (!approval) return;
  const brief = getBrief(approval.briefId);
  addLedger(brief, outcome === 'approved' ? 'Owner approved escalated response' : 'Owner declined escalated response', approval.question, outcome, approval.evidence);
  addTranscript(brief, { speaker: 'Delegate', initials: 'D', type: 'mandate', evidence: approval.evidence, text: outcome === 'approved' ? `${brief.owner} has reviewed this request and approved the response. I can now communicate that decision to the meeting.` : `${brief.owner} reviewed this request and declined to make that commitment. I will keep the existing position.` });
  state.approvals = state.approvals.filter((item) => item.id !== approval.id); ui.modal = null; ui.approvalId = null; persist(); render(); toast(outcome === 'approved' ? 'Approval recorded' : 'Decision declined', 'The commitment ledger has been updated.');
}

async function exportLedger() {
  const brief = activeBrief();
  if (!brief) return;
  try {
    toast('Generating report', 'Preparing your post-meeting PDF.');
    const response = await fetch('/api/report', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile: state.profile,
        brief,
        ledger: state.ledger.filter((row) => row.briefId === brief.id),
        approvals: state.approvals.filter((approval) => approval.briefId === brief.id)
      })
    });
    if (!response.ok) throw new Error((await response.json()).error || 'PDF report generation failed.');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `mandate-${brief.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'meeting'}-report.pdf`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    URL.revokeObjectURL(url);
    toast('PDF report downloaded', 'The report includes the decisions, evidence trail, and transcript appendix.');
  } catch (error) {
    toast('PDF report failed', error.message || 'Check the app setup and try again.');
  }
}

function stopAttendeeEvents() {
  if (ui.attendeeEvents) ui.attendeeEvents.close();
  if (ui.attendeePoll) clearInterval(ui.attendeePoll);
  ui.attendeeEvents = null;
  ui.attendeePoll = null;
  ui.attendeeInterim = '';
}

function appendRemoteTranscript(brief, entry) {
  if (!brief || !entry?.id || brief.transcript.some((item) => item.id === entry.id)) return;
  brief.transcript.push(entry);
}

function recordRemoteDelegateDecision(brief, response, question, remoteTurnId = null) {
  if (!brief || !response || response.action === 'silent') return;
  if (remoteTurnId && state.ledger.some((row) => row.remoteTurnId === remoteTurnId)) return;
  if (response.action === 'escalate' || response.authority_level === 'needs_approval') {
    if (!state.approvals.some((approval) => approval.briefId === brief.id && approval.question === question)) {
      state.approvals.push({ id: uid('approval'), briefId: brief.id, question, recommendation: response.message, evidence: response.evidence_ids || [], createdAt: nowTime() });
      addLedger(brief, 'Decision escalated to owner', response.rationale || 'The question fell outside the meeting brief.', 'escalated', response.evidence_ids || [], remoteTurnId);
      toast('Owner approval requested', 'Delegate did not make an unapproved commitment.');
    }
  } else if (response.action === 'speak') {
    addLedger(brief, response.response_type === 'basic' ? 'Delegate responded in meeting' : 'Position represented in meeting', response.rationale || 'Delegate shared an approved position.', 'approved', response.evidence_ids || [], remoteTurnId);
  } else if (response.action === 'decline') {
    addLedger(brief, 'Request declined', response.rationale || 'Delegate declined the request.', 'declined', response.evidence_ids || [], remoteTurnId);
  }
}

function applyAttendeeSessionRecord(brief, record) {
  if (!brief || !record?.session) return;
  brief.attendeeSession = record.session;
  if (['joined', 'in_meeting', 'recording', 'joining', 'waiting_room', 'listening', 'thinking', 'speaking'].includes(record.session.status)) {
    brief.status = 'Live';
  }
  if (['ended', 'fatal_error', 'data_deleted'].includes(record.session.status)) {
    brief.status = 'Ready';
    stopAttendeeEvents();
  }
  for (const entry of record.transcript || []) appendRemoteTranscript(brief, entry);
  for (const event of record.delegate_events || []) {
    appendRemoteTranscript(brief, event.entry);
    recordRemoteDelegateDecision(brief, event.response, event.question || 'Meeting question', event.entry?.id || null);
  }
}

async function syncAttendeeSession(briefId, sessionId, showError = false) {
  const brief = getBrief(briefId);
  if (!brief || !sessionId) return;
  try {
    const response = await fetch(`/api/meetings/${encodeURIComponent(sessionId)}`);
    if (!response.ok) {
      if (response.status === 404) {
        brief.attendeeSession = null;
        brief.status = 'Ready';
        stopAttendeeEvents();
        persist();
        if (ui.view === 'live' && ui.activeBriefId === briefId) render();
      }
      return;
    }
    applyAttendeeSessionRecord(brief, await response.json());
    persist();
    if (ui.view === 'live' && ui.activeBriefId === briefId) render();
  } catch (error) {
    if (showError) toast('Live record reconnecting', 'Delegate is continuing to try to sync the meeting record.');
  }
}

function connectAttendeeEvents(briefId, sessionId) {
  if (!sessionId || !window.EventSource) return;
  stopAttendeeEvents();
  const events = new EventSource(`/api/attendee-events?session_id=${encodeURIComponent(sessionId)}`);
  ui.attendeeEvents = events;
  void syncAttendeeSession(briefId, sessionId);
  ui.attendeePoll = setInterval(() => void syncAttendeeSession(briefId, sessionId), 2000);
  events.onmessage = (message) => {
    let event;
    try { event = JSON.parse(message.data); } catch { return; }
    const brief = getBrief(briefId);
    if (!brief) return;
    if (event.type === 'status' && event.session) applyAttendeeSessionRecord(brief, { session: event.session });
    if (event.type === 'interim_transcript') ui.attendeeInterim = event.text || '';
    if (event.type === 'transcript') appendRemoteTranscript(brief, event.entry);
    if (event.type === 'delegate_response') {
      appendRemoteTranscript(brief, event.entry);
      recordRemoteDelegateDecision(brief, event.response, event.question || 'Meeting question', event.entry?.id || null);
    }
    if (event.type === 'error') toast('Live delegate needs attention', event.message || 'Check the meeting connection.');
    if (event.type === 'status_note') toast('Zoom delegate update', event.message || 'Attendee reported a meeting update.');
    persist();
    if (ui.view === 'live' && ui.activeBriefId === briefId) render();
  };
  events.onerror = () => void syncAttendeeSession(briefId, sessionId);
}

async function startZoomBridge(form) {
  const brief = activeBrief();
  if (!brief) return;
  const zoomUrl = String(new FormData(form).get('zoomUrl') || '').trim();
  if (!zoomUrl) { toast('Zoom link is needed', 'Paste the Zoom meeting link before launching Delegate.'); return; }
  try {
    resetBriefLiveDelegate(brief);
    ui.liveInterim = '';
    ui.attendeeInterim = '';
    ui.thinking = true; render();
    const response = await fetch('/api/meetings/launch', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brief: { ...brief, zoomUrl }, zoom_url: zoomUrl })
    });
    if (!response.ok) throw new Error((await response.json()).error || 'Attendee could not launch the Zoom delegate.');
    const data = await response.json();
    brief.zoomUrl = zoomUrl;
    brief.status = 'Live';
    brief.attendeeSession = data.session;
    delete brief.zoomBridge;
    ui.modal = null;
    ui.thinking = false;
    persist();
    connectAttendeeEvents(brief.id, data.session.id);
    render();
    toast('Delegate is joining Zoom', 'Admit the Delegate participant if the meeting uses a waiting room.');
  } catch (error) {
    ui.thinking = false;
    render();
    toast('Could not launch Delegate', error.message || 'Check the live-meeting setup and try again.');
  }
}

async function endZoomDelegate() {
  const brief = activeBrief();
  if (!brief) return;
  const sessionId = brief.attendeeSession?.id;
  if (!sessionId) {
    brief.status = 'Ready';
    persist(); render();
    return;
  }
  try {
    const response = await fetch(`/api/meetings/${encodeURIComponent(sessionId)}/end`, { method: 'POST' });
    if (!response.ok) {
      const payload = await response.json();
      const error = new Error(payload.error || 'Attendee could not leave the meeting.');
      error.statusCode = response.status;
      throw error;
    }
    const data = await response.json();
    brief.attendeeSession = data.session;
    brief.status = 'Ready';
    stopAttendeeEvents();
    persist(); render();
    toast('Delegate session ended', 'The meeting record remains available.');
  } catch (error) {
    // Attendee sessions are deliberately in-memory for this local MVP. If Delegate
    // was restarted, the browser can retain an old session ID in local storage.
    // Clear that stale state so the user can launch a new delegate immediately.
    if (error.statusCode === 404) {
      brief.attendeeSession = null;
      brief.status = 'Ready';
      stopAttendeeEvents();
      persist();
      render();
      toast('Previous session cleared', 'That delegate session was no longer active. You can launch Delegate again.');
      return;
    }
    toast('Could not end the delegate session', error.message || 'Try again in a moment.');
  }
}

function startDemoSession() {
  const brief = activeBrief();
  if (!brief) return;
  resetBriefLiveDelegate(brief);
  ui.liveInterim = '';
  ui.attendeeInterim = '';
  brief.status = 'Live';
  addTranscript(brief, {
    speaker: 'Delegate', initials: 'D', type: 'mandate', evidence: [],
    text: `I’m Delegate, representing ${brief.owner}. Ask me anything about this meeting brief.`
  });
  persist();
  render();
  void startMic();
  toast('Demo session started', 'Listening for “Delegate” now.');
}

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]'); if (!target) return;
  const action = target.dataset.action;
  if (action !== 'toggle-brief-menu') ui.briefMenuId = null;
  if (action === 'choose-demo') { stopAttendeeEvents(); setMode('demo'); ui.view = 'briefs'; ui.modal = 'new-brief'; ui.editingBriefId = null; ui.pendingSources = []; ui.referenceDrafts = []; ui.briefDraft = null; render(); }
  if (action === 'choose-full') { stopMic(); setMode('full'); ui.view = 'overview'; ui.modal = null; const brief = activeBrief(); if (brief?.status === 'Live' && brief.attendeeSession?.id) connectAttendeeEvents(brief.id, brief.attendeeSession.id); render(); }
  if (action === 'show-landing') { clearLiveDelegateSession(); ui.mode = null; localStorage.removeItem(MODE_KEY); ui.modal = null; render(); }
  if (action === 'navigate') { ui.view = target.dataset.view; ui.modal = null; render(); }
  if (action === 'new-brief') { ui.modal = 'new-brief'; ui.editingBriefId = null; ui.pendingSources = []; ui.referenceDrafts = []; ui.briefDraft = null; render(); }
  if (action === 'close-modal' || action === 'close-modal-layer' && event.target === target) {
    const returnModal = ui.modal === 'source' ? ui.returnModal : null;
    ui.modal = returnModal || null; ui.returnModal = null; ui.editingBriefId = null; ui.referenceDrafts = []; ui.briefDraft = null; ui.citationExcerpt = null; render();
  }
  if (action === 'edit-brief') {
    const brief = getBrief(target.dataset.id);
    ui.activeBriefId = target.dataset.id; ui.editingBriefId = target.dataset.id; ui.modal = 'edit-brief'; ui.pendingSources = []; ui.briefDraft = null;
    ui.referenceDrafts = (brief?.sources || []).filter((source) => !(source.name === 'Owner meeting position' && source.kind === 'Position statement')).map((source) => ({ ...source }));
    render();
  }
  if (action === 'toggle-brief-menu') { ui.briefMenuId = ui.briefMenuId === target.dataset.id ? null : target.dataset.id; render(); }
  if (action === 'delete-brief') deleteBrief(target.dataset.id);
  if (action === 'open-rehearsal') openRehearsal(target.dataset.id);
  if (action === 'run-rehearsal') startRehearsal(target.dataset.id);
  if (action === 'select-briefs') { ui.view = 'briefs'; render(); }
  if (action === 'open-live') {
    const nextBriefId = target.dataset.id;
    if (nextBriefId !== ui.activeBriefId) {
      clearLiveDelegateSession();
      resetBriefLiveDelegate(getBrief(nextBriefId));
      ui.activeBriefId = nextBriefId;
      persist();
    }
    ui.view = 'live';
    render();
  }
  if (action === 'start-live') { ui.modal = 'zoom-bridge'; render(); }
  if (action === 'start-demo-session') startDemoSession();
  if (action === 'end-live') {
    if (ui.mode === 'demo') {
      const brief = activeBrief(); brief.status = 'Ready'; stopMic(); persist(); render(); toast('Demo session ended', 'The commitment ledger remains available.');
    } else {
      endZoomDelegate();
    }
  }
  if (action === 'add-reference') { captureBriefDraft(); ui.referenceDrafts.push({ id: uid('SRC'), name: '', kind: 'Brief note', text: '' }); render(); }
  if (action === 'remove-reference') { captureBriefDraft(); ui.referenceDrafts.splice(Number(target.dataset.index), 1); render(); }
  if (action === 'view-source') { ui.sourceId = target.dataset.id; ui.citationExcerpt = null; ui.returnModal = null; ui.modal = 'source'; render(); }
  if (action === 'view-citation') {
    const transcriptCitations = activeBrief()?.transcript?.flatMap((entry) => entry.citations || []) || [];
    const rehearsalCitations = ui.rehearsal?.tests?.flatMap((test) => test.response?.citations || []) || [];
    const citation = [...transcriptCitations, ...rehearsalCitations]
      .find((item) => item.source_id === target.dataset.id && item.excerpt_id === target.dataset.excerptId);
    ui.sourceId = target.dataset.id; ui.citationExcerpt = citation || null; ui.returnModal = ui.modal === 'rehearsal' ? 'rehearsal' : null; ui.modal = 'source'; render();
  }
  if (action === 'approve-escalation') { ui.modal = 'approval'; ui.approvalId = target.dataset.id; render(); }
  if (action === 'resolve-approval') resolveApproval(target.dataset.outcome);
  if (action === 'export-ledger') exportLedger();
  if (action === 'check-health') healthCheck();
  if (action === 'reset-workspace') { if (confirm('Clear every local Delegate brief, transcript, approval, and ledger entry?')) { state = seedState(); ui.activeBriefId = null; ui.modal = null; persist(); render(); toast('Workspace cleared', 'Your local Delegate data has been removed.'); } }
});

document.addEventListener('submit', (event) => {
  if (event.target.id === 'brief-form') { event.preventDefault(); saveBrief(event.target); }
  if (event.target.id === 'zoom-bridge-form') { event.preventDefault(); void startZoomBridge(event.target); }
  if (event.target.id === 'demo-question-form') {
    event.preventDefault();
    const input = event.target.elements.question;
    const question = String(input?.value || '').trim();
    if (!question) return;
    input.value = '';
    askDelegate(question);
  }
});
document.addEventListener('change', (event) => { if (event.target.id === 'source-files' && event.target.files?.length) addFiles(event.target.files); });
document.addEventListener('change', (event) => {
  if (event.target.dataset.action === 'rehearsal-count' && ui.rehearsal) {
    ui.rehearsal.generatedCount = Number(event.target.value);
  }
  if (event.target.dataset.action === 'select-audio-input') {
    ui.audioInputId = event.target.value;
    if (ui.audioInputId) localStorage.setItem('mandate-listening-source', ui.audioInputId);
    else localStorage.removeItem('mandate-listening-source');
    toast('Listening source saved', 'The selected source will be used when the next demo session starts.');
  }
});
document.addEventListener('input', (event) => {
  const action = event.target.dataset.action;
  if (action === 'filter-briefs') { ui.query = event.target.value; const list = document.getElementById('brief-list'); if (list) list.innerHTML = briefCards(); }
  if ((action === 'reference-name' || action === 'reference-text') && ui.referenceDrafts[Number(event.target.dataset.index)]) {
    const field = action === 'reference-name' ? 'name' : 'text';
    ui.referenceDrafts[Number(event.target.dataset.index)][field] = event.target.value;
  }
  if (action === 'rehearsal-questions' && ui.rehearsal) ui.rehearsal.manualQuestions = event.target.value;
});
document.addEventListener('click', (event) => {
  if (ui.briefMenuId && !event.target.closest('.brief-menu')) {
    ui.briefMenuId = null;
    const list = document.getElementById('brief-list');
    if (list) list.innerHTML = briefCards();
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && ui.modal) {
    const returnModal = ui.modal === 'source' ? ui.returnModal : null;
    ui.modal = returnModal || null; ui.returnModal = null; ui.editingBriefId = null; ui.referenceDrafts = []; ui.briefDraft = null; ui.citationExcerpt = null; render();
  }
});

render();
healthCheck();
void refreshAudioInputs();
if (ui.mode === 'full' && activeBrief()?.status === 'Live' && activeBrief()?.attendeeSession?.id) {
  connectAttendeeEvents(activeBrief().id, activeBrief().attendeeSession.id);
}
