# Jornada da recrutadora — Talentia

Análise de produto em 13/10/2026, baseada nos componentes e regras atuais do repositório. Não é uma nova execução de todos os fluxos com candidatos reais. Nenhuma funcionalidade ou dado de produção foi alterado nesta análise.

## Escopo confirmado

A recrutadora recebe a demanda, encontra e avalia candidatos, recomenda ao cliente e acompanha o retorno. O cliente decide a contratação e conduz a proposta. A Talentia precisa registrar esses resultados sem assumir funções de folha, admissão ou onboarding.

## Etapas e cobertura

| Fase | Trabalho da recrutadora e resultado esperado | Cobertura atual | Lacuna |
| --- | --- | --- | --- |
| 1. Alinhar a demanda | Entender motivo da vaga, entregas esperadas, condições, prazo e quem decide. Resultado: briefing acordado. | Texto livre, condições (local, modalidade, remuneração, jornada, benefícios, início), cliente vinculado e rascunho. | Checklist de informações pendentes, quantidade de posições, prazo de apresentação, interlocutor decisor e registro de alinhamento com cliente. Essas informações podem ser anotadas em texto, mas não são acompanhadas de forma estruturada. |
| 2. Definir a avaliação | Separar experiências obrigatórias, diferenciais, condições e competências avaliadas em conversa. Resultado: critérios revisados e modo de verificar cada um. | Organização com IA, edição humana, prioridades e tipos de critério. | Definição explícita do que constitui evidência suficiente e de atividades práticas quando fizerem sentido. Não inferir comportamento ou personalidade pelo CV. |
| 3. Encontrar pessoas | Buscar na base e incluir indicados ou candidatos novos. Resultado: grupo de perfis para investigar. | PDFs em lote, cadastro manual sem CV, PDF posterior, filtros, busca assistida, buscas salvas, conferência e duplicados. | Captação fora da base ocorre por canais externos; não há divulgação de vaga ou formulário simples de candidatura. Integrações não são requisito para o piloto. Operação completa com 5 mil CVs ainda precisa de medição, além dos testes de busca. |
| 4. Fazer triagem documental | Comparar experiências com critérios e identificar pontos a confirmar. Resultado: lista inicial de possíveis candidatos. | Evidências literais, comparação, lista de interesse e comparação lado a lado de 2–3 perfis. | Conclusão explícita da triagem com justificativa e próxima ação. Trecho encontrado não comprova interesse, atualidade dos dados ou competência comportamental. |
| 5. Confirmar interesse e viabilidade | Apresentar condições, verificar contatos, localização, disponibilidade e interesse. Resultado: pessoa interessada e pontos negociáveis esclarecidos. | Rascunhos, contato manual, notas, confirmação de dados, lembretes e link individual sem cadastro com revisão humana. | Comunicação continua fora do app. Falta resumo estruturado de pré-triagem: condições aceitas, dúvidas e pendências por critério. Tempo sem resposta não significa reprovação. |
| 6. Entrevistar e avaliar | Agendar, perguntar, registrar exemplos e concluir avaliação. Resultado: fundamentos para recomendar ou não avançar. | Agenda semanal, conflitos, ICS, convites, roteiro por critério, respostas, observações e modo de uma pergunta por vez. | Ficha conclusiva por critério (demonstrado, parcialmente demonstrado, não demonstrado, ainda não avaliado), com exemplo e recomendação humana. Não há avaliações independentes por rodada nem ficha específica de atividade prática. Proteção contra perda de rascunhos ao fechar ainda merece trabalho. |
| 7. Recomendar ao cliente | Preparar parecer, destacar fundamentos e ressalvas, entregar um ou mais perfis. Resultado: recomendação apresentada. | Parecer editável, revisão vinculada às fontes, PDF e apresentação de perfis com parecer revisado. | Registro de apresentação: destinatário, data, versão entregue e retorno previsto. Produzir PDF não comprova que ele foi enviado. |
| 8. Acompanhar a decisão | Registrar perguntas, entrevista com cliente, aprovação ou recusa e motivo. Resultado: decisão do cliente documentada. | Notas, agenda, histórico e etapas genéricas podem guardar informações manualmente. | Faltam etapas e registros dedicados de apresentado ao cliente, aguardando decisão e aprovado pelo cliente. A etapa Selecionado é ambígua e exclui lembretes de contato. |
| 9. Registrar desfecho | Acompanhar resultado da proposta feita pelo cliente, comunicar demais participantes e encerrar a vaga. Resultado: processo concluído e base reaproveitável. | Encerrado por candidato, motivos no funil, histórico e base persistente. | Não distingue proposta aceita, recusada, desistência e contratação confirmada. A vaga não tem estado próprio de aberta, pausada, preenchida ou cancelada, com datas e motivo. Faltam rascunhos específicos de devolutiva e indicador de comunicação registrada. |

## Três conceitos separados

1. **Situação da vaga:** rascunho, aberta, pausada, preenchida, cancelada. Hoje `Job.stage` representa somente as três etapas de preparação.
2. **Etapa do candidato naquela vaga:** triagem, conversa, entrevista, recomendação, decisão do cliente e resultado. A base de talentos permanece independente.
3. **Próxima ação:** falar com pessoa, conferir condição, entrevistar, preparar parecer ou cobrar retorno do cliente; com prazo e responsável quando necessário. Agendar uma atividade não comprova sua conclusão.

Não bloquear todos os movimentos com requisitos universais: processos variam. Pendências devem ser visíveis e desvios deliberados devem poder ser justificados pela recrutadora.

## Exemplo da loja conceito

O briefing precisa explicar a missão de ser uma loja modelo para expansão. Experiência em hospitalidade e varejo é investigada nos CVs e na conversa. Jornada 6x1, local na Paulista, remuneração e início são condições a confirmar. Curiosidade, colaboração e qualidade de atendimento exigem exemplos ou uma atividade relevante, como apresentar um produto após receber uma explicação breve. A atividade deve ser opcional por vaga, avaliada pela pessoa recrutadora e registrada por critérios claros; não é uma classificação automática de personalidade.

## Ordem recomendada

1. Definir os estados de vaga, candidato e decisão do cliente, incluindo datas e próximos passos. Corrigir a ambiguidade de Selecionado antes de ampliar automações.
2. Fechar a entrevista com avaliação humana por critério, sem confundir evidência documental com resposta ou observação.
3. Registrar entrega e retorno do cliente, aceitação/recusa informada da proposta, desfecho e devolutivas; proposta continua sob responsabilidade do cliente.
4. Consolidar essas informações em um painel da vaga com pendências e atalhos, aproveitando as telas existentes.
5. Fortalecer briefing e modelos reutilizáveis; validar com um processo real da madrinha antes de investir em captação e integrações.

## Critério de validação com a madrinha

Percorrer uma vaga fictícia sem contatar pessoas reais: receber briefing, criar perfil manual, anexar CV de teste, revisar critérios, encontrar evidências, registrar interesse, agendar e registrar entrevista, concluir avaliação, preparar parecer, registrar apresentação, simular retorno do cliente e encerrar. Em cada transição perguntar: qual decisão foi tomada, com base em quê, o que falta e qual é a próxima ação? Só considerar cobertura completa quando esses resultados puderem ser registrados e retomados com clareza.

## Referências externas

- Greenhouse: alinhamento inicial, critérios, entrevistas e decisão fundamentada: https://support.greenhouse.io/hc/en-us/articles/360039539772-Structured-hiring-guide
- Workable: separar fases do funil de tarefas operacionais e distinguir oferta de contratação: https://help.workable.com/hc/en-us/articles/4413312707991-Recruiting-pipeline-best-practices
- Workable: comunicação e próximos passos para candidatos: https://help.workable.com/hc/en-us/articles/360051722034-Best-Practices-Create-an-Amazing-Candidate-Experience

Referências ajudam a organizar a análise; não determinam o fluxo específico da madrinha. As lacunas descritas são conclusões da inspeção do projeto, não afirmações dos fornecedores sobre a Talentia.
