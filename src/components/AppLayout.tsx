import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { CompanySwitcher } from "@/components/CompanySwitcher";
import { SettingsDialog } from "@/components/SettingsDialog";
import { PendingPopup } from "@/components/PendingPopup";
import { Crown } from "lucide-react";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border bg-card/40 backdrop-blur-sm px-4 sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground hover:text-primary" />
              <div className="hidden md:flex items-center gap-2">
                <Crown className="h-4 w-4 text-primary" />
                <span className="font-display text-lg tracking-wide text-foreground/90">Painel Imperial</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CompanySwitcher />
              <SettingsDialog />
              <div className="hidden lg:block text-xs text-muted-foreground tracking-widest uppercase">
                {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
              </div>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 lg:p-8 animate-fade-in">{children}</main>
          <PendingPopup />
        </div>
      </div>
    </SidebarProvider>
  );
}
