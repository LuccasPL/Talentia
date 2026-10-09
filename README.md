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

## Importação de PDFs em lote

A seleção e o arraste aceitam vários PDFs, até 2 MiB (2 MB na interface) por arquivo. A validação existe no navegador, na API e no bucket privado. A fila de envio mostra o andamento e continua após falhas individuais. Mantenha a página aberta até os arquivos serem enviados; arquivos apenas selecionados não ficam salvos. PDFs idênticos são identificados por SHA-256 antes de uma nova chamada paga.

Cada PDF enviado cria uma importação persistente e uma solicitação na Message Batches API do Claude Sonnet 5.5. A leitura continua no provedor com a página fechada, podendo levar até 24 horas. A Talentia consulta e salva os resultados ao abrir a importação, atualizar ou durante a consulta periódica com o painel aberto. Não há um trabalhador independente que grave os candidatos enquanto ninguém acessa o app; resultados do provedor ficam disponíveis por 29 dias. O histórico exibe as últimas 100 importações; a consulta percorre até 10 trabalhos pendentes por vez, com ordenação para evitar deixar os antigos sem consulta.

A RPC complete_pdf_import grava candidato e conclusão atomicamente e pode ser repetida sem duplicação. Proprietários são isolados por RLS; a associação entre conta, arquivo e lote é assinada pelo servidor para que metadados editáveis não concedam acesso a outro lote. A assinatura depende da chave Anthropic: finalize trabalhos pendentes antes de rotacionar a chave. Em timeout ambíguo de envio, o sistema evita reenvio automático e sinaliza necessidade de suporte para não cobrar duas vezes. Falhas de leitura podem ser reenviadas pelo histórico usando o PDF privado já salvo.

## Roteiro e registros de entrevista

A aba Entrevista no perfil prepara perguntas por candidato e vaga a partir dos critérios revisados e das perguntas da análise já salva, sem nova chamada à IA. Critérios sem evidência documental aparecem primeiro. A recrutadora pode editar perguntas, registrar respostas e separar suas observações. Atualizar o roteiro preserva textos e respostas, acrescenta critérios novos e mantém critérios alterados/removidos como registros anteriores. O histórico é limitado a 60 perguntas. Mudanças no cadastro ou novos critérios pedem revisão do roteiro.

Salvar utiliza o mesmo registro privado e versionado por candidato/vaga, preservando contato, notas e convite. Não modifica etapa, interesse, disponibilidade, dados confirmados nem análise documental. Alterar respostas ou observações sinaliza pareceres existentes para revisão. Novos rascunhos de parecer incluem os registros da conversa com identificação explícita da fonte e dos critérios anteriores; não substituem o parecer salvo nem comprovam automaticamente os critérios. É possível copiar os registros para revisão. Rascunhos não salvos permanecem ao trocar abas, mas são perdidos ao fechar o perfil.

## Agenda de entrevistas

O painel Agenda reúne encontros de todas as vagas, com filtros por período, situação, vaga e busca por candidato/local. Os lembretes são exibidos dentro do aplicativo ao abrir a agenda; não há envio de e-mail, WhatsApp, notificações fora do app ou integração com calendários externos. Inclui contagens de hoje, próximos sete dias, a confirmar e horários passados sem conclusão registrada.

Cada entrevista pertence a um candidato e vaga e registra data/hora de Brasília, duração (5 a 240 minutos), formato, local/link/telefone e observações. Situações: A confirmar, Confirmada, Realizada e Cancelada. A aba Entrevista no perfil permite agendar e editar os últimos três encontros registrados. Reagendar mantém o ID; novas rodadas criam registros separados (até 30 por candidato/vaga). Conflitos entre encontros ativos são avisados antes do salvamento; manter o mesmo horário exige uma marcação explícita. Cancelados e realizados não bloqueiam novos horários.

Datas digitadas são convertidas usando America/Sao_Paulo e armazenadas como instantes UTC, sem depender do fuso do computador. Registros ficam no JSONB privado e versionado já existente, sem mudança de esquema ou credencial adicional. Salvar um horário preserva a etapa de contato, disponibilidade, interesse, roteiro, convite e parecer. Contatos Não contatar bloqueiam novos agendamentos; encontros existentes continuam editáveis para cancelar ou registrar seu resultado. Marcar Confirmada requer que a recrutadora tenha combinado com o candidato.
# Painel de acompanhamento

O menu Acompanhamento reúne etapas, retornos pendentes, pareceres a revisar e próximas entrevistas por vaga ou em todas as vagas. Só entram candidatos comparados ou com registros no processo; toda a base não é automaticamente vinculada a cada vaga. O total de pessoas é único, enquanto as etapas contam participações por vaga. Os atalhos abrem o perfil na vaga correspondente. O painel usa os dados privados já salvos, sem alterar etapas, confirmar disponibilidade ou enviar mensagens.
# Lista de interesse por vaga

As estrelas do banco de talentos e a ação no perfil permitem marcar candidatos para uma lista privada por vaga. A marcação é manual, salva em `records.shortlisted` pelo mesmo acesso com RLS e controle de versão do restante do espaço. Ela não altera etapa, interesse ou disponibilidade e não envia mensagens. A lista reúne os trechos já analisados, próximas entrevistas, situação de contato e pareceres; busca sem distinguir acentos e filtro de etapa se combinam, com paginação de 24 perfis. Remover uma marcação mantém o candidato, o currículo e todos os registros. Não há nova chamada de IA para marcar ou visualizar a lista.
# Calendário semanal da agenda

A agenda abre na visão Semana, de segunda a domingo, no fuso de Brasília. Os eventos aparecem por horário e duração, com cores e texto para as situações. Há navegação por semana, retorno à semana atual e escolha de uma data; busca, vaga e situação filtram o calendário. Eventos que atravessam a meia-noite aparecem em ambos os dias, e sobreposições são exibidas lado a lado. O horário visível se expande para incluir entrevistas fora de 8h–20h. Clicar em um evento permite abrir o roteiro ou editar o agendamento já salvo. A visão Lista e seus filtros anteriores permanecem disponíveis. É uma visualização dos dados privados da Talentia, sem integração com Google Calendar, novos envios ou chamadas de IA.
