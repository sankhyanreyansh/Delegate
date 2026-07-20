const sessionId = new URLSearchParams(location.search).get('session_id');
const browserSessionId = new URLSearchParams(location.search).get('browser_session_id');
const browserFrame = document.getElementById('browser-frame');

let loaded = false;

async function loadLiveBrowser() {
  if (loaded) return;
  if (!sessionId || !browserSessionId || !browserFrame) return;
  const response = await fetch(`/api/meetings/${encodeURIComponent(sessionId)}/screen-state`, { cache: 'no-store' });
  if (!response.ok) throw new Error('The shared browser is no longer available.');
  const state = await response.json();
  if (!state.liveViewUrl) throw new Error('The shared browser has not finished starting.');

  // Load the Browserbase stream exactly once. Its session-level Live View
  // follows navigation and scroll in real time; polling/replacing the iframe
  // here causes Zoom to capture a stale loading state instead of the browser.
  browserFrame.src = state.liveViewUrl;
  loaded = true;
}

function retryUntilLoaded() {
  void loadLiveBrowser().catch(() => {
    // The page streamer can reach this page a fraction of a second before its
    // session snapshot is available. Retry the data request only—never replace
    // a running iframe with a loading/status screen.
    window.setTimeout(retryUntilLoaded, 400);
  });
}

retryUntilLoaded();
