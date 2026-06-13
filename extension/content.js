// Floating helper + message handler on KTT pages.
(function () {
  if (window.__tbInjected) return;
  window.__tbInjected = true;

  // Floating button
  const btn = document.createElement("div");
  btn.id = "tb-fab";
  btn.innerHTML = `
    <div style="
      position:fixed; right:18px; bottom:18px; z-index:2147483647;
      background:#fb923c; color:white; border-radius:99px;
      box-shadow:0 8px 24px rgba(251,146,60,.4);
      padding:10px 14px; font: 600 13px/1 -apple-system, 'PingFang SC', sans-serif;
      cursor:pointer; user-select:none;">
      🐻 团宝助手
    </div>`;
  document.documentElement.appendChild(btn);
  btn.onclick = async () => {
    const { lastPayload } = await chrome.storage.local.get(["lastPayload"]);
    if (!lastPayload) {
      alert("请先在插件弹窗里拉取项目数据");
      return;
    }
    const res = await fillAll(lastPayload);
    alert(res.ok ? "已填入: " + res.steps.join("、") : "填入失败: " + res.error);
  };

  chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
    if (msg?.type === "fill") {
      fillAll(msg.payload).then(sendResponse);
      return true;
    }
  });

  async function fillAll(payload) {
    const steps = [];
    try {
      // 1) Title
      const titleEl = TB.SEL.titleInput();
      const title = payload.project?.name || payload.product?.name;
      if (titleEl && title) {
        TB.setNativeValue(titleEl, title);
        steps.push("标题");
      }

      // 2) Intro rich text — fill first editor with all blocks plain text
      const intro = payload.intro;
      if (intro?.blocks?.length) {
        const editors = TB.SEL.introEditors();
        if (editors.length) {
          const html = intro.blocks
            .map((b) => {
              if (b.type === "image" && b.url) {
                return `<p><img src="${b.url}" style="max-width:100%"/></p>`;
              }
              const t = (b.text || b.content || "").replace(/\n/g, "<br/>");
              return `<p>${escapeHtml(t)}</p>`;
            })
            .join("");
          TB.setContentEditable(editors[0], html);
          steps.push("介绍");
        }
      }

      // 3) Product basics
      const pname = TB.SEL.productNameInput();
      if (pname && payload.product?.name) {
        TB.setNativeValue(pname, payload.product.name);
        steps.push("商品名");
      }

      const sku = (payload.skus || [])[0];
      if (sku) {
        const priceEl = TB.SEL.priceInput();
        if (priceEl && sku.price != null) {
          TB.setNativeValue(priceEl, String(sku.price));
          steps.push("价格");
        }
        const stockEl = TB.SEL.stockInput();
        if (stockEl && sku.stock != null) {
          TB.setNativeValue(stockEl, String(sku.stock));
          steps.push("库存");
        }
      }

      // 4) Settings
      const startEl = TB.SEL.startTimeInput();
      if (startEl && payload.schedule?.start_at) {
        TB.setNativeValue(startEl, fmtTime(payload.schedule.start_at));
        steps.push("开始时间");
      }
      const endEl = TB.SEL.endTimeInput();
      if (endEl && payload.schedule?.end_at) {
        TB.setNativeValue(endEl, fmtTime(payload.schedule.end_at));
        steps.push("结束时间");
      }

      // 5) Images — try to upload to first file input
      const images = payload.images || [];
      if (images.length) {
        const inputs = TB.SEL.introFileInputs();
        if (inputs.length) {
          try {
            const files = [];
            for (const img of images.slice(0, 9)) {
              const url = typeof img === "string" ? img : img.url;
              if (url) files.push(await TB.fetchFile(url));
            }
            if (files.length) {
              TB.dispatchFiles(inputs[0], files);
              steps.push(`图片×${files.length}`);
            }
          } catch (e) {
            console.warn("[团宝] 图片上传失败", e);
          }
        }
      }

      return { ok: true, steps };
    } catch (e) {
      console.error("[团宝] 填入失败", e);
      return { ok: false, error: String(e?.message || e), steps };
    }
  }

  function fmtTime(iso) {
    try {
      const d = new Date(iso);
      const p = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    } catch {
      return iso;
    }
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }
})();
