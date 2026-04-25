import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  FileBarChart,
  Wallet,
  CalendarRange,
  TrendingUp,
  Users,
  Crown,
  LogOut,
  Kanban,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "DRE Mensal", url: "/dre", icon: FileBarChart },
  { title: "Fluxo & Contas", url: "/fluxo", icon: Wallet },
  { title: "Orçamentos & Agenda", url: "/orcamentos", icon: CalendarRange },
  { title: "Produtividade", url: "/produtividade", icon: Kanban },
  { title: "Métricas Real x Previsto", url: "/metricas", icon: TrendingUp },
  { title: "Equipe & Fornecedores", url: "/equipe", icon: Users },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut, user } = useAuth();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border py-5">
        <div className="flex items-center gap-3 px-2">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-gold-glow blur-md opacity-60" />
            <Crown className="relative h-7 w-7 text-primary-glow" strokeWidth={2.2} />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-none">
              <span className="font-display text-2xl font-bold tracking-wider text-gold">IMPÉRIO</span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Gestão Soberana</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
            Navegação
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent transition-smooth"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium border-l-2 border-primary"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        {!collapsed && user && (
          <div className="px-2 py-1 text-xs text-muted-foreground truncate">{user.email}</div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut()}
          className="justify-start gap-2 text-muted-foreground hover:text-primary"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
