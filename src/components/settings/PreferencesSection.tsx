import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Settings = {
  show_pending_popup: boolean;
  popup_show_budgets: boolean;
  popup_show_payables: boolean;
  popup_show_receivables: boolean;
  popup_show_agenda: boolean;
  link_accounting_to_dashboard: boolean;
};

const defaults: Settings = {
  show_pending_popup: true,
  popup_show_budgets: true,
  popup_show_payables: true,
  popup_show_receivables: true,
  popup_show_agenda: true,
  link_accounting_to_dashboard: false,
};

export function PreferencesSection() {
  const { user } = useAuth();
  const [s, setS] = useState<Settings>(defaults);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle();
      if (data) {
        setS({
          show_pending_popup: data.show_pending_popup,
          popup_show_budgets: data.popup_show_budgets,
          popup_show_payables: data.popup_show_payables,
          popup_show_receivables: data.popup_show_receivables,
          popup_show_agenda: data.popup_show_agenda,
          link_accounting_to_dashboard: (data as any).link_accounting_to_dashboard ?? false,
        });
      }
    })();
  }, [user]);

  const save = async (next: Partial<Settings>) => {
    const merged = { ...s, ...next };
    setS(merged);
    if (!user) return;
    const { data: existing } = await supabase.from("user_settings").select("id").eq("user_id", user.id).maybeSingle();
    if (existing) await supabase.from("user_settings").update(merged).eq("user_id", user.id);
    else await supabase.from("user_settings").insert({ user_id: user.id, ...merged });
    toast.success("Preferência salva");
  };

  const Row = ({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) => (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="flex flex-col">
        <Label className="text-sm">{label}</Label>
        {hint && <span className="text-xs text-muted-foreground mt-0.5">{hint}</span>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );

  return (
    <Card>
      <CardHeader><CardTitle className="text-base font-display">Preferências</CardTitle></CardHeader>
      <CardContent className="divide-y divide-border/40">
        <div className="pb-2 text-xs uppercase tracking-widest text-muted-foreground">Pop-up de pendências</div>
        <Row label="Exibir pop-up ao entrar"               checked={s.show_pending_popup}      onChange={v => save({ show_pending_popup: v })} />
        <Row label="Orçamentos não finalizados"             checked={s.popup_show_budgets}      onChange={v => save({ popup_show_budgets: v })} />
        <Row label="Contas a pagar próximas"                checked={s.popup_show_payables}     onChange={v => save({ popup_show_payables: v })} />
        <Row label="Recebimentos próximos"                  checked={s.popup_show_receivables}  onChange={v => save({ popup_show_receivables: v })} />
        <Row label="Agenda dos próximos 3 dias"             checked={s.popup_show_agenda}       onChange={v => save({ popup_show_agenda: v })} />
        <div className="pt-3 pb-2 text-xs uppercase tracking-widest text-muted-foreground">Integrações</div>
        <Row
          label="Usar faturamento do Dashboard em tempo real na Contabilidade"
          hint="Quando ativo, a Contabilidade soma receitas (transações + recebíveis) automaticamente."
          checked={s.link_accounting_to_dashboard}
          onChange={v => save({ link_accounting_to_dashboard: v })}
        />
      </CardContent>
    </Card>
  );
}
