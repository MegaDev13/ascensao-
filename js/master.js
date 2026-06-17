import { getSupabase, getCurrentUserAndProfile, isSupabaseConfigured, requireConfiguredSupabaseMessage, humanDate } from './supabaseClient.js';
import { NPC_ENGINE, NPC_STORY_ENGINE } from './npc-engine.js';
import { mergePublicAndMasterData, splitPublicAndMasterData, buildSheetSummary, downloadJSON } from './sheet-storage.js';

const state = {
  supabase: null,
  user: null,
  profile: null,
  fichas: [],
  npcs: [],
  selectedFicha: null,
  selectedNpc: null,
  editingNpcRow: null
};

const $ = (id) => document.getElementById(id);

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#039;', '"':'&quot;' }[c]));
}

function setMessage(text, type = '') {
  const el = $('master-message');
  if (!el) return;
  el.textContent = text || '';
  el.className = `master-message ${type}`.trim();
}

function setUserChip() {
  const chip = $('master-user');
  if (!chip) return;
  chip.textContent = `MJ: ${state.profile?.nome_publico || state.user?.email || 'Mestre'}`;
}

function fillNpcSelectors() {
  const cat = $('npc-category');
  const diff = $('npc-difficulty');
  const diffFilter = $('npc-filter-difficulty');
  NPC_ENGINE.categories.forEach((name) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    cat?.appendChild(option);
  });
  NPC_ENGINE.difficulties.forEach((name) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    diff?.appendChild(option.cloneNode(true));
    diffFilter?.appendChild(option);
  });
}

async function loadFichas() {
  // Não usamos embed direto usuarios(...) aqui porque fichas possui duas FKs para usuarios:
  // dono_id e atualizada_por. O PostgREST considera isso ambíguo.
  const { data, error } = await state.supabase
    .from('fichas')
    .select('id,dono_id,nome_jogador,nome_personagem,resumo,atualizada_em')
    .order('atualizada_em', { ascending: false });
  if (error) throw error;

  const donoIds = [...new Set((data || []).map((f) => f.dono_id).filter(Boolean))];
  let usuariosById = {};

  if (donoIds.length) {
    const { data: usuarios, error: usuariosError } = await state.supabase
      .from('usuarios')
      .select('id,nome,email')
      .in('id', donoIds);
    if (usuariosError) throw usuariosError;
    usuariosById = Object.fromEntries((usuarios || []).map((u) => [u.id, u]));
  }

  state.fichas = (data || []).map((f) => ({
    ...f,
    dono: usuariosById[f.dono_id] || null
  }));
  renderFichas();
}

function renderFichas() {
  const body = $('ficha-table-body');
  if (!body) return;
  const query = ($('ficha-search')?.value || '').toLowerCase().trim();
  const sort = $('ficha-sort')?.value || 'recentes';
  let rows = [...state.fichas];
  if (query) {
    rows = rows.filter((f) => JSON.stringify(f).toLowerCase().includes(query));
  }
  if (sort === 'personagem') rows.sort((a,b) => String(a.resumo?.personagem || a.nome_personagem).localeCompare(String(b.resumo?.personagem || b.nome_personagem)));
  if (sort === 'jogador') rows.sort((a,b) => String(a.usuarios?.nome || a.nome_jogador).localeCompare(String(b.usuarios?.nome || b.nome_jogador)));

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="7">Nenhuma ficha encontrada.</td></tr>';
    return;
  }

  body.innerHTML = rows.map((f) => {
    const r = f.resumo || {};
    const jogador = f.dono?.nome || f.nome_jogador || f.dono?.email || '—';
    const personagem = r.personagem || f.nome_personagem || 'Sem nome';
    return `<tr>
      <td>${esc(jogador)}</td>
      <td><strong>${esc(personagem)}</strong><br><span class="history-meta">${esc(r.codinome || r.arquetipo || '')}</span></td>
      <td>${esc(humanDate(f.atualizada_em))}</td>
      <td class="mini-stat">${Number(r.px || 0)} PX</td>
      <td class="mini-stat">${Number(r.hp_current || 0)}/${Number(r.hp_max || 0)}</td>
      <td class="mini-stat">${Number(r.sincronia_current || 0)}/${Number(r.sincronia_max || 0)}</td>
      <td><div class="row-actions">
        <button data-open="${esc(f.id)}">Abrir ficha</button>
        <button data-edit="${esc(f.id)}">Editar</button>
        <button data-history="${esc(f.id)}">Histórico</button>
        <button data-char-npc="${esc(f.id)}">Personagem → NPC</button>
      </div></td>
    </tr>`;
  }).join('');
}

async function loadHistory(fichaId) {
  state.selectedFicha = state.fichas.find((f) => f.id === fichaId) || { id: fichaId };
  const title = $('history-title');
  if (title) title.textContent = `Histórico de ${state.selectedFicha.resumo?.personagem || state.selectedFicha.nome_personagem || fichaId}`;
  const list = $('history-list');
  if (list) list.innerHTML = '<div class="history-item">Carregando histórico...</div>';

  const { data, error } = await state.supabase
    .from('historico_edicoes')
    .select('id,ficha_id,usuario_id,resumo,motivo,criado_em,usuarios(nome,email)')
    .eq('ficha_id', fichaId)
    .order('criado_em', { ascending: false });
  if (error) throw error;

  if (!data?.length) {
    list.innerHTML = '<div class="history-item">Nenhum snapshot encontrado.</div>';
    return;
  }

  list.innerHTML = data.map((h) => {
    const r = h.resumo || {};
    const usuario = h.usuarios?.nome || h.usuarios?.email || h.usuario_id || 'Sistema';
    return `<article class="history-item">
      <header><strong>${esc(humanDate(h.criado_em))}</strong><span class="history-meta">${esc(h.motivo || 'salvamento')}</span></header>
      <div class="history-meta">Usuário: ${esc(usuario)}</div>
      <div>PX <span class="mini-stat">${Number(r.px || 0)}</span> · HP <span class="mini-stat">${Number(r.hp_current || 0)}/${Number(r.hp_max || 0)}</span> · Sincronia <span class="mini-stat">${Number(r.sincronia_current || 0)}/${Number(r.sincronia_max || 0)}</span></div>
      <div class="row-actions" style="margin-top:8px;">
        <button data-preview-history="${esc(h.id)}" data-ficha="${esc(fichaId)}">Visualizar versão</button>
        <button data-restore-history="${esc(h.id)}" data-ficha="${esc(fichaId)}">Restaurar</button>
      </div>
    </article>`;
  }).join('');
}

async function restoreHistory(fichaId, historyId) {
  if (!confirm('Restaurar esta versão? Um novo snapshot será criado com a restauração.')) return;
  const { data: h, error } = await state.supabase
    .from('historico_edicoes')
    .select('dados,dados_mestre,resumo')
    .eq('id', historyId)
    .eq('ficha_id', fichaId)
    .single();
  if (error) throw error;

  const { error: secretError } = await state.supabase
    .from('fichas_segredos_mestre')
    .upsert({ ficha_id: fichaId, dados: h.dados_mestre || {}, atualizado_por: state.user.id }, { onConflict: 'ficha_id' });
  if (secretError) throw secretError;

  const summary = h.resumo || buildSheetSummary(mergePublicAndMasterData(h.dados || {}, h.dados_mestre || {}));
  const { error: updateError } = await state.supabase
    .from('fichas')
    .update({ dados: h.dados || {}, resumo: summary, nome_personagem: summary.personagem || 'Personagem restaurado', atualizada_por: state.user.id })
    .eq('id', fichaId);
  if (updateError) throw updateError;

  setMessage('Versão restaurada com sucesso.', 'ok');
  await loadFichas();
  await loadHistory(fichaId);
}

function renderNpc(npc, target = $('npc-output')) {
  if (!target) return;
  state.selectedNpc = npc;
  const attrs = npc.atributos || {};
  const rec = npc.recursos || {};
  const story = npc.story || NPC_STORY_ENGINE.generateHooks(npc);
  target.innerHTML = `<h4>${esc(npc.nome)} ${npc.titulo ? `— ${esc(npc.titulo)}` : ''}</h4>
    <div class="history-meta">${esc(npc.categoria)} · ${esc(npc.dificuldade)} · ${esc(npc.faccao)} · Apelido: ${esc(npc.apelido || '—')}</div>
    <dl>
      <dt>Identidade</dt><dd>${esc(npc.idade)} anos · ${esc(npc.sexo)} · origem: ${esc(npc.origem)}</dd>
      <dt>Personalidade</dt><dd>${esc(npc.personalidade)}</dd>
      <dt>Objetivo</dt><dd>${esc(npc.objetivo_atual)}</dd>
      <dt>Atributos</dt><dd>${Object.entries(attrs).map(([k,v]) => `<span class="pill">${esc(k)} ${esc(v)}</span>`).join('')}</dd>
      <dt>Recursos</dt><dd>HP <span class="mini-stat">${esc(rec.HP)}</span> · Sincronia <span class="mini-stat">${esc(rec.Sincronia)}</span> · PX <span class="mini-stat">${esc(rec.PX)}</span> · Defesa <span class="mini-stat">${esc(rec.Defesa)}</span> · Iniciativa <span class="mini-stat">${esc(rec.Iniciativa)}</span></dd>
      <dt>Perícias</dt><dd>${Object.entries(npc.pericias || {}).map(([k,v]) => `<span class="pill">${esc(k)} ${esc(v)}</span>`).join('')}</dd>
      <dt>Equipamentos</dt><dd>${(npc.equipamentos || []).map((e) => `<span class="pill">${esc(e)}</span>`).join('')}</dd>
      <dt>Poderes</dt><dd>${(npc.poderes || []).length ? npc.poderes.map((p) => `<span class="pill">${esc(p.nome)} N${esc(p.nivel)}</span>`).join('') : 'Nenhum poder relevante.'}</dd>
      <dt>Narrativa</dt><dd><strong>Aparência:</strong> ${esc(npc.descricao_narrativa?.aparencia)}<br><strong>Maneirismos:</strong> ${esc(npc.descricao_narrativa?.maneirismos)}<br><strong>Voz:</strong> ${esc(npc.descricao_narrativa?.voz)}<br><strong>Comportamento:</strong> ${esc(npc.descricao_narrativa?.comportamento)}</dd>
      <dt>Gancho</dt><dd><strong>Segredo:</strong> ${esc(npc.ganchos?.segredo)}<br><strong>Medo:</strong> ${esc(npc.ganchos?.medo)}<br><strong>Desejo:</strong> ${esc(npc.ganchos?.desejo)}<br><strong>Conflito:</strong> ${esc(npc.ganchos?.conflito)}</dd>
      <dt>Relações</dt><dd>Aliado: ${esc(npc.relacionamentos?.aliado)}<br>Inimigo: ${esc(npc.relacionamentos?.inimigo)}<br>Contato: ${esc(npc.relacionamentos?.contato)}</dd>
      <dt>Combate</dt><dd>Defesa ${esc(npc.combate?.defesa)} · Esquiva ${esc(npc.combate?.esquiva)} · Dano base ${esc(npc.combate?.dano_base)}<br>${(npc.combate?.ataques || []).map((a) => `${esc(a.nome)} (${esc(a.pool)}, dano ${esc(a.dano)}, ${esc(a.alcance)})`).join('<br>')}</dd>
      ${npc.historia_curta ? `<dt>Boss</dt><dd>${esc(npc.historia_curta)}<br><strong>Poder especial:</strong> ${esc(npc.poder_especial)}<br><strong>Fraqueza:</strong> ${esc(npc.fraqueza_oculta)}<br><strong>Loot:</strong> ${(npc.loot || []).map(esc).join(', ')}</dd>` : ''}
      <dt>Missões</dt><dd>${(story.missoes || []).map(esc).join('<br>')}</dd>
    </dl>
    <div class="row-actions">
      <button data-export-current-npc>Exportar JSON</button>
      <button data-print-current-npc>PDF/Imprimir</button>
    </div>`;
}

async function saveNpc(npc) {
  const { data, error } = await state.supabase
    .from('npcs')
    .insert({ criado_por: state.user.id, nome: npc.nome, categoria: npc.categoria, dificuldade: npc.dificuldade, dados: npc })
    .select('*')
    .single();
  if (error) throw error;
  await loadNpcs();
  return data;
}

async function generateNpc(kind = 'normal') {
  const categoria = $('npc-category')?.value || 'Aleatório';
  const dificuldade = $('npc-difficulty')?.value || 'Aleatório';
  let npc;
  if (kind === 'boss') npc = NPC_ENGINE.generateBoss({ categoria: categoria === 'Aleatório' ? undefined : categoria, dificuldade: dificuldade === 'Aleatório' ? undefined : dificuldade });
  else npc = NPC_ENGINE.generate({ categoria, dificuldade });
  await saveNpc(npc);
  renderNpc(npc);
  setMessage(`${kind === 'boss' ? 'Boss' : 'NPC'} gerado e salvo: ${npc.nome}`, 'ok');
}

async function generateGroup() {
  const categoria = $('npc-category')?.value || 'Aleatório';
  const group = NPC_ENGINE.generateGroup({ categoria });
  for (const npc of group.membros) await saveNpc(npc);
  const target = $('npc-output');
  target.innerHTML = `<h4>${esc(group.nome)}</h4><p>${esc(group.resumo)}</p><p><strong>Gancho:</strong> ${esc(group.gancho)}</p>${group.membros.map((npc) => `<div class="history-item"><strong>${esc(npc.nome)}</strong> — ${esc(npc.categoria)} ${esc(npc.dificuldade)} · HP ${esc(npc.recursos.HP)} · Sincronia ${esc(npc.recursos.Sincronia)}</div>`).join('')}`;
  setMessage(`Grupo gerado e ${group.membros.length} NPCs salvos no banco.`, 'ok');
}

async function loadNpcs() {
  const { data, error } = await state.supabase
    .from('npcs')
    .select('*')
    .order('criado_em', { ascending: false });
  if (error) throw error;
  state.npcs = data || [];
  renderNpcList();
}

function renderNpcList() {
  const list = $('npc-list');
  if (!list) return;
  const q = ($('npc-search')?.value || '').toLowerCase().trim();
  const diff = $('npc-filter-difficulty')?.value || '';
  let rows = [...state.npcs];
  if (q) rows = rows.filter((n) => JSON.stringify(n).toLowerCase().includes(q));
  if (diff) rows = rows.filter((n) => n.dificuldade === diff || n.dados?.dificuldade === diff);

  if (!rows.length) {
    list.innerHTML = '<div class="npc-item">Nenhum NPC salvo.</div>';
    return;
  }

  list.innerHTML = rows.map((row) => {
    const npc = row.dados || {};
    return `<article class="npc-item">
      <header><div><strong>${esc(npc.nome || row.nome)}</strong><div class="npc-meta">${esc(npc.categoria || row.categoria)} · ${esc(npc.dificuldade || row.dificuldade)} · ${esc(npc.faccao || '')} · ${esc(humanDate(row.criado_em))}</div></div><span class="mini-stat">HP ${esc(npc.recursos?.HP || '—')}</span></header>
      <div>${esc(npc.objetivo_atual || npc.personalidade || '')}</div>
      <div class="row-actions" style="margin-top:8px;">
        <button data-view-npc="${esc(row.id)}">Ver</button>
        <button data-edit-npc="${esc(row.id)}">Editar NPC</button>
        <button data-duplicate-npc="${esc(row.id)}">Duplicar</button>
        <button data-delete-npc="${esc(row.id)}">Excluir</button>
        <button data-npc-character="${esc(row.id)}">NPC → Personagem</button>
        <button data-export-npc="${esc(row.id)}">JSON</button>
      </div>
    </article>`;
  }).join('');
}

function openNpcEditor(rowId) {
  const row = state.npcs.find((n) => n.id === rowId);
  if (!row) return;
  const npc = row.dados || {};
  state.editingNpcRow = row;
  $('edit-npc-nome').value = npc.nome || '';
  $('edit-npc-apelido').value = npc.apelido || '';
  $('edit-npc-categoria').value = npc.categoria || '';
  $('edit-npc-dificuldade').value = npc.dificuldade || '';
  $('edit-npc-faccao').value = npc.faccao || '';
  $('edit-npc-objetivo').value = npc.objetivo_atual || '';
  $('edit-npc-personalidade').value = npc.personalidade || '';
  $('edit-npc-aparencia').value = npc.descricao_narrativa?.aparencia || '';
  $('edit-npc-equipamentos').value = (npc.equipamentos || []).join('\n');
  $('edit-npc-segredo').value = [npc.ganchos?.segredo, npc.ganchos?.conflito].filter(Boolean).join('\n');
  $('npc-edit-modal').classList.add('active');
}

async function saveNpcEditor() {
  const row = state.editingNpcRow;
  if (!row) return;
  const npc = { ...(row.dados || {}) };
  npc.nome = $('edit-npc-nome').value;
  npc.apelido = $('edit-npc-apelido').value;
  npc.categoria = $('edit-npc-categoria').value;
  npc.dificuldade = $('edit-npc-dificuldade').value;
  npc.faccao = $('edit-npc-faccao').value;
  npc.objetivo_atual = $('edit-npc-objetivo').value;
  npc.personalidade = $('edit-npc-personalidade').value;
  npc.descricao_narrativa = { ...(npc.descricao_narrativa || {}), aparencia: $('edit-npc-aparencia').value };
  npc.equipamentos = $('edit-npc-equipamentos').value.split('\n').map((x) => x.trim()).filter(Boolean);
  const secretLines = $('edit-npc-segredo').value.split('\n').map((x) => x.trim()).filter(Boolean);
  npc.ganchos = { ...(npc.ganchos || {}), segredo: secretLines[0] || '', conflito: secretLines.slice(1).join(' ') };

  const { error } = await state.supabase
    .from('npcs')
    .update({ nome: npc.nome, categoria: npc.categoria, dificuldade: npc.dificuldade, dados: npc })
    .eq('id', row.id);
  if (error) throw error;
  $('npc-edit-modal').classList.remove('active');
  state.editingNpcRow = null;
  await loadNpcs();
  renderNpc(npc);
  setMessage('NPC editado com sucesso.', 'ok');
}

async function duplicateNpc(rowId) {
  const row = state.npcs.find((n) => n.id === rowId);
  if (!row) return;
  const npc = JSON.parse(JSON.stringify(row.dados || {}));
  npc.nome = `${npc.nome || row.nome} (Cópia)`;
  npc.criado_em_local = new Date().toISOString();
  await saveNpc(npc);
  setMessage('NPC duplicado.', 'ok');
}

async function deleteNpc(rowId) {
  if (!confirm('Excluir este NPC?')) return;
  const { error } = await state.supabase.from('npcs').delete().eq('id', rowId);
  if (error) throw error;
  await loadNpcs();
  setMessage('NPC excluído.', 'ok');
}

function printNpc(npc = state.selectedNpc) {
  if (!npc) return;
  const win = window.open('', '_blank');
  win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(npc.nome)}</title><style>body{font-family:Arial,sans-serif;color:#111;padding:24px}pre{white-space:pre-wrap}h1{border-bottom:2px solid #111}</style></head><body><h1>${esc(npc.nome)}</h1><pre>${esc(JSON.stringify(npc, null, 2))}</pre><script>print()<\/script></body></html>`);
  win.document.close();
}

async function npcToCharacter(rowId) {
  const row = state.npcs.find((n) => n.id === rowId);
  if (!row) return;
  const sheetData = NPC_ENGINE.npcToCharacterData(row.dados || {});
  const { publicData, masterData } = splitPublicAndMasterData(sheetData);
  const summary = buildSheetSummary(sheetData);
  const { data: ficha, error } = await state.supabase
    .from('fichas')
    .insert({ dono_id: state.user.id, nome_jogador: state.profile?.nome_publico || state.user.email, nome_personagem: summary.personagem, dados: publicData, resumo: summary, atualizada_por: state.user.id })
    .select('id')
    .single();
  if (error) throw error;
  await state.supabase.from('fichas_segredos_mestre').upsert({ ficha_id: ficha.id, dados: masterData, atualizado_por: state.user.id }, { onConflict: 'ficha_id' });
  await state.supabase.from('fichas').update({ atualizada_por: state.user.id }).eq('id', ficha.id);
  location.href = `index.html?id=${encodeURIComponent(ficha.id)}&mestre=1&edit=1`;
}

async function characterToNpc(fichaId) {
  const { data: ficha, error } = await state.supabase.from('fichas').select('dados').eq('id', fichaId).single();
  if (error) throw error;
  const { data: segredo } = await state.supabase.from('fichas_segredos_mestre').select('dados').eq('ficha_id', fichaId).maybeSingle();
  const merged = mergePublicAndMasterData(ficha.dados || {}, segredo?.dados || {});
  const npc = NPC_ENGINE.fromCharacterData(merged);
  await saveNpc(npc);
  renderNpc(npc);
  setMessage('Personagem transformado em NPC e salvo no banco de NPCs.', 'ok');
}

function renderStory() {
  const npc = state.selectedNpc || NPC_ENGINE.generate({ categoria: $('npc-category')?.value || 'Aleatório', dificuldade: $('npc-difficulty')?.value || 'Aleatório' });
  const story = NPC_STORY_ENGINE.generateHooks(npc);
  $('npc-output').innerHTML = `<h4>NPC_STORY_ENGINE — ${esc(npc.nome)}</h4>${Object.entries(story).map(([section, list]) => `<div class="story-box"><strong>${esc(section.replaceAll('_',' '))}</strong><br>${list.map(esc).join('<br>')}</div>`).join('')}`;
}

function installEvents() {
  $('refresh-master')?.addEventListener('click', async () => { await loadFichas(); await loadNpcs(); setMessage('Painel atualizado.', 'ok'); });
  $('logout-master')?.addEventListener('click', async () => { await state.supabase.auth.signOut(); location.href = 'login.html'; });
  $('new-master-sheet')?.addEventListener('click', () => { location.href = 'index.html?new=1&mestre=1&edit=1'; });
  $('ficha-search')?.addEventListener('input', renderFichas);
  $('ficha-sort')?.addEventListener('change', renderFichas);
  $('npc-search')?.addEventListener('input', renderNpcList);
  $('npc-filter-difficulty')?.addEventListener('change', renderNpcList);
  $('generate-npc')?.addEventListener('click', () => generateNpc('normal').catch((e) => setMessage(e.message, 'error')));
  $('generate-boss')?.addEventListener('click', () => generateNpc('boss').catch((e) => setMessage(e.message, 'error')));
  $('generate-group')?.addEventListener('click', () => generateGroup().catch((e) => setMessage(e.message, 'error')));
  $('generate-story')?.addEventListener('click', renderStory);
  $('print-npcs')?.addEventListener('click', () => window.print());
  $('cancel-npc-edit')?.addEventListener('click', () => $('npc-edit-modal').classList.remove('active'));
  $('save-npc-edit')?.addEventListener('click', () => saveNpcEditor().catch((e) => setMessage(e.message, 'error')));

  document.addEventListener('click', async (event) => {
    const t = event.target;
    if (!t?.dataset) return;
    try {
      if (t.dataset.open) location.href = `index.html?id=${encodeURIComponent(t.dataset.open)}&mestre=1&readonly=1`;
      if (t.dataset.edit) location.href = `index.html?id=${encodeURIComponent(t.dataset.edit)}&mestre=1&edit=1`;
      if (t.dataset.history) await loadHistory(t.dataset.history);
      if (t.dataset.previewHistory) location.href = `index.html?id=${encodeURIComponent(t.dataset.ficha)}&mestre=1&history=${encodeURIComponent(t.dataset.previewHistory)}&readonly=1`;
      if (t.dataset.restoreHistory) await restoreHistory(t.dataset.ficha, t.dataset.restoreHistory);
      if (t.dataset.charNpc) await characterToNpc(t.dataset.charNpc);
      if (t.dataset.viewNpc) { const row = state.npcs.find((n) => n.id === t.dataset.viewNpc); if (row) renderNpc(row.dados); }
      if (t.dataset.editNpc) openNpcEditor(t.dataset.editNpc);
      if (t.dataset.duplicateNpc) await duplicateNpc(t.dataset.duplicateNpc);
      if (t.dataset.deleteNpc) await deleteNpc(t.dataset.deleteNpc);
      if (t.dataset.npcCharacter) await npcToCharacter(t.dataset.npcCharacter);
      if (t.dataset.exportNpc) { const row = state.npcs.find((n) => n.id === t.dataset.exportNpc); if (row) downloadJSON(`npc-${row.nome || row.id}.json`, row.dados); }
      if (t.hasAttribute('data-export-current-npc') && state.selectedNpc) downloadJSON(`npc-${state.selectedNpc.nome}.json`, state.selectedNpc);
      if (t.hasAttribute('data-print-current-npc')) printNpc(state.selectedNpc);
    } catch (err) {
      console.error(err);
      setMessage(err.message, 'error');
    }
  });
}

async function init() {
  fillNpcSelectors();
  installEvents();

  if (!isSupabaseConfigured()) {
    requireConfiguredSupabaseMessage($('master-message'));
    return;
  }

  try {
    state.supabase = await getSupabase();
    const auth = await getCurrentUserAndProfile(state.supabase);
    state.user = auth.user;
    state.profile = auth.profile;
    if (!state.user) {
      location.href = `login.html?next=${encodeURIComponent('mestre.html')}`;
      return;
    }
    if (state.profile?.tipo !== 'mestre') {
      alert('Painel exclusivo do mestre.');
      location.href = 'index.html';
      return;
    }
    setUserChip();
    await Promise.all([loadFichas(), loadNpcs()]);
    setMessage('Painel carregado.', 'ok');
  } catch (err) {
    console.error(err);
    setMessage(`Falha ao abrir painel: ${err.message}`, 'error');
  }
}

document.addEventListener('DOMContentLoaded', init);
