# Equipe de implementação da Talentia

Três frentes trabalham sob coordenação do agente principal:

| Frente | Entrega principal | Revisão com outras frentes |
| --- | --- | --- |
| [Produto/UX](produto-ux.md) | Necessidade, fluxo e critérios de aceite | Consulta Engenharia sobre viabilidade e QA sobre observabilidade |
| [Engenharia](engenharia.md) | Solução e implementação front/back com evidências | Questiona ambiguidades de Produto e entrega cenários/limites a QA |
| [QA](qa.md) | Verificação independente e achados reproduzíveis | Valida critérios, confronta implementação e devolve falhas a Engenharia |

O coordenador escolhe as frentes necessárias, delimita arquivos e integra o resultado. Mudanças de interface e dados podem dividir Engenharia em responsáveis por front-end e back-end quando houver tarefas independentes. Esse desdobramento não é obrigatório em toda melhoria.

## Como funciona

O `AGENTS.md` na raiz orienta as próximas sessões iniciadas no repositório a carregar os perfis e delegar conforme o escopo. A descoberta desse arquivo segue o mecanismo de instruções por projeto documentado pela [OpenAI](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

Os perfis são instruções reutilizáveis, não contas, permissões ou processos em segundo plano. Nesta sessão, três subagentes reais foram acionados, receberam escopos separados e trocaram análises. Em novas sessões, a coordenação precisa iniciar as frentes novamente quando o trabalho justificar e as ferramentas permitirem. Nenhum serviço de agentes foi adicionado à Talentia nem à API do Claude.

Use [o modelo de tarefa](task-template.md) para entregas maiores. Registre decisões importantes e evidências, evitando transcrever conversas inteiras. Mensagens internas trocam achados; os arquivos guardam o resultado que deve sobreviver à sessão.

## Primeira colaboração

A revisão piloto examinou as proteções de rascunhos em Dados e Convite. A consolidação fica em [revisão de rascunhos](reviews/2026-10-15-rascunhos.md). A revisão inicial foi somente de leitura. A tarefa seguinte implementou a proteção e registrou testes antes/depois em [implementação coordenada](reviews/2026-10-15-protecao-rascunhos.md).

## O que não está configurado

Não há execução contínua, agendamento, orçamento adicional de API ou publicação autônoma. O executor `npm run test:agent` continua sendo a bateria determinística de qualidade; o agente de QA usa seus resultados junto com revisão exploratória quando necessário.
