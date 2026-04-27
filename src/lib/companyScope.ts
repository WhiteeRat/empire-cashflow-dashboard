/**
 * Centraliza o escopo de "empresa ativa" para queries Supabase.
 *
 * Regra de negócio:
 *  - Se houver empresa ativa → mostra SOMENTE registros dessa empresa.
 *  - Se NÃO houver empresa ativa ("Todas as empresas") → mostra somente registros
 *    legados sem company_id. Cada empresa fica 100% isolada.
 *
 * Usamos `any` propositalmente: os generics encadeados do Postgrest estouram
 * a profundidade do TS. O contrato real é validado em runtime pelo Supabase.
 */
export function scope(query: any, activeCompanyId: string | null | undefined): any {
  if (activeCompanyId) return query.eq("company_id", activeCompanyId);
  return query.is("company_id", null);
}

export function withCompany<T extends Record<string, any>>(payload: T, activeCompanyId: string | null | undefined): T & { company_id: string | null } {
  return { ...payload, company_id: activeCompanyId ?? null };
}
