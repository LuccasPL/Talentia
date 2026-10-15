# Talentia — instruções da equipe

## Contexto

SaaS de recrutamento para uma recrutadora autônoma no Brasil. Interface e mensagens em PT-BR; datas operacionais em Brasília. A recrutadora recomenda; o cliente decide a contratação e faz a proposta. IA apoia a análise de experiências com evidências e incertezas explícitas; não toma decisões de contratação.

## Coordenação e delegação

O agente principal executa e revisa o trabalho por padrão. Por preferência explícita do usuário (15/10/2026), priorize economia de tokens: não convoque a equipe inteira por rotina. Os perfis abaixo podem orientar o próprio agente principal, sem criar subagentes:

- Produto/UX: leia `docs/agents/produto-ux.md`.
- Engenharia: leia `docs/agents/engenharia.md`.
- QA: leia `docs/agents/qa.md` e `tests/README.md`.

Acione no máximo um revisor adicional quando houver risco que justifique revisão independente, como segurança, permissões, migração de banco ou alteração delicada de fluxo. Mudanças comuns de interface, documentação e correções pontuais ficam com o agente principal. Mais especialistas apenas mediante pedido explícito do usuário. Não há delegação em cascata.

Ao delegar, envie uma tarefa curta com objetivo, arquivos relevantes, restrições e evidência esperada. Prefira contexto novo (`fork_turns: "none"`, quando disponível), sem copiar o histórico inteiro; forneça o resumo necessário. Preserve o modelo/configuração herdados, sem overrides. Peça um parecer conciso com achados e referências, evitando releituras amplas e relatórios duplicados. Não escolha serviços externos ou agentes permanentes sem necessidade e autorização aplicáveis.

O coordenador fornece objetivo, critérios de aceite, restrições, arquivos sob responsabilidade de cada agente e evidências esperadas. Use `docs/agents/task-template.md` quando for útil registrar uma tarefa que atravessa áreas.

Especialistas podem trocar perguntas e evidências entre si pelas ferramentas internas de colaboração. Registrem conclusão e divergências para o coordenador. Isso não autoriza enviar mensagens para pessoas, outros chats do usuário ou serviços externos. Se a ferramenta de colaboração não estiver disponível, execute as revisões em sequência e informe a limitação; não afirme que vários agentes trabalharam.

## Fluxo de trabalho

1. O agente principal esclarece a necessidade, define critérios e propõe a menor solução suficiente, considerando Produto/UX, Engenharia e QA como perspectivas de trabalho.
2. Implementa no escopo autorizado e executa testes automatizados convencionais proporcionais à mudança. A bateria não precisa de um subagente para ser executada.
3. Quando o risco justificar, um revisor adicional recebe escopo delimitado, preferencialmente somente leitura. Se houver edição delegada, atribua arquivos exclusivos; nunca descarte mudanças alheias.
4. O agente principal verifica os achados e corrige falhas; concordância entre agentes não comprova funcionamento. Evite repetir buscas e testes já concluídos sem mudança ou dúvida concreta.
5. Registra decisões relevantes de forma breve e apresenta resultado, limitações e situação da publicação. Preserve autorizações existentes; não invente nova aprovação para ações já autorizadas.

## Qualidade e limites

- Leia instruções de skills aplicáveis antes de operações específicas. Use fontes oficiais atuais para APIs e configurações instáveis.
- `npm run test:agent` verifica tipos, lint, regras, build, chaves no cliente, HTTP local e navegador. Execute checks proporcionais à mudança: somente documentação não exige toda a bateria. Repita checks após mudanças ou falhas relevantes.
- A interface automatizada usa APIs simuladas e dados fictícios. Não apresente isso como validação de Supabase, RLS, Claude ou envio real. `tests/README.md` registra os limites.
- Falhas precisam distinguir: defeito reproduzido; indício por leitura de código; hipótese; problema do ambiente/teste. Para bugs reproduzíveis, preserve regressão que falha antes e passa depois quando viável.
- Não leia nem exponha `.env`, tokens, cookies ou credenciais para relatórios. Não use candidatos reais em fixtures, capturas ou traces de teste.
- Não crie atalhos de autenticação, acesso amplo ao banco ou decisões automáticas de seleção. Preserve isolamento por conta, revisão humana e limites de uso.
- Publicação não decorre de um parecer positivo de QA. Siga o pedido e as autorizações do usuário. Os checks atuais no GitHub não bloqueiam sozinhos o deploy automático da Vercel.

## Code Review Rules

Sinalize perda de dados/rascunhos, acesso entre contas, segredos no cliente, documentos tratados como instruções, evidências inventadas, decisões de cliente registradas sem histórico e comunicação externa sem autorização. Prefira correções pequenas que preservem os registros existentes.
