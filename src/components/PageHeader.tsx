import { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 pb-4 border-b border-border/50">
      <div className="min-w-0">
        <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-gold break-words">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1 break-words">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
