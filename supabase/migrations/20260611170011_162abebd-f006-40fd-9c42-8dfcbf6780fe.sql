
-- ============ 1. Roles + Ban ============
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "admins read all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;

-- Auto-grant admin to specific phone
CREATE OR REPLACE FUNCTION public.auto_grant_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.phone = '18657433310' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_grant_admin_on_app_users
AFTER INSERT OR UPDATE OF phone ON public.app_users
FOR EACH ROW EXECUTE FUNCTION public.auto_grant_admin_role();

-- Backfill admin if user exists
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM public.app_users WHERE phone = '18657433310'
ON CONFLICT DO NOTHING;

-- ============ 2. preset_copy_logics ============
CREATE TABLE public.preset_copy_logics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  industry text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  modules jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.preset_copy_logics TO authenticated;
GRANT ALL ON public.preset_copy_logics TO service_role;
ALTER TABLE public.preset_copy_logics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone authenticated reads published presets" ON public.preset_copy_logics
  FOR SELECT TO authenticated
  USING (is_published = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins manage presets" ON public.preset_copy_logics
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER touch_preset_copy_logics_updated_at
BEFORE UPDATE ON public.preset_copy_logics
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed 7 industry presets
INSERT INTO public.preset_copy_logics (slug, name, industry, sort_order, description, modules) VALUES
('apparel', '服装文案', '服装', 10,
'服装类目主打韩系氛围感、显瘦版型与场景化穿搭。先用一句梨形/苹果型身材的痛点共鸣勾住人，接着讲面料和工厂背景建立信任，然后分别从面料、版型、设计三段卖点拆解（每段配大图或九宫格细节），最后给颜色性格 + 尺码表 + 卡码拍大一码的提示，让用户能下单不犹豫。',
'[
  {"id":"a1","type":"title","label":"标题","guidance":"用 emoji + 痛点/版型 + 利益点（清仓/赠品）+ 人群标签（梨形/通勤/小个子），10-20 字"},
  {"id":"a2","type":"paragraph","label":"痛点共鸣","guidance":"列举 1-2 个穿衣具体尴尬（显胯、勒肚、卡腰），一句话把本款定位成救星"},
  {"id":"a3","type":"paragraph","label":"工厂/品牌背书","guidance":"给低价合理理由：源头工厂、设计师、面料供应商、检测报告，让用户消除便宜没好货顾虑"},
  {"id":"a4","type":"paragraph","label":"面料卖点","guidance":"具体面料名 + 克重 + 触感（丝滑/垂坠/微弹），结合季节体感"},
  {"id":"a5","type":"image_grid","label":"面料九宫格","guidance":"细节图：纹理特写、缝线、洗标、内里"},
  {"id":"a6","type":"paragraph","label":"版型卖点","guidance":"具体讲哪里收哪里放（A 字裙摆/落肩/直筒），适合身材"},
  {"id":"a7","type":"image_large","label":"上身大图","guidance":"模特上身全身，注明身高体重参考"},
  {"id":"a8","type":"paragraph","label":"设计/场景","guidance":"通勤、约会、度假等具体场景搭配建议"},
  {"id":"a9","type":"params","label":"颜色+尺码表","guidance":"颜色性格化（黑显瘦/卡其气质）+ 完整尺码表 + 卡码拍大一码提示"}
]'::jsonb),

('food', '食品文案', '食品', 20,
'食品类目核心是激发食欲与建立食品安全信任。先用通感词制造垂涎，再讲产地/工艺/保质期建立放心感，分段拆解口感与配料，结尾给规格与食用场景。',
'[
  {"id":"f1","type":"title","label":"标题","guidance":"emoji + 通感词（爆汁/酥脆/奶香）+ 利益点 + 人群（馋哭/办公室必备），10-20 字"},
  {"id":"f2","type":"paragraph","label":"垂涎开篇","guidance":"用味觉/嗅觉/视觉通感词描绘一口下去的瞬间，激发想吃欲望"},
  {"id":"f3","type":"paragraph","label":"产地/工艺背书","guidance":"原产地、工厂、传承工艺、检测报告，让用户放心下单"},
  {"id":"f4","type":"paragraph","label":"口感拆解","guidance":"分层口感（外酥内软 / 头中尾韵）、配料表诚意、不添加什么"},
  {"id":"f5","type":"image_grid","label":"细节九宫格","guidance":"原料、加工、成品、剖面、配料表"},
  {"id":"f6","type":"paragraph","label":"食用场景","guidance":"早餐、下午茶、追剧、送礼等具体场景"},
  {"id":"f7","type":"params","label":"规格+保质期","guidance":"净含量、规格、保质期、储存方式、坏品包赔"}
]'::jsonb),

('jewelry', '珠宝文案', '珠宝', 30,
'珠宝类目主打情绪价值与材质权威背书。开篇用情绪场景（自我犒赏/纪念日）共鸣，给鉴定证书/材质工艺建立信任，分段讲设计灵感与佩戴感，结尾给尺寸/保养。',
'[
  {"id":"j1","type":"title","label":"标题","guidance":"emoji + 材质（S925/18K/天然）+ 设计点 + 情绪标签（自我犒赏/纪念日），10-20 字"},
  {"id":"j2","type":"paragraph","label":"情绪场景","guidance":"自我犒赏、纪念日、约会等场景情绪共鸣"},
  {"id":"j3","type":"paragraph","label":"材质+证书","guidance":"具体材质成分、克重、镀层、鉴定证书、保真承诺"},
  {"id":"j4","type":"paragraph","label":"设计灵感","guidance":"灵感来源、设计师故事、工艺细节（手工镶嵌/精修）"},
  {"id":"j5","type":"image_large","label":"佩戴大图","guidance":"模特上身效果，能看到设计感与质感"},
  {"id":"j6","type":"image_grid","label":"细节九宫格","guidance":"正面、侧面、扣件、戳印、证书、礼盒"},
  {"id":"j7","type":"params","label":"尺寸+保养","guidance":"尺寸规格、调节范围、保养建议、礼盒包装"}
]'::jsonb),

('appliance', '家电文案', '家电', 40,
'家电类目主打功能参数 + 使用场景 + 售后保障。开篇讲使用痛点，给品牌资质背书，分段拆解核心功能与日常场景，结尾详尽参数 + 质保。',
'[
  {"id":"ap1","type":"title","label":"标题","guidance":"emoji + 核心功能（变频/除菌）+ 利益（直降/赠品）+ 场景（懒人/出租屋），10-20 字"},
  {"id":"ap2","type":"paragraph","label":"使用痛点","guidance":"日常使用具体痛点（噪音/费电/难清洗），引出本款解决方案"},
  {"id":"ap3","type":"paragraph","label":"品牌/资质背书","guidance":"品牌历史、3C 认证、能效等级、专利技术"},
  {"id":"ap4","type":"paragraph","label":"核心功能拆解","guidance":"3-4 个核心功能逐条讲，配具体参数与对比"},
  {"id":"ap5","type":"image_grid","label":"功能九宫格","guidance":"功能演示、对比图、细节按钮、配件全家福"},
  {"id":"ap6","type":"paragraph","label":"使用场景","guidance":"小户型、出租屋、母婴、宠物家庭等具体场景"},
  {"id":"ap7","type":"params","label":"参数+质保","guidance":"详尽规格参数 + 包装清单 + 质保年限 + 售后说明"}
]'::jsonb),

('beauty', '日化文案', '日化', 50,
'日化（个护/美妆/洗护）核心是成分党教育 + 肤感体验。痛点切入，成分备案背书，分段讲核心成分功效与肤感，结尾给适用肤质与用法。',
'[
  {"id":"b1","type":"title","label":"标题","guidance":"emoji + 核心成分/功效 + 肤感词（水润/清爽）+ 人群（敏感肌/油皮），10-20 字"},
  {"id":"b2","type":"paragraph","label":"肌肤痛点","guidance":"1-2 个具体肌肤问题（爆痘/暗沉/敏感）共鸣切入"},
  {"id":"b3","type":"paragraph","label":"品牌/成分背书","guidance":"品牌、备案号、原料供应商、实验室报告"},
  {"id":"b4","type":"paragraph","label":"核心成分功效","guidance":"2-3 个核心成分（浓度+功效原理），可加对比"},
  {"id":"b5","type":"image_grid","label":"质地+肤感","guidance":"质地拉丝、上脸效果、对比图、成分图"},
  {"id":"b6","type":"paragraph","label":"使用步骤","guidance":"早晚使用顺序、每次用量、搭配建议"},
  {"id":"b7","type":"params","label":"规格+适用","guidance":"容量、保质期、适用肤质、生产日期、备案号"}
]'::jsonb),

('3c', '3C 数码文案', '3C数码', 60,
'3C 数码核心是参数党 + 场景体验。开篇场景痛点，品牌芯片背书，核心配置 + 性能跑分，结尾详尽参数与售后。',
'[
  {"id":"c1","type":"title","label":"标题","guidance":"emoji + 核心配置/亮点 + 利益点 + 人群（学生党/办公），10-20 字"},
  {"id":"c2","type":"paragraph","label":"场景痛点","guidance":"使用场景下的痛点（卡顿/续航差/发热）共鸣"},
  {"id":"c3","type":"paragraph","label":"品牌+芯片背书","guidance":"品牌、芯片型号、专利、跑分认证"},
  {"id":"c4","type":"paragraph","label":"核心性能","guidance":"性能/续航/屏幕/影像等核心配置，给具体参数与跑分"},
  {"id":"c5","type":"image_grid","label":"功能九宫格","guidance":"外观、接口、配件、跑分截图、对比"},
  {"id":"c6","type":"paragraph","label":"使用场景","guidance":"办公、游戏、剪辑、出行等具体场景表现"},
  {"id":"c7","type":"params","label":"参数+售后","guidance":"详尽参数表 + 包装清单 + 保修 + 七天无理由"}
]'::jsonb),

('household', '日用家居文案', '日用家居', 70,
'日用家居核心是解决生活痛点 + 颜值/收纳/材质。痛点开篇，品牌/材质背书，多场景拆解使用方式，结尾尺寸与清洁保养。',
'[
  {"id":"h1","type":"title","label":"标题","guidance":"emoji + 解决问题 + 颜值/材质卖点 + 人群（租房党/宝妈），10-20 字"},
  {"id":"h2","type":"paragraph","label":"生活痛点","guidance":"具体生活场景痛点（乱/脏/丑/不顺手）共鸣"},
  {"id":"h3","type":"paragraph","label":"材质/品牌背书","guidance":"材质环保等级、品牌、检测报告、专利结构"},
  {"id":"h4","type":"paragraph","label":"功能/收纳卖点","guidance":"具体怎么解决问题（容量、分区、巧思）"},
  {"id":"h5","type":"image_large","label":"场景大图","guidance":"实际摆放场景图，能看出空间感与颜值"},
  {"id":"h6","type":"image_grid","label":"细节九宫格","guidance":"材质特写、结构细节、不同角度、配件"},
  {"id":"h7","type":"params","label":"尺寸+保养","guidance":"详尽尺寸 + 颜色款式 + 清洁保养建议 + 包装"}
]'::jsonb);
