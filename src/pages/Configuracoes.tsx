import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/PageHeader";
import { AccountSection } from "@/components/settings/AccountSection";
import { CompanySection } from "@/components/settings/CompanySection";
import { SubscriptionSection } from "@/components/settings/SubscriptionSection";
import { PermissionsSection, IntegrationsSection } from "@/components/settings/MiscSections";
import { PreferencesSection } from "@/components/settings/PreferencesSection";
import { SaasBudgetExportSection } from "@/components/settings/SaasBudgetExportSection";

/**
 * Página /configuracoes
 * Substitui o antigo popup de Settings — agora é uma página dedicada com 6 seções.
 */
export default function Configuracoes() {
  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" subtitle="Conta, empresa, assinatura e preferências do sistema" />
      <Tabs defaultValue="conta" className="w-full">
        <TabsList className="flex flex-wrap gap-1 bg-card/40 backdrop-blur">
          <TabsTrigger value="conta">Conta</TabsTrigger>
          <TabsTrigger value="empresa">Empresa</TabsTrigger>
          <TabsTrigger value="assinatura">Assinatura</TabsTrigger>
          <TabsTrigger value="permissoes">Permissões</TabsTrigger>
          <TabsTrigger value="integracoes">Integrações</TabsTrigger>
          <TabsTrigger value="preferencias">Preferências</TabsTrigger>
        </TabsList>

        <TabsContent value="conta" className="mt-4"><AccountSection /></TabsContent>
        <TabsContent value="empresa" className="mt-4"><CompanySection /></TabsContent>
        <TabsContent value="assinatura" className="mt-4 space-y-4">
          <SubscriptionSection />
          <SaasBudgetExportSection />
        </TabsContent>
        <TabsContent value="permissoes" className="mt-4"><PermissionsSection /></TabsContent>
        <TabsContent value="integracoes" className="mt-4"><IntegrationsSection /></TabsContent>
        <TabsContent value="preferencias" className="mt-4"><PreferencesSection /></TabsContent>
      </Tabs>
    </div>
  );
}
