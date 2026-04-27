import { Card, CardContent } from "@/components/ui/card";
import { Rocket } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

/**
 * Aba "Imperar — Crescimento" (placeholder Fase 1).
 *
 * O conteúdo de IA (diagnóstico, gargalos, sugestões de margem e marketing)
 * será implementado em fase posterior. Esta página já existe para que o
 * gating do plano Sênior funcione corretamente.
 */
export default function Imperar() {
  return (
    <div className="space-y-6">
      <PageHeader title="Imperar — Crescimento" subtitle="Inteligência para escalar faturamento, margem e clientes" />
      <Card className="border-border/60 bg-card/60 backdrop-blur">
        <CardContent className="p-10 flex flex-col items-center text-center gap-4">
          <Rocket className="h-12 w-12 text-primary" />
          <h2 className="font-display text-2xl tracking-wide">Em breve</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Diagnóstico inteligente da sua empresa, recomposição de margem e estratégias de marketing
            geradas a partir dos seus dados reais. Disponível no plano Gestão Sênior.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
