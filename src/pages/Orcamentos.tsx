import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { fmtBRL, fmtDate } from "@/lib/format";
import { toast } from "sonner";

const AGENDA_TAGS = [
  { v: "REUNIÃO", c: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { v: "VISITA", c: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  { v: "ORÇAMENTO", c: "bg-primary/20 text-primary-glow border-primary/30" },
  { v: "EXECUÇÃO", c: "bg-success/20 text-success border-success/30" },
  { v: "ENTREGA", c: "bg-warning/20 text-warning border-warning/30" },
];

export default function Orcamentos() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({
    client: "", client_type: "PJ", city: "", product: "",
    start_date: "", end_date: "", agenda_tag: "ORÇAMENTO", status: "pendente",
    cost: "", margin_percent: "30", pay_commission: false, signal_value: "",
  });

  const load = async () => {
    const { data } = await supabase.from("budgets").select("*").order("start_date", { ascending: false });
    if (data) setItems(data);
  };
  useEffect(() => { if (user) load(); }, [user]);

  const compute = (cost: number, margin: number) => {
    const sale = cost * (1 + margin / 100);
    const markup = cost ? sale / cost : 0;
    const profit = sale - cost;
    return { sale, markup, profit };
  };

  const save = async () => {
    if (!form.client || !form.product) return toast.error("Pessoa e produto obrigatórios");
    const cost = Number(form.cost) || 0;
    const margin = Number(form.margin_percent) || 0;
    const { sale, markup, profit } = compute(cost, margin);
    const { error } = await supabase.from("budgets").insert({
      ...form, cost, margin_percent: margin, sale_value: sale, markup, net_profit: profit,
      signal_value: Number(form.signal_value) || 0,
      start_date: form.start_date || null, end_date: form.end_date || null,
      user_id: user!.id,
    });
    if (error) toast.error(error.message);
    else { toast.success("Orçamento salvo"); setOpen(false); load(); }
  };

  const toggleDone = async (id: string, done: boolean) => {
    await supabase.from("budgets").update({ done }).eq("id", id); load();
  };
  const del = async (id: string) => { await supabase.from("budgets").delete().eq("id", id); load(); };

  const tagClass = (t: string) => AGENDA_TAGS.find(a => a.v === t)?.c || "bg-muted text-muted-foreground";

  const previewSale = compute(Number(form.cost) || 0, Number(form.margin_percent) || 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orçamentos & Agenda"
        subtitle="CRM, produtividade e controle de contas"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-gradient-gold text-primary-foreground gap-2"><Plus className="h-4 w-4" /> Novo Orçamento</Button></DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Novo Orçamento / Conta</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Pessoa</Label><Input value={form.client} onChange={e => setForm({ ...form, client: e.target.value })} /></div>
                  <div><Label>Tipo</Label>
                    <Select value={form.client_type} onValueChange={v => setForm({ ...form, client_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="PF">Pessoa Física</SelectItem><SelectItem value="PJ">Pessoa Jurídica</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div><Label>Cidade</Label><Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
                </div>
                <div><Label>Produto / Serviço</Label><Input value={form.product} onChange={e => setForm({ ...form, product: e.target.value })} /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Início</Label><Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
                  <div><Label>Fim</Label><Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} /></div>
                  <div><Label>Agenda</Label>
                    <Select value={form.agenda_tag} onValueChange={v => setForm({ ...form, agenda_tag: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{AGENDA_TAGS.map(t => <SelectItem key={t.v} value={t.v}>{t.v}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border/40">
                  <div><Label>Custo Previsto</Label><Input type="number" step="0.01" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} /></div>
                  <div><Label>Margem (%)</Label><Input type="number" step="0.1" value={form.margin_percent} onChange={e => setForm({ ...form, margin_percent: e.target.value })} /></div>
                  <div><Label>Sinal</Label><Input type="number" step="0.01" value={form.signal_value} onChange={e => setForm({ ...form, signal_value: e.target.value })} /></div>
                </div>
                <div className="bg-primary/5 border border-primary/20 rounded-md p-3 grid grid-cols-3 gap-3 text-sm">
                  <div><span className="text-muted-foreground text-xs block">Valor Venda</span><span className="font-display text-lg text-gold">{fmtBRL(previewSale.sale)}</span></div>
                  <div><span className="text-muted-foreground text-xs block">Markup</span><span className="font-display text-lg text-primary">{previewSale.markup.toFixed(2)}x</span></div>
                  <div><span className="text-muted-foreground text-xs block">Lucro Líquido</span><span className="font-display text-lg text-success">{fmtBRL(previewSale.profit)}</span></div>
                </div>
                <div className="flex items-center gap-2"><Checkbox checked={form.pay_commission} onCheckedChange={v => setForm({ ...form, pay_commission: !!v })} id="comm" /><Label htmlFor="comm" className="cursor-pointer">Pagar comissão</Label></div>
              </div>
              <DialogFooter><Button onClick={save} className="bg-gradient-gold text-primary-foreground">Salvar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="p-0 bg-card/60 overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pessoa</TableHead><TableHead>Cidade</TableHead><TableHead>Produto/Serviço</TableHead>
                <TableHead>Início</TableHead><TableHead>Fim</TableHead><TableHead>Agenda</TableHead>
                <TableHead className="text-right">Custo</TableHead><TableHead className="text-right">Venda</TableHead>
                <TableHead className="text-right">Lucro</TableHead><TableHead className="text-right">Sinal</TableHead>
                <TableHead className="text-center">OK</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && <TableRow><TableCell colSpan={12} className="text-center py-10 text-muted-foreground">Nenhum orçamento</TableCell></TableRow>}
              {items.map(b => (
                <TableRow key={b.id} className={b.done ? "opacity-50" : ""}>
                  <TableCell><div className="font-medium">{b.client}</div><div className="text-[10px] uppercase text-muted-foreground">{b.client_type}</div></TableCell>
                  <TableCell className="text-sm">{b.city || "—"}</TableCell>
                  <TableCell>{b.product}</TableCell>
                  <TableCell className="text-sm">{fmtDate(b.start_date)}</TableCell>
                  <TableCell className="text-sm">{fmtDate(b.end_date)}</TableCell>
                  <TableCell><Badge variant="outline" className={tagClass(b.agenda_tag)}>{b.agenda_tag}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums">{fmtBRL(b.cost)}</TableCell>
                  <TableCell className="text-right tabular-nums text-primary-glow">{fmtBRL(b.sale_value)}</TableCell>
                  <TableCell className="text-right tabular-nums text-success font-medium">{fmtBRL(b.net_profit)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{fmtBRL(b.signal_value)}</TableCell>
                  <TableCell className="text-center"><Checkbox checked={b.done} onCheckedChange={(v) => toggleDone(b.id, !!v)} /></TableCell>
                  <TableCell><Button size="icon" variant="ghost" onClick={() => del(b.id)}><Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
