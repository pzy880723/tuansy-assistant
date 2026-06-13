const $ = (id) => document.getElementById(id);
const statusEl = $("status");

function setStatus(msg, type) {
  statusEl.style.display = "block";
  statusEl.className = "status" + (type ? " " + type : "");
  statusEl.textContent = msg;
}

function extractToken(text) {
  text = (text || "").trim();
  if (!text) return null;
  try {
    const u = new URL(text);
    return u.searchParams.get("token") || text;
  } catch {
    return text;
  }
}

function extractOrigin(text) {
  try {
    const u = new URL((text || "").trim());
    return u.origin;
  } catch {
    return null;
  }
}

async function load() {
  const { lastInput, lastPayload } = await chrome.storage.local.get(["lastInput", "lastPayload"]);
  if (lastInput) $("input").value = lastInput;
  if (lastPayload) showProject(lastPayload);
}
load();

$("clearBtn").onclick = async () => {
  $("input").value = "";
  $("project").style.display = "none";
  statusEl.style.display = "none";
  await chrome.storage.local.remove(["lastInput", "lastPayload"]);
};

$("fetchBtn").onclick = async () => {
  const raw = $("input").value;
  const token = extractToken(raw);
  if (!token) return setStatus("请粘贴链接或 Token", "err");
  const origin = extractOrigin(raw) || "https://tuansy-assistant.lovable.app";
  setStatus("拉取中…");
  try {
    const res = await chrome.runtime.sendMessage({ type: "fetchPayload", origin, token });
    if (!res?.ok) throw new Error(res?.error || "拉取失败");
    await chrome.storage.local.set({ lastInput: raw, lastPayload: res.data });
    showProject(res.data);
    setStatus("拉取成功", "ok");
  } catch (e) {
    setStatus("拉取失败: " + e.message, "err");
  }
};

function showProject(p) {
  $("project").style.display = "block";
  $("projectMeta").textContent =
    `项目: ${p.project?.name || "(无名)"}\n` +
    `商品: ${p.product?.name || "(无)"}\n` +
    `SKU: ${(p.skus || []).length} 个 · 图片: ${(p.images || []).length} 张`;
}

$("fillBtn").onclick = async () => {
  const { lastPayload } = await chrome.storage.local.get(["lastPayload"]);
  if (!lastPayload) return setStatus("请先拉取项目", "err");
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return setStatus("没有活动标签页", "err");
  const url = tab.url || "";
  if (!/ktt\.pinduoduo\.com|kuaituantuan\.com/.test(url)) {
    return setStatus("请先在快团团后台打开新建/编辑团购页", "err");
  }
  setStatus("正在填入…");
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: "fill", payload: lastPayload });
    if (!res?.ok) throw new Error(res?.error || "填入失败");
    setStatus("已填入: " + (res.steps || []).join("、"), "ok");
  } catch (e) {
    setStatus("填入失败: " + e.message + "\n（确认页面已完全加载，或点击页面右下角"快速填入"按钮重试）", "err");
  }
};
