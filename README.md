# Talentia

Assistente de recrutamento com briefing livre por vaga, currículos privados, evidências, acompanhamento de contatos e parecer editável. Next.js + Supabase + Claude, preparado para Vercel.

## Desenvolvimento

Copie `.env.example` para `.env.local` e preencha os valores no seu computador, sem versionar segredos. Instale com `npm ci`, execute com `npm run dev`. Verifique com `npm run typecheck`, `npm run lint` e `npm run build`.

O piloto está publicado em [talentia-two.vercel.app](https://talentia-two.vercel.app), com Supabase, e-mails de confirmação e Claude configurados. O código está no [GitHub](https://github.com/LuccasPL/Talentia). Importação de PDF, critérios, comparação e parecer foram validados em produção com um perfil fictício na conta autorizada do proprietário. Consulte [DEPLOYMENT.md](DEPLOYMENT.md) para os resultados, limites do piloto e autorização de outras contas.

## Sincronização com o computador

A pasta `talentia` já é o repositório local, ligado ao GitHub como `origin`, com `main` acompanhando `origin/main`. Não precisa clonar novamente neste computador.

Antes de trabalhar em outro computador, clone `https://github.com/LuccasPL/Talentia.git`. Antes de começar novas alterações, use `git pull --ff-only`. Para enviar alterações revisadas, faça um commit e use `git push`. O Git não envia automaticamente cada arquivo salvo. Não versione `.env.local`, credenciais nem currículos.
