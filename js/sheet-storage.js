// ============================================================
// Exportador/importador universal da ficha Ascensão.
// Não mapeia campo por campo: percorre input, textarea, select e checkbox.
// ============================================================

const NO_PERSIST_IDS = new Set([
  'sheet-selector',
  'export-textarea',
  'import-textarea'
]);

const MASTER_FIELD_IDS = new Set([
  'master-true-objective',
  'master-false-clues',
  'master-campaign-notes',
  'master-proximity-slider',
  'proximity-val',
  'influence-cra',
  'influence-hepta',
  'influence-igreja',
  'influence-mercado',
  'master-npc-log'
]);

export function isMasterFieldId(id = '') {
  return id.startsWith('master-') || id.startsWith('influence-') || MASTER_FIELD_IDS.has(id);
}

function normalizeValue(el) {
  if (el.type === 'checkbox') return Boolean(el.checked);
  if (el.type === 'number' || el.type === 'range') {
    if (el.value === '') return '';
    const n = Number(el.value);
    return Number.isFinite(n) ? n : el.value;
  }
  return el.value;
}

function deepClone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function deepMerge(target = {}, source = {}) {
  const output = Array.isArray(target) ? [...target] : { ...target };
  if (!source || typeof source !== 'object') return output;
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      output[key] = deepMerge(output[key] && typeof output[key] === 'object' ? output[key] : {}, value);
    } else {
      output[key] = deepClone(value);
    }
  }
  return output;
}

export function collectUniversalSheetData(root = document) {
  if (window.ASCENSAO_SHEET?.syncFromDom) {
    try { window.ASCENSAO_SHEET.syncFromDom(); } catch (err) { console.warn('Falha ao sincronizar estado antes do export universal:', err); }
  }

  const data = {};
  const selector = 'input[id], textarea[id], select[id]';
  root.querySelectorAll(selector).forEach((el) => {
    if (NO_PERSIST_IDS.has(el.id) || el.dataset.noPersist === 'true') return;
    data[el.id] = normalizeValue(el);
  });

  const computed = {};
  root.querySelectorAll('[id]').forEach((el) => {
    if (!el.id || data[el.id] !== undefined || NO_PERSIST_IDS.has(el.id)) return;
    if (el.matches('script, style, svg, path, input, textarea, select')) return;
    const text = (el.innerText || '').trim();
    if (!text) return;
    // Captura valores calculados e HUDs, mas evita blocos gigantes.
    if (text.length <= 500) computed[el.id] = text;
  });

  data.__computed = computed;
  data.__appState = window.ASCENSAO_SHEET?.getState ? window.ASCENSAO_SHEET.getState() : null;
  data.__meta = {
    schema: 'ascensao-universal-v1',
    exportedAt: new Date().toISOString(),
    href: location.href
  };
  return data;
}

export function applyUniversalSheetData(data = {}, options = {}) {
  if (!data || typeof data !== 'object') return;

  // O estado interno da ficha original mantém perícias, poderes, inventário e cálculos.
  if (data.__appState && window.ASCENSAO_SHEET?.setState) {
    const appState = deepClone(data.__appState);
    if (options.ignoreMaster && appState.master) delete appState.master;
    window.ASCENSAO_SHEET.setState(appState, { preserveMaster: options.ignoreMaster });
  }

  Object.entries(data).forEach(([id, value]) => {
    if (id.startsWith('__')) return;
    if (options.ignoreMaster && isMasterFieldId(id)) return;
    const el = document.getElementById(id);
    if (!el) return;
    if (el.matches('input[type="checkbox"]')) {
      el.checked = Boolean(value);
    } else if (el.matches('input, textarea, select')) {
      el.value = value ?? '';
    }
  });

  if (window.ASCENSAO_SHEET?.syncFromDom) window.ASCENSAO_SHEET.syncFromDom({ silent: true });
  if (window.ASCENSAO_SHEET?.recalculate) window.ASCENSAO_SHEET.recalculate();
}

export function splitPublicAndMasterData(fullData = {}) {
  const publicData = {};
  const masterData = {};

  Object.entries(fullData).forEach(([key, value]) => {
    if (key === '__computed') {
      publicData.__computed = {};
      masterData.__computed = {};
      Object.entries(value || {}).forEach(([id, computedValue]) => {
        if (isMasterFieldId(id)) masterData.__computed[id] = computedValue;
        else publicData.__computed[id] = computedValue;
      });
      return;
    }

    if (key === '__appState') {
      const state = deepClone(value || {});
      const master = state?.master ? deepClone(state.master) : undefined;
      if (state && typeof state === 'object') delete state.master;
      publicData.__appState = state;
      masterData.__appState = master ? { master } : {};
      return;
    }

    if (key === '__meta') {
      publicData.__meta = deepClone(value);
      masterData.__meta = deepClone(value);
      return;
    }

    if (isMasterFieldId(key)) masterData[key] = deepClone(value);
    else publicData[key] = deepClone(value);
  });

  return { publicData, masterData };
}

export function mergePublicAndMasterData(publicData = {}, masterData = {}) {
  const merged = deepMerge(publicData || {}, masterData || {});
  if (publicData?.__appState || masterData?.__appState) {
    merged.__appState = deepMerge(publicData.__appState || {}, masterData.__appState || {});
  }
  if (publicData?.__computed || masterData?.__computed) {
    merged.__computed = { ...(publicData.__computed || {}), ...(masterData.__computed || {}) };
  }
  return merged;
}

export function buildSheetSummary(data = {}) {
  const state = data.__appState || {};
  const hpMax = data['hp-max'] ?? state.hp?.maxOverride ?? data.__computed?.['hp-bar-text']?.split('/')?.[1] ?? null;
  const hpCurrent = data['hp-current'] ?? state.hp?.current ?? null;
  const sincCurrent = data['sinc-current'] ?? state.sinc?.current ?? null;
  const sincMax = data['sinc-max'] ?? null;
  const px = data['px-total-input'] ?? state.px?.total ?? 0;

  return {
    personagem: data['char-name'] || state.name || 'Personagem sem nome',
    codinome: data['char-codename'] || state.codename || '',
    arquetipo: data['char-archetype'] || state.archetype || '',
    faccao: data['char-faction'] === 'Outra' ? (data['char-faction-other'] || state.factionOtherName || 'Outra') : (data['char-faction'] === 'Nenhuma' ? 'Nenhuma dessas' : (data['char-faction'] || state.faction || '')),
    px: Number(px) || 0,
    hp_current: Number(hpCurrent) || 0,
    hp_max: Number(hpMax) || 0,
    sincronia_current: Number(sincCurrent) || 0,
    sincronia_max: Number(sincMax) || 0,
    updated_at_client: new Date().toISOString()
  };
}

export function downloadJSON(filename, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
