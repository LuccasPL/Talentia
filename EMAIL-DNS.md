# E-mails de acesso da Talentia

Site: https://talentia-two.vercel.app . Nenhum domínio novo será registrado.

Domínio de envio criado no Resend: `auth.inbox-faturas.pt` (região Ireland, eu-west-1), ID `ed93662a-52b2-4f03-b044-c9afeef6c75a`. Remetente planejado: `Talentia <acesso@auth.inbox-faturas.pt>`.

## Registros gerados pelo Resend em 9 de outubro de 2026

Adicionar à zona DNS de `inbox-faturas.pt` na Domínios.pt. Os nomes abaixo são relativos à zona; se o painel exigir nomes completos, acrescente `.inbox-faturas.pt` uma única vez. TTL automático/padrão do provedor.

| Tipo | Nome | Conteúdo |
| --- | --- | --- |
| TXT | `resend._domainkey.auth` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDej4Z18pPCtkPzSGq7WjAOWsX8zZiKYcAT7IAHMx7L7lclnltmwq58gP9WCwn/JWsoBrwoiH9jZIThcsjW/7hIG1cE8Ny4Jx4etTw1kGoAxPG0ignlt8N6XuP7UlpFC6Kz72JHCdZQC9jtX/kNRtq3R5gtrQAc9aVTf0txnaKItwIDAQAB` |
| CNAME | `rsend.auth` | `rsend-euw1.forge.rmta.net` |
| CNAME | `send.auth` | `send.forge.rmta.net` |

Esses são os valores efetivamente exibidos pelo Resend para este cadastro, não exemplos genéricos. A chave DKIM é pública e será publicada no DNS; não é uma chave da API.

Preservar registros de site, nameservers e os MX existentes `mx1.improvmx.com` / `mx2.improvmx.com`. Recebimento pelo Resend permanece desabilitado. Não substituir registros da zona inteira. Não criar um segundo SPF no domínio principal nem sobrescrever seu DMARC; a verificação usa o subdomínio separado.

## Estado

Os três registros foram adicionados na Domínios.pt e confirmados no DNS público em 9 de outubro de 2026, com TTL de 3600 segundos. O painel requer aspas duplas ao salvar o TXT e exige destinos CNAME sem ponto final. O Resend confirmou o domínio como **Verified**. Registros de site, recebimento e nameservers existentes foram preservados.

O formulário de criação de chave Resend foi preparado com nome `Talentia — Supabase Auth`, permissão `Sending access` e domínio `auth.inbox-faturas.pt`; a chave ainda não foi criada. O proprietário deve concluir a criação e copiar o segredo diretamente para o campo Password do Supabase. O formulário SMTP do Supabase contém remetente, nome, host, porta e usuário, mas ainda não foi salvo. Não considerar o envio ativo até salvar e testar a entrega.

O painel de configuração do domínio oferece habilitar métricas após configurar um subdomínio de rastreamento; esse subdomínio não foi configurado. Manter sem rastreamento para os links de autenticação. Depois de salvar SMTP, configurar os templates em `supabase/templates` e testar confirmação e recuperação.

SMTP: host `smtp.resend.com`, porta `465`, usuário `resend`, nome do remetente `Talentia`, endereço `acesso@auth.inbox-faturas.pt`. A senha SMTP é uma chave Resend restrita ao envio neste domínio e deve ser inserida diretamente no painel pelo proprietário; nunca registrada no Git ou nesta documentação.
