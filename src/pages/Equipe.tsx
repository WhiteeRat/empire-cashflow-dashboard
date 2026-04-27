import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { scope, withCompany } from "@/lib/companyScope";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Download, Clock, Pencil } from "lucide-react";
import { fmtBRL, fmtDate } from "@/lib/format";
import { exportToXlsx } from "@/lib/exporter";
import { toast } from "sonner";

type AnyRec = Record<string, any>;

const emptyEmp = { id: "", name: "", role: "", pay_type: "fixo", daily_rate: "", monthly_salary: "" };
const emptySup = { id: "", name: "", product: "", last_price: "", contact: "", notes: "" };
const emptyEnt = { id: "", employee_id: "", date: new Date().toISOString().slice(0, 10), clock_in: "08:00", lunch_out: "12:00", lunch_in: "13:00", clock_out: "17:00", pay_type: "fixo", daily_rate: "", notes: "" };

function diffHours(a?: string, b?: string) {
  if (!a || !b) return 0;
  const [h1, m1] = a.split(":").map(Number);
  const [h2, m2] = b.split(":").map(Number);
  return ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
}

function calcWorkedHours(e: AnyRec) {
  if (e.lunch_out && e.lunch_in) {
    return diffHours(e.clock_in, e.lunch_out) + diffHours(e.lunch_in, e.clock_out);
  }
  return diffHours(e.clock_in, e.clock_out);
}

export default function Equipe() {
  const { user } = useAuth();
  const { activeCompany } = useCompany();
  const companyId = activeCompany?.id ?? null;
  const [employees, setEmployees] = useState<AnyRec[]>([]);
  const [entries, setEntries] = useState<AnyRec[]>([]);
  const [suppliers, setSuppliers] = useState<AnyRec[]>([]);

  const [empOpen, setEmpOpen] = useState(false);
  const [supOpen, setSupOpen] = useState(false);
  const [entOpen, setEntOpen] = useState(false);

  const [empForm, setEmpForm] = useState<AnyRec>({ ...emptyEmp });
  const [supForm, setSupForm] = useState<AnyRec>({ ...emptySup });
  const [entForm, setEntForm] = useState<AnyRec>({ ...emptyEnt });

  const load = async () => {
    const [e, t, s] = await Promise.all([
      scope(supabase.from("employees").select("*").order("name"), companyId),
      scope(supabase.from("time_entries").select("*").order("date", { ascending: false }), companyId),
      scope(supabase.from("suppliers").select("*").order("name"), companyId),
    ]);
    if (e.data) setEmployees(e.data);
    if (t.data) setEntries(t.data);
    if (s.data) setSuppliers(s.data);
  };
  useEffect(() => { if (user) load(); }, [user, companyId]);

  // ===== Employees =====
  const openNewEmp = () => { setEmpForm({ ...emptyEmp }); setEmpOpen(true); };
  const openEditEmp = (e: AnyRec) => {
    setEmpForm({ id: e.id, name: e.name, role: e.role || "", pay_type: e.pay_type || "fixo", daily_rate: String(e.daily_rate ?? ""), monthly_salary: String(e.monthly_salary ?? "") });
    setEmpOpen(true);
  };
  const saveEmp = async () => {
    if (!empForm.name) return;
    const payload = {
      name: empForm.name as string,
      role: (empForm.role || null) as string | null,
      pay_type: empForm.pay_type as string,
      daily_rate: Number(empForm.daily_rate) || 0,
      monthly_salary: Number(empForm.monthly_salary) || 0,
    };
    const { error } = empForm.id
      ? await supabase.from("employees").update(payload).eq("id", empForm.id)
      : await supabase.from("employees").insert(withCompany({ ...payload, user_id: user!.id }, companyId));
    if (error) return toast.error(error.message);
    toast.success(empForm.id ? "Atualizado" : "Adicionado");
    setEmpOpen(false); load();
  };
  const delEmp = async (id: string) => { await supabase.from("employees").delete().eq("id", id); load(); };

  // ===== Suppliers =====
  const openNewSup = () => { setSupForm({ ...emptySup }); setSupOpen(true); };
  const openEditSup = (s: AnyRec) => {
    setSupForm({ id: s.id, name: s.name, product: s.product || "", last_price: String(s.last_price ?? ""), contact: s.contact || "", notes: s.notes || "" });
    setSupOpen(true);
  };
  const saveSup = async () => {
    if (!supForm.name) return;
    const payload = {
      name: supForm.name as string,
      product: (supForm.product || null) as string | null,
      last_price: Number(supForm.last_price) || 0,
      contact: (supForm.contact || null) as string | null,
      notes: (supForm.notes || null) as string | null,
    };
    const { error } = supForm.id
      ? await supabase.from("suppliers").update(payload).eq("id", supForm.id)
      : await supabase.from("suppliers").insert(withCompany({ ...payload, user_id: user!.id }, companyId));
    if (error) return toast.error(error.message);
    toast.success(supForm.id ? "Atualizado" : "Adicionado");
    setSupOpen(false); load();
  };
  const delSup = async (id: string) => { await supabase.from("suppliers").delete().eq("id", id); load(); };

  // ===== Time entries =====
  const openNewEnt = () => { setEntForm({ ...emptyEnt }); setEntOpen(true); };
  const openEditEnt = (e: AnyRec) => {
    setEntForm({
      id: e.id,
      employee_id: e.employee_id || "",
      date: e.date,
      clock_in: e.clock_in || "08:00",
      lunch_out: e.lunch_out || "",
      lunch_in: e.lunch_in || "",
      clock_out: e.clock_out || "17:00",
      pay_type: e.pay_type || "fixo",
      daily_rate: String(e.daily_rate ?? ""),
      notes: e.notes || "",
    });
    setEntOpen(true);
  };
  const saveEnt = async () => {
    if (!entForm.employee_id) return toast.error("Selecione funcionário");
    const payload = {
      employee_id: entForm.employee_id as string,
      date: entForm.date as string,
      clock_in: (entForm.clock_in || null) as string | null,
      lunch_out: (entForm.lunch_out || null) as string | null,
      lunch_in: (entForm.lunch_in || null) as string | null,
      clock_out: (entForm.clock_out || null) as string | null,
      pay_type: entForm.pay_type as string,
      daily_rate: Number(entForm.daily_rate) || 0,
      notes: (entForm.notes || null) as string | null,
    };
    const { error } = entForm.id
      ? await supabase.from("time_entries").update(payload).eq("id", entForm.id)
      : await supabase.from("time_entries").insert(withCompany({ ...payload, user_id: user!.id }, companyId));
    if (error) return toast.error(error.message);
    toast.success(entForm.id ? "Ponto atualizado" : "Ponto registrado");
    setEntOpen(false); load();
  };
  const delEnt = async (id: string) => { await supabase.from("time_entries").delete().eq("id", id); load(); };

  // Auto-preenche pay_type/daily_rate quando seleciona funcionário em novo registro
  const onSelectEmployee = (id: string) => {
    const emp = employees.find(e => e.id === id);
    setEntForm((prev: AnyRec) => ({
      ...prev,
      employee_id: id,
      pay_type: emp?.pay_type || prev.pay_type || "fixo",
      daily_rate: emp?.daily_rate ? String(emp.daily_rate) : prev.daily_rate,
    }));
  };

  const exportPonto = () => {
    exportToXlsx(entries.map(e => {
      const emp = employees.find(em => em.id === e.employee_id);
      const horas = calcWorkedHours(e);
      const valor = e.pay_type === "diaria" ? Number(e.daily_rate) || 0 : 0;
      return {
        Funcionario: emp?.name || "—",
        Data: e.date,
        Entrada: e.clock_in || "",
        Almoco_Saida: e.lunch_out || "",
        Almoco_Retorno: e.lunch_in || "",
        Saida: e.clock_out || "",
        Horas: horas.toFixed(2),
        Tipo: e.pay_type === "diaria" ? "Diária" : "Fixo",
        Valor_Diaria: valor,
      };
    }), `imperio-ponto-${new Date().toISOString().slice(0, 10)}`, "Ponto");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Equipe & Fornecedores" subtitle="Ponto, funcionários ativos e cotações" />

      <Tabs defaultValue="ponto">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="ponto">Ponto / Equipe</TabsTrigger>
          <TabsTrigger value="funcionarios">Funcionários ({employees.length})</TabsTrigger>
          <TabsTrigger value="fornecedores">Fornecedores ({suppliers.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="ponto" className="mt-4 space-y-4">
          <div className="flex justify-end gap-2">
            <Button onClick={exportPonto} variant="outline" className="gap-2 border-primary/40"><Download className="h-4 w-4" /> Exportar Ponto</Button>
            <Dialog open={entOpen} onOpenChange={setEntOpen}>
              <DialogTrigger asChild><Button onClick={openNewEnt} className="bg-gradient-gold text-primary-foreground gap-2"><Plus className="h-4 w-4" /> Registrar Ponto</Button></DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>{entForm.id ? "Editar Ponto" : "Registro de Ponto"}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Funcionário</Label>
                      <Select value={entForm.employee_id} onValueChange={onSelectEmployee}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>{employees.filter(e => e.active).map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Data</Label><Input type="date" value={entForm.date} onChange={e => setEntForm({ ...entForm, date: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <div><Label>Entrada</Label><Input type="time" value={entForm.clock_in} onChange={e => setEntForm({ ...entForm, clock_in: e.target.value })} /></div>
                    <div><Label>Saída Almoço</Label><Input type="time" value={entForm.lunch_out} onChange={e => setEntForm({ ...entForm, lunch_out: e.target.value })} /></div>
                    <div><Label>Volta Almoço</Label><Input type="time" value={entForm.lunch_in} onChange={e => setEntForm({ ...entForm, lunch_in: e.target.value })} /></div>
                    <div><Label>Saída Final</Label><Input type="time" value={entForm.clock_out} onChange={e => setEntForm({ ...entForm, clock_out: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Tipo de Pagamento</Label>
                      <Select value={entForm.pay_type} onValueChange={v => setEntForm({ ...entForm, pay_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixo">Salário Fixo</SelectItem>
                          <SelectItem value="diaria">Diária</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {entForm.pay_type === "diaria" && (
                      <div><Label>Valor da Diária (R$)</Label><Input type="number" step="0.01" value={entForm.daily_rate} onChange={e => setEntForm({ ...entForm, daily_rate: e.target.value })} /></div>
                    )}
                  </div>
                  <div className="bg-primary/5 border border-primary/20 rounded-md p-3 text-sm">
                    Horas trabalhadas: <span className="font-display text-lg text-primary-glow">{calcWorkedHours(entForm).toFixed(2)}h</span>
                    {entForm.pay_type === "diaria" && Number(entForm.daily_rate) > 0 && (
                      <span className="ml-4">Valor do dia: <span className="font-display text-lg text-success">{fmtBRL(Number(entForm.daily_rate))}</span></span>
                    )}
                  </div>
                  <div><Label>Observações</Label><Input value={entForm.notes} onChange={e => setEntForm({ ...entForm, notes: e.target.value })} placeholder="opcional" /></div>
                </div>
                <DialogFooter><Button onClick={saveEnt} className="bg-gradient-gold text-primary-foreground">Salvar</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="p-0 bg-card/60 overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Funcionário</TableHead><TableHead>Data</TableHead>
                  <TableHead>Entrada</TableHead><TableHead>Almoço</TableHead><TableHead>Volta</TableHead><TableHead>Saída</TableHead>
                  <TableHead className="text-right">Horas</TableHead><TableHead>Pgto</TableHead><TableHead className="w-24"></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {entries.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum registro</TableCell></TableRow>}
                  {entries.map(e => {
                    const emp = employees.find(x => x.id === e.employee_id);
                    const h = calcWorkedHours(e);
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">{emp?.name || "—"}</TableCell>
                        <TableCell className="text-sm">{fmtDate(e.date)}</TableCell>
                        <TableCell className="text-sm tabular-nums">{e.clock_in || "—"}</TableCell>
                        <TableCell className="text-sm tabular-nums">{e.lunch_out || "—"}</TableCell>
                        <TableCell className="text-sm tabular-nums">{e.lunch_in || "—"}</TableCell>
                        <TableCell className="text-sm tabular-nums">{e.clock_out || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium text-primary-glow"><Clock className="inline h-3 w-3 mr-1" />{h.toFixed(2)}h</TableCell>
                        <TableCell className="text-xs">
                          {e.pay_type === "diaria"
                            ? <span className="text-success">Diária {fmtBRL(Number(e.daily_rate) || 0)}</span>
                            : <span className="text-muted-foreground">Fixo</span>}
                        </TableCell>
                        <TableCell className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEditEnt(e)}><Pencil className="h-4 w-4 text-muted-foreground hover:text-primary" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => delEnt(e.id)}><Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" /></Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="funcionarios" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Dialog open={empOpen} onOpenChange={setEmpOpen}>
              <DialogTrigger asChild><Button onClick={openNewEmp} className="bg-gradient-gold text-primary-foreground gap-2"><Plus className="h-4 w-4" /> Funcionário</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{empForm.id ? "Editar Funcionário" : "Novo Funcionário"}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Nome</Label><Input value={empForm.name} onChange={e => setEmpForm({ ...empForm, name: e.target.value })} /></div>
                    <div><Label>Cargo</Label><Input value={empForm.role} onChange={e => setEmpForm({ ...empForm, role: e.target.value })} /></div>
                  </div>
                  <div><Label>Tipo de Pagamento padrão</Label>
                    <Select value={empForm.pay_type} onValueChange={v => setEmpForm({ ...empForm, pay_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixo">Salário Fixo</SelectItem>
                        <SelectItem value="diaria">Diária</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Valor Diária (R$)</Label><Input type="number" step="0.01" value={empForm.daily_rate} onChange={e => setEmpForm({ ...empForm, daily_rate: e.target.value })} /></div>
                    <div><Label>Salário Fixo (R$)</Label><Input type="number" step="0.01" value={empForm.monthly_salary} onChange={e => setEmpForm({ ...empForm, monthly_salary: e.target.value })} /></div>
                  </div>
                </div>
                <DialogFooter><Button onClick={saveEmp} className="bg-gradient-gold text-primary-foreground">Salvar</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Card className="p-0 bg-card/60 overflow-hidden">
            <Table>
              <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Cargo</TableHead><TableHead>Pagamento</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead><TableHead className="w-24"></TableHead></TableRow></TableHeader>
              <TableBody>
                {employees.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum funcionário</TableCell></TableRow>}
                {employees.map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{e.role || "—"}</TableCell>
                    <TableCell className="text-xs">{e.pay_type === "diaria" ? "Diária" : "Fixo"}</TableCell>
                    <TableCell className="text-right tabular-nums text-primary-glow">{e.pay_type === "diaria" ? fmtBRL(Number(e.daily_rate) || 0) : fmtBRL(Number(e.monthly_salary) || 0)}</TableCell>
                    <TableCell><span className={`text-xs px-2 py-0.5 rounded ${e.active ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}`}>{e.active ? "Ativo" : "Inativo"}</span></TableCell>
                    <TableCell className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEditEmp(e)}><Pencil className="h-4 w-4 text-muted-foreground hover:text-primary" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => delEmp(e.id)}><Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="fornecedores" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Dialog open={supOpen} onOpenChange={setSupOpen}>
              <DialogTrigger asChild><Button onClick={openNewSup} className="bg-gradient-gold text-primary-foreground gap-2"><Plus className="h-4 w-4" /> Fornecedor</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{supForm.id ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Nome</Label><Input value={supForm.name} onChange={e => setSupForm({ ...supForm, name: e.target.value })} /></div>
                    <div><Label>Produto</Label><Input value={supForm.product} onChange={e => setSupForm({ ...supForm, product: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Último preço</Label><Input type="number" step="0.01" value={supForm.last_price} onChange={e => setSupForm({ ...supForm, last_price: e.target.value })} /></div>
                    <div><Label>Contato</Label><Input value={supForm.contact} onChange={e => setSupForm({ ...supForm, contact: e.target.value })} /></div>
                  </div>
                  <div><Label>Histórico / Notas</Label><Input value={supForm.notes} onChange={e => setSupForm({ ...supForm, notes: e.target.value })} /></div>
                </div>
                <DialogFooter><Button onClick={saveSup} className="bg-gradient-gold text-primary-foreground">Salvar</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Card className="p-0 bg-card/60 overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <Table>
                <TableHeader><TableRow><TableHead>Fornecedor</TableHead><TableHead>Produto</TableHead><TableHead className="text-right">Último Preço</TableHead><TableHead>Contato</TableHead><TableHead>Histórico</TableHead><TableHead className="w-24"></TableHead></TableRow></TableHeader>
                <TableBody>
                  {suppliers.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum fornecedor</TableCell></TableRow>}
                  {suppliers.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.product || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums text-primary-glow">{fmtBRL(s.last_price)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.contact || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{s.notes || "—"}</TableCell>
                      <TableCell className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEditSup(s)}><Pencil className="h-4 w-4 text-muted-foreground hover:text-primary" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => delSup(s.id)}><Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
