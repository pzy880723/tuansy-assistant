## 问题

项目列表卡片上的三张缩略图全部空白。

当前 `listProjects`（`src/lib/projects.functions.ts:185`）是从 `project_images` 表（已上传素材池）取图。但你的预期逻辑是**显示该项目「文案」里出现的前三张图**——也就是 `projects.intro.blocks` 中类型为 `image_lg` / `image_sm` 的图。

校验数据库后确认：那几个 mock 项目（巴塔Pata、暴瘦预警、CK 纯棉…）的 `project_images` 是空的，所以卡片全是占位图标，看起来"完全没图"。

## 改动

只改一个文件：`src/lib/projects.functions.ts` 里的 `listProjects`。

1. 在 `select` 字段里加上 `intro`。
2. 写一个 `pickFirstImagesFromIntro(intro, n=3)` 工具：按 `blocks` 顺序遍历，遇到 `image_lg.url` 收 1 张，遇到 `image_sm.urls[]` 按数组顺序收，遇到非空 URL 才计入，凑满 3 张就停。
3. 返回 `images` 字段时优先用 intro 抽出来的图；若 intro 一张都没有，回退到 `project_images` 表的前 3 张（保留原行为做兼容），仍不够再回退到 `cover_image_url`。

不动 UI（`src/routes/app.index.tsx` 的 `ProjectCard` 已经按 `project.images[0..2]` 渲染，逻辑正确）。

## 关于 mock 项目

那 4 个种子项目目前 `intro.blocks` 也是空的，所以即使改完逻辑，它们还是没图。两种处理方式，请你选一种：

- **A 只修逻辑**：以后用户在文案里加图、保存后，卡片就会自动显示。mock 项目继续空着，等真实创建。
- **B 修逻辑 + 给 mock 项目补图**：用现有 AI 配图或占位图给那 4 个 mock 项目的 intro 塞 3 张图，立即看到效果。

默认走 A（最小改动、不污染数据）。如果要 B 请告诉我，我加一个一次性 migration。
