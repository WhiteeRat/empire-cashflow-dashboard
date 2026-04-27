import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Settings as SettingsIcon } from "lucide-react";
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

/**
 * Botão fixo de Configurações no header.
 * Sempre acessível, independente do estado dos pop-ups.
 */
export function SettingsDialog() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [s, setS] = useState<Settings>(defaults);

  useEffect(() => {
    if (!user || !open) return;
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
  }, [user, open]);

  const save = async (next: Partial<Settings>) => {
    const merged = { ...s, ...next };
    setS(merged);
    if (!user) return;
    const { data: existing } = await supabase.from("user_settings").select("id").eq("user_id", user.id).maybeSingle();
    if (existing) {
      await supabase.from("user_settings").update(merged).eq("user_id", user.id);
    } else {
      await supabase.from("user_settings").insert({ user_id: user.id, ...merged });
    }
    toast.success("Preferência salva");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Configurações" title="Configurações">
          <SettingsIcon className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Configurações</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Pop-up de pendências</div>
          <div className="flex items-center justify-between">
            <Label>Exibir pop-up ao entrar</Label>
            <Switch checked={s.show_pending_popup} onCheckedChange={v => save({ show_pending_popup: v })} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Orçamentos não finalizados</Label>
            <Switch checked={s.popup_show_budgets} onCheckedChange={v => save({ popup_show_budgets: v })} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Contas a pagar próximas</Label>
            <Switch checked={s.popup_show_payables} onCheckedChange={v => save({ popup_show_payables: v })} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Recebimentos próximos</Label>
            <Switch checked={s.popup_show_receivables} onCheckedChange={v => save({ popup_show_receivables: v })} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Agenda dos próximos 3 dias</Label>
            <Switch checked={s.popup_show_agenda} onCheckedChange={v => save({ popup_show_agenda: v })} />
          </div>

          <div className="text-xs uppercase tracking-widest text-muted-foreground pt-2 border-t border-border/40">Integrações</div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <Label>Usar faturamento do Dashboard em tempo real na Contabilidade</Label>
              <span className="text-xs text-muted-foreground">Quando ativo, a Contabilidade soma receitas (transações + recebíveis) do Dashboard automaticamente, dispensando importação manual de informes. O Dashboard também passa a exibir o total contábil registrado.</span>
            </div>
            <Switch checked={s.link_accounting_to_dashboard} onCheckedChange={v => save({ link_accounting_to_dashboard: v })} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
