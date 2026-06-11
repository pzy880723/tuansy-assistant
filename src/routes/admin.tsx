import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { checkIsAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "管理后台 — 团宝助手" }] }),
  component: AdminLayout,
});

function AdminLayout() {
  const navigate = useNavigate();
  const check = useServerFn(checkIsAdmin);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-check"],
    queryFn: () => check(),
    retry: false,
  });

  useEffect(() => {
    if (!isLoading && (isError || data?.isAdmin === false)) {
      navigate({ to: "/app", replace: true });
    }
  }, [isLoading, isError, data, navigate]);

  if (isLoading || !data?.isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <main className="flex-1 overflow-x-auto">
        <Outlet />
      </main>
    </div>
  );
}
