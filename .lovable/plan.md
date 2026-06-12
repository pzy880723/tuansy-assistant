## 目标
把编辑页面里那个会跳到 `/settings` 新页签的齿轮按钮，改成原地弹出的弹窗，弹窗里直接编辑「文案逻辑」并自动保存。

## 现状
- `src/routes/app.project.$id.tsx` 第 441-449 行的 `<Link to="/settings" target="_blank">` 跳新页。
- `src/routes/settings.tsx` 里 `CopyLogicSection` + `LogicEditor` 已经实现了完整编辑能力，并且 `LogicEditor` 内部已经基于 800ms debounce 的 `queueSave` 做了自动保存。

## 改动
1. **抽出共享组件**：把 `settings.tsx` 中的 `CopyLogicSection`（及它依赖的 `LogicEditor`、`BlankLinesField`、`MODULE_TYPE_LABEL`、`MODULE_TYPE_COLOR`、`rid`）整体迁到 `src/components/copy-logic/CopyLogicSection.tsx`，导出 `CopyLogicSection`。`settings.tsx` 改为引用这个组件，行为不变。
   - 不动 `PresetSection`（弹窗里只放「我的文案逻辑」，不放模版库，避免空间被占满）。
2. **编辑页弹窗**：在 `src/routes/app.project.$id.tsx` 把那个齿轮按钮换成 `Dialog` 触发器：
   - `DialogContent` 用大尺寸（`max-w-5xl w-[min(960px,95vw)] p-0`），里头放 `<CopyLogicSection />`。
   - 标题写「文案逻辑」，附一句说明「修改后会自动保存并即时生效」。
   - 弹窗关闭时调用 `qc.invalidateQueries({ queryKey: ["copy-logics"] })`（其实组件内部保存时已经在 invalidate；保险起见再触发一次），让顶部那个 `Select` 的选项立即刷新。
3. 删掉 `target="_blank"`/`rel` 的跳转逻辑（保留齿轮 icon 作为触发按钮即可）。无路由级改动，`/settings` 页面行为完全保留。

## 不在范围
- 不改 `LogicEditor` 自身的保存机制（已经是 debounce 自动保存）。
- 不改 `PresetSection`、不改 `chat.ts` 提示词、不改其他无关 UI。
