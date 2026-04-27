import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";
import { toast } from "sonner";

export function CompanySection() {
  const { activeCompany, reloadCompanies } = useCompany();
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");

  useEffect(() => {
    setName(activeCompany?.name ?? "");
    setCnpj(activeCompany?.cnpj ?? "");
  }, [activeCompany?.id]);

  if (!activeCompany) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base font-display">Empresa</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Selecione uma empresa ativa no topo para editar seus dados.</p>
        </CardContent>
      </Card>
    );
  }

  const save = async () => {
    if (!name.trim()) return toast.error("Nome obrigatório");
    const { error } = await supabase.from("companies").update({ name: name.trim(), cnpj: cnpj.trim() || null }).eq("id", activeCompany.id);
    if (error) return toast.error(error.message);
    toast.success("Empresa atualizada");
    await reloadCompanies();
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base font-display flex items-center gap-2"><Building2 className="h-4 w-4" /> Empresa</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div><Label>Nome</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
        <div><Label>CNPJ</Label><Input value={cnpj} onChange={e => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" /></div>
        <Button onClick={save} className="bg-gradient-gold text-primary-foreground">Salvar alterações</Button>
      </CardContent>
    </Card>
  );
}
