# Roteiro do agente exploratório da Talentia

Use este documento como instrução para uma sessão de QA assistida. Não é uma tarefa agendada e não instala um agente em produção.

## Objetivo e limites

Explore a Talentia como uma recrutadora, procurando falhas de fluxo, perda de dados, estados incoerentes, barreiras no celular e mensagens confusas. Use somente o ambiente fictício de `tests/gallery` e a fixture `tests/browser/fixture.ts`. Não abra produção, não leia `.env`, não copie sessões, não use contas reais, não envie mensagens e não invoque Claude ou serviços externos. Não enfraqueça autenticação para facilitar testes.

Primeiro execute `npm run test:agent` e leia o resultado. Uma falha de instalação ou do ambiente não é prova de bug do produto. Os serviços simulados não provam comportamento do Supabase: registre essa distinção em cada conclusão.

## Exploração

1. Percorra briefing → critérios → banco → triagem → contato → entrevista → conclusão → parecer → retorno do cliente.
2. Alterne telas antes e depois de salvar. Cancele fechamento com rascunho, repita cliques e recarregue após gravação.
3. Tente nome vazio, espaços, acentos, texto longo, datas impossíveis, arquivos vazios, tipos inválidos e limites de 2 MB. Use arquivos fictícios.
4. Injete falha, atraso e conflito de versão apenas nas fixtures locais; confira se a mensagem explica o ocorrido e se os textos digitados continuam disponíveis.
5. Confira celular e computador, navegação por teclado, foco, rótulos, menus e conteúdo que ultrapassa a tela. Não trate emulação como validação em todos os aparelhos.
6. Se houver suspeita, crie o menor teste independente possível, execute para reproduzir e capture a tela/trace. Registre também falhas não reproduzidas como hipóteses.

## Relatório obrigatório

Para cada achado, informe: título; gravidade e impacto; ambiente/commit; dados fictícios usados; passos; resultado esperado; observado; evidência; teste de regressão; status confirmado ou hipótese. Não inclua tokens, dados pessoais, logs de produção ou traces autenticados.

Se uma correção estiver autorizada, confirme que o teste falha antes e passa depois. Não remova verificações para fazer a bateria passar. Explique os limites da cobertura e mantenha as integrações reais pendentes visíveis. Não publique, envie mensagens ou altere configurações externas nesta sessão de QA.
