import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { scope, withCompany } from "@/lib/companyScope";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Upload, Trash2, ArrowDownCircle, ArrowUpCircle, Pencil, FileText, HandCoins } from "lucide-react";
import { fmtBRL, fmtDate } from "@/lib/format";
import { importSheet } from "@/lib/exporter";
import { parsePdfStatement, PdfRow } from "@/lib/pdfImporter";
import { toast } from "sonner";

type AnyRec = Record<string, any>;

const emptyTx = { id: "", date: new Date().toISOString().slice(0, 10), description: "", category: "", type: "receita", amount: "", bank_id: "" };
const emptyPay = { id: "", category: "Operação", priority: "Alta", description: "", amount: "", due_date: "" };
const emptyRec = { id: "", client: "", project: "", due_date: "", cost: "", amount: "" };

export default function FluxoCaixa() {
  const { user } = useAuth();
  const { activeCompany } = useCompany();
  const companyId = activeCompany?.id ?? null;
  const [txs, setTxs] = useState<AnyRec[]>([]);
  const [payables, setPayables] = useState<AnyRec[]>([]);
  const [receivables, setReceivables] = useState<AnyRec[]>([]);
  const [banks, setBanks] = useState<AnyRec[]>([]);
  const [partners, setPartners] = useState<AnyRec[]>([]);
  const [withdrawals, setWithdrawals] = useState<AnyRec[]>([]);

  const [wOpen, setWOpen] = useState(false);
  const [wForm, setWForm] = useState<AnyRec>({
    id: "", partner_id: "", date: new Date().toISOString().slice(0, 10),
    amount: "", notes: "", bank_id: "", applied_to_prolabore: true,
  });

  const [txDialog, setTxDialog] = useState(false);
  const [payDialog, setPayDialog] = useState(false);
  const [recDialog, setRecDialog] = useState(false);
  const [pdfDialog, setPdfDialog] = useState(false);

  const [txForm, setTxForm] = useState<AnyRec>({ ...emptyTx });
  const [payForm, setPayForm] = useState<AnyRec>({ ...emptyPay });
  const [recForm, setRecForm] = useState<AnyRec>({ ...emptyRec });

  // PDF preview
  const [pdfRows, setPdfRows] = useState<PdfRow[]>([]);
  const [pdfBankId, setPdfBankId] = useState<string>("");
  const [pdfLoading, setPdfLoading] = useState(false);

  // Filtros (Fluxo)
  const [fStart, setFStart] = useState("");
  const [fEnd, setFEnd] = useState("");
  const [fType, setFType] = useState<"todos" | "receita" | "despesa">("todos");
  const [fSearch, setFSearch] = useState("");

  // Edição inline transactions
  const [inlineEdit, setInlineEdit] = useState<{ id: string; field: string } | null>(null);

  const load = async () => {
    const [t, p, r, b, prt, wd] = await Promise.all([
      scope(supabase.from("transactions").select("*").order("date", { ascending: false }), companyId),
      scope(supabase.from("payables").select("*").order("due_date", { ascending: true }), companyId),
      scope(supabase.from("receivables").select("*").order("due_date", { ascending: true }), companyId),
      scope(supabase.from("banks").select("*"), companyId),
      scope(supabase.from("partners").select("*").order("name"), companyId),
      scope(supabase.from("partner_withdrawals").select("*").order("date", { ascending: false }).limit(200), companyId),
    ]);
    if (t.data) setTxs(t.data);
    if (p.data) setPayables(p.data);
    if (r.data) setReceivables(r.data);
    if (b.data) setBanks(b.data);
    if (prt.data) setPartners(prt.data);
    if (wd.data) setWithdrawals(wd.data);
  };

  useEffect(() => { if (user) load(); }, [user, companyId]);

  // ===== Sangria (retirada de sócio) =====
  const openNewW = () => setWForm({ id: "", partner_id: "", date: new Date().toISOString().slice(0, 10), amount: "", notes: "", bank_id: "", applied_to_prolabore: true });
  const saveW = async () => {
    if (!wForm.partner_id || !wForm.amount) return toast.error("Selecione sócio e informe valor");
    const partner = partners.find(p => p.id === wForm.partner_id);
    if (!partner) return toast.error("Sócio inválido");
    const amount = Number(wForm.amount);
    // Aviso (não bloqueia) se exceder pró-labore mensal disponível
    if (wForm.applied_to_prolabore && partner.pro_labore && amount > Number(partner.pro_labore)) {
      toast.warning(`Atenção: retirada (${amount}) excede pró-labore mensal (${partner.pro_labore})`);
    }
    const payload = {
      partner_id: partner.id,
      partner_name: partner.name,
      date: wForm.date,
      amount,
      notes: wForm.notes || null,
      bank_id: wForm.bank_id || null,
      applied_to_prolabore: !!wForm.applied_to_prolabore,
    };
    const { error } = await supabase.from("partner_withdrawals").insert(withCompany({ ...payload, user_id: user!.id }, companyId));
    if (error) return toast.error(error.message);
    // Cria também um lançamento de despesa no fluxo de caixa para refletir a saída
    await supabase.from("transactions").insert(withCompany({
      user_id: user!.id,
      date: wForm.date,
      type: "despesa",
      amount,
      description: `Sangria — ${partner.name}`,
      category: "Retirada de Sócio",
      bank_id: wForm.bank_id || null,
    }, companyId));
    if (wForm.bank_id) await applyBankDelta(wForm.bank_id, -amount);
    toast.success("Sangria registrada");
    setWOpen(false); load();
  };
  const delW = async (id: string) => {
    if (!confirm("Excluir esta retirada? O lançamento no fluxo continuará registrado — exclua-o manualmente se desejar.")) return;
    await supabase.from("partner_withdrawals").delete().eq("id", id);
    load();
  };

  // Pró-labore disponível por sócio no mês corrente: pro_labore - somatório das sangrias do mês marcadas para descontar
  const prolaboreInfo = (partnerId: string) => {
    const p = partners.find(x => x.id === partnerId);
    if (!p) return { proLabore: 0, used: 0, remaining: 0 };
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const used = withdrawals
      .filter(w => w.partner_id === partnerId && w.applied_to_prolabore && String(w.date).startsWith(ym))
      .reduce((s, w) => s + Number(w.amount || 0), 0);
    return { proLabore: Number(p.pro_labore || 0), used, remaining: Number(p.pro_labore || 0) - used };
  };


  // ===== Transactions =====
  // Aplica delta no saldo do banco (positivo = entrada, negativo = saída)
  const applyBankDelta = async (bankId: string | null | undefined, delta: number) => {
    if (!bankId || !delta) return;
    const { data } = await supabase.from("banks").select("balance").eq("id", bankId).maybeSingle();
    if (!data) return;
    const newBal = Number(data.balance || 0) + delta;
    await supabase.from("banks").update({ balance: newBal }).eq("id", bankId);
  };
  const txDelta = (type: string, amount: number) => (type === "receita" ? 1 : -1) * Math.abs(Number(amount) || 0);

  const openNewTx = () => { setTxForm({ ...emptyTx }); setTxDialog(true); };
  const openEditTx = (t: AnyRec) => {
    setTxForm({ id: t.id, date: t.date, description: t.description, category: t.category || "", type: t.type, amount: String(t.amount), bank_id: t.bank_id || "" });
    setTxDialog(true);
  };
  const saveTx = async () => {
    if (!txForm.description || !txForm.amount) return toast.error("Preencha descrição e valor");
    const payload = {
      date: txForm.date as string,
      description: txForm.description as string,
      category: (txForm.category || null) as string | null,
      type: txForm.type as string,
      amount: Number(txForm.amount),
      bank_id: (txForm.bank_id || null) as string | null,
    };
    if (txForm.id) {
      // Reverter saldo antigo e aplicar novo
      const prev = txs.find(t => t.id === txForm.id);
      const { error } = await supabase.from("transactions").update(payload).eq("id", txForm.id);
      if (error) return toast.error(error.message);
      if (prev) await applyBankDelta(prev.bank_id, -txDelta(prev.type, prev.amount));
      await applyBankDelta(payload.bank_id, txDelta(payload.type, payload.amount));
    } else {
      const { error } = await supabase.from("transactions").insert(withCompany({ ...payload, user_id: user!.id }, companyId));
      if (error) return toast.error(error.message);
      await applyBankDelta(payload.bank_id, txDelta(payload.type, payload.amount));
    }
    toast.success(txForm.id ? "Lançamento atualizado" : "Lançamento adicionado");
    setTxDialog(false); load();
  };
  const delTx = async (id: string) => {
    const prev = txs.find(t => t.id === id);
    await supabase.from("transactions").delete().eq("id", id);
    if (prev) await applyBankDelta(prev.bank_id, -txDelta(prev.type, prev.amount));
    load();
  };

  const inlineUpdateTx = async (id: string, field: string, value: any) => {
    const v = field === "amount" ? Number(value) : value;
    const prev = txs.find(t => t.id === id);
    await (supabase.from("transactions") as any).update({ [field]: v }).eq("id", id);
    if (prev && (field === "amount" || field === "type" || field === "bank_id")) {
      await applyBankDelta(prev.bank_id, -txDelta(prev.type, prev.amount));
      const next = { ...prev, [field]: v };
      await applyBankDelta(next.bank_id, txDelta(next.type, next.amount));
    }
    setInlineEdit(null); load();
  };

  // ===== Payables =====
  const openNewPay = () => { setPayForm({ ...emptyPay }); setPayDialog(true); };
  const openEditPay = (p: AnyRec) => {
    setPayForm({ id: p.id, category: p.category, priority: p.priority, description: p.description, amount: String(p.amount), due_date: p.due_date || "" });
    setPayDialog(true);
  };
  const savePay = async () => {
    if (!payForm.description || !payForm.amount) return toast.error("Preencha descrição e valor");
    const payload = {
      category: payForm.category as string,
      priority: payForm.priority as string,
      description: payForm.description as string,
      amount: Number(payForm.amount),
      due_date: (payForm.due_date || null) as string | null,
    };
    const { error } = payForm.id
      ? await supabase.from("payables").update(payload).eq("id", payForm.id)
      : await supabase.from("payables").insert(withCompany({ ...payload, user_id: user!.id }, companyId));
    if (error) return toast.error(error.message);
    toast.success(payForm.id ? "Conta atualizada" : "Conta adicionada");
    setPayDialog(false); load();
  };
  const togglePay = async (id: string, paid: boolean) => { await supabase.from("payables").update({ paid }).eq("id", id); load(); };
  const delPay = async (id: string) => { await supabase.from("payables").delete().eq("id", id); load(); };

  // ===== Receivables =====
  const openNewRec = () => { setRecForm({ ...emptyRec }); setRecDialog(true); };
  const openEditRec = (r: AnyRec) => {
    setRecForm({ id: r.id, client: r.client, project: r.project || "", due_date: r.due_date || "", cost: String(r.cost), amount: String(r.amount) });
    setRecDialog(true);
  };
  const saveRec = async () => {
    if (!recForm.client || !recForm.amount) return toast.error("Preencha pessoa e valor");
    const payload = {
      client: recForm.client as string,
      project: (recForm.project || null) as string | null,
      due_date: (recForm.due_date || null) as string | null,
      cost: Number(recForm.cost) || 0,
      amount: Number(recForm.amount),
    };
    const { error } = recForm.id
      ? await supabase.from("receivables").update(payload).eq("id", recForm.id)
      : await supabase.from("receivables").insert(withCompany({ ...payload, user_id: user!.id }, companyId));
    if (error) return toast.error(error.message);
    toast.success(recForm.id ? "Recebível atualizado" : "Recebível adicionado");
    setRecDialog(false); load();
  };
  const toggleRec = async (id: string, received: boolean) => { await supabase.from("receivables").update({ received }).eq("id", id); load(); };
  const delRec = async (id: string) => { await supabase.from("receivables").delete().eq("id", id); load(); };

  // ===== Imports =====
  const importExtrato = async (file: File) => {
    try {
      const rows = await importSheet(file);
      const inserts = rows.map((r: any) => {
        const v = Number(r.valor || r.amount || 0);
        return {
          user_id: user!.id,
          date: r.data || r.date || new Date().toISOString().slice(0, 10),
          description: String(r.descricao || r.description || r.historico || "Importado"),
          amount: Math.abs(v),
          type: v >= 0 ? "receita" : "despesa",
          category: r.categoria || r.category || null,
        };
      }).filter(r => r.amount > 0);
      if (!inserts.length) return toast.error("Nenhuma linha válida");
      const { error } = await supabase.from("transactions").insert(inserts);
      if (error) toast.error(error.message);
      else { toast.success(`${inserts.length} lançamentos importados`); load(); }
    } catch { toast.error("Erro ao processar arquivo"); }
  };

  const handlePdfFile = async (file: File) => {
    setPdfLoading(true);
    try {
      const rows = await parsePdfStatement(file);
      if (!rows.length) toast.error("Nenhum lançamento detectado no PDF");
      setPdfRows(rows);
      setPdfDialog(true);
    } catch (e: any) {
      toast.error("Falha ao ler PDF: " + (e?.message || "erro"));
    } finally {
      setPdfLoading(false);
    }
  };

  const confirmPdfImport = async () => {
    const selected = pdfRows.filter(r => r.include && r.amount > 0);
    if (!selected.length) return toast.error("Selecione ao menos uma linha");
    const inserts = selected.map(r => ({
      user_id: user!.id,
      date: r.date,
      description: r.description,
      amount: r.amount,
      type: r.type,
      category: "Importado PDF",
      bank_id: pdfBankId || null,
    }));
    const { error } = await supabase.from("transactions").insert(inserts);
    if (error) return toast.error(error.message);
    if (pdfBankId) {
      const totalDelta = selected.reduce((s, r) => s + (r.type === "receita" ? r.amount : -r.amount), 0);
      await applyBankDelta(pdfBankId, totalDelta);
    }
    toast.success(`${inserts.length} lançamentos importados do PDF`);
    setPdfDialog(false); setPdfRows([]); load();
  };

  // ===== Filtros =====
  const filteredTxs = useMemo(() => {
    return txs.filter(t => {
      if (fStart && t.date < fStart) return false;
      if (fEnd && t.date > fEnd) return false;
      if (fType !== "todos" && t.type !== fType) return false;
      if (fSearch && !String(t.description).toLowerCase().includes(fSearch.toLowerCase())) return false;
      return true;
    });
  }, [txs, fStart, fEnd, fType, fSearch]);

  const filteredEntradas = filteredTxs.filter(t => t.type === "receita").reduce((s, t) => s + Number(t.amount), 0);
  const filteredSaidas = filteredTxs.filter(t => t.type === "despesa").reduce((s, t) => s + Number(t.amount), 0);
  const saldoFiltrado = filteredEntradas - filteredSaidas;

  const totalPay = payables.filter(p => !p.paid).reduce((s, p) => s + Number(p.amount), 0);
  const totalRec = receivables.filter(r => !r.received).reduce((s, r) => s + Number(r.amount), 0);

  const priorityColor = (p: string) => {
    if (p === "Alta") return "bg-destructive/15 text-destructive border-destructive/30";
    if (p === "Média") return "bg-warning/15 text-warning border-warning/30";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Fluxo de Caixa & Contas" subtitle="Movimentação financeira completa" />

      <Tabs defaultValue="fluxo">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="fluxo">Fluxo de Caixa</TabsTrigger>
          <TabsTrigger value="pagar">Contas a Pagar ({payables.filter(p => !p.paid).length})</TabsTrigger>
          <TabsTrigger value="receber">Contas a Receber ({receivables.filter(r => !r.received).length})</TabsTrigger>
          <TabsTrigger value="sangria">Sangria ({withdrawals.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="fluxo" className="space-y-4 mt-4">
          {/* Toolbar */}
          <div className="flex flex-wrap gap-2 justify-between items-center">
            <div className="flex flex-wrap gap-2 items-end">
              <div><Label className="text-xs">De</Label><Input type="date" value={fStart} onChange={e => setFStart(e.target.value)} className="h-9 w-[140px]" /></div>
              <div><Label className="text-xs">Até</Label><Input type="date" value={fEnd} onChange={e => setFEnd(e.target.value)} className="h-9 w-[140px]" /></div>
              <div><Label className="text-xs">Tipo</Label>
                <Select value={fType} onValueChange={(v: any) => setFType(v)}>
                  <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="receita">Receita</SelectItem>
                    <SelectItem value="despesa">Despesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Buscar</Label><Input value={fSearch} onChange={e => setFSearch(e.target.value)} placeholder="descrição..." className="h-9 w-[180px]" /></div>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="cursor-pointer">
                <Button asChild variant="outline" className="gap-2 border-primary/40"><span><Upload className="h-4 w-4" /> CSV/XLSX</span></Button>
                <input type="file" accept=".csv,.xlsx,.xls" hidden onChange={e => e.target.files && importExtrato(e.target.files[0])} />
              </label>
              <label className="cursor-pointer">
                <Button asChild variant="outline" disabled={pdfLoading} className="gap-2 border-primary/40"><span><FileText className="h-4 w-4" /> {pdfLoading ? "Lendo PDF..." : "Extrato PDF"}</span></Button>
                <input type="file" accept="application/pdf" hidden onChange={e => e.target.files && handlePdfFile(e.target.files[0])} />
              </label>
              <Dialog open={txDialog} onOpenChange={setTxDialog}>
                <DialogTrigger asChild><Button onClick={openNewTx} className="bg-gradient-gold text-primary-foreground gap-2"><Plus className="h-4 w-4" /> Lançamento</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{txForm.id ? "Editar Lançamento" : "Novo Lançamento"}</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Data</Label><Input type="date" value={txForm.date} onChange={e => setTxForm({ ...txForm, date: e.target.value })} /></div>
                      <div><Label>Tipo</Label>
                        <Select value={txForm.type} onValueChange={v => setTxForm({ ...txForm, type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="receita">Receita</SelectItem><SelectItem value="despesa">Despesa</SelectItem></SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div><Label>Descrição</Label><Input value={txForm.description} onChange={e => setTxForm({ ...txForm, description: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Categoria</Label><Input value={txForm.category} onChange={e => setTxForm({ ...txForm, category: e.target.value })} /></div>
                      <div><Label>Valor</Label><Input type="number" step="0.01" value={txForm.amount} onChange={e => setTxForm({ ...txForm, amount: e.target.value })} /></div>
                    </div>
                    <div><Label>Banco (opcional)</Label>
                      <Select value={txForm.bank_id} onValueChange={v => setTxForm({ ...txForm, bank_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>{banks.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter><Button onClick={saveTx} className="bg-gradient-gold text-primary-foreground">Salvar</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Totais filtrados */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3 bg-success/5 border-success/30"><div className="text-xs text-muted-foreground">Entradas</div><div className="font-display text-xl text-success">{fmtBRL(filteredEntradas)}</div></Card>
            <Card className="p-3 bg-destructive/5 border-destructive/30"><div className="text-xs text-muted-foreground">Saídas</div><div className="font-display text-xl text-destructive">{fmtBRL(filteredSaidas)}</div></Card>
            <Card className="p-3 bg-primary/5 border-primary/30"><div className="text-xs text-muted-foreground">Saldo</div><div className={`font-display text-xl ${saldoFiltrado >= 0 ? "text-primary-glow" : "text-destructive"}`}>{fmtBRL(saldoFiltrado)}</div></Card>
          </div>

          <Card className="p-0 bg-card/60 overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <Table>
                <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>Categoria</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="w-24"></TableHead></TableRow></TableHeader>
                <TableBody>
                  {filteredTxs.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum lançamento</TableCell></TableRow>}
                  {filteredTxs.map(t => {
                    const isEdit = (f: string) => inlineEdit?.id === t.id && inlineEdit.field === f;
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="text-sm" onDoubleClick={() => setInlineEdit({ id: t.id, field: "date" })}>
                          {isEdit("date") ? (
                            <Input type="date" defaultValue={t.date} autoFocus onBlur={e => inlineUpdateTx(t.id, "date", e.target.value)} className="h-8" />
                          ) : fmtDate(t.date)}
                        </TableCell>
                        <TableCell onDoubleClick={() => setInlineEdit({ id: t.id, field: "description" })}>
                          {isEdit("description") ? (
                            <Input defaultValue={t.description} autoFocus onBlur={e => inlineUpdateTx(t.id, "description", e.target.value)} className="h-8" />
                          ) : t.description}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{t.category || "—"}</TableCell>
                        <TableCell>{t.type === "receita" ? <ArrowUpCircle className="h-4 w-4 text-success" /> : <ArrowDownCircle className="h-4 w-4 text-destructive" />}</TableCell>
                        <TableCell className={`text-right tabular-nums font-medium ${t.type === "receita" ? "text-success" : "text-destructive"}`} onDoubleClick={() => setInlineEdit({ id: t.id, field: "amount" })}>
                          {isEdit("amount") ? (
                            <Input type="number" step="0.01" defaultValue={t.amount} autoFocus onBlur={e => inlineUpdateTx(t.id, "amount", e.target.value)} className="h-8 text-right" />
                          ) : fmtBRL(t.amount)}
                        </TableCell>
                        <TableCell className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEditTx(t)}><Pencil className="h-4 w-4 text-muted-foreground hover:text-primary" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => delTx(t.id)}><Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" /></Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="px-4 py-2 text-[11px] text-muted-foreground border-t border-border/40">Dica: clique duas vezes em data, descrição ou valor para editar inline.</div>
          </Card>
        </TabsContent>

        <TabsContent value="pagar" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <div className="text-sm">Total pendente: <span className="font-display text-xl text-destructive">{fmtBRL(totalPay)}</span></div>
            <Dialog open={payDialog} onOpenChange={setPayDialog}>
              <DialogTrigger asChild><Button onClick={openNewPay} className="bg-gradient-gold text-primary-foreground gap-2"><Plus className="h-4 w-4" /> Conta a Pagar</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{payForm.id ? "Editar Conta" : "Nova Conta a Pagar"}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Categoria</Label>
                      <Select value={payForm.category} onValueChange={v => setPayForm({ ...payForm, category: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Passivo">Passivo</SelectItem>
                          <SelectItem value="Operação">Operação</SelectItem>
                          <SelectItem value="Investimento">Investimento</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Prioridade</Label>
                      <Select value={payForm.priority} onValueChange={v => setPayForm({ ...payForm, priority: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Alta">Alta</SelectItem>
                          <SelectItem value="Média">Média</SelectItem>
                          <SelectItem value="Baixa">Baixa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div><Label>Descrição</Label><Input value={payForm.description} onChange={e => setPayForm({ ...payForm, description: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Valor</Label><Input type="number" step="0.01" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} /></div>
                    <div><Label>Vencimento</Label><Input type="date" value={payForm.due_date} onChange={e => setPayForm({ ...payForm, due_date: e.target.value })} /></div>
                  </div>
                </div>
                <DialogFooter><Button onClick={savePay} className="bg-gradient-gold text-primary-foreground">Salvar</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="p-0 bg-card/60 overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <Table>
                <TableHeader><TableRow><TableHead>Categoria</TableHead><TableHead>Prioridade</TableHead><TableHead>Descrição</TableHead><TableHead>Vencimento</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="text-center">Pago?</TableHead><TableHead className="w-24"></TableHead></TableRow></TableHeader>
                <TableBody>
                  {payables.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma conta</TableCell></TableRow>}
                  {payables.map(p => (
                    <TableRow key={p.id} className={p.paid ? "opacity-50" : ""}>
                      <TableCell><Badge variant="outline" className="border-primary/30 text-primary">{p.category}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className={priorityColor(p.priority)}>{p.priority}</Badge></TableCell>
                      <TableCell>{p.description}</TableCell>
                      <TableCell className="text-sm">{fmtDate(p.due_date)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{fmtBRL(p.amount)}</TableCell>
                      <TableCell className="text-center"><Checkbox checked={p.paid} onCheckedChange={(v) => togglePay(p.id, !!v)} /></TableCell>
                      <TableCell className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEditPay(p)}><Pencil className="h-4 w-4 text-muted-foreground hover:text-primary" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => delPay(p.id)}><Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                {payables.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-primary/30 bg-primary/5">
                      <td colSpan={4} className="px-4 py-3 text-sm font-medium text-primary">Total acumulado</td>
                      <td className="px-4 py-3 text-right font-display text-lg text-primary-glow">{fmtBRL(payables.reduce((s, p) => s + Number(p.amount), 0))}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                )}
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="receber" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <div className="text-sm">Total a receber: <span className="font-display text-xl text-success">{fmtBRL(totalRec)}</span></div>
            <Dialog open={recDialog} onOpenChange={setRecDialog}>
              <DialogTrigger asChild><Button onClick={openNewRec} className="bg-gradient-gold text-primary-foreground gap-2"><Plus className="h-4 w-4" /> Conta a Receber</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{recForm.id ? "Editar Recebível" : "Nova Conta a Receber"}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Pessoa</Label><Input value={recForm.client} onChange={e => setRecForm({ ...recForm, client: e.target.value })} /></div>
                    <div><Label>Conta</Label><Input value={recForm.project} onChange={e => setRecForm({ ...recForm, project: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label>Vencimento</Label><Input type="date" value={recForm.due_date} onChange={e => setRecForm({ ...recForm, due_date: e.target.value })} /></div>
                    <div><Label>Custo</Label><Input type="number" step="0.01" value={recForm.cost} onChange={e => setRecForm({ ...recForm, cost: e.target.value })} /></div>
                    <div><Label>A Receber</Label><Input type="number" step="0.01" value={recForm.amount} onChange={e => setRecForm({ ...recForm, amount: e.target.value })} /></div>
                  </div>
                </div>
                <DialogFooter><Button onClick={saveRec} className="bg-gradient-gold text-primary-foreground">Salvar</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="p-0 bg-card/60 overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <Table>
                <TableHeader><TableRow><TableHead>Vencimento</TableHead><TableHead>Pessoa</TableHead><TableHead>Conta</TableHead><TableHead className="text-right">Custo</TableHead><TableHead className="text-right">A Receber</TableHead><TableHead className="text-right">Diferença Real</TableHead><TableHead className="text-center">Recebido?</TableHead><TableHead className="w-24"></TableHead></TableRow></TableHeader>
                <TableBody>
                  {receivables.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum recebível</TableCell></TableRow>}
                  {receivables.map(r => {
                    const diff = Number(r.amount) - Number(r.cost);
                    return (
                      <TableRow key={r.id} className={r.received ? "opacity-50" : ""}>
                        <TableCell className="text-sm">{fmtDate(r.due_date)}</TableCell>
                        <TableCell className="font-medium">{r.client}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.project || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtBRL(r.cost)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtBRL(r.amount)}</TableCell>
                        <TableCell className={`text-right tabular-nums font-medium ${diff >= 0 ? "text-success" : "text-destructive"}`}>{fmtBRL(diff)}</TableCell>
                        <TableCell className="text-center"><Checkbox checked={r.received} onCheckedChange={(v) => toggleRec(r.id, !!v)} /></TableCell>
                        <TableCell className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEditRec(r)}><Pencil className="h-4 w-4 text-muted-foreground hover:text-primary" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => delRec(r.id)}><Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" /></Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* SANGRIA / RETIRADAS DE SÓCIOS */}
        <TabsContent value="sangria" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              Retiradas pessoais dos sócios. Retiradas marcadas como pró-labore reduzem o disponível mensal.
            </div>
            <Dialog open={wOpen} onOpenChange={setWOpen}>
              <DialogTrigger asChild>
                <Button onClick={openNewW} className="bg-gradient-gold text-primary-foreground gap-2">
                  <HandCoins className="h-4 w-4" /> Registrar Sangria
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Retirada de Sócio</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Sócio</Label>
                    <Select value={wForm.partner_id} onValueChange={v => setWForm({ ...wForm, partner_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {partners.filter(p => p.active !== false).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {wForm.partner_id && (() => {
                      const info = prolaboreInfo(wForm.partner_id);
                      return <div className="text-xs text-muted-foreground mt-1">Pró-labore mensal: {fmtBRL(info.proLabore)} • Já retirado este mês: {fmtBRL(info.used)} • Disponível: <span className={info.remaining < 0 ? "text-destructive" : "text-success"}>{fmtBRL(info.remaining)}</span></div>;
                    })()}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Data</Label><Input type="date" value={wForm.date} onChange={e => setWForm({ ...wForm, date: e.target.value })} /></div>
                    <div><Label>Valor</Label><Input type="number" step="0.01" value={wForm.amount} onChange={e => setWForm({ ...wForm, amount: e.target.value })} /></div>
                  </div>
                  <div><Label>Banco (opcional)</Label>
                    <Select value={wForm.bank_id} onValueChange={v => setWForm({ ...wForm, bank_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{banks.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={!!wForm.applied_to_prolabore} onCheckedChange={(v) => setWForm({ ...wForm, applied_to_prolabore: !!v })} />
                    <Label>Descontar do pró-labore deste mês</Label>
                  </div>
                  <div><Label>Observação</Label><Input value={wForm.notes} onChange={e => setWForm({ ...wForm, notes: e.target.value })} /></div>
                </div>
                <DialogFooter><Button onClick={saveW} className="bg-gradient-gold text-primary-foreground">Registrar</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="p-0 bg-card/60 overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Data</TableHead><TableHead>Sócio</TableHead><TableHead className="text-right">Valor</TableHead>
                  <TableHead>Pró-labore?</TableHead><TableHead>Observação</TableHead><TableHead className="w-16"></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {withdrawals.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Nenhuma retirada</TableCell></TableRow>}
                  {withdrawals.map(w => (
                    <TableRow key={w.id}>
                      <TableCell className="text-sm">{fmtDate(w.date)}</TableCell>
                      <TableCell className="font-medium">{w.partner_name}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtBRL(w.amount)}</TableCell>
                      <TableCell>{w.applied_to_prolabore ? <Badge variant="outline" className="border-success/40 text-success">Sim</Badge> : <Badge variant="outline">Não</Badge>}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{w.notes || "—"}</TableCell>
                      <TableCell><Button size="icon" variant="ghost" onClick={() => delW(w.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Diálogo de prévia de PDF */}
      <Dialog open={pdfDialog} onOpenChange={setPdfDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader><DialogTitle>Revisar Importação de Extrato PDF</DialogTitle></DialogHeader>
          <div className="flex items-end gap-3 pb-3 border-b border-border/40">
            <div className="flex-1">
              <Label>Banco (opcional)</Label>
              <Select value={pdfBankId} onValueChange={setPdfBankId}>
                <SelectTrigger><SelectValue placeholder="Selecione um banco" /></SelectTrigger>
                <SelectContent>{banks.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="text-sm text-muted-foreground pb-2">{pdfRows.filter(r => r.include).length} de {pdfRows.length} selecionadas</div>
          </div>
          <div className="overflow-auto scrollbar-thin flex-1">
            <Table>
              <TableHeader><TableRow><TableHead className="w-10"></TableHead><TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
              <TableBody>
                {pdfRows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma linha</TableCell></TableRow>}
                {pdfRows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell><Checkbox checked={r.include} onCheckedChange={v => { const c = [...pdfRows]; c[i].include = !!v; setPdfRows(c); }} /></TableCell>
                    <TableCell><Input type="date" value={r.date} onChange={e => { const c = [...pdfRows]; c[i].date = e.target.value; setPdfRows(c); }} className="h-8 w-[140px]" /></TableCell>
                    <TableCell><Input value={r.description} onChange={e => { const c = [...pdfRows]; c[i].description = e.target.value; setPdfRows(c); }} className="h-8" /></TableCell>
                    <TableCell>
                      <Select value={r.type} onValueChange={v => { const c = [...pdfRows]; c[i].type = v as any; setPdfRows(c); }}>
                        <SelectTrigger className="h-8 w-[110px]"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="receita">Receita</SelectItem><SelectItem value="despesa">Despesa</SelectItem></SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Input type="number" step="0.01" value={r.amount} onChange={e => { const c = [...pdfRows]; c[i].amount = Number(e.target.value); setPdfRows(c); }} className="h-8 text-right w-[120px] inline-block" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPdfDialog(false)}>Cancelar</Button>
            <Button onClick={confirmPdfImport} className="bg-gradient-gold text-primary-foreground">Confirmar Importação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
