# Talentia — instruções da equipe

## Contexto

SaaS de recrutamento para uma recrutadora autônoma no Brasil. Interface e mensagens em PT-BR; datas operacionais em Brasília. A recrutadora recomenda; o cliente decide a contratação e faz a proposta. IA apoia a análise de experiências com evidências e incertezas explícitas; não toma decisões de contratação.

## Coordenação e delegação

O agente principal coordena o trabalho e responde ao usuário. Para melhorias com impacto de fluxo, várias áreas ou risco de regressão, delegue a especialistas quando a ferramenta de subagentes estiver disponível:

- Produto/UX: leia `docs/agents/produto-ux.md`.
- Engenharia: leia `docs/agents/engenharia.md`.
- QA: leia `docs/agents/qa.md` e `tests/README.md`.

Para ajustes simples, envolva apenas as especialidades necessárias. Evite delegação em cascata: especialistas não criam outros agentes, salvo solicitação do coordenador dentro da autorização do usuário. Preserve o modelo/configuração herdados; não escolha modelos, serviços externos ou agentes permanentes sem necessidade e autorização aplicáveis.

O coordenador fornece objetivo, critérios de aceite, restrições, arquivos sob responsabilidade de cada agente e evidências esperadas. Use `docs/agents/task-template.md` quando for útil registrar uma tarefa que atravessa áreas.

Especialistas podem trocar perguntas e evidências entre si pelas ferramentas internas de colaboração. Registrem conclusão e divergências para o coordenador. Isso não autoriza enviar mensagens para pessoas, outros chats do usuário ou serviços externos. Se a ferramenta de colaboração não estiver disponível, execute as revisões em sequência e informe a limitação; não afirme que vários agentes trabalharam.

## Fluxo de trabalho

1. Produto/UX explicita a dor da recrutadora, fluxo esperado e critérios verificáveis.
2. Engenharia propõe a menor solução suficiente e sinaliza contratos, dados e riscos.
3. O coordenador distribui arquivos para impedir edições concorrentes no mesmo arquivo. Agentes compartilham o mesmo checkout; nunca descartem mudanças alheias.
4. Engenharia implementa no escopo autorizado. QA verifica critérios e evidências de forma independente; concordância entre agentes não comprova funcionamento.
5. O coordenador integra, inspeciona alterações, resolve divergências com código/evidência e apresenta resultado, limitações e situação da publicação. Preserve autorizações existentes; não invente nova aprovação para ações já autorizadas.

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
