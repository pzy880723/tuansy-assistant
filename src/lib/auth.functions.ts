/**
 * Mock authentication server functions.
 *
 * Development mode: SMS code is fixed to "123456"; WeChat scan login is a
 * one-click mock. Replace `sendSmsCode`/`verifySmsCode`/`wechatMockLogin`
 * handlers with real provider calls when ready for production.
 *
 * TODO(prod):
 *   - Replace mock with Aliyun/Tencent SMS provider.
 *   - Replace WeChat mock with WeChat Open Platform 网站应用扫码登录.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  clearSession,
  readSessionUserId,
  writeSession,
} from "@/lib/auth-session.server";

export const MOCK_SMS_CODE = "123456";
export const SUPER_ADMIN_PHONE = "18657433310";

const PhoneSchema = z
  .string()
  .transform((v) => v.replace(/[\s\-()]/g, "").replace(/^(\+?86|0086)/, ""))
  .pipe(z.string().regex(/^1[3-9]\d{9}$/, "请输入正确的手机号（11 位中国大陆手机号）"));

function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  throw new Error(r.error.issues[0]?.message ?? "请求参数不正确");
}

function toClientUser(user: {
  id: string;
  nickname: string;
  phone?: string | null;
  wechat_openid?: string | null;
}): typeof user & { role: "super_admin" | "user"; isAdmin: boolean } {
  const isAdmin = user.phone === SUPER_ADMIN_PHONE;
  return {
    ...user,
    role: isAdmin ? "super_admin" : "user",
    isAdmin,
  };
}

export const sendSmsCode = createServerFn({ method: "POST" })
  .inputValidator((d: { phone: string }) =>
    z.object({ phone: PhoneSchema }).parse(d),
  )
  .handler(async () => {
    // TODO(prod): call real SMS provider. For now, the code is always 123456.
    return { ok: true as const, devCode: MOCK_SMS_CODE };
  });

async function claimLegacyOrphans(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // First-ever user takes ownership of pre-auth records.
  const { count } = await supabaseAdmin
    .from("app_users")
    .select("id", { count: "exact", head: true });
  if ((count ?? 0) !== 1) return;
  await supabaseAdmin.from("projects").update({ owner_id: userId }).is("owner_id", null);
  await supabaseAdmin
    .from("project_images")
    .update({ owner_id: userId })
    .is("owner_id", null);
  await supabaseAdmin
    .from("copy_versions")
    .update({ owner_id: userId })
    .is("owner_id", null);
}

export const verifySmsCode = createServerFn({ method: "POST" })
  .inputValidator((d: { phone: string; code: string }) =>
    z
      .object({ phone: PhoneSchema, code: z.string().length(6) })
      .parse(d),
  )
  .handler(async ({ data }) => {
    if (data.code !== MOCK_SMS_CODE) {
      throw new Error("验证码不正确（开发期固定为 123456）");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("app_users")
      .select("id, nickname, phone, wechat_openid")
      .eq("phone", data.phone)
      .maybeSingle();

    let user = existing;
    if (!user) {
      const nickname = `手机用户${data.phone.slice(-4)}`;
      const { data: created, error } = await supabaseAdmin
        .from("app_users")
        .insert({ phone: data.phone, nickname })
        .select("id, nickname, phone, wechat_openid")
        .single();
      if (error) throw new Error(error.message);
      user = created;
      await claimLegacyOrphans(user.id);
    }

    writeSession(user);
    return { user: toClientUser(user) };
  });

export const wechatMockLogin = createServerFn({ method: "POST" }).handler(
  async () => {
    // TODO(prod): replace with real 微信扫码登录 callback handler.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const openid = `mock_${crypto.randomUUID().slice(0, 12)}`;
    const nickname = `微信用户${openid.slice(-4)}`;
    const { data: created, error } = await supabaseAdmin
      .from("app_users")
      .insert({ wechat_openid: openid, nickname })
      .select("id, nickname, phone, wechat_openid")
      .single();
    if (error) throw new Error(error.message);
    await claimLegacyOrphans(created.id);
    writeSession(created);
    return { user: toClientUser(created) };
  },
);

export const getCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  const uid = readSessionUserId();
  if (!uid) return { user: null };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("app_users")
    .select("id, nickname, phone, wechat_openid")
    .eq("id", uid)
    .maybeSingle();
  if (!data) {
    clearSession();
    return { user: null };
  }
  return { user: toClientUser(data) };
});

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  clearSession();
  return { ok: true as const };
});
