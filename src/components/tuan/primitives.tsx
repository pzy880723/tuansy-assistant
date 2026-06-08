import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** Debounced inline text input that looks like plain text until focused. */
export function InlineText({
  value,
  onChange,
  placeholder,
  className,
  multiline,
  rows = 2,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  rows?: number;
}) {
  const [local, setLocal] = useState(value);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => setLocal(value), [value]);

  const flush = (v: string) => {
    setLocal(v);
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => onChange(v), 500);
  };

  const cls = cn(
    "w-full resize-none bg-transparent outline-none placeholder:text-[#c8c9cc]",
    "rounded-md px-1 py-0.5 -mx-1 transition",
    "focus:bg-white focus:ring-2 focus:ring-[#07c160]/30",
    className,
  );

  if (multiline) {
    return (
      <textarea
        value={local}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => flush(e.target.value)}
        className={cls}
      />
    );
  }
  return (
    <input
      value={local}
      placeholder={placeholder}
      onChange={(e) => flush(e.target.value)}
      className={cls}
    />
  );
}

/** Setting list row: title left, value right with chevron. */
export function SettingRow({
  label,
  value,
  badge,
  valueClassName,
  onClick,
}: {
  label: ReactNode;
  value?: ReactNode;
  badge?: string;
  valueClassName?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-2 px-4 py-3.5 text-left transition active:bg-[#f7f8fa]"
    >
      <div className="flex items-center gap-1.5 text-[14px] text-[#1a1a1a]">
        <span>{label}</span>
        {badge && (
          <span className="rounded-sm bg-[#fa5151] px-1 text-[9px] font-medium text-white">
            {badge}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 text-[13px] text-[#969799]">
        <span className={cn("max-w-[180px] truncate", valueClassName)}>{value}</span>
        <ChevronRight className="h-3.5 w-3.5 text-[#c8c9cc]" />
      </div>
    </button>
  );
}

/** Bottom sheet to edit a single text/select setting. */
export function SettingSheet({
  open,
  onOpenChange,
  title,
  initialValue,
  options,
  multiline,
  onSave,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  title: string;
  initialValue: string;
  options?: string[];
  multiline?: boolean;
  onSave: (v: string) => void;
}) {
  const [v, setV] = useState(initialValue);
  useEffect(() => setV(initialValue), [initialValue, open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="py-4">
          {options ? (
            <div className="space-y-2">
              {options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setV(opt)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border px-3 py-3 text-left text-sm transition",
                    v === opt
                      ? "border-[#07c160] bg-[#07c160]/5 text-[#07c160]"
                      : "border-border hover:bg-muted",
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          ) : multiline ? (
            <Textarea value={v} rows={4} onChange={(e) => setV(e.target.value)} />
          ) : (
            <Input value={v} onChange={(e) => setV(e.target.value)} />
          )}
        </div>
        <SheetFooter>
          <Button
            className="w-full bg-[#07c160] text-white hover:bg-[#06ad56]"
            onClick={() => {
              onSave(v);
              onOpenChange(false);
            }}
          >
            保存
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** Small outline buttons used in introduction block toolbars. */
export function MiniBtn({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-md border border-[#dcdee0] bg-white px-2 py-0.5 text-[11px] text-[#646566] transition",
        "hover:border-[#07c160] hover:text-[#07c160] active:bg-[#f7f8fa]",
        disabled && "opacity-40 hover:border-[#dcdee0] hover:text-[#646566]",
      )}
    >
      {children}
    </button>
  );
}

export function BackButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid h-7 w-7 place-items-center rounded-full bg-black/5 text-[#1a1a1a]"
    >
      <ChevronLeft className="h-4 w-4" />
    </button>
  );
}
