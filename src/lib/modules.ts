/**
 * Catálogo central de módulos do sistema.
 * Cada chave aqui corresponde ao valor armazenado em `plans.modules` (jsonb)
 * e em `company_module_overrides.module_key`.
 *
 * O AppSidebar e o ProtectedRoute consultam este catálogo para saber
 * qual aba liberar/bloquear conforme a assinatura ativa da empresa.
 */

export type ModuleKey =
  | "dashboard"
  | "dre"
  | "fluxo"
  | "orcamentos"
  | "produtividade"
  | "metricas"
  | "equipe"
  | "contabilidade"
  | "diretoria"
  | "imperar";

export type ModuleDef = {
  key: ModuleKey;
  title: string;
  path: string;
};

export const MODULES: ModuleDef[] = [
  { key: "dashboard",     title: "Dashboard",                   path: "/" },
  { key: "dre",           title: "DRE Mensal",                  path: "/dre" },
  { key: "fluxo",         title: "Fluxo & Contas",              path: "/fluxo" },
  { key: "orcamentos",    title: "Orçamentos & Agenda",         path: "/orcamentos" },
  { key: "produtividade", title: "Produtividade",               path: "/produtividade" },
  { key: "metricas",      title: "Métricas Real x Previsto",    path: "/metricas" },
  { key: "equipe",        title: "Equipe & Fornecedores",       path: "/equipe" },
  { key: "contabilidade", title: "Contabilidade",               path: "/contabilidade" },
  { key: "diretoria",     title: "Diretoria",                   path: "/diretoria" },
  { key: "imperar",       title: "Imperar — Crescimento",       path: "/imperar" },
];

export function moduleByPath(path: string): ModuleDef | undefined {
  return MODULES.find((m) => m.path === path);
}
