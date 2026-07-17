# Tradedoc

App de diário de trading, conectado ao Supabase (autenticação real + banco de dados).

## Deploy sem instalar nada (GitHub + Vercel)

1. Crie conta em github.com (se não tiver)
2. Novo repositório → nome `tradedoc-app` → Create repository
3. Na tela do repositório vazio, clique em "uploading an existing file"
4. Arraste TODOS os arquivos desta pasta (mantendo a pasta `src`) e confirme o commit
5. Crie conta em vercel.com (pode entrar direto com GitHub)
6. Add New → Project → selecione o repositório `tradedoc-app` → Import
7. Em "Environment Variables", adicione:
   - `VITE_SUPABASE_URL` → cole a Project URL do seu Supabase
   - `VITE_SUPABASE_ANON_KEY` → cole a chave publicável (`sb_publishable_...`)
8. Clique em Deploy e aguarde ~1 minuto

Pronto — a Vercel te dá uma URL pública (ex: `tradedoc-app.vercel.app`) já funcionando.

## Importante no Supabase antes de testar

Vá em **Authentication → Settings** e decida se quer exigir confirmação por e-mail:
- Se deixar ligado, o usuário só consegue entrar depois de clicar no link enviado por e-mail
- Pra testar rápido sozinho, pode desativar temporariamente em "Confirm email"
