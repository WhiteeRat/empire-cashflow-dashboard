
# Plano de atualização do IMPÉRIO

Manter 100% das funcionalidades existentes. As mudanças são aditivas (novas colunas, novas tabelas, novos diálogos de edição). Nada será removido.

## 1. Banco de dados (migração SQL)

**Alterar `time_entries`** — controle de ponto avançado:
- `lunch_out time` (saída para almoço)
- `lunch_in time` (retorno do almoço)
- `pay_type text default 'fixo'` (`fixo` | `diaria`)
- `daily_rate numeric default 0`
- `notes text`

**Alterar `employees`**:
- `pay_type text default 'fixo'`
- `daily_rate numeric default 0`
- `monthly_salary numeric default 0`

**Nova tabela `projects`** (módulo Produtividade estilo Monday):
- `id`, `user_id`, `name`, `client`, `responsible`, `status` (`em_andamento` | `concluido` | `atrasado`), `deadline date`, `progress int default 0`, `notes`, `created_at`
- RLS: `auth.uid() = user_id` (igual às demais tabelas).

Não há alterações destrutivas; nenhuma coluna existente é removida.

## 2. Módulo Ponto (`src/pages/Equipe.tsx`)

- Diálogo de ponto passa a ter 4 horários: entrada, saída almoço, retorno almoço, saída final.
- Cálculo de horas: `(lunch_out - clock_in) + (clock_out - lunch_in)`; campos de almoço opcionais (cai no cálculo simples antigo se vazios).
- Edição inline na tabela: clicar no registro abre o mesmo diálogo em modo "editar" (update por id).
- Em **Funcionários**: novos campos no cadastro (tipo de pagamento, valor da diária, salário fixo).
- Coluna nova na tabela de ponto: "Pgto" (mostra `Diária R$X` ou `Fixo`) e cálculo do valor do dia quando diária.
- Exportação atualizada incluindo almoço e tipo de pagamento.

## 3. Importação de extrato PDF (novo)

- Adicionar dependência `pdfjs-dist` (parsing PDF no browser).
- Novo helper `src/lib/pdfImporter.ts`:
  - Lê o PDF, extrai texto por linha.
  - Regex genérica para extratos brasileiros: detecta `dd/mm/aaaa` ou `dd/mm`, captura descrição até o valor, e valor `R$` com sinal (`-` ou `D` = débito, `C` = crédito).
  - Retorna `{ date, description, amount, type }[]`.
- Novo diálogo "Importar Extrato PDF" na aba Fluxo de Caixa:
  - Upload do arquivo → tabela editável de prévia (linha a linha: data, descrição, tipo, valor, checkbox "incluir").
  - Botão **Confirmar importação** insere em `transactions`.
- Mantém o import CSV/XLSX atual intacto.

## 4. Edição completa de lançamentos

Em todas as tabelas abaixo, cada linha ganha botão **lápis (Edit)** que abre o mesmo diálogo de criação preenchido, executando `update` em vez de `insert`:

- **Contas a pagar** (`payables`)
- **Contas a receber** (`receivables`)
- **Fluxo de caixa** (`transactions`) — também com edição inline (data, descrição, valor)
- **Lançamentos da agenda / orçamentos** (`budgets`)

Refator: extrair função `openEdit(item)` que reaproveita o estado do form existente; o `save` decide insert vs update via presença de `id`.

## 5. Fluxo de Caixa — melhorias

- Filtros no topo da aba Fluxo: período (data inicial / final) + tipo (Todos / Receita / Despesa) + busca por descrição.
- Exibir totais filtrados (entradas, saídas, saldo) acima da tabela.
- Edição inline por célula em data, descrição e valor (input que faz `update` no blur).
- Importações de PDF/CSV continuam alimentando a mesma tabela `transactions` automaticamente.

## 6. Agenda / Orçamentos

- Cada linha em `Orcamentos.tsx` ganha botão de edição que abre o diálogo já preenchido (mesmo padrão do item 4).
- A tag de agenda continua editável pelo mesmo diálogo.

## 7. Nova aba **Produtividade** (estilo Monday)

- Nova rota `/produtividade` em `src/App.tsx` e item no `AppSidebar` (ícone `Kanban` ou `ListChecks`).
- Página `src/pages/Produtividade.tsx`:
  - Tabela interativa com colunas: Projeto, Pessoa, Responsável, Status, Prazo, Progresso, Ações.
  - **Status** via `Select` inline com cores:
    - Em andamento → azul
    - Concluído → verde
    - Atrasado → vermelho
  - **Progresso** via componente `Progress` + input numérico inline (0–100%).
  - Linha inteira muda de cor sutil conforme status.
  - Botão "+ Novo Projeto" abre diálogo (criar/editar). Excluir com confirmação.
  - Persistência em tabela `projects`.

## Detalhes técnicos

- **PDF**: usar `pdfjs-dist` com worker via `?url` import do Vite. Parse client-side; sem edge function.
- **Edição inline**: padrão controlado por `editingId` + `editForm` local; debounce não necessário (commit no blur ou Enter).
- **Tipos**: após a migração, `src/integrations/supabase/types.ts` é regenerado automaticamente — não editar à mão.
- **Estilo**: manter paleta dark premium azul/diamante já em uso (`bg-gradient-gold` e tokens existentes); novos badges de status usam `bg-blue-500/20`, `bg-success/20`, `bg-destructive/20`.
- **Compatibilidade**: novas colunas têm defaults, não quebram registros antigos. Funções `addEnt`, `addPay`, etc. continuam funcionando — só ganham um irmão `updateEnt`, `updatePay`.

## Arquivos afetados

- `supabase/migrations/<novo>.sql` (novo)
- `src/pages/Equipe.tsx` (atualizar)
- `src/pages/FluxoCaixa.tsx` (atualizar — filtros, edição, import PDF)
- `src/pages/Orcamentos.tsx` (atualizar — edição)
- `src/pages/Produtividade.tsx` (novo)
- `src/lib/pdfImporter.ts` (novo)
- `src/components/AppSidebar.tsx` (novo item)
- `src/App.tsx` (nova rota)
- `package.json` (`pdfjs-dist`)
