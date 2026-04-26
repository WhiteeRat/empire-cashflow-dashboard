import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
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
import { Plus, Trash2, Pencil, FileDown, X } from "lucide-react";
import { fmtBRL, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { exportBudgetPdf } from "@/lib/budgetPdf";

const AGENDA_TAGS = [
  { v: "REUNIÃO", c: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { v: "VISITA", c: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  { v: "ORÇAMENTO", c: "bg-primary/20 text-primary-glow border-primary/30" },
  { v: "EXECUÇÃO", c: "bg-success/20 text-success border-success/30" },
  { v: "ENTREGA", c: "bg-warning/20 text-warning border-warning/30" },
];

type CostRow = { id?: string; description: string; amount: string; category?: string };

const empty = {
  id: "", client: "", client_type: "PJ", city: "", product: "",
  start_date: "", end_date: "", agenda_tag: "ORÇAMENTO", status: "pendente",
  cost: "", margin_percent: "30", pay_commission: false, signal_value: "",
  commission_name: "", commission_percent: "0",
  payment_method: "", discount_cash: "",
};

export default function Orcamentos() {
  const { user } = useAuth();
  const { activeCompany } = useCompany();
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ ...empty });
  const [costs, setCosts] = useState<CostRow[]>([]);

  const load = async () => {
    let q = supabase.from("budgets").select("*").order("start_date", { ascending: false });
    if (activeCompany) q = q.or(`company_id.eq.${activeCompany.id},company_id.is.null`);
    const { data } = await q;
    if (data) setItems(data);
  };
  useEffect(() => { if (user) load(); }, [user, activeCompany]);

  // Computed: cost is the SUM of dynamic line items if any, otherwise the fixed cost field (legacy/back-compat)
  const dynamicCostTotal = costs.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const effectiveCost = costs.length > 0 ? dynamicCostTotal : (Number(form.cost) || 0);
  const margin = Number(form.margin_percent) || 0;
  const sale = effectiveCost * (1 + margin / 100);
  const markup = effectiveCost ? sale / effectiveCost : 0;
  const commissionPercent = Number(form.commission_percent) || 0;
  const commissionValue = sale * (commissionPercent / 100);
  const profit = sale - effectiveCost - commissionValue;

  const openNew = () => {
    setForm({ ...empty });
    setCosts([]);
    setOpen(true);
  };

  const openEdit = async (b: any) => {
    setForm({
      id: b.id, client: b.client, client_type: b.client_type || "PJ", city: b.city || "", product: b.product,
      start_date: b.start_date || "", end_date: b.end_date || "", agenda_tag: b.agenda_tag || "ORÇAMENTO", status: b.status || "pendente",
      cost: String(b.cost ?? ""), margin_percent: String(b.margin_percent ?? "30"),
      pay_commission: !!b.pay_commission, signal_value: String(b.signal_value ?? ""),
      commission_name: b.commission_name || "", commission_percent: String(b.commission_percent ?? "0"),
      payment_method: b.payment_method || "", discount_cash: String(b.discount_cash ?? ""),
    });
    const { data } = await supabase.from("budget_costs").select("*").eq("budget_id", b.id).order("created_at");
    setCosts((data || []).map(c => ({ id: c.id, description: c.description, amount: String(c.amount), category: c.category })));
    setOpen(true);
  };

  const addCost = () => setCosts([...costs, { description: "", amount: "", category: "outros" }]);
  const updCost = (i: number, patch: Partial<CostRow>) => setCosts(costs.map((c, idx) => idx === i ? { ...c, ...patch } : c));
  const rmCost = (i: number) => setCosts(costs.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!form.client || !form.product) return toast.error("Pessoa e produto obrigatórios");
    const totalCostForRecord = costs.length > 0 ? dynamicCostTotal : Number(form.cost) || 0;
    const payload: any = {
      client: form.client, client_type: form.client_type, city: form.city || null, product: form.product,
      start_date: form.start_date || null, end_date: form.end_date || null, agenda_tag: form.agenda_tag || null,
      status: form.status, cost: totalCostForRecord, margin_percent: margin,
      sale_value: sale, markup, net_profit: profit,
      pay_commission: !!form.pay_commission, signal_value: Number(form.signal_value) || 0,
      commission_name: form.commission_name || null,
      commission_percent: commissionPercent,
      commission_value: commissionValue,
      payment_method: form.payment_method || null,
      discount_cash: Number(form.discount_cash) || 0,
      company_id: activeCompany?.id || null,
    };
    let budgetId = form.id;
    if (form.id) {
      const { error } = await supabase.from("budgets").update(payload).eq("id", form.id);
      if (error) return toast.error(error.message);
    } else {
      const { data, error } = await supabase.from("budgets").insert({ ...payload, user_id: user!.id }).select("id").single();
      if (error) return toast.error(error.message);
      budgetId = data.id;
    }

    // Sync costs: delete old then insert current set (simple + reliable)
    if (budgetId) {
      await supabase.from("budget_costs").delete().eq("budget_id", budgetId);
      const valid = costs.filter(c => c.description.trim() && Number(c.amount) > 0);
      if (valid.length > 0) {
        await supabase.from("budget_costs").insert(valid.map(c => ({
          budget_id: budgetId,
          user_id: user!.id,
          description: c.description.trim(),
          amount: Number(c.amount),
          category: c.category || "outros",
        })));
      }
    }

    toast.success(form.id ? "Atualizado" : "Orçamento salvo");
    setOpen(false); load();
  };

  const toggleDone = async (id: string, done: boolean) => {
    await supabase.from("budgets").update({ done }).eq("id", id); load();
  };
  const del = async (id: string) => { await supabase.from("budgets").delete().eq("id", id); load(); };

  const exportPdf = async (b: any) => {
    const { data: cs } = await supabase.from("budget_costs").select("*").eq("budget_id", b.id).order("created_at");
    const list = (cs || []).map(c => ({ description: c.description, amount: Number(c.amount) }));
    const costTotal = list.length > 0 ? list.reduce((s, c) => s + c.amount, 0) : Number(b.cost) || 0;
    const finalCosts = list.length > 0 ? list : (Number(b.cost) > 0 ? [{ description: "Custo previsto", amount: Number(b.cost) }] : []);
    exportBudgetPdf({
      companyName: activeCompany?.name,
      companyCnpj: activeCompany?.cnpj || undefined,
      client: b.client,
      clientType: b.client_type,
      city: b.city,
      product: b.product,
      startDate: b.start_date,
      endDate: b.end_date,
      costs: finalCosts,
      costTotal,
      saleValue: Number(b.sale_value) || 0,
      marginPercent: Number(b.margin_percent) || 0,
      signalValue: Number(b.signal_value) || 0,
      commissionName: b.commission_name,
      commissionPercent: Number(b.commission_percent) || 0,
      commissionValue: Number(b.commission_value) || 0,
      netProfit: Number(b.net_profit) || 0,
      showCommission: !!b.pay_commission || !!b.commission_name,
    });
  };

  const tagClass = (t: string) => AGENDA_TAGS.find(a => a.v === t)?.c || "bg-muted text-muted-foreground";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orçamentos & Agenda"
        subtitle={activeCompany ? `Empresa: ${activeCompany.name}` : "CRM, produtividade e controle de contas"}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={openNew} className="bg-gradient-gold text-primary-foreground gap-2"><Plus className="h-4 w-4" /> Novo Orçamento</Button></DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{form.id ? "Editar Orçamento" : "Novo Orçamento / Conta"}</DialogTitle></DialogHeader>
              <div className="space-y-4">
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

                {/* Custos detalhados */}
                <div className="pt-2 border-t border-border/40">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium">Custos detalhados (opcional)</Label>
                    <Button type="button" size="sm" variant="ghost" onClick={addCost} className="gap-1 text-primary"><Plus className="h-3 w-3" /> Adicionar linha</Button>
                  </div>
                  {costs.length === 0 && (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-3"><Label>Custo Previsto (simples)</Label><Input type="number" step="0.01" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} placeholder="Use este campo OU adicione linhas detalhadas abaixo" /></div>
                    </div>
                  )}
                  {costs.length > 0 && (
                    <div className="space-y-2">
                      {costs.map((c, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2">
                          <Select value={c.category || "outros"} onValueChange={v => updCost(i, { category: v })}>
                            <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="material">Material</SelectItem>
                              <SelectItem value="mao_de_obra">Mão de obra</SelectItem>
                              <SelectItem value="outros">Outros</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input className="col-span-6" placeholder="Descrição" value={c.description} onChange={e => updCost(i, { description: e.target.value })} />
                          <Input className="col-span-2" type="number" step="0.01" placeholder="0,00" value={c.amount} onChange={e => updCost(i, { amount: e.target.value })} />
                          <Button type="button" size="icon" variant="ghost" onClick={() => rmCost(i)} className="col-span-1"><X className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      ))}
                      <div className="text-right text-sm text-muted-foreground">Total custos: <span className="font-medium text-foreground">{fmtBRL(dynamicCostTotal)}</span></div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Margem (%)</Label><Input type="number" step="0.1" value={form.margin_percent} onChange={e => setForm({ ...form, margin_percent: e.target.value })} /></div>
                  <div><Label>Sinal</Label><Input type="number" step="0.01" value={form.signal_value} onChange={e => setForm({ ...form, signal_value: e.target.value })} /></div>
                </div>

                {/* Comissão */}
                <div className="pt-2 border-t border-border/40 bg-warning/5 -mx-2 px-2 rounded-md">
                  <Label className="text-sm font-medium block mb-2">Comissão</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2"><Label className="text-xs">Responsável</Label><Input value={form.commission_name} onChange={e => setForm({ ...form, commission_name: e.target.value })} placeholder="Nome do comissionado" /></div>
                    <div><Label className="text-xs">% Comissão</Label><Input type="number" step="0.1" value={form.commission_percent} onChange={e => setForm({ ...form, commission_percent: e.target.value })} /></div>
                  </div>
                  {commissionValue > 0 && (
                    <div className="text-right text-sm mt-2 text-warning font-medium">Valor da comissão: {fmtBRL(commissionValue)}</div>
                  )}
                </div>

                <div className="bg-primary/5 border border-primary/20 rounded-md p-3 grid grid-cols-4 gap-3 text-sm">
                  <div><span className="text-muted-foreground text-xs block">Valor Venda</span><span className="font-display text-lg text-gold">{fmtBRL(sale)}</span></div>
                  <div><span className="text-muted-foreground text-xs block">Markup</span><span className="font-display text-lg text-primary">{markup.toFixed(2)}x</span></div>
                  <div><span className="text-muted-foreground text-xs block">Comissão</span><span className="font-display text-lg text-warning">{fmtBRL(commissionValue)}</span></div>
                  <div><span className="text-muted-foreground text-xs block">Lucro Líquido</span><span className="font-display text-lg text-success">{fmtBRL(profit)}</span></div>
                </div>
                <div className="flex items-center gap-2"><Checkbox checked={form.pay_commission} onCheckedChange={v => setForm({ ...form, pay_commission: !!v })} id="comm" /><Label htmlFor="comm" className="cursor-pointer">Incluir comissão no PDF do orçamento</Label></div>
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
                <TableHead className="text-right">Comissão</TableHead>
                <TableHead className="text-right">Lucro</TableHead><TableHead className="text-right">Sinal</TableHead>
                <TableHead className="text-center">OK</TableHead><TableHead className="w-32"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && <TableRow><TableCell colSpan={13} className="text-center py-10 text-muted-foreground">Nenhum orçamento</TableCell></TableRow>}
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
                  <TableCell className="text-right tabular-nums text-warning">
                    {b.commission_value > 0 ? <span title={b.commission_name || ""}>{fmtBRL(b.commission_value)}</span> : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-success font-medium">{fmtBRL(b.net_profit)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{fmtBRL(b.signal_value)}</TableCell>
                  <TableCell className="text-center"><Checkbox checked={b.done} onCheckedChange={(v) => toggleDone(b.id, !!v)} /></TableCell>
                  <TableCell className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => exportPdf(b)} title="Exportar PDF"><FileDown className="h-4 w-4 text-muted-foreground hover:text-primary" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(b)}><Pencil className="h-4 w-4 text-muted-foreground hover:text-primary" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => del(b.id)}><Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
