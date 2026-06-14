import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  streamText,
  stepCountIs,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";
import {
  createLovableAiGatewayProvider,
  getLovableAiGatewayResponseHeaders,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "@/lib/ai-gateway.server";

const LOVABLE_AIG_RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

const SpecValueSchema = z.object({
  id: z.string().optional(),
  label: z.string().describe("规格值显示名，例如 黑色、M、80斤"),
  image: z.string().nullable().optional().describe("仅第一组规格可挂图，URL"),
});
const SpecGroupSchema = z.object({
  id: z.string().optional(),
  name: z.string().describe("规格名，例如 颜色、尺码、口味"),
  hasImage: z.boolean().optional().describe("仅第一组可置 true，表示该组每个值挂图"),
  values: z.array(SpecValueSchema).min(1),
});
const VariantSchema = z.object({
  id: z.string().optional(),
  optionValueIds: z
    .array(z.string())
    .describe("与 specGroups 同序对应的 SpecValue.id 数组"),
  price: z.string().describe("团购价，元，保留 1 位小数"),
  stock: z.string().describe("库存整数字符串；空串=不限"),
  costPrice: z.string().optional(),
  image: z.string().nullable().optional(),
  code: z.string().optional(),
});

const SkuSchema = z.object({
  name: z.string().describe("商品名称（必填）"),
  category: z.string().optional().describe("商品品类：女装/男装/食品/美妆/母婴/家居/数码/其他"),
  description: z.string().optional().describe("商品描述，≤2000 字"),
  images: z.array(z.string()).max(9).optional().describe("商品图 URL 数组，第 1 张是主图"),
  videoUrl: z.string().nullable().optional(),
  tags: z.array(z.string()).max(2).optional(),
  price: z.string().optional().describe("无多规格时的团购价；有多规格时由 variants 汇总"),
  stock: z.string().optional().describe("无多规格时的库存；有多规格时由 variants 汇总"),
  strikePrice: z.string().optional(),
  costPrice: z.string().optional(),
  code: z.string().optional().describe("商品编码"),
  purchaseLimit: z.string().optional().describe("可购数量，例如 不限 或 数字"),
  isFlashSale: z.boolean().optional(),
  group: z.string().optional().describe("商品分类，例如 更多好货"),
  spec: z.string().optional(),
  image: z.string().nullable().optional(),
  specGroups: z.array(SpecGroupSchema).max(3).optional(),
  variants: z.array(VariantSchema).optional(),
});

const IntroBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string() }),
  z.object({ type: z.literal("image_lg"), url: z.string().nullable().optional() }),
  z.object({ type: z.literal("image_sm"), urls: z.array(z.string()) }),
  z.object({ type: z.literal("video"), url: z.string().nullable().optional() }),
  
]);

function genBlockId() {
  return Math.random().toString(36).slice(2, 10);
}

let _suid = 0;
function suid(prefix: string) {
  _suid += 1;
  return `${prefix}_${Date.now().toString(36)}_${_suid}`;
}

type ServerSpecValue = { id: string; label: string; image?: string | null };
type ServerSpecGroup = { id: string; name: string; hasImage?: boolean; values: ServerSpecValue[] };
type ServerVariant = {
  id: string;
  optionValueIds: string[];
  price: string;
  stock: string;
  costPrice?: string;
  image?: string | null;
  code?: string;
};
type ServerSku = Record<string, unknown> & {
  name: string;
  price?: string;
  stock?: string;
  image?: string | null;
  spec?: string;
  images?: string[];
  specGroups?: ServerSpecGroup[];
  variants?: ServerVariant[];
};

function ensureSpecIds(groups: ServerSpecGroup[] | undefined): ServerSpecGroup[] {
  return (groups ?? []).map((g) => ({
    ...g,
    id: g.id || suid("sg"),
    values: (g.values ?? []).map((v) => ({ ...v, id: v.id || suid("sv") })),
  }));
}
function cartesianValueIds(groups: ServerSpecGroup[]): string[][] {
  const usable = groups.filter((g) => g.values.length > 0);
  if (usable.length === 0) return [];
  let acc: string[][] = [[]];
  for (const g of usable) {
    const next: string[][] = [];
    for (const a of acc) for (const v of g.values) next.push([...a, v.id]);
    acc = next;
  }
  return acc;
}
function reconcileVariants(groups: ServerSpecGroup[], prior: ServerVariant[]): ServerVariant[] {
  const combos = cartesianValueIds(groups);
  if (combos.length === 0) return [];
  const key = (ids: string[]) => ids.join("|");
  const priorMap = new Map(prior.map((v) => [key(v.optionValueIds), v]));
  return combos.map((ids) => {
    const found = priorMap.get(key(ids));
    if (found) return { ...found, optionValueIds: ids };
    return { id: suid("vr"), optionValueIds: ids, price: "", stock: "" };
  });
}
function syncSkuSummary(p: ServerSku): ServerSku {
  const groups = p.specGroups ?? [];
  const variants = p.variants ?? [];
  const next: ServerSku = { ...p };
  next.image = (p.images && p.images[0]) ?? p.image ?? null;
  if (groups.length > 0 && variants.length > 0) {
    const prices = variants.map((v) => parseFloat(v.price)).filter((n) => !Number.isNaN(n));
    if (prices.length > 0) {
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      next.price = min === max ? String(min) : `${min}-${max}`;
    }
    const hasBlank = variants.some((v) => (v.stock ?? "").trim() === "");
    next.stock = hasBlank
      ? "不限"
      : String(variants.reduce((s, v) => s + (parseInt(v.stock, 10) || 0), 0));
    next.spec = `${groups.map((g) => `${g.name}${g.values.length}`).join(" · ")} = ${variants.length} 个`;
  }
  return next;
}
function findSkuIndex(arr: ServerSku[], locator: { index?: number; name?: string }): number {
  if (typeof locator.index === "number" && locator.index >= 0 && locator.index < arr.length)
    return locator.index;
  if (locator.name) {
    const i = arr.findIndex((s) => (s.name ?? "").trim() === locator.name!.trim());
    if (i >= 0) return i;
  }
  return -1;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const body = (await request.json()) as {
          messages?: UIMessage[];
          projectId?: string;
          snapshot?: unknown;
          copyLogicId?: string | null;
          startupMode?: "draft" | "plan";
        };
        if (!Array.isArray(body.messages) || !body.projectId) {
          return new Response("Bad request", { status: 400 });
        }

        const projectId = body.projectId;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { readSessionUserIdFromRequest } = await import("@/lib/auth-session.server");
        const userId = await readSessionUserIdFromRequest(request);
        if (!userId) return new Response("Unauthorized", { status: 401 });
        const { data: ownerRow } = await supabaseAdmin
          .from("projects")
          .select("owner_id")
          .eq("id", projectId)
          .maybeSingle();
        if (!ownerRow) return new Response("Project not found", { status: 404 });
        if (ownerRow.owner_id && ownerRow.owner_id !== userId) {
          return new Response("Forbidden", { status: 403 });
        }

        // Load fresh project state so the model sees the SAME data the preview renders.
        const { data: project } = await supabaseAdmin
          .from("projects")
          .select("name, intro, skus, settings, product")
          .eq("id", projectId)
          .maybeSingle();

        const product = (project?.product ?? {}) as Record<string, unknown>;
        const intro = (project?.intro ?? {}) as Record<string, unknown>;
        const skus = (project?.skus ?? []) as unknown[];
        const settings = (project?.settings ?? {}) as Record<string, unknown>;
        const category =
          ((product.category as string[] | undefined)?.[0]) ?? "未分类";

        // ---------- Resolve active copy logic ----------
        type LogicRow = {
          id: string;
          name: string;
          description: string | null;
          modules: Array<{ type: string; label: string; guidance: string }> | null;
          formatting: Record<string, unknown> | null;
          is_active: boolean;
        };
        let activeLogic: LogicRow | null = null;
        let forkedDuringRequest = false;
        const presetPrefix = "preset:";
        if (body.copyLogicId && body.copyLogicId.startsWith(presetPrefix)) {
          const presetId = body.copyLogicId.slice(presetPrefix.length);
          const { data: preset } = await supabaseAdmin
            .from("preset_copy_logics")
            .select("id, name, description, modules, formatting, is_published")
            .eq("id", presetId)
            .eq("is_published", true)
            .maybeSingle();
          if (preset) {
            activeLogic = {
              id: preset.id,
              name: `${preset.name}（标准）`,
              description: preset.description,
              modules: preset.modules as LogicRow["modules"],
              formatting: (preset as { formatting?: unknown }).formatting as
                | Record<string, unknown>
                | null,
              is_active: true,
            };
          }
        }
        if (!activeLogic) {
          const { data: allLogics } = await supabaseAdmin
            .from("copy_logics")
            .select("id, name, description, modules, formatting, is_active")
            .eq("user_id", userId);
          const logics = (allLogics ?? []) as unknown as LogicRow[];
          if (body.copyLogicId) {
            activeLogic = logics.find((l) => l.id === body.copyLogicId) ?? null;
          }
          if (!activeLogic && logics.length > 0) {
            // 候选池：优先取「已启用」逻辑；若一条都没启用，回落到全部逻辑兜底
            const enabled = logics.filter((l) => l.is_active);
            const pool = enabled.length > 0 ? enabled : logics;
            const fallback = pool[0];
            if (pool.length === 1) {
              activeLogic = fallback;
            } else {
              try {
                const ids = pool.map((l) => l.id);
                const matcherGateway = createLovableAiGatewayProvider(key);
                const productTitle =
                  (product.title as string | undefined) ??
                  (project?.name as string | undefined) ??
                  "";
                const candidates = pool
                  .map(
                    (l, i) =>
                      `${i + 1}. id=${l.id} | 名称：${l.name} | 简介：${(l.description ?? "").slice(0, 200)} | 模块：${(l.modules ?? []).map((m) => m.label).join("/")}`,
                  )
                  .join("\n");
                const { Output: MatchOutput, generateText: matchGen } = await import("ai");
                const matched = await matchGen({
                  model: matcherGateway("google/gemini-3-flash-preview"),
                  output: MatchOutput.object({
                    schema: z.object({
                      id: z.enum(["__none__", ...ids] as [string, ...string[]]),
                    }),
                  }),
                  prompt: `你在为团长挑选最合适的文案撰写逻辑。请根据商品品类、标题与简单描述，从下列候选里选出最贴合的一条；都不匹配返回 __none__。\n商品品类：${category}\n商品标题：${productTitle}\n候选（均为团长已启用的逻辑）：\n${candidates}`,
                });
                const picked = (matched.output as { id?: string } | undefined)?.id;
                activeLogic =
                  picked && picked !== "__none__"
                    ? (pool.find((l) => l.id === picked) ?? fallback)
                    : fallback;
              } catch {
                activeLogic = fallback;
              }
            }
          }
        }


        const fmt = (activeLogic?.formatting ?? {}) as {
          paragraphMode?: "natural" | "one-sentence-per-line" | "period-only";
          lineGap?: 0 | 1 | 2;
          headBlankLines?: number;
          tailBlankLines?: number;
          emojiDensity?: "none" | "light" | "rich";
        };
        const fmtParaMode = fmt.paragraphMode ?? "natural";
        const fmtLineGap = fmt.lineGap ?? 1;
        const fmtHead = Math.max(0, Math.min(10, fmt.headBlankLines ?? 0));
        const fmtTail = Math.max(0, Math.min(10, fmt.tailBlankLines ?? 0));
        const fmtEmoji = fmt.emojiDensity ?? "light";
        const paraModeDesc =
          fmtParaMode === "one-sentence-per-line"
            ? "一句一段（遇到句号「。」、问号「？?」、感叹号「！!」后立即换行另起一段）"
            : fmtParaMode === "period-only"
              ? "句号分段（仅在中文句号「。」后换行另起一段，问号、感叹号保留在当前段落不分段）"
              : "自然分段（按语义自由组织段落）";
        const emojiRule =
          fmtEmoji === "none"
            ? "禁止使用任何 emoji。"
            : fmtEmoji === "light"
              ? "Emoji 总量极少：每段最多 0–1 个，整篇 ≤ 5 个。硬性禁令：①禁止任何段落/句子/bullet/数字序号以 emoji 开头；②禁止『每段开头放一个 emoji』这种固定节奏；③禁止两段连续的段首都带 emoji；④如果一段里没有合适的情绪词/感官词作为锚点，这段就 0 emoji。允许：emoji 只能紧贴在情绪词/感官词/卖点词的右侧（例：『显瘦闭眼入😍』『甜到心里🍯』『一口爆汁🤤』）。生成完成后必须自检一次，违反任意一条要重写。"
              : "Emoji 可以稍多，但仍受硬性禁令约束：①禁止任何段落/句子/bullet/数字序号以 emoji 开头（标题首字符可以是 emoji）；②禁止『每段开头一个 emoji』的机械模板；③emoji 必须紧贴情绪词/感官词右侧强化语气，不允许独立成行或堆在段首；④每段最多 2 个。生成后自检，违反要重写。";


        const formattingPromptBlock = activeLogic
          ? `\n【排版规则 — 所有 type:"text" block（含标题段、痛点段、卖点段、款式参数段、图位前后段、params 表）一律执行，不得遗漏任何模块】\n- 段落模式：${paraModeDesc}。如果是「一句一段」或「句号分段」，必须自行拆句后用 \\n 换行串起，不允许多句挤一行。\n- 段间空行：每段之间空 ${fmtLineGap} 个空白行（段尾追加 \\n${"\\n".repeat(fmtLineGap)}）\n- 首行空行：整段文本最前面追加 ${fmtHead} 个 \\n\n- 尾行空行：整段文本最后追加 ${fmtTail} 个 \\n\n- Emoji 用法：${emojiRule}\n- 换行必须由模型显式写入 \\n 字符，不能依赖前端渲染补换行。\n`
          : "";
        const logicPromptBlock = activeLogic
          ? `\n【当前启用文案逻辑：${activeLogic.name}】（用户在「设置 → 文案编辑逻辑」里定义）\n总纲：${activeLogic.description ?? ""}\n模块清单（必须严格按此顺序，每个模块产生一个 block，不可合并、不可跳过）：\n${(activeLogic.modules ?? [])
              .map(
                (m, i) =>
                  `${i + 1}. [${m.type}] ${m.label} — ${m.guidance || "（无额外要求）"}`,
              )
              .join("\n")}\n硬约束：本逻辑优先级高于下方通用五步法；冲突时以本逻辑为准。${formattingPromptBlock}`
          : "";

        const initialRunId = getLovableAiGatewayRunId(request);
        const gateway = createLovableAiGatewayProvider(key, initialRunId);
        const model = gateway("google/gemini-3-flash-preview");

        const isSeededStart = body.messages.length === 1 && body.messages[0]?.role === "user";
        const result = streamText({
          model,
          abortSignal: request.signal,
          stopWhen: stepCountIs(50),
          system: `你是「团宝」，一只圆滚滚的橙色礼盒小精灵，是快团团团长的开团搭子。说话像真人助理一样自然、利落、有温度，不端架子、不寒暄。

当前项目: 「${project?.name ?? "未命名"}」
当前商品品类: ${category}
当前是否首次开团: ${isSeededStart ? "是" : "否"}
首页模式: ${body.startupMode === "plan" ? "计划模式" : "立即撰写"}

【右侧预览正在显示的真实数据，必须基于这个来改】
介绍 intro: ${JSON.stringify(intro, null, 2)}
SKU 列表 skus: ${JSON.stringify(skus, null, 2)}
设置 settings: ${JSON.stringify(settings, null, 2)}
商品元信息 product: ${JSON.stringify(product, null, 2)}

按品类撰写重点（根据上面的品类挑对应那一行）：
水果生鲜：产地、采摘时间、净重斤数、保鲜/冷链方式、坏果包赔
零食烘焙：保质期、配料表、口味档位、独立小包装
服饰鞋包：面料、尺码表、版型、洗涤说明、模特身高参考
美妆个护：核心成分、功效、适用肤质、备案/资质
家居日用：材质、尺寸、使用场景、保修
母婴儿童：适用年龄段、安全认证、材质安全性
其他：突出最强卖点和差异化
${logicPromptBlock}
【文案五步转化框架 — 写 title/blocks 时必须遵守】
核心理念：不是推销产品，而是激发购买欲望。整条逻辑链：吸引眼球 → 引发共鸣 → 建立信任 → 激发欲望 → 促成下单。
重要：右侧预览只有「标题 + blocks」两块。intro.description 字段已废弃，禁止往里写任何内容；正文一律拆成 blocks，每段一个 type:"text" 的 block。

第 1 步 强力吸睛标题（写入 intro.title，14-22 字，硬性要求）
  四要素（至少命中 3 项）：① 情绪钩子（emoji 或情绪词，如 🔥💥绝了 / 闭眼入 / 救命）② 核心卖点（材质 / 版型 / 口感 / 功效）③ 利益点（骨折价 / 限时 / 赠品 / 清仓）④ 人群标签（梨形 / 宝妈 / 打工人 / 学生党）。
  禁止只写商品名、禁止只甩一个 emoji 凑数、禁止短于 14 字。
  emoji 嵌在情绪词旁边，不要全堆在最前面。
  正例：🔥再生纤维气球裤 显瘦闭眼入 梨形姐妹骨折价
  正例：绝了！手剥山核桃仁 现剥现发 打工人续命零食
  反例：「时尚连衣裙」（无情绪无卖点无人群）
  反例：「🔥连衣裙」（只有 emoji 和品名）
  ★ 如果当前文案逻辑包含 [title] 模块，其 guidance 是硬约束，要把它点名的句式、关键词、风格全部吸收进标题里，不能退化成通用公式。

第 2 步 痛点共鸣开篇（独立 text block）
  从"我懂你"切入，列举 1-2 个用户日常具体尴尬/不满，然后一句话抛出产品作为"救星"，再升华到一种生活方式。

第 3 步 品牌故事 / 背书（独立 text block）
  给低价或好品质一个合理理由：品牌光环、设计师理念、工厂背景、质检承诺，让用户消除"便宜没好货"的顾虑。

第 4 步 深度卖点拆解（3-4 个独立 text block，每段 1 个核心卖点）
  分块阐述（面料 / 版型 / 设计 / 工艺 / 场景），多用感官词（丝滑、软糯、垂坠感、奶香、果香），结合具体生活场景（出汗不粘腿、遮大肚子、通勤即穿）。

第 5 步 款式与参数详解（独立 text block）
  颜色性格化（黑色显瘦、卡其气质、米白温柔）+ 详细尺码/规格表 + 防掉坑提示（"卡码拍大一码"等专业建议）。

【首次开团的真人感工作流】
- 如果当前是首次开团且为计划模式：不要修改项目。先复述你看懂的商品/品类/用户目标，再调用 ask_questions 提 3-4 个关键问题，最后调用 suggest_next。
- 如果当前是首次开团且为立即撰写：先用 2-3 句复述你看懂的项目、品类、用户原文要点、当前文案逻辑以及是否带图；再说一句「我先理一下这次的文案节奏」，然后开始调用工具。
- 首次立即撰写必须渐进完成：先单独调用一次 update_intro 只写 title（绝不要传 description）；随后严格按模块顺序，每个模块单独调用一次 update_intro，只传一个 blocksAppend 元素。每次工具调用前先用一句自然的过程说明，例如「先把痛点说透」「接着补上品质背书」。
- 禁止一次调用塞入全部 blocks。即使多个模块都已想好，也必须逐模块调用，让用户在右侧看到段落逐个出现。
- 所有模块完成后，用一句话总结本版的核心转化角度；再给 3 条带中文编号的、针对当前商品的调整建议，并问用户想先改哪一项；最后调用 suggest_next 给出 3-4 个可直接点击的调整指令。
- 后续对话优先微调已有段落，不要无故整篇重写。

【图文配对工作流 — 模块化优先，两阶段】

阶段 A：用户只丢文字/口头描述（聊天没有图片附件）
  1) 立刻开始渐进撰写，按当前文案逻辑模块清单顺序逐一产出，每个模块必须单独调用 update_intro 的 blocksAppend：
     - 每个 [title] / [paragraph] / [params] 模块 → 生成一个 type:"text" 的 block，内容严格按对应 guidance 撰写，并完全套用上面【排版规则】（分段、空行、首行缩进、emoji 浓度）。
     - 每个 [image_large] 模块 → 插入一个 type:"text" 占位 block，固定格式：「[图位·大图建议：xxx]」（xxx 描述此处应放什么图，例如：模特正面上身实拍）。
     - 每个 [image_grid] 模块 → 插入 type:"text" 占位 block：「[图位·九宫格建议：xxx]」。
     - 每个 [video] 模块 → 插入 type:"text" 占位 block：「[图位·视频建议：xxx]」。
  2) intro.title 仍要按第 1 步公式写好；正文全部承载在 blocks 里，禁止写 intro.description。
  3) 全部完成后告诉用户「已按 X 个模块分好段落，预留了 N 个图位」，再总结和给 3 条调整建议。
  4) 没有启用任何文案逻辑时，也必须按默认五步框架渐进生成：痛点共鸣、品质背书、卖点拆解、场景体验、参数/下单建议各自成为独立 text block，每段单独调用一次 blocksAppend。

阶段 B：用户后续丢图片进来（聊天里有 file part）
  1) 读现有 intro.blocks，找出所有「[图位·...]」占位 text block，按图片语义把它们替换为 image_lg / image_sm / video block：
     - 商品全景/模特上身 → 卖点段或款式段后的图位
     - 细节/材质特写 → 面料/工艺段后的图位
     - 对比/痛点场景 → 痛点段后的图位
     - 尺码表/参数 → 末段图位
  2) 同段 1 张用 image_lg；同段 ≥3 张合并成 1 个 image_sm 九宫格 block 替换原占位。
   3) 调用 update_intro 的 blocksReplaceAt 原地替换对应索引。严禁把图堆在结尾，也不要重写其他文字块。
  4) 占位用完后还有多余图，按语义补到最相关段落后；判断不出归属时调 ask_questions 让用户选。
  5) 没有启用文案逻辑时，沿用旧的"文字-图交替穿插"重排逻辑。

【AI 生图 → 预览 → 插入 工作流 — 必须严格遵守】
- 用户让你"生图/配图/做几张图"时，调 generate_product_images 生成。该工具**不会**自动放到右边，图片只在聊天里给用户预览。
- 生图完成后，回一句话："已经生成 N 张，预览看看；想放哪个模块告诉我，或者让我建议位置。" 然后**停下**，等用户回话。
- 默认禁止紧接着调用 insert_generated_images。**只有**当用户本轮消息里出现明确授权——『你帮我放/你来决定/合适位置/自己丢进去/你看着办/随便放』——才允许直接调 insert_generated_images。
- 调 insert_generated_images 前，**必须**先重新读上面贴出的 intro.blocks 真实内容，根据图片主题挑出语义最贴合的那一段，把它的真实 id 作为 anchor.blockId（不要瞎编 id，找不到会报错）。
- reason 字段必须写明依据，例如"放在『新鲜直采』段落下面，承接产地描述"；不能写"放到合适位置"这种空话。
- 嘴上说的位置必须和实际 anchor 一致；禁止口是心非地说"我放在 X 下面"但实际 anchor 是别的块或末尾。


【锁定模块规则 — 必须遵守】
- intro.blocks 里若某段带有 locked:true，那是用户钉死的内容。你绝对不能替换、重写、合并、删除或重新排序这一段，也不能用 blocksReplaceAt 覆盖该索引（服务端会拒绝并返回 skippedLocked）。
- 你可以在锁定段前后用 blocksAppend 新增内容，也可以照常修改其他未锁定的段落。
- 用户明确说"改这段被锁定的内容"时，先回一句"这段被你锁定了，先在右侧解锁再让我改"，不要硬改。
- 整体重排（传 blocks 字段）时，请尽量保持 locked 段相对位置；服务端也会把它们钉回原位置。

【记忆规则 — 必须主动调用 remember_preference】
- 当用户出现长期偏好/规则性表述时（"以后都…"、"记住…"、"我喜欢…"、"我不喜欢…"、"别再…"、"每次都…"、"我的风格是…"），必须在本回合调用一次 remember_preference，把偏好凝练成 ≤80 字的一句话写进当前文案逻辑。
- 一次性局部指令（"这次把标题改短"、"现在加一段痛点"）不要记。
- scope="global"：通用偏好（整体语气、emoji 多少、长度、价格表述习惯等）。
- scope="module"：明确指向某个模块的偏好（如"痛点段要更扎心"），同时传 moduleLabel 为该模块的标签名。
- 记完之后用一句话告诉用户："记下了，以后都按这个来。"
- 同一回合内同一条偏好只记一次，不要重复调用。

【@mention 规则 — 用户精准点名某一段】
- 用户消息里出现 @[标签#xxxxxxxx]（例如 @[段落2#a1b2c3d4]）就是精准点名右侧预览的某个块。
- 解析方法：在 intro.blocks 里查 id 以 xxxxxxxx 开头的块，定位它的 index。
- 命中后只能用 update_intro 的 blocksReplaceAt 原地替换该 index，不要 append、不要动其他块。
- 若该块 locked:true，请回一句"这段被你锁定了，先在右侧解锁再让我改"，不要硬改。
- 若 token 在 intro.blocks 里找不到匹配，先回一句话问用户指的是哪一段，再操作。

【候选采纳规则 — 极其重要】
- 当你在聊天里给出 ≥2 个标题候选或段落候选时，必须在同一回复内立刻调用一次 update_intro，把你最推荐的那一条先写进右侧预览（标题候选 → title，段落候选 → blocksAppend 或 blocksReplaceAt）。不允许"全在聊天里，预览空空"。
- 当用户用任何方式表示采纳（"放进去 / 应用 / 用第 X 个 / 就这个 / 换成 X / 用这个"），必须在本次回复就调对应工具写入对应内容；禁止只用文字回"已经选好了 / 已应用"而不调工具。
- 如果用户的指代不明（多个候选时只说"放进去"），先用一句话确认是哪一条，再于下一回合调工具；不要默认猜测后偷偷写入。
- 候选采纳后用一句话简短确认改了哪里。

回复风格（务必遵守）：
- 全程纯文本中文，禁止使用任何 Markdown 符号（不要出现 *、**、#、- 列表、反引号、表格语法）
- 聊天回复控制在 3 到 8 行内，简洁、像真人助理一样说话
- 写入 blocks 的每个 text 段落必须是完整内容，禁止只写一句话占位（图位除外，图位就用规定格式）
- Emoji 必须自然嵌在情绪词/感官词旁边，禁止在每行/每句开头规律性堆砌；严禁"每段开头一个 emoji"这种机械模板
- 不寒暄、不重复用户的话、不要"好的，我来帮你..."这种开场
- 自称"团宝"，不要说"AI"或"助手"

工作原则（极其重要 — 工具必须对应右侧预览的字段）：
- 团购活动标题（短，14-22 字）→ update_intro 的 title
- 团购正文一律拆成一段一个 type:"text" block，通过 update_intro 的 blocksAppend 逐段追加；绝不允许往 update_intro 的 description 里塞任何内容（该字段已废弃，预览不再显示）
- 图文模块 blocks：首次阶段 A 按逻辑逐模块使用 blocksAppend；阶段 B 用 blocksReplaceAt；只有用户明确要求整体重排时才传 blocks
- 改单个商品的某个字段（名称/品类/描述/图片/价格/库存/划线价/编码/标签/可购数量等）→ update_sku_at（局部 patch，不要重写整张数组）
- 用户首次说"商品叫 XX、品类是 XX"且 skus 为空 → 用 update_sku_at + createIfMissing:true 新建一条
- 用户要给商品建多规格（"颜色：黑/白/灰，尺码：M/L" 这类） → set_variants 一次建好，服务端会自动做笛卡尔积
- 用户口报库存或贴库存表（图片/CSV/文字） → 先解析成 [{match:{规格名:规格值,...}, stock:'数字'}]，然后调 set_variant_stocks；如果规格还没建，先 set_variants 再 set_variant_stocks
- 仅在用户要求整体重排 SKU、批量删除或一次新建很多商品时才用 update_skus（要传完整数组、且字段必须包含 category 和 images，否则前端编辑器会报缺失）
- 改配送、起团、保障、自提、截团时间等设置项 → update_settings
- 改商品标题、副标题、服务标签、封面 → update_product_meta
- 不要把所有改动都塞进 update_product_meta；不同 Tab 的数据走不同工具
- 用户描述意图时，主动调用工具修改预览，不要只是回复文字
- 修改后用一句中文简短确认所做改动
- 价格保留 1 位小数，库存为整数字符串
- 不确定时主动询问用户




询问用户信息时（极其重要）：
- 一次需要确认 2 个及以上信息时，必须调用 ask_questions 工具发出问卷，禁止把多个问题塞进一段文字里
- 每个问题给 2 到 5 个最常见的候选选项，让用户点选；问题文案精简到 20 字内
- 单个开放性问题（比如让用户描述卖点）可以直接用一句话问
- 调用 ask_questions 时，不要再额外用文字重复同样的问题

每次回复结束前，必须调用一次 suggest_next 工具，给出 2 到 4 条用户下一步最可能想做的短指令（每条不超过 18 个汉字，必须能直接当作下一条用户消息发送）。`,

          messages: await convertToModelMessages(body.messages),
          tools: {
            update_intro: tool({
              description:
                "渐进更新介绍 Tab。首次撰写先写 title/description，再按模块逐次用 blocksAppend 追加一个段落；图片用 blocksReplaceAt 原地替换；blocks 仅用于用户明确要求整体重排。",
              inputSchema: z.object({
                title: z
                  .string()
                  .describe("团购活动主标题，简短有力，10-20 字，可选")
                  .optional(),
                description: z
                  .string()
                  .describe(
                    "团购活动封面摘要。首次渐进撰写时只写 1-2 句且不超过 60 字，正文放在逐次追加的 blocks 中；仅旧项目整体修改时可写 120-300 字完整版。",
                  )
                  .optional(),
                blocks: z
                  .array(IntroBlockSchema)
                  .describe(
                    "图文模块数组，整体替换。仅当用户明确要求整体重排时使用。",
                  )
                  .optional(),
                blocksAppend: z
                  .array(IntroBlockSchema)
                  .max(1)
                  .describe("渐进追加一个模块。首次撰写每次必须只传一个元素。")
                  .optional(),
                blocksReplaceAt: z
                  .array(
                    z.object({
                      index: z.number().int().min(0),
                      block: IntroBlockSchema,
                    }),
                  )
                  .describe("按索引原地替换图位，不改动其他模块。")
                  .optional(),
              }),
              execute: async (input) => {
                const { data: freshRow, error: readError } = await supabaseAdmin
                  .from("projects")
                  .select("intro")
                  .eq("id", projectId)
                  .maybeSingle();
                if (readError) return { ok: false, error: readError.message };
                const freshIntro = (freshRow?.intro ?? {}) as Record<string, unknown>;
                const currentBlocks = Array.isArray(freshIntro.blocks)
                  ? ([...freshIntro.blocks] as Array<Record<string, unknown>>)
                  : [];
                const { blocksAppend, blocksReplaceAt, ...fields } = input;
                const patch: Record<string, unknown> = { ...fields };
                const skippedLocked: number[] = [];
                if (Array.isArray(input.blocks)) {
                  // Preserve locked blocks at their original indexes; fill the
                  // rest from the model-provided array, in order.
                  const lockedAt = new Map<number, Record<string, unknown>>();
                  currentBlocks.forEach((b, idx) => {
                    if (b && (b as { locked?: boolean }).locked) lockedAt.set(idx, b);
                  });
                  const incoming = input.blocks.map((b) => ({ id: genBlockId(), ...b }));
                  const total = Math.max(
                    currentBlocks.length,
                    incoming.length + lockedAt.size,
                  );
                  const merged: Array<Record<string, unknown>> = [];
                  let cursor = 0;
                  for (let i = 0; i < total; i++) {
                    if (lockedAt.has(i)) {
                      merged.push(lockedAt.get(i)!);
                    } else if (cursor < incoming.length) {
                      merged.push(incoming[cursor++] as Record<string, unknown>);
                    }
                  }
                  while (cursor < incoming.length) {
                    merged.push(incoming[cursor++] as Record<string, unknown>);
                  }
                  patch.blocks = merged;
                  if (lockedAt.size > 0) skippedLocked.push(...lockedAt.keys());
                } else {
                  let nextBlocks = currentBlocks;
                  if (blocksAppend?.length) {
                    nextBlocks = [
                      ...nextBlocks,
                      ...blocksAppend.map((b) => ({ id: genBlockId(), ...b })),
                    ];
                  }
                  for (const replacement of blocksReplaceAt ?? []) {
                    if (replacement.index < nextBlocks.length) {
                      const existing = nextBlocks[replacement.index] as {
                        id?: string;
                        locked?: boolean;
                      };
                      if (existing?.locked) {
                        skippedLocked.push(replacement.index);
                        continue;
                      }
                      // Preserve the existing block id so @mention tokens
                      // and front-end refs stay stable across edits.
                      nextBlocks[replacement.index] = {
                        ...replacement.block,
                        id: existing?.id ?? genBlockId(),
                      };
                    }
                  }
                  if (blocksAppend?.length || blocksReplaceAt?.length) patch.blocks = nextBlocks;
                }
                const next = { ...freshIntro, ...patch };
                const { error } = await supabaseAdmin
                  .from("projects")
                  .update({ intro: next as never })
                  .eq("id", projectId);
                if (error) return { ok: false, error: error.message };
                const change = blocksAppend?.[0]
                  ? { kind: "append", block: (next.blocks as unknown[] | undefined)?.at(-1) }
                  : blocksReplaceAt?.length
                    ? { kind: "replace", indexes: blocksReplaceAt.map((item) => item.index) }
                    : input.title || input.description
                      ? { kind: "header", title: input.title, description: input.description }
                      : { kind: "reorder" };
                return {
                  ok: true,
                  updated: Object.keys(input),
                  blockCount: Array.isArray(next.blocks) ? next.blocks.length : currentBlocks.length,
                  intro: next,
                  change,
                  ...(skippedLocked.length ? { skippedLocked } : {}),
                };
              },
            }),
            update_skus: tool({
              description:
                "整体替换 SKU 列表（顶层 skus 列，预览的商品 Tab 直接读这里）。仅在用户要求重排、删除、或一次新建多个商品时使用；改单个商品请用 update_sku_at。每个 SKU 字段名要和编辑器完全对齐：name(必填) / category(必填，如 女装/食品) / images[](必填，至少 1 张) / description / price / stock / specGroups[] / variants[] / strikePrice / costPrice / code / tags / purchaseLimit / isFlashSale 等。",
              inputSchema: z.object({
                skus: z.array(SkuSchema).min(1).describe("完整的 SKU 数组"),
              }),
              execute: async ({ skus: nextSkus }) => {
                const normalized = (nextSkus as ServerSku[]).map((s) => {
                  const groups = ensureSpecIds(s.specGroups);
                  const variants = (s.variants ?? []).map((v) => ({
                    ...v,
                    id: v.id || suid("vr"),
                  }));
                  return syncSkuSummary({ ...s, specGroups: groups, variants });
                });
                const { error } = await supabaseAdmin
                  .from("projects")
                  .update({ skus: normalized as never })
                  .eq("id", projectId);
                if (error) return { ok: false, error: error.message };
                return { ok: true, count: normalized.length };
              },
            }),
            update_sku_at: tool({
              description:
                "局部更新单个商品（按 index 或 name 定位）。只传要改的字段做浅合并。当用户说『商品叫 XXX』『改价格 / 库存 / 描述 / 图片 / 品类』时优先用此工具，不要重写整张 SKU 数组。如果商品不存在并希望新建，把 createIfMissing 设为 true，未指定 index 时新建在末尾。",
              inputSchema: z.object({
                locator: z
                  .object({
                    index: z.number().int().min(0).optional(),
                    name: z.string().optional(),
                  })
                  .describe("商品定位，优先 index；index/name 至少给一个"),
                patch: SkuSchema.partial().describe("要合并的字段"),
                createIfMissing: z.boolean().optional().describe("找不到时是否新建，默认 false"),
              }),
              execute: async ({ locator, patch, createIfMissing }) => {
                const arr = ((skus as unknown) as ServerSku[]).slice();
                let idx = findSkuIndex(arr, locator);
                if (idx < 0) {
                  if (!createIfMissing)
                    return { ok: false, error: "找不到商品，可设 createIfMissing=true 来新建" };
                  if (!patch.name) return { ok: false, error: "新建商品必须提供 name" };
                  arr.push({ name: patch.name, price: "", stock: "" } as ServerSku);
                  idx = arr.length - 1;
                }
                const merged: ServerSku = { ...arr[idx], ...(patch as ServerSku) };
                if (patch.specGroups) merged.specGroups = ensureSpecIds(patch.specGroups as ServerSpecGroup[]);
                if (patch.variants)
                  merged.variants = (patch.variants as ServerVariant[]).map((v) => ({
                    ...v,
                    id: v.id || suid("vr"),
                  }));
                arr[idx] = syncSkuSummary(merged);
                const { error } = await supabaseAdmin
                  .from("projects")
                  .update({ skus: arr as never })
                  .eq("id", projectId);
                if (error) return { ok: false, error: error.message };
                return { ok: true, index: idx, sku: arr[idx], total: arr.length };
              },
            }),
            set_variants: tool({
              description:
                "为一个商品建立或重建多规格。传 specGroups（例如 颜色:[黑,白,灰]、尺码:[M,L]），服务端会做笛卡尔积生成所有变体；已存在的变体价格/库存会被保留。可选 defaultPrice 给所有新变体填默认价。第一组规格可设 hasImage:true，让每个值挂图。",
              inputSchema: z.object({
                locator: z.object({
                  index: z.number().int().min(0).optional(),
                  name: z.string().optional(),
                }),
                specGroups: z.array(SpecGroupSchema).min(1).max(3),
                defaultPrice: z.string().optional().describe("可选，给新变体填的默认价"),
              }),
              execute: async ({ locator, specGroups: inGroups, defaultPrice }) => {
                const arr = ((skus as unknown) as ServerSku[]).slice();
                const idx = findSkuIndex(arr, locator);
                if (idx < 0) return { ok: false, error: "找不到商品" };
                const groups = ensureSpecIds(inGroups as ServerSpecGroup[]);
                const prior = arr[idx].variants ?? [];
                let variants = reconcileVariants(groups, prior);
                if (defaultPrice) {
                  variants = variants.map((v) => (v.price ? v : { ...v, price: defaultPrice }));
                }
                arr[idx] = syncSkuSummary({ ...arr[idx], specGroups: groups, variants });
                const { error } = await supabaseAdmin
                  .from("projects")
                  .update({ skus: arr as never })
                  .eq("id", projectId);
                if (error) return { ok: false, error: error.message };
                return {
                  ok: true,
                  index: idx,
                  variantCount: variants.length,
                  spec: arr[idx].spec,
                  variants: variants.map((v) => ({
                    id: v.id,
                    label: v.optionValueIds
                      .map((vid, i) => groups[i]?.values.find((x) => x.id === vid)?.label ?? "—")
                      .join("/"),
                    price: v.price,
                    stock: v.stock,
                  })),
                };
              },
            }),
            set_variant_stocks: tool({
              description:
                "按规格组合批量设置库存（或价格）。用户口报库存、贴库存表（图片/CSV/文字）时调用：先用视觉/文本解析得到映射，再用此工具一次性写回。每条 entries 用 match 描述规格组合，例如 { match: {颜色:'黑色', 尺码:'M'}, stock:'30', price:'19.9' }。规格名/值会做去空格、繁简一致比对。找不到的会列在 unmatched 里。",
              inputSchema: z.object({
                locator: z.object({
                  index: z.number().int().min(0).optional(),
                  name: z.string().optional(),
                }),
                entries: z
                  .array(
                    z.object({
                      match: z
                        .record(z.string(), z.string())
                        .describe("规格名 → 规格值，例如 {颜色:'黑色', 尺码:'M'}"),
                      stock: z.string().optional(),
                      price: z.string().optional(),
                    }),
                  )
                  .min(1),
              }),
              execute: async ({ locator, entries }) => {
                const arr = ((skus as unknown) as ServerSku[]).slice();
                const idx = findSkuIndex(arr, locator);
                if (idx < 0) return { ok: false, error: "找不到商品" };
                const target = arr[idx];
                const groups = target.specGroups ?? [];
                const variants = (target.variants ?? []).slice();
                if (groups.length === 0 || variants.length === 0) {
                  return { ok: false, error: "该商品尚未建立多规格，请先调 set_variants" };
                }
                const norm = (s: string) => s.replace(/\s+/g, "").trim();
                const updated: Array<{ label: string; stock?: string; price?: string }> = [];
                const unmatched: Array<{ match: Record<string, string>; reason: string }> = [];
                for (const e of entries) {
                  const ids: string[] = [];
                  let bad = "";
                  for (const g of groups) {
                    const wanted = e.match[g.name] ?? e.match[norm(g.name)];
                    if (wanted == null) {
                      bad = `缺少规格 ${g.name}`;
                      break;
                    }
                    const v = g.values.find((x) => norm(x.label) === norm(wanted));
                    if (!v) {
                      bad = `${g.name} 找不到值 ${wanted}`;
                      break;
                    }
                    ids.push(v.id);
                  }
                  if (bad) {
                    unmatched.push({ match: e.match, reason: bad });
                    continue;
                  }
                  const vi = variants.findIndex(
                    (v) => v.optionValueIds.join("|") === ids.join("|"),
                  );
                  if (vi < 0) {
                    unmatched.push({ match: e.match, reason: "组合不存在" });
                    continue;
                  }
                  const next = { ...variants[vi] };
                  if (e.stock != null) next.stock = e.stock;
                  if (e.price != null) next.price = e.price;
                  variants[vi] = next;
                  updated.push({
                    label: ids
                      .map(
                        (id, i) => groups[i]?.values.find((x) => x.id === id)?.label ?? "—",
                      )
                      .join("/"),
                    stock: e.stock,
                    price: e.price,
                  });
                }
                arr[idx] = syncSkuSummary({ ...target, variants });
                const { error } = await supabaseAdmin
                  .from("projects")
                  .update({ skus: arr as never })
                  .eq("id", projectId);
                if (error) return { ok: false, error: error.message };
                return { ok: true, index: idx, updatedCount: updated.length, updated, unmatched };
              },
            }),
            update_settings: tool({
              description:
                "更新设置 Tab 的字段（配送方式、起团件数、截团时间、保障、自提点、发货时效等）。只传要改的 key，做浅合并。",
              inputSchema: z.object({
                patch: z
                  .record(z.string(), z.unknown())
                  .describe("要合并进 settings 的 key-value，例如 { min_order: '10', delivery: '包邮' }"),
              }),
              execute: async ({ patch }) => {
                const next = { ...settings, ...patch } as Record<string, unknown>;
                const { error } = await supabaseAdmin
                  .from("projects")
                  .update({ settings: next as never })
                  .eq("id", projectId);
                if (error) return { ok: false, error: error.message };
                return { ok: true, updated: Object.keys(patch) };
              },
            }),
            update_product_meta: tool({
              description:
                "更新商品元信息（标题、副标题、服务标签、封面图等），写入 product 列，做浅合并。不要在这里改 SKU。",
              inputSchema: z.object({
                title: z.string().describe("新的商品标题，可选").optional(),
                subtitle: z.string().describe("新的副标题/卖点行，可选").optional(),
                tags: z
                  .array(z.string())
                  .describe("服务标签数组，可选，会整体替换")
                  .optional(),
                cover: z.string().describe("封面图 URL，可选").optional(),
              }),
              execute: async (input) => {
                const next = { ...product, ...input };
                const { error } = await supabaseAdmin
                  .from("projects")
                  .update({ product: next })
                  .eq("id", projectId);
                if (error) return { ok: false, error: error.message };
                return { ok: true, updated: Object.keys(input) };
              },
            }),
            ask_questions: tool({
              description:
                "需要向用户确认 2 个及以上信息时必须调用，禁止把多个问题塞进文字回复里。每个问题给 2-5 个常见候选选项，用户点击即可作答。",
              inputSchema: z.object({
                intro: z
                  .string()
                  .max(40)
                  .describe("一句话说明为什么要问，例如：先确认几个细节我好写文案"),
                questions: z
                  .array(
                    z.object({
                      id: z.string().describe("简短英文/拼音 id，例如 audience"),
                      question: z.string().max(40).describe("问题文案，20 字内"),
                      multi: z.boolean().describe("是否多选，默认 false"),
                      options: z.array(z.string().max(20)).min(2).max(5),
                      allow_other: z.boolean().describe("是否允许用户填写其他，默认 true"),
                    }),
                  )
                  .min(1)
                  .max(4),
              }),
              execute: async (input) => ({ ok: true, ...input }),
            }),
            generate_product_images: tool({
              description:
                "根据中文场景描述用 AI 生成商品配图（1-9 张）。**只生图、只返回 URL，不会自动插入到右侧预览**。用户看到图后再决定放哪里；除非用户在本轮消息里明确授权（『你帮我放/你来决定位置/自己丢进去/合适位置/你看着办』等），否则不要紧接着调用 insert_generated_images。",
              inputSchema: z.object({
                prompt: z
                  .string()
                  .min(2)
                  .max(800)
                  .describe("中文场景描述，越具体越好，例如『清晨阳光下的草莓园特写，水珠晶莹』"),
                count: z
                  .number()
                  .int()
                  .min(1)
                  .max(9)
                  .describe("生成张数，建议 1/3/6/9"),
                aspect: z
                  .enum(["square", "portrait", "landscape"])
                  .describe(
                    "图片比例。商品大图默认 portrait（3:4 竖图，最适合手机预览）；横向场景图用 landscape（4:3）；九宫格小图用 square（1:1）。",
                  )
                  .default("portrait"),
                referenceImages: z
                  .array(z.string().url())
                  .max(3)
                  .optional()
                  .describe("参考图 URL 数组，可让 AI 保持商品外观一致；通常传用户在聊天中上传的图"),
              }),
              execute: async ({ prompt, count, aspect, referenceImages }) => {
                try {
                  const { generateImagesBatch, uploadGeneratedImage } = await import(
                    "@/lib/image-gen.server"
                  );
                  const sizeMap = {
                    square: "1024x1024",
                    portrait: "1024x1536",
                    landscape: "1536x1024",
                  } as const;
                  const aspectKey = aspect ?? "portrait";
                  const size = sizeMap[aspectKey];
                  const b64s = await generateImagesBatch(
                    key,
                    { prompt, referenceImages, size },
                    count,
                  );
                  const urls = await Promise.all(
                    b64s.map((b) => uploadGeneratedImage(b, userId, projectId)),
                  );
                  if (urls.length === 0) return { ok: false, error: "没有生成任何图片" };
                  return { ok: true, urls, count: urls.length, aspect: aspectKey };
                } catch (e) {
                  return { ok: false, error: (e as Error).message };
                }
              },
            }),
            insert_generated_images: tool({
              description:
                "把已生成（或用户上传）的图片 URL 放到 intro.blocks 的指定位置。**调用前必须先看右侧预览正在显示的 intro.blocks 的真实 id 和文字**，按文案语义选锚点（场景图→对应场景段、细节图→材质/工艺段、九宫格→『怎么吃/搭配』段）。anchor.blockId 必须是 intro.blocks 里真实存在的 id；找不到会直接报错，不会兜底到末尾。",
              inputSchema: z.object({
                urls: z.array(z.string().url()).min(1).max(9),
                groupAsGrid: z
                  .boolean()
                  .describe("≥2 张时是否合并成九宫格 image_sm；false=每张单独 image_lg")
                  .default(true),
                anchor: z.object({
                  mode: z.enum(["after_block", "before_block", "replace_block", "end"]),
                  blockId: z
                    .string()
                    .optional()
                    .describe("intro.blocks 里的真实 block id；mode=end 时可省"),
                }),
                reason: z
                  .string()
                  .min(4)
                  .max(60)
                  .describe("一句话说明为什么放这里，例如『放在卖点·新鲜直采下面，承接产地描述』"),
              }),
              execute: async ({ urls, groupAsGrid, anchor, reason }) => {
                const { data: freshRow, error: readError } = await supabaseAdmin
                  .from("projects")
                  .select("intro")
                  .eq("id", projectId)
                  .maybeSingle();
                if (readError) return { ok: false, error: readError.message };
                const freshIntro = (freshRow?.intro ?? {}) as Record<string, unknown>;
                const currentBlocks = Array.isArray(freshIntro.blocks)
                  ? ([...freshIntro.blocks] as Array<Record<string, unknown>>)
                  : [];

                const newBlocks: Array<Record<string, unknown>> =
                  urls.length === 1
                    ? [{ id: genBlockId(), type: "image_lg" as const, url: urls[0] }]
                    : groupAsGrid
                      ? [{ id: genBlockId(), type: "image_sm" as const, urls: urls.slice(0, 9) }]
                      : urls.map((u) => ({ id: genBlockId(), type: "image_lg" as const, url: u }));

                let nextBlocks: Array<Record<string, unknown>>;
                let targetLabel = "末尾";
                if (anchor.mode === "end") {
                  nextBlocks = [...currentBlocks, ...newBlocks];
                } else {
                  if (!anchor.blockId) {
                    return { ok: false, error: "anchor.blockId 必填（mode≠end 时）" };
                  }
                  const idx = currentBlocks.findIndex(
                    (b) => (b as { id?: string })?.id === anchor.blockId,
                  );
                  if (idx === -1) {
                    return {
                      ok: false,
                      error: `intro.blocks 里找不到 id=${anchor.blockId} 的块，请重新读取后选择真实的锚点。`,
                    };
                  }
                  const anchored = currentBlocks[idx] as {
                    text?: string;
                    type?: string;
                    locked?: boolean;
                  };
                  targetLabel =
                    (anchored?.text ?? "").trim().slice(0, 14) ||
                    (anchored?.type === "image_lg"
                      ? "大图块"
                      : anchored?.type === "image_sm"
                        ? "九宫格"
                        : "该模块");
                  if (anchor.mode === "after_block") {
                    nextBlocks = [
                      ...currentBlocks.slice(0, idx + 1),
                      ...newBlocks,
                      ...currentBlocks.slice(idx + 1),
                    ];
                  } else if (anchor.mode === "before_block") {
                    nextBlocks = [
                      ...currentBlocks.slice(0, idx),
                      ...newBlocks,
                      ...currentBlocks.slice(idx),
                    ];
                  } else {
                    if (anchored?.locked) {
                      return { ok: false, error: "该块已锁定，无法替换" };
                    }
                    nextBlocks = [
                      ...currentBlocks.slice(0, idx),
                      ...newBlocks,
                      ...currentBlocks.slice(idx + 1),
                    ];
                  }
                }

                const nextIntro = { ...freshIntro, blocks: nextBlocks };
                const { error } = await supabaseAdmin
                  .from("projects")
                  .update({ intro: nextIntro as never })
                  .eq("id", projectId);
                if (error) return { ok: false, error: error.message };
                return {
                  ok: true,
                  count: urls.length,
                  anchor: anchor.mode,
                  targetLabel,
                  reason,
                };
              },
            }),
            remember_preference: tool({
              description:
                "把用户的长期偏好/风格规则记录到当前启用的文案逻辑里，下次生成自动遵守。仅记长期偏好，不记一次性指令。",
              inputSchema: z.object({
                note: z
                  .string()
                  .min(2)
                  .max(160)
                  .describe("用户偏好的一句话概括，≤80 字，写成可直接执行的规则"),
                scope: z
                  .enum(["global", "module"])
                  .describe("global=整体偏好；module=指向某个模块的偏好"),
                moduleLabel: z
                  .string()
                  .max(40)
                  .optional()
                  .describe("scope=module 时必填，对应模块的 label，例如『痛点共鸣』"),
              }),
              execute: async ({ note, scope, moduleLabel }) => {
                if (!activeLogic) {
                  return { ok: false, error: "当前没有启用文案逻辑，无法记忆" };
                }
                const fromPreset =
                  !forkedDuringRequest &&
                  !!body.copyLogicId &&
                  body.copyLogicId.startsWith(presetPrefix);

                const mergeDescription = (desc: string | null): string => {
                  const base = (desc ?? "").trim();
                  const header = "【用户偏好（团宝记录）】";
                  const line = `- ${note.trim()}`;
                  if (base.includes(header)) {
                    const idx = base.indexOf(header);
                    const before = base.slice(0, idx).trim();
                    const after = base.slice(idx + header.length);
                    const items = new Set(
                      after
                        .split("\n")
                        .map((s) => s.trim())
                        .filter((s) => s.startsWith("-")),
                    );
                    items.add(line);
                    return `${before ? `${before}\n\n` : ""}${header}\n${[...items].join("\n")}`.trim();
                  }
                  return `${base ? `${base}\n\n` : ""}${header}\n${line}`.trim();
                };

                const mergeModule = (
                  mods: NonNullable<LogicRow["modules"]>,
                ): NonNullable<LogicRow["modules"]> => {
                  if (!moduleLabel) return mods;
                  let matched = false;
                  const next = mods.map((m) => {
                    if (m.label !== moduleLabel) return m;
                    matched = true;
                    const existing = (m.guidance ?? "").trim();
                    const line = `- ${note.trim()}`;
                    if (existing.split("\n").map((s) => s.trim()).includes(line)) return m;
                    return { ...m, guidance: existing ? `${existing}\n${line}` : line };
                  });
                  return matched ? next : mods;
                };

                if (fromPreset) {
                  // Fork the preset into a user-owned copy_logics row, then
                  // write the preference there. Keep the original preset clean.
                  const baseName = activeLogic.name.replace(/（标准）$/, "");
                  const forkedName = `${baseName}（我的偏好）`;
                  const baseModules = activeLogic.modules ?? [];
                  const nextDescription =
                    scope === "global"
                      ? mergeDescription(activeLogic.description)
                      : (activeLogic.description ?? "");
                  const nextModules =
                    scope === "module" ? mergeModule(baseModules) : baseModules;
                  const { data: inserted, error: insertError } = await supabaseAdmin
                    .from("copy_logics")
                    .insert({
                      user_id: userId,
                      name: forkedName,
                      description: nextDescription,
                      modules: nextModules as never,
                      formatting: (activeLogic.formatting ?? {}) as never,
                      is_active: true,
                    })
                    .select("id")
                    .single();
                  if (insertError || !inserted) {
                    return {
                      ok: false,
                      error: insertError?.message ?? "复制预设逻辑失败",
                    };
                  }
                  // Update in-memory activeLogic so subsequent calls in this
                  // request write to the fork, not re-fork.
                  activeLogic = {
                    id: inserted.id,
                    name: forkedName,
                    description: nextDescription,
                    modules: nextModules,
                    formatting: activeLogic.formatting,
                    is_active: true,
                  };
                  forkedDuringRequest = true;
                  return {
                    ok: true,
                    note: note.trim(),
                    scope,
                    logicId: inserted.id,
                    logicName: forkedName,
                    forkedFromPreset: true,
                  };
                }

                const patch: Record<string, unknown> = {};
                if (scope === "global") {
                  patch.description = mergeDescription(activeLogic.description);
                  activeLogic = { ...activeLogic, description: patch.description as string };
                } else if (moduleLabel && activeLogic.modules) {
                  const nextModules = mergeModule(activeLogic.modules);
                  patch.modules = nextModules;
                  activeLogic = { ...activeLogic, modules: nextModules };
                } else {
                  return { ok: false, error: "scope=module 时必须传 moduleLabel" };
                }
                const { error: updateError } = await supabaseAdmin
                  .from("copy_logics")
                  .update(patch as never)
                  .eq("id", activeLogic.id)
                  .eq("user_id", userId);
                if (updateError) return { ok: false, error: updateError.message };
                return {
                  ok: true,
                  note: note.trim(),
                  scope,
                  logicId: activeLogic.id,
                  logicName: activeLogic.name,
                  forkedFromPreset: false,
                };
              },
            }),
            suggest_next: tool({
              description:
                "在回复末尾给出 2 到 4 条用户下一步可能想做的快速操作建议。每条必须是动词开头的祈使短语，6-14 个汉字，独立完整、可直接点击发送。严禁以语气助词或残缺字结尾（不要以 回 / 回复 / 吧 / 啦 / 哦 / 喔 / 呢 / 啊 / 的 / 了 / 。/ ！ 结尾），不要加引号或编号。好例子：『生成面料细节特写图』『把第2段改得更生动』『新增售后承诺段落』。坏例子：『生成面料细节的特写图回』『再来一张吧』『建议你试试看』。每次回复都要调用一次。",
              inputSchema: z.object({
                suggestions: z.array(z.string().min(2).max(24)).min(2).max(4),
              }),
              execute: async ({ suggestions }) => ({ ok: true, suggestions }),
            }),
          },
        });

        const response = result.toUIMessageStreamResponse({
          headers: getLovableAiGatewayResponseHeaders(undefined, {
            ...(initialRunId ? { [LOVABLE_AIG_RUN_ID_HEADER]: initialRunId } : {}),
          }),
        });

        return withLovableAiGatewayRunIdHeader(response, gateway);
      },
    },
  },
});
