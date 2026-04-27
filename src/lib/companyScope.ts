/**
 * Centraliza o escopo de "empresa ativa" para queries Supabase.
 *
 * Regra de negócio (decidida com o usuário):
 *  - Se houver empresa ativa selecionada → mostra SOMENTE registros dessa empresa.
 *  - Se NÃO houver empresa ativa ("Todas as empresas") → mostra somente registros
 *    legados sem company_id (assim "Todas as empresas" funciona como bandeja de
 *    legado/uncategorized e cada empresa fica 100% isolada).
 *
 * Use sempre `scope(query, activeCompanyId)` em SELECT/UPDATE/DELETE
 * e `withCompany(payload, activeCompanyId)` em INSERT.
 */
export function scope<T extends { eq: (col: string, v: any) => T; is: (col: string, v: any) => T }>(
  query: T,
  activeCompanyId: string | null | undefined
): T {
  if (activeCompanyId) return query.eq("company_id", activeCompanyId);
  return query.is("company_id", null);
}

export function withCompany<T extends Record<string, any>>(payload: T, activeCompanyId: string | null | undefined): T & { company_id: string | null } {
  return { ...payload, company_id: activeCompanyId ?? null };
}
