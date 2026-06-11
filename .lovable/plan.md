## 目标

把 `/app`（我的项目页）从「点新建按钮 → 弹窗填表 → 进编辑器」的传统结构，改成像 lovable.dev/dashboard 那样：**页面正上方一个大的"一句话开团"输入框，下方陈列已有项目卡片**。删除"新建项目"按钮和弹窗，新建动作完全由顶部那个 prompt 输入框承担（拖图、粘贴图、计划模式、立即开团），和首页 Hero 里的 `HeroStarter` 一致的体验。

## 改动

### 1. 抽出共享组件 `src/components/project-starter.tsx`

- 把 `src/routes/index.tsx` 里 `HeroStarter` 和 `PlanModeChip` 抽出为独立组件 `ProjectStarter`。
- 接受 `variant: "dark" | "light"` 控制配色：`dark` 给首页 Hero（保持现有深色玻璃质感），`light` 给 `/app`（贴合白底工作台）。
- 内部逻辑（调用 `startProject`、`useImageAttachments`、登录守卫、跳转 `/app/project/$id`、写入 seedMessages / autoUserPrompt 到 localStorage）保持不变。
- 暴露一个 `placeholder` prop，让 `/app` 用更聚焦的提示语（"想开一场什么团？写一句话，或拖几张商品图过来"）。

### 2. `src/routes/index.tsx`

- 删除内联的 `HeroStarter` 和 `PlanModeChip`。
- 改为 `<ProjectStarter variant="dark" />`，其它 Hero 文案、产品 mockup、Features 等保持不动。

### 3. `src/routes/app.index.tsx` 重做布局

新结构（从上到下）：

```text
[页面标题区]
  我的项目
  每个项目对应一场快团团团购。

[ProjectStarter variant="light" 输入框 — 占据视觉重心]
  textarea + 加图片 / 计划模式 / 快速开团

[下方分隔：]
  最近项目  |   共 N 个

[项目卡片网格] —— 复用现有 ProjectCard / SkeletonGrid / EmptyState
```

具体改动：
- 移除右上角"+ 新建项目"按钮；移除 `ProjectMetaDialog`、`createProject` 导入和 `createMut`、`dialog` 状态。
- 空状态 `EmptyState` 简化：移除内部的"创建第一个项目"按钮，改为一句引导文字（"上面写一句话就能开第一场团"），因为新建入口已经在页面顶部了。
- 保留 `ProjectCard` 的"编辑信息 / 删除"下拉菜单（这是对已存在项目的操作，不冲突）。
- 保留 `updateProjectMeta`、`deleteProject`、`listProjects` 调用；只删 `createProject`。
- 保留登录失效时的 `SessionIssue` 处理。

### 4. 不动的东西

- `startProject` / `createProject` 等 server functions：`createProject` 暂时不删（其它地方可能引用，且无害），只是 UI 不再调用。
- `app.project.$id.tsx` 编辑器页：完全不动。
- 数据库 schema、认证、路由树：不动。

## 不在范围内

- 不重做项目卡片样式。
- 不动首页 Hero 的整体设计，仅把 Starter 组件抽出复用。
- 不改 `startProject` 的 AI prompt / 输出 schema。
