# Revisão da Talentia — 12 de outubro de 2026

## Avaliação geral

A Talentia já funciona como um piloto de gestão do recrutamento para uma recrutadora autônoma: reúne base de candidatos, vagas, comparação documental, contatos, entrevistas, agenda e apresentação ao cliente. A próxima etapa recomendada é consolidar a confiabilidade desse fluxo antes de acrescentar integrações e automações.

O principal diferencial é transformar um briefing livre em critérios revisáveis e confrontá-los com trechos do currículo, mantendo a avaliação humana. Não há comprovação automática de personalidade, disponibilidade ou contratação.

Esta revisão abrangeu estrutura do repositório, componentes principais, rotas, módulos de domínio, autenticação, importação, políticas e funções SQL, testes e documentação. Também consultei os verificadores e o histórico de migrações do Supabase conectado e executei verificações HTTP limitadas em produção. Não foi um teste de invasão, uma auditoria jurídica nem um teste completo de todas as telas autenticadas em dispositivos reais. Não consultei o conteúdo pessoal dos candidatos nem fiz chamadas pagas ao Claude.

Nenhuma correção de comportamento, migração, envio ao GitHub ou publicação foi realizada nesta revisão. As três melhorias locais anteriores continuam separadas da versão publicada.

## O que existe hoje

| Área | Recursos implementados | Limite relevante |
| --- | --- | --- |
| Acesso | Login, confirmação por e-mail, recuperação de senha e sessões Supabase | Recuperação completa e isolamento entre duas contas não foram reexecutados nesta revisão |
| Vagas | Briefing livre, condições, cliente vinculado, critérios editáveis e comparação | Até 100 vagas; etapa de preparação não representa abertura/fechamento da vaga |
| Base | PDFs em lote, cadastro por texto, edição, confirmação de contatos/localização, original preservado | PDF de até 2 MiB; leitura depende de conta autorizada para IA |
| Busca | Texto, cidade/região, experiência, pendências, termos relacionados e buscas salvas | Busca textual no conteúdo carregado; sem índice semântico de toda a base no servidor |
| Triagem | Evidências por critério, perguntas a confirmar, lista de interesse e comparação de 2–3 perfis | Comparação Claude limitada a 100 perfis por solicitação; sem decisão automática |
| Contatos | Etapas, interesse, disponibilidade, notas, próximos contatos e ações em lote | Rascunhos de e-mail/WhatsApp são revisados e enviados manualmente |
| Atualização | Link individual sem cadastro, expiração, cancelamento e revisão da resposta | Autodeclaração não comprova propriedade do telefone/e-mail |
| Entrevistas | Roteiro editável, respostas, observações e registros anteriores preservados | Salvamento explícito; até 60 perguntas e 30 agendamentos por vínculo candidato/vaga |
| Agenda | Calendário semanal, conflitos, estados e exportação ICS | Sem sincronização bidirecional com Google Calendar; horários em Brasília |
| Cliente | Cadastro de clientes, parecer individual e apresentação privada com até 10 perfis | Compartilhamento por documento; sem portal externo de acompanhamento |
| Qualidade | Conferência de CVs, saúde da base, duplicados, união e restauração | Atualidade dos dados depende de confirmação, não da data de importação |
| Operação | Quotas por conta, painel de uso, exportação CSV e verificações em CI | Quota de chamadas não equivale a limite financeiro de tokens |

Ainda não há gestão de equipes/permissões por função, cobrança, sincronização de caixas de e-mail, envio automático de mensagens, processamento autônomo completo da fila ou procedimento de exclusão/retenção apresentado na interface. Nem todos esses recursos são necessários para o uso da madrinha nesta etapa.

### Melhorias locais ainda não publicadas

1. Diretório de vagas com busca, filtros, contadores e atalhos para retomar o trabalho.
2. Histórico consolidado do candidato com busca, filtros e paginação.
3. Modo de entrevista com uma pergunta por vez e progresso das perguntas atuais.

Os módulos têm testes aprovados e compilam. A navegação e a persistência dessas três melhorias ainda precisam de uma conferência autenticada no navegador antes da publicação.

## Achados prioritários

### 1. Alta: pareceres podem continuar liberados após mudança relevante da vaga

**Evidência:** `app/workspace.tsx:91` marca pareceres para revisão quando as condições mudam, mas não quando muda a descrição. `app/workspace.tsx:105` altera critérios e limpa análises sem marcar os pareceres relacionados. A impressão, em `app/reports/[jobId]/[candidateId]/page.tsx:19`, e a apresentação em `lib/client-presentation.ts` dependem de `reportNeedsReview`.

**Cenário:** salvar um parecer, alterar uma exigência do briefing ou um critério e salvar a vaga novamente. O texto antigo pode continuar disponível para apresentação, embora as evidências tenham sido invalidadas. Alterações de notas e disponibilidade em `saveRecord` também não sinalizam necessariamente um parecer anterior.

**Recomendação:** centralizar as regras de invalidação por mudança de briefing, critérios, experiências, entrevista e informações utilizadas no parecer. Registrar a versão ou assinatura das fontes revisadas no momento da aprovação do parecer. Validar a atualidade também no servidor, tanto na impressão quanto na apresentação. Testar especificamente a mudança posterior de cada fonte.

### 2. Alta: fechar o perfil pode descartar trabalho ainda não salvo

**Evidência:** `app/workspace.tsx:136` limpa `selected` e `record` ao fechar o painel, sem consultar rascunhos pendentes. Entrevista, convite e edição cadastral mantêm rascunhos em estado local; `app/interview-guide.tsx:12` identifica alterações, mas não as comunica ao fechamento. O parecer e as notas também dependem de salvamento explícito.

**Impacto:** um fechamento por botão, clique externo ou Escape pode eliminar respostas digitadas durante uma entrevista. Preservar componentes ao trocar abas ajuda dentro do painel, mas não preserva o trabalho após desmontá-lo ou recarregar a página.

**Recomendação:** registrar alterações pendentes por seção, bloquear a saída até salvar ou descartar explicitamente e oferecer recuperação de rascunho com tratamento adequado dos dados pessoais. Testar fechar, trocar candidato, navegar, atualizar e conflitos entre sessões. Evitar armazenamento indiscriminado de CVs e respostas em armazenamento permanente do navegador.

### 3. Alta operacional: histórico de migrações local e remoto não corresponde

**Evidência ao vivo:** o Supabase possui nove entradas no histórico consultado. A migração inicial local não aparece nele. Há versões diferentes para operações de mesmo nome, como `candidate_updates` (local `20261009140623`, remoto `20261009140712`) e `client_management` (local `20261011205600`, remoto `20261011205903`). O aviso sobre a criação inicial fora do histórico já está em `DEPLOYMENT.md`.

**Impacto:** executar uma aplicação automática das migrações locais pode tentar reaplicar objetos existentes e falhar. A correspondência de nomes não prova identidade integral do SQL aplicado.

**Recomendação:** conferir as definições atuais, reconciliar o histórico sem recriar ou apagar dados e comprovar a criação de um ambiente limpo a partir do repositório. Fazer isso antes de automatizar novas mudanças de banco. Esta revisão não alterou o histórico.

### 4. Média: a base inteira é carregada, inclusive textos e históricos arquivados

**Evidência:** `lib/server.ts:14` consulta todos os `payload` de candidatos em páginas de 500 e os agrega numa única resposta. Várias operações chamam `readData` antes e/ou depois de salvar. Vagas, análises e registros ficam em grandes arrays JSONB. `app/api/workspace/route.ts:8` limita o corpo de salvamento a 3 MiB.

**Impacto:** a paginação do banco evita truncamento em 1.000 linhas, mas não é paginação da resposta nem carregamento sob demanda. A interface mostra 24 candidatos por página depois de receber toda a base. Em 5 mil CVs, tempo de transferência, memória e salvamentos crescem com os textos e históricos. O teto de 3 MiB pode ser atingido antes dos limites numéricos de registros. Não houve medição com 5 mil PDFs reais nesta revisão; o teste existente de busca sobre 5 mil perfis valida a função de busca, não toda a operação em produção.

**Recomendação:** listar candidatos com projeção mínima e paginação no servidor; carregar CV e histórico ao abrir o perfil; separar vagas, evidências e vínculos em entidades consultáveis; salvar apenas a alteração necessária. Medir latência e tamanho das respostas com uma base sintética representativa antes dessa migração.

### 5. Média: uma comparação grande depende de uma única solicitação longa

**Evidência:** `app/api/ai/route.ts:13` processa grupos de cinco sequencialmente. A rota declara duração de 300 segundos; cada chamada em `lib/claude.ts` pode esperar até 90 segundos. Os resultados ficam em memória até o fim e são persistidos posteriormente pelo navegador.

**Impacto:** 100 candidatos representam até 20 chamadas. Sob respostas demoradas, uma solicitação pode ultrapassar seu orçamento total; uma falha tardia perde os resultados anteriores da solicitação, embora as chamadas já tenham consumido quota e possivelmente gerado custo. Não reproduzi timeout nem gerei cobrança nesta revisão.

**Recomendação:** comparação como trabalho persistente, resultados por lote, progresso, retomada e idempotência. Enquanto isso, reduzir o volume recomendado e informar o alcance efetivo da operação.

### 6. Média: rotacionar a chave da Anthropic invalida o acompanhamento de importações pendentes

**Evidência:** `lib/import-server.ts:10` usa `ANTHROPIC_API_KEY` como segredo HMAC da assinatura do lote. `syncImports` verifica novamente a assinatura com a chave atual. A fila depende de consultas iniciadas pelo painel (`app/use-pdf-imports.ts`); não há consumidor independente para recuperar resultados.

**Impacto:** após uma troca legítima da chave, lotes assinados com a anterior deixam de passar na validação e pedem suporte. Envios cujo resultado é incerto também ficam em `sending`, deliberadamente evitando cobrança duplicada, mas sem uma rotina automática de resolução.

**Recomendação:** separar o segredo de assinatura da credencial do provedor, prever versões de assinatura e rotação e criar um processo seguro de recuperação dos lotes. Adicionar monitoramento de importações paradas e um consumidor periódico independente de a usuária manter a aba aberta.

### 7. Baixa, no pacote local: ordenação por atualização não recebe datas novas

**Evidência:** `app/job-directory.tsx:14` oferece “Atualizadas recentemente”; `lib/job-directory.ts:16` ordena por `job.updated`. O modelo inicial em `lib/domain.ts:25` usa uma data vazia. A criação e as mudanças de vaga em `app/workspace.tsx:91` e `:94` não atualizam esse campo, e o salvamento SQL atualiza a data do espaço, não a de cada vaga dentro do JSON.

**Impacto:** vagas criadas por esse fluxo aparecem sem data, e a ordenação pode cair no desempate alfabético. Os testes validam a ordenação com datas fornecidas, não a geração dessas datas na interface.

**Recomendação:** atribuir e persistir a data de atualização da vaga na operação correspondente, preferencialmente no servidor. Corrigir antes de publicar o diretório.

## Segurança

Pontos positivos observados:

- Autenticação verificada no servidor e isolamento por proprietário nas políticas SQL.
- PDFs privados, conferência de vínculo e caminho, validação de tamanho no cliente, API e bucket conforme migrações.
- Credencial Anthropic em módulo de servidor; contas com IA paga dependem de autorização explícita por ID.
- Limites atômicos no banco; erro na consulta de quota interrompe a operação.
- Verificação de origem nas alterações, limites de corpo, validação de campos, cabeçalhos de proteção e CSP com nonce.
- Tokens de atualização guardados como hash, expiração, cancelamento e resposta única; o link não herda a sessão da recrutadora.
- Citações documentais precisam existir literalmente no texto para permanecer como evidência. Comportamentos e condições ficam para confirmação humana.
- CSV trata conteúdo que poderia virar fórmula. Respostas de erro não imprimem o conteúdo completo de CVs ou credenciais.

O Supabase retornou, nesta consulta, um alerta de proteção contra senhas vazadas desativada e um aviso informativo de RLS sem política na tabela privada de quotas. A segunda situação corresponde ao desenho intencional de acesso somente pela função privada; não se recomenda abrir uma política só para remover o aviso. O verificador de desempenho não retornou alertas — isso não mede a velocidade da aplicação.

Referências dos avisos: [proteção de senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) e [RLS sem política](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

A auditoria de dependências encontrou zero avisos em produção e cinco pacotes de desenvolvimento classificados como altos, relacionados à cadeia `braces` → `micromatch` → `fast-glob` → ferramentas ESLint do Next. Não são cinco falhas independentes no site. A sugestão automática da auditoria aponta para uma troca principal de versão; não foi aplicada. [Aviso do componente](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).

Pendências para ampliar o uso: validar MFA e recuperação, orçamento financeiro e alertas de IA, restauração de backups, retenção/exclusão de candidatos e arquivos e trilha de auditoria resistente a alterações. O histórico atual é útil operacionalmente, mas não é um registro imutável de auditoria. A filtragem de atributos pessoais em texto manual é limitada; não deve ser apresentada como anonimização integral. A quota do link público é por token válido, não uma proteção global contra tráfego direto à API do Supabase.

## Design, experiência e manutenção

A interface tem identidade visual consistente em tons claros e ameixa, agrupamento de navegação, filtros progressivos, atalhos no celular e calendário semanal. Datas e mensagens principais seguem PT-BR e Brasília. As tabelas de comparação e o calendário usam rolagem horizontal para preservar informação.

O maior ganho de experiência agora está na confiança do salvamento: indicar claramente o que está salvo, o que é rascunho e o que precisa de revisão. Também é útil distinguir vaga aberta/pausada/encerrada da sua etapa de preparação e explicar a recuperação de importações pendentes.

`app/workspace.tsx` concentra muitos fluxos, estados e persistências. A grande quantidade de código em linhas extensas e o crescimento de regras no CSS dificultam revisão e aumentam o risco de efeitos entre funcionalidades. Recomenda-se separar a persistência, o editor de vaga, o perfil e os fluxos por domínio, preservando os testes existentes. A configuração de lint enumera módulos manualmente; novos módulos podem ficar fora da verificação se a lista não for atualizada.

Antes de publicar o pacote local, conferir com teclado e em larguras de celular, tablet e desktop: fechamento com rascunhos, botões fixos com teclado virtual, foco dos diálogos, abas de perfil, paginação, calendário e estados vazios/erros. Esta revisão inspecionou as regras e a compilação, mas não substitui essa verificação visual.

## Verificações executadas nesta revisão

| Verificação | Resultado |
| --- | --- |
| Testes automatizados locais | 153 aprovados, zero falhas |
| ESLint | Aprovado |
| Compilação de produção e TypeScript | Aprovados |
| Busca de credenciais privadas no cliente compilado | 51 arquivos examinados; nenhum achado nos padrões e segredos comparados |
| Auditoria das dependências de produção | Zero vulnerabilidades informadas |
| Auditoria completa, incluindo desenvolvimento | Cinco pacotes afetados na cadeia descrita acima |
| Consistência do diff | Sem erros; avisos de conversão de final de linha no Windows |
| Verificadores Supabase | Um alerta de senha, um aviso informativo intencional, nenhum aviso de desempenho |
| Histórico remoto de migrações | Divergência de versões e ausência da migração inicial confirmadas |
| Verificação HTTP em produção | Login acessível; página principal exige sessão; dados/PDFs sem sessão retornam 401; solicitações de origem externa retornam 403 |

Os testes locais cobrem principalmente regras de domínio e segurança utilitária. O CI executa tipos, lint, testes, auditoria de produção, build e busca de segredos. Não executa automaticamente os testes SQL de isolamento nem uma suíte completa de navegador autenticado. O scanner de credenciais e os verificadores do Supabase não garantem ausência de todas as vulnerabilidades.

A falha recente da integração automática GitHub–Vercel permanece como pendência operacional conhecida da sessão; esta revisão não reconsultou nem corrigiu a integração. A checagem HTTP confirma o funcionamento público atual, não a publicação das melhorias locais.

## Ordem recomendada para o próximo pacote

1. Invalidar corretamente pareceres e proteger rascunhos ao sair.
2. Corrigir as datas das vagas e verificar no navegador as três melhorias locais.
3. Reconciliar migrações e comprovar recuperação de dados em ambiente separado.
4. Tornar comparações e recuperação de importações persistentes, observáveis e retomáveis.
5. Medir e reduzir o carregamento da base antes de importar milhares de currículos.
6. Consolidar testes de navegador, isolamento SQL e políticas de retenção antes de ampliar usuários.

Depois dessa consolidação, os próximos recursos podem ser escolhidos com base no uso real da recrutadora: encerramento de vagas, modelos reutilizáveis por cliente, métricas do funil ou integrações de comunicação. Acrescentar todos de uma vez aumentaria a superfície de manutenção sem medir o benefício diário.
