# Revisão de segurança — Talentia

Data: 10/10/2026. Escopo: código, dependências, arquivos do navegador, autenticação, acesso ao banco e PDFs, chamadas ao Claude e configuração de produção. Revisão com testes direcionados; não constitui um teste de invasão completo ou garantia de ausência de falhas. Nenhum currículo real foi alterado e não foram feitos testes de carga em produção.

## Proteções implementadas

- Next.js atualizado de 16.3.4 para 16.3.8 e dependências vulneráveis atualizadas. A auditoria `npm audit --omit=dev` retornou zero avisos na data da revisão.
- Limite por IP publicado no firewall da Vercel: 120 requisições em 60 segundos nas rotas `/api` e `/auth`, retornando HTTP 429. Não exige sessão e atua antes da aplicação. Sem contratação de plano adicional.
- Supabase Auth: login/cadastro e validação de códigos limitados a 10 solicitações por IP a cada cinco minutos. Confirmação de e-mail e mínimo de 12 caracteres para novas senhas já estavam configurados e foram conferidos. Entrada anônima desativada.
- Limites por usuário armazenados em uma tabela privada do Postgres, com atualização atômica e serialização por usuário/categoria. O cliente não pode consultar, editar ou apagar os contadores, escolher o próprio limite ou consumir o limite de outra conta. Falha no verificador bloqueia a operação com HTTP 503.
- Requisições limitadas pelos bytes efetivamente recebidos, mesmo sem um `Content-Length` confiável. JSON comum: 256 KiB; salvamento do espaço: 3 MiB; formulário de PDF: 2 MiB mais 64 KiB para o envelope. Cada PDF continua limitado a 2 MiB.
- Política de conteúdo com nonce novo por requisição: scripts externos não autorizados, plugins e enquadramento por outros sites bloqueados. HTML dinâmico para os nonces. Estilos internos ainda usam `unsafe-inline`, necessário ao layout; scripts de produção não usam `unsafe-inline` nem `unsafe-eval`.
- Cabeçalhos contra interpretação indevida de arquivos, enquadramento e vazamento de referências; HTTPS persistente e permissões de câmera/microfone/localização desativadas. Cookies gerados pela integração usam Secure em produção e SameSite=Lax. Cookies da sessão continuam disponíveis ao cliente Supabase, como exige a integração existente.
- Acesso ao PDF verifica o proprietário na consulta e no caminho do arquivo, sem carregar o banco completo de candidatos. Os PDFs seguem privados.
- Integração com Claude e chaves privadas permanecem no servidor. Rotas autenticadas e regras de origem são exigidas antes de processamento; IA paga continua restrita à lista de usuários autorizados. Currículos são conteúdo não confiável, sem execução de instruções ou ferramentas de envio.
- Verificação de dependências de produção e varredura dos arquivos compilados adicionadas à rotina de verificações do GitHub. A verificação de chaves falha sem imprimir credenciais, apenas caminhos.

## Limites por conta

As janelas são fixas, calculadas no servidor. Ao esgotar um limite, a API retorna HTTP 429 e `Retry-After` em segundos. Os valores iniciais são conservadores para o piloto e podem ser ajustados conforme o uso real.

| Operação | Limite |
| --- | --- |
| Consultar o espaço ou visualizar PDFs | 60/minuto, compartilhado |
| Salvar/editar/unificar candidatos, contatos e espaço | 30/minuto, compartilhado |
| Consultar histórico de importações | 30/minuto |
| Conferir processamento de importações | 6/minuto |
| Enviar/repetir importações de PDFs | 30/minuto |
| Pedir critérios/comparações | 6 a cada 10 minutos |
| Chamadas pagas ao Claude, incluindo extração de PDF | 60/hora e 200/dia, compartilhado |

Uma comparação de 100 candidatos usa até 20 chamadas ao Claude; cada lote e cada PDF contam individualmente. Tentativas de chamadas são contabilizadas antes do envio, inclusive se o provedor falhar. Esses limites reduzem abuso, mas não são um orçamento financeiro: o custo depende de tokens, modelo, tamanho dos PDFs e preço do provedor. Limites por IP são compartilhados por pessoas que utilizam a mesma rede.

## Evidências

- 71 testes automatizados aprovados; TypeScript, lint e compilação aprovados.
- Arquivos JavaScript do cliente compilado: 39 arquivos verificados, nenhuma chave privada detectada. Comparação com segredos locais/ambiente e padrões de Anthropic, Resend, Supabase secret/service_role e chaves privadas.
- 173 arquivos rastreados e 39 commits históricos inspecionados por padrões de credenciais: nenhum achado; somente `.env.example` está versionado.
- Testes transacionais no Supabase confirmaram isolamento entre contas, armazenamento privado, rejeição de alteração de proprietário, salvamento com versão antiga, acesso anônimo negado e contadores protegidos. Usuários e registros de teste foram revertidos ao fim das transações.
- Testes HTTP locais confirmaram cabeçalhos, nonce efetivo no HTML e renovação, respostas 401 sem sessão, respostas 403 para origem externa, IA sem sessão bloqueada e ausência de redirecionamento externo no callback. Nove scripts públicos do login verificados.
- Firewall conferido após publicação no painel da Vercel. Não foi enviado um volume de tráfego suficiente para esgotá-lo em produção.

## Pendências e limites da proteção

- Supabase sinaliza que a verificação de senhas vazadas está desativada; esse recurso exige plano Pro ou superior. Nenhum plano pago foi contratado. [Documentação oficial](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- A auditoria completa ainda aponta uma vulnerabilidade de recursão em `braces` e quatro dependências de desenvolvimento afetadas pela mesma cadeia do ESLint. Não há atualização compatível indicada pela auditoria; forçar a sugestão faria downgrade do ESLint do Next para a versão 14. Essa cadeia não está nas dependências de produção e não recebe padrões dos candidatos, mas deve ser atualizada quando houver correção compatível. [Aviso upstream](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
- A tabela privada de contadores possui RLS sem política de acesso. O aviso informativo do Supabase é intencional: clientes não devem acessar linhas; apenas a função privada de quota com proprietário derivado da sessão pode alterá-las.
- RLS protege dados entre contas; uma conta autorizada continua podendo acessar e modificar seus próprios dados pela API pública do Supabase. As cotas da aplicação não substituem as proteções e os limites da plataforma de banco.
- Distribuição de ataques entre vários IPs, credenciais roubadas, comprometimento de contas administrativas e falhas futuras exigem outras camadas. Próximos passos úteis: MFA para administração e usuários, revisão de recuperação/backups e orçamento/alertas de uso na Anthropic. Não houve alteração dessas contas ou aquisição de serviços.

Referências de implementação: [CSP no Next.js](https://nextjs.org/docs/app/guides/content-security-policy), [rate limiting da Vercel](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting), [funções e permissões do Supabase](https://supabase.com/docs/guides/database/functions).
