const sessionId = new URLSearchParams(location.search).get('session_id');
const browserSessionId = new URLSearchParams(location.search).get('browser_session_id');
const browserFrame = document.getElementById('browser-frame');

let browserFrameUrl = '';

async function syncLiveBrowser() {
  if (!sessionId || !browserSessionId || !browserFrame) return;
  const response = await fetch(`/api/meetings/${encodeURIComponent(sessionId)}/screen-state`, { cache: 'no-store' });
  if (!response.ok) throw new Error('The shared browser is no longer available.');
  const state = await response.json();
  if (!state.liveViewUrl) throw new Error('The shared browser has not finished starting.');

  // A Browserbase Live View follows navigation, clicks, and scrolling within a
  // tab by itself. Replace the iframe only when Stagehand intentionally moves
  // to a new tab, so Zoom always shows the active browser without a flicker on
  // every browser action.
  if (browserFrameUrl !== state.liveViewUrl) {
    browserFrame.src = state.liveViewUrl;
    browserFrameUrl = state.liveViewUrl;
  }
}

function scheduleSync(delay = 1000) {
  window.setTimeout(() => {
    void syncLiveBrowser().catch(() => {}).finally(() => scheduleSync());
  }, delay);
}

void syncLiveBrowser().catch(() => {}).finally(() => scheduleSync(350));
