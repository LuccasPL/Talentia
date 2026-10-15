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

## Segurança, uso e exportação

O botão Segurança e uso, também acessível por Meu espaço, consulta os contadores da própria conta sem consumir chamadas à IA. Mostra limites por hora/dia, saldo de tentativas e renovação no horário de Brasília; Atualizar uso refaz a consulta. São limites de quantidade, não um orçamento financeiro nem uma medição em tempo real. O endpoint exige autenticação e limita consultas.

Baixar candidatos em CSV exporta apenas dados cadastrais dos perfis ativos: identificação, nome, cargo, cidade informada, telefone, e-mail, origem e datas de importação/confirmação. Não inclui PDFs, textos de currículos, entrevistas nem pareceres, e não substitui um backup completo. O arquivo usa UTF-8 com BOM, separador ponto e vírgula e proteção contra fórmulas de planilha. A API consulta somente os campos exportáveis da conta autenticada, exige mesma origem, limita a duas tentativas por minuto e recusa bases com 10 mil registros ou arquivos acima de 4 MiB. O download não altera candidatos nem envia mensagens.

## Exportação da semana da agenda

A visão Semana permite baixar um arquivo `.ics` com as entrevistas confirmadas ou a confirmar que se sobrepõem à semana exibida em Brasília, respeitando vaga, busca e situação. Encontros que atravessam a meia-noite entram uma única vez com sua duração completa; realizados e cancelados são excluídos. A tela de exportação informa o período e a quantidade, e oferece inclusão opcional dos nomes (desativada inicialmente). O arquivo contém vaga, horário absoluto UTC, duração, formato e local/acesso informado, sem CV, contatos cadastrais, respostas, observações ou pareceres.

O arquivo segue [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545), com texto escapado, linhas dobradas por bytes UTF-8 e identificadores estáveis. Não inclui destinatários, organizador, método de convite nem alarmes. A geração ocorre no navegador a partir dos dados privados já carregados e não faz chamadas à IA ou alterações no banco. A indicação PRIVATE é metadado, não controle de compartilhamento: importe em um calendário privado. É uma cópia manual; alterações, cancelamentos e reimportações devem ser conferidos no calendário de destino, que pode usar outro fuso ou duplicar eventos. Mais de mil encontros ou arquivo acima de 2 MiB pedem filtros adicionais, sem exportação parcial silenciosa.

## Atualização por link sem cadastro

Na aba Dados de um candidato, a recrutadora informa seu nome e gera um link de 3, 7 ou 14 dias. A Talentia salva a vaga antes de gerar o pedido e apresenta ao candidato uma fotografia do título e das condições opcionais (local, modalidade, remuneração, jornada, benefícios e início). A descrição livre continua disponível e as condições são incluídas na interpretação dos critérios. Alterá-las reinicia a comparação e sinaliza os pareceres para revisão.

O formulário em /atualizar recebe a capacidade pelo fragmento da URL, sem incluir o token no caminho, parâmetros, logs de navegação ou referrer. O banco guarda apenas seu hash SHA-256. A API pública usa cliente anônimo sem cookies, exige mesma origem e limita o corpo. Cada link permite uma resposta, até 60 acessos por hora, e pode ser cancelado; criar um novo pedido invalida links ainda não respondidos do mesmo candidato/vaga. Perfis unificados e contatos marcados Não contatar recusam acesso. O link não mostra nome, contatos existentes, experiências, PDFs, notas ou pareceres. Sua posse não comprova identidade.

Atualizações recebidas reúne até 100 respostas pendentes para revisão, com atualização manual; a aba Dados lista os 30 pedidos mais recentes do candidato. Incorporar preserva o PDF e o texto original, registra a declaração e atualiza dados/interesse/disponibilidade. Telefones e e-mails alterados perdem verificações antigas e não são verificados automaticamente. A resposta registra as condições apresentadas naquele momento e sinaliza pareceres salvos para revisão. Recusa de contato incorporada marca Não contatar naquela vaga. A revisão usa versão otimista e transação atômica, sem aplicar duas vezes a mesma resposta. Não há envio automático, sincronização de WhatsApp nem comprovação por OTP.

Validação: scripts/candidate-refresh.test.mjs e supabase/tests/candidate-refresh.sql (executar dentro de BEGIN/ROLLBACK), incluindo isolamento de contas, acesso anônimo negado à tabela, tokens inválidos/expirados/cancelados, uso único e concorrência. A atualização por link é a primeira etapa do roteiro competitivo; recuperação vetorial por significado, portal externo para clientes, sincronização de comunicação/agenda e operação independente de importações continuam como etapas futuras.


## Candidaturas por link

Em **Candidaturas por link** (grupo Banco de talentos), a recrutadora escolhe a vaga, informa o nome que os candidatos verão, a validade (7, 14 ou 30 dias) e o limite de envios (10, 50 ou 200), e cria um link para divulgar onde preferir. O token aparece uma única vez, no fragmento da URL de `/candidatura`, e o banco guarda apenas o hash SHA-256. A página mostra o título e as condições salvas da vaga. Quem abrir informa nome, telefone e/ou e-mail, cidade, cargo e mensagem (opcionais), anexa um PDF de até 2 MB e consente com a guarda dos dados.

Os envios ficam numa fila privada, com o PDF guardado fora dos esquemas expostos (`private.application_files`), e **não entram no banco de talentos sozinhos**. Na fila, a recrutadora vê os dados declarados e avisos de possível perfil já cadastrado (mesmo PDF, e-mail, telefone ou, na falta deles, nome). Ela então:
- **aceita**: o PDF vai para o bucket privado e entra na mesma importação monitorada com Claude. Ao concluir, o perfil recebe os contatos declarados, sem marcá-los como verificados;
- **descarta**: o PDF é apagado.

Limites:
- cada link aceita até 30 envios por hora e 600 aberturas por hora;
- reenviar o mesmo PDF pelo mesmo link não gera uma nova candidatura;
- novos envios são recusados enquanto houver 100 candidaturas pendentes;
- cada conta pode ter até 20 links ativos.
- cada conexão (IP, guardado apenas como hash) pode abrir o link 60 vezes e tentar enviar 5 vezes por hora; tentativas inválidas também contam.

Proteções da entrada pública:
- o Supabase só aceita aberturas e envios feitos pelo servidor da Talentia, que apresenta uma chave secreta (TALENTIA_PUBLIC_GATEWAY_SECRET, configurada na Vercel; o banco guarda apenas o hash dela);
- um campo invisível e um tempo mínimo de preenchimento, assinado pelo servidor, recusam envios automáticos;
- PDFs com scripts, ações automáticas, anexos, mídia incorporada, formulários XFA ou senha são recusados antes de entrar na fila. É uma checagem heurística, não um antivírus.

Detalhes e pendências: docs/agents/reviews/2026-10-15-claude-seguranca-link-publico.md.

O link não comprova identidade e qualquer pessoa que o tenha pode enviar. Aceitar exige a leitura de PDF com Claude liberada para a conta. A candidatura aceita não cria registro na vaga: compare o perfil na vaga como qualquer outro. Não há captcha nem limite por IP. Antes de decidir, o botão Abrir PDF enviado mostra o arquivo da fila, apenas para a dona da conta e enquanto a candidatura estiver pendente. O menu mostra quantas candidaturas aguardam revisão.

Validação: scripts/candidate-applications.test.mjs, tests/browser/candidate-applications.spec.ts (APIs simuladas) e supabase/tests/candidate-applications.sql (executar dentro de BEGIN/ROLLBACK). Migração: supabase/migrations/20261015170000_candidate_applications.sql.

## Busca assistida por experiências relacionadas

Banco de talentos e seleção para uma vaga oferecem um pedido em texto livre. O Claude sugere até 8 grupos de termos profissionais, com até 8 alternativas por grupo. A recrutadora revisa ou monta os termos manualmente antes de aplicar. Nesta etapa há expansão de consultas e recuperação textual local, sem embeddings nem nova comparação de todos os currículos. Apenas o pedido é enviado ao Claude; não são enviados currículos nesta chamada. A API exige autenticação, acesso autorizado à IA, mesma origem, limites de uso e validação da saída, incluindo rejeição de atributos pessoais protegidos.

Os resultados exibem trechos literais que contêm os termos encontrados, com indicação heurística de menções negativas para revisão. A ordenação usa a quantidade de grupos encontrados, priorizando menções afirmativas, sem pontuação de contratação nem comprovação automática de experiência. Pode-se exigir pelo menos um grupo ou todos os grupos. Aplicar substitui os filtros de texto livre e experiência; cidade, pendências e evidências continuam combinados. A comparação documental existente com Claude permanece necessária para avaliar aderência aos critérios revisados.

Até 5 buscas podem ser guardadas por vaga no JSONB privado e versionado existente, sem mudança de esquema. Abrir uma busca pede revisão antes de aplicá-la; remover não altera candidatos. Gerar sugestões consome uma chamada à IA, enquanto edição, recuperação textual e buscas salvas não consomem novas chamadas. O teste sintético percorre 5.000 perfis e verifica acesso ao último perfil; não substitui avaliação de desempenho com PDFs reais de tamanhos variados.


## Gestão de clientes

Clientes mantém um diretório privado por conta com empresa/nome, pessoa de contato, e-mail, telefone e observações internas, limitado a 300 cadastros. Há busca sem distinção de acentos, filtros por ativo/arquivado e paginação. Arquivar e reativar são reversíveis e preservam todas as vagas e registros; remoção definitiva não é oferecida. A associação opcional clientId de uma vaga só aceita IDs do diretório da conta, inclusive cadastros arquivados já associados. A tela da vaga salva o vínculo com as demais edições da oportunidade, sem reiniciar os critérios.

O painel de um cliente reúne as vagas vinculadas e os registros de perfis ativos, com lista de interesse, pareceres sem revisão pendente e pareceres a revisar. As contagens são por candidato/vaga e não comprovam entrega ou aprovação do cliente. Abertura de vaga, lista e pareceres preserva o contexto. Não há portal externo, novos envios de e-mail/WhatsApp ou chamadas de IA.

Persistência: coluna clients na tabela workspaces já protegida por RLS de proprietário. save_clients é SECURITY INVOKER, nega execução anônima, impede a retirada de IDs existentes e grava apenas o diretório, usando a versão compartilhada do espaço sob bloqueio de linha. Salvar vagas/candidatos pelas funções anteriores preserva o diretório. As respostas retornam o espaço atualizado; edições locais das vagas são preservadas ao salvar um cadastro de cliente. A API valida limites, campos, identidade, origem e taxa de gravação.

Validação: scripts/clients.test.mjs e supabase/tests/clients.sql. O teste SQL utiliza uma conta existente dentro de BEGIN/ROLLBACK, sem deixar clientes de teste, e cobre versão antiga, arquivo, dados não relacionados e isolamento. O advisor não encontrou avisos novos desta alteração; permanecem o bloqueio deliberado da tabela privada de limites sem políticas e a [proteção contra senhas vazadas desativada](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), já existente.


## Apresentação de candidatos ao cliente

Lista de interesse e as vagas no painel de Clientes oferecem Preparar apresentação ao cliente. A página autenticada permite escolher de 1 a 10 perfis marcados na vaga, ordenar manualmente e preparar capa com recrutadora e introdução opcionais. Somente perfis ativos com parecer salvo, sem revisão pendente e sem marcação Não contatar podem entrar. Requisições com IDs externos, fora da lista, repetidos ou versão antiga são recusadas integralmente, sem seleção parcial silenciosa.

A API exige identidade, origem local, limite de leitura e corpo limitado. Reconsulta o espaço privado e valida a versão antes de retornar os pareceres pedidos. O payload não acrescenta CVs, PDFs, contatos, notas ou respostas de entrevista; apenas o texto do parecer já salvo, nome, função e cidade informada. A cidade cadastral só é renderizada no documento mediante escolha explícita, desativada inicialmente. O texto livre do parecer é preservado e pode conter informações internas que a recrutadora incluiu nele: sua revisão antes de compartilhar é obrigatória. Conteúdo é renderizado como texto, sem HTML fornecido pelo usuário.

A prévia contém capa e cada perfil começando em uma página nova. O botão de impressão exige marcar a revisão do conteúdo e abre a impressão do navegador, com opção Salvar como PDF. É uma fotografia do espaço na preparação; alterações posteriores pedem recarregar. As escolhas, a introdução e a prévia são temporárias e ficam na página, sem salvar um pacote ou histórico de entrega no banco. Não há link público, portal externo, envio ao cliente, mudança de estágio ou chamada à IA. Copiar a URL da página continua exigindo o login e os dados da conta correspondente.

Validação: scripts/client-presentation.test.mjs cobre 1–10 perfis, ordem, versão, isolamento, marcações de revisão, ausência de dados acessórios e preservação literal dos pareceres.

## Funil visual por vaga

Funil de candidatos apresenta as sete etapas existentes em colunas, usando os mesmos registros do acompanhamento. Participam apenas perfis ativos comparados ou com registros na vaga; toda a base não é inscrita automaticamente. Há busca por nome, função e cidade, filtros de lista de interesse e parecer pendente, seleção de uma coluna e exibição inicial de 20 cartões por coluna com carregamento adicional.

Arrastar um cartão ou usar Alterar etapa abre a mesma confirmação manual. Encerrar ou bloquear requer motivo; contatos bloqueados precisam ser revisados no perfil antes de reativação. A alteração preserva histórico, respostas, notas, disponibilidade, lembretes e agendamentos, acrescenta um evento e sinaliza pareceres existentes para revisão. Não envia mensagens, não registra contato realizado automaticamente, não agenda ou cancela entrevistas e não chama IA. Agendamentos existentes devem ser conferidos separadamente na agenda.

POST /api/pipeline exige proprietário autenticado, mesma origem, limite de gravação, corpo limitado e confirmação explícita. Reconsulta a participação e a etapa, valida a versão compartilhada e grava por save_workspace com concorrência otimista e RLS existentes. Uma atualização sem mudança de etapa não grava nem avança versão. Não há nova tabela ou migração. Validação: scripts/recruitment-pipeline.test.mjs cobre escopo, filtros, concorrência, bloqueios e preservação dos outros dados.

## Saúde da base

Saúde da base organiza perfis ativos por dados ausentes, falta de confirmações recentes, ausência de registros, registros antigos e declarações recentes incorporadas. O prazo de referência pode ser 30, 90 ou 180 dias, sem expiração automática nem comprovação de invalidez. Importação e edição do CV não contam como confirmação. Telefone, e-mail e cidade presentes são conferidos separadamente; uma declaração por link não verifica titularidade ou identidade. Datas inválidas, futuras e confirmações de campos vazios não contam como sinal de atualização.

A visão considera toda a base privada, excluindo perfis unificados. A vaga selecionada define somente os bloqueios Não contatar, que ficam fora dos filtros iniciais de revisão. Categorias se sobrepõem; a ordem começa por ausência de registro e depois pela data mais antiga, sem pontuação de contratação. Busca por nome/função e cidade, paginação de 25 perfis e abertura da aba Dados permitem revisar confirmações ou usar o fluxo existente de atualização por link. Não gera links em massa, envia mensagens, altera cadastros ou usa IA. Recalcular prazos atualiza a referência de horário local, sem buscar novos dados no servidor.

Não há API, migração ou novo acesso ao banco; usa os dados autenticados já carregados no espaço. Validação: scripts/base-health.test.mjs cobre distinção entre importação, declaração e confirmação, prazo inclusivo por campo, bloqueios por vaga, datas inválidas, filtros, preservação dos dados e recuperação em 5.000 perfis.

## Conferência de currículos importados

Conferir currículos lista perfis ativos com origem em PDF, incluindo origens escolhidas na unificação, e oferece busca por nome, função ou arquivo, filtro de pontos a conferir e paginação de 25. Avisos incluem campos vazios, ausência de qualquer contato, texto cadastral com menos de 200 caracteres e origem sem PDF disponível. São pistas de conferência, não diagnóstico de erro de extração ou avaliação de experiência. A ordem usa apenas a quantidade de avisos, depois o nome. Corrigir o cadastro recalcula os avisos sem aprovação automática da extração.

A aba Currículo compara a transcrição original da origem em uso com o texto cadastral atual. Perfis unificados usam a origem escolhida, inclusive arquivada, sem substituir uma origem ausente por outro PDF. Os textos são renderizados literalmente, sem executar HTML ou instruções do documento. Abrir PDF privado utiliza a rota autenticada existente, em outra aba, preservando bloqueios contra incorporação em páginas e sem criar URL pública. Um botão abre a aba Dados para correção pelos controles existentes, preservando o original e os efeitos de revisão das comparações e pareceres.

Histórico de importação oferece Conferir perfil nos arquivos concluídos cujo perfil ativo está carregado. Perfis indisponíveis ou unificados não são reabertos silenciosamente. Não há migração, nova API, extração adicional, envio ou acesso ao banco. Validação: scripts/cv-review.test.mjs cobre escopo, campos, busca, transcrição preservada, origem arquivada/ausente, imutabilidade e 5.000 perfis.

## Revisão da experiência visual e uso em telas pequenas

Navegação agrupada em Sua rotina, Recrutamento e Banco de talentos. Contas com perfis ou processos iniciados entram no acompanhamento; espaços novos mantêm a criação de vaga inicial. Um atalho de importação fica no cabeçalho. No celular, Início, Talentos, Agenda e Menu ficam acessíveis em uma barra inferior com espaço reservado e safe area. O menu completo continua disponível, fecha ao escolher uma página e tem controle interno de fechamento.

A busca por texto continua visível, enquanto cidade, experiência, pendências e evidências ficam em Mais filtros, com contador de filtros ativos mesmo quando fechado. Seleções e limites de comparação são preservados. Cabeçalhos mais compactos, campos e botões adequados ao toque, quebra de textos longos, cartões ajustados e janelas adaptadas reduzem deslocamentos e cortes. O perfil usa uma janela mais larga no computador e um seletor de seção no celular, mantendo as mesmas abas e controles existentes. Há atalho de teclado para pular ao conteúdo e foco visível. Calendário e funil mantêm rolagem horizontal dentro de suas próprias áreas. Não há nova API, mudança de dados, consumo adicional de IA ou envio.
Ações em lote ficam recolhidas inicialmente e se abrem quando há perfis selecionados. A seleção continua limitada à vaga e aos filtros; recolher o painel não altera os registros.

Na tela de vagas, as três etapas têm indicação acessível da etapa atual e orientação para o próximo passo. Cliente e condições ficam recolhidos; os botões de salvar aparecem junto dos respectivos campos. As condições preservam o texto livre e os controles existentes. A busca distingue base vazia de filtros sem resultados e oferece a ação correspondente. Não há gravação ao expandir esses detalhes.

Cartões de candidatos destacam pendências de contato e interesse, recolhem datas e confirmações e diferenciam trechos ainda não comparados das evidências de uma comparação. Contato abre diretamente a seção existente do perfil, sem enviar mensagens ou alterar registros. Ações têm nomes acessíveis com o nome do candidato e áreas de toque adaptadas ao celular.

## Comparação lado a lado

Lista de interesse permite escolher de dois a três perfis da mesma vaga para revisão lado a lado. A seleção é temporária, preserva a ordem de escolha e é reiniciada ao trocar a vaga. Busca e páginas de 24 permitem localizar perfis em listas grandes; filtrar não retira os escolhidos, e remover alguém da lista invalida sua participação na comparação.

A tabela reúne cidade informada, etapa, interesse, disponibilidade, situação do parecer e critérios atuais com trechos, explicações e perguntas já salvos. Ausência de análise aparece como Ainda não comparado; ausência de trecho fica A confirmar. Condições e características de entrevista continuam A confirmar mesmo quando a análise contém uma menção. Não há pontuação, ordenação por contratação, nova chamada à IA, alteração de dados, impressão ou compartilhamento externo. Abrir perfil mantém o contexto da vaga. Textos são renderizados literalmente. No celular, somente a tabela tem rolagem horizontal.

## Diretório de vagas

O menu Vagas abre uma visão de todas as oportunidades com busca por nome e cliente, filtro por etapa de preparação e ordenação por nome ou atualização registrada. Páginas de 12 cartões reúnem pessoas acompanhadas, lista de interesse, pareceres salvos sem revisão pendente e pareceres a revisar. Participações são únicas dentro de cada vaga e excluem candidatos ausentes ou unificados. Análises e registros entram na contagem sem inscrever toda a base. Clientes arquivados permanecem identificados nas vagas vinculadas.

Retomar vaga, Ver funil e Lista de interesse preservam a vaga escolhida. O editor oferece Ver todas as vagas. A etapa de preparação é distinta da etapa dos candidatos e não indica vaga encerrada, entrega ou contratação. Não há arquivamento de vaga, alteração de registros, chamada de IA ou migração. Esta melhoria faz parte do pacote de atualização de 12 de outubro de 2026.

## Histórico consolidado do candidato

A aba Histórico no perfil reúne entrada na base, alterações e confirmações do cadastro, declaração incorporada e eventos salvos nas vagas existentes. A visão é privada, somente leitura, restrita ao candidato ativo e independente da vaga atualmente aberta. Busca textual sem distinção de acentos e filtro de origem se combinam, com ordem crescente/decrescente e páginas de 25. Datas inválidas são mantidas ao final e identificadas; horários são de Brasília. As confirmações mostram os campos e o método, sem copiar valores antigos de contato. Agendamentos futuros não viram eventos fictícios.

Edições não salvas ficam fora da linha do tempo; a nova aba não navega para outra vaga, grava, envia ou chama IA. Históricos originais de perfis unificados continuam em Revisar duplicados. Não é um log imutável nem comprovação de envio/recebimento: mostra somente os registros disponíveis. Esta melhoria faz parte do pacote de atualização de 12 de outubro de 2026.

## Modo entrevista

Na aba Entrevista, Entrar no modo entrevista apresenta uma pergunta atual por vez com os mesmos campos editáveis do roteiro completo. Anterior, Próxima, seletor de pergunta e Próxima sem resposta permitem conduzir a conversa; o último busca adiante e depois retorna ao começo, sem selecionar novamente a pergunta atual. Digitar uma resposta não muda a pergunta automaticamente. O progresso conta somente respostas não vazias dos critérios atuais e da conversa geral, sem tratar observações como respostas.

Critérios alterados/removidos ficam preservados na visão completa e não entram na sequência atual. Trocar o modo ou a pergunta preserva o mesmo rascunho. Salvar roteiro e respostas continua usando a ação existente, com indicação de alterações não salvas e botão visível durante a rolagem. Não há autosave, conclusão automática da entrevista, mudança de etapa, confirmação de interesse ou nova chamada de IA. Esta melhoria faz parte do pacote de atualização de 12 de outubro de 2026.

## Revisão das fontes dos pareceres — pacote local

Cada parecer revisado passa a registrar um resumo SHA-256 das fontes atuais e a data da conferência humana. O resumo cobre texto do parecer, briefing, título, critérios e importância, condições, cliente, dados do perfil, evidências daquele candidato, interesse, disponibilidade, notas e perguntas/respostas da entrevista. Não armazena uma cópia adicional do currículo. Chaves de objetos são ordenadas antes do cálculo para preservar o resultado após a gravação em JSONB.

O servidor verifica a correspondência em toda leitura do espaço, incluindo impressão privada e apresentação ao cliente. Fontes alteradas ou um parecer antigo sem revisão registrada exigem conferência, preservando o texto. Somente a ação explícita Salvar parecer revisado registra uma nova conferência para o vínculo candidato/vaga escolhido; salvamentos de contato, agenda, convite e outros registros não liberam um parecer pendente. A API ignora metadados de revisão enviados pelo navegador, conserva os anteriores e usa a versão do espaço para rejeitar conflitos.

Alterar o briefing ou os critérios sinaliza a revisão também na interface. O download de texto e a impressão exigem parecer revisado e salvo, sem alterações pendentes de contato/notas. A data da última revisão aparece no perfil e na lista de pareceres. Agenda, lembretes, lista de interesse, datas operacionais e análises de outros candidatos não são fontes do parecer.

Esta conferência não determina contratação, não comprova veracidade das informações e não constitui trilha imutável de auditoria. Não altera permissões, RLS ou funções SQL e não exige migração. Documentos baixados anteriormente continuam fora do controle da aplicação. Os nove testes novos cobrem legado, mudanças de fontes, aprovação restrita, metadados indevidos, validação na leitura, compatibilidade JSONB e bloqueio de apresentação. A melhoria está preparada localmente e ainda não foi publicada.

### Cadastro manual e currículo posterior (local)
Na janela Adicionar candidatos, Cadastrar sem currículo exige apenas o nome. Telefone, e-mail, cidade, cargo e experiências são opcionais. Cadastro manual sem fonte de CV aparece como Currículo pendente. Na aba Currículo, envie PDF até 2 MB ou selecione um já importado e revise os campos antes de confirmar que é a mesma pessoa. A leitura usa o acesso Claude existente; a vinculação usa a transação de união já instalada, preservando ID, notas, entrevistas, fontes anteriores e contatos confirmados mantidos. Pareceres são sinalizados para revisão e análises anteriores precisam ser refeitas. Se a revisão for interrompida, o PDF permanece separado na base e pode ser selecionado para retomar. Não há nova migração.

### Jornada da vaga e decisão do cliente
O Painel da vaga reúne situação da oportunidade, pessoas, pendências e atalhos. Situações de vaga são independentes das três etapas de preparação do briefing; fechar uma vaga preserva registros e agendamentos. A aba Conclusão registra avaliação humana por critério e exemplos, sem nota automática ou avanço de etapa. A assinatura das fontes sinaliza revisão após mudanças de CV, critérios ou respostas, e a conclusão entra no rascunho do parecer. Processo e cliente registra apresentação, decisão, proposta e desfecho, com data de Brasília, canal, pessoa contatada e retorno previsto. Cada apresentação guarda o texto do parecer usado. Proposta aceita e contratação confirmada são distintas. Devolutivas são rascunhos revisáveis e envio manual, registrado explicitamente. Registros antigos de Selecionado não são convertidos em aprovações; pedem esclarecimento e mantêm lembretes. Apenas Encerrado, Contratado e Não contatar deixam a lista de contatos pendentes. As etapas do cliente são alteradas por registro dedicado, não por arrastar cartões. A API /api/journey usa autenticação, validação, limite de requisições, origem e versão do espaço; campos específicos são preservados em salvamentos comuns. Não há nova migração: campos adicionais ficam nos JSONB existentes. Limites: 30 critérios de avaliação, 20 registros de apresentação/retorno por candidato e vaga, 100 mudanças de situação da vaga; conflitos e limites são mostrados sem truncar históricos.

Verificação desta implementação: 180 testes aprovados, lint, tipos e build aprovados; API local bloqueia gravações anônimas e de outras origens; permissão da função save_workspace conferida no Supabase. Telas reais foram renderizadas localmente com dados fictícios para inspeção de desktop e celular. Isso não substitui o teste autenticado completo de gravação e recarga no piloto após publicar.

### Conclusão da triagem e validação do percurso (local)
A aba Triagem registra decisão humana por candidato e vaga, motivo, próxima ação e data opcional. As decisões são Avançar, Investigar melhor e Não seguir nesta vaga; salvar preserva a etapa e não envia mensagens. Há confirmação explícita, histórico de até 30 revisões e assinatura das fontes para detectar mudanças de perfil, critérios, condições e evidências. A triagem aparece no parecer e no painel das próximas ações. Salvamentos comuns preservam metadados e histórico da triagem. Formulários aceitam os dados retornados pelo servidor após salvar entrevista, convites, agenda, lembretes e cadastro, evitando bloqueios falsos e preservando notas em edição. Contratação confirmada deixa de pedir um novo retorno do cliente. Veja FLOW-VALIDATION-2026-10-14.md para o cenário fictício validado em produção e seus limites.

### Checklist do briefing
Cada vaga pode registrar quantidade de posições, prazo de apresentação, responsável pela decisão do cliente e pendências internas. O checklist considera oito campos estruturados e distingue preenchimento de confirmação. Os acordos usam o salvamento versionado existente, não alteram critérios nem análises e não são incluídos em links para candidatos ou no parecer. O painel mostra o prazo em Brasília; vagas preenchidas ou canceladas não recebem alerta de atraso. Campos opcionais preservam a compatibilidade com vagas anteriores.
### Verificações automatizadas
Execute `npm run test:agent` para a bateria local completa. Ela combina os testes de regras com navegação em computador/celular e verificações HTTP locais. Relatórios, limites de cobertura e o roteiro de exploração assistida estão em [tests/README.md](tests/README.md). A interface usa dados e serviços fictícios; as integrações reais com Supabase/Claude exigem homologação separada. O workflow do GitHub foi ampliado, mas não configura bloqueio de deployment na Vercel.
### Equipe de agentes
O trabalho entre Produto/UX, Engenharia e QA é coordenado pelas instruções em [AGENTS.md](AGENTS.md). Os [perfis e o protocolo de colaboração](docs/agents/README.md) definem entregas, divisão de arquivos, revisão independente e evidências. Os agentes são iniciados por tarefa conforme a necessidade; não executam como serviços contínuos dentro da Talentia.
