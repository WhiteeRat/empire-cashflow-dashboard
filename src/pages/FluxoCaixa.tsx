import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
import { Plus, Upload, Trash2, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { fmtBRL, fmtDate } from "@/lib/format";
import { importSheet } from "@/lib/exporter";
import { toast } from "sonner";

export default function FluxoCaixa() {
  const { user } = useAuth();
  const [txs, setTxs] = useState<any[]>([]);
  const [payables, setPayables] = useState<any[]>([]);
  const [receivables, setReceivables] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);

  const [txDialog, setTxDialog] = useState(false);
  const [payDialog, setPayDialog] = useState(false);
  const [recDialog, setRecDialog] = useState(false);

  const [txForm, setTxForm] = useState({ date: new Date().toISOString().slice(0, 10), description: "", category: "", type: "receita", amount: "", bank_id: "" });
  const [payForm, setPayForm] = useState({ category: "Operação", priority: "Alta", description: "", amount: "", due_date: "" });
  const [recForm, setRecForm] = useState({ client: "", project: "", due_date: "", cost: "", amount: "" });

  const load = async () => {
    const [t, p, r, b] = await Promise.all([
      supabase.from("transactions").select("*").order("date", { ascending: false }),
      supabase.from("payables").select("*").order("due_date", { ascending: true }),
      supabase.from("receivables").select("*").order("due_date", { ascending: true }),
      supabase.from("banks").select("*"),
    ]);
    if (t.data) setTxs(t.data);
    if (p.data) setPayables(p.data);
    if (r.data) setReceivables(r.data);
    if (b.data) setBanks(b.data);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const addTx = async () => {
    if (!txForm.description || !txForm.amount) return toast.error("Preencha descrição e valor");
    const { error } = await supabase.from("transactions").insert({
      ...txForm, amount: Number(txForm.amount), bank_id: txForm.bank_id || null, user_id: user!.id,
    });
    if (error) toast.error(error.message);
    else { toast.success("Lançamento adicionado"); setTxDialog(false); setTxForm({ date: new Date().toISOString().slice(0, 10), description: "", category: "", type: "receita", amount: "", bank_id: "" }); load(); }
  };

  const addPay = async () => {
    if (!payForm.description || !payForm.amount) return toast.error("Preencha descrição e valor");
    const { error } = await supabase.from("payables").insert({ ...payForm, amount: Number(payForm.amount), due_date: payForm.due_date || null, user_id: user!.id });
    if (error) toast.error(error.message);
    else { toast.success("Conta adicionada"); setPayDialog(false); setPayForm({ category: "Operação", priority: "Alta", description: "", amount: "", due_date: "" }); load(); }
  };

  const addRec = async () => {
    if (!recForm.client || !recForm.amount) return toast.error("Preencha pagador e valor");
    const { error } = await supabase.from("receivables").insert({ ...recForm, amount: Number(recForm.amount), cost: Number(recForm.cost) || 0, due_date: recForm.due_date || null, user_id: user!.id });
    if (error) toast.error(error.message);
    else { toast.success("Recebível adicionado"); setRecDialog(false); setRecForm({ client: "", project: "", due_date: "", cost: "", amount: "" }); load(); }
  };

  const togglePay = async (id: string, paid: boolean) => {
    await supabase.from("payables").update({ paid }).eq("id", id);
    load();
  };
  const toggleRec = async (id: string, received: boolean) => {
    await supabase.from("receivables").update({ received }).eq("id", id);
    load();
  };
  const delTx = async (id: string) => { await supabase.from("transactions").delete().eq("id", id); load(); };
  const delPay = async (id: string) => { await supabase.from("payables").delete().eq("id", id); load(); };
  const delRec = async (id: string) => { await supabase.from("receivables").delete().eq("id", id); load(); };

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
        </TabsList>

        <TabsContent value="fluxo" className="space-y-4 mt-4">
          <div className="flex flex-wrap gap-2 justify-end">
            <label className="cursor-pointer">
              <Button asChild variant="outline" className="gap-2 border-primary/40"><span><Upload className="h-4 w-4" /> Importar CSV/XLSX</span></Button>
              <input type="file" accept=".csv,.xlsx,.xls" hidden onChange={e => e.target.files && importExtrato(e.target.files[0])} />
            </label>
            <Dialog open={txDialog} onOpenChange={setTxDialog}>
              <DialogTrigger asChild><Button className="bg-gradient-gold text-primary-foreground gap-2"><Plus className="h-4 w-4" /> Lançamento</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo Lançamento</DialogTitle></DialogHeader>
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
                    <div><Label>Categoria</Label><Input value={txForm.category} onChange={e => setTxForm({ ...txForm, category: e.target.value })} placeholder="ex: Marketing" /></div>
                    <div><Label>Valor</Label><Input type="number" step="0.01" value={txForm.amount} onChange={e => setTxForm({ ...txForm, amount: e.target.value })} /></div>
                  </div>
                  <div><Label>Banco (opcional)</Label>
                    <Select value={txForm.bank_id} onValueChange={v => setTxForm({ ...txForm, bank_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{banks.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter><Button onClick={addTx} className="bg-gradient-gold text-primary-foreground">Salvar</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="p-0 bg-card/60 overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <Table>
                <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>Categoria</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Valor</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {txs.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum lançamento</TableCell></TableRow>}
                  {txs.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="text-sm">{fmtDate(t.date)}</TableCell>
                      <TableCell>{t.description}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{t.category || "—"}</TableCell>
                      <TableCell>{t.type === "receita" ? <ArrowUpCircle className="h-4 w-4 text-success" /> : <ArrowDownCircle className="h-4 w-4 text-destructive" />}</TableCell>
                      <TableCell className={`text-right tabular-nums font-medium ${t.type === "receita" ? "text-success" : "text-destructive"}`}>{fmtBRL(t.amount)}</TableCell>
                      <TableCell><Button size="icon" variant="ghost" onClick={() => delTx(t.id)}><Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="pagar" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <div className="text-sm">Total pendente: <span className="font-display text-xl text-destructive">{fmtBRL(totalPay)}</span></div>
            <Dialog open={payDialog} onOpenChange={setPayDialog}>
              <DialogTrigger asChild><Button className="bg-gradient-gold text-primary-foreground gap-2"><Plus className="h-4 w-4" /> Conta a Pagar</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova Conta a Pagar</DialogTitle></DialogHeader>
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
                          <SelectItem value="Alta">Reserva de Capital</SelectItem>
                          <SelectItem value="Alta">Marketing</SelectItem>
                          <SelectItem value="Alta">Funcionários</SelectItem>
                          <SelectItem value="Alta">Impostos</SelectItem>
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
                <DialogFooter><Button onClick={addPay} className="bg-gradient-gold text-primary-foreground">Salvar</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="p-0 bg-card/60 overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <Table>
                <TableHeader><TableRow><TableHead>Categoria</TableHead><TableHead>Prioridade</TableHead><TableHead>Descrição</TableHead><TableHead>Vencimento</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="text-center">Pago?</TableHead><TableHead></TableHead></TableRow></TableHeader>
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
                      <TableCell><Button size="icon" variant="ghost" onClick={() => delPay(p.id)}><Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" /></Button></TableCell>
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
              <DialogTrigger asChild><Button className="bg-gradient-gold text-primary-foreground gap-2"><Plus className="h-4 w-4" /> Conta a Receber</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova Conta a Receber</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Pagador</Label><Input value={recForm.client} onChange={e => setRecForm({ ...recForm, client: e.target.value })} /></div>
                    <div><Label>Conta</Label><Input value={recForm.project} onChange={e => setRecForm({ ...recForm, project: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label>Vencimento</Label><Input type="date" value={recForm.due_date} onChange={e => setRecForm({ ...recForm, due_date: e.target.value })} /></div>
                    <div><Label>Custo</Label><Input type="number" step="0.01" value={recForm.cost} onChange={e => setRecForm({ ...recForm, cost: e.target.value })} /></div>
                    <div><Label>A Receber</Label><Input type="number" step="0.01" value={recForm.amount} onChange={e => setRecForm({ ...recForm, amount: e.target.value })} /></div>
                  </div>
                </div>
                <DialogFooter><Button onClick={addRec} className="bg-gradient-gold text-primary-foreground">Salvar</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="p-0 bg-card/60 overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <Table>
                <TableHeader><TableRow><TableHead>Vencimento</TableHead><TableHead>Cliente</TableHead><TableHead>Projeto</TableHead><TableHead className="text-right">Custo</TableHead><TableHead className="text-right">A Receber</TableHead><TableHead className="text-right">Diferença Real</TableHead><TableHead className="text-center">Recebido?</TableHead><TableHead></TableHead></TableRow></TableHeader>
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
                        <TableCell><Button size="icon" variant="ghost" onClick={() => delRec(r.id)}><Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" /></Button></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
