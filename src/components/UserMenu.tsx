import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { LogOut, User } from "lucide-react";
import { signOut } from "@/lib/auth.functions";
import { notifyAuthChange, useCurrentUser } from "@/lib/use-current-user";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const logout = useServerFn(signOut);

  if (!user) return null;

  const handleSignOut = async () => {
    await logout();
    notifyAuthChange();
    navigate({ to: "/auth", replace: true });
  };

  const label =
    user.phone ? `尾号 ${user.phone.slice(-4)}` : user.wechat ? "微信用户" : user.nickname;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex h-7 items-center gap-1.5 rounded-full bg-muted px-2.5 text-xs text-foreground transition hover:bg-accent">
        <User className="h-3.5 w-3.5" /> {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          <div className="text-foreground">{user.nickname}</div>
          {user.isAdmin ? <div className="mt-0.5 text-[11px] text-primary">超级管理员</div> : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-xs">
          <LogOut className="h-3.5 w-3.5" /> 退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
