# Revisão piloto — rascunhos de Dados e Convite

Data: 15/10/2026. Referência: `e64c4195573f8491553f1e88d84ecd8f96e35086`.
Estado: revisão concluída; implementação e reprodução no navegador pendentes.

## Colaboração realizada

Três subagentes reais receberam responsabilidades separadas e trocaram questões nesta sessão. Produto/UX descreveu o impacto e o aceite; Engenharia rastreou o estado dos componentes e propôs a integração; QA conferiu os limites e lacunas dos testes independentemente. O coordenador leu as entregas e conferiu diretamente os trechos centrais.

Produto acrescentou que apenas marcar uma confirmação de contato ou editar detalhes de convite sem gerar a mensagem também constitui trabalho a proteger. Engenharia incorporou os casos e destacou a remontagem do editor após salvar. QA confirmou que a fixture ainda não suporta o endpoint de edição de Dados e que retorno genérico de sucesso seria uma falsa validação.

## Achado

**Indício de alta prioridade por perda de trabalho; lacuna confirmada por código, sem reprodução visual nesta revisão.**

- `app/candidate-editor.tsx:9` não recebe `onDirty`; a linha 12 calcula alterações e confirmações apenas localmente.
- `app/interview-invitation.tsx:8` não recebe `onDirty`; a linha 11 compara o rascunho com o snapshot salvo.
- `app/workspace.tsx:74` registra somente triagem, avaliação, processo e entrevista no agregador de rascunhos. A linha 110 usa esse agregador ao abrir outro perfil. Fechamento e `beforeunload` também não recebem o estado dos dois formulários.
- As seções usam `forceMount`: alternar abas mantém seus rascunhos, mas não garante proteção ao desmontar o perfil ou sair da página.

Impacto esperado: alterações cadastrais, marcações de confirmação e textos de convite podem ser descartados sem aviso quando forem as únicas alterações pendentes.

## Direção acordada

Reutilizar o contrato `onDirty` da entrevista, com estados separados para Dados e Convite. Considerá-los nas saídas existentes. Salvar limpa somente a seção correspondente; falhas mantêm os textos e o aviso. Não introduzir autosave, dados pessoais em armazenamento local, envio de mensagens ou mudanças de banco nesta correção.

## Aceite a verificar

| Critério | Verificação planejada |
| --- | --- |
| Dados editados ou confirmação isolada | Fechar e cancelar mantém campos, marcações e método. |
| Convite com detalhes apenas ou mensagem preparada | Gerar/copiar não equivale a salvar; a saída deve avisar. |
| Alternância de seções | Mantém rascunhos simultâneos. |
| Botão, Escape e área externa | Mesma proteção de fechamento, com cancelar e descartar. |
| Troca de pessoa/contexto | Cancelar conserva o contexto; descartar não transfere texto para outro perfil. |
| Saída da página | Aviso nativo quando suportado, sem promessa de recuperação após travamento. |
| Sucesso de salvamento | Limpa apenas a seção salva; reabertura mostra o estado persistido no ambiente testado. |
| Falha/conflito | Mantém conteúdo e permite nova tentativa; não limpa a proteção. |
| Estado sem alterações | Não mostra confirmação indevida; a proteção da entrevista continua funcionando. |

Pré-requisito de teste: estender a fixture com o contrato real de `PATCH /api/candidates` e dados fictícios adequados para confirmação. Testar remontagem após `editedAt` mudar. Distinguir persistência simulada da escrita no banco real.

## Parecer e limites

O coordenador aceita a proposta como próxima melhoria delimitada. Isso não equivale a declarar o bug reproduzido ou corrigido. Nenhum agente executou uma nova bateria, editou a aplicação, alterou produção ou fez publicação nesta revisão. As instruções e os perfis foram preparados localmente; não houve registro de agentes como serviços contínuos.
