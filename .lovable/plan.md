## 问题判断

现在公开页 `/g/$slug` 里已经做了 `\\n` → 真换行的转换，但截图显示问题发生在项目编辑器右侧的文字块预览中。

这里的逻辑性问题是：

- `src/routes/g.$slug.tsx` 只修了买家公开页，不影响编辑器。
- `src/components/tuan/IntroTab.tsx` 的文字块仍直接渲染 `block.text`。
- 如果 AI 写入的是字面量 `\\n`（两个字符：反斜杠+n），CSS 的 `whitespace-pre-wrap` 不会把它当换行。
- 文字块编辑框也直接拿 `block.text`，所以编辑和预览都会继续看到 `\\n`。

## 修改计划

### 1. 在 `IntroTab.tsx` 增加统一文本规范化函数

在文件顶部添加一个小工具函数：

```ts
function normalizeTextNewlines(text: string) {
  return text
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "")
    .replace(/\n{3,}/g, "\n\n");
}
```

作用：把 AI 生成的字面量 `\\n` 转成真实换行，同时保留段落空行。

### 2. 修复编辑器右侧文字块预览

把 `BlockCard` 非编辑状态下的：

```tsx
{block.text || ...}
```

改成渲染：

```tsx
{normalizeTextNewlines(block.text) || ...}
```

这样截图中右侧文字块会按段落换行显示。

### 3. 修复拖拽浮层/缩略预览

`BlockGhost` 里也使用同一个转换函数，避免拖拽时又显示 `\\n`。

### 4. 修复编辑状态下的文本框

编辑文字块时传给 `AutoTextarea` 的 `value` 也用转换后的文本，用户点进去编辑时看到的就是正常换行，不再是一串 `\\n`。

保存时仍按真实换行写回项目数据。

### 5. 不改公开页和数据库结构

- 不动 `/g/$slug` 的公开页逻辑。
- 不动后端表结构。
- 不动下单、SKU、发布团购逻辑。

## 预期结果

编辑器右侧文字块、点击编辑状态、拖拽预览都会把 `\\n` 正确显示为换行；之后发布出去的公开页也会继续正常换行。