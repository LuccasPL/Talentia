# Registro de alterações — Claude (Claude Code), 15/10/2026: retenção automática de dados

Este registro serve para que outra LLM entenda **a rotina diária de retenção e a sinalização de perfis inativos**, sem acesso à conversa original. Continua `2026-10-15-claude-exclusao-candidato.md` (exclusão a pedido), que deixou os prazos automáticos como pendência. Base: `9b9db37`. Pedido do usuário: "Sugira valores e implemente". Os prazos abaixo foram **sugeridos pelo Claude** e adotados. Não são orientação jurídica.

## Princípio

Apagar automaticamente só o que **já cumpriu a finalidade** (cópias duplicadas, envios não revisados, links encerrados, importações com falha). **Perfis de candidatos nunca são apagados automaticamente**: depois de 24 meses sem atividade, são sinalizados para decisão humana. Isso segue a regra do AGENTS.md de não tomar decisões automáticas e preservar registros.

## Prazos (`private.apply_retention`)

| # | Dado | Condição |
| --- | --- | --- |
| 1 | `candidate_applications` pendentes | `reviewed_at is null` e `created_at` há mais de 60 dias. O PDF em `private.application_files` vai junto por cascade. |
| 2 | `candidate_applications` aceitas | `reviewed_at` há mais de 30 dias e importação fora de `sending`, `processing` ou `failed`. Assim, `syncImports` ainda encontra a resposta enquanto a importação puder terminar ou ser repetida. |
| 3 | `candidate_applications` descartadas (já sem dados pessoais) | `reviewed_at` há mais de 12 meses |
| 4 | `candidate_refresh_links.response` | `reviewed_at` há mais de 30 dias: vira `null` (o tipo `RefreshLink.response` já aceita null e a UI já trata) |
| 5 | `candidate_refresh_links` | Sem resposta e encerrado (o menor entre revogação e expiração) há mais de 90 dias, **ou** revisado há mais de 12 meses |
| 6 | `application_links` | Encerrado há mais de 90 dias e **sem** nenhuma candidatura ligada. A FK com cascade apagaria candidaturas que ainda estão dentro do prazo delas. |
| 7 | `pdf_imports` com `status='failed'` | `created_at` há mais de 30 dias. O PDF entra em `pending_file_deletions`, a não ser que algum perfil use o mesmo `file_key`. |
| 8 | Limpeza interna | `private.public_attempts` com mais de 2 dias; `private.retention_runs` com mais de 24 meses |

Importações em `sending` (envio ambíguo, que exige suporte) **não** são tocadas.

## Arquivos

| Arquivo | Tipo | O que mudou |
| --- | --- | --- |
| `supabase/migrations/20261015161745_data_retention.sql` | **novo**, **aplicada em produção** | `create extension pg_cron with schema pg_catalog`; `private.retention_runs` (só contagens, sem grants); `private.apply_retention()` (definer, sem execute para nenhuma role da API); `cron.schedule('talentia-retention','15 3 * * *', …)`. O job foi conferido em `cron.job` como ativo. |
| `lib/file-cleanup.ts` | **novo** | `sweepFiles(owner)`, que antes ficava dentro da rota de exclusão: remove do bucket os arquivos da fila usando a sessão da dona. |
| `app/api/candidates/erase/route.ts` | editado | Passa a importar `sweepFiles` de `lib/file-cleanup`; o comportamento é o mesmo. |
| `app/api/workspace/route.ts` | editado | `GET` executa `sweepFiles` antes de `readData`, dentro de try/catch. Assim, os PDFs enfileirados pela retenção, que não pode apagar o Storage pelo SQL, saem no próximo acesso da dona. Falhas não bloqueiam o carregamento. |
| `lib/base-health.ts` | editado | `INACTIVE_DAYS=730` e `lastActivity()`, que considera `updated`, `editedAt`, autodeclaração, confirmações, `changeLog` e `lastContactAt`/eventos em **todas** as vagas, ignorando datas futuras ou inválidas. `HealthRow` ganhou `lastActivity` e `inactive`; o filtro novo é `inactive` ("Sem atividade há 24 meses"). `needsReview` não mudou. |
| `app/base-health.tsx` | editado | Novo botão de resumo `inactive` e aviso no cartão orientando a confirmar o interesse ou excluir os dados. |
| `app/globals.css` | editado | `.health-retention`; o 7º botão do resumo ocupa a linha inteira. |
| `README.md` | editado | Seção "Retenção automática" com a tabela de prazos. A seção de exclusão passa a apontar para ela. |

## Verificação

- **Simulação antes de aplicar**, em produção e só com contagens: nenhum item seria apagado hoje, porque a base mais antiga é de 09/10/2026.
- `supabase/tests/data-retention.sql` (**novo**), com conta fictícia e rollback, **executado em produção**. Para cada regra, cria um item logo além do prazo e outro logo dentro dele, roda `apply_retention` e confere que:
  - só o item vencido foi removido;
  - o perfil permaneceu;
  - a fila recebeu apenas o PDF da importação antiga;
  - a execução foi registrada com as contagens;
  - `authenticated` não executa a rotina nem lê o log.

  Depois, a consulta confirmou que não sobraram execuções, contas ou fila.
- `scripts/data-retention.test.mjs` (**novo**, 3 testes): limite de 730 dias inclusivo; qualquer sinal recente, inclusive em outra vaga, conta como atividade; datas inválidas ou futuras não contam. `scripts/base-health.test.mjs` continua passando; foi necessário tolerar `events` ausente em registros antigos de teste.
- `npm run test:agent`: 7/7 etapas aprovadas (223 testes de regra, 74 de navegador).
- Advisors: nenhum alerta novo além do INFO intencional de RLS sem política em `private.retention_runs`.

## Pendências

- Não foi feita conferência visual da tela "Saúde da base" com um perfil inativo real. A base atual não tem nenhum, e o teste de navegador não cobre esse filtro.
- A primeira execução real acontece em 16/10/2026 às 03:15 UTC. Para conferir: `select * from private.retention_runs order by ran_at desc` e `select * from cron.job_run_details where jobid=(select jobid from cron.job where jobname='talentia-retention') order by start_time desc`.
- Ainda falta um comprovante de exclusão a pedido, sem dados pessoais (ver o registro de exclusão).
