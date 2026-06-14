import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/g/$slug")({
  ssr: true,
  loader: async ({ params }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: group } = await supabaseAdmin
      .from("group_orders")
      .select("id, slug, status, title, cover_image_url, snapshot_intro, snapshot_skus, ends_at, items_sold")
      .eq("slug", params.slug)
      .maybeSingle();
    if (!group) throw notFound();
    const { data: vc } = await supabaseAdmin.from("group_orders").select("view_count").eq("id", group.id).single();
    const next = (vc?.view_count ?? 0) + 1;
    await supabaseAdmin.from("group_orders").update({ view_count: next }).eq("id", group.id);
    return { group };
  },
  head: ({ loaderData }) => {
    const g = loaderData?.group;
    const title = g ? `${g.title} — 团宝速购` : "团宝速购";
    const desc = "扫码或点链接，直接下单。";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        ...(g?.cover_image_url ? [{ property: "og:image", content: g.cover_image_url }] : []),
      ],
    };
  },
  errorComponent: () => <div className="p-8 text-center text-sm text-muted-foreground">页面加载失败</div>,
  notFoundComponent: () => <div className="p-8 text-center text-sm text-muted-foreground">团购不存在或已下线</div>,
  component: BuyPage,
});

type IntroBlock =
  | { id: string; type: "text"; text: string }
  | { id: string; type: "image_lg"; url?: string | null }
  | { id: string; type: "image_sm"; urls: string[] }
  | { id: string; type: "video"; url?: string | null };

type SkuV = { id: string; optionValueIds: string[]; price: string; stock: string; image?: string | null };
type SkuG = { id: string; name: string; values: Array<{ id: string; label: string; image?: string | null }> };
type Sku = {
  name: string;
  price?: string;
  image?: string | null;
  images?: string[];
  description?: string;
  specGroups?: SkuG[];
  variants?: SkuV[];
};

function BuyPage() {
  const { group } = Route.useLoaderData();
  const skus = (group.snapshot_skus ?? []) as Sku[];
  const intro = (group.snapshot_intro ?? {}) as { blocks?: IntroBlock[]; title?: string; description?: string };
  const [open, setOpen] = useState(false);
  const closed = group.status !== "active" || (!!group.ends_at && new Date(group.ends_at).getTime() < Date.now());

  const lowest = useMemo(() => {
    let min = Infinity;
    for (const s of skus) {
      if (s.variants?.length) {
        for (const v of s.variants) {
          const n = parseFloat(v.price);
          if (n > 0 && n < min) min = n;
        }
      } else {
        const m = String(s.price ?? "").match(/[\d.]+/);
        if (m) {
          const n = parseFloat(m[0]);
          if (n > 0 && n < min) min = n;
        }
      }
    }
    return min === Infinity ? 0 : min;
  }, [skus]);

  return (
    <div className="min-h-screen bg-[#f5f5f5] pb-24 text-[15px]">
      <div className="mx-auto max-w-md space-y-2 pt-2">
        {/* Title card */}
        <section className="bg-white px-4 py-4">
          <h1 className="text-xl font-semibold leading-snug">{group.title}</h1>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-red-500">¥{lowest.toFixed(2)}</span>
            <span className="text-xs text-muted-foreground">起</span>
            <span className="ml-auto text-xs text-muted-foreground">已售 {group.items_sold ?? 0}</span>
          </div>
          {intro.description && (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{intro.description}</p>
          )}
        </section>

        {/* Intro blocks (body) */}
        {(intro.blocks?.length ?? 0) > 0 && (
          <section className="space-y-3 bg-white px-4 py-4">
            {(intro.blocks ?? []).map((b) => <BlockView key={b.id} block={b} />)}
          </section>
        )}

        {/* SKU list */}
        {skus.length > 0 && (
          <section className="bg-white px-4 py-4">
            <div className="mb-3 text-sm font-semibold">商品规格</div>
            <div className="space-y-3">
              {skus.map((s, i) => <SkuCard key={i} sku={s} />)}
            </div>
          </section>
        )}
      </div>

      {/* Fixed bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md bg-white border-t p-3">
        <button
          disabled={closed}
          onClick={() => setOpen(true)}
          className="h-12 w-full rounded-full bg-gradient-to-r from-red-500 to-orange-500 text-base font-semibold text-white shadow disabled:opacity-50"
        >
          {closed ? "团购已结束" : "立即下单"}
        </button>
      </div>

      {open && <OrderSheet slug={group.slug} skus={skus} onClose={() => setOpen(false)} />}
    </div>
  );
}

function SkuCard({ sku }: { sku: Sku }) {
  const img = sku.image || sku.images?.[0] || null;
  const priceLabel = useMemo(() => {
    if (sku.variants?.length) {
      const ps = sku.variants.map((v) => parseFloat(v.price)).filter((n) => n > 0);
      if (ps.length === 0) return sku.price ?? "";
      const min = Math.min(...ps), max = Math.max(...ps);
      return min === max ? `¥${min.toFixed(2)}` : `¥${min.toFixed(2)}–¥${max.toFixed(2)}`;
    }
    const m = String(sku.price ?? "").match(/[\d.]+/);
    return m ? `¥${parseFloat(m[0]).toFixed(2)}` : (sku.price ?? "");
  }, [sku]);
  const totalStock = useMemo(() => {
    if (sku.variants?.length) {
      let sum = 0;
      for (const v of sku.variants) {
        const n = parseInt(v.stock, 10);
        if (Number.isFinite(n)) sum += n;
      }
      return sum;
    }
    return null;
  }, [sku]);
  return (
    <div className="flex gap-3 rounded-lg border border-border/60 p-2.5">
      <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-md bg-muted text-muted-foreground">
        {img ? <img src={img} alt={sku.name} className="h-full w-full object-cover" /> : <span className="text-[10px]">无图</span>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{sku.name}</div>
        {sku.description && <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{sku.description}</div>}
        <div className="mt-1 flex items-center gap-2">
          <span className="text-sm font-semibold text-red-500">{priceLabel}</span>
          {totalStock != null && <span className="text-[11px] text-muted-foreground">库存 {totalStock}</span>}
        </div>
        {sku.variants?.length ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {sku.variants.slice(0, 6).map((v, vi) => {
              const labels = (sku.specGroups ?? []).map((g, gi) => {
                const vid = v.optionValueIds?.[gi];
                return g.values.find((vv) => vv.id === vid)?.label;
              }).filter(Boolean).join(" / ");
              return (
                <span key={v.id ?? vi} className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
                  {labels || `规格 ${vi + 1}`}
                </span>
              );
            })}
            {sku.variants.length > 6 && (
              <span className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
                +{sku.variants.length - 6}
              </span>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BlockView({ block }: { block: IntroBlock }) {
  if (block.type === "text") {
    return <div className="whitespace-pre-wrap text-[14px] leading-7">{block.text}</div>;
  }
  if (block.type === "image_lg" && block.url) {
    return <img src={block.url} alt="" className="w-full rounded-lg" />;
  }
  if (block.type === "image_sm") {
    return (
      <div className="grid grid-cols-3 gap-1.5">
        {block.urls.map((u, i) => <img key={i} src={u} alt="" className="aspect-square w-full rounded object-cover" />)}
      </div>
    );
  }
  if (block.type === "video" && block.url) {
    return <video src={block.url} controls className="w-full rounded-lg" />;
  }
  return null;
}

function OrderSheet({ slug, skus, onClose }: { slug: string; skus: Sku[]; onClose: () => void }) {
  // Single SKU + variant selection (one item at a time for simplicity).
  const [skuIdx, setSkuIdx] = useState(0);
  const [variantIdx, setVariantIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [detail, setDetail] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ orderNo: string; queryCode: string } | null>(null);

  // Restore from cookie
  useEffect(() => {
    try {
      const raw = document.cookie.split("; ").find((c) => c.startsWith("tb_buyer="));
      if (raw) {
        const v = JSON.parse(decodeURIComponent(raw.split("=")[1]));
        if (v.phone) setPhone(v.phone);
        if (v.name) setName(v.name);
        if (v.province) setProvince(v.province);
        if (v.city) setCity(v.city);
        if (v.district) setDistrict(v.district);
        if (v.detail) setDetail(v.detail);
      }
    } catch {}
  }, []);

  const sku = skus[skuIdx];
  const hasVariants = !!sku?.variants?.length;
  const variant = hasVariants ? sku.variants![variantIdx] : null;
  const unitPrice = useMemo(() => {
    if (variant) return parseFloat(variant.price) || 0;
    const m = String(sku?.price ?? "").match(/[\d.]+/);
    return m ? parseFloat(m[0]) : 0;
  }, [variant, sku]);

  const submit = async () => {
    setErr(null);
    if (!/^1[3-9]\d{9}$/.test(phone)) { setErr("请填写正确的手机号"); return; }
    if (!name.trim()) { setErr("请填写收件人姓名"); return; }
    if (!province || !city || !district || detail.trim().length < 3) { setErr("请填写完整收货地址"); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/g/${slug}/place-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerPhone: phone,
          buyerName: name.trim(),
          address: { province, city, district, detail: detail.trim() },
          note: note.trim() || undefined,
          items: [{ skuIndex: skuIdx, variantIndex: hasVariants ? variantIdx : undefined, qty }],
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error || "下单失败");
      } else {
        document.cookie = `tb_buyer=${encodeURIComponent(JSON.stringify({ phone, name, province, city, district, detail }))}; max-age=${60 * 60 * 24 * 90}; path=/`;
        setSuccess({ orderNo: json.orderNo, queryCode: json.queryCode });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "网络错误");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    const queryUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/o/${success.orderNo}?code=${success.queryCode}`;
    return (
      <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center">
          <div className="text-4xl">✅</div>
          <h2 className="mt-2 text-lg font-bold">下单成功</h2>
          <p className="mt-1 text-xs text-muted-foreground">订单号 {success.orderNo}</p>
          <p className="mt-2 text-sm">团长稍后会联系你确认付款方式</p>
          <a href={queryUrl} className="mt-4 inline-block text-xs text-primary underline">点击查看订单进度</a>
          <button onClick={onClose} className="mt-4 h-10 w-full rounded-full bg-foreground text-white">完成</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-black/50">
      <div className="mx-auto max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 pb-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">下单</h3>
          <button onClick={onClose} className="text-sm text-muted-foreground">取消</button>
        </div>

        {/* SKU picker */}
        {skus.length > 1 && (
          <div className="mb-3">
            <div className="text-xs text-muted-foreground mb-1">商品</div>
            <div className="flex flex-wrap gap-1.5">
              {skus.map((s, i) => (
                <button
                  key={i}
                  onClick={() => { setSkuIdx(i); setVariantIdx(0); }}
                  className={`rounded-full border px-3 py-1 text-xs ${i === skuIdx ? "border-red-500 bg-red-50 text-red-600" : ""}`}
                >{s.name}</button>
              ))}
            </div>
          </div>
        )}

        {/* Variant picker */}
        {hasVariants && (
          <div className="mb-3">
            <div className="text-xs text-muted-foreground mb-1">规格</div>
            <div className="flex flex-wrap gap-1.5">
              {sku.variants!.map((v, i) => {
                const labels = (sku.specGroups ?? []).map((g, gi) => {
                  const vid = v.optionValueIds?.[gi];
                  return g.values.find((vv) => vv.id === vid)?.label;
                }).filter(Boolean).join(" / ");
                const oos = v.stock !== "" && v.stock != null && parseInt(v.stock, 10) <= 0;
                return (
                  <button
                    key={v.id}
                    disabled={oos}
                    onClick={() => setVariantIdx(i)}
                    className={`rounded-full border px-3 py-1 text-xs ${i === variantIdx ? "border-red-500 bg-red-50 text-red-600" : ""} ${oos ? "opacity-40" : ""}`}
                  >{labels || `规格 ${i + 1}`} ¥{v.price}{oos ? " (售罄)" : ""}</button>
                );
              })}
            </div>
          </div>
        )}

        {/* Qty */}
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">数量</span>
          <div className="flex items-center gap-2">
            <button className="h-7 w-7 rounded-full border" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
            <span className="w-8 text-center">{qty}</span>
            <button className="h-7 w-7 rounded-full border" onClick={() => setQty(qty + 1)}>＋</button>
          </div>
        </div>

        <div className="my-3 h-px bg-border" />

        <div className="space-y-2">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="手机号" inputMode="tel" maxLength={11} className="h-10 w-full rounded-lg border bg-background px-3 text-sm" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="收件人姓名" maxLength={40} className="h-10 w-full rounded-lg border bg-background px-3 text-sm" />
          <div className="grid grid-cols-3 gap-2">
            <input value={province} onChange={(e) => setProvince(e.target.value)} placeholder="省" maxLength={20} className="h-10 rounded-lg border bg-background px-3 text-sm" />
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="市" maxLength={20} className="h-10 rounded-lg border bg-background px-3 text-sm" />
            <input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="区/县" maxLength={20} className="h-10 rounded-lg border bg-background px-3 text-sm" />
          </div>
          <textarea value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="详细地址（街道、门牌号）" maxLength={200} rows={2} className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="备注（选填）" maxLength={200} rows={1} className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
        </div>

        {err && <div className="mt-2 rounded bg-red-50 px-3 py-2 text-xs text-red-600">{err}</div>}

        <div className="mt-3 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">合计</div>
            <div className="text-xl font-bold text-red-500">¥{(unitPrice * qty).toFixed(2)}</div>
          </div>
          <button
            disabled={submitting || unitPrice <= 0}
            onClick={submit}
            className="h-11 rounded-full bg-gradient-to-r from-red-500 to-orange-500 px-8 font-semibold text-white shadow disabled:opacity-50"
          >{submitting ? "提交中…" : "提交订单"}</button>
        </div>
      </div>
    </div>
  );
}
