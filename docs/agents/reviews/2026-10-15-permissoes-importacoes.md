# Correção de permissões de importações — 15/10/2026

Continuação autorizada pelo usuário após a revisão de segurança e adoção do modo econômico. Um agente principal executou a correção pontual, sem subagentes. Base do código: `36f61cd`; instruções do modo econômico e relatório da revisão já estavam modificados localmente e foram preservados.

## Problema e correção

A role authenticated tinha TRUNCATE, REFERENCES e TRIGGER em `public.pdf_imports`, além das quatro operações necessárias. A migração de criação da tabela não removia grants preexistentes dessa role. TRUNCATE não é limitado por RLS; não foi demonstrado acesso a essa operação pela API REST nem executada operação destrutiva.

Arquivo gerado pelo CLI Supabase: `supabase/migrations/20261015144957_restrict_pdf_import_privileges.sql`. Revoga apenas os três privilégios desnecessários de authenticated, anon e PUBLIC. Não altera linhas, RLS, SELECT/INSERT/UPDATE/DELETE ou RPCs. Não muda default privileges globais.

A migração `restrict_pdf_import_privileges` foi aplicada com sucesso ao projeto Supabase Talentia em 15/10/2026 via ferramenta de migração. Não é necessário deploy na Vercel para essa correção entrar em vigor. A versão do histórico remoto é atribuída pela ferramenta e pode diferir do timestamp gerado localmente pelo CLI.

## Verificação

- Novo teste `supabase/tests/table-privileges.sql`, somente de catálogo, executado antes: falhou com `Unexpected privilege TRUNCATE for authenticated on public.pdf_imports`.
- Mesmo teste depois: passou. Verifica todas as tabelas públicas para os privilégios desnecessários das duas roles, e preservação de CRUD/RLS/RPC em importações.
- Advisors depois: nenhum achado novo; permanecem as duas informações intencionais de RLS sem política nas tabelas privadas e o aviso de proteção contra senhas vazadas desativada. Referência: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.
- Nenhum currículo, dado pessoal, segredo ou linha de aplicação foi lido/alterado. Não foi feito novo upload ou chamada ao Claude.
- Bateria de frontend/build não repetida: não houve alteração de aplicação. O teste confirma privilégios efetivos, não todo o fluxo de importação.
- Teste SQL documentado para execução após migrações; não está ligado ao CI sem credenciais nem bloqueia sozinho alterações futuras.

## Situação e próximos passos

Correção de permissões ativa em produção. Migração, teste, documentos e mudanças anteriores do modo econômico permanecem locais, sem commit/push nesta rodada. Revisão anterior: `2026-10-15-seguranca-e-criptografia.md`; seu item 1 está resolvido por esta entrega.

Continuam pendentes: retenção/exclusão de candidaturas, proteção das tentativas na entrada pública, concorrência da cota por proprietário, MFA/recuperação e desenho completo da criptografia adicional. Não foi adicionada cifra de aplicação nesta correção.
