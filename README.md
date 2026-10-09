# Talentia

Primeira versão funcional de um espaço privado de recrutamento. A recrutadora descreve cada vaga em texto livre, revisa critérios, compara experiências declaradas, registra contato e prepara um parecer editável.

## Estado desta versão

- Vagas, critérios, análises e registros são persistidos no servidor (D1), separados pelo usuário autenticado.
- PDFs importados são armazenados em R2 privado e servidos apenas após verificação do dono.
- Quatro perfis fictícios permitem testar o fluxo. Os PDFs pessoais enviados na conversa não integram o código ou a publicação.
- Sem a chave da Anthropic, a interface identifica o modo de demonstração. O briefing é dividido em trechos e a comparação encontra coincidências de termos; ela não é uma análise semântica ou recomendação de contratação.
- Com Claude configurado, o servidor interpreta o briefing, extrai PDFs e compara experiências em lotes de cinco. Nesta primeira versão há um limite de 100 candidatos para análise por IA. Uma base de 5.000 exige indexação e processamento em segundo plano antes do uso real.
- Contato pelo WhatsApp é manual. Não há integração de envio ou descoberta automática de disponibilidade.
- Pareceres são rascunhos editáveis, exportados em texto. Não há envio automático ao cliente.
- A publicação inicial é privada para o proprietário. O acesso da madrinha, autenticação independente para clientes e planos comerciais ainda precisam ser implementados/configurados antes de tratar este produto como um SaaS comercial.

## Desenvolvimento local

Node 22.13 ou superior. Instale com `npm run install:ci`; inicie com `npm run dev`. O starter é Vinext (React/TypeScript, convenções do Next.js), com execução compatível com Cloudflare Workers.

Para gerar o banco local: `npm run db:generate` (somente quando o esquema mudar), `npm run build`, e depois `node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_dashing_the_liberteens.sql`. Não reaplique uma migração já executada.

O desenvolvimento simula a identidade somente no loopback. A publicação usa a autenticação gerenciada da plataforma. Não confie em cabeçalhos de identidade provenientes de clientes ao adaptar a aplicação para outro servidor.

## Claude

Defina `ANTHROPIC_API_KEY` e opcionalmente `ANTHROPIC_MODEL` (padrão `claude-sonnet-5-5`) em `.dev.vars` no ambiente local ou como variáveis secretas do servidor no Sites. Não envie a chave pela conversa e não a coloque em código de navegador. Consulte `.env.example`. Uma assinatura do chat Claude não configura a API desta aplicação.

A integração usa a Messages API e respostas estruturadas. As respostas são validadas com Zod; citações de experiência precisam existir literalmente no texto do currículo. Condições atuais e comportamentos são sempre marcados para confirmação. PDFs são dados não confiáveis: instruções internas não são tratadas como comandos. A extração por IA deve ser revisada; as verificações não garantem veracidade do currículo nem ausência de vieses.

Referências: https://platform.claude.com/docs/en/models/overview e https://platform.claude.com/docs/en/build-with-claude/structured-outputs.

## Verificações

`npx tsc --noEmit`, build de produção e `node scripts/verify-workflow.mjs` com a prévia local ativa. O script usa somente a identidade fictícia local. Foram verificados também pela interface: briefing livre, revisão, comparação, notas, geração/salvamento de parecer e persistência após recarregar. As ferramentas WebMCP têm leitura de resumo e preparação de briefing (sem salvar); ambas foram verificadas, incluindo rejeição de entrada inválida.

Chamadas reais à Anthropic e extração real de PDFs ainda não foram testadas, pois não foi fornecida uma chave. Não importe dados pessoais para uso operacional antes de definir acesso da recrutadora, finalidade/base legal, retenção/exclusão, contratos de fornecedores e validação da qualidade com revisão humana.
