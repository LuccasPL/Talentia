# Confirmação da limpeza de PDFs — 17/10/2026

Pedido: continuar a correção identificada ao revisar a exclusão de candidatos. Base `6c47dbd`, preservando a proteção de exclusão de batches ainda não commitada. Trabalho executado pelo agente principal, sem nova delegação.

## Problema

`sweepFiles` processava até 100 arquivos, ignorava erro ao retirar os itens da fila e retornava zero sem contar o restante. Uma falha de leitura retornava -1, mas PATCH convertia isso em zero com `Math.max`. A mensagem de POST também prometia que o arquivo seria apagado na próxima tentativa, sem garantia. Achados por leitura do código; não foram induzidos erros no Storage real.

## Correção

- `lib/file-cleanup-workflow.ts` separa os resultados em concluído (zero confirmado), pendente (contagem positiva) e não confirmado (contagem desconhecida).
- Processa no máximo 100 itens por chamada e consulta a contagem total depois da remoção e confirmação da fila. A fila é ordenada por criação e caminho para processar os mais antigos primeiro.
- Só retira itens da fila após sucesso do Storage. Falha na leitura, remoção, confirmação ou contagem retorna estado desconhecido; exceções de transporte também são tratadas.
- Caminhos inválidos ou de outra conta não geram remoção nem confirmação falsa. As consultas, contagem e remoção de itens da fila mantêm o filtro de proprietário e a sessão existente.
- POST continua informando a exclusão já concluída do perfil, mas avisa quando a limpeza de PDFs está pendente ou não foi confirmada, sem prometer sucesso futuro.
- PATCH responde 503, `pending: null` e `complete: false` quando não consegue confirmar. Para resultado conhecido, retorna 200 com contagem e indicador de conclusão. Ambas as respostas usam `no-store`.
- GET do workspace continua tolerando falhas da limpeza e carregando o espaço. Não houve alteração visual ou nova rotina em segundo plano.

## Evidências

`scripts/file-cleanup.test.mjs` acrescenta sete testes: 125 arquivos em dois lotes; falhas de leitura/remoção; falha ao desenfileirar e nova tentativa idempotente; erro de contagem e exceções; fila vazia com contagem posterior; caminho de outra conta e contagens inválidas; respostas HTTP e avisos. São adaptadores fictícios de armazenamento/fila, sem rede ou dados reais.

Os sete testes, mais os três de exclusão de candidato e seis de integridade de batches, passaram: 16 no total. Não houve execução da fila real, exclusão de PDF real, chamada à Anthropic ou mudança no banco.

TypeScript e lint dos três arquivos desta correção passaram. A bateria visual e o build completo não foram repetidos para esta alteração restrita ao fluxo de limpeza.

## Limites e situação

Resultado concluído representa a contagem no momento da verificação; novos itens podem entrar depois. A integração Supabase/Storage não foi exercitada com objetos reais nesta rodada. A rotina ainda depende de acesso ao espaço ou tentativa explícita para avançar a fila. Não é eliminação de backups ou downloads externos, e não resolve concorrência com reimportação do mesmo caminho.

Alterações locais, sem commit/push/deploy. Nenhuma migração ou nova dependência. A proteção de batches da entrega anterior também continua aguardando publicação.
