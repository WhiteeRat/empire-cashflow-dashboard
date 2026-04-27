import { ReactNode } from "react";
import { ModuleGate } from "@/components/ModuleGate";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import type { ModuleKey } from "@/lib/modules";

/**
 * GuardedRoute
 *
 * Combina autenticação + layout + bloqueio por plano em uma única rota.
 * Mantém a estrutura existente intacta — apenas adiciona o ModuleGate
 * em volta do conteúdo da página.
 */
export function GuardedRoute({ moduleKey, children }: { moduleKey: ModuleKey; children: ReactNode }) {
  return (
    <ProtectedRoute>
      <AppLayout>
        <ModuleGate moduleKey={moduleKey}>{children}</ModuleGate>
      </AppLayout>
    </ProtectedRoute>
  );
}
