import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";

import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import DRE from "./pages/DRE";
import FluxoCaixa from "./pages/FluxoCaixa";
import Orcamentos from "./pages/Orcamentos";
import Metricas from "./pages/Metricas";
import Equipe from "./pages/Equipe";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
            <Route path="/dre" element={<ProtectedRoute><AppLayout><DRE /></AppLayout></ProtectedRoute>} />
            <Route path="/fluxo" element={<ProtectedRoute><AppLayout><FluxoCaixa /></AppLayout></ProtectedRoute>} />
            <Route path="/orcamentos" element={<ProtectedRoute><AppLayout><Orcamentos /></AppLayout></ProtectedRoute>} />
            <Route path="/metricas" element={<ProtectedRoute><AppLayout><Metricas /></AppLayout></ProtectedRoute>} />
            <Route path="/equipe" element={<ProtectedRoute><AppLayout><Equipe /></AppLayout></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </Sonner>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
