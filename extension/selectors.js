// Selectors for KTT (快团团) PC backend. Placeholder-based + text fallback.
// Update here when KTT changes its DOM.
window.TB = window.TB || {};

TB.SEL = {
  // 团购介绍 tab block editor
  introTab: () => TB.findByText("div,span", "团购介绍"),
  addTextBtn: () => TB.findByText("button,div,span", "添加文字") || TB.findByText("button,div,span", "文字"),
  addBigImageBtn: () =>
    TB.findByText("button,div,span", "添加大图") || TB.findByText("button,div,span", "图片"),
  introEditors: () =>
    document.querySelectorAll(".ql-editor, [contenteditable='true']"),
  introFileInputs: () =>
    document.querySelectorAll("input[type=file][accept*=image]"),

  // 团购设置 tab
  settingsTab: () => TB.findByText("div,span", "团购设置"),
  titleInput: () =>
    document.querySelector(
      "input[placeholder*='活动标题'], input[placeholder*='团购标题'], input[placeholder*='标题']"
    ),
  startTimeInput: () =>
    document.querySelector("input[placeholder*='开始时间'], input[placeholder*='开团时间']"),
  endTimeInput: () =>
    document.querySelector("input[placeholder*='结束时间'], input[placeholder*='截团时间']"),

  // 团购商品 tab
  productTab: () => TB.findByText("div,span", "团购商品"),
  productNameInput: () =>
    document.querySelector("input[placeholder*='商品名称'], input[placeholder*='商品标题']"),
  priceInput: () =>
    document.querySelector("input[placeholder*='价格'], input[placeholder*='售价']"),
  stockInput: () =>
    document.querySelector("input[placeholder*='库存']"),
};
