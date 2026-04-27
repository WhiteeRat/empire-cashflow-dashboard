import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, LogOut } from "lucide-react";
import { usePlanAccess } from "@/hooks/usePlanAccess";
import { Badge } from "@/components/ui/badge";

export function AccountSection() {
  const { user, signOut } = useAuth();
  const { isSuperAdmin } = usePlanAccess();

  return (
    <Card>
      <CardHeader><CardTitle className="text-base font-display">Conta</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{user?.email}</span>
          {isSuperAdmin && <Badge className="bg-gradient-gold text-primary-foreground">Super Admin</Badge>}
        </div>
        <Button variant="outline" size="sm" onClick={() => signOut()} className="gap-2">
          <LogOut className="h-4 w-4" /> Sair da conta
        </Button>
      </CardContent>
    </Card>
  );
}
