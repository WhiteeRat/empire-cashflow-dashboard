import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Download, Clock } from "lucide-react";
import { fmtBRL, fmtDate } from "@/lib/format";
import { exportToXlsx } from "@/lib/exporter";
import { toast } from "sonner";

export default function Equipe() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);

  const [empOpen, setEmpOpen] = useState(false);
  const [supOpen, setSupOpen] = useState(false);
  const [entOpen, setEntOpen] = useState(false);

  const [empForm, setEmpForm] = useState({ name: "", role: "" });
  const [supForm, setSupForm] = useState({ name: "", product: "", last_price: "", contact: "", notes: "" });
  const [entForm, setEntForm] = useState({ employee_id: "", date: new Date().toISOString().slice(0, 10), clock_in: "08:00", clock_out: "17:00" });

  const load = async () => {
    const [e, t, s] = await Promise.all([
      supabase.from("employees").select("*").order("name"),
      supabase.from("time_entries").select("*").order("date", { ascending: false }),
      supabase.from("suppliers").select("*").order("name"),
    ]);
    if (e.data) setEmployees(e.data);
    if (t.data) setEntries(t.data);
    if (s.data) setSuppliers(s.data);
  };
  useEffect(() => { if (user) load(); }, [user]);

  const addEmp = async () => {
    if (!empForm.name) return;
    await supabase.from("employees").insert({ ...empForm, user_id: user!.id });
    setEmpOpen(false); setEmpForm({ name: "", role: "" }); toast.success("Funcionário adicionado"); load();
  };
  const addSup = async () => {
    if (!supForm.name) return;
    await supabase.from("suppliers").insert({ ...supForm, last_price: Number(supForm.last_price) || 0, user_id: user!.id });
    setSupOpen(false); setSupForm({ name: "", product: "", last_price: "", contact: "", notes: "" }); toast.success("Fornecedor adicionado"); load();
  };
  const addEnt = async () => {
    if (!entForm.employee_id) return toast.error("Selecione funcionário");
    await supabase.from("time_entries").insert({ ...entForm, user_id: user!.id });
    setEntOpen(false); toast.success("Ponto registrado"); load();
  };
  const delEmp = async (id: string) => { await supabase.from("employees").delete().eq("id", id); load(); };
  const delEnt = async (id: string) => { await supabase.from("time_entries").delete().eq("id", id); load(); };
  const delSup = async (id: string) => { await supabase.from("suppliers").delete().eq("id", id); load(); };

  const calcHours = (ci: string, co: string) => {
    if (!ci || !co) return 0;
    const [h1, m1] = ci.split(":").map(Number);
    const [h2, m2] = co.split(":").map(Number);
    return ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
  };

  const exportPonto = () => {
    exportToXlsx(entries.map(e => {
      const emp = employees.find(em => em.id === e.employee_id);
      return { Funcionario: emp?.name || "—", Data: e.date, Entrada: e.clock_in, Saida: e.clock_out, Horas: calcHours(e.clock_in, e.clock_out).toFixed(2) };
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
              <DialogTrigger asChild><Button className="bg-gradient-gold text-primary-foreground gap-2"><Plus className="h-4 w-4" /> Registrar Ponto</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Registro de Ponto</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Funcionário</Label>
                    <Select value={entForm.employee_id} onValueChange={v => setEntForm({ ...entForm, employee_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{employees.filter(e => e.active).map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label>Data</Label><Input type="date" value={entForm.date} onChange={e => setEntForm({ ...entForm, date: e.target.value })} /></div>
                    <div><Label>Entrada</Label><Input type="time" value={entForm.clock_in} onChange={e => setEntForm({ ...entForm, clock_in: e.target.value })} /></div>
                    <div><Label>Saída</Label><Input type="time" value={entForm.clock_out} onChange={e => setEntForm({ ...entForm, clock_out: e.target.value })} /></div>
                  </div>
                </div>
                <DialogFooter><Button onClick={addEnt} className="bg-gradient-gold text-primary-foreground">Salvar</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="p-0 bg-card/60 overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <Table>
                <TableHeader><TableRow><TableHead>Funcionário</TableHead><TableHead>Data</TableHead><TableHead>Entrada</TableHead><TableHead>Saída</TableHead><TableHead className="text-right">Horas</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {entries.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum registro</TableCell></TableRow>}
                  {entries.map(e => {
                    const emp = employees.find(x => x.id === e.employee_id);
                    const h = calcHours(e.clock_in, e.clock_out);
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">{emp?.name || "—"}</TableCell>
                        <TableCell className="text-sm">{fmtDate(e.date)}</TableCell>
                        <TableCell className="text-sm tabular-nums">{e.clock_in}</TableCell>
                        <TableCell className="text-sm tabular-nums">{e.clock_out}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium text-primary-glow"><Clock className="inline h-3 w-3 mr-1" />{h.toFixed(2)}h</TableCell>
                        <TableCell><Button size="icon" variant="ghost" onClick={() => delEnt(e.id)}><Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" /></Button></TableCell>
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
              <DialogTrigger asChild><Button className="bg-gradient-gold text-primary-foreground gap-2"><Plus className="h-4 w-4" /> Funcionário</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo Funcionário</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Nome</Label><Input value={empForm.name} onChange={e => setEmpForm({ ...empForm, name: e.target.value })} /></div>
                  <div><Label>Cargo</Label><Input value={empForm.role} onChange={e => setEmpForm({ ...empForm, role: e.target.value })} /></div>
                </div>
                <DialogFooter><Button onClick={addEmp} className="bg-gradient-gold text-primary-foreground">Salvar</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Card className="p-0 bg-card/60 overflow-hidden">
            <Table>
              <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Cargo</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {employees.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum funcionário</TableCell></TableRow>}
                {employees.map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{e.role || "—"}</TableCell>
                    <TableCell><span className={`text-xs px-2 py-0.5 rounded ${e.active ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}`}>{e.active ? "Ativo" : "Inativo"}</span></TableCell>
                    <TableCell><Button size="icon" variant="ghost" onClick={() => delEmp(e.id)}><Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="fornecedores" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Dialog open={supOpen} onOpenChange={setSupOpen}>
              <DialogTrigger asChild><Button className="bg-gradient-gold text-primary-foreground gap-2"><Plus className="h-4 w-4" /> Fornecedor</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo Fornecedor</DialogTitle></DialogHeader>
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
                <DialogFooter><Button onClick={addSup} className="bg-gradient-gold text-primary-foreground">Salvar</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Card className="p-0 bg-card/60 overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <Table>
                <TableHeader><TableRow><TableHead>Fornecedor</TableHead><TableHead>Produto</TableHead><TableHead className="text-right">Último Preço</TableHead><TableHead>Contato</TableHead><TableHead>Histórico</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {suppliers.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum fornecedor</TableCell></TableRow>}
                  {suppliers.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.product || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums text-primary-glow">{fmtBRL(s.last_price)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.contact || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{s.notes || "—"}</TableCell>
                      <TableCell><Button size="icon" variant="ghost" onClick={() => delSup(s.id)}><Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" /></Button></TableCell>
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
