// Bridge between Tuanbao web app and the extension.
// Injected only on Tuanbao origins (see manifest content_scripts).
(function () {
  if (window.__tbBridgeInjected) return;
  window.__tbBridgeInjected = true;

  const VERSION = chrome.runtime.getManifest().version;
  // DOM marker so the page can detect install synchronously.
  document.documentElement.setAttribute("data-tb-installed", VERSION);

  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data) return;
    const { type } = e.data;
    if (type === "TB_PING") {
      window.postMessage({ type: "TB_PONG", version: VERSION }, "*");
      return;
    }
    if (type === "TB_SYNC" && e.data.token && e.data.origin) {
      chrome.runtime
        .sendMessage({
          type: "syncToKtt",
          token: e.data.token,
          origin: e.data.origin,
          projectName: e.data.projectName || "",
        })
        .then((res) => {
          window.postMessage(
            { type: "TB_SYNC_ACK", ok: !!res?.ok, error: res?.error || null },
            "*",
          );
        })
        .catch((err) => {
          window.postMessage(
            { type: "TB_SYNC_ACK", ok: false, error: String(err?.message || err) },
            "*",
          );
        });
    }
  });
})();
