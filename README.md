# ASCENSÃO — Ficha RPG com GitHub Pages + Supabase

Projeto pronto para deploy estático no GitHub Pages usando HTML, CSS e JavaScript Vanilla.

## Estrutura

```text
/
├── index.html          # Ficha original integrada ao Supabase
├── login.html          # Login/cadastro por e-mail e senha
├── mestre.html         # Painel exclusivo do mestre
├── config.js           # URL e ANON KEY do Supabase
├── assets/
│   └── ASCENSAO.html   # Material original de referência
├── css/
│   └── app.css
├── js/
│   ├── login.js
│   ├── master.js
│   ├── npc-engine.js
│   ├── sheet-app.js
│   ├── sheet-storage.js
│   └── supabaseClient.js
└── supabase/
    └── schema.sql
```

## Instalação

1. Crie um projeto no Supabase.
2. No SQL Editor, execute `supabase/schema.sql`.
3. Cadastre seu usuário pela página `login.html`.
4. Promova seu usuário para mestre:
   ```sql
   update public.perfis
      set tipo = 'mestre'
    where user_id = 'SEU_UUID_DE_AUTH_USERS';
   ```
5. Em `config.js`, cole:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
6. Envie os arquivos para o GitHub Pages.

## Recursos implementados

- Supabase Auth por e-mail e senha.
- Perfis `jogador` e `mestre`.
- Jogador vê/salva apenas suas fichas.
- Mestre vê todas as fichas, histórico, versões e dados secretos.
- Exportador/importador universal por IDs de `input`, `textarea`, `select` e `checkbox`.
- Autosave a cada 30 segundos.
- Snapshot automático no histórico a cada salvamento.
- Restauração de versões anteriores pelo painel mestre.
- Visualização real da ficha para mestre, com modo somente leitura e edição forçada.
- NPC_ENGINE procedural local: NPCs, grupos, bosses, banco de NPCs, edição, exclusão, duplicação e conversão NPC ⇄ personagem.
- Exportação JSON e impressão/PDF.

## Observações

- Não use `service_role` no `config.js`; GitHub Pages é público.
- Para login imediato sem e-mail de confirmação, ajuste Auth → Providers → Email no Supabase e desative confirmação de e-mail, se essa for a preferência da mesa.
- O sistema de NPCs não depende de APIs externas.
