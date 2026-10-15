# Registro de alterações — Claude (Claude Code), 15/10/2026: exclusão definitiva de candidato (LGPD)

Este registro serve para que outra LLM entenda **o que o Claude implementou para atender pedidos de exclusão de dados**, sem acesso à conversa original. Motivação: item 2, "Retenção e exclusão", de `2026-10-15-seguranca-e-criptografia.md`. Base: `b278705`. Pedido do usuário: "Retenção e exclusão", a próxima frente da revisão.

## Escopo entregue

**Exclusão definitiva a pedido da pessoa**, na aba Dados do perfil. Ainda **não** há prazo de retenção automático: isso depende de uma decisão do usuário sobre o prazo e não foi implementado (veja "Pendências").

## Inventário: onde ficam os dados de uma pessoa

| Local | Como é apagado |
| --- | --- |
| `public.candidates` (perfil + perfis com `mergedInto` = ele, inclusive o "CV" anexado via `cvSourceId`) | Removidos pela RPC |
| `workspaces.records` (contato, notas, entrevista, convite, parecer, histórico do cliente, triagem…) | O servidor envia `new_records` sem a pessoa; a RPC recusa se ainda houver algum |
| `workspaces.jobs[].analyses` (evidências citadas do CV) | Mesma regra, com `new_jobs` |
| `mergeHistory` de **outros** perfis (snapshot da pessoa, caso de perfil restaurado depois de unido) | O servidor envia `rewritten`; a RPC só aceita mudança na chave `mergeHistory` e recusa se sobrar algum snapshot |
| `public.pdf_imports` (nome do arquivo, chave, lote) | Removidos pela RPC (por `candidate_id` ou `file_key`) |
| `public.candidate_applications` aceitas (resposta declarada) | Removidas pela RPC (via `import_id`) |
| `public.candidate_refresh_links` | Apagados em cascata pela FK de `candidates` |
| Bucket `curriculos` (PDFs) | A RPC enfileira em `public.pending_file_deletions`; o servidor apaga no Storage e tira da fila |
| Resultados guardados pela Anthropic (Message Batches, até 29 dias) | O servidor chama `DELETE /v1/messages/batches/{id}`, em melhor esforço |

**Fora do alcance**, como avisa a tela:
- cópias que já saíram do sistema (pareceres impressos, mensagens, exportações);
- candidaturas ainda **pendentes** na fila (não há ligação confiável com o perfil; a recrutadora pode descartá-las);
- backups do provedor.

## Arquivos

| Arquivo | Tipo | O que faz |
| --- | --- | --- |
| `lib/candidate-erasure.ts` | **novo** | Funções puras:<br>• `erasureGroup`: o perfil principal e quem tem `mergedInto` nele; recusa perfil arquivado e perfil de exemplo;<br>• `planErasure`: devolve `ids`, `jobs` e `records` sem a pessoa, `rewritten` e `fileKeys`;<br>• `confirmsName`: confere o nome completo, ignorando acentos, caixa e espaços. |
| `supabase/migrations/20261015155958_candidate_erasure.sql` | **novo**, **aplicada em produção** | Tabela `public.pending_file_deletions` (RLS dono; authenticated só com SELECT e DELETE). RPC `private.erase_candidate`, security definer, com o wrapper invoker `public.erase_candidate(expected_version, candidate_ids uuid[], new_jobs, new_records, rewritten)`. Verifica versão, dono, grupo completo, workspace já sem a pessoa e reescritas permitidas; apaga tudo na mesma transação; devolve `{fileKeys, batchIds}`. Versão desatualizada ou ids de outra conta resultam em `null`. Sem acesso anon. |
| `app/api/candidates/erase/route.ts` | **novo** | `POST {candidateId, version, confirmName}` confere a versão e o nome, monta o plano, chama a RPC, depois `sweepFiles` (remove do Storage e desenfileira) e `deleteProviderBatches`, e devolve `{data, warnings}`. `PATCH` tenta de novo os arquivos pendentes. |
| `lib/import-server.ts` | editado | Nova função `deleteProviderBatches(ids)`, que chama `DELETE` na API de batches e conta as falhas. |
| `app/candidate-erase.tsx` | **novo** | Painel recolhido "Excluir dados desta pessoa": explica o que é apagado e o que não é, exige digitar o nome completo e mostra o botão "Excluir definitivamente". Não aparece para perfis de exemplo. |
| `app/workspace.tsx` | editado | Import e `<CandidateErase>` no fim da aba Dados. `onErased` limpa os rascunhos (`resetProfileDrafts`), fecha o perfil, atualiza os dados e mostra toasts de sucesso e de avisos. |
| `app/globals.css` | editado | Bloco `/* Permanent erasure (profile Data tab) */`. |
| `tests/browser/fixture.ts` | editado | Simula `POST /api/candidates/erase` usando `planErasure` e `confirmsName`. |

## Testes

- `scripts/candidate-erasure.test.mjs` (**novo**, 3 testes): grupo, plano (registros, análises, arquivos, snapshots, sem mutar a entrada) e confirmação do nome.
- `tests/browser/candidate-erasure.spec.ts` (**novo**, desktop e mobile): o botão só habilita com o nome completo; a exclusão fecha o perfil, tira a pessoa do banco de talentos e apaga os registros; o painel recolhido não altera nada.
- `supabase/tests/candidate-erasure.sql` (**novo**): roda com contas fictícias em `auth.users` e rollback, **executado em produção**. Cobre:
  - outra conta não apaga;
  - versão desatualizada;
  - grupo incompleto;
  - registro que sobrou;
  - snapshot que sobrou;
  - reescrita indevida;
  - chamadas recusadas não alteram nada;
  - a exclusão válida remove perfil, CV, importação, candidatura, link de atualização, análise e registro, preserva as outras pessoas, enfileira os 2 arquivos e incrementa a versão;
  - anon sem acesso.

  Depois, a consulta confirmou que não sobrou nenhuma conta, fila ou importação de teste.
- `supabase/tests/table-privileges.sql` (da outra LLM) reexecutado: passou com a nova tabela.
- `npm run test:agent`: 7/7 etapas aprovadas (220 testes de regra, 74 de navegador).

## Pendências

1. **Prazo de retenção automático:** por exemplo, apagar candidaturas pendentes não revisadas depois de X dias, ou avisar sobre perfis sem atualização há Y meses. Depende da decisão do usuário sobre os prazos.
2. Comprovante de exclusão sem dados pessoais (data e quantidade de itens), caso a recrutadora precise demonstrar o atendimento.
3. Não houve teste em produção com uma conta logada: a exclusão real de um PDF no Storage e a chamada `DELETE` à Anthropic foram verificadas só por leitura de código e pelo teste SQL da fila. Uma falha no Storage deixa o arquivo na fila e mostra um aviso; o `PATCH` permite tentar de novo.
