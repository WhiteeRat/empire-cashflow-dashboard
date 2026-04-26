import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { TrendingUp, TrendingDown, Coins, Wallet, PiggyBank, Plus, Download, Building2, Users, Upload, Trash2, Check, Pencil, X } from "lucide-react";
import { fmtBRL } from "@/lib/format";
import { exportToXlsx, importSheet } from "@/lib/exporter";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Legend } from "recharts";
import { toast } from "sonner";

type Bank = { id: string; name: string; balance: number };
type Partner = { id: string; name: string; share_percent: number };
type Tx = { id: string; date: string; type: string; amount: number; description: string; category: string | null };

export default function Dashboard() {
  const { user } = useAuth();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [bankDialog, setBankDialog] = useState(false);
  const [partnerDialog, setPartnerDialog] = useState(false);
  const [bankForm, setBankForm] = useState({ name: "", balance: "" });
  const [partnerForm, setPartnerForm] = useState({ name: "", share_percent: "" });
  const [editBankId, setEditBankId] = useState<string | null>(null);
  const [editBankBalance, setEditBankBalance] = useState<string>("");

  const [linkAccounting, setLinkAccounting] = useState(false);
  const [accountingRevenue, setAccountingRevenue] = useState(0);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);

  const load = async () => {
    if (!user) return;
    const currentYear = new Date().getFullYear();
    const [b, p, t, settings, inc, wd] = await Promise.all([
      supabase.from("banks").select("*").order("created_at"),
      supabase.from("partners").select("*").order("created_at"),
      supabase.from("transactions").select("*").order("date", { ascending: false }),
      supabase.from("user_settings").select("link_accounting_to_dashboard").eq("user_id", user.id).maybeSingle(),
      supabase.from("income_statements").select("taxable_income, exempt_income, base_year").eq("base_year", currentYear),
      supabase.from("partner_withdrawals").select("*").gte("date", `${currentYear}-01-01`).lte("date", `${currentYear}-12-31`),
    ]);
    if (b.data) setBanks(b.data as any);
    if (p.data) setPartners(p.data as any);
    if (t.data) setTxs(t.data as any);
    setLinkAccounting(!!(settings.data as any)?.link_accounting_to_dashboard);
    const incSum = ((inc.data as any[]) || []).reduce((s, r) => s + Number(r.taxable_income || 0) + Number(r.exempt_income || 0), 0);
    setAccountingRevenue(incSum);
    setWithdrawals((wd.data as any[]) || []);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const baseReceita = txs.filter(t => t.type === "receita").reduce((s, t) => s + Number(t.amount), 0);
  const receita = baseReceita + (linkAccounting ? accountingRevenue : 0);
  const despesa = txs.filter(t => t.type === "despesa").reduce((s, t) => s + Number(t.amount), 0);
  const lucro = receita - despesa;
  const totalBancos = banks.reduce((s, b) => s + Number(b.balance), 0);
  // Distribuição prevista = soma do pró-labore mensal × 12 (anual) — fallback antigo se não houver sócios
  const proLaboreAnual = partners.reduce((s: number, p: any) => s + Number(p.pro_labore || 0) * 12, 0);
  const totalSangrias = withdrawals.reduce((s, w) => s + Number(w.amount || 0), 0);
  const distribuicao = proLaboreAnual > 0 ? proLaboreAnual : Math.max(0, lucro * 0.5);
  const capitalGiro = totalBancos - distribuicao;

  // chart data: últimos 6 meses
  const chartData = (() => {
    const map = new Map<string, { mes: string; receita: number; despesa: number }>();
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "short" });
      map.set(key, { mes: label, receita: 0, despesa: 0 });
    }
    txs.forEach(t => {
      const key = t.date.slice(0, 7);
      const row = map.get(key);
      if (row) row[t.type as "receita" | "despesa"] += Number(t.amount);
    });
    return Array.from(map.values());
  })();

  const addBank = async () => {
    if (!bankForm.name || !user) return;
    const { error } = await supabase.from("banks").insert({ name: bankForm.name, balance: Number(bankForm.balance) || 0, user_id: user.id });
    if (error) toast.error(error.message);
    else { toast.success("Banco adicionado"); setBankDialog(false); setBankForm({ name: "", balance: "" }); load(); }
  };

  /** Inicia edição inline do saldo de um banco */
  const startEditBank = (b: Bank) => {
    setEditBankId(b.id);
    setEditBankBalance(String(b.balance));
  };

  /** Salva o novo saldo do banco no banco de dados */
  const saveBankBalance = async (id: string) => {
    const newBalance = Number(editBankBalance);
    if (Number.isNaN(newBalance)) { toast.error("Saldo inválido"); return; }
    const { error } = await supabase.from("banks").update({ balance: newBalance }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Saldo atualizado"); setEditBankId(null); load(); }
  };

  /** Exclui o banco após confirmação do usuário */
  const deleteBank = async (b: Bank) => {
    if (!confirm(`Excluir o banco "${b.name}"? Essa ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from("banks").delete().eq("id", b.id);
    if (error) toast.error(error.message);
    else { toast.success("Banco excluído"); load(); }
  };

  const addPartner = async () => {
    if (!partnerForm.name || !user) return;
    const { error } = await supabase.from("partners").insert({ name: partnerForm.name, share_percent: Number(partnerForm.share_percent) || 0, user_id: user.id });
    if (error) toast.error(error.message);
    else { toast.success("Sócio adicionado"); setPartnerDialog(false); setPartnerForm({ name: "", share_percent: "" }); load(); }
  };

  const exportSummary = () => {
    exportToXlsx([
      { Métrica: "Faturamento", Valor: receita },
      { Métrica: "Despesas", Valor: despesa },
      { Métrica: "Lucro Líquido", Valor: lucro },
      { Métrica: "Distribuição Prevista", Valor: distribuicao },
      { Métrica: "Capital de Giro", Valor: capitalGiro },
    ], `imperio-resumo-${new Date().toISOString().slice(0, 10)}`, "Resumo");
  };

  const importExtrato = async (file: File, bankId: string) => {
    try {
      const rows = await importSheet(file);
      const inserts = rows.map((r: any) => ({
        user_id: user!.id,
        bank_id: bankId,
        date: r.data || r.date || new Date().toISOString().slice(0, 10),
        description: String(r.descricao || r.description || r.historico || "Importado"),
        amount: Math.abs(Number(r.valor || r.amount || 0)),
        type: Number(r.valor || r.amount || 0) >= 0 ? "receita" : "despesa",
        category: r.categoria || r.category || null,
      })).filter(r => r.amount > 0);
      if (!inserts.length) return toast.error("Nenhuma linha válida no arquivo");
      const { error } = await supabase.from("transactions").insert(inserts);
      if (error) toast.error(error.message);
      else { toast.success(`${inserts.length} lançamentos importados`); load(); }
    } catch (e: any) { toast.error("Erro ao ler arquivo"); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Visão soberana do seu Império financeiro"
        actions={
          <Button onClick={exportSummary} variant="outline" className="gap-2 border-primary/40 hover:bg-primary/10">
            <Download className="h-4 w-4" /> Exportar Resumo
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard title="Faturamento" value={fmtBRL(receita)} icon={TrendingUp} tone="success" hint={linkAccounting ? `Inclui ${fmtBRL(accountingRevenue)} contábil` : "Total de receitas"} />
        <StatCard title="Despesas & Custos" value={fmtBRL(despesa)} icon={TrendingDown} tone="destructive" hint="Saídas operacionais" />
        <StatCard title="Lucro Líquido" value={fmtBRL(lucro)} icon={Coins} tone="gold" hint={`Margem ${receita ? ((lucro / receita) * 100).toFixed(1) : 0}%`} />
        <StatCard title="Distribuição Prevista" value={fmtBRL(distribuicao)} icon={PiggyBank} tone="info" hint={proLaboreAnual > 0 ? `Pró-labore anual (sangrias ${fmtBRL(totalSangrias)})` : "Sangria sócios (50%)"} />
        <StatCard title="Capital de Giro" value={fmtBRL(capitalGiro)} icon={Wallet} tone="warning" hint="Disponível em caixa" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5 bg-card/60">
          <h3 className="font-display text-xl mb-4 text-foreground">Receita vs Despesa — Últimos 6 meses</h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="rec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(142 65% 45%)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="hsl(142 65% 45%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="des" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(0 75% 55%)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="hsl(0 75% 55%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: any) => fmtBRL(Number(v))} />
                <Area type="monotone" dataKey="receita" stroke="hsl(142 65% 45%)" fill="url(#rec)" strokeWidth={2} />
                <Area type="monotone" dataKey="despesa" stroke="hsl(0 75% 55%)" fill="url(#des)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 bg-card/60">
          <h3 className="font-display text-xl mb-4 text-foreground">Lucro Mensal</h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData.map(c => ({ mes: c.mes, lucro: c.receita - c.despesa }))}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: any) => fmtBRL(Number(v))} />
                <Bar dataKey="lucro" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5 bg-card/60">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-xl text-foreground flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /> Saldos por Banco</h3>
            <Dialog open={bankDialog} onOpenChange={setBankDialog}>
              <DialogTrigger asChild><Button size="sm" variant="ghost" className="gap-1 text-primary"><Plus className="h-4 w-4" />Banco</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Adicionar Banco</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Nome</Label><Input value={bankForm.name} onChange={e => setBankForm({ ...bankForm, name: e.target.value })} placeholder="Nubank, Itaú..." /></div>
                  <div><Label>Saldo inicial</Label><Input type="number" value={bankForm.balance} onChange={e => setBankForm({ ...bankForm, balance: e.target.value })} /></div>
                </div>
                <DialogFooter><Button onClick={addBank} className="bg-gradient-gold text-primary-foreground">Salvar</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <div className="space-y-2">
            {banks.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Nenhum banco cadastrado</p>}
            {banks.map(b => (
              <div key={b.id} className="flex items-center justify-between p-3 rounded-md bg-muted/40 hover:bg-muted/60 transition-smooth">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center"><Building2 className="h-4 w-4 text-primary" /></div>
                  <div>
                    <p className="text-sm font-medium">{b.name}</p>
                    <label className="text-[10px] text-muted-foreground cursor-pointer hover:text-primary inline-flex items-center gap-1">
                      <Upload className="h-3 w-3" /> Importar extrato
                      <input type="file" accept=".csv,.xlsx,.xls" hidden onChange={e => e.target.files && importExtrato(e.target.files[0], b.id)} />
                    </label>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {editBankId === b.id ? (
                    <>
                      <Input
                        type="number"
                        step="0.01"
                        value={editBankBalance}
                        onChange={e => setEditBankBalance(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") saveBankBalance(b.id); if (e.key === "Escape") setEditBankId(null); }}
                        className="h-8 w-32 text-right"
                        autoFocus
                      />
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" onClick={() => saveBankBalance(b.id)} title="Salvar">
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditBankId(null)} title="Cancelar">
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="font-display text-lg text-primary-glow">{fmtBRL(b.balance)}</span>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => startEditBank(b)} title="Editar saldo">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteBank(b)} title="Excluir banco">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-border/50 flex justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="font-display text-xl text-gold">{fmtBRL(totalBancos)}</span>
          </div>
        </Card>

        <Card className="p-5 bg-card/60">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-xl text-foreground flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Sangria / Distribuição de Lucro</h3>
            <Dialog open={partnerDialog} onOpenChange={setPartnerDialog}>
              <DialogTrigger asChild><Button size="sm" variant="ghost" className="gap-1 text-primary"><Plus className="h-4 w-4" />Sócio</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Adicionar Sócio</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Nome</Label><Input value={partnerForm.name} onChange={e => setPartnerForm({ ...partnerForm, name: e.target.value })} /></div>
                  <div><Label>% participação</Label><Input type="number" value={partnerForm.share_percent} onChange={e => setPartnerForm({ ...partnerForm, share_percent: e.target.value })} placeholder="ex: 33.33" /></div>
                </div>
                <DialogFooter><Button onClick={addPartner} className="bg-gradient-gold text-primary-foreground">Salvar</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <div className="space-y-2">
            {partners.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Nenhum sócio cadastrado</p>}
            {partners.map(p => {
              const valor = distribuicao * (Number(p.share_percent) / 100);
              return (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-md bg-muted/40">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-gradient-gold flex items-center justify-center text-primary-foreground font-display font-bold">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{Number(p.share_percent).toFixed(2)}%</p>
                    </div>
                  </div>
                  <span className="font-display text-lg text-primary-glow">{fmtBRL(valor)}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-border/50 flex justify-between">
            <span className="text-sm text-muted-foreground">Total previsto</span>
            <span className="font-display text-xl text-gold">{fmtBRL(distribuicao)}</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
