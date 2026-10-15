# Implementação coordenada — proteção dos rascunhos

Data: 15/10/2026. Base: `e64c4195573f8491553f1e88d84ecd8f96e35086`.
Situação: implementação local verificada, sem commit ou publicação nesta etapa.

## Objetivo e divisão

O usuário autorizou seguir com a melhoria identificada pela revisão piloto: incluir Dados do candidato e Convite nos avisos contra descarte de trabalho não salvo. O escopo mantém salvamento manual, componentes atuais e contratos de API.

- Produto/UX: revisão somente de leitura dos critérios e do comportamento resultante.
- Engenharia: `app/candidate-editor.tsx`, `app/interview-invitation.tsx`, `app/workspace.tsx` e eventual utilitário de proteção.
- QA: `tests/browser/fixture.ts` e `tests/browser/profile-drafts.spec.ts`; reprodução antes da correção e verificação posterior.
- Coordenação: integração, revisão dos arquivos, documentação e bateria completa após os testes direcionados.

Os agentes compartilham o checkout e não editam os mesmos arquivos em paralelo. Nenhuma migração, envio a candidatos, alteração de produção, armazenamento local de dados pessoais ou uso de IA externa integra esta melhoria.

## Critérios de aceite

1. Dados editados ou apenas uma confirmação marcada devem participar dos avisos de saída.
2. Convite com apenas detalhes, mensagem gerada ou texto editado permanece pendente até salvar.
3. Cancelar fechamento mantém valores; confirmar descarte permite reabrir os dados salvos.
4. Trocar abas preserva rascunhos simultâneos; salvar uma seção não limpa a pendência de outra.
5. Falha ou conflito no salvamento conserva o rascunho e permite nova tentativa.
6. Respostas assíncronas de uma sessão anterior não reabrem ou substituem o perfil atual.
7. Aviso nativo de saída usa os mesmos estados, conforme o suporte do navegador. Sem promessa de recuperação após travamento.
8. Sem falso aviso em um perfil sem alterações ou após salvar tudo; a regressão da entrevista continua passando.

## Evidências

QA reproduziu três falhas antes das respectivas correções e verificou os mesmos cenários passando depois:

- `data draft: canceling close preserves an edited city`;
- `invitation draft: canceling Escape preserves details without a generated message`;
- `CV history shortcut also protects unsaved candidate data`.

A suíte `tests/browser/profile-drafts.spec.ts` passou em 26/26 execuções direcionadas: 13 cenários no Chromium de computador e em emulação de celular. Inclui confirmação isolada, troca de abas, descarte/reabertura, salvar uma seção mantendo a outra pendente, gravação com sucesso/falha/conflito, nova tentativa, resposta atrasada em nova sessão da mesma pessoa e cancelamento do evento de saída.

A fixture passou a usar `candidateEditSchema` e `updateCandidateData` para `PATCH /api/candidates`, com controle de versão, falha 503 e atraso controlado. Não responde sucesso genérico para edição. A API real não foi alterada.

Engenharia centralizou o fechamento para o painel e o atalho de históricos, manteve estados separados para Dados/Convite e protegeu callbacks de sessões antigas. As respostas dos salvamentos tocados não regridem a versão global; isso não constitui reconciliação completa de concorrência entre sessões.

Evidências de interface usam componentes reais com APIs simuladas e persistência em memória; não certificam escrita no Supabase, RLS ou serviços externos. O teste de `beforeunload` dispara um evento sintético e verifica seu cancelamento, sem comprovar a exibição do diálogo nativo em todos os navegadores.

Produto/UX aprovou a coerência do fluxo por revisão estática após a correção. Fechamento por botão, Escape e atalho foram exercitados; a saída por área externa utiliza o mesmo callback e foi conferida por leitura, sem cenário de clique externo dedicado. O descarte de um rascunho não cancela uma gravação já enviada: ela pode concluir no registro original, mas sua resposta não deve reabrir ou substituir o perfil em outra sessão.

## Verificação final da coordenação

`npm run test:agent` passou com tipos, lint, 200 testes de regras, build, auditoria de chaves no cliente (53 arquivos, nenhuma credencial privada encontrada), HTTP local e 48 execuções de navegador. A suíte de navegador combina os 22 cenários anteriores com as 26 novas execuções. O resumo local está em `outputs/test-agent/last-run.json`, ignorado pelo Git. Nenhuma alteração foi publicada e os testes não acessaram dados reais.
