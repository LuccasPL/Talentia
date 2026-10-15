# Dados de candidaturas descartadas — 15/10/2026

Pedido: continuar as correções de privacidade identificadas na revisão. Base `36f61cd`, preservando as alterações locais de instruções, revisão e permissões de importação. Um agente principal implementou; um revisor independente recebeu contexto novo e somente dois arquivos SQL para revisão estática, sem bloqueadores encontrados.

## Mudança

- `private.review_application` agora limpa `response`, `file_name`, `file_sha256` e `file_size` ao descartar, além do PDF em `private.application_files`. Mantém apenas a decisão, datas e referências internas de conta/vaga/link. `import_id` permanece nulo no descarte.
- Restrição de banco exige os campos nulos para descartadas e presentes para pendentes/aceitas. Decisão NULL é rejeitada explicitamente. Checagens de proprietário e de revisão anterior foram preservadas.
- Aceite conserva resposta e metadados para o pipeline e os contatos declarados. Não foi alterada a retenção de candidaturas aceitas ou de perfis já cadastrados.
- A confirmação da interface explica a exclusão na base ativa, que não pode ser desfeita, e distingue de excluir um perfil existente. Modelos de teste distinguem descartadas sem dados das candidaturas com resposta.
- Ao remover o hash do PDF, novo envio do mesmo documento deixa de ser deduplicado contra a candidatura descartada. Conta como nova candidatura, sujeito às cotas existentes. Reenvio antes do descarte continua com a deduplicação original.

## Migração e dados existentes

Arquivo criado pelo CLI: `20261015145322_redact_discarded_applications.sql`. Aplicado com sucesso no Supabase Talentia sob o nome `redact_discarded_applications`. Antes de aplicar, contagem agregada confirmou zero candidaturas descartadas. A migração aborta se houver qualquer descartada, exigindo revisão específica em outro ambiente; não faz expurgo silencioso de registros antigos.

O arquivo antigo `20261015170000_candidate_applications.sql` foi renomeado, sem mudança de conteúdo, para `20261015134518_candidate_applications.sql`, usando a versão confirmada no histórico remoto. Seu timestamp anterior estava no futuro e colocaria a criação das tabelas depois desta nova migração ao reconstruir o banco. Nenhuma migração histórica foi reaplicada ao remoto.

## Validação

- Teste SQL novo com duas contas fictícias e rollback: antes falhou com `Discarded personal data retained`; após correção passou. Também constatou e cobriu a aceitação indevida de decisão NULL na função antiga.
- SQL cobre exclusão do conteúdo e metadados, ausência do PDF privado, isolamento entre contas, revisão repetida, preservação do aceite, bloqueio de reintrodução de dados no registro descartado e novo envio consumindo cota.
- TypeScript, lint dos dois arquivos de aplicação e seis testes de regras de candidatura passaram.
- Quatro execuções Playwright passaram (dois cenários em desktop/mobile Chromium). APIs simuladas; confirmam aviso, cancelamento sem perda e ações de aceite/descarte. A persistência real foi verificada pelo SQL, não pela simulação.
- Advisors sem novos alertas: continuam os dois informes intencionais de tabelas privadas com RLS sem políticas e proteção de senhas vazadas desativada. https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Nenhuma chamada ao Claude, envio externo ou acesso ao conteúdo de candidato real nesta validação. Não repetido build ou bateria completa por mudança limitada; nenhum teste de importação real com provedor foi realizado.

## Limites e publicação

A função no banco já está ativa, inclusive para a versão atual do site. Texto da confirmação e tipos/fixtures estão locais, ainda sem commit/push/deploy. Migração e teste também aguardam versionamento com as outras alterações locais.

Exclusão lógica na base ativa não promete eliminação imediata de backups, versões físicas de páginas PostgreSQL, downloads anteriores ou cópias externas. Não é fluxo integral de exclusão de candidato nem anonimização garantida do histórico de decisões. Não foram modificadas políticas de backup nem implementada cifra adicional de aplicação.

Próximos itens: proteção contra abuso na entrada pública e concorrência da cota, gestão de retenção/exclusão de perfis e dados aceitos, autenticação forte e recuperação, criptografia adicional com gestão de chaves.
