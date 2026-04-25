import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";
import { fmtBRL, fmtPct } from "@/lib/format";
import { toast } from "sonner";

const DEFAULTS = ["Combustível", "Pedágio", "Funcionários", "Contabilidade", "Aluguel"];

export default function Metricas() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category: "", ideal_percent: "", budget_amount: "", real_amount: "" });

  const load = async () => {
    const { data } = await supabase.from("metrics").select("*").order("created_at");
    if (data) setRows(data);
  };
  useEffect(() => { if (user) load(); }, [user]);

  const seedDefaults = async () => {
    if (!user) return;
    const inserts = DEFAULTS.map(c => ({ category: c, ideal_percent: 5, budget_amount: 0, real_amount: 0, user_id: user.id }));
    await supabase.from("metrics").insert(inserts);
    load();
  };

  const save = async () => {
    if (!form.category) return toast.error("Categoria obrigatória");
    const { error } = await supabase.from("metrics").insert({
      ...form,
      ideal_percent: Number(form.ideal_percent) || 0,
      budget_amount: Number(form.budget_amount) || 0,
      real_amount: Number(form.real_amount) || 0,
      user_id: user!.id,
    });
    if (error) toast.error(error.message);
    else { toast.success("Métrica adicionada"); setOpen(false); setForm({ category: "", ideal_percent: "", budget_amount: "", real_amount: "" }); load(); }
  };

  const updateRow = async (id: string, field: string, value: number) => {
    await supabase.from("metrics").update({ [field]: value } as any).eq("id", id);
    load();
  };
  const del = async (id: string) => { await supabase.from("metrics").delete().eq("id", id); load(); };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Métricas — Real vs Previsto"
        subtitle="Orçamento físico e disciplina financeira"
        actions={
          <>
            {rows.length === 0 && <Button onClick={seedDefaults} variant="outline" className="border-primary/40">Carregar padrões</Button>}
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button className="bg-gradient-gold text-primary-foreground gap-2"><Plus className="h-4 w-4" /> Categoria</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova Métrica</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Categoria</Label><Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /></div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label>% Ideal</Label><Input type="number" step="0.1" value={form.ideal_percent} onChange={e => setForm({ ...form, ideal_percent: e.target.value })} /></div>
                    <div><Label>Orçado R$</Label><Input type="number" step="0.01" value={form.budget_amount} onChange={e => setForm({ ...form, budget_amount: e.target.value })} /></div>
                    <div><Label>Real R$</Label><Input type="number" step="0.01" value={form.real_amount} onChange={e => setForm({ ...form, real_amount: e.target.value })} /></div>
                  </div>
                </div>
                <DialogFooter><Button onClick={save} className="bg-gradient-gold text-primary-foreground">Salvar</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <Card className="p-0 bg-card/60 overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Métrica % (Ideal)</TableHead>
                <TableHead className="text-right">Orçamento Estipulado</TableHead>
                <TableHead className="text-right">Valor Real Usado</TableHead>
                <TableHead className="text-right">Diferença</TableHead>
                <TableHead className="text-center">Situação</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Sem métricas. Use "Carregar padrões" para começar.</TableCell></TableRow>}
              {rows.map(r => {
                const diff = Number(r.budget_amount) - Number(r.real_amount);
                const ok = Number(r.real_amount) <= Number(r.budget_amount);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.category}</TableCell>
                    <TableCell className="text-right">
                      <Input type="number" step="0.1" defaultValue={r.ideal_percent} onBlur={e => updateRow(r.id, "ideal_percent", Number(e.target.value))} className="h-8 w-24 ml-auto text-right" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input type="number" step="0.01" defaultValue={r.budget_amount} onBlur={e => updateRow(r.id, "budget_amount", Number(e.target.value))} className="h-8 w-32 ml-auto text-right" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input type="number" step="0.01" defaultValue={r.real_amount} onBlur={e => updateRow(r.id, "real_amount", Number(e.target.value))} className="h-8 w-32 ml-auto text-right" />
                    </TableCell>
                    <TableCell className={`text-right tabular-nums font-medium ${diff >= 0 ? "text-success" : "text-destructive"}`}>{fmtBRL(diff)}</TableCell>
                    <TableCell className="text-center">
                      {ok ? (
                        <Badge className="bg-success/20 text-success border-success/40 gap-1"><CheckCircle2 className="h-3 w-3" /> OK</Badge>
                      ) : (
                        <Badge className="bg-destructive/20 text-destructive border-destructive/40 gap-1"><AlertTriangle className="h-3 w-3" /> EXCEDIDO</Badge>
                      )}
                    </TableCell>
                    <TableCell><Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" /></Button></TableCell>
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
