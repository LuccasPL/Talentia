# Memória de continuidade — Talentia

Atualizado em 18/10/2026. Este arquivo orienta uma nova conversa; antes de agir, confirme o estado atual do código, do Git e da publicação. Documentos mais antigos no repositório registram o estado da respectiva data e podem estar desatualizados.

## Objetivo e pessoas

Talentia é um SaaS de recrutamento para uma recrutadora autônoma no Brasil. Ela recebe uma vaga, define livremente os critérios do cliente, procura perfis numa base grande, confirma informações e disponibilidade (com frequência por WhatsApp), entrevista, compara evidências e recomenda candidatos com um parecer fundamentado. O cliente decide a contratação e faz a proposta. A IA atua como assistente; não decide quem contratar e deve distinguir evidência, inferência e informação ainda não confirmada. Interface, mensagens e linguagem em PT-BR; datas operacionais em Brasília.

O problema inicial surgiu de uma busca entre cerca de 5.000 currículos para uma vaga de loja conceito na Paulista. A vaga é apenas um exemplo: critérios e pesos variam a cada oportunidade. A candidata não deve ser obrigada a criar mais uma conta para atualizar dados ou demonstrar interesse.

## Onde está o projeto

- Pasta local: `C:\Users\lucca\Documents\SaaS Recrutamento\talentia`.
- GitHub: https://github.com/LuccasPL/Talentia (`origin/main`). Neste computador o repositório já está clonado; não é necessário cloná-lo de novo.
- Produção: https://talentia-two.vercel.app, publicada pela Vercel a partir da `main`.
- Stack: Next.js 16, React 19, TypeScript, Supabase Auth/Postgres/Storage, Claude via API Anthropic, Vercel e Resend/SMTP para e-mails de autenticação.
- O projeto de Supabase é exclusivo da Talentia. Não usar o banco do inbox-faturas.
- Nunca registrar neste arquivo, em commits ou em mensagens chaves, senhas, `.env.local`, dados pessoais de candidatos ou currículos reais.

## Funcionalidade já construída

- Login e isolamento de dados por conta; acesso à IA controlado por conta.
- Clientes, vagas, briefing e critérios livres por vaga; acompanhamento do processo e decisão do cliente.
- Banco de talentos com cadastro manual, anexação posterior de CV, importação de PDFs em lote (limite de 2 MiB por PDF), conferência da extração e tratamento de erros.
- Busca, filtros, buscas salvas, busca assistida por experiências relacionadas, comparação com vaga e comparação lado a lado.
- Contato e confirmação dos dados, rascunhos de e-mail/WhatsApp, links de atualização e de candidatura sem cadastro obrigatório.
- Roteiro de entrevista, respostas e avaliações, agenda e calendário semanal.
- Funil da vaga, apresentação e parecer para cliente, exportação, histórico, retenção e exclusão de dados.
- Proteções de autenticação, RLS, limites de uso, checagens de segurança e testes automatizados. Conferir detalhes em `README.md`, `SECURITY-REVIEW.md` e `tests/README.md`.

## Estado e último trabalho

Em 18/10/2026, os commits `fe5b4be` (busca paginada), `7d8a8c9` (retorno à busca após login) e `f383b62` (paginação dos filtros de candidatos por vaga) estão no histórico local. Confirmar sincronização/publicação antes de afirmar que chegaram à produção. A rota `/buscar` consulta no Supabase nome, cidade e experiência/palavras-chave com índices; os filtros por vaga também retornam páginas de até 24 perfis. O perfil completo só é carregado quando necessário. A árvore pode conter alterações locais adicionais: conferir `git status` ao retomar.

As migrações SQL dessa busca foram aplicadas e testadas no Supabase. Seus nomes locais são `20261017213413_candidate_paged_search.sql`, `20261017213901_candidate_search_projection.sql`, `20261017214211_candidate_search_index_usage.sql` e `20261017214239_candidate_search_stable_order.sql`. Existe histórico antigo de migrações locais e remotas divergente; **não executar `supabase db push` às cegas nem reaplicar a migração inicial**. Antes de qualquer mudança de banco, ler a skill Supabase, comparar histórico e preparar migração incremental segura.

No último ciclo, passaram os testes de domínio, navegador em desktop e celular, SQL de permissões, tipagem, lint, build, verificação de segredos no cliente e HTTP local. Esses resultados valem para aquele commit; novas alterações exigem verificações proporcionais. A produção tinha poucos perfis reais na medição anterior, então o ganho em uma base de 5.000 ainda não foi medido em condições reais.

## Lacuna e próxima prioridade

Localmente, a seleção e comparação por filtros agora buscam somente até 100 perfis correspondentes; o servidor valida a propriedade, registra o resultado com controle de versão e as ações em lote leem somente perfis selecionados. A abertura de um perfil vindo da busca paginada já reutiliza o payload da página. A busca assistida e algumas ações no perfil ainda podem carregar a base completa.

Em 18/10/2026, foi reconciliado o histórico do Supabase (`feqkkqemsrifauedspeq`) com `supabase migration repair`: as oito versões remotas antigas divergentes foram marcadas reverted; as oito versões locais correspondentes e a migration inicial `202610090001` foram marcadas applied, após verificar as tabelas, colunas, políticas, funções, bucket e privilégios presentes. Não se executou novamente o SQL dessas migrations.

Também foram aplicadas remotamente, nesta ordem, `20261018160327_vacancy_candidate_paged_search.sql`, `20261018174500_ai_model_routing_usage_ledger.sql` e `20261018180500_vacancy_candidate_selection.sql`. As funções de busca e seleção e a tabela `talentia_private.ai_usage` foram conferidas no schema. O histórico MCP passou a listar as mesmas 24 versões locais, e `supabase db push --dry-run --linked` confirmou `Remote database is up to date`, sem migrations pendentes. A CLI `migration list` continua falhando por senha de conexão PostgreSQL inválida, embora o dry-run e as operações de repair tenham funcionado; não tentar contornar lendo credenciais.

Verificações após DDL: RLS está habilitado em `talentia_private.ai_usage`; usuários autenticados não podem selecionar a tabela diretamente, podem chamar os RPCs autorizados, e `anon` não pode registrar uso. Os advisors mostraram avisos informativos de RLS sem política em tabelas privadas (acesso direto revogado por desenho), alerta de proteção contra senhas vazadas desabilitada na configuração Auth e quatro índices não utilizados (três de busca existentes e o novo índice de uso, ainda sem carga real). Não remover esses índices sem medir. Os testes unitários direcionados de busca e seleção passaram (17 testes; busca sintética de 5.000 perfis em ~509 ms), mas isso mede lógica da aplicação, não latência do Postgres. O teste Playwright de navegação com 5.000 resultados foi iniciado e interrompido após ficar sem progresso; a tentativa padrão falhou porque `test-results` está protegido. O daemon Docker não está ativo e não há `supabase/config.toml`, então o benchmark local de plano/latência ainda depende de ambiente Postgres de desenvolvimento; não inserir fixtures sintéticas na produção.

Em 18/10/2026, a roteação local de modelos e a medição estimada de tokens/custo estão prontas para integração: Haiku para leitura/organização/sugestão de busca e Sonnet para comparação. O código que usa o ledger e seleção está local, sem commit ou publicação; o banco de produção está preparado. Próxima prioridade: benchmark local com perfis sintéticos e revisar ações que ainda carregam a base completa. Compra de créditos/pagamentos foi adiada pelo usuário; não iniciar checkout ou cobrança agora.

## Como retomar com segurança

1. Ler `AGENTS.md` e este arquivo, depois conferir `git status --short`, `git log -3 --oneline` e a solicitação nova do usuário. Não supor que esta memória substitui o código atual.
2. Usar `README.md` como mapa de funcionalidades; `RECRUITER-JOURNEY-2026-10-13.md` para a jornada e decisões de produto; `tests/README.md` para limites de testes; `DEPLOYMENT.md` para infraestrutura, lembrando que trechos de status ali são datados.
3. Trabalhar no repositório local existente. Para sincronizar com mudanças remotas, verificar antes e usar `git pull --ff-only` quando apropriado. O usuário costuma pedir commit/push e acompanhar a publicação; deixar explícito se uma alteração ficou só local ou chegou à produção.
4. Seguir `AGENTS.md`: o agente principal executa por padrão, economizando tokens. Só convocar um revisor adicional quando o risco justificar; não abrir uma equipe inteira por rotina.
5. Não usar dados pessoais reais em testes. Testes de navegador usam dados fictícios e APIs simuladas; não equivalem a validação real de Supabase, Claude ou envio de e-mail.

## Preferências do usuário

O usuário prefere evolução prática e contínua, comunicação clara em português e pouca burocracia. Autorizações anteriores para desenvolver, sincronizar GitHub/Vercel e operar integrações no escopo do projeto permanecem válidas, mas é importante verificar o estado atual antes de publicar. Evitar repetir perguntas já respondidas. Preservar interface simples para a rotina da recrutadora, responsividade e localização PT-BR. Não prometer que a IA ou os testes garantem decisão de contratação ou funcionamento perfeito.
