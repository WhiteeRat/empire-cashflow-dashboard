import { useState } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Building2, Plus, Pencil, Trash2, Check } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function CompanySwitcher() {
  const { companies, activeCompany, setActiveCompany, reloadCompanies } = useCompany();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<{ id?: string; name: string; cnpj: string }>({ name: "", cnpj: "" });
  const [manageOpen, setManageOpen] = useState(false);

  const openNew = () => { setEditing({ name: "", cnpj: "" }); setOpen(true); };
  const openEdit = (c: any) => { setEditing({ id: c.id, name: c.name, cnpj: c.cnpj || "" }); setOpen(true); };

  const save = async () => {
    if (!editing.name.trim()) return toast.error("Nome obrigatório");
    const payload = { name: editing.name.trim(), cnpj: editing.cnpj.trim() || null };
    const { error } = editing.id
      ? await supabase.from("companies").update(payload).eq("id", editing.id)
      : await supabase.from("companies").insert({ ...payload, user_id: user!.id });
    if (error) return toast.error(error.message);
    toast.success("Empresa salva");
    setOpen(false);
    await reloadCompanies();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover esta empresa? Os dados existentes ficarão sem empresa atribuída.")) return;
    await supabase.from("companies").delete().eq("id", id);
    if (activeCompany?.id === id) await setActiveCompany(null);
    await reloadCompanies();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 border-primary/30 hover:border-primary/60">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="max-w-[140px] truncate font-medium">
              {activeCompany?.name || "Todas as empresas"}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
            Empresa ativa
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setActiveCompany(null)} className="cursor-pointer">
            <div className="flex items-center gap-2 flex-1">
              {!activeCompany && <Check className="h-3.5 w-3.5 text-primary" />}
              <span className={!activeCompany ? "font-medium" : ""}>Todas as empresas</span>
            </div>
          </DropdownMenuItem>
          {companies.map(c => (
            <DropdownMenuItem key={c.id} onClick={() => setActiveCompany(c)} className="cursor-pointer">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {activeCompany?.id === c.id && <Check className="h-3.5 w-3.5 text-primary" />}
                <span className={`truncate ${activeCompany?.id === c.id ? "font-medium" : ""}`}>{c.name}</span>
              </div>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={openNew} className="cursor-pointer text-primary">
            <Plus className="h-4 w-4 mr-2" /> Nova empresa
          </DropdownMenuItem>
          {companies.length > 0 && (
            <DropdownMenuItem onClick={() => setManageOpen(true)} className="cursor-pointer">
              <Pencil className="h-4 w-4 mr-2" /> Gerenciar empresas
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing.id ? "Editar Empresa" : "Nova Empresa"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
            <div><Label>CNPJ</Label><Input value={editing.cnpj} onChange={e => setEditing({ ...editing, cnpj: e.target.value })} placeholder="00.000.000/0000-00" /></div>
          </div>
          <DialogFooter><Button onClick={save} className="bg-gradient-gold text-primary-foreground">Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Gerenciar Empresas</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {companies.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-md border border-border/40 bg-card/40">
                <div>
                  <div className="font-medium">{c.name}</div>
                  {c.cnpj && <div className="text-xs text-muted-foreground">{c.cnpj}</div>}
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => { openEdit(c); setManageOpen(false); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(c.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
