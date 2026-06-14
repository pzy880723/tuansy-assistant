import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Download } from "lucide-react";
import logoAppIcon from "@/assets/logo-app-icon.png.asset.json";

export const Route = createFileRoute("/extension")({
  head: () => ({ meta: [{ title: "Chrome 插件 — 团宝助手" }] }),
  component: ExtensionPage,
});

function ExtensionPage() {
  const download = () => {
    fetch("/ktt-filler.zip")
      .then((res) => {
        if (!res.ok) throw new Error(`下载失败: ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "ktt-filler.zip";
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch((e) => alert(e.message));
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-5">
          <Link
            to="/"
            className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> 首页
          </Link>
        </div>
      </div>
      <main className="mx-auto max-w-3xl px-5 py-16">
        <div className="text-center">
          <img
            src={logoAppIcon.url}
            alt="团宝助手"
            className="mx-auto h-20 w-20 rounded-2xl shadow-[0_12px_32px_oklch(0.7_0.19_45/0.4)]"
          />
          <h1 className="mt-6 text-3xl font-bold tracking-tight">团宝快团团助手</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
            把团宝项目里的标题、介绍、SKU、图片，一键填入快团团 PC 后台
            「新建团购」或「编辑团购」页。
          </p>
          <button
            onClick={download}
            className="mt-8 inline-flex h-11 items-center gap-2 rounded-full bg-[oklch(0.7_0.19_45)] px-6 text-sm font-semibold text-white shadow-[0_8px_24px_oklch(0.7_0.19_45/0.35)] hover:opacity-90"
          >
            <Download className="h-4 w-4" /> 下载插件 zip
          </button>
        </div>

        <section className="mt-12 rounded-2xl border bg-card p-6">
          <h2 className="text-base font-semibold">安装步骤</h2>
          <ol className="mt-3 space-y-2 text-sm text-muted-foreground list-decimal pl-5">
            <li>下载并解压上面的 zip 包</li>
            <li>打开 Chrome / Edge，地址栏访问 <code className="rounded bg-muted px-1.5 py-0.5">chrome://extensions</code></li>
            <li>右上角打开「开发者模式」</li>
            <li>点击「加载已解压的扩展程序」，选择刚才解压出来的文件夹</li>
            <li>固定到浏览器右上角，方便使用</li>
          </ol>
        </section>

        <section className="mt-6 rounded-2xl border bg-card p-6">
          <h2 className="text-base font-semibold">使用方法</h2>
          <ol className="mt-3 space-y-2 text-sm text-muted-foreground list-decimal pl-5">
            <li>装好插件后，回到团宝项目页，刷新一下</li>
            <li>点右上角「同步到快团团」按钮</li>
            <li>插件会自动打开快团团后台并把内容填入，无需复制粘贴</li>
          </ol>
          <p className="mt-4 text-xs text-muted-foreground">
            首版支持：标题、富文本介绍、首个 SKU 价格库存、开始/结束时间、介绍区图片。
            若快团团页面结构有调整导致填入失败，请反馈我们更新选择器。
          </p>
        </section>
      </main>
    </div>
  );
}
