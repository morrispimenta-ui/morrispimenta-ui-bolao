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
  const s=parseScore(predScore); if(!predPair || !s || !game) return false;
  const byTeam={}; byTeam[predPair[0]]=s[0]; byTeam[predPair[1]]=s[1];
  return byTeam[game.home]===game.home_goals && byTeam[game.away]===game.away_goals;
}
function cloneResults(resultados){ return (resultados||[]).map(g=>({...g})); }
function teamName(code, teams){ return (teams||[]).find(t=>t.code===code)?.name || code || 'A definir'; }
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
function setMatchIfNeeded(byId, gameId, home, away, teams=[]){
  const g=byId[gameId]; if(!g || !home || !away) return false;
  if(!g.home || !g.away){
    g.home=home; g.away=away; g.home_name=teamName(home, teams); g.away_name=teamName(away, teams);
    if(g.advancer && ![home, away].includes(g.advancer)) g.advancer=null;
    return true;
  }
  return false;
}
export function prepareResults(resultados, teams=[]){
  const out=cloneResults(resultados);
  const byId=Object.fromEntries(out.map(g=>[g.game_id,g]));
  out.forEach(g=>normalizeGame(g, teams));
  // Chave fixa da Copa simulada: permite que o site público mostre automaticamente semifinais/final
  // quando o resultados.json publicado já contiver os classificados das fases anteriores.
  setMatchIfNeeded(byId,97, byId[89]?.advancer, byId[90]?.advancer, teams);
  setMatchIfNeeded(byId,98, byId[91]?.advancer, byId[92]?.advancer, teams);
  setMatchIfNeeded(byId,99, byId[93]?.advancer, byId[94]?.advancer, teams);
  setMatchIfNeeded(byId,100,byId[95]?.advancer, byId[96]?.advancer, teams);
  setMatchIfNeeded(byId,101,byId[97]?.advancer, byId[98]?.advancer, teams);
  setMatchIfNeeded(byId,102,byId[99]?.advancer, byId[100]?.advancer, teams);
  setMatchIfNeeded(byId,104,byId[101]?.advancer, byId[102]?.advancer, teams);
  setMatchIfNeeded(byId,103,loserOf(byId[101]), loserOf(byId[102]), teams);
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
    const total=groupPoints+classifiedPoints+mata;
    details[p.entry_id]=det;
    ranking.push({entry_id:p.entry_id,name:p.name,bet_number:p.bet_number,display_name:p.display_name,total,grupos:groupPoints+classifiedPoints,grupos_jogos:groupPoints,classificados:classifiedPoints,mata_mata:mata,ko_confronto:confrontationPoints,ko_avanco:advancementPoints,ko_placar:exactBonusPoints,bonus:0,cravadas:groupExact,cravadas_grupo:groupExact,placares_exatos_mata_mata:koCravadas,cravadas_mata_mata:koCravadas,classificados_acertos:classifiedHits.length,finals:p.finals});
  }
  ranking.sort((a,b)=>b.total-a.total || b.cravadas-a.cravadas || a.display_name.localeCompare(b.display_name,'pt-BR'));
  ranking.forEach((r,i)=>r.posicao=i+1);
  return {ranking,details,resultados};
}
