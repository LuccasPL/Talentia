# Talentia

Assistente de recrutamento com briefing livre por vaga, currículos privados, evidências, acompanhamento de contatos e parecer editável. Next.js + Supabase + Claude, preparado para Vercel.

## Desenvolvimento

Copie `.env.example` para `.env.local` e preencha os valores no seu computador, sem versionar segredos. Instale com `npm ci`, execute com `npm run dev`. Verifique com `npm run typecheck`, `npm run lint` e `npm run build`.

O piloto está publicado em [talentia-two.vercel.app](https://talentia-two.vercel.app), com Supabase, e-mails de confirmação e Claude configurados. O código está no [GitHub](https://github.com/LuccasPL/Talentia). Importação de PDF, critérios, comparação e parecer foram validados em produção com um perfil fictício na conta autorizada do proprietário. Consulte [DEPLOYMENT.md](DEPLOYMENT.md) para os resultados, limites do piloto e autorização de outras contas.

## Sincronização com o computador

A pasta `talentia` já é o repositório local, ligado ao GitHub como `origin`, com `main` acompanhando `origin/main`. Não precisa clonar novamente neste computador.

Antes de trabalhar em outro computador, clone `https://github.com/LuccasPL/Talentia.git`. Antes de começar novas alterações, use `git pull --ff-only`. Para enviar alterações revisadas, faça um commit e use `git push`. O Git não envia automaticamente cada arquivo salvo. Não versione `.env.local`, credenciais nem currículos.

## Busca no banco de talentos

Combine nome ou palavras do currículo, cidade informada, termos de experiência, pendências na vaga atual e evidência documental para um critério. Busca ignora acentos e exige todos os termos digitados; não é busca semântica nem comprovação de aderência. A lista oferece ordenação por nome/data de importação e páginas de 24 perfis. A comparação envia os IDs de todos os perfis filtrados (até 100), verificados novamente contra a base do proprietário no servidor; análises anteriores de outros perfis são preservadas quando o motor permanece o mesmo. Data de importação não confirma disponibilidade ou validade do contato.

## Contatos por vaga e PT-BR

O painel de contatos inclui toda a base, mesmo sem registro prévio, com contagens de pessoas para abordar, aguardando retorno, que responderam e em entrevista. Busca e etapas filtram a lista, paginada em grupos de 24. A vaga pode ser trocada no próprio painel; notas, interesse e disponibilidade permanecem separados por vaga. Registrar abordagem atualiza apenas o histórico, preservando parecer e informações anteriores. Não envia mensagens nem confirma interesse automaticamente. Contatos marcados como Não contatar não têm ação rápida de abordagem. Perfil e parecer abrem diretamente na aba correspondente. Interface em português do Brasil; datas e histórico usam PT-BR e horário de Brasília.

## Parecer para impressão

Após salvar o texto, Visualizar para PDF abre uma página privada de apresentação com marca Talentia, vaga, identidade do candidato e seções do parecer. A página exige sessão e consulta apenas a base do proprietário; não há link público de compartilhamento. O botão Imprimir ou salvar em PDF abre a impressão do navegador, onde a recrutadora escolhe Salvar como PDF. O documento usa tamanho A4 e margens de 18 mm. O texto salvo é preservado; conteúdo personalizado não é interpretado como HTML e não recebe conclusões automáticas. A data de emissão usa horário de Brasília.

## Rascunhos de convite para entrevista

A aba Convite no perfil prepara textos editáveis de e-mail (assunto e corpo) e WhatsApp em PT-BR. A recrutadora informa sua identificação, nome público da vaga e, opcionalmente, cliente, data, horário de Brasília, formato, local/link e orientações. Textos-base são gerados localmente, sem chamada à IA ou afirmações automáticas sobre o perfil. Sem agenda informada, o convite propõe combinar os detalhes. Os rascunhos são salvos no registro da vaga/candidato, preservando notas, parecer, interesse e etapa. Copiar ou salvar não envia mensagens nem agenda a entrevista. Contatos Não contatar têm preparação e cópia bloqueadas. O painel de contatos oferece acesso direto por Preparar convite.

## Atualização e confirmação dos candidatos

A aba Dados permite editar nome, cargo, cidade, telefone, e-mail e experiências. Telefone, e-mail e localização podem ser explicitamente confirmados com método e timestamp do servidor; edição ou importação não confirmam dados automaticamente. Trocar um valor remove sua confirmação anterior. O primeiro texto importado e o PDF permanecem preservados. Alterar experiências invalida a análise daquele candidato em todas as vagas; alterar dados sinaliza os pareceres existentes para revisão, preservando seu texto e os convites. A impressão volta a ser liberada após salvar a revisão na aba Parecer. Dados, análises e sinalização dos registros são atualizados atomicamente pela RPC update_candidate com versão otimista e RLS de proprietário. Histórico mostra até 100 atualizações, sem guardar cópias antigas dos contatos. Novos filtros identificam contato/localização sem confirmação registrada.
