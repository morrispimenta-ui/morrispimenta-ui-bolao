import { calculate, prepareResults, isPlayed } from './engine.js';

const FINAL_BONUS = { campeao:70, vice:50, terceiro:30, quarto:10, artilheiro:40 };
const BRACKET_ORDER = [97,98,99,100,101,102,103,104];

function normalizeText(v){ return String(v || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
function byId(results){ return Object.fromEntries((results || []).map(g => [Number(g.game_id), g])); }
function clone(obj){ return typeof structuredClone === 'function' ? structuredClone(obj) : JSON.parse(JSON.stringify(obj)); }
function teamName(code, times=[]){ return (times || []).find(t => t.code === code)?.name || code || 'A definir'; }
function loserOfGame(g){ if(!g?.home || !g?.away || !g?.advancer) return null; return g.advancer === g.home ? g.away : g.home; }
function isEditableGame(g){ return g && Number(g.game_id) >= 97 && !isPlayed(g); }
function normalizeChoice(choice){
  if(!choice) return null;
  const home_goals = choice.home_goals === '' || choice.home_goals == null ? null : Number(choice.home_goals);
  const away_goals = choice.away_goals === '' || choice.away_goals == null ? null : Number(choice.away_goals);
  return {
    home_goals: Number.isFinite(home_goals) ? home_goals : null,
    away_goals: Number.isFinite(away_goals) ? away_goals : null,
    advancer: choice.advancer || null
  };
}

function setGameSimulated(g, choice, times=[]){
  const c = normalizeChoice(choice);
  if(!g || !c || !g.home || !g.away || !c.advancer || ![g.home, g.away].includes(c.advancer)) return false;
  let hg = c.home_goals;
  let ag = c.away_goals;
  const explicitScore = hg != null && ag != null;
  // Regra V20: o simulador exige placar para jogos pendentes, porque o placar pode
  // gerar bônus de +3 no mata-mata e alterar a classificação simulada do bolão.
  // Sem placar, o jogo não é simulado.
  if(!explicitScore) return false;
  if(hg === ag){
    // empate permitido; classificado define avanço por pênaltis. winner fica null.
    g.winner = null;
  } else {
    const naturalWinner = hg > ag ? g.home : g.away;
    // Placar sem empate não pode contradizer o classificado escolhido.
    if(naturalWinner !== c.advancer) return false;
    g.winner = c.advancer;
  }
  g.home_goals = hg;
  g.away_goals = ag;
  g.score = `${hg}x${ag}`;
  g.status = 'Simulado';
  g.advancer = c.advancer;
  g.home_name = teamName(g.home, times);
  g.away_name = teamName(g.away, times);
  g.simulated = true;
  g.score_placeholder = false;
  g.simulated_without_score = false;
  return true;
}

export function buildSimulatedResults(baseResults, times=[], choices={}){
  let results = prepareResults(clone(baseResults || []), times);
  for(const gameId of BRACKET_ORDER){
    results = prepareResults(results, times);
    const map = byId(results);
    const g = map[gameId];
    if(!g || isPlayed(g)) continue; // oficiais ficam bloqueados.
    const choice = choices[String(gameId)] || choices[gameId];
    if(choice) setGameSimulated(g, choice, times);
  }
  return prepareResults(results, times);
}

export function getFinalPodium(results){
  const map = byId(results || []);
  const final = map[104];
  const third = map[103];
  return {
    campeao: isPlayed(final) ? final.advancer : null,
    vice: isPlayed(final) ? loserOfGame(final) : null,
    terceiro: isPlayed(third) ? third.advancer : null,
    quarto: isPlayed(third) ? loserOfGame(third) : null
  };
}

export function finalBonusForRankingRow(row, podium, artilheiro, times=[]){
  const finals = row?.finals || {};
  const nameByCode = code => teamName(code, times);
  const compare = (predName, code) => !!predName && !!code && normalizeText(predName) === normalizeText(nameByCode(code));
  const items = {
    campeao: compare(finals.campeao, podium.campeao) ? FINAL_BONUS.campeao : 0,
    vice: compare(finals.vice, podium.vice) ? FINAL_BONUS.vice : 0,
    terceiro: compare(finals.terceiro, podium.terceiro) ? FINAL_BONUS.terceiro : 0,
    quarto: compare(finals.quarto, podium.quarto) ? FINAL_BONUS.quarto : 0,
    artilheiro: artilheiro && normalizeText(finals.artilheiro) === normalizeText(artilheiro) ? FINAL_BONUS.artilheiro : 0
  };
  return { ...items, total: Object.values(items).reduce((s,n)=>s+n,0) };
}

export function computeSimulation(data, officialRanking, choices={}, artilheiro=null){
  const officialSnapshot = clone(officialRanking || []);
  const officialById = Object.fromEntries(officialSnapshot.map(r => [r.entry_id, r]));
  const simulatedResults = buildSimulatedResults(data.resultados || [], data.times || [], choices || {});
  const calc = calculate({ ...clone(data), resultados: simulatedResults });
  const podium = getFinalPodium(simulatedResults);
  const ranking = calc.ranking.map(row => {
    const official = officialById[row.entry_id] || {};
    const bonusFinal = finalBonusForRankingRow(row, podium, artilheiro, data.times || []);
    const total_simulado = Number(row.total || 0) + bonusFinal.total;
    return {
      ...row,
      total_oficial: Number(official.total ?? row.total ?? 0),
      posicao_oficial: official.posicao || row.posicao,
      total_sem_bonus_final: row.total,
      bonus_final_simulado: bonusFinal.total,
      bonus_final_detalhe: bonusFinal,
      total_simulado,
      diferenca_pontos: total_simulado - Number(official.total ?? row.total ?? 0)
    };
  }).sort((a,b)=>b.total_simulado-a.total_simulado || b.cravadas-a.cravadas || a.display_name.localeCompare(b.display_name,'pt-BR'));
  ranking.forEach((r,i)=>{ r.posicao_simulada=i+1; r.variacao_posicao = Number(r.posicao_oficial || r.posicao_simulada) - r.posicao_simulada; });
  return { ranking, details: calc.details, resultados: simulatedResults, podium, artilheiro, officialRanking: officialSnapshot };
}

export function uniqueScorers(participantes=[]){
  const m = {};
  for(const p of participantes || []){
    const name = p?.finals?.artilheiro;
    if(!name) continue;
    m[name] ||= [];
    m[name].push(p.display_name || p.name);
  }
  // V16: lista complementar para o simulador. Não altera apostas nem pontuação oficial;
  // apenas permite simular artilheiros relevantes da Copa mesmo que ninguém tenha apostado neles.
  const extras = ['Lionel Messi'];
  for(const name of extras){
    m[name] ||= [];
  }
  return Object.entries(m).map(([name, participants]) => ({ name, count: participants.length, participants: participants.sort((a,b)=>a.localeCompare(b,'pt-BR')) }))
    .sort((a,b)=>b.count-a.count || a.name.localeCompare(b.name,'pt-BR'));
}

export function summarizeScenario(sim, times=[]){
  const name = code => teamName(code, times);
  const top5 = (sim.ranking || []).slice(0,5).map(r => `${r.posicao_simulada}. ${r.display_name} — ${r.total_simulado} pts (${r.diferenca_pontos>=0?'+':''}${r.diferenca_pontos})`).join('\n');
  return `Simulação do Bolão Copa 2026:\nCampeão: ${name(sim.podium.campeao)}\nVice: ${name(sim.podium.vice)}\n3º lugar: ${name(sim.podium.terceiro)}\n4º lugar: ${name(sim.podium.quarto)}\nArtilheiro: ${sim.artilheiro || 'não definido'}\n\nTop 5 simulado:\n${top5}`;
}

export { isEditableGame };
