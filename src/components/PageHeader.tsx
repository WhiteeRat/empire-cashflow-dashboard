import { ReactNode } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { Building2 } from "lucide-react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  const { activeCompany } = useCompany();
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 pb-4 border-b border-border/50">
      <div className="min-w-0">
        <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-gold break-words">{title}</h1>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {subtitle && <p className="text-sm text-muted-foreground break-words">{subtitle}</p>}
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border border-primary/30 bg-primary/5 text-primary/90">
            <Building2 className="h-3 w-3" />
            {activeCompany ? activeCompany.name : "Todas as empresas (legado)"}
          </span>
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
