import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { getProject, updateProject } from "@/lib/projects.functions";

export const Route = createFileRoute("/project/$id")({
  head: () => ({ meta: [{ title: "编辑项目 — 团宝助手" }] }),
  component: ProjectPage,
});

function ProjectPage() {
  const { id } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const get = useServerFn(getProject);
  const update = useServerFn(updateProject);

  const { data, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => get({ data: { id } }),
  });

  const [name, setName] = useState("");

  useEffect(() => {
    if (data?.project) setName(data.project.name);
  }, [data?.project?.id, data?.project?.name]);

  const saveName = useMutation({
    mutationFn: () => update({ data: { id, patch: { name } } }),
    onSuccess: () => {
      toast.success("已保存");
      qc.invalidateQueries({ queryKey: ["project", id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  if (isLoading) {
    return (
      <AppShell back={{ to: "/" }}>
        <div className="text-sm text-muted-foreground">加载中…</div>
      </AppShell>
    );
  }

  return (
    <AppShell
      back={{ to: "/" }}
      right={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              router.navigate({ to: "/project/$id/sync", params: { id } })
            }
          >
            <ExternalLink className="h-4 w-4" /> 同步导出
          </Button>
          <Button size="sm" onClick={() => saveName.mutate()} disabled={saveName.isPending}>
            <Save className="h-4 w-4" /> 保存
          </Button>
        </>
      }
    >
      <div className="mb-4">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="项目名称"
          className="max-w-md text-lg font-semibold"
        />
      </div>

      <Tabs defaultValue="product" className="w-full">
        <TabsList className="grid w-full grid-cols-3 md:w-auto md:inline-flex">
          <TabsTrigger value="intro">团购介绍</TabsTrigger>
          <TabsTrigger value="product">团购商品</TabsTrigger>
          <TabsTrigger value="settings">团购设置</TabsTrigger>
        </TabsList>

        <TabsContent value="intro" className="mt-6">
          <Placeholder title="团购介绍" desc="活动标题 + AI 内容块编辑器（即将上线）" />
        </TabsContent>
        <TabsContent value="product" className="mt-6">
          <Placeholder title="团购商品" desc="图片九宫格、基础信息、规格组、SKU 矩阵（即将上线）" />
        </TabsContent>
        <TabsContent value="settings" className="mt-6">
          <Placeholder title="团购设置" desc="物流、运费模板、团购时间（即将上线）" />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function Placeholder({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-card p-10 text-center">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
