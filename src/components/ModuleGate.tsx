import { ReactNode } from "react";
import { Lock } from "lucide-react";
import { usePlanAccess } from "@/hooks/usePlanAccess";
import { moduleByPath, type ModuleKey } from "@/lib/modules";
import { useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  /** Chave do módulo. Se omitida, infere pela rota atual. */
  moduleKey?: ModuleKey;
  children: ReactNode;
};

/**
 * ModuleGate
 *
 * Bloqueia o conteúdo de uma página inteira quando o módulo não está liberado
 * para a empresa ativa. Mostra a mensagem padrão exigida pelo produto.
 */
export function ModuleGate({ moduleKey, children }: Props) {
  const { has, loading } = usePlanAccess();
  const { pathname } = useLocation();
  const key = moduleKey ?? moduleByPath(pathname)?.key;

  if (loading) return <>{children}</>;
  if (!key || has(key)) return <>{children}</>;

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6 animate-fade-in">
      <Card className="max-w-lg w-full border-border/60 bg-card/60 backdrop-blur">
        <CardContent className="p-8 flex flex-col items-center text-center gap-4">
          <div className="h-14 w-14 rounded-full bg-muted/40 flex items-center justify-center">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <h2 className="font-display text-2xl tracking-wide text-foreground">
            Aba bloqueada pelo administrador
          </h2>
          <p className="text-sm text-muted-foreground">
            Adquira uma assinatura e erga seu império.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
