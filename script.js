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
const PEER_PREFIX = 'duelo-quimico-';         // "namespace" no broker público do PeerJS
const TIMEOUT_ENTRAR_MS = 12000;

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
  joinTimeout: null
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
    if (!state.isHost) enviar({ type: 'ola', nome: state.nome });
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
    case 'ola': { // anfitrião recebe o nome do convidado e sorteia quem começa
      if (!state.isHost || state.emJogo) return;
      state.oppNome = String(msg.nome || 'Oponente').slice(0, 20) || 'Oponente';
      const primeiro = Math.random() < 0.5 ? 'host' : 'guest';
      enviar({ type: 'inicio', nome: state.nome, primeiro });
      iniciarBatalha(primeiro === 'host');
      break;
    }

    case 'inicio': { // convidado recebe o nome do anfitrião e o sorteio
      if (state.isHost || state.emJogo) return;
      state.oppNome = String(msg.nome || 'Oponente').slice(0, 20) || 'Oponente';
      iniciarBatalha(msg.primeiro === 'guest');
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

  $('nome-eu').textContent = state.nome + ' (você)';
  $('nome-opp').textContent = state.oppNome;
  $('sala-atual').textContent = state.salaId;
  $('log-lista').innerHTML = '';
  $('erro-ataque').textContent = '';
  $('btn-revanche').disabled = false;
  $('btn-revanche').classList.remove('pulse');

  renderUsadas();
  atualizarHP();
  fecharOverlays();
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
    : (meu ? '🟢 SEU TURNO — digite um composto!' : `⏳ Turno de ${state.oppNome}…`);
  banner.classList.toggle('meu', meu);

  $('input-ataque').disabled = !meu;
  $('btn-ataque').disabled = !meu;

  if (meu && state.ultimoAtaqueOpp) {
    const foi = state.ultimoAtaqueOpp === 'acido' ? 'um ÁCIDO 🧪' : 'uma BASE ⚗️';
    const resposta = state.ultimoAtaqueOpp === 'acido' ? 'uma BASE' : 'um ÁCIDO';
    dica.textContent = `💡 Último ataque do oponente: ${foi}. Responda com ${resposta} para NEUTRALIZAR (dano ×1,5)!`;
  } else {
    dica.textContent = '';
  }

  if (meu) setTimeout(() => $('input-ataque').focus(), 60);
}

function atacar() {
  if (!state.meuTurno || state.fim || !state.emJogo) return;

  const bruto = $('input-ataque').value;
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

  state.oppHP = Math.max(0, state.oppHP - dano);
  atualizarHP();
  flutuarDano(dano, neutralizou);

  enviar({
    type: 'ataque',
    ok: true,
    chave,
    nome: f.nome,
    formula: f.formula,
    categoria: info.categoria,
    nivel: info.nivel,
    dano,
    neutralizou
  });

  const rotulo = info.categoria === 'acido' ? '🧪 ácido' : '⚗️ base';
  logar(
    neutralizou ? 'neutra' : 'acerto',
    `${neutralizou ? '⚡ NEUTRALIZAÇÃO! ' : ''}💥 ${state.nome} atacou com ${f.nome}` +
    `${f.formula ? ` (${f.formula})` : ''} [${rotulo} · ${info.nivel}] e causou ${dano} de dano!`
  );
  piscar('acerto');
  sfx.acerto();

  if (state.oppHP <= 0) { encerrar(true); return; }
  atualizarTurno();
}

function receberAtaque(msg) {
  if (!state.emJogo || state.fim) return;

  if (msg.ok) {
    const dano = clamp(msg.dano, 0, 60);
    state.meuHP = Math.max(0, state.meuHP - dano);
    state.ultimoAtaqueOpp = (msg.categoria === 'acido' || msg.categoria === 'base') ? msg.categoria : null;

    atualizarHP();
    sacudirCard('card-eu');
    piscar('dano');
    sfx.dano();

    const nome = String(msg.nome || '???').slice(0, 40);
    const formula = String(msg.formula || '').slice(0, 24);
    const rotulo = msg.categoria === 'acido' ? '🧪 ácido' : '⚗️ base';
    logar(
      'dano',
      `${msg.neutralizou ? '⚡ NEUTRALIZAÇÃO! ' : ''}💥 ${state.oppNome} atacou com ${nome}` +
      `${formula ? ` (${formula})` : ''} [${rotulo} · ${String(msg.nivel || '')}] e causou ${dano} de dano!`
    );

    if (state.meuHP <= 0) { encerrar(false); return; }
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
  state.perdiUltima = !venci;
  atualizarTurno();

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
  // Regra determinística (os dois lados calculam igual): quem perdeu começa.
  iniciarBatalha(state.perdiUltima);
  logar('info', '🔄 Revanche! Quem perdeu a última partida ataca primeiro.');
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

  // Batalha
  $('btn-ataque').addEventListener('click', atacar);
  $('input-ataque').addEventListener('keydown', (e) => { if (e.key === 'Enter') atacar(); });
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
