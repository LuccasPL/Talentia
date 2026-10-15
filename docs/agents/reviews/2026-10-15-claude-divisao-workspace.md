# Registro de alterações — Claude (Claude Code), 15/10/2026

Este registro existe para que outra LLM (ex.: Codex) que trabalhe neste checkout entenda **o que o Claude alterou, por quê e o que ficou de fora**, sem acesso à conversa original.

Base: `0c558d0` (HEAD de `main`), com o trabalho **não commitado** de "prazos de apresentação" já presente no checkout.

Situação: com autorização do usuário, tudo foi commitado em `main` **num único commit**, `1319e25` ("feat: add presentation deadlines overview and split workspace views"). Esse commit inclui a refatoração do Claude e o trabalho de prazos. Não houve push. Os dois trabalhos ficaram juntos porque `workspace.tsx` contém os dois, e separá-los deixaria um commit intermediário que não compila.

## Pedido do usuário

1. Dividir `app/workspace.tsx` (≈75 KB e cerca de 160 linhas muito longas), sem mudar o comportamento.
2. Revisar a funcionalidade de prazos de apresentação, que ainda não foi commitada.
3. Corrigir o script `lint`, que listava arquivos de `lib/` um a um e deixava arquivos novos de fora sem aviso.

## Arquivos que o Claude alterou ou criou

| Arquivo | Tipo | O que mudou |
| --- | --- | --- |
| `app/workspace-shared.tsx` | **novo** | Recebeu `nav`, `navGroups`, `Choice` e `initials`, movidos sem alteração do topo de `workspace.tsx`. |
| `app/contact-board.tsx` | **novo** | Componente `ContactBoard` com a tela **Contatos** (antes era a função interna `renderContacts()`). Exporta `ContactView` e `emptyContactView`. |
| `app/candidate-filters-panel.tsx` | **novo** | Componente `CandidateFiltersPanel` com busca assistida e filtros do banco de talentos (antes era a função interna `renderFilters()`, usada em 2 lugares). |
| `app/workspace.tsx` | editado | Usa os três módulos acima. Detalhes na seção seguinte. |
| `package.json` | editado | `scripts.lint` passou a ser `eslint app lib hooks components proxy.ts`. |
| `docs/agents/reviews/2026-10-15-claude-divisao-workspace.md` | **novo** | Este registro. |

| `app/recruitment-overview.tsx` | editado (1 linha) | Corrige um bug do trabalho de prazos: `<JobDeadlines key={selectedScope}>` → `` key={`deadlines:${selectedScope}`} ``. Detalhes na seção de revisão. |

O Claude **não alterou** `lib/job-deadlines.ts`, `app/job-deadlines.tsx`, `app/globals.css`, os testes de prazos nem `docs/agents/reviews/2026-10-15-prazos-apresentacao.md`. Em `recruitment-overview.tsx`, mudou apenas a `key` acima. A única alteração do trabalho de prazos em `workspace.tsx` (o callback `onBriefing` do `RecruitmentOverview`) foi preservada.

## Detalhes em `app/workspace.tsx`

As edições foram feitas por scripts que conferem cada linha esperada e abortam se o conteúdo for diferente. Nenhuma lógica foi reescrita: o JSX foi movido literalmente e as chamadas a `setX` foram trocadas por callbacks equivalentes.

- **Imports**
  - Removidos: `LayoutDashboard` (lucide), `Select*` (`@/components/ui/select`), `contactItems` e `filterContactItems` (`@/lib/contact-board`) e `AssistedSearch`.
  - Adicionados: `ContactBoard`, `emptyContactView`, `type ContactView`, `CandidateFiltersPanel`, além de `nav`, `navGroups`, `Choice` e `initials` (vindos de `./workspace-shared`).
- **Estado dos contatos**
  - Antes eram 3 `useState`: `contactQuery`, `contactStatus` e `contactPage`.
  - Agora é um único `const [contactView,setContactView]=useState<ContactView>(emptyContactView)`.
  - O estado **continua no `Workspace`**, de propósito: assim os filtros de Contatos se mantêm ao trocar de tela, como antes. O componente recebe `view` e `onView(partial)`.
  - Foram removidos de `Workspace` os cálculos `contactList`, `filteredContacts`, `contactPages` e `currentContactPage`, que agora ficam dentro de `ContactBoard`.
- **Renderização**
  - `{view==='contacts'&&renderContacts()}` virou `<ContactBoard ... onOpen={(c,tab)=>openCandidate(c,tab)} onApproach={item=>void registerApproach(item)} onImport={()=>setImportOpen(true)}/>`.
  - As duas ocorrências de `{renderFilters()}` (Detalhes da vaga e Banco de talentos) viraram `<CandidateFiltersPanel .../>`. Os handlers reproduzem exatamente o corpo anterior:
    - `onApplySearch` define `assisted`, limpa `search`, limpa `filters.experience` e volta para a página 1.
    - `onClearSearch` limpa `assisted` e volta para a página 1.
    - `onSearch` define `search` e volta para a página 1.
    - `onFilter` usa `changeFilter`.
  - As funções `renderContacts()` e `renderFilters()` foram apagadas.
- **Mantidos**: `renderCandidates()` e o `<Sheet>` do perfil do candidato. Esses são os próximos passos; veja abaixo.
- **Tamanho**: ≈74,4 KB → ≈65,0 KB.

Se você tiver uma versão de `workspace.tsx` aberta ou em memória de **antes** destas mudanças, não a grave por cima. Releia o arquivo do disco. As funções `renderContacts`/`renderFilters` não existem mais.

## Revisão da funcionalidade de prazos (somente leitura)

Foram lidos `lib/job-deadlines.ts`, `app/job-deadlines.tsx`, os testes unitários e de navegador, e o diff em `recruitment-overview.tsx`, `workspace.tsx`, `globals.css` e `package.json`. Os critérios 1–7 do documento de prazos aparecem cobertos por código e testes.

**Defeito reproduzido e corrigido**

- **Causa**: em `app/recruitment-overview.tsx`, `<JobDeadlines key={selectedScope}>` e `<FollowUpList key={selectedScope}>` eram irmãos no mesmo fragmento e tinham a **mesma `key`**.
- **Sintoma**: ao trocar o seletor "Acompanhamento da vaga", o React deixava um painel "Prazos de apresentação" antigo na tela. Ficavam 2 painéis, com contagens "0" e "1".
- **Evidência**: 6 falhas em `tests/browser/job-deadlines.spec.ts` (chromium e mobile): "strict mode violation… resolved to 2 elements" e "Expected: 8, Received: 9".
- **Correção**: `` key={`deadlines:${selectedScope}`} `` em `JobDeadlines`.
- **Resultado**: depois da correção, os 6 testes passam e nenhum outro foi afetado. Os testes falhavam antes e passam depois, então servem de regressão.

Observações:

1. O documento `2026-10-15-prazos-apresentacao.md` ainda diz "em execução local" e não tem a seção de resultados. Quem concluir a tarefa deve registrar os resultados.
2. Uma vaga **pausada** com data passada aparece como "Data ultrapassada" e recebe a etiqueta "Vaga pausada". Isso é coerente com o critério 4, mas fica para decisão de produto se a pausa deve ou não contar como atraso.
3. O script de lint agora cobre `lib/job-deadlines.ts` automaticamente. A entrada manual que existia para ele foi absorvida pela mudança do `lint`.

Observação fora do escopo, sem alteração: `openCandidate` verifica só `journeyDrafts` para avisar sobre alterações não salvas. Já `closeCandidate` e `beforeunload` também comparam `record` e `reportText`. Hoje isso não causa perda de dados, porque `openCandidate` não é chamado de dentro do `<Sheet>` (que é modal). Se um link "abrir outro perfil" for adicionado dentro do perfil, unifique essa verificação antes.

## Verificações

`npm run test:agent` foi executado em 15/10/2026, depois de todas as mudanças acima: **7/7 etapas aprovadas** (typecheck, lint, test, build, security:client, test:http, test:browser), com **56/56 testes de navegador** passando (chromium + mobile). O relatório fica em `outputs/test-agent/last-run.json`.

- A primeira execução falhou porque o Chromium do Playwright não estava instalado nesta máquina. Foi resolvido com `npx playwright install chromium`; era problema de ambiente, não de código.
- A segunda execução mostrou as 6 falhas de prazos descritas acima.
- O novo escopo do lint (`app lib hooks components proxy.ts`) passou sem nenhum aviso.
- Os testes de interface usam APIs simuladas e dados fictícios. Isso **não** valida Supabase, RLS ou Claude reais.

## Rodada 2 — lista de candidatos e diálogos (15/10/2026, à tarde)

Feita depois do push de `95fb82c`, a pedido do usuário ("podemos seguir"). Nenhum trabalho de outra LLM estava pendente no checkout quando a rodada começou (`git status` limpo).

| Arquivo | Tipo | O que mudou |
| --- | --- | --- |
| `app/candidate-list.tsx` | **novo** | `CandidateList`: barra (ordenar, duplicados, importar), ações em lote, botão "Comparar", cards e paginação do banco de talentos. É o corpo de `renderCandidates()` depois do painel de filtros. |
| `app/workspace-dialogs.tsx` | **novo** | `NewJobDialog` e `AddCandidatesDialog`. |
| `app/workspace.tsx` | editado | Usa os componentes acima. Detalhes abaixo. |
| `tests/browser/workspace-views.spec.ts` | **novo** | Regressão para Contatos (busca, limpar, registrar abordagem) e Banco de talentos (busca vazia, seleção em lote, lista de interesse). Antes não havia teste de navegador cobrindo essas telas. |

**Detalhes em `app/workspace.tsx`**

- **Lista de candidatos**
  - `renderCandidates()` continua existindo, mas agora devolve apenas `<CandidateFiltersPanel/>` seguido de `<CandidateList/>`. Ela é usada em 2 lugares: Detalhes da vaga e Banco de talentos.
  - A linha `pageCount/visiblePage/visibleCandidates` saiu do `Workspace` e passou para `CandidateList`, que recebe `page={candidatePage}` e `onPage={setCandidatePage}`.
  - A seleção em lote (`batchSelection`, `batchIds`, `selectBatch`, `toggleBatch`, `applyBatch`) e `analyze` **continuam no `Workspace`**; o componente só as recebe.
- **Diálogos**
  - Os estados `newTitle`, `candidateName`, `candidateCity` e `candidateText` saíram do `useState` gigante do `Workspace` e foram para dentro dos componentes de diálogo. Esses componentes ficam sempre montados, então o texto digitado continua sobrevivendo ao fechar o diálogo, como antes.
  - `createJob(title)` e `importText(name,city,text)` agora **recebem os valores e retornam `true`/`false`**. O diálogo limpa os campos quando recebe `true`. As validações, mensagens (toasts), o `setBusy` e as chamadas de API não mudaram.
- **Imports removidos**: `CandidateBatch`, `CandidateCreate`, `PdfImporter`, `Dialog*` e o ícone `ArrowUpRight`.
- **Tamanho**: ≈65,0 KB → ≈56,8 KB. Desde o início da divisão, o arquivo foi de ≈74,4 KB para ≈56,8 KB.

**Finais de linha**

- O `app/workspace.tsx` no disco estava com finais de linha **misturados** (CRLF e LF). Isso foi causado em parte pelos scripts de edição da rodada 1, que não tratavam CRLF.
- O arquivo foi normalizado para CRLF, igual aos demais arquivos do checkout (`core.autocrlf=true`). O índice do git continua em LF, então o diff não fica poluído.
- Ao editar por script, trate os dois finais de linha.

**Verificações da rodada 2**

- `npm run test:agent`: **7/7 etapas aprovadas**, 56/56 testes de navegador.
- Depois disso, `tests/browser/workspace-views.spec.ts` foi adicionado, com 4/4 passando (chromium + mobile). O total de testes de navegador passa a ser 60.

## Próximos passos sugeridos para dividir o `workspace.tsx`

Os itens "lista de candidatos" e "diálogos" foram concluídos na rodada 2. Restam, em ordem de risco crescente:

1. `<Sheet>` do perfil (≈13,7 KB) → `app/candidate-profile-sheet.tsx`. É a parte mais sensível, porque concentra a proteção de rascunhos (`journeyDrafts`, `profileSession`, `editorDirty`, `invitationDirty`). Mova a proteção junto e rode `tests/browser/profile-drafts.spec.ts`.
2. Funções `save*` (`saveRecord`, `saveInvitation`, `saveAppointment`…) → um hook `useWorkspaceActions`, para que o componente fique apenas com a composição das telas.
