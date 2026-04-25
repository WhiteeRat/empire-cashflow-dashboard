import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Crown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const signInSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres").max(72),
});
const signUpSchema = signInSchema.extend({
  displayName: z.string().trim().min(2, "Nome muito curto").max(80),
});

export default function Auth() {
  const { user, signIn, signUp, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [form, setForm] = useState({ email: "", password: "", displayName: "" });

  if (!loading && user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (tab === "signin") {
        const parsed = signInSchema.safeParse(form);
        if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
        const { error } = await signIn(form.email, form.password);
        if (error) toast.error(error.message);
        else { toast.success("Bem-vindo ao Império."); navigate("/"); }
      } else {
        const parsed = signUpSchema.safeParse(form);
        if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
        const { error } = await signUp(form.email, form.password, form.displayName);
        if (error) {
          if (error.message.includes("already")) toast.error("Este email já está cadastrado.");
          else toast.error(error.message);
        } else {
          toast.success("Conta criada! Você já pode entrar.");
          setTab("signin");
        }
      }
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-radial opacity-100 pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4 relative">
            <div className="absolute inset-0 bg-gradient-gold-glow blur-xl opacity-50" />
            <Crown className="relative h-14 w-14 text-primary-glow" strokeWidth={1.8} />
          </div>
          <h1 className="font-display text-5xl font-bold tracking-wide text-gold mb-1">IMPÉRIO</h1>
          <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Gestão Soberana</p>
        </div>

        <Card className="p-6 bg-card/80 backdrop-blur-md border-border shadow-elegant">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted/50">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
            </TabsList>

            <form onSubmit={handleSubmit} className="space-y-4">
              <TabsContent value="signup" className="space-y-4 mt-0">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Nome</Label>
                  <Input
                    id="displayName"
                    placeholder="Seu nome completo"
                    value={form.displayName}
                    onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                    maxLength={80}
                  />
                </div>
              </TabsContent>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  maxLength={255}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  maxLength={72}
                  required
                />
              </div>

              <Button type="submit" disabled={busy} className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90 font-semibold tracking-wide shadow-gold">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : tab === "signin" ? "Entrar no Império" : "Criar conta"}
              </Button>
            </form>
          </Tabs>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6 tracking-wide">
          Acesse seus dados de qualquer dispositivo, em qualquer hora.
        </p>
      </div>
    </div>
  );
}
