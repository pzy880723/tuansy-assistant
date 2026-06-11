## 团购介绍模块改造

### 1. 工具栏精简（IntroTab.tsx）
- 移除 `标签 / 加粉 / 承诺` 三个入口，`BLOCK_TOOLS` 只保留 `大图 / 小图 / 视频 / 文字` 四项；网格从 `grid-cols-5` 改为 `grid-cols-4`。
- 同步移除 `tag` 相关类型与渲染：`types.ts` 的 `IntroBlock` 删除 `tag` 分支，IntroTab 删除 `TagBlockEditor` 及其引用，`BlockLabel` 的 `map` 删除 `tag`。

### 2. 工具栏永远在最末（不再放在卡片内部）
- 工具栏当前位于"团购介绍"卡片底部，所有 block 渲染在另一张卡片里，中间有间隙。
- 改为：工具栏渲染在 blocks 列表的**末尾**（即"最后一个模块下面"）。把 blocks 和工具栏合并到同一张 `团购介绍` 卡片中，去掉两张卡片之间的间隔；当 blocks 为空时，工具栏直接显示在描述输入框下方。

### 3. 点击工具行为
- **大图 / 小图 / 视频**：不再先创建空 block，直接触发隐藏的 `<input type="file">`：
  - 大图：`accept="image/*"`，选中 1 张 → 创建一个 `image_lg` block，`url` 写入 `URL.createObjectURL(file)`。
  - 小图：`accept="image/*" multiple`，选中多张 → 创建一个 `image_sm` block，`urls` 数组填充。
  - 视频：`accept="video/*"`，选中 1 个 → 创建 `video` block。
  - 已有的 block 内"+ 添加大图 / + / + 添加视频"占位按钮也改为复用同一个 file picker，替换 url。
- **文字**：弹出底部 Sheet（复用 `SettingSheet` 的 multiline 模式，或新增一个轻量 dialog）输入文字，保存后插入一个 `text` block；已有 `text` block 点击后也用同一 Sheet 编辑。
- 取消"添加"按钮行为里固定追加 text block 的逻辑，改成弹出文字输入 Sheet。

### 4. 标题支持换行（团购活动标题）
- 当前 `InlineText`（单行 input）→ 改成 `multiline` 模式，`rows={1}`，并保留同样的字号/粗体样式。
- `InlineText` 已支持 multiline，textarea 默认随内容自然换行；如视觉需要可加 `auto-resize`（监听 input 调整 `style.height`），保证不会出现滚动条。

### 5. 新增"拖拽排序"
- 在每个 BlockCard 右侧操作行新增一个拖拽手柄 `MiniBtn`（图标：`GripVertical`）。
- 实现方式：使用 HTML5 原生 drag API（无新依赖）——`draggable` 绑在卡片根节点，`onDragStart` 记录 sourceId，`onDragOver` 阻止默认，`onDrop` 调用 `setBlocks` 重排到目标位置。支持拖动到任意位置（含首尾）。
- 保留 `上移 / 下移 / 置顶 / 删除`，去掉每个 block 上的"添加"按钮（添加已统一到底部工具栏）。

### 不改动
- `ProductTab / SettingsTab / PhoneShell`、数据库 schema、serverFn、路由不变。
- 文件上传仍为本地 `URL.createObjectURL` 预览（与现状一致，未来再接入存储）。

### 涉及文件
- `src/components/tuan/types.ts`
- `src/components/tuan/IntroTab.tsx`
- `src/components/tuan/primitives.tsx`（如新增文字编辑 Sheet 或 auto-resize 帮助函数）
