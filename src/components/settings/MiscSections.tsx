import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Plug } from "lucide-react";
import { usePlanAccess } from "@/hooks/usePlanAccess";
import { Badge } from "@/components/ui/badge";

export function PermissionsSection() {
  const { isSuperAdmin } = usePlanAccess();
  return (
    <Card>
      <CardHeader><CardTitle className="text-base font-display flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Permissões</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          Seu papel: {isSuperAdmin
            ? <Badge className="bg-gradient-gold text-primary-foreground">Super Admin</Badge>
            : <Badge variant="outline">Usuário</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">
          Apenas o super administrador pode liberar planos, alterar valores e ativar módulos manualmente.
          Cada usuário só enxerga e edita os dados das empresas que cadastrou.
        </p>
      </CardContent>
    </Card>
  );
}

export function IntegrationsSection() {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base font-display flex items-center gap-2"><Plug className="h-4 w-4" /> Integrações</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>Integrações disponíveis:</p>
        <ul className="list-disc list-inside text-xs space-y-1">
          <li>Lovable AI (diagnóstico Imperar) — habilitado.</li>
          <li>Importador de extratos bancários (PDF) — habilitado.</li>
          <li>Importador de informe contábil — habilitado.</li>
        </ul>
        <p className="text-xs">Novas integrações (gateway de pagamento, NF-e) serão liberadas em fases futuras.</p>
      </CardContent>
    </Card>
  );
}
