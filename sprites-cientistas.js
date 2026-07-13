/**
 * sprites-cientistas.js  — pixel art 16×32 historicamente precisos
 *
 * Fontes: retratos históricos, fotos e descrições documentadas.
 * Correções principais vs versão anterior:
 *   • Lavoisier — peruca elegante COM rolos nas têmporas, SEM óculos (não usava), jabot de renda
 *   • Mendeleev — cabelo E barba completamente brancos/grisalhos, extremamente selvagens e longos
 *   • Curie — cabelo escuro com risca ao MEIO, coque; olhos determinados
 *   • Dalton — óculos grandes redondos (precisos), rosto rechonchudo, cabelo cinza curto
 *   • Pauling — cabelo escuro ondulado, GRAVATA BORBOLETA (sua marca registrada)
 *   • Boyle — cabelo ESCURO/PRETO ondulado (século XVII, sem peruca), gola de renda larga
 *   • Haber — CARECA no topo (característica muito distinta), PINCE-NEZ, bigodinho fino
 *   • Kekulé — barba famosa BIFURCADA em W (aparece em todos os retratos maduros)
 *   • Nobel — barba aparada média, cabelo rareando, aparência vitoriana digna
 *   • Davy — cabelo PRETO (não castanho!), jovem, sem barba, aparência elegante regência
 *   • Priestley — peruca branca simples de clérigo anglicano, óculos redondos pequenos
 *   • Arrhenius — cabelo LOIRO sueco, óculos redondos, bigodinho fino claro
 */

/* ─── PALETA BASE ─── */
const P = {
  S:'#F4C5A0', D:'#D09070', E:'#1A1A2E',
  N:'#C08060', M:'#803030',
  W:'#F0F0F0', G:'#D0D0D0',
  L:'#263546', B:'#0e0e0e', T:'#999999',
};

function lighten(hex,amt){
  const n=parseInt(hex.slice(1),16);
  return'#'+[n>>16,(n>>8)&255,n&255]
    .map(v=>Math.min(255,v+amt).toString(16).padStart(2,'0')).join('');
}

/* ─── RENDERIZAÇÃO ─── */
function makePixels(calls){
  const g=new Map();
  for(const[x,y,w,h,c]of calls){
    for(let py=y;py<y+h;py++)
      for(let px=x;px<x+w;px++){
        if(px<0||px>15||py<0||py>31)continue;
        if(c===null)g.delete(px+','+py);
        else g.set(px+','+py,c);
      }
  }
  return g;
}
function svgDeGrid(g){
  let r='';
  g.forEach((c,k)=>{const[x,y]=k.split(',');r+=`<rect x="${x}" y="${y}" width="1" height="1" fill="${c}"/>`;});
  return`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 32" shape-rendering="crispEdges">${r}</svg>`;
}
function sprite(calls){return svgDeGrid(makePixels(calls));}

/* ─── CORPO BASE (jaleco branco, braço dir erguido com frasco, calça/sapatos) ─── */
function base(cc,fc){return[
  [2,14,12,8,P.W],[5,14,6,8,cc],
  [3,22,2,1,P.G],[11,22,2,1,P.G],
  [1,16,2,6,P.W],[0,21,2,2,P.S],
  [13,13,2,5,P.W],[14,17,2,2,P.S],
  [14,8,1,1,'#555'],[14,9,1,1,P.T],
  [13,10,3,4,fc],[13,10,1,4,lighten(fc,30)],
  [4,23,3,8,P.L],[9,23,3,8,P.L],
  [3,31,4,1,P.B],[3,30,3,1,P.B],
  [8,31,4,1,P.B],[9,30,3,1,P.B],
  [6,13,4,1,P.S],
  [3,4,10,9,P.S],[2,7,1,3,P.S],[13,7,1,3,P.S],
  [4,7,2,2,P.E],[10,7,2,2,P.E],
  [4,7,1,1,'#5A9FCC'],[10,7,1,1,'#5A9FCC'],
  [7,10,2,1,P.N],[5,12,2,1,P.M],[9,12,2,1,P.M],
];}
function face(){return[
  [3,4,10,9,P.S],[2,7,1,3,P.S],[13,7,1,3,P.S],
  [4,7,2,2,P.E],[10,7,2,2,P.E],
  [4,7,1,1,'#5A9FCC'],[10,7,1,1,'#5A9FCC'],
  [7,10,2,1,P.N],[5,12,2,1,P.M],[9,12,2,1,P.M],
];}

/* ──────────── PENTEADOS HISTORICAMENTE PRECISOS ──────────── */

/* LAVOISIER: peruca empoada elegante com ROLOS NAS TÊMPORAS
   Retratos: David 1788 — "hair pulled back from his face, with two small rolls at the temples"
   Cabelo puxado para trás, rolos compactos nas laterais, não fluffy */
function wigLavoisier(c){return[
  [4,0,8,1,c],                       // topo compacto (não largo)
  [3,1,10,1,c],[2,2,12,2,c],         // lados crescendo
  [2,4,2,3,c],[12,4,2,3,c],          // ROLOS NAS TÊMPORAS (compactos)
  [2,4,1,3,lighten(c,15)],           // brilho rolo esq
  [13,4,1,3,lighten(c,15)],          // brilho rolo dir
  [3,0,10,1,lighten(c,20)],          // brilho topo
];}

/* MENDELEEV: cabelo E barba BRANCOS/GRISALHOS, selvagens e extremamente longos
   Fotografias: cabelo espesso, ondulado, branco, caindo pelos ombros; barba igualmente longa */
function hairMendeleev(h,b){return[
  [1,0,14,1,h],[0,1,16,2,h],         // enorme volume do topo
  [0,3,16,1,h],[0,4,2,8,h],[14,4,2,8,h],  // laterais longas descendo
  [0,9,2,5,h],[14,9,2,5,h],          // continuam abaixo dos ombros
  [0,12,2,4,h],[14,12,2,4,h],        // quase até cintura
  // BARBA ENORME descendente
  [3,12,10,1,b],[3,13,10,1,b],
  [3,14,4,7,b],[9,14,4,7,b],         // dois lados da barba
  [4,21,8,1,b],                       // base da barba
  [5,14,6,4,lighten(b,15)],           // brilho central
];}

/* CURIE: cabelo escuro com RISCA AO MEIO, coque atrás
   Fotos históricas: cabelo liso escuro, risca central, coque apertado */
function hairCurie(c){return[
  [6,0,4,1,c],[5,1,6,1,c],           // topo (coque pequeno)
  [4,0,1,1,c],[11,0,1,1,c],          // laterais do coque
  [3,2,2,2,c],[11,2,2,2,c],          // cabelo descendo
  [3,3,2,2,c],[11,3,2,2,c],
  // risca ao meio é espaço vazio entre os lados — cabelo vai para as laterais
  [2,4,3,3,c],[11,4,3,3,c],
  [2,5,2,2,c],[12,5,2,2,c],
];}

/* DALTON: cabelo cinza CURTO, sem barba
   Retratos: rosto rechonchudo, cabelo cinza simples, quaker simples */
function hairDalton(c){return[
  [4,1,8,1,c],[3,2,10,2,c],
  [2,3,12,2,c],[2,4,2,3,c],[12,4,2,3,c],
];}

/* PAULING: cabelo escuro ONDULADO varrido para cima/trás
   Fotos: cabelo escuro, ligeiramente ondulado, varrido */
function hairPauling(c){return[
  [4,0,8,1,c],[3,1,10,2,c],
  [2,2,12,2,c],[2,3,2,4,c],[12,3,2,4,c],
  [4,0,6,1,lighten(c,30)],           // brilho onda
  [12,2,2,1,lighten(c,20)],
];}

/* BOYLE (século XVII): cabelo ESCURO ENCARACOLADO natural, comprado
   Retratos de Kerseboom c.1689: cabelo preto longo encaracolado natural (não peruca branca) */
function hairBoyle(c){return[
  [3,0,10,1,c],[2,1,12,1,c],[1,2,14,2,c],
  [0,4,3,5,c],[13,4,3,5,c],          // cachos longos nas laterais
  [0,7,2,4,c],[14,7,2,4,c],          // cachos caindo
  [5,0,6,1,lighten(c,25)],
];}

/* HABER: CARECA (topo completamente careca)
   Descrição: "bald on top" — apenas minúscula franja nas laterais e atrás */
function hairHaber(c){return[
  // Apenas uma fiada de cabelo nas laterais/trás
  [2,7,2,3,c],[12,7,2,3,c],
  [2,8,1,2,c],[13,8,1,2,c],
];}

/* KEKULÉ: barba BIFURCADA famosa em W
   Retratos maduros: "beard bifurcated splendidly into a W shape"
   Cabelo e barba castanhos/escuros */
function hairKekule(h,b){return[
  [3,1,10,1,h],[2,2,12,1,h],
  [2,3,12,2,h],[2,4,2,4,h],[12,4,2,4,h],
  // BARBA BIFURCADA em W (dois picos distintos apontando para fora)
  [4,12,8,1,b],[4,13,3,2,b],[9,13,3,2,b],  // raiz dupla
  [3,15,3,4,b],[10,15,3,4,b],               // dois ramos separados
  [3,19,2,2,b],[11,19,2,2,b],               // pontas do W
  [5,14,2,1,P.S],[9,14,2,1,P.S],           // espaço central (entre bifurcações)
];}

/* NOBEL: barba APARADA, thinning hair, aparência vitoriana digna */
function hairNobel(h,b){return[
  [4,1,8,1,h],[3,2,10,2,h],
  [2,3,12,1,h],[2,4,2,3,h],[12,4,2,3,h],
  // Barba aparada (não enorme, mas presente)
  [4,12,8,1,b],[3,13,4,3,b],[9,13,4,3,b],
  [4,16,8,1,b],
];}

/* DAVY: cabelo PRETO, jovem/elegante, sem barba
   Retrato Lawrence 1821: "black hair, grey eyes, fresh complexion"  */
function hairDavy(c){return[
  [4,0,8,1,c],[3,1,10,1,c],[2,2,12,2,c],
  [2,4,2,4,c],[12,4,2,4,c],
  [4,0,5,1,lighten(c,40)],           // brilho no cabelo preto
  [11,2,2,1,lighten(c,30)],
];}

/* PRIESTLEY: peruca branca SIMPLES de clérigo anglicano
   Retratos: peruca discreta, não exuberante */
function wigPriestley(c){return[
  [4,0,8,1,c],[3,1,10,2,c],[2,2,12,2,c],
  [2,4,2,4,c],[12,4,2,4,c],
  [5,0,6,1,lighten(c,20)],
];}

/* ARRHENIUS: cabelo LOIRO ESCANDINAVO, liso */
function hairArrhenius(c){return[
  [4,0,8,1,c],[3,1,10,1,c],[2,2,12,2,c],
  [2,3,2,4,c],[12,3,2,4,c],
  [4,0,8,1,lighten(c,30)],
];}

/* ──────────── ACESSÓRIOS PRECISOS ──────────── */

/* Óculos redondos GRANDES — Dalton (sem hastes, usados com cordão no século XVIII) */
function glassesBig(c){return[
  [3,6,4,1,c],[3,9,4,1,c],[3,7,1,2,c],[6,7,1,2,c],
  [9,6,4,1,c],[9,9,4,1,c],[9,7,1,2,c],[12,7,1,2,c],
  [7,8,2,1,c],
];}

/* Pince-nez HABER — minúsculos óculos que prendem NO NARIZ (sem hastes laterais)
   Totalmente diferentes dos óculos comuns — ficam no CENTRO do rosto */
function pinceNez(c){return[
  [6,9,1,1,c],[6,10,1,1,c],          // lente esq (muito pequena)
  [9,9,1,1,c],[9,10,1,1,c],          // lente dir
  [7,10,2,1,c],                       // arco central (prende no nariz)
];}

/* Óculos ovais PEQUENOS — para Arrhenius e Priestley */
function glassesSmall(c){return[
  [4,6,3,1,c],[4,8,3,1,c],[4,7,1,1,c],[6,7,1,1,c],
  [9,6,3,1,c],[9,8,3,1,c],[9,7,1,1,c],[11,7,1,1,c],
  [7,7,2,1,c],
];}

/* Gravata borboleta PAULING — marca registrada nas fotos */
function bowTie(c){return[
  [5,14,1,2,c],[10,14,1,2,c],
  [6,14,4,2,c],
  [7,14,2,2,lighten(c,40)],
];}

/* Jabot/cravata de renda LAVOISIER — detalhe histórico: "white shirt with a lace jabot" */
function jabot(c){return[
  [6,12,4,1,c],[6,13,4,1,c],
  [7,13,2,1,lighten(c,30)],
  [6,14,1,1,c],[9,14,1,1,c],
];}

/* Gola de renda LARGA BOYLE — século XVII, gola bem mais larga */
function laceCollarBoyle(c){return[
  [2,13,12,1,c],                      // toda a largura
  [2,14,4,1,c],[10,14,4,1,c],
  [2,15,3,1,c],[11,15,3,1,c],
];}

/* Gola clerical PRIESTLEY — simples, discreta */
function clericalCollar(c){return[
  [5,13,6,1,c],[5,14,6,1,c],
  [7,14,2,1,lighten(c,20)],
];}

/* Bigode FINO — Haber e Arrhenius */
function mustacheThin(c){return[
  [5,11,2,1,c],[9,11,2,1,c],
];}

/* Sobrancelhas PESADAS / RAIVOSAS — Mendeleev (famoso por elas) */
function eyebrowsHeavy(c){return[
  [4,5,4,1,c],[8,5,4,1,c],
  [4,6,2,1,c],[10,6,2,1,c],
];}

/* Charuto HABER — pequeno detalhe (ele era sempre retratado fumando) */
function cigar(c){return[
  [13,11,3,1,c],[13,12,1,1,'#D4994A'],
];}

/* ──────────── OS 12 SPRITES ──────────── */
const SPRITES_RAW = [

  /* 0 — LAVOISIER ────────────────────────────────────────────────
     Peruca elegante com rolos nas têmporas, SEM óculos, jabot de renda.
     Terno PRETO (como no retrato de David). Frasco laranja (O₂, H₂O). */
  [
    ...base('#7A0020','#FF8C00'),
    ...wigLavoisier('#E8E0C8'),
    ...face(),
    ...jabot('#FFFFFF'),
    // sem óculos — Lavoisier não usava óculos
    [7,10,2,1,P.N],[5,12,2,1,P.M],[9,12,2,1,P.M],
  ],

  /* 1 — MENDELEEV ─────────────────────────────────────────────────
     Cabelo e barba BRANCO-GRISALHO, enorme e selvagem.
     Sobrancelhas pesadas. Olhos profundos/intensos. */
  [
    ...base('#1A237E','#7C4DFF'),
    ...hairMendeleev('#B0A898','#C8C0B0'),
    [3,4,10,9,P.S],[2,7,1,3,P.S],[13,7,1,3,P.S],
    ...eyebrowsHeavy('#5A4A3A'),
    [4,7,2,2,'#0A0A1E'],              // olhos escuros e fundos
    [10,7,2,2,'#0A0A1E'],
    [4,7,1,1,'#3A6AAA'],[10,7,1,1,'#3A6AAA'],
    [7,10,2,1,P.N],[5,12,2,1,P.M],[9,12,2,1,P.M],
  ],

  /* 2 — MARIE CURIE ────────────────────────────────────────────────
     Cabelo escuro, RISCA AO MEIO, coque. Olhos determinados/sérios.
     Expressão focada (como nas fotos). Frasco verde radioativo. */
  [
    ...base('#880E4F','#00C853'),
    ...hairCurie('#1A1A1A'),
    [3,4,10,9,P.S],[2,7,1,3,P.S],[13,7,1,3,P.S],
    // Olhos mais abertos (feminino) e sérios
    [4,7,3,2,'#1A1A2E'],[9,7,3,2,'#1A1A2E'],
    [4,7,1,1,'#4A8ACC'],[9,7,1,1,'#4A8ACC'],
    [7,10,2,1,P.N],
    // Lábios mais fechados (expressão séria)
    [6,12,4,1,'#904040'],
    // Cabelo visível cobrindo testa (risca ao meio)
    [7,4,2,1,'#1A1A1A'],             // risca central
    [3,5,3,1,'#1A1A1A'],[10,5,3,1,'#1A1A1A'],
    // Ponto verde no jaleco (radioatividade)
    [7,17,2,1,'#00C853'],
  ],

  /* 3 — JOHN DALTON ────────────────────────────────────────────────
     ÓCULOS REDONDOS GRANDES (muito característico), cabelo cinza curto,
     rosto rechonchudo. Quaker simples. Daltonismo = frasco cinza. */
  [
    ...base('#37474F','#90A4AE'),
    ...hairDalton('#909090'),
    [3,4,10,9,P.S],[2,7,1,3,P.S],[13,7,1,3,P.S],
    [4,7,2,2,P.E],[10,7,2,2,P.E],
    [4,7,1,1,'#4A7FCC'],[10,7,1,1,'#4A7FCC'],
    ...glassesBig('#2A2A2A'),
    [7,10,2,1,P.N],[5,12,2,1,P.M],[9,12,2,1,P.M],
    // Rosto ligeiramente mais redondo/cheio
    [2,6,1,4,P.S],[13,6,1,4,P.S],
  ],

  /* 4 — LINUS PAULING ──────────────────────────────────────────────
     Cabelo escuro ONDULADO, GRAVATA BORBOLETA verde (marca registrada).
     Aparência de professor amigável. Frasco âmbar. */
  [
    ...base('#1B5E20','#FF6F00'),
    ...hairPauling('#2C1A0E'),
    ...face(),
    ...bowTie('#43A047'),
    [5,12,6,1,'#D06040'],            // sorriso simpático
  ],

  /* 5 — ROBERT BOYLE ───────────────────────────────────────────────
     Cabelo PRETO ENCARACOLADO natural (século XVII, NÃO peruca branca).
     Gola de renda MUITO LARGA. Longo rosto oval. Sem barba.
     Retratos: Kerseboom c.1689 — dark, shoulder-length curly hair. */
  [
    ...base('#0D47A1','#81D4FA'),
    ...hairBoyle('#1A1A1A'),
    [3,4,10,9,P.S],[2,5,1,5,P.S],[13,5,1,5,P.S],  // rosto mais alongado
    [4,7,2,2,P.E],[10,7,2,2,P.E],
    [4,7,1,1,'#4A7FCC'],[10,7,1,1,'#4A7FCC'],
    [7,10,2,1,P.N],[5,12,2,1,P.M],[9,12,2,1,P.M],
    ...laceCollarBoyle('#FFFFFF'),   // gola larga século XVII
  ],

  /* 6 — FRITZ HABER ────────────────────────────────────────────────
     CARECA (topo completamente sem cabelo), PINCE-NEZ no nariz (não hastes),
     BIGODINHO FINO, charuto. "Small, bald, potbellied". */
  [
    ...base('#33691E','#C6EF4A'),
    ...hairHaber('#2A2A2A'),          // apenas franja mínima lateral
    [3,4,10,9,P.S],[2,7,1,3,P.S],[13,7,1,3,P.S],
    [4,7,2,2,P.E],[10,7,2,2,P.E],
    [4,7,1,1,'#4A7FCC'],[10,7,1,1,'#4A7FCC'],
    [7,10,2,1,P.N],
    ...pinceNez('#2A2A2A'),           // pince-nez: prende no nariz
    ...mustacheThin('#111111'),
    [5,12,2,1,P.M],[9,12,2,1,P.M],
    ...cigar('#C4784A'),             // charuto de Virgínia
  ],

  /* 7 — AUGUST KEKULÉ ──────────────────────────────────────────────
     Barba BIFURCADA em W (aparece em todos os retratos da maturidade).
     "In his forties he allowed his beard to bifurcate splendidly into a W shape."
     Frasco dourado (benzeno / anel). */
  [
    ...base('#E65100','#FDD835'),
    ...hairKekule('#4E342E','#6D4C41'),
    [3,4,10,9,P.S],[2,7,1,3,P.S],[13,7,1,3,P.S],
    [4,7,2,2,P.E],[10,7,2,2,P.E],
    [4,7,1,1,'#4A7FCC'],[10,7,1,1,'#4A7FCC'],
    [7,10,2,1,P.N],[5,12,2,1,P.M],[9,12,2,1,P.M],
  ],

  /* 8 — ALFRED NOBEL ───────────────────────────────────────────────
     Barba aparada média, cabelo rareando, aparência vitoriana correta.
     Expressão pensativa/melancólica. */
  [
    ...base('#B71C1C','#FF7043'),
    ...hairNobel('#6D4C41','#5D4037'),
    ...face(),
  ],

  /* 9 — HUMPHRY DAVY ───────────────────────────────────────────────
     Cabelo PRETO (NÃO castanho/dourado!), jovem, sem barba, elegante.
     Retrato Lawrence 1821: "black hair, grey eyes, fresh complexion".
     Era um dandy da era da Regência, muito estiloso. */
  [
    ...base('#F57F17','#FFD600'),
    ...hairDavy('#111111'),           // PRETO, não castanho
    ...face(),
    // Sem barba, complexão jovem e fresca
    [5,12,6,1,'#903030'],            // lábios expressivos
    // Lenço/cravate elegante (era um dandy)
    [6,13,4,1,'#FFFFF0'],
  ],

  /* 10 — JOSEPH PRIESTLEY ──────────────────────────────────────────
     Peruca branca SIMPLES de clérigo anglicano (não exuberante),
     óculos redondos, gola clerical. Era dissidente religioso/pastor.
     Frasco ciano (gases/oxigênio). */
  [
    ...base('#006064','#80DEEA'),
    ...wigPriestley('#F0ECD8'),
    [3,4,10,9,P.S],[2,7,1,3,P.S],[13,7,1,3,P.S],
    [4,7,2,2,P.E],[10,7,2,2,P.E],
    [4,7,1,1,'#4A7FCC'],[10,7,1,1,'#4A7FCC'],
    [7,10,2,1,P.N],[5,12,2,1,P.M],[9,12,2,1,P.M],
    ...glassesSmall('#3A3A3A'),      // Priestley usava óculos
    ...clericalCollar('#FFFFFF'),    // gola de clérigo
  ],

  /* 11 — SVANTE ARRHENIUS ──────────────────────────────────────────
     Cabelo LOIRO ESCANDINAVO (não amarelo brilhante, mais dourado opaco),
     óculos redondos, bigodinho fino loiro. Aparência nórdica académica. */
  [
    ...base('#4A148C','#CE93D8'),
    ...hairArrhenius('#D4B870'),     // loiro dourado opaco (mais realista)
    [3,4,10,9,P.S],[2,7,1,3,P.S],[13,7,1,3,P.S],
    [4,7,2,2,P.E],[10,7,2,2,P.E],
    [4,7,1,1,'#4A7FCC'],[10,7,1,1,'#4A7FCC'],
    ...glassesSmall('#3A3A3A'),
    [7,10,2,1,P.N],
    ...mustacheThin('#B8960A'),      // bigode loiro escuro
    [5,12,2,1,P.M],[9,12,2,1,P.M],
  ],
];

/* ─── EXPORT GLOBAL ─── */
const SCIENTIST_SPRITES = SPRITES_RAW.map(calls => sprite(calls));
if(typeof window!=='undefined') window.SCIENTIST_SPRITES = SCIENTIST_SPRITES;
