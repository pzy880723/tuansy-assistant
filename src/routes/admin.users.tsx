import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Search, Shield, ShieldOff, UserX, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminListUsers, adminSetAdminRole, adminSetBan } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/users")({
  component: UsersPage,
});

const PAGE_SIZE = 20;

function UsersPage() {
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);

  const list = useServerFn(adminListUsers);
  const setBan = useServerFn(adminSetBan);
  const setRole = useServerFn(adminSetAdminRole);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["admin-users", appliedSearch, page],
    queryFn: () => list({ data: { search: appliedSearch, page, pageSize: PAGE_SIZE } }),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  const banMut = useMutation({
    mutationFn: async (input: { userId: string; banned: boolean }) => setBan({ data: input }),
    onSuccess: (_d, v) => {
      toast.success(v.banned ? "已封禁" : "已解封");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "操作失败"),
  });

  const roleMut = useMutation({
    mutationFn: async (input: { userId: string; isAdmin: boolean }) => setRole({ data: input }),
    onSuccess: (_d, v) => {
      toast.success(v.isAdmin ? "已设为管理员" : "已撤销管理员");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "操作失败"),
  });

  const users = q.data?.users ?? [];
  const total = q.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">用户管理</h1>
          <p className="mt-1 text-xs text-muted-foreground">共 {total} 个用户</p>
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setAppliedSearch(search.trim());
          }}
        >
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="手机号 / 昵称"
              className="h-8 w-56 pl-7 text-xs"
            />
          </div>
          <Button type="submit" size="sm" className="h-8">
            搜索
          </Button>
        </form>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">手机号</th>
              <th className="px-3 py-2 text-left font-medium">昵称</th>
              <th className="px-3 py-2 text-left font-medium">注册时间</th>
              <th className="px-3 py-2 text-right font-medium">项目</th>
              <th className="px-3 py-2 text-right font-medium">文案</th>
              <th className="px-3 py-2 text-left font-medium">角色</th>
              <th className="px-3 py-2 text-left font-medium">状态</th>
              <th className="px-3 py-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                </td>
              </tr>
            )}
            {!q.isLoading && users.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-xs text-muted-foreground">
                  没有用户
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-3 py-2 font-mono text-xs">{u.phone ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{u.nickname}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {new Date(u.created_at).toLocaleString().slice(0, 16)}
                </td>
                <td className="px-3 py-2 text-right text-xs">{u.project_count}</td>
                <td className="px-3 py-2 text-right text-xs">{u.copy_count}</td>
                <td className="px-3 py-2 text-xs">
                  {u.is_admin ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700">
                      管理员
                    </span>
                  ) : (
                    <span className="text-muted-foreground">用户</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">
                  {u.is_banned ? (
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive">
                      已封禁
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">
                      正常
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 px-2 text-[11px]"
                      onClick={() =>
                        roleMut.mutate({ userId: u.id, isAdmin: !u.is_admin })
                      }
                    >
                      {u.is_admin ? (
                        <>
                          <ShieldOff className="h-3 w-3" /> 撤销管理
                        </>
                      ) : (
                        <>
                          <Shield className="h-3 w-3" /> 设为管理
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 px-2 text-[11px] text-destructive hover:text-destructive"
                      onClick={() =>
                        banMut.mutate({ userId: u.id, banned: !u.is_banned })
                      }
                    >
                      {u.is_banned ? (
                        <>
                          <UserCheck className="h-3 w-3" /> 解封
                        </>
                      ) : (
                        <>
                          <UserX className="h-3 w-3" /> 封禁
                        </>
                      )}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2 text-xs text-muted-foreground">
        <span>
          第 {page} / {totalPages} 页
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-7"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          上一页
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          下一页
        </Button>
      </div>
    </div>
  );
}
