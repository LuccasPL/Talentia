# Talentia: publicação e validação

A aplicação foi migrada para Next.js, Supabase Auth/Postgres/Storage e Vercel. O código está na branch `main`, ligada ao repositório https://github.com/LuccasPL/Talentia . A demonstração anterior permanece publicada separadamente; esta versão ainda não foi publicada na Vercel.

## 1. Supabase

Crie uma conta em https://supabase.com/dashboard (é possível entrar com GitHub) e um projeto exclusivo para Talentia. Não reutilize o banco do inbox-faturas. Escolha uma região próxima das usuárias. Execute `supabase/migrations/202610090001_initial.sql` no SQL Editor uma vez, ou aplique pelo CLI de migrations.

A migration cria candidatos com campos pesquisáveis, um espaço com vagas/pareceres versionados, regras RLS por usuário e um bucket privado `curriculos`. A aplicação usa somente a chave pública e a sessão do usuário; não requer `service_role`.

Em Authentication, habilite e-mail/senha, confirmação de e-mail e senha mínima de 12 caracteres. Configure Site URL com a URL de produção da Vercel. Autorize as URLs exatas `/auth/callback` e `/auth/callback?next=/reset-password`; adicione localhost apenas para desenvolvimento. Não autorize curingas para produção.

Para links funcionarem em outro aparelho, configure os templates de confirmação e recuperação com os arquivos em `supabase/templates`. Os tokens são verificados no servidor; o destino é fixo, sem redirecionamento para sites externos.

Configure SMTP para enviar confirmação e recuperação para sua madrinha. O SMTP padrão do Supabase só atende endereços da equipe do projeto e não serve para esse acesso externo: https://supabase.com/docs/guides/auth/auth-smtp . Não desative a confirmação para contornar o envio.

## 2. GitHub e Vercel

Crie um repositório privado e envie esta branch. Importe esse repositório na Vercel usando o framework Next.js. Se o repositório contiver a pasta `talentia`, defina Root Directory como `talentia`; se publicar o Git atual desta pasta, deixe a raiz padrão. `vercel.json` já define instalação e build. O fluxo GitHub Actions verifica tipos, lint e build.

Configure na Vercel, antes do build:

- `NEXT_PUBLIC_SUPABASE_URL`: URL do projeto Supabase.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: chave pública do projeto.
- `ANTHROPIC_API_KEY`: segredo da API Claude, somente no servidor.
- `ANTHROPIC_MODEL`: `claude-sonnet-5-5`, substituível.

Sem Supabase, o site exibe a tela de configuração e não libera o espaço. Sem Claude, oferece apenas organização e coincidência de termos, identificadas como tal; PDFs exigem Claude. Uma assinatura Claude de consumidor não substitui créditos da API.

Faça deploy, ajuste Site URL/templates e valide os fluxos abaixo antes de entregar o acesso. Um domínio próprio é opcional; a URL HTTPS da Vercel atende ao piloto.

## 3. Verificações obrigatórias no projeto conectado

1. Criar duas contas de teste, confirmar e-mail, entrar e sair.
2. Solicitar recuperação, abrir o link em outro aparelho, alterar a senha e entrar novamente.
3. Criar vaga com briefing livre, revisar critérios, cadastrar candidato e verificar persistência após logout/login.
4. Importar PDF de teste até 4 MB; confirmar extração e leitura privada do original.
5. Confirmar que a conta B não lê/edita candidatos, vagas, pareceres nem PDFs da conta A, inclusive pela API Supabase.
6. Abrir duas sessões e salvar dados concorrentes; o segundo salvamento de uma versão antiga deve retornar conflito, preservando o primeiro.
7. Conectar Claude, conferir trechos citados, pontos a confirmar e parecer antes de usar CVs reais.

Tipos, lint e build locais não comprovam a execução dessas regras no Supabase. SQL, login real, entrega de e-mail, isolamento entre contas e Claude precisam da infraestrutura e credenciais conectadas.

## Limites do piloto

Não há cobrança, envio automático de WhatsApp nem confirmação automática de disponibilidade. O relatório é editável e exportado em texto. Cada PDF tem limite de 4 MB para acomodar o limite de requisição da Vercel. A base é carregada em páginas para não cortar candidatos após 1.000 registros. Comparação Claude ainda se limita a 100 perfis e ocorre em lotes sequenciais; avaliar 5.000 currículos exige busca prévia e fila de processamento, ainda não implementadas. Vagas e registros ficam em JSONB versionado nesta etapa; candidatos possuem tabela própria.

As regras de isolamento foram testadas no banco Talentia conectado em 9 de outubro de 2026. O teste `supabase/tests/rls.sql` usa contas temporárias dentro de uma transação revertida; verificou isolamento de leitura/escrita, bloqueio de troca de proprietário, regras de leitura dos arquivos privados, rejeição de versões antigas e bloqueio de acesso anônimo. A migration `restrict_table_privileges` removeu privilégios de TRUNCATE, REFERENCES e TRIGGER que vinham das permissões padrão do Supabase. Nenhum dado de teste permaneceu, e o verificador de segurança do Supabase não retornou alertas.

Isso não valida login pelo navegador, entrega de e-mail nem upload/download real de PDFs. Antes de abrir cadastro público com uso irrestrito da IA, implementar limites de consumo por conta; o piloto é para contas controladas. Retenção, exclusão, consentimento e operação com dados reais devem ser definidos com a recrutadora.

## Estado da infraestrutura em 9 de outubro de 2026

- Supabase: projeto Talentia (`feqkkqemsrifauedspeq`), acessível, com tabelas, função de salvamento e bucket privado já existentes. A estrutura inicial foi criada fora do histórico de migrations; não execute a migration inicial novamente neste banco. Reconcilie esse histórico antes de usar `supabase db push`.
- Computador: `.env.local` contém URL e chave pública do Supabase e está ignorado pelo Git; Claude ainda não configurado.
- Vercel: nenhum projeto Talentia criado. O plugin retornou HTTP 403 ao tentar criar `talentia-recrutamento` no espaço `luccas-pereira-s-projects` (`team_IABDDxjnqguEdmjdlQBThluT`). Não há CLI autenticado como alternativa. É necessário revisar a autorização da Vercel para esse espaço antes da publicação.
