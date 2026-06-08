## 目标
首页 Banner 新增「开团对话框」，作为发起项目的入口。用户把产品相关的任意文字/图片丢进来，AI 智能判断品类、生成项目标题、落库、跳转编辑页自动开场。新增「计划模式」：AI 先反问澄清，再撰写。

## 首页 Hero「开团对话框」

替换现有 CTA 区，新组件 `HeroStarter`：

- 标题（替换原 H1 文案）：
  - 主标：**开一场新团，从一句话开始**
  - 副标：把任意与产品相关的文字或图片丢给我，我帮你想清楚、写明白。

- 对话框（带毛玻璃外壳）：
  - 顶部双 Tab：「立即开团」/「计划模式」
    - 立即开团 hint：直接生成标题、SKU、文案草稿
    - 计划模式 hint：先聊清楚再动笔，适合还在选品阶段
  - 多行 textarea，占位文案：
    > 你想开一场什么团？把产品名、卖点、价格档位、产地，或者任何你手上有的资料贴进来，图片也可以一起拖进来。
  - 左下：📎 上传图片按钮（多图）
  - 右下：「开始开团 →」主按钮（橙色发光）
  - 输入框下方一行小字：AI 会自动识别品类，生成项目并跳转到工作台

- 旁路入口（弱化）：「不急，先逛逛工作台 →」纯文字链接

## 提交流程

1. 用户输入文字（可选附图）→ 选择模式 → 点击「开始开团」
2. 客户端先把图片（若有）上传到 `product-images` bucket，拿到 URL 列表
3. 调用新 server fn `startProject({ description, imageUrls, mode })`
4. 服务端用 Lovable AI（`google/gemini-3-flash-preview`，`generateText` + `Output.object`）一次性产出：
   ```ts
   {
     category: '水果生鲜' | '零食烘焙' | '家居日用' | '美妆个护' | '服饰鞋包' | '母婴儿童' | '其他',
     projectName: string,        // ≤ 18 字，吸睛
     productName: string,
     tags: string[],             // 2-4 个卖点/服务标签
     seedAssistantText: string,  // 编辑页首条 AI 开场消息
     autoUserPrompt: string|null,// 立即模式：自动触发撰写的隐形指令；计划模式：null
     suggestNext: string[]       // 2-4 条快捷追问
   }
   ```
   - 立即模式 `seedAssistantText` 示例：「明白，这是一场**云南阳光玫瑰**的水果团。我先按产地直发的思路把标题、卖点和首版 SKU 拉一版给你，看完再让我调。」
   - 计划模式 `seedAssistantText` 示例：「开始撰写前，我想先确认 4 件事：一、目标人群是熟客回购还是新客拉新？二、价格档位…」
5. 服务端写入 `projects` 表：
   - `name = projectName`
   - `product = { name: productName, category: [category], tags, description: 用户原文, ... }`
   - 写入 `project_images`（若有图）
6. 返回 `{ id, seedMessages: UIMessage[], autoUserPrompt }` 给客户端
7. 客户端：
   ```ts
   localStorage.setItem(`tuanbao.chat.${id}`, JSON.stringify(seedMessages));
   if (autoUserPrompt) sessionStorage.setItem(`tuanbao.boot.${id}`, autoUserPrompt);
   navigate({ to: '/app/project/$id', params: { id } });
   ```

## 编辑页接管

修改 `src/routes/app.project.$id.tsx` 的 ChatPane：
- 挂载后 useEffect 检查 `sessionStorage[tuanbao.boot.${projectId}]`
  - 存在 → 自动调用一次 `sendText(boot)`，让 AI 接着撰写；完成后 `removeItem`
  - 不存在（计划模式）→ 只展示 seedMessages 的问题列表，等用户回复

## 按品类智能撰写

修改 `src/routes/api/chat.ts` system prompt，注入 `product.category[0]`，并增加品类指引段：
- 水果生鲜：产地、采摘日期、保鲜物流、净重斤数、坏果包赔
- 零食烘焙：保质期、配料表、口味档位、独立小包
- 服饰鞋包：面料、尺码表、版型、洗涤说明
- 美妆个护：成分、功效、适用肤质、备案信息
- 家居日用：材质、尺寸、场景、保修
- 母婴儿童：年龄段、安全认证、材质

通用规则（纯文本中文、`suggest_next` 调用）保持不变。

## 涉及文件
- 新增：`src/lib/projects.functions.ts` 中 `startProject` server fn
- 修改：`src/routes/index.tsx`（Hero 区替换为 HeroStarter 组件 + 文案润色）
- 修改：`src/routes/app.project.$id.tsx`（boot prompt 自动触发）
- 修改：`src/routes/api/chat.ts`（按品类撰写指引）

## 验证
- 输入"云南阳光玫瑰，2 斤 39.9 / 5 斤 88，产地直发顺丰冷链" + 立即开团 → 跳转后标题/SKU/标签已自动生成
- 同样输入 + 计划模式 → 跳转后 AI 首条是 3–5 个澄清问题，不写入商品数据
- 上传 1 张服饰图 + 一句"主推春夏女款" + 立即开团 → AI 识别为「服饰鞋包」，撰写聚焦面料/尺码/版型