// Native value setters to bypass React/Vue controlled-input wrappers.
window.TB = window.TB || {};

TB.sleep = (ms) => new Promise((r) => setTimeout(r, ms));

TB.waitFor = async (fn, { timeout = 4000, interval = 100 } = {}) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try { const v = fn(); if (v) return v; } catch {}
    await TB.sleep(interval);
  }
  return null;
};

TB.setNativeValue = (el, value) => {
  if (!el) return false;
  const tag = el.tagName;
  const proto =
    tag === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter ? setter.call(el, value) : (el.value = value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
};

TB.setContentEditable = (el, html) => {
  if (!el) return false;
  el.focus();
  el.innerHTML = html;
  el.dispatchEvent(new InputEvent("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
};

TB.findByText = (selector, text) => {
  const list = [...document.querySelectorAll(selector)];
  return list.find((n) => (n.textContent || "").trim().includes(text)) || null;
};

TB.fetchFile = async (url) => {
  const res = await chrome.runtime.sendMessage({ type: "fetchImage", url });
  if (!res?.ok) throw new Error(res?.error || "下载图片失败");
  const arr = new Uint8Array(res.bytes);
  const name = (url.split("/").pop() || "image.jpg").split("?")[0];
  return new File([arr], name, { type: res.mime || "image/jpeg" });
};

TB.dispatchFiles = (input, files) => {
  const dt = new DataTransfer();
  files.forEach((f) => dt.items.add(f));
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
};
