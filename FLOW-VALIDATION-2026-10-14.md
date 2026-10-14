# Validação do percurso — 14/10/2026

## Cenário

Sessão autenticada do piloto em produção. Foi criada uma vaga chamada **Validação técnica fictícia — jornada de recrutamento** e um perfil chamado **Pessoa fictícia — validação da jornada**, sem dados de uma pessoa real. A vaga foi encerrada como preenchida para simular o desfecho; o perfil ficou com contratação fictícia confirmada. Os registros foram preservados para conferir o histórico do teste. Nenhuma mensagem ou documento foi enviado a candidatos ou clientes.

## Verificado no navegador e no banco

1. Criar a vaga, preencher briefing fictício e organizar os critérios.
2. Cadastrar o perfil manualmente, com experiências fictícias e sem PDF.
3. Filtrar exatamente o perfil de teste e comparar somente esse perfil.
4. Salvar notas e disponibilidade de teste.
5. Preparar roteiro, registrar uma resposta fictícia e salvar.
6. Salvar a avaliação por critério e sua justificativa.
7. Preparar e salvar parecer, verificando a liberação da visualização para PDF.
8. Registrar apresentação fictícia, com texto do parecer preservado no histórico.
9. Registrar aceite fictício de proposta separado da contratação confirmada.
10. Encerrar a vaga como preenchida, recarregar a página e confirmar o estado, avaliação e três registros de apresentação/retorno.

Consulta direcionada exclusivamente ao candidato e à vaga de teste confirmou os dados persistidos: etapa Contratado, três eventos do cliente, entrevista, avaliação e parecer presentes, vaga preenchida.

## Problemas encontrados e corrigidos localmente

- Após salvar entrevista, o formulário atualizava apenas alguns campos. Os metadados calculados pelo servidor podiam divergir do estado local e produzir um falso aviso de alterações não salvas, bloqueando a conclusão. O teste publicado foi retomado salvando novamente Contato e notas. A correção local aceita os metadados devolvidos pelo servidor e preserva edições deliberadamente pendentes de contato; também cobre convites, agenda, lembretes e atualização cadastral.
- Uma contratação confirmada ainda gerava a pendência de definir retorno do cliente. A correção local exclui desfechos terminais dessa pendência, mantendo a devolutiva ao candidato.

## Conclusão da triagem implementada localmente

Nova aba Triagem: avançar, investigar melhor ou não seguir nesta vaga, com justificativa, próxima ação, data opcional e confirmação humana. Histórico preservado e assinatura das fontes para revisão após mudanças em perfil, briefing, condições, critérios ou evidências. Não confirma interesse e não altera etapas automaticamente; encerramento é uma ação separada no funil. Integração ao parecer e às pendências do painel, sem nova migração.

## Limites desta validação

O cenário usou cadastro sem PDF. Não foi uma nova validação de anexos, importação em lote, confirmação de dados por link, envio externo, exportação de PDF ou agendamento. A triagem e as duas correções locais ainda precisam de publicação para a conferência autenticada final. O teste não certifica todos os fluxos e dispositivos; os testes automatizados complementam o percurso observado.
