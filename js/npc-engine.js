// ============================================================
// NPC_ENGINE e NPC_STORY_ENGINE — geração procedural local.
// Funciona sem APIs externas. Coerente com universo cyberpunk Ascensão.
// ============================================================

const CATEGORIES = [
  'Civil','Criminoso','Mercenário','Policial','Agente CRA','Executivo Corporativo','Hacker','Médico',
  'Membro de Facção','Cultista','Andarilho','Vendedor','Soldado','Líder','Chefe','Elite'
];

const DIFFICULTIES = ['Fraco','Comum','Veterano','Elite','Boss','Lendário'];

const FIRST_NAMES = {
  brasileiro: ['Rafael','Luna','Maya','Caio','Iara','Enzo','Bianca','João','Nina','Dante','Lívia','Gael','Tainá','Bruno','Helena'],
  japones: ['Akira','Ren','Hana','Sora','Yuki','Kaito','Mei','Haruto','Naomi','Kenji','Aiko','Riku','Sato','Hikari'],
  europeu: ['Kael','Viktor','Elena','Mira','Lukas','Anika','Nikolai','Sofia','Erik','Astrid','Noah','Clara','Voss'],
  corporativo: ['Nova','Nexus','Astra','Vector','Orion','Cipher','Atlas','Vega','Helix','Sigma','Nyx'],
  cyberpunk: ['Zero','Byte','Razor','Echo','Neon','Ghost','Chrome','Pulse','Vanta','Kira','Flux','Glitch','Onyx']
};

const SURNAMES = ['Voss','Choi','Tanaka','Sato','Nexus','Valenti','Kovacs','Mizuno','Almeida','Santiago','Costa','Kurogane','Moreau','Volkov','Amano','Silva','Rocha','Mendes','Sterling','Nakamura','Klein','Salk','Aras','Mori'];
const ALIASES = ['Sombra','Neon', 'Oráculo', 'Ferro-Frio', 'Cicatriz', 'Byte Santo', 'Víbora', 'Ruído', 'Fio de Prata', 'Ninguém', 'Cão Azul', 'Anjo de Vidro', 'Dente-de-Leão', 'Karma-9', 'Vox'];
const FACTIONS = ['CRA','Heptagrama Corp','Igreja da Última Pergunta','Transcendência','Mercado Negro Neural','Guardiões do Registro','Rede do Vazio','Inteligência Coletiva','Clãs das Megafavelas','BioGenesis Inc.','Frota Estelar Livre','Ordem dos Leitores de Vento','Médicos Sem Escalas','Companhia dos Sussurros','Sombra Corporativa'];
const ORIGINS = ['Megafavela orbital', 'Neo-São Paulo', 'Nova Tóquio Subterrânea', 'Arcologia Heptagrama', 'Colônia Marciana abandonada', 'Clínica BioGenesis', 'Distrito de Chuva Ácida', 'Cinturão de sucata lunar', 'Santuário de dados da Igreja', 'Mercado de próteses da Baía 9'];
const PERSONALITIES = ['pragmático e cansado', 'gentil até ser ameaçado', 'paranoico e observador', 'carismático e perigoso', 'frio como um contrato corporativo', 'curioso sobre a Ascensão', 'fanático por padrões e presságios', 'leal a quem paga', 'culpado por algo que não confessa', 'brincalhão em situações mortais'];
const OBJECTIVES = ['quitar uma dívida neural', 'encontrar alguém desaparecido', 'vender uma informação proibida', 'sobreviver a uma caçada corporativa', 'proteger um segredo existencial', 'roubar uma chave quântica', 'expor uma conspiração da CRA', 'ascender antes que o corpo falhe', 'salvar uma comunidade sem nome', 'derrubar o próprio superior'];
const APPEARANCES = ['olhos com brilho ciano de implante barato', 'jaqueta blindada remendada com símbolos de facção', 'pele sintética com falhas de pigmentação', 'mãos metálicas cobertas por luvas de couro', 'tatuagens de circuito que pulsam quando mente', 'cabelo cromado e máscara respiratória', 'uniforme impecável demais para as ruas', 'rosto cansado de quem já morreu clinicamente'];
const MANNERISMS = ['conta segundos antes de responder', 'nunca fica de costas para uma porta', 'toca um amuleto de dados corrompidos', 'fala com um drone invisível', 'sorri quando sente medo', 'corrige a própria memória em voz baixa', 'pede desculpas a máquinas quebradas', 'observa reflexos em superfícies pretas'];
const VOICES = ['baixa e metálica', 'rápida como anúncio corporativo', 'rouca de filtros pulmonares', 'calma demais', 'cheia de chiados de codec', 'quase infantil', 'cerimonial e lenta', 'sarcástica e musical'];
const FEARS = ['perder a própria identidade', 'ser apagado dos registros da CRA', 'voltar para a Heptagrama', 'sonhar com o Objetivo verdadeiro', 'ficar sem bateria neural', 'ser lembrado por quem traiu', 'a Sincronia infinita', 'silêncio absoluto'];
const DESIRES = ['comprar um corpo novo', 'ouvir uma resposta da Última Pergunta', 'fugir para a Frota Livre', 'ser perdoado', 'ter um nome verdadeiro', 'vingar uma comunidade destruída', 'provar que Ascensão não é destino', 'encontrar uma memória de infância'];
const CONFLICTS = ['deve dinheiro ao Mercado Negro Neural', 'é monitorado por um agente CRA', 'carrega malware da Rede do Vazio', 'protege alguém que o odeia', 'vende informações para duas facções rivais', 'tem um implante com lealdade corporativa', 'foi prometido como sacrifício por um culto', 'é clone de uma pessoa importante'];

const CATEGORY_PROFILES = {
  'Civil': { attrs: ['pre','per'], skills: ['Persuasão','Pesquisa','Medicina'], equipment: ['smartphone neural','jaqueta comum','kit de sobrevivência urbano'], factionBias: ['Clãs das Megafavelas','Médicos Sem Escalas'] },
  'Criminoso': { attrs: ['agi','pre','per'], skills: ['Furtividade','Pistolas','Manipulação'], equipment: ['pistola raspada','chaveiro de invasão','jaqueta blindada leve'], factionBias: ['Mercado Negro Neural','Companhia dos Sussurros'] },
  'Mercenário': { attrs: ['agi','for','res'], skills: ['Rifles','Defesa','Intimidação'], equipment: ['rifle modular','armadura média','granada de pulso'], factionBias: ['Mercado Negro Neural','Frota Estelar Livre'] },
  'Policial': { attrs: ['per','res','pre'], skills: ['Investigação','Pistolas','Defesa'], equipment: ['pistola de choque','distintivo biométrico','algemas magnéticas'], factionBias: ['CRA','Guardiões do Registro'] },
  'Agente CRA': { attrs: ['per','int','ess'], skills: ['Investigação','Disciplina','Pistolas'], equipment: ['pistola CRA selada','visor de registro','núcleo de Sincronia'], factionBias: ['CRA'] },
  'Executivo Corporativo': { attrs: ['pre','int','tec'], skills: ['Persuasão','Liderança','Manipulação'], equipment: ['terno blindado','assistente IA','contrato letal'], factionBias: ['Heptagrama Corp','BioGenesis Inc.','Sombra Corporativa'] },
  'Hacker': { attrs: ['int','tec','per'], skills: ['Segurança Digital','Invasão de Sistemas','Programação'], equipment: ['deck neural','drone espião','implante neural'], factionBias: ['Rede do Vazio','Inteligência Coletiva'] },
  'Médico': { attrs: ['int','tec','ess'], skills: ['Medicina','Ciências','Psicologia'], equipment: ['kit médico','nanobisturi','ampolas de estabilização'], factionBias: ['Médicos Sem Escalas','BioGenesis Inc.'] },
  'Membro de Facção': { attrs: ['pre','agi','ess'], skills: ['Liderança','Furtividade','Pistolas'], equipment: ['símbolo de facção','arma personalizada','comunicador criptografado'], factionBias: FACTIONS },
  'Cultista': { attrs: ['ess','pre','int'], skills: ['Disciplina','Manipulação','Autoconhecimento'], equipment: ['máscara ritual','lâmina monomolecular','códice corrompido'], factionBias: ['Igreja da Última Pergunta','Transcendência'] },
  'Andarilho': { attrs: ['res','per','agi'], skills: ['Pesquisa','Furtividade','Meditação'], equipment: ['mochila de sucata','mapa impossível','manto térmico'], factionBias: ['Frota Estelar Livre','Ordem dos Leitores de Vento'] },
  'Vendedor': { attrs: ['pre','per','tec'], skills: ['Persuasão','Manipulação','Pesquisa'], equipment: ['maleta de amostras','terminal de crédito','arma oculta'], factionBias: ['Mercado Negro Neural','BioGenesis Inc.'] },
  'Soldado': { attrs: ['for','agi','res'], skills: ['Rifles','Defesa','Corpo a Corpo'], equipment: ['rifle de assalto','armadura média','kit de campo'], factionBias: ['Heptagrama Corp','CRA','Frota Estelar Livre'] },
  'Líder': { attrs: ['pre','int','ess'], skills: ['Liderança','Persuasão','Intimidação'], equipment: ['comunicador tático','guarda-costas drone','símbolo de autoridade'], factionBias: FACTIONS },
  'Chefe': { attrs: ['pre','res','int'], skills: ['Liderança','Defesa','Manipulação'], equipment: ['arma assinatura','armadura reforçada','chave de cofre'], factionBias: FACTIONS },
  'Elite': { attrs: ['agi','res','ess'], skills: ['Pistolas','Rifles','Defesa','Disciplina'], equipment: ['arma de plasma','armadura pesada','implante ocular'], factionBias: ['CRA','Heptagrama Corp','Sombra Corporativa'] }
};

const SKILLS = ['Hackeamento','Armas de fogo','Medicina','Furtividade','Investigação','Pilotagem','Persuasão','Segurança Digital','Invasão de Sistemas','Programação','Rifles','Pistolas','Defesa','Corpo a Corpo','Disciplina','Meditação','Liderança','Manipulação','Intimidação','Pesquisa','Psicologia','Mecânica'];
const POWERS = {
  stealth: ['Camuflagem Óptica','Distorção de Percepção','Frequência de Ausência'],
  combat: ['Aprimoramento Físico','Reflexos Acelerados','Campo de Força Pessoal','Sobrecarga Cinética'],
  tech: ['Hackear Implantes','Sabotagem Neural','Guerra Eletrônica'],
  mystic: ['Meditação de Registro','Leitura de Sincronia','Eco de Objetivo']
};

function pick(arr, rng = Math.random) { return arr[Math.floor(rng() * arr.length)]; }
function sample(arr, count, rng = Math.random) {
  const copy = [...arr];
  const out = [];
  while (copy.length && out.length < count) out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
  return out;
}
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function slug(str='') { return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }
function factionValue(name = '') {
  const n = slug(name);
  if (n.includes('heptagrama')) return 'Heptagrama';
  if (n.includes('igreja')) return 'Igreja';
  if (n.includes('transcend')) return 'Transcendencia';
  if (n.includes('mercado')) return 'MercadoNegro';
  if (n.includes('guard')) return 'Guardioes';
  if (n.includes('vazio')) return 'RedeVazio';
  if (n.includes('inteligencia')) return 'Inteligencia';
  if (n.includes('megafavela') || n.includes('clas')) return 'ClasFavelas';
  if (n.includes('biogenesis')) return 'BioGenesis';
  if (n.includes('frota')) return 'FrotaLivre';
  if (n.includes('leitores')) return 'LeitoresVento';
  if (n.includes('medicos')) return 'MedicosSemEscalas';
  if (n.includes('sussurros')) return 'CompanhiaSussurros';
  if (n.includes('sombra')) return 'SombraCorporativa';
  return 'CRA';
}

function difficultyProfile(difficulty) {
  return {
    'Fraco': { base: 1, pool: 12, skill: 6, px: 5, hp: 8, powerChance: .05, defense: 1, damage: 1 },
    'Comum': { base: 2, pool: 16, skill: 10, px: 10, hp: 10, powerChance: .15, defense: 2, damage: 2 },
    'Veterano': { base: 2, pool: 22, skill: 16, px: 30, hp: 16, powerChance: .35, defense: 3, damage: 3 },
    'Elite': { base: 3, pool: 28, skill: 24, px: 60, hp: 24, powerChance: .55, defense: 4, damage: 4 },
    'Boss': { base: 4, pool: 36, skill: 34, px: 120, hp: 42, powerChance: .85, defense: 5, damage: 5 },
    'Lendário': { base: 5, pool: 46, skill: 48, px: 250, hp: 70, powerChance: 1, defense: 7, damage: 7 }
  }[difficulty] || difficultyProfile('Comum');
}

function generateName(rng = Math.random) {
  const origin = pick(Object.keys(FIRST_NAMES), rng);
  const first = pick(FIRST_NAMES[origin], rng);
  const surname = pick(SURNAMES, rng);
  // 20% chance de nome só-codinome cyberpunk.
  if (rng() < .2) return `${pick(FIRST_NAMES.cyberpunk, rng)} ${surname}`;
  return `${first} ${surname}`;
}

function generateAttributes(category, difficulty, rng = Math.random) {
  const profile = CATEGORY_PROFILES[category] || CATEGORY_PROFILES.Civil;
  const diff = difficultyProfile(difficulty);
  const attrs = { FOR: diff.base, AGI: diff.base, RES: diff.base, INT: diff.base, PER: diff.base, PRE: diff.base, TEC: diff.base, ESS: diff.base };
  const keys = Object.keys(attrs);
  let points = diff.pool;
  profile.attrs.forEach((a) => {
    const key = a.toUpperCase();
    const add = difficulty === 'Fraco' ? 1 : difficulty === 'Comum' ? 1 : 2;
    attrs[key] = clamp(attrs[key] + add, 1, difficulty === 'Lendário' ? 9 : 7);
    points -= add;
  });
  while (points > 0) {
    const key = pick(keys, rng);
    const max = difficulty === 'Lendário' ? 9 : difficulty === 'Boss' ? 8 : 6;
    if (attrs[key] < max) { attrs[key]++; points--; }
    else points--;
  }
  return attrs;
}

function generateSkills(category, difficulty, attrs, rng = Math.random) {
  const profile = CATEGORY_PROFILES[category] || CATEGORY_PROFILES.Civil;
  const diff = difficultyProfile(difficulty);
  const selected = [...new Set([...(profile.skills || []), ...sample(SKILLS, 5, rng)])];
  const skills = {};
  let pool = diff.skill;
  selected.forEach((skill) => {
    if (pool <= 0) return;
    const value = clamp(1 + Math.floor(rng() * (difficulty === 'Fraco' ? 2 : difficulty === 'Comum' ? 3 : 5)), 1, difficulty === 'Lendário' ? 7 : 5);
    skills[skill] = value;
    pool -= value;
  });
  while (pool > 0) {
    const skill = pick(selected, rng);
    skills[skill] = clamp((skills[skill] || 0) + 1, 1, difficulty === 'Lendário' ? 7 : 5);
    pool--;
  }
  return skills;
}

function generatePowers(category, difficulty, rng = Math.random) {
  const diff = difficultyProfile(difficulty);
  if (rng() > diff.powerChance) return [];
  let list = [];
  if (['Hacker','Agente CRA','Executivo Corporativo'].includes(category)) list = POWERS.tech;
  else if (['Mercenário','Soldado','Elite','Chefe','Boss'].includes(category)) list = POWERS.combat;
  else if (['Criminoso','Cultista','Andarilho'].includes(category)) list = rng() < .5 ? POWERS.stealth : POWERS.mystic;
  else list = [...POWERS.stealth, ...POWERS.mystic];
  const count = difficulty === 'Lendário' ? 4 : difficulty === 'Boss' ? 3 : difficulty === 'Elite' ? 2 : 1;
  return sample(list, count, rng).map((name, index) => ({ nome: name, nivel: Math.min(5, index + 1 + (difficulty === 'Lendário' ? 2 : difficulty === 'Boss' ? 1 : 0)), custo_sincronia: 1 + index }));
}

function generateEquipment(category, difficulty, rng = Math.random) {
  const profile = CATEGORY_PROFILES[category] || CATEGORY_PROFILES.Civil;
  const base = [...profile.equipment];
  if (['Veterano','Elite','Boss','Lendário'].includes(difficulty)) base.push(pick(['implante ocular','jaqueta blindada','kit médico','drone','lâmina monomolecular','rifle','pistola de plasma'], rng));
  if (['Boss','Lendário'].includes(difficulty)) base.push(pick(['núcleo de Sincronia instável','armadura pesada','IA tática privada','drone de combate pesado'], rng));
  return [...new Set(base)];
}

function generateCombat(attrs, skills, equipment, difficulty) {
  const diff = difficultyProfile(difficulty);
  const firearm = Math.max(skills['Armas de fogo'] || 0, skills.Pistolas || 0, skills.Rifles || 0);
  const melee = Math.max(skills['Corpo a Corpo'] || 0, skills['Artes Marciais'] || 0);
  const weapon = equipment.find((e) => /rifle|plasma|pistola|arma/i.test(e)) || 'arma improvisada';
  const attackPool = Math.max(attrs.AGI + firearm, attrs.FOR + melee, 1);
  const defense = attrs.RES + (skills.Defesa || 0) + diff.defense;
  const dodge = attrs.AGI + (skills.Furtividade || 0);
  return {
    ataques: [
      { nome: `Ataque com ${weapon}`, pool: `${attackPool}d6`, dano: `${diff.damage + Math.ceil(attrs.AGI/2)}d6${diff.damage >= 4 ? '+2' : ''}`, alcance: /rifle/i.test(weapon) ? 'longo' : /pistola|plasma/i.test(weapon) ? 'médio' : 'curto' },
      { nome: 'Ação tática', pool: `${Math.max(attrs.INT, attrs.PER)}d6`, dano: 'efeito narrativo', alcance: 'cena' }
    ],
    defesa: defense,
    esquiva: dodge,
    dano_base: `${diff.damage}d6`,
    armas_equipadas: equipment.filter((e) => /rifle|pistola|arma|lâmina|granada|plasma/i.test(e))
  };
}

function resources(attrs, difficulty) {
  const diff = difficultyProfile(difficulty);
  const hp = attrs.RES * 5 + diff.hp;
  const sincronia = 5 + attrs.ESS + (difficulty === 'Lendário' ? 8 : difficulty === 'Boss' ? 5 : difficulty === 'Elite' ? 3 : 0);
  return {
    HP: hp,
    Sincronia: sincronia,
    PX: diff.px,
    Defesa: attrs.RES + diff.defense,
    Iniciativa: attrs.AGI + attrs.PER
  };
}

export const NPC_STORY_ENGINE = {
  generateHooks(npc = {}) {
    const nome = npc.nome || generateName();
    const faccao = npc.faccao || pick(FACTIONS);
    const segredo = npc.ganchos?.segredo || pick(CONFLICTS);
    return {
      missoes: [
        `${nome} contrata os jogadores para recuperar uma memória roubada antes que a ${faccao} a leiloe.`,
        `Um contato pede que o grupo escolte ${nome} por três setores sem acionar sensores de Sincronia.`,
        `${nome} sabe onde está uma pista do Objetivo Existencial de um personagem, mas exige um favor moralmente ambíguo.`
      ],
      rumores: [
        `Dizem que ${nome} já morreu uma vez e voltou com outro registro CRA.`,
        `Há quem jure que ${nome} consegue ouvir falhas na realidade quando chove neon.`,
        `O apelido de ${nome} aparece em contratos antigos da Heptagrama.`
      ],
      conspiracoes: [
        `A ${faccao} usa ${nome} como peça descartável em um teste de Ascensão induzida.`,
        `${nome} carrega uma chave quântica que abre um arquivo com nomes de personagens e seus futuros prováveis.`,
        `Um culto acredita que sacrificar ${nome} aproximará a Última Pergunta.`
      ],
      conexoes_com_jogadores: [
        `${nome} reconhece um dos personagens de uma vida que ele não lembra ter vivido.`,
        `${nome} possui uma mensagem gravada por alguém amado por um personagem.`,
        `Um Objetivo Existencial dos jogadores cruza com o segredo: ${segredo}.`
      ],
      objetivos_secretos: [
        `Entregar uma prova contra a própria facção sem ser detectado.`,
        `Descobrir se sua memória de infância é real ou fabricada.`,
        `Fazer os jogadores ativarem um evento de Sincronia que ele não consegue iniciar sozinho.`
      ]
    };
  }
};

export const NPC_ENGINE = {
  categories: CATEGORIES,
  difficulties: DIFFICULTIES,
  generate(options = {}) {
    const rng = options.rng || Math.random;
    const categoria = options.categoria && options.categoria !== 'Aleatório' ? options.categoria : pick(CATEGORIES, rng);
    const dificuldade = options.dificuldade && options.dificuldade !== 'Aleatório' ? options.dificuldade : pick(DIFFICULTIES, rng);
    const nome = options.nome || generateName(rng);
    const profile = CATEGORY_PROFILES[categoria] || CATEGORY_PROFILES.Civil;
    const faccao = pick(profile.factionBias || FACTIONS, rng);
    const atributos = generateAttributes(categoria, dificuldade, rng);
    const pericias = generateSkills(categoria, dificuldade, atributos, rng);
    const equipamentos = generateEquipment(categoria, dificuldade, rng);
    const poderes = generatePowers(categoria, dificuldade, rng);
    const recursos = resources(atributos, dificuldade);
    const combate = generateCombat(atributos, pericias, equipamentos, dificuldade);
    const ganchos = {
      segredo: pick(CONFLICTS, rng),
      medo: pick(FEARS, rng),
      desejo: pick(DESIRES, rng),
      conflito: pick(CONFLICTS, rng)
    };
    const npc = {
      engine: 'NPC_ENGINE',
      id_local: `npc-${Date.now()}-${Math.floor(rng()*9999)}`,
      nome,
      apelido: pick(ALIASES, rng),
      idade: Math.floor(18 + rng() * 62),
      sexo: pick(['feminino','masculino','não-binário','androide social','indefinido por modificação corporal'], rng),
      origem: pick(ORIGINS, rng),
      faccao,
      categoria,
      dificuldade,
      personalidade: pick(PERSONALITIES, rng),
      objetivo_atual: pick(OBJECTIVES, rng),
      atributos,
      recursos,
      pericias,
      equipamentos,
      poderes,
      descricao_narrativa: {
        aparencia: pick(APPEARANCES, rng),
        maneirismos: pick(MANNERISMS, rng),
        voz: pick(VOICES, rng),
        comportamento: `${pick(PERSONALITIES, rng)}; reage à violência tentando ${pick(['negociar primeiro','assumir cobertura','usar um refém social','acionar contatos','escapar por rotas preparadas'], rng)}.`
      },
      ganchos,
      relacionamentos: {
        aliado: `${generateName(rng)} — ${pick(['informante','ex-amante','médica de campo','operador de drone','sacerdote de dados'], rng)}`,
        inimigo: `${generateName(rng)} — ${pick(['cobrador','agente rival','executivo traído','caçador de recompensas','cultista obsessivo'], rng)}`,
        contato: `${generateName(rng)} — ${pick(['vende identidades','apaga registros','trafica implantes','ouve rumores da CRA','abre portas fechadas'], rng)}`
      },
      combate,
      story: NPC_STORY_ENGINE.generateHooks({ nome, faccao, ganchos }),
      criado_em_local: new Date().toISOString()
    };
    return npc;
  },

  generateBoss(options = {}) {
    const npc = this.generate({ ...options, categoria: options.categoria || 'Chefe', dificuldade: options.dificuldade || 'Boss' });
    npc.titulo = pick(['O Bispo de Cromo','A Diretora do Vazio','O Cão do Registro','A Santa dos Circuitos','O Arquiteto da Chuva','A Rainha da Baía 9']);
    npc.historia_curta = `${npc.nome}, chamado ${npc.titulo}, nasceu em ${npc.origem} e transformou uma falha de Sincronia em império pessoal. Agora busca ${npc.objetivo_atual}, mesmo que isso fragmente um distrito inteiro.`;
    npc.poder_especial = pick(['Ordem de Registro: força um alvo a repetir a última ação.', 'Campo de Dissonância: reduz Sincronia de todos em curto alcance.', 'Avatar de Dados: age através de drones e telas por uma cena.', 'Contrato Neural: quem aceita uma oferta sofre marca se quebrar a palavra.', 'Pulso de Ascensão: cura HP ao revelar um segredo verdadeiro.']);
    npc.fraqueza_oculta = pick(['não consegue ferir alguém que sabe seu nome de nascimento', 'seu núcleo de Sincronia falha diante de música analógica', 'um clone arrependido possui sua chave de desligamento', 'seus poderes colapsam em zonas sem rede', 'a própria facção implantou uma trava de obediência']);
    npc.loot = sample(['chave quântica', 'arma assinatura', 'núcleo de Sincronia', 'contrato de facção', 'implante ocular lendário', 'mapa de laboratório oculto', 'drone elite', 'memória cristalizada'], 3);
    npc.categoria = 'Chefe';
    return npc;
  },

  generateGroup(options = {}) {
    const categoria = options.categoria && options.categoria !== 'Aleatório' ? options.categoria : pick(['Mercenário','Criminoso','Soldado','Membro de Facção']);
    const pattern = options.pattern || pick([
      [{ role:'Líder', dificuldade:'Elite', count:1 }, { role:categoria, dificuldade:'Veterano', count:2 }, { role:'Criminoso', dificuldade:'Comum', count:5 }],
      [{ role:'Mercenário', dificuldade:'Comum', count:3 }, { role:'Hacker', dificuldade:'Veterano', count:1 }, { role:'Elite', dificuldade:'Fraco', count:1, drone:true }],
      [{ role:'Soldado', dificuldade:'Veterano', count:2 }, { role:'Médico', dificuldade:'Comum', count:1 }, { role:'Policial', dificuldade:'Comum', count:2 }]
    ]);
    const membros = [];
    pattern.forEach((entry) => {
      for (let i = 0; i < entry.count; i++) {
        const npc = this.generate({ categoria: entry.role, dificuldade: entry.dificuldade });
        if (entry.drone) {
          npc.nome = `Drone ${pick(['K-9','Olho','Sentinela','Vespa'])}-${Math.floor(Math.random()*90+10)}`;
          npc.sexo = 'máquina';
          npc.personalidade = 'protocolo tático semi-autônomo';
        }
        membros.push(npc);
      }
    });
    return {
      nome: `Encontro ${categoria} ${new Date().toLocaleTimeString('pt-BR')}`,
      categoria,
      membros,
      resumo: pattern.map((p) => `${p.count} ${p.role}${p.count > 1 ? 's' : ''} (${p.dificuldade})`).join(' + '),
      gancho: pick([
        'O grupo protege um carregamento de memórias ilegais.',
        'Eles caçam alguém com o mesmo Objetivo Existencial de um jogador.',
        'O encontro começa como negociação e vira cerco quando a CRA chega.',
        'Um dos membros quer desertar e usa os jogadores como saída.'
      ])
    };
  },

  npcToCharacterData(npc) {
    const attrs = npc.atributos || {};
    const skills = npc.pericias || {};
    const stateSkills = {};
    Object.entries(skills).forEach(([k,v]) => { stateSkills[k] = Number(v) || 1; });
    const appState = {
      name: npc.nome,
      codename: npc.apelido || '',
      archetype: npc.categoria === 'Hacker' ? 'Tecno' : npc.categoria === 'Mercenário' ? 'Guerreiro' : npc.categoria === 'Cultista' ? 'Buscador' : 'Sombra',
      faction: factionValue(npc.faccao || 'CRA'),
      concept: `${npc.personalidade}. Objetivo atual: ${npc.objetivo_atual}`,
      advantages: (npc.poderes || []).map((p) => `• Poder: ${p.nome}`).join('\n'),
      disadvantages: `• Medo: ${npc.ganchos?.medo || ''}\n• Conflito: ${npc.ganchos?.conflito || ''}`,
      attributes: {
        for: attrs.FOR || 2, agi: attrs.AGI || 2, res: attrs.RES || 2, int: attrs.INT || 2,
        per: attrs.PER || 2, pre: attrs.PRE || 2, tec: attrs.TEC || 2, ess: attrs.ESS || 2
      },
      skills: stateSkills,
      powersAcquired: [],
      hp: { current: npc.recursos?.HP || 20, maxOverride: npc.recursos?.HP || 20 },
      sinc: { current: npc.recursos?.Sincronia || 9 },
      px: { total: npc.recursos?.PX || 0, spent: 0 },
      credits: 0,
      clues: {
        dream: npc.ganchos?.segredo || '', name: npc.relacionamentos?.inimigo || '', place: npc.origem || '', object: (npc.equipamentos || [])[0] || '', phrase: npc.objetivo_atual || ''
      },
      connections: { strong: npc.relacionamentos?.aliado || '', complex: npc.relacionamentos?.contato || '' },
      centralQuestion: npc.ganchos?.desejo || 'Quem sou eu quando ninguém registra minha existência?',
      master: {
        trueObjective: npc.objetivo_atual || '', falseClues: npc.ganchos?.segredo || '', campaignNotes: npc.historia_curta || npc.story?.conspiracoes?.[0] || '', proximity: 30,
        influence: { cra: 0, hepta: 0, igreja: 0, mercado: 0 }
      },
      inventory: []
    };
    return {
      'char-name': npc.nome,
      'char-codename': npc.apelido || '',
      'char-concept': appState.concept,
      'hp-current': appState.hp.current,
      'hp-max': appState.hp.maxOverride,
      'sinc-current': appState.sinc.current,
      'px-total-input': appState.px.total,
      'master-campaign-notes': appState.master.campaignNotes,
      __appState: appState,
      __meta: { schema: 'ascensao-universal-v1', source: 'NPC_ENGINE', exportedAt: new Date().toISOString() }
    };
  },

  async enrichWithAI(npc, enhancer) {
    // Ponto de extensão futuro: passe uma função enhancer(npc) que chame seu endpoint privado de IA.
    // Sem enhancer, o NPC procedural local permanece totalmente funcional.
    if (typeof enhancer !== 'function') return npc;
    const enriched = await enhancer(JSON.parse(JSON.stringify(npc)));
    return enriched || npc;
  },

  fromCharacterData(sheetData = {}) {
    const state = sheetData.__appState || {};
    const nome = sheetData['char-name'] || state.name || 'Personagem convertido';
    return {
      engine: 'NPC_ENGINE',
      nome,
      apelido: sheetData['char-codename'] || state.codename || '',
      idade: 30,
      sexo: 'indefinido',
      origem: sheetData['clue-place'] || state.clues?.place || 'Origem desconhecida',
      faccao: sheetData['char-faction'] || state.faction || 'Sem facção',
      categoria: 'Membro de Facção',
      dificuldade: (Number(sheetData['px-total-input'] || state.px?.total || 0) >= 151) ? 'Elite' : 'Veterano',
      personalidade: sheetData['char-concept'] || state.concept || '',
      objetivo_atual: state.master?.trueObjective || sheetData['central-question'] || state.centralQuestion || '',
      atributos: {
        FOR: state.attributes?.for || 2, AGI: state.attributes?.agi || 2, RES: state.attributes?.res || 2, INT: state.attributes?.int || 2,
        PER: state.attributes?.per || 2, PRE: state.attributes?.pre || 2, TEC: state.attributes?.tec || 2, ESS: state.attributes?.ess || 2
      },
      recursos: {
        HP: Number(sheetData['hp-current'] || state.hp?.current || 20),
        Sincronia: Number(sheetData['sinc-current'] || state.sinc?.current || 9),
        PX: Number(sheetData['px-total-input'] || state.px?.total || 0),
        Defesa: 0,
        Iniciativa: 0
      },
      pericias: state.skills || {},
      equipamentos: state.inventory || [],
      poderes: state.powersAcquired || [],
      descricao_narrativa: { aparencia: '', maneirismos: '', voz: '', comportamento: '' },
      ganchos: { segredo: state.master?.falseClues || '', medo: '', desejo: '', conflito: state.master?.campaignNotes || '' },
      relacionamentos: { aliado: state.connections?.strong || '', inimigo: '', contato: state.connections?.complex || '' },
      story: NPC_STORY_ENGINE.generateHooks({ nome })
    };
  }
};

if (typeof window !== 'undefined') {
  window.NPC_ENGINE = NPC_ENGINE;
  window.NPC_STORY_ENGINE = NPC_STORY_ENGINE;
}
