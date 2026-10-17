# Integridade da exclusão de resultados da IA — 17/10/2026

## Retomada e escopo

Base `6c47dbd`, checkout inicialmente limpo. Lidos os registros da outra LLM sobre gateway público, exclusão de candidato e retenção automática. Esses trabalhos já estão no Git e não foram refeitos. O commit anterior `aa06442` consta como ancestral do estado atual.

Consulta somente de metadados confirmou `talentia-retention` ativo e execuções bem-sucedidas em 16 e 17/10/2026 às 03:15 UTC (00:15 em Brasília), com todas as contagens zeradas. Não foi acionada retenção manualmente nem consultado conteúdo de candidatos.

## Achado e mudança

`deleteProviderBatches` aceitava IDs de batches retornados pelo banco e conferia apenas o formato. Como os metadados de importação são editáveis pelo proprietário, isso não comprova que o resultado no provedor pertence à conta. O acompanhamento em `syncImports` já conferia um HMAC; a exclusão não usava essa proteção. Achado estático, sem ataque ou exclusão real de terceiros demonstrados.

- `lib/import-batch-integrity.ts`: extrai o mesmo formato de assinatura existente, acrescenta conferência explícita do proprietário e caminho do arquivo e limita exclusões à interseção de IDs solicitados e provas válidas. IDs repetidos são processados uma única vez.
- `lib/import-server.ts`: reutiliza a validação no acompanhamento e na exclusão. Lê somente os metadados das importações ligadas aos IDs de candidatos ou arquivos do plano, sempre filtrando o proprietário. Preserva uma cópia em memória antes de a RPC apagar as linhas.
- `app/api/candidates/erase/route.ts`: captura essas provas antes de excluir. Se a consulta falhar, interrompe antes da RPC. Depois da exclusão local, resultados sem prova não geram chamada ao provedor e produzem aviso de pendência, sem promessa de prazo de expiração não confirmado.
- Sem alteração de schema, chave, modelo, política de retenção ou fluxo visual. Sem nova dependência.

## Validação e limites

- Nove testes de regras passaram: seis novos de assinatura/exclusão e três existentes de exclusão de candidato. Cobrem compatibilidade da assinatura antiga; alteração de dono, importação, PDF, candidato e batch; assinatura ausente/forjada; troca de chave; ausência de snapshot; deduplicação; erro do provedor. Callbacks fictícios confirmam que alvos não autorizados não recebem chamadas.
- Um revisor independente, com contexto curto e somente os arquivos afetados, não encontrou bloqueadores estáticos.
- TypeScript (`tsc --noEmit`), lint dos três arquivos alterados e `git diff --check` passaram. Não repetidos build e suíte de navegador: não houve mudança de interface ou dependências.
- Uma alteração concorrente entre leitura e exclusão pode deixar uma leitura da IA pendente; não autoriza apagar um batch arbitrário. Rotação da chave invalida provas antigas e requer tratamento operacional, como já ocorria no acompanhamento.
- Não foram feitas chamadas de exclusão à Anthropic nem removidos perfis/PDFs reais. Testes unitários não provam exclusão real no provedor.
- A revisão também identificou limitações da fila de arquivos (`sweepFiles` ignora erro ao desenfileirar e pode retornar zero apesar de itens além do lote de 100; PATCH converte falha de leitura em zero). Permanecem para correção separada; não confundir com esta proteção de batches.

## Situação

Correção local, sem commit/push/deploy nesta rodada. Precisa ser publicada para proteger o fluxo em produção. Não exige migração. Nenhuma criptografia adicional de dados em repouso foi implementada.
