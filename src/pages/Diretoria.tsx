import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, FileDown, AlertTriangle, Users, Calculator, FileSpreadsheet } from "lucide-react";
import { fmtBRL, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { buildPeriod, PeriodType } from "@/lib/periods";
import { exportDistributionPdf } from "@/lib/profitDistributionPdf";
import { exportToXlsx } from "@/lib/exporter";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type Partner = {
  id: string;
  name: string;
  document?: string | null;
  role?: string | null;
  share_percent: number;
  pro_labore: number;
  active: boolean;
};

const emptyPartner: Partial<Partner> = {
  name: "", document: "", role: "Sócio", share_percent: 0, pro_labore: 0, active: true,
};

export default function Diretoria() {
  const { user } = useAuth();
  const { activeCompany } = useCompany();

  const [partners, setPartners] = useState<Partner[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  // ---- form sócio ----
  const [pOpen, setPOpen] = useState(false);
  const [pForm, setPForm] = useState<any>({ ...emptyPartner });

  // ---- distribuição ----
  const [periodType, setPeriodType] = useState<PeriodType>("mensal");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [quarter, setQuarter] = useState(Math.floor(new Date().getMonth() / 3) + 1);
  const [semester, setSemester] = useState(new Date().getMonth() < 6 ? 1 : 2);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const [revenue, setRevenue] = useState(0);
  const [expenses, setExpenses] = useState(0);
  const [taxes, setTaxes] = useState(0);
  const [costs, setCosts] = useState(0);
  const [mode, setMode] = useState<"proporcional" | "manual">("proporcional");
  const [manualValues, setManualValues] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");

  const period = useMemo(
    () => buildPeriod(periodType, year, { month, quarter, semester, customStart, customEnd }),
    [periodType, year, month, quarter, semester, customStart, customEnd]
  );

  const netProfit = revenue - expenses - taxes - costs;
  const activePartners = partners.filter(p => p.active);
  const sumShare = activePartners.reduce((s, p) => s + Number(p.share_percent), 0);

  // ===== Loaders =====
  const loadPartners = async () => {
    let q: any = supabase.from("partners").select("*").order("created_at");
    if (activeCompany) q = q.or(`company_id.eq.${activeCompany.id},company_id.is.null`);
    const { data } = await q;
    setPartners((data as Partner[]) || []);
  };

  const loadHistory = async () => {
    let q: any = supabase.from("profit_distributions").select("*, partner_distributions(*)").order("created_at", { ascending: false }).limit(50);
    if (activeCompany) q = q.or(`company_id.eq.${activeCompany.id},company_id.is.null`);
    const { data } = await q;
    setHistory((data as any[]) || []);
  };

  // Calcula automaticamente faturamento/despesas/impostos/custos do período via dados existentes
  const recalcFinancials = async () => {
    const start = period.start, end = period.end;
    const [recv, pay, tx] = await Promise.all([
      supabase.from("receivables").select("amount, cost").eq("received", true).gte("due_date", start).lte("due_date", end),
      supabase.from("payables").select("amount, category").eq("paid", true).gte("due_date", start).lte("due_date", end),
      supabase.from("transactions").select("amount, type, category").gte("date", start).lte("date", end),
    ]);
    const recvSum = (recv.data || []).reduce((s, r: any) => s + Number(r.amount || 0), 0);
    const recvCostSum = (recv.data || []).reduce((s, r: any) => s + Number(r.cost || 0), 0);
    const txReceita = (tx.data || []).filter((t: any) => t.type === "receita").reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
    const txDespesa = (tx.data || []).filter((t: any) => t.type === "despesa").reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
    const totalRevenue = recvSum + txReceita;
    const taxesSum = (pay.data || []).filter((p: any) => /imposto|tribut|tax/i.test(p.category || "")).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    const expensesSum = (pay.data || []).filter((p: any) => !/imposto|tribut|tax/i.test(p.category || "")).reduce((s: number, p: any) => s + Number(p.amount || 0), 0) + txDespesa;
    setRevenue(totalRevenue);
    setTaxes(taxesSum);
    setExpenses(expensesSum);
    setCosts(recvCostSum);
  };

  useEffect(() => { if (user) { loadPartners(); loadHistory(); } /* eslint-disable-next-line */ }, [user, activeCompany]);
  useEffect(() => { if (user) recalcFinancials(); /* eslint-disable-next-line */ }, [period.start, period.end, user, activeCompany]);

  // ===== Partner CRUD =====
  const openNewPartner = () => { setPForm({ ...emptyPartner }); setPOpen(true); };
  const openEditPartner = (p: Partner) => {
    setPForm({ id: p.id, name: p.name, document: p.document || "", role: p.role || "Sócio", share_percent: p.share_percent, pro_labore: p.pro_labore, active: p.active });
    setPOpen(true);
  };
  const savePartner = async () => {
    if (!pForm.name) return toast.error("Nome obrigatório");
    const payload = {
      name: pForm.name,
      document: pForm.document || null,
      role: pForm.role || "Sócio",
      share_percent: Number(pForm.share_percent) || 0,
      pro_labore: Number(pForm.pro_labore) || 0,
      active: !!pForm.active,
      company_id: activeCompany?.id ?? null,
    };
    const { error } = pForm.id
      ? await supabase.from("partners").update(payload).eq("id", pForm.id)
      : await supabase.from("partners").insert({ ...payload, user_id: user!.id });
    if (error) return toast.error(error.message);
    toast.success(pForm.id ? "Sócio atualizado" : "Sócio adicionado");
    setPOpen(false); loadPartners();
  };
  const delPartner = async (id: string) => {
    if (!confirm("Excluir este sócio?")) return;
    const { error } = await supabase.from("partners").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removido"); loadPartners();
  };

  // ===== Distribuição =====
  const computedRows = useMemo(() => {
    if (!activePartners.length || netProfit <= 0) return [];
    if (mode === "manual") {
      return activePartners.map(p => ({
        partner_id: p.id,
        partner_name: p.name,
        share_percent: Number(p.share_percent),
        amount: Number(manualValues[p.id] || 0),
      }));
    }
    return activePartners.map(p => ({
      partner_id: p.id,
      partner_name: p.name,
      share_percent: Number(p.share_percent),
      amount: netProfit * (Number(p.share_percent) / 100),
    }));
  }, [activePartners, netProfit, mode, manualValues]);

  const totalDistributed = computedRows.reduce((s, r) => s + r.amount, 0);

  const persistDistribution = async () => {
    if (!user) return;
    if (netProfit <= 0) return toast.error("Lucro líquido não positivo — distribuição bloqueada");
    if (!activePartners.length) return toast.error("Cadastre sócios ativos antes");
    if (mode === "proporcional" && Math.abs(sumShare - 100) > 0.01) {
      return toast.error(`Soma das participações = ${sumShare.toFixed(2)}%, deve ser 100%`);
    }
    if (mode === "manual" && totalDistributed > netProfit + 0.01) {
      return toast.error("Total manual excede o lucro líquido");
    }
    const { data: dist, error } = await supabase.from("profit_distributions").insert({
      user_id: user.id,
      company_id: activeCompany?.id ?? null,
      period_start: period.start,
      period_end: period.end,
      period_label: period.label,
      revenue, expenses, taxes, costs,
      net_profit: netProfit,
      total_distributed: totalDistributed,
      mode,
      notes: notes || null,
    }).select().single();
    if (error || !dist) return toast.error(error?.message || "Falha ao salvar");
    const items = computedRows.map(r => ({
      user_id: user.id,
      distribution_id: dist.id,
      partner_id: r.partner_id,
      partner_name: r.partner_name,
      share_percent: r.share_percent,
      amount: r.amount,
    }));
    if (items.length) {
      const { error: e2 } = await supabase.from("partner_distributions").insert(items);
      if (e2) return toast.error(e2.message);
    }
    toast.success("Distribuição registrada");
    loadHistory();
  };

  const generatePdf = () => {
    if (!computedRows.length) return toast.error("Nada para gerar");
    exportDistributionPdf({
      companyName: activeCompany?.name || "IMPÉRIO",
      companyCnpj: activeCompany?.cnpj || undefined,
      periodLabel: period.label,
      periodStart: period.start,
      periodEnd: period.end,
      revenue, expenses, taxes, costs,
      netProfit, totalDistributed, mode,
      partners: computedRows.map(r => ({ partner_name: r.partner_name, share_percent: r.share_percent, amount: r.amount })),
      notes,
    });
  };

  // PDF a partir do histórico salvo
  const reprintHistory = (h: any) => {
    exportDistributionPdf({
      companyName: activeCompany?.name || "IMPÉRIO",
      companyCnpj: activeCompany?.cnpj || undefined,
      periodLabel: h.period_label,
      periodStart: h.period_start,
      periodEnd: h.period_end,
      revenue: h.revenue, expenses: h.expenses, taxes: h.taxes, costs: h.costs,
      netProfit: h.net_profit, totalDistributed: h.total_distributed, mode: h.mode,
      partners: (h.partner_distributions || []).map((p: any) => ({ partner_name: p.partner_name, share_percent: p.share_percent, amount: p.amount })),
      notes: h.notes,
    });
  };

  const delHistory = async (id: string) => {
    if (!confirm("Excluir esta distribuição? Os valores rateados também serão estornados (removidos).")) return;
    // RLS + cascade lógico: removemos os filhos primeiro para garantir limpeza histórica.
    await supabase.from("partner_distributions").delete().eq("distribution_id", id);
    await supabase.from("profit_distributions").delete().eq("id", id);
    toast.success("Distribuição excluída e estornada");
    loadHistory();
  };

  // ===== Edição de distribuição salva =====
  const [editDist, setEditDist] = useState<any | null>(null);
  const [editRows, setEditRows] = useState<Array<{ id?: string; partner_id: string; partner_name: string; share_percent: number; amount: number }>>([]);
  const [editApur, setEditApur] = useState({ revenue: 0, expenses: 0, taxes: 0, costs: 0, notes: "" });

  const openEditDist = (h: any) => {
    setEditDist(h);
    setEditApur({ revenue: Number(h.revenue || 0), expenses: Number(h.expenses || 0), taxes: Number(h.taxes || 0), costs: Number(h.costs || 0), notes: h.notes || "" });
    setEditRows((h.partner_distributions || []).map((p: any) => ({
      id: p.id, partner_id: p.partner_id, partner_name: p.partner_name,
      share_percent: Number(p.share_percent), amount: Number(p.amount),
    })));
  };

  const editNetProfit = editApur.revenue - editApur.expenses - editApur.taxes - editApur.costs;
  const editTotalDistributed = editRows.reduce((s, r) => s + Number(r.amount || 0), 0);

  const saveEditDist = async () => {
    if (!editDist) return;
    if (editTotalDistributed > editNetProfit + 0.01) {
      return toast.error("Total rateado excede o lucro líquido recalculado");
    }
    const { error: e1 } = await supabase.from("profit_distributions").update({
      revenue: editApur.revenue, expenses: editApur.expenses, taxes: editApur.taxes, costs: editApur.costs,
      net_profit: editNetProfit, total_distributed: editTotalDistributed, notes: editApur.notes || null,
    }).eq("id", editDist.id);
    if (e1) return toast.error(e1.message);
    // Atualiza cada linha individualmente, mantendo IDs históricos.
    for (const r of editRows) {
      if (!r.id) continue;
      await supabase.from("partner_distributions").update({
        amount: r.amount, share_percent: r.share_percent,
      }).eq("id", r.id);
    }
    toast.success("Distribuição atualizada — relatórios recalculados");
    setEditDist(null);
    loadHistory();
  };

  /** Exporta o histórico de distribuições para XLSX. */
  const exportHistoryXlsx = () => {
    if (!history.length) return toast.error("Nada para exportar");
    const rows = history.flatMap(h =>
      (h.partner_distributions || []).map((p: any) => ({
        Data: fmtDate(h.created_at?.slice(0, 10)),
        Período: h.period_label,
        Modo: h.mode,
        Sócio: p.partner_name,
        "Participação (%)": Number(p.share_percent),
        Valor: Number(p.amount),
        "Lucro Líquido": Number(h.net_profit),
        "Total Distribuído": Number(h.total_distributed),
      }))
    );
    exportToXlsx(rows, `distribuicao-historico-${new Date().toISOString().slice(0, 10)}`, "Distribuições");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Diretoria" subtitle="Sócios, pró-labore e distribuição de lucros" />

      <Tabs defaultValue="socios">
        <TabsList>
          <TabsTrigger value="socios"><Users className="h-4 w-4 mr-1" /> Sócios</TabsTrigger>
          <TabsTrigger value="distribuir"><Calculator className="h-4 w-4 mr-1" /> Distribuir Lucros</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        {/* SOCIOS */}
        <TabsContent value="socios" className="space-y-3">
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              Soma das participações ativas: <span className={`font-bold ${Math.abs(sumShare - 100) < 0.01 ? "text-success" : "text-warning"}`}>{sumShare.toFixed(2)}%</span>
              {Math.abs(sumShare - 100) >= 0.01 && <span className="text-warning ml-2">(deve totalizar 100%)</span>}
            </div>
            <Dialog open={pOpen} onOpenChange={setPOpen}>
              <DialogTrigger asChild>
                <Button onClick={openNewPartner} className="bg-gradient-gold text-primary-foreground"><Plus className="h-4 w-4 mr-1" /> Sócio</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{pForm.id ? "Editar Sócio" : "Novo Sócio"}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Nome</Label><Input value={pForm.name} onChange={e => setPForm({ ...pForm, name: e.target.value })} /></div>
                    <div><Label>CPF/CNPJ</Label><Input value={pForm.document} onChange={e => setPForm({ ...pForm, document: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Cargo/Função</Label><Input value={pForm.role} onChange={e => setPForm({ ...pForm, role: e.target.value })} /></div>
                    <div><Label>Participação (%)</Label><Input type="number" step="0.01" value={pForm.share_percent} onChange={e => setPForm({ ...pForm, share_percent: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 items-end">
                    <div><Label>Pró-labore mensal (R$)</Label><Input type="number" step="0.01" value={pForm.pro_labore} onChange={e => setPForm({ ...pForm, pro_labore: e.target.value })} /></div>
                    <div className="flex items-center gap-2 pb-2"><Switch checked={!!pForm.active} onCheckedChange={v => setPForm({ ...pForm, active: v })} /><Label>Ativo</Label></div>
                  </div>
                </div>
                <DialogFooter><Button onClick={savePartner} className="bg-gradient-gold text-primary-foreground">Salvar</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Nome</TableHead><TableHead>CPF/CNPJ</TableHead><TableHead>Cargo</TableHead>
                <TableHead className="text-right">Participação</TableHead><TableHead className="text-right">Pró-labore</TableHead>
                <TableHead>Status</TableHead><TableHead className="w-24"></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {partners.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Nenhum sócio cadastrado</TableCell></TableRow>}
                {partners.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-sm">{p.document || "—"}</TableCell>
                    <TableCell className="text-sm">{p.role || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(p.share_percent).toFixed(2)}%</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtBRL(p.pro_labore)}</TableCell>
                    <TableCell>{p.active ? <Badge variant="outline" className="border-success/40 text-success">Ativo</Badge> : <Badge variant="outline">Inativo</Badge>}</TableCell>
                    <TableCell className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEditPartner(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => delPartner(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* DISTRIBUIR */}
        <TabsContent value="distribuir" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Período</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-5">
                <div>
                  <Label>Tipo</Label>
                  <Select value={periodType} onValueChange={(v: any) => setPeriodType(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensal">Mensal</SelectItem>
                      <SelectItem value="trimestral">Trimestral</SelectItem>
                      <SelectItem value="semestral">Semestral</SelectItem>
                      <SelectItem value="anual">Anual</SelectItem>
                      <SelectItem value="custom">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Ano</Label><Input type="number" value={year} onChange={e => setYear(Number(e.target.value))} /></div>
                {periodType === "mensal" && <div><Label>Mês</Label><Input type="number" min={1} max={12} value={month} onChange={e => setMonth(Number(e.target.value))} /></div>}
                {periodType === "trimestral" && <div><Label>Trimestre</Label><Input type="number" min={1} max={4} value={quarter} onChange={e => setQuarter(Number(e.target.value))} /></div>}
                {periodType === "semestral" && <div><Label>Semestre</Label><Input type="number" min={1} max={2} value={semester} onChange={e => setSemester(Number(e.target.value))} /></div>}
                {periodType === "custom" && <>
                  <div><Label>Início</Label><Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} /></div>
                  <div><Label>Fim</Label><Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} /></div>
                </>}
              </div>
              <div className="text-xs text-muted-foreground">Período: {period.label} ({fmtDate(period.start)} → {fmtDate(period.end)})</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Apuração (editável)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-4">
                <div><Label>Faturamento</Label><Input type="number" step="0.01" value={revenue} onChange={e => setRevenue(Number(e.target.value))} /></div>
                <div><Label>Despesas</Label><Input type="number" step="0.01" value={expenses} onChange={e => setExpenses(Number(e.target.value))} /></div>
                <div><Label>Impostos</Label><Input type="number" step="0.01" value={taxes} onChange={e => setTaxes(Number(e.target.value))} /></div>
                <div><Label>Custos</Label><Input type="number" step="0.01" value={costs} onChange={e => setCosts(Number(e.target.value))} /></div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-md bg-muted/30">
                <span className="text-sm text-muted-foreground">Lucro Líquido = Fat - Desp - Imp - Custos</span>
                <span className={`font-display text-2xl ${netProfit > 0 ? "text-success" : "text-destructive"}`}>{fmtBRL(netProfit)}</span>
              </div>
              {netProfit <= 0 && (
                <div className="flex items-start gap-2 p-3 rounded border border-destructive/30 bg-destructive/10 text-sm">
                  <AlertTriangle className="h-4 w-4 mt-0.5 text-destructive" />
                  Lucro líquido não positivo — distribuição bloqueada.
                </div>
              )}
              <Button variant="outline" size="sm" onClick={recalcFinancials}>Recalcular automaticamente</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Rateio</span>
                <div className="flex items-center gap-2 text-sm">
                  <Label>Modo</Label>
                  <Select value={mode} onValueChange={(v: any) => setMode(v)}>
                    <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="proporcional">Proporcional</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Table>
                <TableHeader><TableRow><TableHead>Sócio</TableHead><TableHead className="text-right">Participação</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                <TableBody>
                  {activePartners.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">Cadastre sócios ativos</TableCell></TableRow>}
                  {activePartners.map(p => {
                    const auto = netProfit > 0 ? netProfit * (Number(p.share_percent) / 100) : 0;
                    return (
                      <TableRow key={p.id}>
                        <TableCell>{p.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{Number(p.share_percent).toFixed(2)}%</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {mode === "manual"
                            ? <Input type="number" step="0.01" value={manualValues[p.id] ?? auto.toFixed(2)} onChange={e => setManualValues(v => ({ ...v, [p.id]: Number(e.target.value) }))} className="h-8 w-32 text-right ml-auto" />
                            : fmtBRL(auto)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between pt-2 border-t border-border/40">
                <span className="text-sm text-muted-foreground">Total a distribuir</span>
                <span className="font-display text-xl text-gold">{fmtBRL(totalDistributed)}</span>
              </div>
              <div><Label>Observações</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={generatePdf}><FileDown className="h-4 w-4 mr-1" /> PDF</Button>
                <Button onClick={persistDistribution} disabled={netProfit <= 0} className="bg-gradient-gold text-primary-foreground">Registrar Distribuição</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* HISTORICO */}
        <TabsContent value="historico" className="space-y-3">
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2"><FileDown className="h-4 w-4" /> Exportar histórico</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportHistoryXlsx}><FileSpreadsheet className="h-4 w-4 mr-2" /> Excel (.xlsx)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => history.forEach(reprintHistory)}><FileDown className="h-4 w-4 mr-2" /> PDF (todos)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Data</TableHead><TableHead>Período</TableHead><TableHead>Modo</TableHead>
                <TableHead className="text-right">Lucro</TableHead><TableHead className="text-right">Distribuído</TableHead>
                <TableHead className="w-40"></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {history.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Sem registros</TableCell></TableRow>}
                {history.map(h => (
                  <TableRow key={h.id}>
                    <TableCell className="text-sm">{fmtDate(h.created_at?.slice(0, 10))}</TableCell>
                    <TableCell>{h.period_label}</TableCell>
                    <TableCell><Badge variant="outline">{h.mode}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">{fmtBRL(h.net_profit)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtBRL(h.total_distributed)}</TableCell>
                    <TableCell className="flex gap-1">
                      <Button size="icon" variant="ghost" title="Editar" onClick={() => openEditDist(h)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" title="PDF" onClick={() => reprintHistory(h)}><FileDown className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" title="Excluir / Estornar" onClick={() => delHistory(h.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Dialog de edição da distribuição */}
          <Dialog open={!!editDist} onOpenChange={(v) => !v && setEditDist(null)}>
            <DialogContent className="max-w-3xl">
              <DialogHeader><DialogTitle>Editar Distribuição — {editDist?.period_label}</DialogTitle></DialogHeader>
              {editDist && (
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-4">
                    <div><Label>Faturamento</Label><Input type="number" step="0.01" value={editApur.revenue} onChange={e => setEditApur(s => ({ ...s, revenue: Number(e.target.value) }))} /></div>
                    <div><Label>Despesas</Label><Input type="number" step="0.01" value={editApur.expenses} onChange={e => setEditApur(s => ({ ...s, expenses: Number(e.target.value) }))} /></div>
                    <div><Label>Impostos</Label><Input type="number" step="0.01" value={editApur.taxes} onChange={e => setEditApur(s => ({ ...s, taxes: Number(e.target.value) }))} /></div>
                    <div><Label>Custos</Label><Input type="number" step="0.01" value={editApur.costs} onChange={e => setEditApur(s => ({ ...s, costs: Number(e.target.value) }))} /></div>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-muted/30 text-sm">
                    <span>Lucro Líquido recalculado</span>
                    <span className={`font-display text-lg ${editNetProfit > 0 ? "text-success" : "text-destructive"}`}>{fmtBRL(editNetProfit)}</span>
                  </div>
                  <Table>
                    <TableHeader><TableRow><TableHead>Sócio</TableHead><TableHead className="text-right">%</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {editRows.map((r, i) => (
                        <TableRow key={r.id || i}>
                          <TableCell>{r.partner_name}</TableCell>
                          <TableCell className="text-right">
                            <Input type="number" step="0.01" value={r.share_percent} className="h-8 w-24 text-right ml-auto"
                              onChange={e => setEditRows(arr => arr.map((x, idx) => idx === i ? { ...x, share_percent: Number(e.target.value) } : x))} />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input type="number" step="0.01" value={r.amount} className="h-8 w-32 text-right ml-auto"
                              onChange={e => setEditRows(arr => arr.map((x, idx) => idx === i ? { ...x, amount: Number(e.target.value) } : x))} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex items-center justify-between pt-2 border-t border-border/40">
                    <span className="text-sm text-muted-foreground">Total rateado</span>
                    <span className={`font-display text-lg ${editTotalDistributed > editNetProfit + 0.01 ? "text-destructive" : "text-gold"}`}>{fmtBRL(editTotalDistributed)}</span>
                  </div>
                  <div><Label>Observações</Label><Textarea rows={2} value={editApur.notes} onChange={e => setEditApur(s => ({ ...s, notes: e.target.value }))} /></div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditDist(null)}>Cancelar</Button>
                <Button onClick={saveEditDist} className="bg-gradient-gold text-primary-foreground">Salvar alterações</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
