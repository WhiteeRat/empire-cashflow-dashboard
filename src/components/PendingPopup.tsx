import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertCircle, Settings as SettingsIcon, FileText, Wallet, Calendar } from "lucide-react";
import { fmtBRL, fmtDate } from "@/lib/format";
import { useNavigate } from "react-router-dom";

type Settings = {
  show_pending_popup: boolean;
  popup_show_budgets: boolean;
  popup_show_payables: boolean;
  popup_show_receivables: boolean;
  popup_show_agenda: boolean;
};

const defaultSettings: Settings = {
  show_pending_popup: true,
  popup_show_budgets: true,
  popup_show_payables: true,
  popup_show_receivables: true,
  popup_show_agenda: true,
};

export function PendingPopup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [pending, setPending] = useState<{ budgets: any[]; payables: any[]; receivables: any[]; agenda: any[] }>({
    budgets: [], payables: [], receivables: [], agenda: [],
  });
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!user || shown) return;
    (async () => {
      const { data: s } = await supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle();
      const cfg: Settings = s ? {
        show_pending_popup: s.show_pending_popup,
        popup_show_budgets: s.popup_show_budgets,
        popup_show_payables: s.popup_show_payables,
        popup_show_receivables: s.popup_show_receivables,
        popup_show_agenda: s.popup_show_agenda,
      } : defaultSettings;
      setSettings(cfg);
      if (!cfg.show_pending_popup) return;

      const today = new Date(); today.setHours(0, 0, 0, 0);
      const in7 = new Date(today); in7.setDate(in7.getDate() + 7);
      const in3 = new Date(today); in3.setDate(in3.getDate() + 3);
      const todayStr = today.toISOString().slice(0, 10);
      const in7Str = in7.toISOString().slice(0, 10);
      const in3Str = in3.toISOString().slice(0, 10);

      const [b, p, r, a] = await Promise.all([
        cfg.popup_show_budgets
          ? supabase.from("budgets").select("id,client,product,end_date").eq("done", false).order("end_date").limit(20)
          : Promise.resolve({ data: [] as any[] }),
        cfg.popup_show_payables
          ? supabase.from("payables").select("id,description,amount,due_date").eq("paid", false).lte("due_date", in7Str).order("due_date")
          : Promise.resolve({ data: [] as any[] }),
        cfg.popup_show_receivables
          ? supabase.from("receivables").select("id,client,amount,due_date").eq("received", false).lte("due_date", in7Str).order("due_date")
          : Promise.resolve({ data: [] as any[] }),
        cfg.popup_show_agenda
          ? supabase.from("budgets").select("id,client,product,start_date,agenda_tag").gte("start_date", todayStr).lte("start_date", in3Str).order("start_date")
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const data = {
        budgets: b.data || [],
        payables: p.data || [],
        receivables: r.data || [],
        agenda: a.data || [],
      };
      setPending(data);
      const total = data.budgets.length + data.payables.length + data.receivables.length + data.agenda.length;
      if (total > 0) setOpen(true);
      setShown(true);
    })();
  }, [user, shown]);

  const saveSettings = async (next: Partial<Settings>) => {
    const merged = { ...settings, ...next };
    setSettings(merged);
    if (!user) return;
    const { data: existing } = await supabase.from("user_settings").select("id").eq("user_id", user.id).maybeSingle();
    if (existing) {
      await supabase.from("user_settings").update(merged).eq("user_id", user.id);
    } else {
      await supabase.from("user_settings").insert({ user_id: user.id, ...merged });
    }
  };

  const go = (path: string) => { setOpen(false); navigate(path); };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              Pendências do Império
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {pending.budgets.length > 0 && (
              <section>
                <h3 className="flex items-center gap-2 text-sm font-medium text-primary mb-2">
                  <FileText className="h-4 w-4" /> Orçamentos não finalizados ({pending.budgets.length})
                </h3>
                <div className="space-y-1">
                  {pending.budgets.slice(0, 5).map(b => (
                    <div key={b.id} className="flex justify-between text-sm p-2 rounded bg-card/40 border border-border/30">
                      <span className="truncate">{b.client} — {b.product}</span>
                      <span className="text-xs text-muted-foreground">{b.end_date ? fmtDate(b.end_date) : "—"}</span>
                    </div>
                  ))}
                </div>
                <Button variant="link" size="sm" onClick={() => go("/orcamentos")} className="text-primary p-0 h-auto mt-1">Ver todos →</Button>
              </section>
            )}

            {pending.payables.length > 0 && (
              <section>
                <h3 className="flex items-center gap-2 text-sm font-medium text-destructive mb-2">
                  <Wallet className="h-4 w-4" /> Contas a pagar próximas ({pending.payables.length})
                </h3>
                <div className="space-y-1">
                  {pending.payables.slice(0, 5).map(p => (
                    <div key={p.id} className="flex justify-between text-sm p-2 rounded bg-card/40 border border-border/30">
                      <span className="truncate">{p.description}</span>
                      <span className="tabular-nums">{fmtBRL(p.amount)} • {fmtDate(p.due_date)}</span>
                    </div>
                  ))}
                </div>
                <Button variant="link" size="sm" onClick={() => go("/fluxo")} className="text-primary p-0 h-auto mt-1">Ver todas →</Button>
              </section>
            )}

            {pending.receivables.length > 0 && (
              <section>
                <h3 className="flex items-center gap-2 text-sm font-medium text-success mb-2">
                  <Wallet className="h-4 w-4" /> Recebimentos próximos ({pending.receivables.length})
                </h3>
                <div className="space-y-1">
                  {pending.receivables.slice(0, 5).map(r => (
                    <div key={r.id} className="flex justify-between text-sm p-2 rounded bg-card/40 border border-border/30">
                      <span className="truncate">{r.client}</span>
                      <span className="tabular-nums">{fmtBRL(r.amount)} • {fmtDate(r.due_date)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {pending.agenda.length > 0 && (
              <section>
                <h3 className="flex items-center gap-2 text-sm font-medium text-warning mb-2">
                  <Calendar className="h-4 w-4" /> Agenda próxima ({pending.agenda.length})
                </h3>
                <div className="space-y-1">
                  {pending.agenda.slice(0, 5).map(a => (
                    <div key={a.id} className="flex justify-between text-sm p-2 rounded bg-card/40 border border-border/30">
                      <span className="truncate">{a.client} — {a.product} <span className="text-xs text-muted-foreground">[{a.agenda_tag}]</span></span>
                      <span className="text-xs">{fmtDate(a.start_date)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <DialogFooter className="flex-row justify-between sm:justify-between">
            <Button variant="ghost" size="sm" onClick={() => setConfigOpen(true)} className="gap-2">
              <SettingsIcon className="h-4 w-4" /> Configurar
            </Button>
            <Button onClick={() => setOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Configurar pop-up de pendências</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Exibir pop-up ao entrar</Label>
              <Switch checked={settings.show_pending_popup} onCheckedChange={v => saveSettings({ show_pending_popup: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Orçamentos não finalizados</Label>
              <Switch checked={settings.popup_show_budgets} onCheckedChange={v => saveSettings({ popup_show_budgets: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Contas a pagar próximas</Label>
              <Switch checked={settings.popup_show_payables} onCheckedChange={v => saveSettings({ popup_show_payables: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Recebimentos próximos</Label>
              <Switch checked={settings.popup_show_receivables} onCheckedChange={v => saveSettings({ popup_show_receivables: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Agenda dos próximos 3 dias</Label>
              <Switch checked={settings.popup_show_agenda} onCheckedChange={v => saveSettings({ popup_show_agenda: v })} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
