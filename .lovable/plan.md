
# 把右侧预览改造成 1:1 高保真快团团编辑界面

目标：右侧预览完全按你给的真机截图重做（介绍 / 商品 / 设置 三个 Tab，含真机顶部 bar、底部「保存并预览」「发布团购」绿色按钮），所有字段就地点击直接编辑，左侧 AI 也能改。

## 视觉框架（PhoneFrame 重做）

- 不再做"深色刘海手机壳"，改成贴近截图的浅灰圆角微信小程序外壳：
  - 顶部：`< 返回` 圆形按钮 + 右上角 `··· — ◯` 胶囊
  - 底部固定栏：左白底绿字「保存并预览」、右大绿色按钮「发布团购」
  - 中间内容区滑动，背景 `#F4F5F7`，卡片 `#FFFFFF` + 16px 圆角
- Tab 切换从胶囊改成截图同款：`介绍 / 商品 / 设置`，激活项绿色文字 + 下方短绿色下划线
- 主色统一为快团团绿 `oklch(0.72 0.17 152)`（≈ #07C160 系），全部硬编码红橙色全部清掉

## 介绍 Tab（IntroMock）

按截图 1、2 完全重做：

1. **顶部团长卡片**（含背景图位）
   - 背景图占位（"设置背景图"按钮在右上）
   - 左下：头像方块 + 团长名行内可编辑 + 省略
2. **团购介绍卡片**
   - 标题行：`团购介绍` + 右上「素材导入」「复制已有团购」描边按钮
   - 标题输入框：`请输入团购活动标题`
   - 内容输入框：`请输入团购活动内容`（多行）
   - 下方工具栏：`大图 / 小图 / 视频 / 文字 / 标签 / 加粉 / 承诺` 7 个图标按钮（lucide 图标 + 中文标签，2 行排列）
3. **介绍内容块列表**（来自 `project.intro.blocks`）
   - 每个 block 卡片右上有「上移 / 下移 / 置顶 / 添加 / 删除」5 个小描边按钮
   - block.type 支持：`text` / `image_lg` / `image_sm` / `video` / `tag`
   - 行内编辑文字 / 上传位
4. **团购商品**入口卡片（标题 + ⇆ 切换旧版 + 素材导入 + 从商品库导入 + 搜索框 + `+ 添加商品` 大按钮）

## 商品 Tab（ProductMock）

按截图 4 重做：

- 商品卡片：左 100×100 图（带「剩 N 件」黑色蒙层）+ 右标题（可改）+ ✏ 编辑按钮 + 红色 ¥价格 + 灰色规格描述
- 右上「添加 / 删除」两个小描边按钮
- 卡片下方 `+ 添加商品` 大描边绿按钮
- 下方折叠一个简版「团购设置」卡片（物流方式 / 发货时间 / 团购时间 / 开团通知推送 / 更多团购设置 ›），点击行可改

字段映射：现有 `projects.skus[]` 数组（name/price/stock）→ 每个 SKU 渲染成一张商品卡片（多商品支持），完整 CRUD。

## 设置 Tab（SettingsMock）

按截图 3、5、6、7 分成 5 个分组卡片：

1. **团购设置**：物流方式 / 发货时间 / 团购时间 / 开团通知推送 / 更多团购设置（展开）
2. **帮卖设置**：4 行
3. **优惠设置**：4 行（团首单优惠 / 团满减优惠 / 多件多折 / 团惊喜红包，带「设置加曝光」小红 chip）
4. **营销设置**：5 行
5. **隐私设置**：3 行
6. **其他设置**：8 行

每行：左灰底标题，右浅灰当前值 + `›` 箭头。点击行 → 弹出底部 Sheet（用 shadcn `Sheet` from bottom）做行内编辑（输入 / 选择 / 开关），保存写回 `project.delivery / schedule / settings`（新增 jsonb 字段 `settings`）。

## 编辑落库

所有行内修改 → 复用现有 `updateProject` server fn，debounce 600ms 自动保存（沿用现有 `updateMut` 模式），存到对应 jsonb 字段：

- 介绍标题/正文 → `intro.title` / `intro.blocks`
- 商品卡片 → `skus[]`
- 设置项 → `delivery` / `schedule` / 新增 `settings` jsonb

AI 工具（已有 `update_product` / `update_skus`）扩展：再加 `update_intro` 和 `update_settings` 两个 tool，让左侧自然语言也能改这两块。

## 数据库

需要给 `projects` 表加一个 `settings` jsonb 字段，默认 `{}`（一条 migration，含 GRANT 重申）。其他字段已存在不动。

## 技术细节

- 文件改动：
  - 重写 `src/routes/app.project.$id.tsx` 里的 `PreviewPane / PhoneFrame / IntroMock / ProductMock / SettingsMock`
  - 抽出 `src/components/tuan/*`：`PhoneShell.tsx`、`IntroTab.tsx`、`ProductTab.tsx`、`SettingsTab.tsx`、`SettingRow.tsx`、`SettingSheet.tsx`、`BlockToolbar.tsx`
  - 扩 `src/routes/api/chat.ts` 工具集：加 `update_intro` / `update_settings`
- 新依赖：无（用现有 shadcn `Sheet` `Dialog` `Input` `Textarea` `Switch`；已安装）
- 不动：首页、项目列表、AI 对话 UI 框架、其他路由

## 不做的事

- 不做真正的图片上传后端（"设置背景图 / 大图 / 视频" 先用占位 + toast「即将上线」）
- 不做拼团、抽奖、阶梯价等高级营销玩法的真实逻辑（只做设置项 UI + 落库存值）
- 不加用户登录
