'use strict';

/* ============================================================
   ⚗️ DUELO QUÍMICO — script.js
   Jogo 1v1 por turnos via PeerJS (WebRTC DataChannel).

   Por que TURNOS e não tempo real?
   → Em P2P, turnos eliminam condições de corrida: só existe
     UMA mensagem de jogo em trânsito por vez ("ataque"), e o
     DataChannel confiável/ordenado garante entrega em ordem.
     Cada lado aplica o mesmo dano recebido na mensagem, então
     os HPs nunca divergem.
============================================================ */

/* ============================================================
   1) DICIONÁRIO QUÍMICO (fonte de verdade da validação)
   Para adicionar compostos, basta incluir aqui — o guia e a
   validação se atualizam sozinhos. (Nomes sem acento; a
   normalização cuida do que o jogador digitar.)
============================================================ */
const dicionarioQuimico = {
  acidos: {
    facil: [
      "acido cloridrico",
      "acido sulfurico",
      "acido nitrico",
      "acido acetico",
      "acido fluoridrico",
      "acido carbonico"
    ],
    medio: [
      "acido fosforico",
      "acido cianidrico",
      "acido sulfuroso",
      "acido nitroso",
      "acido bromidrico",
      "acido iodidrico"
    ],
    dificil: [
      "acido perclorico",
      "acido benzoico",
      "acido oxalico",
      "acido acetilsalicilico",
      "acido picrico",
      "acido formico",
      "acido permanganico"
    ]
  },
  bases: {
    facil: [
      "hidroxido de sodio",
      "hidroxido de calcio",
      "amonia",
      "hidroxido de potassio",
      "hidroxido de magnesio"
    ],
    medio: [
      "hidroxido de aluminio",
      "hidroxido de amonio",
      "hidroxido de bario",
      "hidroxido de litio",
      "hidroxido de zinco"
    ],
    dificil: [
      "hidroxido de ferro iii",
      "hidroxido de cobre ii",
      "metilamina",
      "piridina",
      "anilina",
      "hidroxido de chumbo iv"
    ]
  }
};

/* Nome bonito (com acentos) + fórmula, para exibição no log e no guia.
   Chave = nome normalizado. Entradas ausentes caem no Title Case. */
const FICHAS = {
  // Ácidos — fácil
  'acido cloridrico':        ['Ácido Clorídrico', 'HCl'],
  'acido sulfurico':         ['Ácido Sulfúrico', 'H₂SO₄'],
  'acido nitrico':           ['Ácido Nítrico', 'HNO₃'],
  'acido acetico':           ['Ácido Acético', 'CH₃COOH'],
  'acido fluoridrico':       ['Ácido Fluorídrico', 'HF'],
  'acido carbonico':         ['Ácido Carbônico', 'H₂CO₃'],
  // Ácidos — médio
  'acido fosforico':         ['Ácido Fosfórico', 'H₃PO₄'],
  'acido cianidrico':        ['Ácido Cianídrico', 'HCN'],
  'acido sulfuroso':         ['Ácido Sulfuroso', 'H₂SO₃'],
  'acido nitroso':           ['Ácido Nitroso', 'HNO₂'],
  'acido bromidrico':        ['Ácido Bromídrico', 'HBr'],
  'acido iodidrico':         ['Ácido Iodídrico', 'HI'],
  // Ácidos — difícil
  'acido perclorico':        ['Ácido Perclórico', 'HClO₄'],
  'acido benzoico':          ['Ácido Benzoico', 'C₆H₅COOH'],
  'acido oxalico':           ['Ácido Oxálico', 'H₂C₂O₄'],
  'acido acetilsalicilico':  ['Ácido Acetilsalicílico', 'C₉H₈O₄'],
  'acido picrico':           ['Ácido Pícrico', 'C₆H₃N₃O₇'],
  'acido formico':           ['Ácido Fórmico', 'HCOOH'],
  'acido permanganico':      ['Ácido Permangânico', 'HMnO₄'],
  // Bases — fácil
  'hidroxido de sodio':      ['Hidróxido de Sódio', 'NaOH'],
  'hidroxido de calcio':     ['Hidróxido de Cálcio', 'Ca(OH)₂'],
  'amonia':                  ['Amônia', 'NH₃'],
  'hidroxido de potassio':   ['Hidróxido de Potássio', 'KOH'],
  'hidroxido de magnesio':   ['Hidróxido de Magnésio', 'Mg(OH)₂'],
  // Bases — médio
  'hidroxido de aluminio':   ['Hidróxido de Alumínio', 'Al(OH)₃'],
  'hidroxido de amonio':     ['Hidróxido de Amônio', 'NH₄OH'],
  'hidroxido de bario':      ['Hidróxido de Bário', 'Ba(OH)₂'],
  'hidroxido de litio':      ['Hidróxido de Lítio', 'LiOH'],
  'hidroxido de zinco':      ['Hidróxido de Zinco', 'Zn(OH)₂'],
  // Bases — difícil
  'hidroxido de ferro iii':  ['Hidróxido de Ferro III', 'Fe(OH)₃'],
  'hidroxido de cobre ii':   ['Hidróxido de Cobre II', 'Cu(OH)₂'],
  'metilamina':              ['Metilamina', 'CH₃NH₂'],
  'piridina':                ['Piridina', 'C₅H₅N'],
  'anilina':                 ['Anilina', 'C₆H₅NH₂'],
  'hidroxido de chumbo iv':  ['Hidróxido de Chumbo IV', 'Pb(OH)₄']
};

/* ============================================================
   2) CONFIGURAÇÃO
============================================================ */
const HP_INICIAL = 100;
const DANO_NIVEL = { facil: 10, medio: 15, dificil: 20 };
const MULT_NEUTRALIZACAO = 1.5;               // ácido responde base (e vice-versa) → dano ×1,5
const PERCENTUAL_CURA    = 0.30;              // neutralização recupera 30 % do dano BASE (arredondado)
const PEER_PREFIX = 'duelo-quimico-';         // "namespace" no broker público do PeerJS
const TIMEOUT_ENTRAR_MS = 12000;

/* ============================================================
   2b) PERSONAGENS — 12 químicos históricos com movesets corretos
       Chaves usam o nome completo normalizado, igual ao dicionário:
       ácidos → "acido cloridrico" | bases → "hidroxido de sodio"
============================================================ */
const PERSONAGENS = [
  {
    nome: 'Antoine Lavoisier',
    subtitulo: 'Pai da Química Moderna · França, séc. XVIII',
    emoji: '⚗️',
    cor: '#8B0000',
    descricao: 'Nomeou os ácidos, descobriu o oxigênio na acidificação. Domina ácidos clássicos com precisão aristocrática.',
    moveset: [
      'acido cloridrico', 'acido sulfurico', 'acido nitrico', 'acido acetico',
      'acido fosforico', 'acido bromidrico', 'acido sulfuroso', 'acido nitroso'
    ]
  },
  {
    nome: 'Dmitri Mendeleev',
    subtitulo: 'Pai da Tabela Periódica · Rússia, séc. XIX',
    emoji: '📋',
    cor: '#1A237E',
    descricao: 'Organizou todos os elementos por grupos. Arsenal de hidróxidos representando cada família metálica.',
    moveset: [
      'hidroxido de sodio', 'hidroxido de potassio', 'hidroxido de calcio', 'hidroxido de magnesio',
      'hidroxido de aluminio', 'hidroxido de bario', 'hidroxido de litio', 'hidroxido de zinco'
    ]
  },
  {
    nome: 'Marie Curie',
    subtitulo: 'Pioneira da Radioatividade · Polônia/França, séc. XIX–XX',
    emoji: '☢️',
    cor: '#880E4F',
    descricao: 'Dupla Nobel. Usa apenas compostos avançados de potência máxima — nível difícil em todos os ataques.',
    moveset: [
      'acido perclorico', 'acido picrico', 'acido permanganico', 'acido formico',
      'hidroxido de ferro iii', 'hidroxido de cobre ii', 'hidroxido de chumbo iv', 'metilamina'
    ]
  },
  {
    nome: 'John Dalton',
    subtitulo: 'Pai da Teoria Atômica · Inglaterra, séc. XVIII–XIX',
    emoji: '⚛️',
    cor: '#37474F',
    descricao: 'Propôs o átomo moderno e estudou cores (era daltônico). Arsenal equilibrado de ácidos e bases fundamentais.',
    moveset: [
      'acido cloridrico', 'hidroxido de sodio', 'acido sulfurico', 'hidroxido de calcio',
      'acido nitrico', 'hidroxido de potassio', 'acido acetico', 'amonia'
    ]
  },
  {
    nome: 'Linus Pauling',
    subtitulo: 'Rei das Ligações Químicas · EUA, séc. XX',
    emoji: '🔬',
    cor: '#1B5E20',
    descricao: 'Duplo Nobel. Especialista em ácidos orgânicos e bases moleculares — vitamina C, ligações covalentes.',
    moveset: [
      'acido acetico', 'acido benzoico', 'acido oxalico', 'acido formico',
      'acido acetilsalicilico', 'anilina', 'piridina', 'acido carbonico'
    ]
  },
  {
    nome: 'Robert Boyle',
    subtitulo: 'Fundador da Química Científica · Irlanda, séc. XVII',
    emoji: '💨',
    cor: '#0D47A1',
    descricao: 'Definiu ácidos e bases como opostos que se neutralizam. Arsenal clássico com ótimo potencial de neutralização.',
    moveset: [
      'acido cloridrico', 'hidroxido de sodio', 'acido sulfurico', 'hidroxido de potassio',
      'acido carbonico', 'amonia', 'acido fosforico', 'hidroxido de calcio'
    ]
  },
  {
    nome: 'Fritz Haber',
    subtitulo: 'Pai da Síntese do Nitrogênio · Alemanha, séc. XIX–XX',
    emoji: '🌱',
    cor: '#33691E',
    descricao: 'Processo Haber-Bosch: fixou o nitrogênio atmosférico. Lidera com compostos nitrogenados e aminas.',
    moveset: [
      'acido nitrico', 'acido nitroso', 'amonia', 'hidroxido de amonio',
      'acido cianidrico', 'metilamina', 'piridina', 'acido fosforico'
    ]
  },
  {
    nome: 'August Kekulé',
    subtitulo: 'Descobridor do Anel Benzênico · Alemanha, séc. XIX',
    emoji: '🔄',
    cor: '#E65100',
    descricao: 'Revelou o anel benzênico num sonho. Arsenal de compostos aromáticos e ácidos orgânicos.',
    moveset: [
      'acido benzoico', 'acido picrico', 'anilina', 'piridina',
      'acido acetico', 'acido acetilsalicilico', 'acido formico', 'acido oxalico'
    ]
  },
  {
    nome: 'Alfred Nobel',
    subtitulo: 'Inventor da Dinamite · Suécia, séc. XIX',
    emoji: '💥',
    cor: '#B71C1C',
    descricao: 'Inventou a dinamite e criou o Prêmio Nobel. Arsenal de oxidantes e ácidos extremamente energéticos.',
    moveset: [
      'acido perclorico', 'acido picrico', 'acido nitrico', 'acido permanganico',
      'acido bromidrico', 'acido iodidrico', 'acido fosforico', 'acido sulfurico'
    ]
  },
  {
    nome: 'Humphry Davy',
    subtitulo: 'Pai da Eletroquímica · Inglaterra, séc. XVIII–XIX',
    emoji: '⚡',
    cor: '#F57F17',
    descricao: 'Isolou sódio, potássio, cálcio, magnésio e bário por eletrólise. Comandante absoluto das bases metálicas.',
    moveset: [
      'hidroxido de sodio', 'hidroxido de potassio', 'hidroxido de calcio', 'hidroxido de bario',
      'hidroxido de litio', 'hidroxido de magnesio', 'hidroxido de aluminio', 'hidroxido de zinco'
    ]
  },
  {
    nome: 'Joseph Priestley',
    subtitulo: 'Descobridor do Oxigênio · Inglaterra, séc. XVIII',
    emoji: '💧',
    cor: '#006064',
    descricao: 'Descobriu o oxigênio e o ácido carbônico (CO₂ em água). Mestre dos ácidos formados por gases dissolvidos.',
    moveset: [
      'acido carbonico', 'acido sulfuroso', 'acido cloridrico', 'acido nitrico',
      'acido fluoridrico', 'acido cianidrico', 'acido sulfurico', 'acido nitroso'
    ]
  },
  {
    nome: 'Svante Arrhenius',
    subtitulo: 'Definidor dos Ácidos e Bases · Suécia, séc. XIX–XX',
    emoji: '⚖️',
    cor: '#4A148C',
    descricao: 'Definiu ácidos como doadores de H⁺ e bases como doadores de OH⁻. Arsenal com os exemplos canônicos de cada tipo.',
    moveset: [
      'acido cloridrico', 'acido sulfurico', 'hidroxido de sodio', 'hidroxido de potassio',
      'acido fosforico', 'hidroxido de calcio', 'hidroxido de aluminio', 'amonia'
    ]
  }
];

/** pH aproximado de cada composto (0–14).
 *  Chaves idênticas ao dicionário (nome completo normalizado). */
const PH_VALS = {
  'acido perclorico': 0.0, 'acido cloridrico': 0.3, 'acido sulfurico': 0.3,
  'acido nitrico': 0.3, 'acido bromidrico': 0.3, 'acido iodidrico': 0.3,
  'acido picrico': 0.4, 'acido permanganico': 0.5, 'acido oxalico': 1.3,
  'acido fosforico': 1.5, 'acido sulfuroso': 2.1, 'acido formico': 2.3,
  'acido acetilsalicilico': 2.4, 'acido nitroso': 2.8, 'acido acetico': 2.9,
  'acido benzoico': 3.0, 'acido fluoridrico': 3.2, 'acido carbonico': 3.8,
  'acido cianidrico': 5.1,
  'anilina': 8.7, 'piridina': 9.1,
  'hidroxido de aluminio': 9.5, 'hidroxido de zinco': 9.5,
  'hidroxido de cobre ii': 9.0, 'hidroxido de ferro iii': 10.5,
  'hidroxido de chumbo iv': 10.5, 'hidroxido de magnesio': 10.5,
  'amonia': 11.1, 'hidroxido de amonio': 11.0, 'metilamina': 11.8,
  'hidroxido de calcio': 12.4, 'hidroxido de bario': 13.0,
  'hidroxido de litio': 13.5, 'hidroxido de potassio': 13.7,
  'hidroxido de sodio': 14.0
};

/* ──────────────────────────────────────────────────────────
   SPRITE_PARAMS — cores visuais por personagem (12 entradas)
   Aplicadas via substituição de atributos fill= no SVG.
   Cada personagem tem: hair, shirt1, shirt2, goggle1,
   goggle2, flask1, flask2.
────────────────────────────────────────────────────────── */
const SPRITE_PARAMS = [
  // 0 Lavoisier — peruca empoada branca, jaleco bordô, frasco laranja
  { hair:'#EEE8CC', shirt1:'#8B0000', shirt2:'#5A0000', goggle1:'#8B0000', goggle2:'#C0392B', flask1:'#FF8C00', flask2:'#FFB347' },
  // 1 Mendeleev — cabelo/barba castanho-escuro, jaleco azul marinho, frasco roxo
  { hair:'#3E2B1A', shirt1:'#1A237E', shirt2:'#0D1652', goggle1:'#283593', goggle2:'#3F51B5', flask1:'#7C4DFF', flask2:'#B39DDB' },
  // 2 Marie Curie — cabelo preto, jaleco magenta, frasco verde radioativo
  { hair:'#1A1A1A', shirt1:'#880E4F', shirt2:'#560032', goggle1:'#AD1457', goggle2:'#E91E8C', flask1:'#00C853', flask2:'#69F0AE' },
  // 3 Dalton — cabelo grisalho (daltônico), jaleco cinza aço, frasco cinza
  { hair:'#90A4AE', shirt1:'#37474F', shirt2:'#1C313A', goggle1:'#546E7A', goggle2:'#78909C', flask1:'#B0BEC5', flask2:'#ECEFF1' },
  // 4 Pauling — cabelo preto, jaleco verde escuro, frasco âmbar (vitamina C)
  { hair:'#1A1A1A', shirt1:'#1B5E20', shirt2:'#0A3A10', goggle1:'#2E7D32', goggle2:'#4CAF50', flask1:'#FF6F00', flask2:'#FFA000' },
  // 5 Boyle — cabelo castanho-avermelhado, jaleco azul escuro, frasco azul-claro
  { hair:'#5D4037', shirt1:'#0D47A1', shirt2:'#072B80', goggle1:'#1565C0', goggle2:'#1E88E5', flask1:'#81D4FA', flask2:'#B3E5FC' },
  // 6 Haber — cabelo preto, jaleco verde oliva, frasco verde-amarelado (amônia)
  { hair:'#212121', shirt1:'#33691E', shirt2:'#1B390A', goggle1:'#558B2F', goggle2:'#8BC34A', flask1:'#C6EF4A', flask2:'#E6FF82' },
  // 7 Kekulé — cabelo castanho, jaleco âmbar/laranja (benzeno), frasco dourado
  { hair:'#4E342E', shirt1:'#E65100', shirt2:'#9C3300', goggle1:'#EF6C00', goggle2:'#FF9800', flask1:'#FDD835', flask2:'#FFF59D' },
  // 8 Nobel — cabelo castanho-avermelhado, jaleco vermelho sangue, frasco amarelo (nitroglicerina)
  { hair:'#6D4C41', shirt1:'#B71C1C', shirt2:'#7B1111', goggle1:'#C62828', goggle2:'#EF5350', flask1:'#FF7043', flask2:'#FFAB91' },
  // 9 Davy — cabelo castanho, jaleco dourado (eletroquímica), frasco amarelo ouro
  { hair:'#6D4C41', shirt1:'#F57F17', shirt2:'#A35200', goggle1:'#F9A825', goggle2:'#FDD835', flask1:'#FFD600', flask2:'#FFF176' },
  // 10 Priestley — peruca colonial branca, jaleco azul-petróleo (gases), frasco ciano
  { hair:'#F5F5F5', shirt1:'#006064', shirt2:'#003740', goggle1:'#00838F', goggle2:'#00ACC1', flask1:'#80DEEA', flask2:'#E0F7FA' },
  // 11 Arrhenius — cabelo loiro (escandinavo), jaleco roxo profundo, frasco lilás
  { hair:'#FDD835', shirt1:'#4A148C', shirt2:'#280059', goggle1:'#6A1B9A', goggle2:'#9C27B0', flask1:'#CE93D8', flask2:'#EDE7F6' }
];

/* Mapeamento: cor original no SVG do jogador → propriedade do SPRITE_PARAMS */
const SPRITE_PLAYER_MAP = [
  ['fill="#2C1A0E"', 'hair'],
  ['fill="#1565C0"', 'shirt1'],
  ['fill="#0D47A1"', 'shirt2'],
  ['fill="#1D4ED8"', 'goggle1'],
  ['fill="#3B82F6"', 'goggle2'],
  ['fill="#FF6A4D"', 'flask1'],
  ['fill="#FF9A7A"', 'flask2']
];

/* Mapeamento: cor original no SVG do oponente → propriedade do SPRITE_PARAMS */
const SPRITE_OPP_MAP = [
  ['fill="#CFD8DC"', 'hair'],
  ['fill="#D32F2F"', 'shirt1'],
  ['fill="#B71C1C"', 'shirt2'],   // substitui jaleco E lentes externas (mesma cor original)
  ['fill="#EF5350"', 'goggle2'],
  ['fill="#7C4DFF"', 'flask1'],
  ['fill="#CE93FF"', 'flask2']
];
/* ============================================================
   3) UTILITÁRIOS
============================================================ */
const $ = (id) => document.getElementById(id);

/** minúsculas + sem acentos + espaços colapsados → chave de comparação */
function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCase(texto) {
  return texto.replace(/\S+/g, (p) => p.charAt(0).toUpperCase() + p.slice(1));
}

/** IDs de sala: apenas [a-z0-9-], sem hífens nas pontas (regra de ID do PeerJS) */
function sanitizarSala(texto) {
  return normalizar(texto).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
}

function clamp(n, min, max) {
  n = Number(n);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}

/* Índice de busca: chave normalizada → { categoria, nivel } */
const LOOKUP = {};
for (const [catKey, niveis] of Object.entries(dicionarioQuimico)) {
  const categoria = (catKey === 'acidos') ? 'acido' : 'base';
  for (const [nivel, lista] of Object.entries(niveis)) {
    for (const nome of lista) LOOKUP[normalizar(nome)] = { categoria, nivel };
  }
}

function ficha(chave) {
  const f = FICHAS[chave];
  return f ? { nome: f[0], formula: f[1] } : { nome: titleCase(chave), formula: '' };
}

/* ============================================================
   4) ESTADO DO JOGO
============================================================ */
const state = {
  nome: 'Jogador',
  oppNome: 'Oponente',
  peer: null,
  conn: null,
  isHost: false,
  salaId: '',
  meuHP: HP_INICIAL,
  oppHP: HP_INICIAL,
  meuTurno: false,
  emJogo: false,
  fim: false,
  usadas: new Set(),          // compostos que EU já usei (não podem repetir)
  ultimoAtaqueOpp: null,      // 'acido' | 'base' | null → base do bônus de neutralização
  perdiUltima: false,         // quem perdeu começa a revanche
  revanche: { eu: false, opp: false },
  saindo: false,              // saída intencional (não mostrar "desconectado")
  desconectou: false,         // evita tratar a desconexão duas vezes
  joinTimeout: null,
  /* Seleção de personagem */
  charEu: null,              // índice do personagem escolhido pelo jogador
  charOpp: null,             // índice do personagem do oponente
  meuConfirmado: false,      // jogador confirmou na tela de seleção
  oppConfirmado: false,      // oponente confirmou (recebemos a escolha ou o início)
  primeiroSorteiro: null,    // 'host' | 'guest' — sorteado pelo host ao receber 'ola'
  moveset: []                // 8 chaves de compostos do personagem escolhido
};

/* ============================================================
   5) NAVEGAÇÃO DE TELAS
============================================================ */
function mostrarTela(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
}

function fecharOverlays() {
  $('overlay-fim').hidden = true;
  $('modal-guia').hidden = true;
}

/* ============================================================
   6) EFEITOS SONOROS (WebAudio, sem arquivos externos)
============================================================ */
const sfx = (() => {
  let ctx = null;
  let mudo = false;

  function tocar(freq, dur, tipo = 'square', vol = 0.05, atraso = 0) {
    if (mudo) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = tipo;
      o.frequency.value = freq;
      const t0 = ctx.currentTime + atraso;
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    } catch (e) { /* áudio é opcional */ }
  }

  return {
    click()   { tocar(880, 0.05, 'square', 0.03); },
    acerto()  { tocar(660, 0.09); tocar(990, 0.12, 'square', 0.05, 0.08); },
    dano()    { tocar(160, 0.25, 'sawtooth', 0.06); },
    falha()   { tocar(330, 0.12, 'triangle'); tocar(220, 0.18, 'triangle', 0.05, 0.10); },
    vitoria() { [523, 659, 784, 1047].forEach((f, i) => tocar(f, 0.18, 'square', 0.05, i * 0.13)); },
    derrota() { [392, 330, 262, 196].forEach((f, i) => tocar(f, 0.20, 'sawtooth', 0.05, i * 0.15)); },
    alternar() { mudo = !mudo; return mudo; }
  };
})();

/* ============================================================
   7) MENU E LOBBY (criação/entrada de salas via PeerJS)
============================================================ */
function pegarNome() {
  const n = $('input-nome').value.trim().slice(0, 20);
  return n || ('Jogador ' + Math.floor(Math.random() * 900 + 100));
}

function statusMenu(msg, tipo = 'erro') {
  const el = $('menu-status');
  el.textContent = msg || '';
  el.className = 'status ' + (tipo === 'erro' ? 'erro' : 'info');
}

function gerarIdAleatorio() {
  const elementos = ['h', 'he', 'li', 'na', 'k', 'ca', 'fe', 'cu', 'zn', 'ag', 'au', 'mg', 'al', 'cl', 'ne'];
  const el = elementos[Math.floor(Math.random() * elementos.length)];
  return `sala-${el}-${Math.floor(Math.random() * 900 + 100)}`;
}

/** Cria um Peer novo (destruindo o anterior) com tratamento de erros e reconexão ao broker */
function novoPeer(id) {
  destruirConexao(false);
  const peer = id ? new Peer(id) : new Peer();
  state.peer = peer;

  // Se cair a ligação com o servidor de sinalização, tenta voltar.
  // (A conexão P2P já estabelecida NÃO depende do broker e continua viva.)
  peer.on('disconnected', () => {
    try { if (!peer.destroyed) peer.reconnect(); } catch (e) { /* ignora */ }
  });

  peer.on('error', tratarErroPeer);
  return peer;
}

function tratarErroPeer(err) {
  const tipo = err && err.type;
  console.warn('[PeerJS]', tipo, err);
  const msgs = {
    'unavailable-id':       'Este ID de sala já está em uso. Escolha outro.',
    'peer-unavailable':     'Sala não encontrada. Confira o ID e se o anfitrião está com a sala aberta.',
    'network':              'Falha de rede ao contatar o servidor de sinalização. Verifique sua internet.',
    'server-error':         'O servidor de sinalização do PeerJS está indisponível. Tente novamente.',
    'browser-incompatible': 'Seu navegador não tem suporte a WebRTC.',
    'webrtc':               'Erro do WebRTC ao negociar a conexão P2P.',
    'socket-error':         'Erro de comunicação com o servidor de sinalização.',
    'socket-closed':        'A conexão com o servidor de sinalização foi fechada.'
  };
  const msg = msgs[tipo] || ('Erro de conexão: ' + (tipo || 'desconhecido'));

  if (state.emJogo && !state.fim) {
    logar('info', '⚠️ ' + msg);
    return;
  }
  clearTimeout(state.joinTimeout);
  destruirConexao(false);
  mostrarTela('screen-menu');
  statusMenu(msg);
}

function criarSala() {
  const nomeSala = sanitizarSala($('input-sala-criar').value) || sanitizarSala(gerarIdAleatorio());
  state.nome = pegarNome();
  state.isHost = true;
  state.salaId = nomeSala;
  statusMenu('');

  $('lobby-titulo').textContent = '🧪 Sala criada!';
  $('lobby-codigo').textContent = nomeSala;
  $('lobby-status').textContent = 'Conectando ao servidor…';
  mostrarTela('screen-lobby');

  const peer = novoPeer(PEER_PREFIX + nomeSala);

  peer.on('open', () => {
    $('lobby-status').textContent = 'Aguardando oponente entrar… ⏳';
  });

  peer.on('connection', (c) => {
    if (state.conn) {
      // Sala cheia: avisa o terceiro jogador e fecha educadamente.
      c.on('open', () => {
        try { c.send({ type: 'cheia' }); } catch (e) { /* ignora */ }
        setTimeout(() => { try { c.close(); } catch (e) { /* ignora */ } }, 80);
      });
      return;
    }
    state.conn = c;
    prepararConexao();
  });
}

function entrarSala() {
  const nomeSala = sanitizarSala($('input-sala-entrar').value);
  if (!nomeSala) { statusMenu('Digite o ID da sala para entrar.'); return; }
  state.nome = pegarNome();
  state.isHost = false;
  state.salaId = nomeSala;
  statusMenu('');

  $('lobby-titulo').textContent = '🔗 Entrando na sala…';
  $('lobby-codigo').textContent = nomeSala;
  $('lobby-status').textContent = 'Procurando o anfitrião…';
  mostrarTela('screen-lobby');

  const peer = novoPeer(null); // convidado usa ID aleatório

  peer.on('open', () => {
    const c = peer.connect(PEER_PREFIX + nomeSala, {
      reliable: true,             // DataChannel confiável e ordenado → base da sincronização
      serialization: 'json',
      metadata: { nome: state.nome }
    });
    state.conn = c;
    prepararConexao();

    clearTimeout(state.joinTimeout);
    state.joinTimeout = setTimeout(() => {
      if (!state.emJogo && (!state.conn || !state.conn.open)) {
        tratarErroPeer({ type: 'peer-unavailable' });
      }
    }, TIMEOUT_ENTRAR_MS);
  });
}

async function copiarCodigo() {
  const txt = $('lobby-codigo').textContent;
  const btn = $('btn-copiar');
  try {
    await navigator.clipboard.writeText(txt);
    btn.textContent = '✅ Copiado!';
  } catch (e) {
    // Fallback para contextos sem Clipboard API (ex.: file:// em alguns navegadores)
    const ta = document.createElement('textarea');
    ta.value = txt;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); btn.textContent = '✅ Copiado!'; }
    catch (e2) { btn.textContent = '❌ Copie manualmente'; }
    ta.remove();
  }
  setTimeout(() => { btn.textContent = '📋 Copiar'; }, 1600);
}

/* ============================================================
   8) CONEXÃO P2P — handshake e troca de mensagens
   Protocolo:
   ola      (convidado→anfitrião): { nome }
   inicio   (anfitrião→convidado): { nome, primeiro: 'host'|'guest' }
   ataque   (ambos):               { ok, chave?, nome?, formula?, categoria?, nivel?, dano?, neutralizou?, texto? }
   revanche (ambos):               {}
   saiu     (ambos):               {}
   cheia    (anfitrião→3º peer):   {}
============================================================ */
function prepararConexao() {
  const c = state.conn;

  c.on('open', () => {
    clearTimeout(state.joinTimeout);
    $('lobby-status').textContent = 'Oponente conectado! Sincronizando… 🤝';
    // AMBOS enviam 'ola' com seu nome — assim os dois chegam à tela de seleção.
    // (No protocolo antigo só o convidado enviava; isso deixava o convidado preso no lobby.)
    enviar({ type: 'ola', nome: state.nome });
  });

  c.on('data', (msg) => {
    try { tratarMensagem(msg); }
    catch (e) { console.error('Erro ao tratar mensagem:', e); }
  });

  c.on('close', tratarDesconexao);
  c.on('error', (e) => console.warn('[conn]', e));
}

function enviar(obj) {
  try {
    if (state.conn && state.conn.open) state.conn.send(obj);
  } catch (e) { console.warn('Falha ao enviar:', e); }
}

function tratarMensagem(msg) {
  if (!msg || typeof msg !== 'object') return;

  switch (msg.type) {
    case 'ola': { // ambos recebem 'ola' — vão para a tela de seleção de personagem
      if (state.emJogo) return;
      state.oppNome = String(msg.nome || 'Oponente').slice(0, 20) || 'Oponente';
      state.meuConfirmado = false;
      state.oppConfirmado = false;
      state.charEu = null;
      state.charOpp = null;
      if (state.isHost) {
        // Host sorteia agora quem vai começar; aplica depois de ambos confirmarem
        state.primeiroSorteiro = Math.random() < 0.5 ? 'host' : 'guest';
      }
      mostrarTelaSelecao();
      break;
    }

    case 'escolha': { // HOST recebe a escolha de personagem do CONVIDADO
      if (!state.isHost) return;
      state.charOpp = msg.char ?? null;
      state.oppConfirmado = true;
      $('sel-opp-status').textContent = `✔ ${state.oppNome} escolheu seu personagem!`;
      if (state.meuConfirmado) enviarInicio();
      break;
    }

    case 'inicio': { // convidado recebe o sorteio + personagem do HOST
      // Permite processar durante seleção de revanche (emJogo foi zerado em reiniciarPartida)
      if (state.isHost || (state.emJogo && !state.fim)) return;
      state.oppNome = String(msg.nome || 'Oponente').slice(0, 20) || 'Oponente';
      state.charOpp = msg.charHost ?? null;
      state.primeiroSorteiro = msg.primeiro;
      state.oppConfirmado = true;
      if (state.meuConfirmado) {
        iniciarBatalhaComSelecao();
      }
      // else: espera o convidado confirmar (o confirmarSelecao() vai disparar)
      break;
    }

    case 'ataque':
      receberAtaque(msg);
      break;

    case 'revanche': {
      state.revanche.opp = true;
      if (state.revanche.eu) {
        reiniciarPartida();
      } else {
        $('rev-status').textContent = `🔔 ${state.oppNome} quer revanche! Clique em "Pedir revanche" para aceitar.`;
        $('btn-revanche').classList.add('pulse');
      }
      break;
    }

    case 'saiu':
      tratarDesconexao();
      break;

    case 'cheia': {
      state.saindo = true; // o fechamento a seguir não é uma "queda"
      destruirConexao(true);
      statusMenu('Esta sala já está cheia (2/2). Tente outra sala.');
      break;
    }
  }
}

function tratarDesconexao() {
  if (state.saindo || state.desconectou || !state.conn) return;
  state.desconectou = true;
  clearTimeout(state.joinTimeout);

  // Caiu antes de a batalha começar (lobby/handshake)
  if (!state.emJogo && !state.fim) {
    destruirConexao(false);
    mostrarTela('screen-menu');
    statusMenu('A conexão foi encerrada antes de a partida começar.');
    return;
  }

  // Já estava na tela de fim de jogo: só bloqueia a revanche
  if (state.fim) {
    $('rev-status').textContent = '🔌 O oponente saiu da sala. Revanche indisponível.';
    $('btn-revanche').disabled = true;
    return;
  }

  // Caiu no meio da batalha → vitória por W.O.
  state.fim = true;
  state.perdiUltima = false;
  atualizarTurno();
  logar('info', `🔌 ${state.oppNome} desconectou.`);
  sfx.vitoria();
  abrirFim('🔌 Oponente desconectado', `${state.oppNome} saiu ou perdeu a conexão. Vitória por W.O.!`, true);
}

function sairDaPartida() {
  state.saindo = true;
  enviar({ type: 'saiu' });
  setTimeout(() => destruirConexao(true), 120); // dá tempo de a mensagem sair
}

function destruirConexao(voltarMenu) {
  clearTimeout(state.joinTimeout);
  state.joinTimeout = null;
  try { if (state.conn) state.conn.close(); } catch (e) { /* ignora */ }
  try { if (state.peer && !state.peer.destroyed) state.peer.destroy(); } catch (e) { /* ignora */ }
  state.conn = null;
  state.peer = null;
  state.emJogo = false;
  state.fim = false;
  state.saindo = false;
  state.desconectou = false;
  if (voltarMenu) {
    fecharOverlays();
    mostrarTela('screen-menu');
  }
}

/* ============================================================
   9) BATALHA — turnos, ataques, dano e neutralização
============================================================ */
function iniciarBatalha(comecoMeu) {
  state.emJogo = true;
  state.fim = false;
  state.desconectou = false;
  state.meuHP = HP_INICIAL;
  state.oppHP = HP_INICIAL;
  state.usadas.clear();
  state.ultimoAtaqueOpp = null;
  state.revanche = { eu: false, opp: false };
  state.meuTurno = comecoMeu;

  $('nome-eu').textContent  = (PERSONAGENS[state.charEu]?.emoji  ?? '') + ' ' +
                              (PERSONAGENS[state.charEu]?.nome   ?? (state.nome + ' (você)'));
  $('nome-opp').textContent = (PERSONAGENS[state.charOpp]?.emoji ?? '') + ' ' +
                              (PERSONAGENS[state.charOpp]?.nome  ?? state.oppNome);
  $('sala-atual').textContent = state.salaId;
  $('log-lista').innerHTML = '';
  $('erro-ataque').textContent = '';
  $('btn-revanche').disabled = false;
  $('btn-revanche').classList.remove('pulse');

  renderUsadas();
  atualizarHP();
  fecharOverlays();
  resetArena();          // limpa efeitos e animações de batalha anterior
  aplicarVisualPersonagens();  // aplica as cores do personagem nos SVGs da arena
  mostrarTela('screen-batalha');

  logar('info', `⚔️ A batalha começou! ${comecoMeu ? state.nome : state.oppNome} joga primeiro.`);
  atualizarTurno();
}

function atualizarTurno() {
  const banner = $('turno-banner');
  const dica = $('dica-neutra');
  const meu = state.meuTurno && !state.fim && state.emJogo;

  banner.textContent = state.fim
    ? '🏁 Partida encerrada'
    : (meu ? '⚔️ SEU TURNO — escolha um composto!' : `⏳ Turno de ${state.oppNome}…`);
  banner.classList.toggle('meu', meu);

  $('input-ataque').disabled = !meu;
  $('btn-ataque').disabled = !meu;

  // Fecha a grade de movimentos quando não é meu turno
  if (!meu) ocultarMoveGrid();

  if (meu && state.ultimoAtaqueOpp) {
    const foi      = state.ultimoAtaqueOpp === 'acido' ? 'um ÁCIDO 🧪' : 'uma BASE ⚗️';
    const resposta = state.ultimoAtaqueOpp === 'acido' ? 'uma BASE' : 'um ÁCIDO';
    const exCura   = Math.round((DANO_NIVEL.medio || 15) * PERCENTUAL_CURA);
    dica.textContent = `💡 Último ataque: ${foi}. Responda com ${resposta} → NEUTRALIZAR (dano ×1,5 + cura ~${exCura} HP 💚)!`;
  } else {
    dica.textContent = '';
  }
  // (input-ataque está oculto — não fazer focus() para evitar scroll indesejado)
}

function atacar(textoOverride = null) {
  if (!state.meuTurno || state.fim || !state.emJogo) return;

  const bruto = textoOverride !== null ? textoOverride : ($('input-ataque').value || '');
  const chave = normalizar(bruto);

  if (!chave) { avisoInput('Digite o nome de um composto!'); return; }

  // Repetição NÃO consome o turno — apenas avisa (regra: não pode repetir).
  if (state.usadas.has(chave)) {
    avisoInput('Você já usou esse composto nesta partida!');
    return;
  }

  $('input-ataque').value = '';
  $('erro-ataque').textContent = '';
  state.meuTurno = false; // a partir daqui o turno foi consumido

  const info = LOOKUP[chave];

  // ---- Composto inválido: ataque falhou (0 de dano) ----
  if (!info) {
    enviar({ type: 'ataque', ok: false, texto: bruto.trim().slice(0, 40) });
    logar('falha', `❌ ${state.nome} tentou "${bruto.trim()}" — composto inválido. Ataque falhou!`);
    sfx.falha();
    piscar('falha');
    atualizarTurno();
    return;
  }

  // ---- Composto válido ----
  state.usadas.add(chave);
  renderUsadas();

  const f = ficha(chave);
  const danoBase = DANO_NIVEL[info.nivel] || 15;

  // Neutralização: categoria OPOSTA ao último ataque válido do oponente
  const neutralizou = !!state.ultimoAtaqueOpp && state.ultimoAtaqueOpp !== info.categoria;
  const dano = neutralizou ? Math.round(danoBase * MULT_NEUTRALIZACAO) : danoBase;

  // Cura: 30 % do dano BASE (não do dano multiplicado), apenas em neutralizações
  const cura = neutralizou ? Math.round(danoBase * PERCENTUAL_CURA) : 0;

  state.oppHP = Math.max(0, state.oppHP - dano);
  if (cura > 0) state.meuHP = Math.min(HP_INICIAL, state.meuHP + cura);

  atualizarHP();
  flutuarDano(dano, neutralizou);
  if (cura > 0) flutuarCura(cura);

  enviar({
    type: 'ataque',
    ok: true,
    chave,
    nome: f.nome,
    formula: f.formula,
    categoria: info.categoria,
    nivel: info.nivel,
    dano,
    neutralizou,
    cura   // oponente precisa saber que eu curei para atualizar o "oppHP" dele
  });

  const rotulo = info.categoria === 'acido' ? '🧪 ácido' : '⚗️ base';
  logar(
    neutralizou ? 'neutra' : 'acerto',
    `${neutralizou ? '⚡ NEUTRALIZAÇÃO! ' : ''}💥 ${state.nome} atacou com ${f.nome}` +
    `${f.formula ? ` (${f.formula})` : ''} [${rotulo} · ${info.nivel}] e causou ${dano} de dano` +
    `${cura > 0 ? ` e recuperou ${cura} HP 💚` : ''}!`
  );
  piscar(neutralizou && cura > 0 ? 'cura' : 'acerto');
  sfx.acerto();

  // Arena: charge-up → ataque → projétil → hurt do oponente
  const charColor = PERSONAGENS[state.charEu]?.cor ?? '#2fd4a0';
  animarCharge('sci-player', charColor);                          // glow charge-up (WAAPI)
  animPersonagem('anim-player', 'charge', 380);                   // classe CSS charge no wrapper
  setTimeout(() => {
    animPersonagem('anim-player', 'attack', 520);
    lancarProjetil(true, info.categoria, neutralizou);
  }, 150);  // charge dura 150ms antes do lunge
  if (state.oppHP <= 0) { encerrar(true); return; }
  setTimeout(() => animPersonagem('anim-opp', 'hurt', 600), 850); // 150 + ~700ms de voo

  atualizarTurno();
}

function receberAtaque(msg) {
  if (!state.emJogo || state.fim) return;

  if (msg.ok) {
    const dano = clamp(msg.dano, 0, 60);
    // Cura do oponente: validamos para evitar adulteração (máx = 30 % do maior dano possível)
    const cura = (msg.neutralizou && Number.isFinite(msg.cura))
      ? clamp(Math.round(msg.cura), 0, Math.round(DANO_NIVEL.dificil * PERCENTUAL_CURA))
      : 0;

    state.meuHP = Math.max(0, state.meuHP - dano);
    state.ultimoAtaqueOpp = (msg.categoria === 'acido' || msg.categoria === 'base') ? msg.categoria : null;

    // O oponente curou — atualiza nosso "oppHP" para manter os HPs sincronizados
    if (cura > 0) state.oppHP = Math.min(HP_INICIAL, state.oppHP + cura);

    atualizarHP();
    sacudirCard('info-eu');
    piscar('dano');
    sfx.dano();

    const nome = String(msg.nome || '???').slice(0, 40);
    const formula = String(msg.formula || '').slice(0, 24);
    const rotulo = msg.categoria === 'acido' ? '🧪 ácido' : '⚗️ base';
    logar(
      'dano',
      `${msg.neutralizou ? '⚡ NEUTRALIZAÇÃO! ' : ''}💥 ${state.oppNome} atacou com ${nome}` +
      `${formula ? ` (${formula})` : ''} [${rotulo} · ${String(msg.nivel || '')}] e causou ${dano} de dano` +
      `${cura > 0 ? ` e recuperou ${cura} HP 💚` : ''}!`
    );

    if (state.meuHP <= 0) {
      // Golpe fatal: anima o impacto antes de mostrar o overlay de derrota
      animPersonagem('anim-opp', 'attack', 520);
      setTimeout(() => lancarProjetil(false, msg.categoria, msg.neutralizou), 120);
      setTimeout(() => {
        animPersonagem('anim-player', 'hurt', 600);
        tremereArena();                              // tremor da arena no golpe fatal
        encerrar(false);
      }, 700);
      return;
    }

    // Ataque não-fatal: anima normalmente + tremor + ripple
    animPersonagem('anim-opp', 'attack', 520);
    setTimeout(() => lancarProjetil(false, msg.categoria, msg.neutralizou), 120);
    setTimeout(() => {
      animPersonagem('anim-player', 'hurt', 600);
      tremereArena();                                // tremor suave ao receber dano
    }, 700);
  } else {
    state.ultimoAtaqueOpp = null; // nada "ativo" para neutralizar
    logar('falha', `❌ ${state.oppNome} tentou "${String(msg.texto || '').slice(0, 40)}" — ataque falhou!`);
  }

  state.meuTurno = true;
  atualizarTurno();
}

/* ============================================================
   10) FIM DE JOGO E REVANCHE
============================================================ */
function encerrar(venci) {
  state.fim = true;
  state.meuTurno = false;   // zera o turno explicitamente (evita estado inconsistente)
  state.perdiUltima = !venci;
  atualizarTurno();

  // Arena: animação de vitória / derrota dos personagens
  setTimeout(() => {
    animPersonagem(venci ? 'anim-player' : 'anim-opp', 'victory', 0);
    animPersonagem(venci ? 'anim-opp'    : 'anim-player', 'defeat',  0);
  }, 200);

  if (venci) {
    logar('info', `🏆 ${state.nome} venceu a batalha!`);
    sfx.vitoria();
    abrirFim('🏆 VITÓRIA!', `Você reduziu o HP de ${state.oppNome} a zero. A química está do seu lado!`);
  } else {
    logar('info', `💀 ${state.oppNome} venceu a batalha.`);
    sfx.derrota();
    abrirFim('💀 DERROTA', `${state.oppNome} zerou o seu HP. Estude o guia de compostos e peça revanche!`);
  }
}

function abrirFim(titulo, msg, semRevanche = false) {
  $('fim-titulo').textContent = titulo;
  $('fim-msg').textContent = msg;
  $('rev-status').textContent = '';
  $('btn-revanche').disabled = !!semRevanche;
  $('btn-revanche').classList.remove('pulse');
  $('overlay-fim').hidden = false;
}

function pedirRevanche() {
  if (state.revanche.eu || $('btn-revanche').disabled) return;
  state.revanche.eu = true;
  enviar({ type: 'revanche' });
  if (state.revanche.opp) {
    reiniciarPartida();
  } else {
    $('rev-status').textContent = '⏳ Aguardando o oponente aceitar…';
  }
}

function reiniciarPartida() {
  /* ── FSM: GAME_OVER → CHARACTER_SELECTION ──────────────────────
     Toda transição de estado num jogo por turno deve resetar
     completamente as flags do estado anterior.
     
     BUG CORRIGIDO:
     • state.emJogo não estava sendo zerado → bloqueava case 'inicio'
       no Guest (guarda: if (state.emJogo) return), travando a revanche
     • fecharOverlays() não era chamado → overlay de vitória ficava
       sobreposto à tela de seleção                                   */

  state.emJogo    = false;  // CRÍTICO: desbloqueia case 'inicio' no Guest
  state.fim       = false;  // limpa flag de fim de jogo
  state.meuTurno  = false;  // sem turno ativo durante a seleção

  // Seleção: ambos precisam confirmar novamente
  state.meuConfirmado  = false;
  state.oppConfirmado  = false;
  state.charEu         = null;
  state.charOpp        = null;

  // HOST pré-determina quem começa (quem perdeu vai primeiro — determinístico)
  if (state.isHost) {
    state.primeiroSorteiro = state.perdiUltima ? 'host' : 'guest';
  }

  fecharOverlays();   // CRÍTICO: fecha overlay de vitória/derrota
  ocultarMoveGrid();  // garante grade de movimentos fechada
  logar('info', '🔄 Revanche! Escolha seu personagem para o próximo duelo.');
  mostrarTelaSelecao();
}

/* ============================================================
   11) UI — HP, log, chips, feedbacks visuais
============================================================ */
function atualizarHP() {
  setHP('eu', state.meuHP);
  setHP('opp', state.oppHP);
}

function setHP(quem, hp) {
  const fill = $(`hp-${quem}-fill`);
  const num = $(`hp-${quem}-num`);
  const pct = clamp(hp, 0, 100);

  fill.style.width = pct + '%';
  fill.classList.toggle('baixo', pct <= 25);
  fill.classList.toggle('medio', pct > 25 && pct <= 55);

  if (num.textContent !== String(hp)) {
    num.textContent = hp;
    num.classList.remove('pop');
    void num.offsetWidth; // reinicia a animação
    num.classList.add('pop');
  }
}

function logar(tipo, texto) {
  const li = document.createElement('li');
  li.className = 'log-' + tipo;

  const hora = document.createElement('span');
  hora.className = 'log-hora';
  hora.textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const msg = document.createElement('span');
  msg.textContent = texto; // textContent = seguro contra injeção de HTML

  li.append(hora, msg);
  const lista = $('log-lista');
  lista.prepend(li);
  while (lista.children.length > 60) lista.lastChild.remove();
}

function renderUsadas() {
  const box = $('palavras-usadas');
  box.innerHTML = '';
  if (state.usadas.size === 0) {
    const s = document.createElement('span');
    s.className = 'hint';
    s.textContent = 'Nenhum ainda.';
    box.appendChild(s);
    return;
  }
  for (const chave of state.usadas) {
    const f = ficha(chave);
    const info = LOOKUP[chave];
    const chip = document.createElement('span');
    chip.className = 'chip' + (info ? ' ' + info.categoria : '');
    chip.textContent = f.nome;
    box.appendChild(chip);
  }
}

/** Flash de tela: 'dano' (vermelho) | 'acerto' (verde) | 'falha' (cinza) */
function piscar(tipo) {
  const f = $('flash');
  f.className = '';
  void f.offsetWidth;
  f.className = 'flash-' + tipo;
}

function flutuarDano(dano, neutra) {
  const layer = $('dmg-layer');
  const el = document.createElement('span');
  el.className = 'dmg-float' + (neutra ? ' neutra' : '');
  el.textContent = '-' + dano + (neutra ? ' ⚡' : '');
  el.style.left = (28 + Math.random() * 40) + '%';
  layer.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
  setTimeout(() => el.remove(), 1500); // garantia (ex.: reduced motion)
}

/** Número verde flutuante de HP recuperado, aparece no card do próprio jogador */
function flutuarCura(cura) {
  const layer = $('cura-layer');
  const el = document.createElement('span');
  el.className = 'cura-float';
  el.textContent = '+' + cura + ' HP 💚';
  // Posição levemente aleatória para não colidir com o número de dano
  el.style.left = (20 + Math.random() * 40) + '%';
  layer.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
  setTimeout(() => el.remove(), 1600);
}

function sacudirCard(id) {
  const card = $(id);
  card.classList.remove('shake');
  void card.offsetWidth;
  card.classList.add('shake');
}

let avisoTimer = null;
function avisoInput(msg) {
  const inp = $('input-ataque');
  inp.classList.remove('shake');
  void inp.offsetWidth;
  inp.classList.add('shake');
  $('erro-ataque').textContent = msg;
  sfx.click();
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => { $('erro-ataque').textContent = ''; }, 2500);
}

/* ============================================================
   12) GUIA DE COMPOSTOS (gerado a partir do dicionário)
============================================================ */
function montarGuia() {
  const cont = $('guia-conteudo');
  cont.innerHTML = '';
  const tituloNivel = {
    facil: `Fácil · ${DANO_NIVEL.facil} de dano`,
    medio: `Médio · ${DANO_NIVEL.medio} de dano`,
    dificil: `Difícil · ${DANO_NIVEL.dificil} de dano`
  };
  const categorias = [
    ['acidos', '🧪 Ácidos', 'acido'],
    ['bases', '⚗️ Bases', 'base']
  ];

  for (const [chaveCat, titulo, classe] of categorias) {
    const col = document.createElement('div');
    col.className = 'guia-col ' + classe;

    const h = document.createElement('h3');
    h.textContent = titulo;
    col.appendChild(h);

    for (const nivel of ['facil', 'medio', 'dificil']) {
      const lista = (dicionarioQuimico[chaveCat] || {})[nivel] || [];
      if (!lista.length) continue;

      const grupo = document.createElement('div');
      grupo.className = 'guia-grupo';

      const gt = document.createElement('h5');
      gt.className = 'nivel-' + nivel;
      gt.textContent = tituloNivel[nivel];
      grupo.appendChild(gt);

      const ul = document.createElement('ul');
      for (const nome of lista) {
        const f = ficha(normalizar(nome));
        const li = document.createElement('li');
        const n = document.createElement('span');
        n.textContent = f.nome;
        li.appendChild(n);
        if (f.formula) {
          const fo = document.createElement('code');
          fo.textContent = f.formula;
          li.appendChild(fo);
        }
        ul.appendChild(li);
      }
      grupo.appendChild(ul);
      col.appendChild(grupo);
    }
    cont.appendChild(col);
  }
}

/* ============================================================
   12b) ANIMAÇÕES DA ARENA (batalha estilo Pokémon)

   Fluxo por ataque:
   t=0ms   → personagem atacante recebe classe 'anim-attack' (lunge)
   t=120ms → projétil é lançado em curva Bézier quadrática via rAF
   t=700ms → projétil chega, explosão + respingos + personagem defensor 'anim-hurt'

   Coordenadas do projétil: calculadas a partir dos bounding rects
   reais dos elementos na arena, portanto funcionam em qualquer
   tamanho de tela sem hardcode.
============================================================ */

/**
 * Aplica uma classe de animação ao wrapper do personagem e a remove após `ms`.
 * ms ≤ 0 → permanente (útil para vitória/derrota).
 */
function animPersonagem(id, cls, ms = 600) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('anim-charge', 'anim-attack', 'anim-hurt', 'anim-victory', 'anim-defeat');
  void el.offsetWidth; // force reflow para reiniciar a animação CSS
  el.classList.add('anim-' + cls);
  if (ms > 0) setTimeout(() => { const e = document.getElementById(id); if (e) e.classList.remove('anim-' + cls); }, ms);
}

/** Reseta todos os estados de animação e limpa efeitos residuais da arena. */
function resetArena() {
  ['anim-player', 'anim-opp'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('anim-attack', 'anim-hurt', 'anim-victory', 'anim-defeat');
  });
  const fx = document.getElementById('arena-fx');
  if (fx) fx.innerHTML = '';
}

/** Faz a arena tremer ao tomar dano (impacto físico) */
function tremereArena() {
  const arena = document.getElementById('arena');
  if (!arena) return;
  arena.classList.remove('tremendo');
  void arena.offsetWidth;
  arena.classList.add('tremendo');
  arena.addEventListener('animationend', () => arena.classList.remove('tremendo'), { once: true });
  setTimeout(() => arena.classList.remove('tremendo'), 550); // failsafe
}

/**
 * Cria uma onda de choque (anel expandindo) no ponto de impacto.
 * @param {number} x   — posição horizontal dentro da arena (px)
 * @param {number} y   — posição vertical dentro da arena (px)
 * @param {string} cor — cor da borda do anel
 * @param {HTMLElement} container — onde inserir
 */
function criarRipple(x, y, cor, container) {
  const ring = document.createElement('div');
  ring.className = 'ripple-ring';
  ring.style.left        = x + 'px';
  ring.style.top         = y + 'px';
  ring.style.borderColor = cor;
  ring.style.width       = '36px';
  ring.style.height      = '36px';
  container.appendChild(ring);
  ring.addEventListener('animationend', () => ring.remove(), { once: true });
  setTimeout(() => ring.remove(), 600); // failsafe
}

/** Aplica charge-up glow no sprite usando Web Animations API (paralelo às classes CSS) */
function animarCharge(imgId, charColor) {
  const el = document.getElementById(imgId);
  if (!el) return;
  el.animate([
    { filter: 'drop-shadow(0 6px 10px rgba(0,0,0,.6))' },
    { filter: `brightness(1.8) drop-shadow(0 0 14px ${charColor})` },
    { filter: `brightness(1.3) drop-shadow(0 0  5px ${charColor})` },
  ], { duration: 350, easing: 'ease-out', fill: 'none' });
}

/** Lança um projétil em arco Bézier do atacante para o defensor.
 * @param {boolean} doJogador - true = player ataca opp; false = opp ataca player
 * @param {string}  categoria - 'acido' | 'base'
 * @param {boolean} neutralizou
 */
function lancarProjetil(doJogador, categoria, neutralizou) {
  const arena   = document.getElementById('arena');
  const fxLayer = document.getElementById('arena-fx');
  const playerEl = document.getElementById('anim-player');
  const oppEl    = document.getElementById('anim-opp');
  if (!arena || !fxLayer || !playerEl || !oppEl) return;

  const ar = arena.getBoundingClientRect();
  const pr = playerEl.getBoundingClientRect();
  const or = oppEl.getBoundingClientRect();

  // Posição de partida ≈ ponta do frasco levantado; chegada ≈ centro do torso do defensor
  let sx, sy, ex, ey;
  if (doJogador) {
    // Frasco do player está no canto superior-direito do sprite
    sx = pr.right  - ar.left  - 2;
    sy = pr.top    - ar.top   + pr.height * 0.14;
    // Centro do torso do oponente
    ex = or.left   - ar.left  + or.width  * 0.5;
    ey = or.top    - ar.top   + or.height * 0.45;
  } else {
    // Frasco do oponente está no canto superior-esquerdo do sprite
    sx = or.left   - ar.left  + 2;
    sy = or.top    - ar.top   + or.height * 0.14;
    // Centro do torso do jogador
    ex = pr.left   - ar.left  + pr.width  * 0.5;
    ey = pr.top    - ar.top   + pr.height * 0.45;
  }

  // Ponto de controle da Bézier: acima da linha reta → cria o arco
  const cx = (sx + ex) / 2;
  const cy = Math.min(sy, ey) - 42;

  const tipo = neutralizou ? 'neutro' : (categoria === 'acido' ? 'acido' : 'base');
  const cor  = tipo === 'neutro' ? '#FFD600' : tipo === 'acido' ? '#FF6A4D' : '#7C4DFF';

  // Criar o orbe do projétil
  const orb = document.createElement('div');
  orb.className = `proj-orb tipo-${tipo}`;
  fxLayer.appendChild(orb);

  const DUR = 620; // ms de travessia
  const t0 = performance.now();
  let lastTrailT = -1;

  function bz(t) {
    const mt = 1 - t;
    return {
      x: mt * mt * sx + 2 * mt * t * cx + t * t * ex,
      y: mt * mt * sy + 2 * mt * t * cy + t * t * ey
    };
  }

  function step(now) {
    const t = Math.min(1, (now - t0) / DUR);
    const pos = bz(t);

    orb.style.left      = pos.x + 'px';
    orb.style.top       = pos.y + 'px';
    orb.style.transform = `translate(-50%,-50%) scale(${0.55 + 0.55 * Math.sin(Math.PI * t)}) rotate(${t * 540}deg)`;

    // Trilha: cria uma partícula de rastro a cada ~10% do percurso
    if (t - lastTrailT >= 0.10 && t < 0.92) {
      lastTrailT = t;
      const tr = document.createElement('div');
      tr.className = 'proj-trail';
      const size = 9 + 5 * (1 - t);
      tr.style.cssText = `left:${pos.x}px;top:${pos.y}px;width:${size}px;height:${size}px;background:${cor};opacity:0.35;`;
      fxLayer.appendChild(tr);
      setTimeout(() => tr.remove(), 340);
    }

    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      orb.remove();
      exibirExplosao(ex, ey, fxLayer, tipo);
      lancarRespingos(ex, ey, fxLayer, cor, neutralizou ? 10 : 6);
    }
  }

  requestAnimationFrame(step);
}

function exibirExplosao(x, y, container, tipo) {
  const corMap = { acido:'#FF6A4D', base:'#7C4DFF', neutro:'#FFD600' };
  const cor = corMap[tipo] ?? '#FF6A4D';

  const exp = document.createElement('div');
  exp.className = `hit-explosion tipo-${tipo}`;
  exp.style.left = x + 'px';
  exp.style.top  = y + 'px';
  container.appendChild(exp);
  exp.addEventListener('animationend', () => exp.remove(), { once: true });
  setTimeout(() => exp.remove(), 900);

  // Ondas de choque em cascata (ripple rings)
  criarRipple(x, y, cor, container);
  setTimeout(() => criarRipple(x, y, cor, container), 110);
  if (tipo === 'neutro') setTimeout(() => criarRipple(x, y, '#2fd4a0', container), 220);
}

function lancarRespingos(x, y, container, cor, n) {
  for (let i = 0; i < n; i++) {
    const sp = document.createElement('div');
    sp.className = 'splash-p';
    const ang  = (2 * Math.PI * i / n) + (Math.random() - 0.5) * 0.7;
    const dist = 22 + Math.random() * 32;
    sp.style.cssText = `left:${x}px;top:${y}px;background:${cor};box-shadow:0 0 4px ${cor};`;
    sp.style.setProperty('--dx', `${Math.cos(ang) * dist}px`);
    sp.style.setProperty('--dy', `${Math.sin(ang) * dist}px`);
    container.appendChild(sp);
    sp.addEventListener('animationend', () => sp.remove(), { once: true });
    setTimeout(() => sp.remove(), 700);
  }
}

/* ─── SPRITES DOS PERSONAGENS NA ARENA ─── */

/**
 * Injeta o sprite pixel-art do personagem selecionado no elemento <img class="sci">
 * da arena. Usa window.SCIENTIST_SPRITES (gerado por sprites-cientistas.js).
 */
function aplicarVisualPersonagens() {
  const sprites = window.SCIENTIST_SPRITES;
  if (!sprites) {
    console.warn('[sprites] window.SCIENTIST_SPRITES não carregado ainda');
    return;
  }

  const imgPlayer = document.getElementById('sci-player');
  const imgOpp    = document.getElementById('sci-opp');

  // Jogador — sprite correto para o personagem escolhido
  const svgP = sprites[state.charEu];
  if (imgPlayer && svgP) {
    imgPlayer.src = 'data:image/svg+xml;base64,' + btoa(svgP);
  }

  // Oponente — mesmo sprite (o CSS .opp-wrap já aplica scaleX(-1) para espelhar)
  const svgO = sprites[state.charOpp];
  if (imgOpp && svgO) {
    imgOpp.src = 'data:image/svg+xml;base64,' + btoa(svgO);
  }

  // Aura de cor do personagem nas plataformas da arena
  const eu  = PERSONAGENS[state.charEu];
  const opp = PERSONAGENS[state.charOpp];
  const playerWrap = document.getElementById('anim-player');
  const oppWrap    = document.getElementById('anim-opp');
  if (eu  && playerWrap) playerWrap.style.setProperty('--char-color', eu.cor);
  if (opp && oppWrap)    oppWrap.style.setProperty('--char-color',    opp.cor);
}

/* ============================================================
   12c) SELEÇÃO DE PERSONAGEM E GRADE DE MOVIMENTOS (FireRed)
============================================================ */

/** Cor do indicador de pH para o chip de seleção */
function phCor(ph) {
  if (ph < 1)  return '#FF2200';
  if (ph < 3)  return '#FF7700';
  if (ph < 5)  return '#CCAA00';
  if (ph < 6.5) return '#88AA00';
  if (ph < 7.5) return '#00AA00';
  if (ph < 9)  return '#00AACC';
  if (ph < 11) return '#4455FF';
  if (ph < 13) return '#9933FF';
  return '#CC00CC';
}

/** Monta os cards de personagem na tela de seleção */
function montarCardsPersonagem() {
  const cont = $('sel-chars');
  cont.innerHTML = '';
  PERSONAGENS.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'sel-card';
    card.dataset.idx = i;

    // Sprite pixel art (se sprites-cientistas.js carregou) ou fallback emoji
    const sprites = window.SCIENTIST_SPRITES;
    const avatarHTML = sprites?.[i]
      ? `<img class="sel-sprite-mini"
              src="data:image/svg+xml;base64,${btoa(sprites[i])}"
              alt="${p.nome}">`
      : `<div class="sel-avatar" style="background:${p.cor}" aria-hidden="true">${p.emoji}</div>`;

    const chipHTML = p.moveset.map(key => {
      const f = ficha(key);
      const info = LOOKUP[key];
      const ph = PH_VALS[key] ?? 7;
      const nomeCurto = f.nome.replace(/^Ácido\s+/i, '').replace(/^Hidróxido\s+de\s+/i, '').trim();
      return `<span class="sel-chip ${info?.categoria || ''}" title="pH ${ph.toFixed(1)} · ${f.formula || '—'}">
                <span class="sel-chip-dot" style="background:${phCor(ph)}"></span>${nomeCurto}
              </span>`;
    }).join('');

    card.innerHTML = `
      ${avatarHTML}
      <div class="sel-info">
        <strong class="sel-nome">${p.nome}</strong>
        <em class="sel-sub">${p.subtitulo}</em>
        <p class="sel-desc">${p.descricao}</p>
        <div class="sel-moves-mini">${chipHTML}</div>
      </div>`;

    card.addEventListener('click', () => selecionarChar(i));
    cont.appendChild(card);
  });
}

/** Destaca o personagem selecionado e habilita o botão confirmar */
function selecionarChar(idx) {
  state.charEu = idx;
  document.querySelectorAll('.sel-card').forEach((c, i) =>
    c.classList.toggle('selected', i === idx));
  $('btn-confirmar-sel').disabled = false;
  sfx.click();
}

/** Inicia a tela de seleção de personagem */
function mostrarTelaSelecao() {
  montarCardsPersonagem();
  $('btn-confirmar-sel').disabled = true;
  $('btn-confirmar-sel').textContent = '✔ CONFIRMAR PERSONAGEM';
  $('sel-opp-status').textContent = '';
  state.charEu = null;
  mostrarTela('screen-selecao');
}

/** Jogador clicou em CONFIRMAR na seleção */
function confirmarSelecao() {
  if (state.charEu === null || state.meuConfirmado) return;
  state.meuConfirmado = true;
  $('btn-confirmar-sel').disabled = true;
  $('btn-confirmar-sel').textContent = '⌛ Aguardando oponente…';
  // Marca os cards como não-interativos
  document.querySelectorAll('.sel-card').forEach(c => c.classList.add('confirmado'));
  sfx.click();

  if (state.isHost) {
    // Host: espera a escolha do convidado (pode já ter chegado)
    if (state.oppConfirmado) enviarInicio();
  } else {
    // Convidado: envia escolha ao host
    enviar({ type: 'escolha', char: state.charEu });
    // Se o host já enviou 'inicio' (chegou antes da confirmação), começa agora
    if (state.oppConfirmado) iniciarBatalhaComSelecao();
  }
}

/** Host sorteia e envia 'inicio' com seu personagem; ambos iniciam a batalha */
function enviarInicio() {
  const primeiro = state.primeiroSorteiro;
  enviar({ type: 'inicio', nome: state.nome, primeiro, charHost: state.charEu });
  iniciarBatalhaComSelecao();
}

/** Configura o moveset e chama iniciarBatalha() */
function iniciarBatalhaComSelecao() {
  state.moveset = PERSONAGENS[state.charEu]?.moveset?.slice() || [];
  const comecoMeu = state.isHost
    ? (state.primeiroSorteiro === 'host')
    : (state.primeiroSorteiro === 'guest');
  iniciarBatalha(comecoMeu);
}

/* ─── GRADE DE MOVIMENTOS (FireRed) ─── */

/** Exibe a grade de movimentos (ao clicar em LUTAR) */
function mostrarMoveGrid() {
  $('action-btns').hidden = true;
  $('move-grid-container').hidden = false;
  renderizarMoveGrid();
}

/** Esconde a grade e volta para os botões de ação */
function ocultarMoveGrid() {
  const mc = $('move-grid-container');
  if (mc) mc.hidden = true;
  const ab = $('action-btns');
  if (ab) ab.hidden = false;
}

/** Renderiza os 8 botões de movimento com a barra de pH */
function renderizarMoveGrid() {
  const grid = $('move-grid');
  if (!grid) return;
  grid.innerHTML = '';

  state.moveset.forEach(key => {
    const f = ficha(key);
    const info = LOOKUP[key];
    const ph = PH_VALS[key] ?? 7;
    const pct = ((ph / 14) * 100).toFixed(1);
    const jaUsado  = state.usadas.has(key);
    const habilitado = !jaUsado && state.meuTurno && !state.fim;

    const btn = document.createElement('button');
    btn.className = `move-btn ${info?.categoria || ''}${jaUsado ? ' usada' : ''}`;
    btn.type = 'button';
    btn.disabled = !habilitado;
    btn.dataset.key = key;
    btn.title = `pH ${ph.toFixed(1)}`;

    btn.innerHTML = `
      <span class="move-tipo-icon" aria-hidden="true">${info?.categoria === 'acido' ? '🧪' : '⚗️'}</span>
      <span class="move-name">${f.nome}</span>
      <div class="move-ph-bar" aria-hidden="true">
        <div class="move-ph-gradient"></div>
        <div class="move-ph-marker" style="left:${pct}%"></div>
      </div>`;

    if (habilitado) {
      btn.addEventListener('click', () => {
        ocultarMoveGrid();
        // Passa a CHAVE normalizada (ex: 'cloridrico'), não o nome completo ('Ácido Clorídrico').
        // normalizar(f.nome) → 'acido cloridrico' ≠ 'cloridrico' → LOOKUP falharia silenciosamente.
        atacar(key);
      }, { once: true });
    }
    grid.appendChild(btn);
  });
}

/* ============================================================
   13) INICIALIZAÇÃO E EVENTOS
============================================================ */
function init() {
  montarGuia();

  if (typeof Peer === 'undefined') {
    statusMenu('⚠️ Não foi possível carregar a biblioteca PeerJS (CDN). Verifique sua internet e recarregue a página.');
    $('btn-criar').disabled = true;
    $('btn-entrar').disabled = true;
  }

  // Menu
  $('btn-gerar-id').addEventListener('click', () => {
    $('input-sala-criar').value = gerarIdAleatorio();
    sfx.click();
  });
  $('btn-criar').addEventListener('click', () => { sfx.click(); criarSala(); });
  $('btn-entrar').addEventListener('click', () => { sfx.click(); entrarSala(); });
  $('input-sala-criar').addEventListener('keydown', (e) => { if (e.key === 'Enter') criarSala(); });
  $('input-sala-entrar').addEventListener('keydown', (e) => { if (e.key === 'Enter') entrarSala(); });

  // Lobby
  $('btn-copiar').addEventListener('click', copiarCodigo);
  $('btn-cancelar').addEventListener('click', () => destruirConexao(true));

  // Seleção de personagem
  $('btn-confirmar-sel').addEventListener('click', confirmarSelecao);
  $('btn-cancelar-sel').addEventListener('click', () => { sairDaPartida(); });

  // Batalha: botão USADAS (toggle do painel de compostos)
  $('btn-usadas-toggle').addEventListener('click', () => {
    const p = $('painel-usadas');
    p.hidden = !p.hidden;
    sfx.click();
  });
  $('btn-fechar-usadas').addEventListener('click', () => {
    $('painel-usadas').hidden = true;
  });

  // Batalha: btn-ataque agora ABRE a grade de movimentos (estilo FireRed)
  $('btn-ataque').addEventListener('click', () => {
    if (state.meuTurno && state.moveset.length > 0) {
      mostrarMoveGrid();
    }
    // Sem moveset selecionado: não faz nada (cena de seleção garante que moveset existe)
  });
  $('btn-back-moves').addEventListener('click', () => { ocultarMoveGrid(); sfx.click(); });
  $('input-ataque').addEventListener('keydown', (e) => { if (e.key === 'Enter') atacar(); }); // fallback
  $('btn-sair').addEventListener('click', sairDaPartida);
  $('btn-som').addEventListener('click', () => {
    const mudo = sfx.alternar();
    $('btn-som').textContent = mudo ? '🔇' : '🔊';
  });

  // Fim de jogo
  $('btn-revanche').addEventListener('click', () => { sfx.click(); pedirRevanche(); });
  $('btn-menu-fim').addEventListener('click', sairDaPartida);

  // Guia
  $('btn-guia').addEventListener('click', () => { $('modal-guia').hidden = false; });
  $('btn-fechar-guia').addEventListener('click', () => { $('modal-guia').hidden = true; });
  $('modal-guia').addEventListener('click', (e) => {
    if (e.target.id === 'modal-guia') $('modal-guia').hidden = true;
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('modal-guia').hidden) $('modal-guia').hidden = true;
  });

  // Avisar o oponente se a aba for fechada no meio da partida
  window.addEventListener('beforeunload', () => {
    try {
      enviar({ type: 'saiu' });
      if (state.peer && !state.peer.destroyed) state.peer.destroy();
    } catch (e) { /* ignora */ }
  });

  $('input-nome').focus();
}

document.addEventListener('DOMContentLoaded', init);
