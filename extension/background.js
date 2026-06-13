chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "fetchPayload") {
    (async () => {
      try {
        const url = `${msg.origin}/api/public/export-project?token=${encodeURIComponent(msg.token)}`;
        const r = await fetch(url, { method: "GET" });
        if (!r.ok) throw new Error("HTTP " + r.status);
        const data = await r.json();
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
});
