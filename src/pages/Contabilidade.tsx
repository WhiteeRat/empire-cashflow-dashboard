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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Calculator, AlertTriangle, FileUp, Loader2, Trash2, Plus, Save, Pencil, FileDown, FileSpreadsheet } from "lucide-react";
import { fmtBRL } from "@/lib/format";
import {
  IncomeStatementItem, parseSpreadsheet, extractPdfText, parseIncomeStatementWithAI, detectIssues,
} from "@/lib/accountingImporter";
import { exportToXlsx } from "@/lib/exporter";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/** Limites padrão por regime (BRL/ano) — base 2026. Editáveis pelo usuário. */
const REGIME_DEFAULTS: Record<string, { label: string; annual: number }> = {
  mei: { label: "MEI", annual: 81000 },
  simples_nacional: { label: "Simples Nacional", annual: 4800000 },
  lucro_presumido: { label: "Lucro Presumido", annual: 78000000 },
  lucro_real: { label: "Lucro Real", annual: 0 },
};

type TaxSettings = {
  id?: string;
  regime: string;
  cnae_main?: string;
  cnae_secondary?: string[];
  annual_limit: number;
  alert_yellow_percent: number;
  alert_red_percent: number;
  notes?: string;
};

const defaultSettings: TaxSettings = {
  regime: "simples_nacional",
  annual_limit: REGIME_DEFAULTS.simples_nacional.annual,
  alert_yellow_percent: 80,
  alert_red_percent: 100,
};

export default function Contabilidade() {
  const { user } = useAuth();
  const { activeCompany } = useCompany();

  // ---- Aba Configurações Fiscais ----
  const [settings, setSettings] = useState<TaxSettings>(defaultSettings);
  const [revenueYear, setRevenueYear] = useState(0);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // ---- Aba Importar Informe ----
  const [baseYear, setBaseYear] = useState(new Date().getFullYear());
  const [importing, setImporting] = useState(false);
  const [extracted, setExtracted] = useState<IncomeStatementItem[]>([]);

  // ---- Aba Histórico ----
  const [statements, setStatements] = useState<any[]>([]);

  const load = async () => {
    if (!user) return;
    setLoadingSettings(true);
    let tsQuery: any = supabase.from("tax_settings").select("*").eq("user_id", user.id);
    tsQuery = activeCompany ? tsQuery.eq("company_id", activeCompany.id) : tsQuery.is("company_id", null);
    const { data: ts } = await tsQuery.maybeSingle();
    if (ts) setSettings(ts as any);
    else setSettings(defaultSettings);

    // Faturamento do ano = recebíveis recebidos no ano + informes do mesmo base_year
    // Antes filtrávamos apenas por receivables.due_date >= "{anoAtual}-01-01" SEM teto superior,
    // o que somava também 2027+. Agora delimitamos com gte/lte e somamos os informes.
    const currentYear = new Date().getFullYear();
    const yearStart = `${currentYear}-01-01`;
    const yearEnd = `${currentYear}-12-31`;
    let recQ: any = supabase.from("receivables").select("amount").eq("received", true)
      .gte("due_date", yearStart).lte("due_date", yearEnd);
    if (activeCompany) recQ = recQ.or(`company_id.eq.${activeCompany.id},company_id.is.null`);
    const { data: rec } = await recQ;
    const recvSum = ((rec as any[]) || []).reduce((s, r: any) => s + Number(r.amount || 0), 0);

    // Informes do ano (somatório de tributável + isento)
    let incQ: any = supabase.from("income_statements").select("taxable_income, exempt_income").eq("base_year", currentYear);
    if (activeCompany) incQ = incQ.or(`company_id.eq.${activeCompany.id},company_id.is.null`);
    const { data: inc } = await incQ;
    const incSum = ((inc as any[]) || []).reduce((s, r: any) => s + Number(r.taxable_income || 0) + Number(r.exempt_income || 0), 0);

    setRevenueYear(recvSum + incSum);

    // Histórico de informes (todos)
    let stQ: any = supabase.from("income_statements").select("*").order("created_at", { ascending: false }).limit(100);
    if (activeCompany) stQ = stQ.or(`company_id.eq.${activeCompany.id},company_id.is.null`);
    const { data: st } = await stQ;
    setStatements((st as any[]) || []);

    setLoadingSettings(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user, activeCompany]);

  const saveSettings = async () => {
    if (!user) return;
    const payload = { ...settings, user_id: user.id, company_id: activeCompany?.id ?? null };
    const { error } = settings.id
      ? await supabase.from("tax_settings").update(payload).eq("id", settings.id)
      : await supabase.from("tax_settings").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Configurações salvas");
    load();
  };

  const onRegimeChange = (regime: string) => {
    const def = REGIME_DEFAULTS[regime];
    setSettings(s => ({ ...s, regime, annual_limit: def?.annual || s.annual_limit }));
  };

  const usagePercent = useMemo(() => {
    if (!settings.annual_limit) return 0;
    return Math.min(200, (revenueYear / settings.annual_limit) * 100);
  }, [revenueYear, settings.annual_limit]);

  const alertLevel = useMemo<"ok" | "yellow" | "red" | "critical">(() => {
    if (usagePercent >= 100) return usagePercent > 110 ? "critical" : "red";
    if (usagePercent >= settings.alert_yellow_percent) return "yellow";
    return "ok";
  }, [usagePercent, settings.alert_yellow_percent]);

  // ---- Importar arquivo ----
  const handleFile = async (file: File) => {
    setImporting(true);
    try {
      let items: IncomeStatementItem[] = [];
      const ext = file.name.toLowerCase().split(".").pop();
      if (ext === "csv" || ext === "xlsx" || ext === "xls") {
        items = await parseSpreadsheet(file);
        toast.success(`${items.length} itens lidos via parser local`);
      } else if (ext === "pdf") {
        toast.info("Extraindo texto do PDF e classificando com IA…");
        const text = await extractPdfText(file);
        items = await parseIncomeStatementWithAI(text, baseYear);
        toast.success(`${items.length} itens extraídos via IA`);
      } else {
        toast.error("Formato não suportado. Use CSV, XLSX ou PDF.");
        return;
      }
      // Anexa warnings locais
      items = items.map(it => ({ ...it, warnings: [...(it.warnings || []), ...detectIssues(it)] }));
      setExtracted(items);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao importar");
    } finally {
      setImporting(false);
    }
  };

  const updateExtracted = (i: number, patch: Partial<IncomeStatementItem>) =>
    setExtracted(arr => arr.map((it, idx) => idx === i ? { ...it, ...patch } : it));

  const removeExtracted = (i: number) =>
    setExtracted(arr => arr.filter((_, idx) => idx !== i));

  const addEmpty = () => setExtracted(arr => [...arr, {
    source_name: "", taxable_income: 0, exempt_income: 0, ir_withheld: 0, contributions: 0, classification: "indefinido",
  }]);

  const persistAll = async () => {
    if (!user || extracted.length === 0) return;
    const rows = extracted
      .filter(it => it.source_name.trim().length > 0)
      .map(it => ({
        user_id: user.id,
        company_id: activeCompany?.id ?? null,
        base_year: baseYear,
        source_name: it.source_name,
        source_cnpj: it.source_cnpj || null,
        taxable_income: it.taxable_income,
        exempt_income: it.exempt_income,
        ir_withheld: it.ir_withheld,
        contributions: it.contributions,
        notes: it.warnings?.join(" • ") || null,
        status: "revisado",
        origin: "manual",
        raw_data: it as any,
      }));
    if (rows.length === 0) return toast.error("Nada a salvar");
    const { error } = await supabase.from("income_statements").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`${rows.length} informe(s) salvos`);
    setExtracted([]);
    load();
  };

  const totalTaxable = useMemo(() => extracted.reduce((s, i) => s + Number(i.taxable_income || 0), 0), [extracted]);
  const totalExempt = useMemo(() => extracted.reduce((s, i) => s + Number(i.exempt_income || 0), 0), [extracted]);
  const totalIR = useMemo(() => extracted.reduce((s, i) => s + Number(i.ir_withheld || 0), 0), [extracted]);

  return (
    <div className="space-y-6">
      <PageHeader title="Contabilidade" subtitle="Controle fiscal, informes de rendimentos e limites tributários" />

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="import">Importar Informe</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
          <TabsTrigger value="settings">Configurações Fiscais</TabsTrigger>
        </TabsList>

        {/* DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Faturamento {new Date().getFullYear()}</span>
                {alertLevel === "yellow" && <Badge className="bg-warning text-warning-foreground">Atenção {usagePercent.toFixed(0)}%</Badge>}
                {alertLevel === "red" && <Badge variant="destructive">Limite atingido</Badge>}
                {alertLevel === "critical" && <Badge variant="destructive">Excedido!</Badge>}
                {alertLevel === "ok" && <Badge variant="outline">Saudável</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-bold tabular-nums">{fmtBRL(revenueYear)}</span>
                <span className="text-sm text-muted-foreground">de {fmtBRL(settings.annual_limit)} ({REGIME_DEFAULTS[settings.regime]?.label || settings.regime})</span>
              </div>
              <Progress value={Math.min(100, usagePercent)} className={alertLevel === "red" || alertLevel === "critical" ? "[&>div]:bg-destructive" : alertLevel === "yellow" ? "[&>div]:bg-warning" : ""} />
              <div className="text-xs text-muted-foreground">{usagePercent.toFixed(1)}% do limite anual consumido</div>
              {alertLevel !== "ok" && (
                <div className="flex items-start gap-2 p-3 rounded border border-warning/30 bg-warning/10 text-sm">
                  <AlertTriangle className="h-4 w-4 mt-0.5 text-warning" />
                  <div>
                    {alertLevel === "yellow" && "Você atingiu a faixa de alerta. Reveja seu planejamento tributário."}
                    {alertLevel === "red" && "Limite anual atingido. Avalie mudança de regime ou desenquadramento."}
                    {alertLevel === "critical" && "Limite excedido — risco de desenquadramento e tributação retroativa."}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Informes registrados</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{statements.length}</div></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Tributável total</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold tabular-nums">{fmtBRL(statements.reduce((s, x) => s + Number(x.taxable_income || 0), 0))}</div></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">IR retido total</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold tabular-nums">{fmtBRL(statements.reduce((s, x) => s + Number(x.ir_withheld || 0), 0))}</div></CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* IMPORT */}
        <TabsContent value="import" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Importar Informe de Rendimentos</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3 items-end">
                <div>
                  <Label>Ano-base</Label>
                  <Input type="number" value={baseYear} onChange={e => setBaseYear(Number(e.target.value))} />
                </div>
                <div className="md:col-span-2">
                  <Label>Arquivo (PDF, CSV ou Excel)</Label>
                  <Input type="file" accept=".pdf,.csv,.xlsx,.xls" disabled={importing}
                    onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
                </div>
              </div>
              {importing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Processando…
                </div>
              )}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={addEmpty}>
                  <Plus className="h-4 w-4" /> Adicionar manualmente
                </Button>
                {extracted.length > 0 && (
                  <Button size="sm" onClick={persistAll}>
                    <Save className="h-4 w-4" /> Salvar {extracted.length} item(s)
                  </Button>
                )}
              </div>

              {extracted.length > 0 && (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-3 p-3 rounded bg-card/40 border border-border/30 text-sm">
                    <div>Tributável: <span className="font-bold tabular-nums">{fmtBRL(totalTaxable)}</span></div>
                    <div>Isento: <span className="font-bold tabular-nums">{fmtBRL(totalExempt)}</span></div>
                    <div>IR retido: <span className="font-bold tabular-nums">{fmtBRL(totalIR)}</span></div>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fonte</TableHead>
                          <TableHead>CNPJ</TableHead>
                          <TableHead className="text-right">Tributável</TableHead>
                          <TableHead className="text-right">Isento</TableHead>
                          <TableHead className="text-right">IR retido</TableHead>
                          <TableHead className="text-right">Prev.</TableHead>
                          <TableHead>Classif.</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {extracted.map((it, i) => (
                          <TableRow key={i} className={it.warnings?.length ? "bg-warning/5" : ""}>
                            <TableCell>
                              <Input value={it.source_name} onChange={e => updateExtracted(i, { source_name: e.target.value })} className="h-8" />
                              {it.warnings?.length ? (
                                <div className="text-xs text-warning mt-1 flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" /> {it.warnings.join(" • ")}
                                </div>
                              ) : null}
                            </TableCell>
                            <TableCell><Input value={it.source_cnpj || ""} onChange={e => updateExtracted(i, { source_cnpj: e.target.value })} className="h-8 w-32" /></TableCell>
                            <TableCell><Input type="number" step="0.01" value={it.taxable_income} onChange={e => updateExtracted(i, { taxable_income: Number(e.target.value) })} className="h-8 w-28 text-right" /></TableCell>
                            <TableCell><Input type="number" step="0.01" value={it.exempt_income} onChange={e => updateExtracted(i, { exempt_income: Number(e.target.value) })} className="h-8 w-28 text-right" /></TableCell>
                            <TableCell><Input type="number" step="0.01" value={it.ir_withheld} onChange={e => updateExtracted(i, { ir_withheld: Number(e.target.value) })} className="h-8 w-28 text-right" /></TableCell>
                            <TableCell><Input type="number" step="0.01" value={it.contributions} onChange={e => updateExtracted(i, { contributions: Number(e.target.value) })} className="h-8 w-28 text-right" /></TableCell>
                            <TableCell>
                              <Select value={it.classification || "indefinido"} onValueChange={v => updateExtracted(i, { classification: v as any })}>
                                <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="tributavel">Tributável</SelectItem>
                                  <SelectItem value="isento">Isento</SelectItem>
                                  <SelectItem value="exclusivo_fonte">Exclusivo fonte</SelectItem>
                                  <SelectItem value="indefinido">Indefinido</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell><Button size="icon" variant="ghost" onClick={() => removeExtracted(i)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
              {extracted.length === 0 && !importing && (
                <div className="text-sm text-muted-foreground p-6 text-center border border-dashed border-border/40 rounded">
                  <FileUp className="h-6 w-6 mx-auto mb-2 opacity-60" />
                  Selecione um arquivo para começar. CSV/Excel é processado localmente; PDFs usam IA para extração.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* HISTORY */}
        <TabsContent value="history">
          <Card>
            <CardHeader><CardTitle>Informes salvos</CardTitle></CardHeader>
            <CardContent>
              {statements.length === 0 ? (
                <div className="text-sm text-muted-foreground py-6 text-center">Nenhum informe salvo ainda.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ano</TableHead>
                      <TableHead>Fonte</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead className="text-right">Tributável</TableHead>
                      <TableHead className="text-right">Isento</TableHead>
                      <TableHead className="text-right">IR retido</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead className="w-28"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statements.map(s => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <Input type="number" defaultValue={s.base_year} className="h-8 w-20"
                            onBlur={async e => {
                              const v = Number(e.target.value);
                              if (v === s.base_year) return;
                              await supabase.from("income_statement_audit").insert({ user_id: user!.id, statement_id: s.id, action: "update", before_data: s, after_data: { ...s, base_year: v } });
                              await supabase.from("income_statements").update({ base_year: v }).eq("id", s.id);
                              toast.success("Atualizado"); load();
                            }} />
                        </TableCell>
                        <TableCell>
                          <Input defaultValue={s.source_name} className="h-8"
                            onBlur={async e => {
                              const v = e.target.value;
                              if (v === s.source_name) return;
                              await supabase.from("income_statement_audit").insert({ user_id: user!.id, statement_id: s.id, action: "update", before_data: s, after_data: { ...s, source_name: v } });
                              await supabase.from("income_statements").update({ source_name: v }).eq("id", s.id);
                              load();
                            }} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{s.source_cnpj || "—"}</TableCell>
                        <TableCell className="text-right">
                          <Input type="number" step="0.01" defaultValue={s.taxable_income} className="h-8 w-28 text-right ml-auto"
                            onBlur={async e => {
                              const v = Number(e.target.value);
                              if (v === Number(s.taxable_income)) return;
                              await supabase.from("income_statement_audit").insert({ user_id: user!.id, statement_id: s.id, action: "update", before_data: s, after_data: { ...s, taxable_income: v } });
                              await supabase.from("income_statements").update({ taxable_income: v }).eq("id", s.id);
                              load();
                            }} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{fmtBRL(s.exempt_income)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtBRL(s.ir_withheld)}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{s.origin}</Badge></TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" onClick={async () => {
                            if (!confirm("Excluir este informe? O impacto no faturamento será revertido.")) return;
                            await supabase.from("income_statement_audit").insert({ user_id: user!.id, statement_id: s.id, action: "delete", before_data: s });
                            await supabase.from("income_statements").delete().eq("id", s.id);
                            toast.success("Excluído"); load();
                          }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SETTINGS */}
        <TabsContent value="settings">
          <Card>
            <CardHeader><CardTitle>Configurações Fiscais {activeCompany ? `— ${activeCompany.name}` : "(geral)"}</CardTitle></CardHeader>
            <CardContent className="space-y-4 max-w-2xl">
              {loadingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label>Regime tributário</Label>
                      <Select value={settings.regime} onValueChange={onRegimeChange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(REGIME_DEFAULTS).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Limite anual de faturamento (R$)</Label>
                      <Input type="number" value={settings.annual_limit}
                        onChange={e => setSettings(s => ({ ...s, annual_limit: Number(e.target.value) }))} />
                    </div>
                    <div>
                      <Label>CNAE principal</Label>
                      <Input value={settings.cnae_main || ""} placeholder="ex: 4751-2/01"
                        onChange={e => setSettings(s => ({ ...s, cnae_main: e.target.value }))} />
                    </div>
                    <div>
                      <Label>CNAEs secundários (separados por vírgula)</Label>
                      <Input value={(settings.cnae_secondary || []).join(", ")}
                        onChange={e => setSettings(s => ({ ...s, cnae_secondary: e.target.value.split(",").map(x => x.trim()).filter(Boolean) }))} />
                    </div>
                    <div>
                      <Label>Alerta amarelo (%)</Label>
                      <Input type="number" value={settings.alert_yellow_percent}
                        onChange={e => setSettings(s => ({ ...s, alert_yellow_percent: Number(e.target.value) }))} />
                    </div>
                    <div>
                      <Label>Alerta vermelho (%)</Label>
                      <Input type="number" value={settings.alert_red_percent}
                        onChange={e => setSettings(s => ({ ...s, alert_red_percent: Number(e.target.value) }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Observações</Label>
                    <Textarea value={settings.notes || ""} onChange={e => setSettings(s => ({ ...s, notes: e.target.value }))} rows={3} />
                  </div>
                  <Button onClick={saveSettings}><Save className="h-4 w-4" /> Salvar configurações</Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
