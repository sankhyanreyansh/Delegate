const STORE_KEY = 'mandate-mvp-state-v2';
const MODE_KEY = 'mandate-mvp-mode';

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
  rehearsal: null, returnModal: null, mode: localStorage.getItem(MODE_KEY) || null, briefMenuId: null
};

function persist() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
function activeBrief() { return state.briefs.find((brief) => brief.id === ui.activeBriefId) || state.briefs[0]; }
function getBrief(id) { return state.briefs.find((brief) => brief.id === id); }
function countSources() { return state.briefs.reduce((sum, brief) => sum + (brief.sources || []).length, 0); }
function displaySource(id, brief = activeBrief()) { return brief?.sources?.find((source) => source.id === id)?.name || id; }

function setMode(mode) {
  ui.mode = mode;
  localStorage.setItem(MODE_KEY, mode);
}

function renderLanding() {
  return `<main class="landing landing-light">
    <div class="landing-wash" aria-hidden="true"></div>
    <nav class="landing-nav" aria-label="Mandate">
      <div class="landing-brand"><span class="landing-logo"><img src="/assets/mandate-logo.png" alt="Mandate" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"/><span class="landing-logo-fallback">M</span></span><span>Mandate</span></div>
      <div class="landing-nav-copy">Meeting representation</div>
    </nav>
    <section class="landing-hero">
      <div class="hero-copy"><h1>Your perspective,<br/><em>present in every meeting.</em></h1><p>Brief Mandate, rehearse its boundaries, then let it represent you live. Every substantive response is linked to an approved source; every decision beyond its authority comes back to you.</p><div class="hero-actions"><button class="button primary hero-primary" data-action="choose-demo">Try the interactive demo ${icon('arrow')}</button><button class="button ghost hero-secondary" data-action="choose-full">Use with Zoom</button></div><div class="landing-local">No account required. Your workspace stays in this browser.</div></div>
      <section class="hero-workspace-preview" aria-label="Mandate live delegate preview"><header class="hero-preview-top"><div class="preview-brand"><span>M</span> Mandate</div><div>Live delegate</div></header><div class="hero-preview-body"><div class="hero-preview-title"><div><span>PRODUCT STRATEGY REVIEW</span><h2>Representing Alex Rivera</h2></div><div class="hero-preview-status"><i></i>Listening</div></div><section class="hero-preview-chat"><div class="hero-preview-turn participant"><i>MP</i><div><small>Meeting participant</small><p>Delegate, can we commit to the new launch date?</p></div></div><div class="hero-preview-turn mandate"><i>M</i><div><small>Mandate</small><p>We should resolve the remaining reliability risks before committing to a date.</p><span>Within brief · Source: Product priorities</span></div></div></section><div class="hero-preview-briefline"><span>${icon('shield')} Active brief</span><p>Protect reliability before new commitments.</p></div></div></section>
    </section>
    <section class="landing-why"><div class="why-visual"><img src="/assets/mandate-live-meeting.png" alt="Mandate representing its owner in a team meeting" /><span>Present when you cannot be.</span></div><div class="why-copy"><div class="eyebrow">Why Mandate</div><h2>More than a meeting recap.</h2><p>Mandate represents the position you prepared—not a generic assistant’s guess. Using retrieval-augmented generation (RAG), it retrieves the relevant approved excerpt from your references before it answers. It can speak when the brief gives it a basis, show the source behind a substantive response, and hold decisions that still belong to you.</p><div class="why-statement"><span>${icon('shield')}</span><p><b>Your brief sets the boundary.</b> The meeting still has your judgment behind it.</p></div></div></section>
    <section class="landing-flow"><div class="flow-heading"><div class="eyebrow">How Mandate works</div><h2>A representative you can test before you send.</h2><p>Mandate makes its decision process legible before, during, and after the conversation.</p></div><div class="flow-steps"><article><span>01</span><h3>Set the brief</h3><p>Define your position, the sources Mandate may use, and the boundaries it must keep.</p></article><article><span>02</span><h3>Rehearse the edge cases</h3><p>Test likely questions and pressure-test what Mandate will answer, cite, or return to you.</p></article><article><span>03</span><h3>Represent with a record</h3><p>Send Mandate into the discussion, then review its evidence, decisions, and follow-ups.</p></article></div></section>
    <section class="mode-section"><div class="mode-heading"><div><div class="eyebrow">Choose your path</div><h2>See the representative work before your meeting starts.</h2></div><p>Both paths use the same brief, evidence receipts, rehearsal, and meeting record.</p></div><div class="mode-grid">
      <article class="mode-card featured"><div class="mode-card-top"><span class="mode-icon">${icon('play')}</span><span class="mode-tag">Recommended first</span></div><h3>Demo mode</h3><p>Explore the representative without arranging a meeting.</p><ul><li>Create a meeting brief and add reference material</li><li>Rehearse likely questions before the meeting</li><li>Ask Mandate questions directly and inspect receipts</li></ul><button class="button primary" data-action="choose-demo">Open demo ${icon('arrow')}</button><small>No Zoom or audio routing required.</small></article>
      <article class="mode-card"><div class="mode-card-top"><span class="mode-icon dark">${icon('live')}</span><span class="mode-tag neutral">Full workflow</span></div><h3>Use with Zoom</h3><p>Connect Mandate to a real meeting from this computer.</p><ul><li>Paste a Zoom meeting link into your brief</li><li>Join as Mandate and route meeting audio locally</li><li>Let Mandate listen and speak during the meeting</li></ul><button class="button ghost" data-action="choose-full">Open full workspace ${icon('arrow')}</button><small>Requires Zoom and a local BlackHole audio route.</small></article>
    </div></section>
    <footer class="landing-footer"><span>Mandate</span><span>Meeting representation, grounded in your brief.</span></footer>
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
    <div class="brand"><span class="brand-mark"><img src="/assets/mandate-logo.png" alt="Mandate" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"/><span class="brand-fallback">M</span></span><span>Mandate</span></div>
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
  return `<div class="page-heading"><div><div class="eyebrow">Meeting representation</div><h1>Presence, even when you’re absent.</h1><p>Prepare a brief, then let Mandate represent your position in the meeting.</p></div></div>
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
  return `<div class="page-heading"><div><div class="eyebrow">Preparation</div><h1>Meeting briefs</h1><p>Set the context Mandate should use for each meeting.</p></div><button class="button primary" data-action="new-brief">${icon('plus')} New brief</button></div>
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
  const sessionLabel = demo ? (live ? 'Demo session active' : 'Ready to test') : (brief.zoomBridge && live ? 'Zoom audio bridge active' : brief.zoomUrl ? 'Zoom bridge configured' : 'Zoom bridge not started');
  const launchAction = demo ? 'start-demo-session' : 'start-live';
  const launchLabel = demo ? 'Start demo session' : 'Launch Zoom bridge';
  const statusCopy = ui.thinking ? 'Reviewing the meeting brief.' : demo ? 'Ask Mandate below, or use your browser microphone.' : 'Ask “Delegate” a question in the Zoom meeting.';
  const stageLabel = ui.thinking ? 'Preparing a response' : live ? `Representing ${escapeHtml(brief.owner)}` : demo ? 'Ready to test the brief' : 'Ready for the meeting';
  return `<div class="page-heading"><div><div class="eyebrow">${live ? (demo ? 'Demo session' : 'In session') : (demo ? 'Demo workspace' : 'Ready to join')}</div><h1>${escapeHtml(brief.title)}</h1><p>${escapeHtml(brief.meetingTime)} · ${escapeHtml(brief.attendees)}</p></div><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end"><button class="button ghost" data-action="select-briefs">Switch brief</button>${!demo && live && brief.zoomUrl ? `<button class="button ghost" data-action="open-zoom-session">Open Zoom</button>` : ''}<button class="button ${live ? 'danger' : 'primary'}" data-action="${live ? 'end-live' : launchAction}">${live ? 'End session' : launchLabel}</button></div></div>
    ${pending ? `<div class="approval-banner"><span class="speaker-avatar" style="margin:0">!</span><div><b>Owner approval requested</b><span>${escapeHtml(pending.question)}</span></div><button class="button warn small" data-action="approve-escalation" data-id="${pending.id}">Review decision</button></div>` : ''}
    <div class="live-layout ${ui.thinking ? 'listening' : ''}">
      <section class="card live-panel"><div class="live-panel-header"><h2>Live transcript</h2><span class="badge ${ui.listening ? 'approved' : 'ready'}">${ui.listening ? 'LISTENING' : 'READY'}</span></div><div class="live-body"><div class="transcript">${renderTranscript(brief)}</div></div><div class="live-footer">${demo ? `<form id="demo-question-form" class="demo-question-form"><input name="question" required autocomplete="off" placeholder="Ask Mandate about this meeting…" /><button class="button primary" type="submit">Ask</button></form>` : ''}<div class="listening-controls">${renderListeningSource()}<button class="button ghost" data-action="toggle-mic">${icon('mic')} ${ui.listening ? 'Stop listening' : 'Start listening'}</button></div></div></section>
      <section class="card live-stage"><div class="stage-top"><span><span class="dot"></span> ${stageLabel}</span></div><div class="stage-content">
        <div class="mascot-frame ${ui.thinking ? 'pulse-ring' : ''}"><img src="/assets/mandate-mascot.png" alt="Mandate mascot" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"/><span class="mascot-fallback">${icon('brain')}</span></div><h2>${ui.thinking ? 'One moment…' : 'Mandate is ready'}</h2><p class="status-copy">${statusCopy}</p>
      </div></section>
      <section class="card live-panel"><div class="live-panel-header"><h2>Meeting brief</h2><button class="text-button" data-action="edit-brief" data-id="${brief.id}">Edit</button></div><div class="live-body">
        <div class="authority-block"><h3>Meeting status</h3><div class="brief-status">${escapeHtml(sessionLabel)}</div></div>
        <div class="authority-block"><h3>Owner position</h3><div style="color:#566276;font-size:11px;line-height:1.6">${escapeHtml(brief.position)}</div></div>
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
  const interim = ui.listening && ui.liveInterim ? `<div class="transcript-entry interim"><span class="speaker-avatar other">MP</span><div class="speaker-copy"><b>Meeting participant <time>speaking</time></b><p>${escapeHtml(ui.liveInterim)}</p></div></div>` : '';
  return entries || interim ? `${entries}${interim}` : empty(ui.mode === 'demo' ? 'Ask Mandate a question below or start listening.' : 'Start listening when the Zoom meeting begins.');
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
    ? references.map((source, index) => `<section class="reference-draft"><div class="reference-draft-top"><span>Reference ${index + 1}</span><button class="text-button" type="button" data-action="remove-reference" data-index="${index}">Remove</button></div><input data-action="reference-name" data-index="${index}" value="${escapeHtml(source.name || '')}" placeholder="Reference title" /><textarea data-action="reference-text" data-index="${index}" placeholder="Paste the specific excerpt Mandate may rely on.">${escapeHtml(source.text || '')}</textarea></section>`).join('')
    : `<div class="reference-empty">Add a note or file, then provide the excerpt Mandate may use.</div>`;
  return `<div class="modal-layer" data-action="close-modal-layer"><section class="modal" role="dialog" aria-modal="true" aria-label="${editing ? 'Edit meeting brief' : 'Create meeting brief'}"><header class="modal-header"><div><h2>${editing ? 'Edit meeting brief' : 'Create meeting brief'}</h2><p>${editing ? 'Update the context for this representation.' : 'Add the context Mandate needs for this meeting.'}</p></div><button class="button icon-button ghost" data-action="close-modal">${icon('close')}</button></header>
    <form id="brief-form"><div class="modal-body"><div class="form-grid">
      <div class="field"><label>Your name</label><input name="owner" required value="${escapeHtml(owner)}" placeholder="Name represented by Mandate" /></div><div class="field"><label>Meeting name</label><input name="title" required value="${escapeHtml(value('title', brief?.title || ''))}" placeholder="e.g. Partner strategy review" /></div>
      <div class="field"><label>When</label><input name="meetingTime" required value="${escapeHtml(value('meetingTime', brief?.meetingTime || ''))}" placeholder="e.g. Friday · 11:00 AM" /></div><div class="field"><label>Attendees / context</label><input name="attendees" required value="${escapeHtml(value('attendees', brief?.attendees || ''))}" placeholder="e.g. Client leadership" /></div>
      ${zoomField}
      <div class="field full"><label>Meeting goal</label><textarea name="goals" required placeholder="What should the delegate help this meeting accomplish?">${escapeHtml(value('goals', brief?.goals || ''))}</textarea></div>
      <div class="field full"><label>Your position</label><textarea name="position" required placeholder="What do you believe, prefer, or need to protect?">${escapeHtml(value('position', brief?.position || ''))}</textarea></div>
      <div class="field"><label>May do <span style="font-weight:400;text-transform:none">(one per line)</span></label><textarea name="authority" required placeholder="Recommend approved options&#10;Ask for a decision owner">${escapeHtml(value('authority', (brief?.authority || []).join('\n')))}</textarea></div>
      <div class="field"><label>Must escalate <span style="font-weight:400;text-transform:none">(one per line)</span></label><textarea name="escalation" required placeholder="New spending&#10;Contract commitment">${escapeHtml(value('escalation', (brief?.escalation || []).join('\n')))}</textarea></div>
      <div class="field full"><label>Communication tone</label><input name="tone" value="${escapeHtml(value('tone', brief?.tone || 'Clear, constructive, and professional.'))}" /></div>
      <div class="field full"><label>References</label><div class="reference-tools"><label class="file-upload"><input id="source-files" type="file" multiple accept=".txt,.md,.csv,.pdf,.doc,.docx" /><span>Choose files</span></label><button class="button ghost small" type="button" data-action="add-reference">${icon('plus')} Add reference</button></div><span class="hint">Text files are read automatically. For PDFs and documents, replace the uploaded note with the relevant excerpt.</span><div class="reference-drafts">${referenceFields}</div></div>
    </div></div><footer class="modal-footer"><button class="button ghost" type="button" data-action="close-modal">Cancel</button><button class="button primary" type="submit">${editing ? 'Save changes' : 'Create brief'}</button></footer></form></section></div>`;
}

function sourceModal() {
  const source = activeBrief()?.sources?.find((item) => item.id === ui.sourceId);
  if (!source) return '';
  const excerpt = ui.citationExcerpt?.source_id === source.id ? ui.citationExcerpt : null;
  return `<div class="modal-layer" data-action="close-modal-layer"><section class="modal source-modal" role="dialog" aria-modal="true" aria-label="Reference"><header class="modal-header"><div><div class="eyebrow">${excerpt ? 'Relevant excerpt' : escapeHtml(source.kind || 'Reference')}</div><h2>${escapeHtml(source.name)}</h2></div><button class="button icon-button ghost" data-action="close-modal">${icon('close')}</button></header><div class="modal-body">${excerpt ? `<p class="source-note">This is the excerpt Mandate used for the cited reply.</p>` : ''}<div class="source-preview">${escapeHtml(excerpt?.text || source.text || 'No text is available for this reference.')}</div></div><footer class="modal-footer"><button class="button primary" data-action="close-modal">Done</button></footer></section></div>`;
}

function zoomBridgeModal() {
  const brief = activeBrief();
  if (!brief) return '';
  const participantName = `Mandate — ${brief.owner}'s Delegate`;
  return `<div class="modal-layer" data-action="close-modal-layer"><section class="modal" role="dialog" aria-modal="true" aria-label="Launch Zoom audio bridge"><header class="modal-header"><div><div class="eyebrow">Zoom audio bridge</div><h2>Launch Mandate into this meeting</h2><p>Open the meeting, join with the delegate name below, then connect the audio route.</p></div><button class="button icon-button ghost" data-action="close-modal">${icon('close')}</button></header>
    <form id="zoom-bridge-form"><div class="modal-body"><div class="form-grid">
      <div class="field full"><label>Zoom meeting link</label><input id="zoom-link-input" name="zoomUrl" type="url" required value="${escapeHtml(brief.zoomUrl || '')}" placeholder="https://zoom.us/j/..." /><span class="hint">This opens Zoom on this computer.</span></div>
      <div class="bridge-card full"><div class="eyebrow">Zoom participant name</div><b>${escapeHtml(participantName)}</b><p>Use this name on Zoom’s join screen.</p><button class="button ghost small" type="button" data-action="copy-zoom-name" data-name="${escapeHtml(participantName)}">Copy name</button></div>
      <div class="field full"><label class="check-field"><input type="checkbox" name="joined" required /> <span>I opened the Zoom link and joined this meeting as the named Mandate participant.</span></label></div>
      <div class="field full"><label class="check-field"><input type="checkbox" name="zoomMic" required /> <span>In Zoom Audio settings, I selected <b>BlackHole 2ch</b> as the microphone.</span></label></div>
      <div class="field full"><label class="check-field"><input type="checkbox" name="zoomSpeaker" required /> <span>In Zoom Audio settings, I selected physical speakers or a Multi-Output Device—not BlackHole 2ch.</span></label></div>
      <div class="field full"><label class="check-field"><input type="checkbox" name="browserMic" required /> <span>In Chrome, I allowed Mandate to use the listening source selected on the Live delegate page.</span></label></div>
    </div></div><footer class="modal-footer"><button class="button ghost" type="button" data-action="bridge-voice-test">${icon('speaker')} Test Mandate voice</button><button class="button ghost" type="button" data-action="open-zoom-link">Open Zoom link</button><button class="button primary" type="submit">Start live bridge</button></footer></form></section></div>`;
}

function approvalModal() {
  const approval = state.approvals.find((item) => item.id === ui.approvalId);
  if (!approval) return '';
  return `<div class="modal-layer" data-action="close-modal-layer"><section class="modal" role="dialog" aria-modal="true" aria-label="Escalated decision"><header class="modal-header"><div><div class="eyebrow" style="color:#a66d1f">Owner approval needed</div><h2>${escapeHtml(approval.question)}</h2><p>Mandate held this decision because it is outside the active brief.</p></div><button class="button icon-button ghost" data-action="close-modal">${icon('close')}</button></header><div class="modal-body"><div class="card" style="padding:15px;border-color:#f0d6a9;background:#fffaf1"><div class="eyebrow">Delegate recommendation</div><p style="margin:6px 0 0;font-size:13px">${escapeHtml(approval.recommendation)}</p></div><div style="margin-top:15px;color:var(--muted);font-size:12px">Choose an outcome for the record. This demo action updates the commitment ledger and gives the delegate a clear response to return to the meeting.</div></div><footer class="modal-footer"><button class="button ghost" data-action="close-modal">Keep pending</button><button class="button danger" data-action="resolve-approval" data-outcome="declined">Decline</button><button class="button primary" data-action="resolve-approval" data-outcome="approved">Approve response</button></footer></section></div>`;
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
      ? `<div class="rehearsal-summary"><b>${rehearsal.tests.length} scenarios tested</b><span>Each result shows whether Mandate would answer, use references, or defer.</span></div><div class="rehearsal-results">${rehearsal.tests.map((test) => `<section class="rehearsal-card"><div class="rehearsal-question"><span>${escapeHtml(purposeLabel[test.purpose] || 'Meeting scenario')}</span><p>${escapeHtml(test.question)}</p></div><div class="rehearsal-response">${escapeHtml(test.response.message || '')}</div>${renderResponseReceipt(test.response, brief)}</section>`).join('')}</div>`
      : `<div class="rehearsal-empty"><strong>Choose what to test</strong><p>Generate scenarios, add your own questions, or combine both.</p></div>`;
    const error = rehearsal?.error ? `<div class="rehearsal-error">${escapeHtml(rehearsal.error)}</div>` : '';
    body = `${controls}${error}${results}`;
  }
  return `<div class="modal-layer" data-action="close-modal-layer"><section class="modal rehearsal-modal" role="dialog" aria-modal="true" aria-label="Rehearse mandate"><header class="modal-header"><div><div class="eyebrow">Before the meeting</div><h2>Rehearse Mandate</h2><p>Test how Mandate will represent ${escapeHtml(brief.owner)}.</p></div><button class="button icon-button ghost" data-action="close-modal">${icon('close')}</button></header><div class="modal-body">${body}</div><footer class="modal-footer"><button class="button ghost" data-action="close-modal">Done</button>${!rehearsal?.loading ? `<button class="button primary" data-action="run-rehearsal" data-id="${escapeHtml(brief.id)}">Run rehearsal</button>` : ''}</footer></section></div>`;
}

function render() { document.getElementById('app').innerHTML = ui.mode ? renderShell() : renderLanding(); }

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

function addLedger(brief, item, detail, outcome, evidence = []) {
  state.ledger.push({ id: uid('ledger'), briefId: brief.id, time: nowTime(), item, detail, outcome, evidence });
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
    toast('Mandate could not respond', error.message || 'Try again in a moment.');
    return;
  }
  ui.thinking = false; ui.lastProvider = provider;
  addTranscript(brief, {
    speaker: 'Mandate', initials: 'M', text: result.message, type: 'mandate', evidence: result.evidence_ids || [],
    citations: result.citations || [], responseType: result.response_type, verification: result.verification, action: result.action
  });
  if (result.action === 'escalate' || result.authority_level === 'needs_approval') {
    const approval = { id: uid('approval'), briefId: brief.id, question: question.trim(), recommendation: result.message, evidence: result.evidence_ids || [], createdAt: nowTime() };
    state.approvals.push(approval);
    addLedger(brief, 'Decision escalated to owner', result.rationale || 'The question fell outside the meeting brief.', 'escalated', result.evidence_ids || []);
    toast('Owner approval requested', 'Mandate did not make an unapproved commitment.');
  } else if (result.action === 'speak') {
    addLedger(brief, result.response_type === 'basic' ? 'Delegate responded in meeting' : 'Position represented in meeting', result.rationale || 'Mandate shared an approved position.', 'approved', result.evidence_ids || []);
  } else if (result.action === 'decline') {
    addLedger(brief, 'Request declined', result.rationale || 'Mandate declined the request.', 'declined', result.evidence_ids || []);
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
    toast('Mandate could not speak', error.message || 'Check your browser audio settings and try again.');
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
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    toast('Microphone capture is unavailable', 'Use a modern browser with microphone permission. No browser speech fallback is enabled.');
    return;
  }
  try {
    const selectedDevice = ui.audioInputs.find((device) => device.id === ui.audioInputId);
    const virtualSource = /blackhole|loopback|virtual/i.test(selectedDevice?.label || '');
    const audio = { echoCancellation: !virtualSource, noiseSuppression: !virtualSource, autoGainControl: !virtualSource };
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
    zoomUrl: ui.mode === 'demo' ? existing?.zoomUrl || '' : String(data.get('zoomUrl') || '').trim(), zoomBridge: existing?.zoomBridge || false,
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
  const textFiles = [];
  for (const file of files) {
    let text = '';
    if (/^(text\/|application\/json|application\/csv)/.test(file.type) || /\.(txt|md|csv)$/i.test(file.name)) {
      try { text = await file.text(); } catch { text = ''; }
    }
    textFiles.push({ id: uid('SRC'), name: file.name, kind: text ? 'Uploaded text' : 'Uploaded reference', text: text || `Reference uploaded locally: ${file.name}. Paste a relevant excerpt into the brief for direct grounding.` });
  }
  ui.referenceDrafts.push(...textFiles);
  render();
  toast('References added', `${textFiles.length} reference${textFiles.length === 1 ? '' : 's'} attached to the brief.`);
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
  addTranscript(brief, { speaker: 'Mandate', initials: 'M', type: 'mandate', evidence: approval.evidence, text: outcome === 'approved' ? `${brief.owner} has reviewed this request and approved the response. I can now communicate that decision to the meeting.` : `${brief.owner} reviewed this request and declined to make that commitment. I will keep the existing position.` });
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

function zoomMeetingUrl(value) {
  const parsed = new URL(String(value || '').trim());
  if (!/^https?:$/.test(parsed.protocol) || !/(^|\.)zoom\.us$/i.test(parsed.hostname)) {
    throw new Error('Use a valid https://...zoom.us meeting link.');
  }
  return parsed.href;
}

function openZoomLink(value) {
  try {
    const url = zoomMeetingUrl(value);
    const opened = window.open(url, '_blank', 'noopener');
    if (!opened) window.location.assign(url);
    toast('Zoom link opened', 'Join manually as the named Mandate participant, then return here.');
    return true;
  } catch (error) {
    toast('Zoom link is needed', error.message);
    return false;
  }
}

function startZoomBridge(form) {
  const brief = activeBrief();
  if (!brief) return;
  let zoomUrl;
  try { zoomUrl = zoomMeetingUrl(new FormData(form).get('zoomUrl')); }
  catch (error) { toast('Zoom link is needed', error.message); return; }
  brief.zoomUrl = zoomUrl;
  brief.zoomBridge = true;
  brief.status = 'Live';
  addTranscript(brief, {
    speaker: 'Mandate', initials: 'M', type: 'mandate', evidence: [],
    text: `I’m Mandate, representing ${brief.owner}. I’m ready to discuss this meeting brief.`
  });
  ui.modal = null;
  persist();
  render();
  toast('Zoom audio bridge started', 'Start listening, then address “Delegate” when asking a question.');
}

function startDemoSession() {
  const brief = activeBrief();
  if (!brief) return;
  const wasLive = brief.status === 'Live';
  brief.status = 'Live';
  brief.zoomBridge = false;
  if (!wasLive) {
    addTranscript(brief, {
      speaker: 'Mandate', initials: 'M', type: 'mandate', evidence: [],
      text: `I’m Mandate, representing ${brief.owner}. Ask me anything about this meeting brief.`
    });
  }
  persist();
  render();
  toast('Demo session started', 'Ask a question below or use your browser microphone.');
}

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]'); if (!target) return;
  const action = target.dataset.action;
  if (action !== 'toggle-brief-menu') ui.briefMenuId = null;
  if (action === 'choose-demo') { setMode('demo'); ui.view = 'briefs'; ui.modal = 'new-brief'; ui.editingBriefId = null; ui.pendingSources = []; ui.referenceDrafts = []; ui.briefDraft = null; render(); }
  if (action === 'choose-full') { setMode('full'); ui.view = 'overview'; ui.modal = null; render(); }
  if (action === 'show-landing') { stopMic(); ui.mode = null; localStorage.removeItem(MODE_KEY); ui.modal = null; render(); }
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
  if (action === 'open-live') { ui.activeBriefId = target.dataset.id; ui.view = 'live'; render(); }
  if (action === 'start-live') { ui.modal = 'zoom-bridge'; render(); }
  if (action === 'start-demo-session') startDemoSession();
  if (action === 'end-live') { const brief = activeBrief(); brief.status = 'Ready'; brief.zoomBridge = false; stopMic(); persist(); render(); toast(ui.mode === 'demo' ? 'Demo session ended' : 'Delegate session ended', 'The commitment ledger remains available.'); }
  if (action === 'open-zoom-session') openZoomLink(activeBrief()?.zoomUrl);
  if (action === 'open-zoom-link') openZoomLink(document.getElementById('zoom-link-input')?.value);
  if (action === 'bridge-voice-test') speak(`Mandate voice check. I’m representing ${activeBrief()?.owner || 'the meeting owner'}.`);
  if (action === 'copy-zoom-name') {
    if (!navigator.clipboard) toast('Copy unavailable', `Use this name: ${target.dataset.name || ''}`);
    else navigator.clipboard.writeText(target.dataset.name || '').then(
      () => toast('Participant name copied', 'Paste it into Zoom’s display-name field.'),
      () => toast('Copy unavailable', `Use this name: ${target.dataset.name || ''}`)
    );
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
  if (action === 'toggle-mic') { if (ui.mediaRecorder) stopMic(); else startMic(); }
  if (action === 'approve-escalation') { ui.modal = 'approval'; ui.approvalId = target.dataset.id; render(); }
  if (action === 'resolve-approval') resolveApproval(target.dataset.outcome);
  if (action === 'export-ledger') exportLedger();
  if (action === 'check-health') healthCheck();
  if (action === 'reset-workspace') { if (confirm('Clear every local Mandate brief, transcript, approval, and ledger entry?')) { state = seedState(); ui.activeBriefId = null; ui.modal = null; persist(); render(); toast('Workspace cleared', 'Your local Mandate data has been removed.'); } }
});

document.addEventListener('submit', (event) => {
  if (event.target.id === 'brief-form') { event.preventDefault(); saveBrief(event.target); }
  if (event.target.id === 'zoom-bridge-form') { event.preventDefault(); startZoomBridge(event.target); }
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
    toast('Listening source saved', 'Start listening to use the selected source.');
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
