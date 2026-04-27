import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

/**
 * Substitui o antigo popup. Agora abre a página dedicada /configuracoes.
 * Mantém o mesmo nome/exportação por compat com AppLayout.
 */
export function SettingsDialog() {
  const navigate = useNavigate();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Configurações"
      title="Configurações"
      onClick={() => navigate("/configuracoes")}
    >
      <SettingsIcon className="h-4 w-4" />
    </Button>
  );
}
