# Relatório prévio e plano de implementação — Ascensão

## 1. Arquivos alterados

- `index.html`
  - Interface principal, estado local `charState`, regras de cálculo, renderização de perícias/poderes/equipamentos, exportação e ponte `ASCENSAO_SHEET`.
- `css/app.css`
  - Ajustes finais responsivos carregados após o CSS inline, garantindo que a navegação mobile sobreponha regras antigas.
- `js/sheet-app.js`
  - Autosave Supabase imediato com debounce curto, mantendo o salvamento manual e o fallback periódico.
- `js/sheet-storage.js`
  - Resumo da ficha considera facção personalizada/nenhuma.

## 2. Motivo de cada alteração

- `index.html`
  - Barra inferior mobile por emojis, campos novos de facção, PX disponível manual, equipamentos personalizados, arquétipo personalizado, rolagem dinâmica das perícias, PDF oficial estruturado, correções de perícia até 0 e mapeamento de categoria de poderes.
- `css/app.css`
  - Como este arquivo é carregado depois do CSS inline, concentra overrides mobile críticos sem reescrever o desktop.
- `js/sheet-app.js`
  - O autosave anterior era por intervalo de 30 segundos. Foi adicionado debounce de 800 ms a cada input/change.
- `js/sheet-storage.js`
  - O painel/listagem usa `buildSheetSummary`; agora exibe corretamente “Outra” com nome personalizado ou “Nenhuma dessas”.

## 3. Possíveis impactos

- Mobile/tablet muda significativamente a navegação, mas somente em `max-width: 900px`.
- Desktop preserva a estrutura de abas superiores e layout geral.
- PX disponível manual afeta validações de compra enquanto o override estiver ativo; o botão “A” retorna ao cálculo automático.
- Arquétipo personalizado aplica bônus aditivos quando selecionado; arquétipos oficiais continuam usando a lógica antiga.

## 4. Compatibilidade com fichas antigas

- Nenhuma propriedade existente foi renomeada.
- IDs existentes foram preservados.
- Novos campos são aditivos: `factionOtherName`, `factionLore`, `customEquipmentText`, `customArchetype`, `px.availableOverride`.
- `migrateLegacyTraitState()` também preenche defaults para campos novos e preserva vantagens/desvantagens legadas.
- Export/import universal continua salvando `__appState` e campos DOM.

## 5. Estratégia de migração

- Ao carregar, campos inexistentes recebem valores padrão seguros: string vazia, `null` ou objetos vazios.
- Vantagens/desvantagens antigas em texto são convertidas somente se não existir array estruturado.
- Inventário antigo em string já era normalizado e foi mantido.
- PX disponível não altera cálculo antigo se `availableOverride` for `null`.

## 6. Estratégia para impedir perda de dados

- Mudanças são aditivas e não removem dados existentes.
- Autosave local em `localStorage` continua ativo e agora também captura alterações genéricas de campos.
- Autosave Supabase é debounced para reduzir corrida de salvamento, mas dispara logo após alterações.
- Snapshots/histórico Supabase existentes seguem usando a infraestrutura atual.
- PDF oficial apenas lê dados; não modifica a ficha.

## Plano executado

1. Analisar estrutura e armazenamento local/Supabase.
2. Adicionar campos novos sem renomear propriedades antigas.
3. Corrigir bugs específicos: perícias até 0 e Nanotecnologia não virar IA Embarcada.
4. Melhorar mobile com overrides responsivos.
5. Implementar PX disponível manual backward-compatible.
6. Implementar facções novas e lore.
7. Implementar autosave imediato local e Supabase.
8. Implementar exportação PDF oficial via janela de impressão estruturada.
9. Implementar equipamentos personalizados em texto livre.
10. Implementar rolagem dinâmica nas perícias.
11. Implementar arquétipo personalizado com modal, persistência e bônus aditivos.
12. Validar sintaxe JavaScript com `node --check`.
