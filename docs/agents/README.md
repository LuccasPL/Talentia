# Equipe de implementação da Talentia

Três perfis orientam o trabalho do agente principal. Eles não exigem três agentes em execução:

| Frente | Entrega principal | Revisão com outras frentes |
| --- | --- | --- |
| [Produto/UX](produto-ux.md) | Necessidade, fluxo e critérios de aceite | Consulta Engenharia sobre viabilidade e QA sobre observabilidade |
| [Engenharia](engenharia.md) | Solução e implementação front/back com evidências | Questiona ambiguidades de Produto e entrega cenários/limites a QA |
| [QA](qa.md) | Verificação independente e achados reproduzíveis | Valida critérios, confronta implementação e devolve falhas a Engenharia |

## Modo econômico — preferência de 15/10/2026

- Um agente principal realiza implementações comuns e executa os testes.
- No máximo um revisor adicional para segurança, banco ou mudanças delicadas cujo risco justifique revisão independente. Mais especialistas somente por pedido explícito do usuário.
- Delegações recebem contexto novo, resumo curto e arquivos específicos, sem herdar toda a conversa; modelo herdado, sem override.
- Pareceres concisos, sem releitura integral do projeto ou repetição de testes sem motivo concreto.
- Perfis continuam disponíveis como perspectivas para o próprio agente principal. Testes convencionais não exigem agente de IA dedicado.

Esta preferência substitui a convocação habitual das três frentes. Não altera o funcionamento da Talentia ou sua integração com Claude, nem configura um teto técnico de tokens.

## Como funciona

O `AGENTS.md` na raiz registra o modo econômico e os critérios de delegação. A descoberta desse arquivo segue o mecanismo de instruções por projeto documentado pela [OpenAI](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

Os perfis são instruções reutilizáveis, não contas, permissões ou processos em segundo plano. Na colaboração piloto, três subagentes reais foram acionados, receberam escopos separados e trocaram análises. Esse histórico não determina o número de agentes das próximas tarefas: vale o modo econômico acima. Nenhum serviço de agentes foi adicionado à Talentia nem à API do Claude.

Use [o modelo de tarefa](task-template.md) para entregas maiores. Registre decisões importantes e evidências, evitando transcrever conversas inteiras. Mensagens internas trocam achados; os arquivos guardam o resultado que deve sobreviver à sessão.

## Primeira colaboração

A revisão piloto examinou as proteções de rascunhos em Dados e Convite. A consolidação fica em [revisão de rascunhos](reviews/2026-10-15-rascunhos.md). A revisão inicial foi somente de leitura. A tarefa seguinte implementou a proteção e registrou testes antes/depois em [implementação coordenada](reviews/2026-10-15-protecao-rascunhos.md).

## O que não está configurado

Não há execução contínua, agendamento, orçamento adicional de API ou publicação autônoma. O executor `npm run test:agent` continua sendo a bateria determinística de qualidade; o agente de QA usa seus resultados junto com revisão exploratória quando necessário.
