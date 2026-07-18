export function parseScore(score){
  if(!score || !/^\d+x\d+$/.test(String(score).trim())) return null;
  const [a,b]=String(score).trim().split('x').map(Number); return [a,b];
}
export function outcome(score){ const s=parseScore(score); if(!s) return null; return s[0]>s[1]?1:(s[0]<s[1]?-1:0); }
export function pairCodes(match){ if(!match || !String(match).includes(' x ')) return null; return String(match).split(' x ').map(x=>x.trim()); }
export function isPlayed(g){ return g && g.status !== 'Pendente' && g.score && g.home_goals != null && g.away_goals != null; }
export function phaseKey(gid){
  if(gid>=73 && gid<=88) return 'Rodada de 32';
  if(gid>=89 && gid<=96) return 'Oitavas de Final';
  if(gid>=97 && gid<=100) return 'Quartas de Final';
  if(gid>=101 && gid<=102) return 'Semifinais';
  if(gid===103) return '3º Lugar';
  if(gid===104) return 'Final';
  return null;
}
export function scoreGroup(pred,result){
  if(!pred || !result) return {points:0,status:'pendente'};
  if(pred===result) return {points:5,status:'placar exato'};
  if(outcome(pred)===outcome(result)) return {points:3,status:'vencedor/empate'};
  return {points:0,status:'erro'};
}
export function alignedExact(predPair,predScore,game){
  // No simulador, quando o usuário escolhe apenas o classificado sem preencher placar,
  // o sistema cria um placar técnico só para permitir avanço/confronto. Esse placar
  // não pode gerar bônus de placar exato. Resultados oficiais nunca usam essa marca.
  if(game?.score_placeholder || game?.simulated_without_score) return false;
  const s=parseScore(predScore); if(!predPair || !s || !game) return false;
  const byTeam={}; byTeam[predPair[0]]=s[0]; byTeam[predPair[1]]=s[1];
  return byTeam[game.home]===game.home_goals && byTeam[game.away]===game.away_goals;
}
function normalizeResultsInput(resultados){ if(Array.isArray(resultados)) return resultados; if(resultados && Array.isArray(resultados.resultados)) return resultados.resultados; if(resultados && Array.isArray(resultados.results)) return resultados.results; return []; }
function cloneResults(resultados){ return normalizeResultsInput(resultados).map(g=>({...g})); }
function teamName(code, teams){ return (teams||[]).find(t=>t.code===code)?.name || code || 'A definir'; }
function normalizeText(v){ return String(v || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
function finalBonusConfig(regras={}){
  const b = regras?.bonus_finais || {};
  return {
    campeao: Number(b.campeao ?? 70),
    vice: Number(b.vice ?? 50),
    terceiro: Number(b.terceiro ?? 30),
    quarto: Number(b.quarto ?? 10),
    artilheiro: Number(b.artilheiro ?? 40)
  };
}
function compareFinalPrediction(predName, code, teams=[]){
  return !!predName && !!code && normalizeText(predName) === normalizeText(teamName(code, teams));
}
function officialTopScorer(data={}){
  return data.artilheiro_oficial
    || data.artilheiro
    || data.top_scorer
    || data.resultados_meta?.artilheiro_oficial
    || data.resultados_meta?.artilheiro
    || data.resultados_meta?.top_scorer
    || data.metadata?.artilheiro_oficial
    || data.metadata?.artilheiro
    || data.metadata?.top_scorer
    || null;
}
export function finalPodiumFromResults(games=[]){
  const byGame = Object.fromEntries((games || []).map(g => [Number(g.game_id), g]));
  const final = byGame[104];
  const third = byGame[103];
  return {
    campeao: isPlayed(final) ? final.advancer : null,
    vice: isPlayed(final) ? loserOf(final) : null,
    terceiro: isPlayed(third) ? third.advancer : null,
    quarto: isPlayed(third) ? loserOf(third) : null
  };
}
export function finalBonusForFinals(finals={}, podium={}, artilheiro=null, teams=[], regras={}){
  const cfg = finalBonusConfig(regras);
  const items = {
    campeao: compareFinalPrediction(finals.campeao, podium.campeao, teams) ? cfg.campeao : 0,
    vice: compareFinalPrediction(finals.vice, podium.vice, teams) ? cfg.vice : 0,
    terceiro: compareFinalPrediction(finals.terceiro, podium.terceiro, teams) ? cfg.terceiro : 0,
    quarto: compareFinalPrediction(finals.quarto, podium.quarto, teams) ? cfg.quarto : 0,
    artilheiro: artilheiro && normalizeText(finals.artilheiro) === normalizeText(artilheiro) ? cfg.artilheiro : 0
  };
  return { ...items, total: Object.values(items).reduce((sum, n) => sum + Number(n || 0), 0) };
}
export function normalizeGame(g, teams=[]){
  if(!g) return g;
  if(g.home === '') g.home = null;
  if(g.away === '') g.away = null;
  g.home_name = teamName(g.home, teams);
  g.away_name = teamName(g.away, teams);
  const hg = g.home_goals === '' || g.home_goals == null ? null : Number(g.home_goals);
  const ag = g.away_goals === '' || g.away_goals == null ? null : Number(g.away_goals);
  if(g.status === 'Pendente' || (!Number.isFinite(hg) && !Number.isFinite(ag))){
    if(g.status === 'Pendente') { g.home_goals=null; g.away_goals=null; g.score=null; g.winner=null; g.advancer=null; }
    return g;
  }
  g.home_goals = Number.isFinite(hg) ? hg : null;
  g.away_goals = Number.isFinite(ag) ? ag : null;
  g.score = g.home_goals!=null && g.away_goals!=null ? `${g.home_goals}x${g.away_goals}` : null;
  if(g.score){
    if(g.home_goals>g.away_goals) g.winner=g.home;
    else if(g.home_goals<g.away_goals) g.winner=g.away;
    else g.winner=null;
    if(g.game_id>=73 && !g.advancer && g.winner) g.advancer=g.winner;
  }
  return g;
}
function loserOf(g){ if(!g?.home || !g?.away || !g?.advancer) return null; return g.advancer===g.home ? g.away : g.home; }
function clearPendingMatch(g){
  if(!g || isPlayed(g)) return;
  g.home=null; g.away=null; g.home_name='A definir'; g.away_name='A definir';
  g.home_goals=null; g.away_goals=null; g.score=null; g.winner=null; g.advancer=null;
}
function forceBracketMatch(byId, gameId, home, away, teams=[]){
  const g=byId[gameId]; if(!g) return false;
  // Jogos já oficializados preservam placar/status; a origem dos times vem da própria partida oficial.
  // Jogos pendentes precisam sempre obedecer à chave calculada, evitando que uma planilha com valores
  // antigos ou fórmulas de fase futura bagunce próximos jogos e simulador.
  if(!home || !away){ clearPendingMatch(g); return false; }
  if(!isPlayed(g)){
    g.home=home; g.away=away; g.home_name=teamName(home, teams); g.away_name=teamName(away, teams);
    if(g.advancer && ![home, away].includes(g.advancer)) g.advancer=null;
    if(g.winner && ![home, away, 'EMP'].includes(g.winner)) g.winner=null;
  }else{
    g.home_name=teamName(g.home, teams); g.away_name=teamName(g.away, teams);
  }
  return true;
}
export function prepareResults(resultados, teams=[]){
  const out=cloneResults(resultados);
  const byId=Object.fromEntries(out.map(g=>[g.game_id,g]));
  out.forEach(g=>normalizeGame(g, teams));

  // Chave oficial derivada. O placar vem da planilha/JSON; os confrontos futuros vêm dos classificados
  // já definidos. Isso evita que linhas futuras da planilha sobrescrevam a chave real.
  forceBracketMatch(byId,97, byId[89]?.advancer, byId[90]?.advancer, teams);
  forceBracketMatch(byId,98, byId[93]?.advancer, byId[94]?.advancer, teams);
  forceBracketMatch(byId,99, byId[91]?.advancer, byId[92]?.advancer, teams);
  forceBracketMatch(byId,100,byId[95]?.advancer, byId[96]?.advancer, teams);

  // Rodadas posteriores: só aparecem como jogo real quando os dois classificados anteriores existem.
  // Caso contrário, ficam A definir e não entram na lista de próximos jogos.
  forceBracketMatch(byId,101,byId[97]?.advancer, byId[98]?.advancer, teams);
  forceBracketMatch(byId,102,byId[99]?.advancer, byId[100]?.advancer, teams);
  forceBracketMatch(byId,104,byId[101]?.advancer, byId[102]?.advancer, teams);
  forceBracketMatch(byId,103,loserOf(byId[101]), loserOf(byId[102]), teams);
  out.forEach(g=>normalizeGame(g, teams));
  return out;
}
export function actualAdvancersByPhase(games){
  const phases={};
  for(const g of games){
    if(g.game_id>=73 && isPlayed(g) && g.advancer){
      const ph=phaseKey(g.game_id); phases[ph] ||= new Set(); phases[ph].add(g.advancer);
    }
  }
  return phases;
}
export function calculate(data){
  const resultados = prepareResults(data.resultados || [], data.times || []);
  const gamesById=Object.fromEntries(resultados.map(g=>[g.game_id,g]));
  const actualQualified=new Set();
  for(let gid=73;gid<=88;gid++){ const g=gamesById[gid]; if(g?.home&&g?.away){actualQualified.add(g.home);actualQualified.add(g.away);} }
  const actualAdv=actualAdvancersByPhase(resultados);
  const podium=finalPodiumFromResults(resultados);
  const artilheiroOficial=officialTopScorer(data);
  const details={}; const ranking=[];
  for(const p of (data.participantes||[]).filter(x=>x.valid)){
    const det=structuredClone(data.apostas_detalhes?.[p.entry_id] || {group_predictions:[],knockout_predictions:[],predicted_qualified:[],finals:{}});
    let groupPoints=0, groupExact=0;
    for(const row of det.group_predictions||[]){
      const g=gamesById[row.game_id]; row.points=0; row.status='pendente'; row.result=g?.score||null;
      if(!g || !isPlayed(g)) continue;
      const s=scoreGroup(row.prediction,g.score); row.points=s.points; row.status=s.status; row.result=g.score;
      groupPoints+=s.points; if(s.points===5) groupExact++;
    }
    const predQualified=new Set(det.predicted_qualified||[]);
    const classifiedHits=[...predQualified].filter(t=>actualQualified.has(t)).sort();
    det.classified_hits = classifiedHits;
    const classifiedPoints=classifiedHits.length*5;
    let confrontationPoints=0, exactBonusPoints=0, koCravadas=0;
    const predictedWinnersByPhase={};
    for(const row of det.knockout_predictions||[]){
      const ph=phaseKey(row.game_id);
      if(row.predicted_winner && ph){ predictedWinnersByPhase[ph] ||= new Set(); predictedWinnersByPhase[ph].add(row.predicted_winner); }
      row.points_confronto=0; row.points_avanco=0; row.points_placar=0; row.points=0; row.status='pendente'; row.result=null; row.official_match=null;
      const g=gamesById[row.game_id];
      if(g && isPlayed(g)){
        row.result=g.score; row.official_match = `${g.home} x ${g.away}`;
        const pp=pairCodes(row.prediction_match);
        if(pp && new Set(pp).size===2 && pp.includes(g.home) && pp.includes(g.away)){
          row.points_confronto=5; confrontationPoints+=5; row.status='confronto correto';
          if(row.predicted_winner===g.advancer && alignedExact(pp,row.prediction_score,g)){
            row.points_placar=3; exactBonusPoints+=3; koCravadas++; row.status='placar exato';
          }
        } else row.status='erro';
      }
    }
    let advancementPoints=0;
    for(const [ph,setPred] of Object.entries(predictedWinnersByPhase)){
      // Regra V20: na final não existe mais ponto de avanço. O campeão é remunerado
      // exclusivamente pelo bônus final de campeão. Confronto correto e placar exato
      // da final continuam valendo quando aplicáveis, mas o vencedor da final não gera
      // +5 de avanço/classificado.
      if(ph === 'Final') continue;
      const actualSet=actualAdv[ph] || new Set(); const allocated=new Set();
      for(const team of setPred){ if(actualSet.has(team)) advancementPoints+=5; }
      for(const row of det.knockout_predictions||[]){
        if(phaseKey(row.game_id)===ph && row.predicted_winner && actualSet.has(row.predicted_winner) && !allocated.has(row.predicted_winner)){
          row.points_avanco=5; allocated.add(row.predicted_winner);
          if(row.status==='erro') row.status='classificado correto';
          else if(row.status==='confronto correto') row.status='confronto + classificado';
        }
      }
    }
    for(const row of det.knockout_predictions||[]) row.points=(row.points_confronto||0)+(row.points_avanco||0)+(row.points_placar||0);
    const mata=confrontationPoints+advancementPoints+exactBonusPoints;
    const finalBonus=finalBonusForFinals(p.finals || {}, podium, artilheiroOficial, data.times || [], data.regras || {});
    const bonus=finalBonus.total;
    const total=groupPoints+classifiedPoints+mata+bonus;
    det.final_bonus_detail = finalBonus;
    det.final_podium = podium;
    details[p.entry_id]=det;
    ranking.push({entry_id:p.entry_id,name:p.name,bet_number:p.bet_number,display_name:p.display_name,total,grupos:groupPoints+classifiedPoints,grupos_jogos:groupPoints,classificados:classifiedPoints,mata_mata:mata,ko_confronto:confrontationPoints,ko_avanco:advancementPoints,ko_placar:exactBonusPoints,bonus,bonus_final_detalhe:finalBonus,cravadas:groupExact,cravadas_grupo:groupExact,placares_exatos_mata_mata:koCravadas,cravadas_mata_mata:koCravadas,classificados_acertos:classifiedHits.length,finals:p.finals});
  }
  ranking.sort((a,b)=>b.total-a.total || b.cravadas-a.cravadas || a.display_name.localeCompare(b.display_name,'pt-BR'));
  ranking.forEach((r,i)=>r.posicao=i+1);
  return {ranking,details,resultados};
}
