import { createHash, createHmac, randomInt, timingSafeEqual } from "crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  clearCurrentSession,
  createSessionToken,
  readSessionUserIdAsync,
  writeSession,
} from "@/lib/auth-session.server";

export const MOCK_SMS_CODE = "123456";
export const SUPER_ADMIN_PHONE = "18657433310";
const SMS_TTL_MINUTES = 5;
const MAX_VERIFY_ATTEMPTS = 5;

const PhoneSchema = z
  .string()
  .transform((v) => v.replace(/[\s\-()]/g, "").replace(/^(\+?86|0086)/, ""))
  .pipe(z.string().regex(/^1[3-9]\d{9}$/, "请输入正确的手机号（11 位中国大陆手机号）"));

function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  throw new Error(r.error.issues[0]?.message ?? "请求参数不正确");
}

type AppUser = {
  id: string;
  nickname: string;
  phone?: string | null;
  wechat_openid?: string | null;
};

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function safeCompare(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

function toClientUser(user: AppUser): AppUser & { role: "super_admin" | "user"; isAdmin: boolean } {
  const isAdmin = user.phone === SUPER_ADMIN_PHONE;
  return {
    ...user,
    role: isAdmin ? "super_admin" : "user",
    isAdmin,
  };
}

async function finishLogin(user: AppUser) {
  writeSession(user);
  const sessionToken = await createSessionToken(user.id);
  return { user: toClientUser(user), sessionToken };
}

function hasTencentSmsConfig() {
  return Boolean(
    process.env.TENCENTCLOUD_SECRET_ID &&
      process.env.TENCENTCLOUD_SECRET_KEY &&
      process.env.TENCENT_SMS_SDK_APP_ID &&
      process.env.TENCENT_SMS_SIGN_NAME &&
      process.env.TENCENT_SMS_TEMPLATE_ID,
  );
}

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

async function sendTencentSms(phone: string, code: string) {
  const secretId = process.env.TENCENTCLOUD_SECRET_ID;
  const secretKey = process.env.TENCENTCLOUD_SECRET_KEY;
  const sdkAppId = process.env.TENCENT_SMS_SDK_APP_ID;
  const signName = process.env.TENCENT_SMS_SIGN_NAME;
  const templateId = process.env.TENCENT_SMS_TEMPLATE_ID;
  if (!secretId || !secretKey || !sdkAppId || !signName || !templateId) {
    throw new Error("短信服务未配置，请先填写腾讯云短信密钥和模板信息");
  }

  const service = "sms";
  const host = "sms.tencentcloudapi.com";
  const action = "SendSms";
  const region = process.env.TENCENT_SMS_REGION || "ap-guangzhou";
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const payload = JSON.stringify({
    PhoneNumberSet: [`+86${phone}`],
    SmsSdkAppId: sdkAppId,
    SignName: signName,
    TemplateId: templateId,
    TemplateParamSet: [code, String(SMS_TTL_MINUTES)],
  });

  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`;
  const canonicalRequest = [
    "POST",
    "/",
    "",
    canonicalHeaders,
    "content-type;host;x-tc-action",
    hashValue(payload),
  ].join("\n");
  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = [
    "TC3-HMAC-SHA256",
    String(timestamp),
    credentialScope,
    hashValue(canonicalRequest),
  ].join("\n");
  const secretDate = hmac(`TC3${secretKey}`, date);
  const secretService = hmac(secretDate, service);
  const secretSigning = hmac(secretService, "tc3_request");
  const signature = createHmac("sha256", secretSigning).update(stringToSign).digest("hex");
  const authorization = `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=content-type;host;x-tc-action, Signature=${signature}`;

  const response = await fetch(`https://${host}/`, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json; charset=utf-8",
      Host: host,
      "X-TC-Action": action,
      "X-TC-Version": "2021-01-11",
      "X-TC-Timestamp": String(timestamp),
      "X-TC-Region": region,
    },
    body: payload,
  });
  const json = (await response.json().catch(() => null)) as {
    Response?: { Error?: { Message?: string }; SendStatusSet?: { Code?: string; Message?: string; SerialNo?: string }[] };
  } | null;
  const apiError = json?.Response?.Error?.Message;
  const status = json?.Response?.SendStatusSet?.[0];
  if (!response.ok || apiError || status?.Code !== "Ok") {
    throw new Error(apiError || status?.Message || "腾讯云短信发送失败");
  }
  return status?.SerialNo ?? null;
}

export const sendSmsCode = createServerFn({ method: "POST" })
  .inputValidator((d: { phone: string }) =>
    parseOrThrow(z.object({ phone: PhoneSchema }), d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!hasTencentSmsConfig()) {
      if (data.phone === SUPER_ADMIN_PHONE) return { ok: true as const, mode: "dev" as const };
      throw new Error("腾讯云短信服务还未配置完成，请先填写短信密钥、应用、签名和模板信息");
    }

    const code = String(randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + SMS_TTL_MINUTES * 60 * 1000).toISOString();
    const { data: row, error } = await supabaseAdmin
      .from("sms_verification_codes")
      .insert({ phone: data.phone, code_hash: hashValue(code), expires_at: expiresAt })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    try {
      const serialNo = await sendTencentSms(data.phone, code);
      if (serialNo) {
        await supabaseAdmin
          .from("sms_verification_codes")
          .update({ provider_request_id: serialNo })
          .eq("id", row.id);
      }
      return { ok: true as const, mode: "tencent" as const };
    } catch (e) {
      await supabaseAdmin
        .from("sms_verification_codes")
        .update({ error_message: e instanceof Error ? e.message : "短信发送失败" })
        .eq("id", row.id);
      throw e;
    }
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
    parseOrThrow(
      z.object({ phone: PhoneSchema, code: z.string().length(6, "验证码需 6 位") }),
      d,
    ),
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
