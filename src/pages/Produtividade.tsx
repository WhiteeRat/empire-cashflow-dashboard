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
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Pencil } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";

type Project = {
  id: string;
  name: string;
  client: string | null;
  responsible: string | null;
  status: string;
  deadline: string | null;
  progress: number;
  notes: string | null;
};

const STATUS = [
  { v: "em_andamento", label: "Em andamento", cls: "bg-blue-500/20 text-blue-400 border-blue-500/40", row: "border-l-4 border-l-blue-500/60" },
  { v: "concluido", label: "Concluído", cls: "bg-success/20 text-success border-success/40", row: "border-l-4 border-l-success/60" },
  { v: "atrasado", label: "Atrasado", cls: "bg-destructive/20 text-destructive border-destructive/40", row: "border-l-4 border-l-destructive/60" },
];

const empty = { id: "", name: "", client: "", responsible: "", status: "em_andamento", deadline: "", progress: 0, notes: "" };

export default function Produtividade() {
  const { user } = useAuth();
  const { activeCompany } = useCompany();
  const companyId = activeCompany?.id ?? null;
  const [items, setItems] = useState<Project[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ ...empty });

  const load = async () => {
    const { data } = await scope(supabase.from("projects").select("*").order("created_at", { ascending: false }), companyId);
    if (data) setItems(data as any);
  };
  useEffect(() => { if (user) load(); }, [user, companyId]);

  const openNew = () => { setForm({ ...empty }); setOpen(true); };
  const openEdit = (p: Project) => {
    setForm({
      id: p.id, name: p.name, client: p.client || "", responsible: p.responsible || "",
      status: p.status, deadline: p.deadline || "", progress: p.progress, notes: p.notes || "",
    });
    setOpen(true);
  };
  const save = async () => {
    if (!form.name) return toast.error("Nome obrigatório");
    const payload = {
      name: form.name as string,
      client: (form.client || null) as string | null,
      responsible: (form.responsible || null) as string | null,
      status: form.status as string,
      deadline: (form.deadline || null) as string | null,
      progress: Math.max(0, Math.min(100, Number(form.progress) || 0)),
      notes: (form.notes || null) as string | null,
    };
    const { error } = form.id
      ? await supabase.from("projects").update(payload).eq("id", form.id)
      : await supabase.from("projects").insert(withCompany({ ...payload, user_id: user!.id }, companyId));
    if (error) return toast.error(error.message);
    toast.success(form.id ? "Atualizado" : "Projeto criado");
    setOpen(false); load();
  };

  const inlineUpdate = async (id: string, field: string, value: any) => {
    const v = field === "progress" ? Math.max(0, Math.min(100, Number(value) || 0)) : value;
    await (supabase.from("projects") as any).update({ [field]: v }).eq("id", id);
    load();
  };

  const del = async (id: string) => { await supabase.from("projects").delete().eq("id", id); load(); };

  const statusInfo = (s: string) => STATUS.find(x => x.v === s) || STATUS[0];

  const counts = STATUS.map(s => ({ ...s, n: items.filter(i => i.status === s.v).length }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produtividade"
        subtitle="Gestão de projetos e contratos"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={openNew} className="bg-gradient-gold text-primary-foreground gap-2"><Plus className="h-4 w-4" /> Novo Projeto</Button></DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader><DialogTitle>{form.id ? "Editar Projeto" : "Novo Projeto"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nome do Projeto</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Pessoa</Label><Input value={form.client} onChange={e => setForm({ ...form, client: e.target.value })} /></div>
                  <div><Label>Responsável</Label><Input value={form.responsible} onChange={e => setForm({ ...form, responsible: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Status</Label>
                    <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUS.map(s => <SelectItem key={s.v} value={s.v}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Prazo</Label><Input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} /></div>
                  <div><Label>Progresso (%)</Label><Input type="number" min={0} max={100} value={form.progress} onChange={e => setForm({ ...form, progress: e.target.value })} /></div>
                </div>
                <div><Label>Notas</Label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={save} className="bg-gradient-gold text-primary-foreground">Salvar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {counts.map(c => (
          <Card key={c.v} className={`p-4 bg-card/60 ${c.row}`}>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</div>
            <div className="font-display text-3xl text-foreground mt-1">{c.n}</div>
          </Card>
        ))}
      </div>

      <Card className="p-0 bg-card/60 overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Projeto</TableHead>
                <TableHead>Pessoa</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead className="w-[160px]">Status</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead className="w-[200px]">Progresso</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Nenhum projeto cadastrado</TableCell></TableRow>}
              {items.map(p => {
                const info = statusInfo(p.status);
                return (
                  <TableRow key={p.id} className={info.row}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-sm">{p.client || "—"}</TableCell>
                    <TableCell className="text-sm">{p.responsible || "—"}</TableCell>
                    <TableCell>
                      <Select value={p.status} onValueChange={v => inlineUpdate(p.id, "status", v)}>
                        <SelectTrigger className={`h-8 ${info.cls}`}><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUS.map(s => <SelectItem key={s.v} value={s.v}>{s.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm">{fmtDate(p.deadline)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={p.progress} className="h-2 flex-1" />
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          defaultValue={p.progress}
                          onBlur={e => {
                            const n = Number(e.target.value);
                            if (n !== p.progress) inlineUpdate(p.id, "progress", n);
                          }}
                          className="h-7 w-14 text-xs text-center"
                        />
                        <span className="text-xs text-muted-foreground w-6">%</span>
                      </div>
                    </TableCell>
                    <TableCell className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4 text-muted-foreground hover:text-primary" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => del(p.id)}><Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
