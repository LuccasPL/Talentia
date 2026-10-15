# Revisão de segurança e proposta de criptografia — 15/10/2026

## Pedido e escopo

Retomar o projeto após alterações de outra LLM, ler seus registros e avaliar proteção dos dados pessoais e criptografia adicional. Base revisada: `36f61cd`; checkout inicialmente limpo. Coordenador revisou código e metadados do Supabase; agente de Engenharia fez revisão estática independente da entrada de candidaturas. Nenhum dado de candidato, segredo ou PDF real foi consultado. Nenhuma alteração no banco, deploy ou commit nesta rodada.

Registros anteriores lidos: `2026-10-15-claude-divisao-workspace.md` e `2026-10-15-claude-candidaturas-por-link.md`. Desde `0c558d0`, os commits adicionaram prazos de apresentação, extração de componentes do Workspace, links públicos de candidatura com fila de revisão, prévia de PDF, contador de pendências e identidade visual da página pública. O diff abrange 36 arquivos. Esta revisão se concentra em armazenamento, acesso e novos pontos de entrada; não é uma auditoria exaustiva de todas as telas.

## Evidências atuais

- Consulta somente de catálogo confirmou RLS ativo nas oito tabelas de aplicação dos esquemas `public`, `private` e `talentia_private`.
- Políticas consultadas restringem candidatos, espaço, importações e candidaturas ao proprietário; objetos do bucket são restritos à pasta do usuário autenticado.
- Bucket `curriculos`: privado, limite de 2.097.152 bytes.
- Advisors: proteção contra senhas vazadas desativada; duas informações de RLS sem políticas em tabelas privadas (`application_files` e `api_limits`). Estas últimas são intencionais: acesso direto negado, operações por funções restritas.
- Código das candidaturas guarda hash do token, usa fragmento na URL e confere proprietário para recuperar PDFs. Entrada pública não herda sessão da recrutadora.
- 13 testes locais aprovados: `candidate-applications.test.mjs`, `http-security.test.mjs`, `client-secrets.test.mjs`. O último testa o detector com fixtures, não é uma varredura nova do build.
- Não repetimos nesta rodada testes transacionais entre contas, fluxo autenticado real, testes de carga, restauração ou toda a bateria de navegador. Evidências anteriores não substituem essas validações.

## Achados e prioridades

### 1. Reduzir privilégios de `pdf_imports`

Metadados em produção confirmaram `authenticated` com `TRUNCATE`, `TRIGGER` e `REFERENCES`, além de SELECT/INSERT/UPDATE/DELETE necessários. `has_table_privilege('authenticated','public.pdf_imports','TRUNCATE')` retornou true; para anon, SELECT e TRUNCATE retornaram false.

A migração original de importações revoga permissões de PUBLIC/anon e concede as quatro operações necessárias, mas não remove privilégios previamente concedidos a authenticated. A origem exata dos grants extras não foi atribuída à outra LLM. TRUNCATE não é limitado por RLS. Não foi executado TRUNCATE nem demonstrado um caminho de exploração pela API REST; o achado é privilégio SQL excessivo, não evidência de acesso anônimo ou vazamento.

Correção proposta: migração que revogue TRUNCATE/TRIGGER/REFERENCES de authenticated, verifique preservação das quatro operações necessárias e adicione teste de catálogo contra reincidência em novas tabelas. Ainda não aplicada.

### 2. Retenção e exclusão de candidaturas

`private.review_application` apaga o PDF privado ao descartar, mas conserva `candidate_applications.response` com nome, contato, cidade e mensagem. GET lista somente pendentes, ocultando esses dados da interface após revisão. Não foi encontrada rotina de expurgo nem fluxo completo de exclusão das cópias relacionadas.

Definir prazo/finalidade de retenção e implementar exclusão verificável de candidato, candidatura, PDF, históricos e snapshots pertinentes. Aceitas ainda precisam da resposta declarada até a conclusão da importação; apagar antes disso perderia os contatos digitados. Backups e dados enviados a provedores precisam de tratamento próprio. Não apagar registros existentes silenciosamente.

### 3. Abuso da candidatura pública

`private.submit_application` incrementa a cota apenas para novas submissões. Repetições do mesmo PDF retornam antes do incremento, após decodificação/hash. A rota também lê/codifica até 2 MB antes de chamar a RPC. A RPC é acessível diretamente por anon: limites da Vercel não cobrem esse caminho. Indício estático de consumo repetido de recursos; não houve teste de carga.

O teto de 100 pendentes por conta também pode ser ultrapassado por concorrência: a função trava o link, mas conta pendentes do dono; links distintos podem inserir simultaneamente. Corrigir serialização por proprietário e proteção de tentativas considerando a chamada direta à RPC.

## O que significa criptografar neste projeto

Segundo a documentação oficial, Supabase já cifra dados em repouso com AES-256 e em trânsito com TLS. Isso protege infraestrutura/transporte; não impede que uma consulta autorizada devolva texto legível. O esquema da Talentia atualmente mantém campos pessoais e JSON legíveis para seus leitores autorizados, sem cifra adicional da aplicação.

Cifra adicional com chave fora do banco pode proteger uma cópia isolada do banco/backups contra leitura. Não impede leitura por sessão roubada que acesse a aplicação autorizada, servidor comprometido com acesso às chaves, administrador autorizado ou exportação já descriptografada. Não existe garantia de vazamento impossível.

Não implementar apenas um helper AES sobre `payload`: existem cópias em `candidates.name/city/role`, JSON do candidato, registros e análises de `workspaces`, respostas de atualização, candidaturas, nomes de arquivos e PDFs. A entrada anon direta em `submit_application` também precisaria mudar para impedir gravação fora do caminho de cifra.

### Desenho recomendado para uma implementação separada

1. Inventariar todas as cópias de dados pessoais, finalidades, retenção e fluxos de leitura/escrita; decidir os metadados que permanecerão consultáveis.
2. Cifrar no servidor com cifra autenticada (ex.: AES-256-GCM), nonce aleatório exclusivo por operação, identificador de versão/chave e associação ao proprietário, registro e tipo de dado para impedir troca de ciphertext entre contas. Preferir biblioteca/API consolidada; nunca algoritmo próprio.
3. Guardar chave mestra fora do banco, Git, browser e logs; avaliar gerenciador de chaves e custos. Usar chaves de dados protegidas pela mestra, política de rotação e recuperação. Não reutilizar a chave da Anthropic ou credenciais Supabase.
4. Redesenhar RPCs que manipulam JSON e ingresso público; preservar autorização por dono e evitar conceder acesso administrativo amplo para contornar incompatibilidades.
5. Incluir PDFs e seus caminhos de importação/download. A IA precisa receber conteúdo legível para processar, sujeito ao escopo e política de retenção do provedor; não chamar esse desenho de ponta a ponta.
6. Migrar por lotes com versão e retomada, validar leitura antes da troca e planejar remoção posterior das cópias claras e expiração dos backups antigos. Recuperação de chaves deve ser testada antes de converter dados reais.
7. Testar isolamento, integridade do ciphertext, chave ausente/incorreta, rotação, restore, busca/filtros, duplicados, PDF, atualização pública, candidatura e importação. Falha deve bloquear, sem fallback silencioso para gravar texto claro.

Sequência sugerida: privilégios mínimos → retenção/exclusão e proteção da entrada pública → MFA/recuperação → cifra adicional com migração e gestão de chaves. Nenhuma chave foi criada ou pedida ao usuário nesta análise.

## Fontes consultadas

- https://supabase.com/security — criptografia em repouso/transporte e responsabilidade compartilhada.
- https://supabase.com/docs/guides/security/product-security — controles por produto.
- https://www.postgresql.org/docs/current/ddl-rowsecurity.html — TRUNCATE/REFERENCES não submetidos a RLS.
- https://supabase.com/changelog — consultado após falha de leitura do índice Markdown; aviso recente remove suites TLS 1.2 antigas, não exige alteração identificada nesta revisão para o cliente Node/browser atual.

## Situação final

Revisão registrada localmente. Achados e proposta aguardam implementação; não há nova criptografia da aplicação ativa, migração aplicada ou publicação nesta rodada. O resultado não comprova ausência de vulnerabilidades nem conformidade legal integral.
