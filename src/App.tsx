import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { GuardedRoute } from "@/components/GuardedRoute";

import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import DRE from "./pages/DRE";
import FluxoCaixa from "./pages/FluxoCaixa";
import Orcamentos from "./pages/Orcamentos";
import Produtividade from "./pages/Produtividade";
import Metricas from "./pages/Metricas";
import Equipe from "./pages/Equipe";
import Contabilidade from "./pages/Contabilidade";
import Diretoria from "./pages/Diretoria";
import Imperar from "./pages/Imperar";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CompanyProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/"              element={<GuardedRoute moduleKey="dashboard"><Dashboard /></GuardedRoute>} />
            <Route path="/dre"           element={<GuardedRoute moduleKey="dre"><DRE /></GuardedRoute>} />
            <Route path="/fluxo"         element={<GuardedRoute moduleKey="fluxo"><FluxoCaixa /></GuardedRoute>} />
            <Route path="/orcamentos"    element={<GuardedRoute moduleKey="orcamentos"><Orcamentos /></GuardedRoute>} />
            <Route path="/produtividade" element={<GuardedRoute moduleKey="produtividade"><Produtividade /></GuardedRoute>} />
            <Route path="/metricas"      element={<GuardedRoute moduleKey="metricas"><Metricas /></GuardedRoute>} />
            <Route path="/equipe"        element={<GuardedRoute moduleKey="equipe"><Equipe /></GuardedRoute>} />
            <Route path="/contabilidade" element={<GuardedRoute moduleKey="contabilidade"><Contabilidade /></GuardedRoute>} />
            <Route path="/diretoria"     element={<GuardedRoute moduleKey="diretoria"><Diretoria /></GuardedRoute>} />
            <Route path="/imperar"       element={<GuardedRoute moduleKey="imperar"><Imperar /></GuardedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </CompanyProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
