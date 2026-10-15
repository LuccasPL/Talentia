# Implementação coordenada — prazos de apresentação

Data: 15/10/2026. Base: `0c558d0829b8a20184e15d692109ac5abde2dd6e`.
Situação: em execução local.

## Problema e objetivo

O prazo registrado no briefing aparece individualmente no Painel da vaga. O Acompanhamento reúne contatos, pareceres e entrevistas, mas não permite comparar os prazos de apresentação das oportunidades. A melhoria acrescenta essa visão sem exigir abrir cada vaga.

## Escopo e responsabilidades

- Produto/UX: critérios, rótulos e revisão independente do fluxo.
- Engenharia: `lib/job-deadlines.ts`, `app/job-deadlines.tsx`, `app/recruitment-overview.tsx`, estilos específicos.
- QA: `scripts/job-deadlines.test.mjs` e `tests/browser/job-deadlines.spec.ts`.
- Coordenação: callback para abrir o briefing em `app/workspace.tsx`, inclusão no lint e documentação.

## Critérios de aceite

1. Respeitar o filtro atual do Acompanhamento: vaga específica ou todas as vagas.
2. Mostrar data ultrapassada, hoje, próximas datas e prazo a confirmar usando o dia civil de Brasília.
3. Datas vazias ou inválidas não entram na ordenação cronológica; inválidas indicam necessidade de revisão.
4. Excluir vagas preenchidas/canceladas; identificar pausadas sem reativá-las nem modificar seu prazo.
5. Datas não comprovam apresentação pendente ou entrega atrasada. Histórico de apresentação não confirma cumprimento do acordo e não deve mudar a classificação automaticamente.
6. Abrir o briefing da vaga correta sem salvar, enviar mensagens ou mudar etapas.
7. Organizar até 100 vagas com ordenação estável, paginação e uso em computador/celular.

Nenhuma mudança de schema, API, serviço externo, limite de IA ou envio faz parte do escopo. Testes de interface usarão APIs simuladas; resultados e limitações serão registrados após execução.
