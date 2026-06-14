const KTT_CREATE_URL = "https://ktt.pinduoduo.com/groups/create";
const KTT_MATCH = /^https:\/\/(ktt\.pinduoduo\.com|[^/]+\.kuaituantuan\.com)\/groups\//;

async function fetchPayload(origin, token) {
  const url = `${origin}/api/public/export-project?token=${encodeURIComponent(token)}`;
  const r = await fetch(url, { method: "GET" });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return await r.json();
}

async function findOrOpenKttTab() {
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find((t) => t.url && KTT_MATCH.test(t.url));
  if (existing) {
    await chrome.tabs.update(existing.id, { active: true });
    if (existing.windowId != null) {
      try { await chrome.windows.update(existing.windowId, { focused: true }); } catch {}
    }
    return existing;
  }
  return await chrome.tabs.create({ url: KTT_CREATE_URL, active: true });
}

function waitForTabComplete(tabId, timeout = 30000) {
  return new Promise((resolve) => {
    const done = () => {
      chrome.tabs.onUpdated.removeListener(listener);
      clearTimeout(t);
      resolve();
    };
    const listener = (id, info) => {
      if (id === tabId && info.status === "complete") done();
    };
    chrome.tabs.get(tabId, (tab) => {
      if (tab && tab.status === "complete") return done();
      chrome.tabs.onUpdated.addListener(listener);
    });
    const t = setTimeout(done, timeout);
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "fetchPayload") {
    (async () => {
      try {
        const data = await fetchPayload(msg.origin, msg.token);
        sendResponse({ ok: true, data });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }

  if (msg?.type === "fetchImage") {
    (async () => {
      try {
        const r = await fetch(msg.url);
        if (!r.ok) throw new Error("HTTP " + r.status);
        const blob = await r.blob();
        const buf = await blob.arrayBuffer();
        sendResponse({
          ok: true,
          bytes: Array.from(new Uint8Array(buf)),
          mime: blob.type || "image/jpeg",
        });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }

  if (msg?.type === "syncToKtt") {
    (async () => {
      try {
        const data = await fetchPayload(msg.origin, msg.token);
        await chrome.storage.local.set({
          lastPayload: data,
          lastInput: `${msg.origin}/api/public/export-project?token=${msg.token}`,
          autoFillPending: true,
          autoFillAt: Date.now(),
        });
        const tab = await findOrOpenKttTab();
        // Give the tab a moment to load, then poke content.js. content.js
        // also self-triggers when it sees autoFillPending — this is just a nudge.
        waitForTabComplete(tab.id).then(() => {
          setTimeout(() => {
            chrome.tabs.sendMessage(tab.id, { type: "fill", payload: data }).catch(() => {});
          }, 1200);
        });
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }
});
