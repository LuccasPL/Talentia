# Registro de alterações — Claude (Claude Code), 15/10/2026: segurança do link público de candidatura

Este registro serve para que outra LLM entenda **o que o Claude alterou na entrada pública de candidaturas, por quê e o que falta**, sem acesso à conversa original. Registros anteriores: `2026-10-15-claude-candidaturas-por-link.md` (funcionalidade) e `2026-10-15-seguranca-e-criptografia.md` (revisão que motivou este trabalho, item 3 "Abuso da candidatura pública").

Base: `aa06442` (`main`). Pedido do usuário: criar segurança para o link público. Ele escolheu a "camada 1", que não usa serviço externo. Cloudflare Turnstile foi oferecido e **não** foi escolhido.

## Problema principal

A chave publicável do Supabase vai para o navegador. Por isso, `public.submit_application` e `public.access_application_link`, executáveis por `anon`, podiam ser chamadas **direto no Supabase**, sem passar pelo site. Isso contornava qualquer proteção no Next.js e o firewall da Vercel (120 req/min/IP em `/api`).

## Solução em duas fases

### Fase A — aplicada em produção em 15/10/2026

Migração `supabase/migrations/20261015151001_public_application_gateway.sql`. O nome do arquivo usa a versão registrada no histórico remoto.

| Item | O que faz |
| --- | --- |
| `private.gateway_keys` | Guarda **só o SHA-256** da chave do servidor (`purpose='public-applications'`). Não tem grants. |
| `private.gateway_allows(key)` | Compara o hash. Só pode ser chamada pelas funções definer. |
| `private.public_attempts` | Contadores por hora, por `client_hash`, que é o HMAC do IP calculado no servidor; o IP puro nunca é guardado. Limpeza aleatória (2%) de janelas com mais de 2 dias. |
| `private.count_public_attempt` | Faz upsert do contador e devolve se o limite foi respeitado. |
| `public/private.application_view(token,gateway_key,client_hash)` | Substitui `access_application_link`. Exige a chave e limita a **60 aberturas por hora por cliente**, além do limite de 600 por link que já existia. |
| `public/private.application_submit(token,answer,file_name,file_base64,gateway_key,client_hash)` | Substitui `submit_application`. Exige a chave e limita a **5 tentativas por hora por cliente**. A tentativa é contada **antes** de qualquer validação, inclusive quando é inválida ou repete um PDF. Usa `pg_advisory_xact_lock` por dona para que o teto de 100 pendentes seja exato com links concorrentes. Valida o base64 com regex antes do `decode`. |

**Erros como valores.** As funções devolvem `{error:'gateway'|'client'|'rate'|'unavailable'|'invalid'|'file'}` em vez de lançar exceção. Uma exceção desfaria o contador de tentativas. A rota converte esses valores em HTTP 503, 503, 429, 410, 400 e 400.

A chave real foi gerada localmente com `crypto.randomBytes(48)` em base64url (64 caracteres) e gravada **apenas** em `talentia/.env.local`, que é ignorado pelo git, como `TALENTIA_PUBLIC_GATEWAY_SECRET`. O hash dela foi inserido em `private.gateway_keys` em produção. O valor nunca foi mostrado no chat nem versionado.

### Fase B — preparada, **NÃO aplicada**

Migração `supabase/migrations/20261015180000_close_direct_application_rpcs.sql`. Ela revoga o acesso `anon` e remove `access_application_link` e `submit_application`, nas versões public e private. **Aplicar somente depois** que:
1. a variável `TALENTIA_PUBLIC_GATEWAY_SECRET` estiver configurada na Vercel (Production) com o mesmo valor do `.env.local`;
2. o código desta entrega estiver publicado;
3. `/candidatura` tiver sido conferida em produção (abrir e enviar).

Até a fase B ser aplicada, a porta antiga continua aberta para quem chamar o Supabase diretamente.

Ao aplicar, renomeie o arquivo para a versão que o Supabase registrar.

## Servidor e página

| Arquivo | Tipo | O que mudou |
| --- | --- | --- |
| `lib/public-application-security.ts` | **novo** | Funções puras:<br>• `clientIp`: `x-real-ip` ou o 1º valor de `x-forwarded-for`, senão `unknown`;<br>• `clientHash`: HMAC-SHA256 da chave sobre `ip:<ip>`;<br>• `issueFormToken`/`checkFormToken`: token `"<ms>.<hmac>"` ligado ao link; recusa envio com menos de 4 s (`fast`) ou mais de 6 h (`expired`), além de token forjado ou de outro link;<br>• `pdfRisks`: heurística que recusa `/JavaScript`, `/JS`, `/Launch`, `/EmbeddedFile(s)`, `/FileAttachment`, `/RichMedia`, `/XFA` e `/Encrypt`, inclusive com escapes `#xx` nos nomes. Não inspeciona object streams comprimidos e **não é antivírus**. |
| `app/api/public/applications/route.ts` | editado | Passa a usar `application_view` e `application_submit` com a chave e o `client_hash`. A visualização devolve `formToken`. O envio verifica, nesta ordem: honeypot `website` preenchido (responde `received:true` e não grava nada), token de tempo, schema, tamanho e `%PDF-`, `pdfRisks` e só então a RPC. Sem a variável (ou com menos de 32 caracteres), responde 503. |
| `app/candidatura/application-form.tsx` | editado | Guarda o `formToken` da visualização e o envia. Campo armadilha `website` dentro de `.apply-trap`: fora da tela, `aria-hidden`, `tabIndex=-1`, `autoComplete=off`. |
| `app/globals.css` | editado | `.apply-trap`. |
| `.env.example` | editado | `TALENTIA_PUBLIC_GATEWAY_SECRET=`. |

## Testes

- `scripts/public-application-security.test.mjs` (**novo**, 4 testes): hash do cliente, IP, token de tempo e riscos de PDF.
- `tests/browser/fixture.ts`: exporta `applicationFormToken`; a simulação da visualização devolve `formToken`; os envios guardam `formToken` e `website`.
- `tests/browser/application-page.spec.ts`: confere o `formToken` reenviado e o honeypot vazio, e há um teste novo verificando que o honeypot fica invisível, fora do Tab e da árvore de acessibilidade.
- `supabase/tests/public-application-gateway.sql` (**novo**), executado em produção com `BEGIN … ROLLBACK`, cobre:
  - anon sem acesso aos helpers e às tabelas privadas;
  - chave ausente ou errada;
  - `client_hash` inválido;
  - tentativas inválidas contadas e persistidas, com a 6ª recusada;
  - outro cliente não afetado;
  - fila cheia (100) recusando o envio.
- `supabase/tests/candidate-applications.sql` (Claude) e `supabase/tests/discarded-applications.sql` (outra LLM) foram **migrados para as funções novas**, com uma chave descartável inserida na transação. Ambos passaram em produção com rollback. Depois, a consulta confirmou o hash real restaurado e 0 tentativas gravadas.
- `npm run test:agent`: 7/7 etapas aprovadas (217 testes de regra, 70 de navegador). `security:client` confirmou que o segredo não chega ao bundle do cliente.

## Limitações e próximos passos

- O IP no Vercel vem dos cabeçalhos da plataforma. Fora dela, ou atrás de outro proxy, todos caem no balde `unknown`, que é compartilhado.
- O limite por IP não impede ataques distribuídos de muitos IPs. Para isso, use o Turnstile ou regras do firewall da Vercel (o plano Hobby tem limites).
- A chave do servidor viaja como parâmetro da RPC até o Supabase, por TLS. Se for exposta, gere outra e atualize o hash e a variável na Vercel.
- `pdfRisks` é heurístico. PDFs com JavaScript dentro de object streams comprimidos passam. A prévia continua inline na mesma origem, como antes.
- Pendências da revisão que **não** foram tratadas aqui: retenção e exclusão de dados aceitos, MFA e recuperação de conta, criptografia adicional.
