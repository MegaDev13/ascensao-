import { getSupabase, getCurrentUserAndProfile, isSupabaseConfigured, redirectWithNext, humanDate } from './supabaseClient.js';
import {
  collectUniversalSheetData,
  applyUniversalSheetData,
  splitPublicAndMasterData,
  mergePublicAndMasterData,
  buildSheetSummary,
  downloadJSON
} from './sheet-storage.js';

const params = new URLSearchParams(location.search);
const app = {
  supabase: null,
  user: null,
  profile: null,
  isMaster: false,
  currentSheetId: params.get('id'),
  historyId: params.get('history'),
  previewHistory: Boolean(params.get('history')) || params.get('previewHistory') === '1',
  readonly: params.get('readonly') === '1' || (params.get('mestre') === '1' && params.get('edit') !== '1'),
  dirty: false,
  saving: false,
  subscription: null,
  autosaveTimer: null,
  autosaveDebounce: null,
  sheets: []
};

window.ASC_APP = app;

function $(id) { return document.getElementById(id); }

function setStatus(text, state = '') {
  const el = $('asc-sync-status');
  if (!el) return;
  el.textContent = text;
  if (state) el.dataset.state = state;
  else el.removeAttribute('data-state');
}

function log(source, message) {
  if (window.ASCENSAO_SHEET?.addLog) window.ASCENSAO_SHEET.addLog(source, message);
  else console.log(`[${source}] ${message}`);
}

function scheduleImmediateAutosave() {
  if (app.previewHistory || app.readonly || !app.supabase || !app.user) return;
  if (app.autosaveDebounce) clearTimeout(app.autosaveDebounce);
  app.autosaveDebounce = setTimeout(() => {
    app.autosaveDebounce = null;
    if (app.dirty && !app.saving) saveSheet({ reason: 'autosave' });
  }, 800);
}

function setDirty(value = true) {
  if (app.previewHistory || app.readonly) return;
  app.dirty = value;
  setStatus(value ? 'Alterações pendentes' : 'Sincronizado', value ? 'dirty' : 'ok');
  if (value) scheduleImmediateAutosave();
}

function setUserChip() {
  const chip = $('asc-user-chip');
  if (!chip) return;
  if (!app.user) {
    chip.textContent = 'Sessão offline';
    return;
  }
  const nome = app.profile?.nome_publico || app.user.user_metadata?.nome || app.user.email;
  chip.textContent = `${app.isMaster ? 'MJ' : 'Jogador'}: ${nome}`;
}

function setRoleUI() {
  app.isMaster = app.profile?.tipo === 'mestre';
  document.body.dataset.role = app.isMaster ? 'mestre' : 'jogador';

  const masterPanelBtn = $('asc-master-panel-btn');
  if (masterPanelBtn) masterPanelBtn.style.display = app.isMaster ? '' : 'none';

  const masterToggle = $('master-mode-toggle');
  if (masterToggle) {
    masterToggle.style.display = app.isMaster ? '' : 'none';
    masterToggle.title = app.isMaster ? 'Alternar painel confidencial do mestre' : 'Restrito ao mestre';
  }

  const editToggle = $('asc-edit-toggle');
  if (editToggle) {
    editToggle.style.display = app.isMaster && (params.get('mestre') === '1' || app.readonly) ? '' : 'none';
  }

  if (window.ASCENSAO_SHEET?.setMasterAccess) {
    window.ASCENSAO_SHEET.setMasterAccess(app.isMaster && (params.get('mestre') === '1' || app.previewHistory));
  }

  if (!app.isMaster && window.ASCENSAO_SHEET?.setMasterAccess) {
    window.ASCENSAO_SHEET.setMasterAccess(false);
  }
}

function preserveDisabledState(el) {
  if (!el.dataset.ascPrevDisabled) el.dataset.ascPrevDisabled = el.disabled ? '1' : '0';
}

function applyReadonlyMode(readonly) {
  app.readonly = Boolean(readonly);
  document.body.classList.toggle('asc-readonly', app.readonly);
  document.body.classList.toggle('asc-history-preview', app.previewHistory);

  document.querySelectorAll('input, textarea, select').forEach((el) => {
    if (el.closest('.asc-app-controls')) return;
    preserveDisabledState(el);
    if (app.readonly) el.disabled = true;
    else el.disabled = el.dataset.ascPrevDisabled === '1';
  });

  const saveBtn = $('asc-save-btn');
  if (saveBtn) saveBtn.disabled = app.readonly || app.previewHistory;
  const newBtn = $('asc-new-btn');
  if (newBtn) newBtn.disabled = app.previewHistory;
  const editToggle = $('asc-edit-toggle');
  if (editToggle) editToggle.textContent = app.readonly ? 'Editar ficha' : 'Somente leitura';

  if (app.readonly) setStatus(app.previewHistory ? 'Prévia histórica somente leitura' : 'Somente leitura', 'ok');
}

function installDirtyListeners() {
  document.addEventListener('input', (event) => {
    const el = event.target;
    if (el?.matches?.('input, textarea, select') && !el.closest('.asc-app-controls')) setDirty(true);
  }, true);
  document.addEventListener('change', (event) => {
    const el = event.target;
    if (el?.matches?.('input, textarea, select') && !el.closest('.asc-app-controls')) setDirty(true);
  }, true);
}

function installUniversalExportOverrides() {
  window.generateJSONExport = function generateUniversalJSONExport() {
    const data = collectUniversalSheetData();
    const area = $('export-textarea');
    const label = $('export-format-label');
    if (label) label.textContent = 'EXPORTADOR UNIVERSAL COMPLETO (JSON SUPABASE):';
    if (area) area.value = JSON.stringify(data, null, 2);
    log('CRA', 'Exportador universal gerou JSON completo da ficha, incluindo campos calculados e estado interno.');
  };

  window.importCharacterJSON = function importUniversalJSON() {
    const area = $('import-textarea');
    const input = area?.value || '';
    if (!input.trim()) return alert('Área de importação vazia. Cole um JSON válido.');
    try {
      const parsed = JSON.parse(input);
      applyUniversalSheetData(parsed, { ignoreMaster: !app.isMaster });
      if (area) area.value = '';
      setDirty(true);
      log('CRA', 'Importador universal aplicou o JSON na ficha atual. Clique em Salvar para persistir no Supabase.');
      alert('Ficha importada na interface. Clique em Salvar para persistir no Supabase.');
    } catch (err) {
      alert(`Falha de importação: ${err.message}`);
      log('CRA', `Erro de importação universal: ${err.message}`);
    }
  };
}

function fillSheetSelector() {
  const selector = $('sheet-selector');
  if (!selector) return;
  selector.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = app.sheets.length ? 'Carregar ficha...' : 'Nenhuma ficha salva';
  selector.appendChild(placeholder);
  app.sheets.forEach((sheet) => {
    const option = document.createElement('option');
    option.value = sheet.id;
    const resumo = sheet.resumo || {};
    option.textContent = `${resumo.personagem || sheet.nome_personagem || 'Sem nome'} — ${humanDate(sheet.atualizada_em)}`;
    if (sheet.id === app.currentSheetId) option.selected = true;
    selector.appendChild(option);
  });
}

async function loadSheetList() {
  if (!app.supabase || !app.user) return;
  const { data, error } = await app.supabase
    .from('fichas')
    .select('id,nome_personagem,resumo,atualizada_em')
    .order('atualizada_em', { ascending: false });
  if (error) throw error;
  app.sheets = data || [];
  fillSheetSelector();
}

async function fetchMasterSecrets(fichaId) {
  if (!app.isMaster) return {};
  const { data, error } = await app.supabase
    .from('fichas_segredos_mestre')
    .select('dados')
    .eq('ficha_id', fichaId)
    .maybeSingle();
  if (error) throw error;
  return data?.dados || {};
}

async function loadHistoryPreview(fichaId, historyId) {
  const { data, error } = await app.supabase
    .from('historico_edicoes')
    .select('id,ficha_id,dados,dados_mestre,resumo,criado_em')
    .eq('id', historyId)
    .eq('ficha_id', fichaId)
    .single();
  if (error) throw error;
  const merged = mergePublicAndMasterData(data.dados || {}, data.dados_mestre || {});
  applyUniversalSheetData(merged, { ignoreMaster: !app.isMaster });
  app.previewHistory = true;
  applyReadonlyMode(true);
  setStatus(`Prévia histórica: ${humanDate(data.criado_em)}`, 'ok');
  log('MJ', `Prévia histórica carregada (${humanDate(data.criado_em)}). Nada será salvo enquanto estiver em modo histórico.`);
}

async function loadSheet(fichaId, options = {}) {
  if (!fichaId || !app.supabase) return;
  setStatus('Carregando ficha...', 'saving');

  const { data: sheet, error } = await app.supabase
    .from('fichas')
    .select('id,dono_id,nome_personagem,dados,resumo,atualizada_em')
    .eq('id', fichaId)
    .single();
  if (error) throw error;

  app.currentSheetId = sheet.id;
  if (options.historyId) {
    await loadHistoryPreview(sheet.id, options.historyId);
  } else {
    const secrets = await fetchMasterSecrets(sheet.id);
    const merged = mergePublicAndMasterData(sheet.dados || {}, app.isMaster ? secrets : {});
    applyUniversalSheetData(merged, { ignoreMaster: !app.isMaster });
    setStatus(`Carregado: ${humanDate(sheet.atualizada_em)}`, 'ok');
    log('CRA', `Ficha '${sheet.resumo?.personagem || sheet.nome_personagem || sheet.id}' carregada do Supabase.`);
  }

  const selector = $('sheet-selector');
  if (selector) selector.value = sheet.id;
  app.dirty = false;
  history.replaceState(null, '', `${location.pathname}?id=${encodeURIComponent(sheet.id)}${params.get('mestre') === '1' ? '&mestre=1' : ''}${app.readonly ? '&readonly=1' : ''}`);
  subscribeToCurrentSheet();
}

async function startNewSheet() {
  if (app.previewHistory) return;
  if (app.dirty && !confirm('Existem alterações não salvas. Criar nova ficha mesmo assim?')) return;
  app.currentSheetId = null;
  history.replaceState(null, '', location.pathname);
  if (window.ASCENSAO_SHEET?.resetToTemplate) window.ASCENSAO_SHEET.resetToTemplate({ blankIdentity: true });
  app.dirty = false;
  const selector = $('sheet-selector');
  if (selector) selector.value = '';
  setStatus('Nova ficha local — edite ou clique em Salvar', 'dirty');
  log('CRA', 'Nova ficha criada localmente. O registro será persistido ao clicar em Salvar.');
}

async function saveSheet({ reason = 'manual' } = {}) {
  if (!app.supabase || !app.user) {
    setStatus('Supabase não configurado', 'error');
    return;
  }
  if (app.readonly || app.previewHistory) {
    setStatus('Ficha em somente leitura; salvamento bloqueado', 'error');
    return;
  }
  if (app.saving) return;

  if (app.autosaveDebounce) {
    clearTimeout(app.autosaveDebounce);
    app.autosaveDebounce = null;
  }
  app.saving = true;
  setStatus(reason === 'autosave' ? 'Autosave...' : 'Salvando...', 'saving');

  try {
    const fullData = collectUniversalSheetData();
    const { publicData, masterData } = splitPublicAndMasterData(fullData);
    const summary = buildSheetSummary(fullData);
    const nomePersonagem = summary.personagem || 'Personagem sem nome';
    const nomeJogador = app.profile?.nome_publico || app.user.user_metadata?.nome || app.user.email;

    if (app.isMaster && app.currentSheetId) {
      const { error: secretError } = await app.supabase
        .from('fichas_segredos_mestre')
        .upsert({ ficha_id: app.currentSheetId, dados: masterData, atualizado_por: app.user.id }, { onConflict: 'ficha_id' });
      if (secretError) throw secretError;
    }

    let insertedNewSheet = false;
    if (!app.currentSheetId) {
      const { data: inserted, error: insertError } = await app.supabase
        .from('fichas')
        .insert({
          dono_id: app.user.id,
          nome_jogador: nomeJogador,
          nome_personagem: nomePersonagem,
          dados: publicData,
          resumo: summary,
          atualizada_por: app.user.id
        })
        .select('id')
        .single();
      if (insertError) throw insertError;
      app.currentSheetId = inserted.id;
      insertedNewSheet = true;

      if (app.isMaster) {
        const { error: secretError } = await app.supabase
          .from('fichas_segredos_mestre')
          .upsert({ ficha_id: app.currentSheetId, dados: masterData, atualizado_por: app.user.id }, { onConflict: 'ficha_id' });
        if (secretError) throw secretError;
        // Atualiza a ficha para gerar snapshot final com dados secretos já presentes.
      }
    }

    // Fichas novas de jogador já foram persistidas no INSERT.
    // Para fichas existentes — ou novas fichas de mestre com segredo recém-criado — fazemos UPDATE para gerar snapshot final.
    if (!insertedNewSheet || app.isMaster) {
      const { error: updateError } = await app.supabase
        .from('fichas')
        .update({
          nome_jogador: nomeJogador,
          nome_personagem: nomePersonagem,
          dados: publicData,
          resumo: summary,
          atualizada_por: app.user.id
        })
        .eq('id', app.currentSheetId);
      if (updateError) throw updateError;
    }

    app.dirty = false;
    setStatus(`Salvo ${new Date().toLocaleTimeString('pt-BR')}`, 'ok');
    log('CRA', reason === 'autosave' ? 'Autosave sincronizado com Supabase.' : 'Ficha salva no Supabase com snapshot histórico.');
    history.replaceState(null, '', `${location.pathname}?id=${encodeURIComponent(app.currentSheetId)}`);
    await loadSheetList();
    subscribeToCurrentSheet();
  } catch (err) {
    console.error(err);
    setStatus(`Erro ao salvar: ${err.message}`, 'error');
    log('CRA', `Falha de sincronização: ${err.message}`);
  } finally {
    app.saving = false;
    if (app.dirty && reason === 'autosave') scheduleImmediateAutosave();
  }
}

function subscribeToCurrentSheet() {
  if (!app.supabase || !app.currentSheetId || app.previewHistory) return;
  if (app.subscription) {
    app.supabase.removeChannel(app.subscription);
    app.subscription = null;
  }
  app.subscription = app.supabase
    .channel(`ficha-${app.currentSheetId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'fichas', filter: `id=eq.${app.currentSheetId}` }, (payload) => {
      if (app.saving) return;
      setStatus(`Atualização remota detectada ${humanDate(payload.new?.atualizada_em)}`, 'dirty');
      log('CRA', 'Outra sessão atualizou esta ficha. Use Carregar ficha para recarregar do Supabase se necessário.');
    })
    .subscribe();
}

function installControlHandlers() {
  $('asc-save-btn')?.addEventListener('click', () => saveSheet({ reason: 'manual' }));
  $('asc-new-btn')?.addEventListener('click', startNewSheet);
  $('asc-logout-btn')?.addEventListener('click', async () => {
    if (app.supabase) await app.supabase.auth.signOut();
    location.href = 'login.html';
  });
  $('asc-master-panel-btn')?.addEventListener('click', () => { location.href = 'mestre.html'; });
  $('asc-edit-toggle')?.addEventListener('click', () => {
    if (app.previewHistory) {
      alert('Prévia histórica é somente leitura. Restaure a versão pelo Painel Mestre para editá-la.');
      return;
    }
    applyReadonlyMode(!app.readonly);
  });
  $('sheet-selector')?.addEventListener('change', async (event) => {
    const id = event.target.value;
    if (!id) return;
    if (app.dirty && !confirm('Descartar alterações locais e carregar outra ficha?')) return;
    try { await loadSheet(id); }
    catch (err) { setStatus(`Erro ao carregar: ${err.message}`, 'error'); }
  });
  $('asc-export-universal-btn')?.addEventListener('click', () => {
    const data = collectUniversalSheetData();
    downloadJSON(`ascensao-${data['char-name'] || 'ficha'}.json`, data);
  });
}

function startAutosave() {
  if (app.autosaveTimer) clearInterval(app.autosaveTimer);
  app.autosaveTimer = setInterval(() => {
    if (app.dirty && !app.readonly && !app.previewHistory && app.supabase && app.user) {
      saveSheet({ reason: 'autosave' });
    }
  }, 30000);
}

async function importFromSessionIfAny() {
  const raw = sessionStorage.getItem('asc_import_character_data');
  if (!raw) return false;
  sessionStorage.removeItem('asc_import_character_data');
  const parsed = JSON.parse(raw);
  applyUniversalSheetData(parsed, { ignoreMaster: !app.isMaster });
  app.currentSheetId = null;
  setDirty(true);
  setStatus('NPC convertido em ficha local — clique em Salvar', 'dirty');
  return true;
}

async function initSupabaseMode() {
  if (!isSupabaseConfigured()) {
    setStatus('Supabase não configurado — modo local', 'error');
    setUserChip();
    applyReadonlyMode(false);
    return;
  }

  app.supabase = await getSupabase();
  const auth = await getCurrentUserAndProfile(app.supabase);
  app.user = auth.user;
  app.profile = auth.profile;

  if (!app.user) {
    redirectWithNext('login.html');
    return;
  }

  app.isMaster = app.profile?.tipo === 'mestre';
  window.ASC_AUTH = { user: app.user, profile: app.profile, isMaster: app.isMaster };
  setUserChip();
  setRoleUI();

  if (params.get('mestre') === '1' && !app.isMaster) {
    alert('Acesso de mestre restrito. Redirecionando para sua ficha.');
    location.href = 'index.html';
    return;
  }

  await loadSheetList();

  const imported = await importFromSessionIfAny();
  if (!imported) {
    if (app.currentSheetId) {
      await loadSheet(app.currentSheetId, { historyId: app.historyId });
    } else if (app.sheets.length && !params.get('new')) {
      await loadSheet(app.sheets[0].id);
    } else {
      setStatus('Ficha local pronta — edite ou clique em Salvar', 'dirty');
      app.dirty = false;
    }
  }

  applyReadonlyMode(app.readonly || app.previewHistory);
  startAutosave();
}

async function init() {
  installControlHandlers();
  installDirtyListeners();
  installUniversalExportOverrides();
  setStatus('Inicializando...', 'saving');

  try {
    await initSupabaseMode();
  } catch (err) {
    console.error(err);
    setStatus(`Falha de inicialização: ${err.message}`, 'error');
  }
}

// A ficha original usa window.onload para construir perícias/poderes/equipamentos.
// Rodamos após o load para preservar a interface original integralmente.
window.addEventListener('load', init);

window.ASC_APP_API = {
  saveSheet,
  loadSheet,
  startNewSheet,
  collectUniversalSheetData,
  applyUniversalSheetData
};
