# Verificações da Talentia

Execute `npm run test:agent` para verificar tipos, lint, testes das regras, compilação, chaves no cliente, HTTP local e fluxos de navegador. A primeira execução requer `npx playwright install chromium`. No Linux, use `npx playwright install --with-deps chromium`.

## O que existe

- `scripts/*.test.mjs`: regras de negócio, segurança e limites.
- `npm run test:http`: inicia o Next compilado em `127.0.0.1:4174`, com configuração fictícia e sem credenciais herdadas. Testa páginas, cabeçalhos e bloqueios reais das APIs sem autenticação. Não testa RLS nem autenticação de uma conta real.
- `npm run test:browser`: abre os componentes reais da aplicação em uma galeria Vite separada, em `127.0.0.1:4173`. Executa os mesmos cenários no Chromium de computador e em viewport de celular. Celular aqui é emulação Chromium, não Safari/iPhone nem aparelho físico.
- `npm run test:report`: abre o relatório do navegador. Falhas incluem captura da tela, contexto e trace. O resumo da execução completa fica em `outputs/test-agent/last-run.json`.
- `EXPLORATORY-AGENT.md`: instruções para uma sessão exploratória assistida por IA. Não há agendamento nem consumo automático de Claude.

O alvo de navegador é fixo e local. Não configure URL de produção ou credenciais pessoais. A galeria não pertence às rotas Next e não cria acesso alternativo ao aplicativo publicado. A configuração Vite não carrega arquivos `.env`. Cada teste usa um workspace fictício independente, em memória; requisições externas e APIs não previstas são bloqueadas e fazem o teste falhar.

## Cobertura dos fluxos

Criação de vaga, organização de critérios e comparação determinística, cadastro sem CV, checklist do briefing, triagem com revisão humana, respostas e conclusão de entrevista, parecer revisado, registro de apresentação ao cliente, agenda em Brasília, validação local de anexos acima de 2 MB/extensão inválida, erros de rede, conflito de versão, largura no celular e proteção do rascunho de entrevista ao fechar.

`profile-drafts.spec.ts` cobre proteção dos rascunhos de Dados e Convite, confirmação isolada, detalhes sem mensagem, descarte, rascunhos simultâneos, sucesso/falha/conflito e resposta atrasada após reabrir a mesma pessoa. A fixture de edição usa o schema e a transformação de domínio reais com persistência simulada. A proteção de saída da página é verificada por evento `beforeunload` sintético; a confirmação nativa continua dependente do navegador. O atalho de currículos/históricos anteriores também participa da proteção.

Os fluxos de interface usam APIs simuladas com as mesmas funções de domínio, mas **não executam os handlers autenticados, o Supabase, o armazenamento de arquivos ou o Claude**. Salvar e recarregar nesses testes comprova persistência na simulação. Não comprova persistência no banco real. O roteamento de `next/link` é representado por links HTML na galeria.

Ainda exigem um ambiente de homologação e conta dedicados: login/recuperação completos, isolamento entre duas contas via RLS, PDF válido até armazenamento e extração, processamento assíncrono e tentativas, integração Claude, geração/abertura de relatórios PDF e links públicos de atualização. Não usar uma conta de recrutadora real para preencher essa lacuna.

## Integração no GitHub

### Permissões do banco

`supabase/tests/table-privileges.sql` verifica somente catálogos: rejeita TRUNCATE/REFERENCES/TRIGGER para anon e authenticated em tabelas públicas, exige as operações normais de importação, RLS ativo e acesso correto à RPC de conclusão. Execute no banco alvo após migrações de tabelas ou grants, por uma conexão administrativa autorizada. Não executa TRUNCATE, não lê candidatos e não altera dados. O teste falha por exceção se encontrar permissões indevidas; sucesso pode retornar uma lista vazia.

Este teste SQL não integra `npm run test:agent` nem o CI atual, que não recebe credenciais de banco. Ele detecta reincidências quando executado; não bloqueia automaticamente novas migrações.

`supabase/tests/discarded-applications.sql` cria duas contas e candidaturas exclusivamente fictícias em uma transação com rollback. Verifica descarte dos dados/arquivo, isolamento, decisão inválida, preservação dos dados aceitos, restrição contra reintroduzir dados na linha descartada e novo envio após descarte. Execute o arquivo inteiro, incluindo BEGIN/ROLLBACK, em ambiente autorizado. Não usa workspace ou currículo existente. O teste de navegador correspondente usa APIs simuladas e valida a confirmação/cancelamento; não substitui o SQL.

O workflow `Application checks` executa a bateria em pushes e pull requests e guarda os relatórios por 7 dias. Não recebe segredos de produção. A configuração só passa a valer depois de commit e push.

Um check vermelho sinaliza uma falha; **não bloqueia sozinho o deploy automático da Vercel**. Exigir esse check no GitHub e vincular verificações de deployment na Vercel são configurações externas ainda não aplicadas. Não há publicação, rollback ou correção automática pelo executor.

## Primeiro defeito encontrado

Em 15/10/2026, o cenário `interview draft` falhou antes da correção: preencher uma resposta e fechar o perfil descartava o rascunho sem aviso. A entrevista agora participa da proteção de alterações não salvas ao fechar ou abrir outro perfil. Um aviso de saída também protege entrevista, contato, parecer e decisões pendentes ao sair da página, conforme o suporte do navegador. Isso não é salvamento automático nem recuperação após travamento.
