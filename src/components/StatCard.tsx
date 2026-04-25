import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

type Tone = "gold" | "success" | "destructive" | "info" | "warning";

const toneMap: Record<Tone, { text: string; bg: string; ring: string }> = {
  gold: { text: "text-primary-glow", bg: "bg-primary/10", ring: "ring-primary/20" },
  success: { text: "text-success", bg: "bg-success/10", ring: "ring-success/20" },
  destructive: { text: "text-destructive", bg: "bg-destructive/10", ring: "ring-destructive/20" },
  info: { text: "text-blue-400", bg: "bg-blue-500/10", ring: "ring-blue-500/20" },
  warning: { text: "text-warning", bg: "bg-warning/10", ring: "ring-warning/20" },
};

export function StatCard({
  title, value, hint, icon: Icon, tone = "gold", children,
}: {
  title: string; value: ReactNode; hint?: string; icon?: LucideIcon; tone?: Tone; children?: ReactNode;
}) {
  const t = toneMap[tone];
  return (
    <Card className="relative overflow-hidden p-5 bg-card/60 border-border hover:border-primary/30 transition-smooth shadow-card group">
      <div className={cn("absolute inset-x-0 top-0 h-px", "bg-gradient-to-r from-transparent via-primary/40 to-transparent")} />
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className={cn("text-2xl md:text-3xl font-display font-semibold tracking-tight truncate", t.text)}>{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <div className={cn("rounded-lg p-2.5 ring-1", t.bg, t.ring)}>
            <Icon className={cn("h-5 w-5", t.text)} />
          </div>
        )}
      </div>
      {children}
    </Card>
  );
}
