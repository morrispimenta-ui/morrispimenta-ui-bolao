
export function parseScore(score){
  if(!score || !/^\d+x\d+$/.test(score)) return null;
  const [a,b]=score.split('x').map(Number); return [a,b];
}
export function outcome(score){ const s=parseScore(score); if(!s) return null; return s[0]>s[1]?1:(s[0]<s[1]?-1:0); }
export function pairCodes(match){ if(!match || !match.includes(' x ')) return null; return match.split(' x ').map(x=>x.trim()); }
export function isPlayed(g){ return g && g.status !== 'Pendente' && g.score; }
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
  if(!pred) return {points:0,status:'sem palpite'};
  if(pred===result) return {points:5,status:'placar exato'};
  if(outcome(pred)===outcome(result)) return {points:3,status:'vencedor/empate'};
  return {points:0,status:'erro'};
}
export function alignedExact(predPair,predScore,game){
  const s=parseScore(predScore); if(!predPair || !s) return false;
  const byTeam={}; byTeam[predPair[0]]=s[0]; byTeam[predPair[1]]=s[1];
  return byTeam[game.home]===game.home_goals && byTeam[game.away]===game.away_goals;
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
  const gamesById=Object.fromEntries(data.resultados.map(g=>[g.game_id,g]));
  const actualQualified=new Set();
  for(let gid=73;gid<=88;gid++){ const g=gamesById[gid]; if(g?.home&&g?.away){actualQualified.add(g.home);actualQualified.add(g.away);} }
  const actualAdv=actualAdvancersByPhase(data.resultados);
  const details={}; const ranking=[];
  for(const p of data.participantes.filter(x=>x.valid)){
    const det=data.apostas_detalhes[p.entry_id];
    let groupPoints=0, groupExact=0;
    for(const row of det.group_predictions){
      const g=gamesById[row.game_id]; if(!g || !isPlayed(g)) continue;
      const s=scoreGroup(row.prediction,g.score); row.points=s.points; row.status=s.status; row.result=g.score;
      groupPoints+=s.points; if(s.points===5) groupExact++;
    }
    const predQualified=new Set(det.predicted_qualified||[]);
    const classifiedHits=[...predQualified].filter(t=>actualQualified.has(t)).sort();
    const classifiedPoints=classifiedHits.length*5;
    let confrontationPoints=0, exactBonusPoints=0, koCravadas=0;
    const predictedWinnersByPhase={};
    for(const row of det.knockout_predictions){
      const ph=phaseKey(row.game_id);
      if(row.predicted_winner && ph){ predictedWinnersByPhase[ph] ||= new Set(); predictedWinnersByPhase[ph].add(row.predicted_winner); }
      row.points_confronto=0; row.points_avanco=0; row.points_placar=0; row.points=0; row.status='pendente';
      const g=gamesById[row.game_id];
      if(g && isPlayed(g)){
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
      for(const row of det.knockout_predictions){
        if(phaseKey(row.game_id)===ph && row.predicted_winner && actualSet.has(row.predicted_winner) && !allocated.has(row.predicted_winner)){
          row.points_avanco=5; allocated.add(row.predicted_winner);
          if(row.status==='erro') row.status='classificado correto';
          else if(row.status==='confronto correto') row.status='confronto + classificado';
        }
      }
    }
    for(const row of det.knockout_predictions) row.points=(row.points_confronto||0)+(row.points_avanco||0)+(row.points_placar||0);
    const mata=confrontationPoints+advancementPoints+exactBonusPoints;
    const total=groupPoints+classifiedPoints+mata;
    details[p.entry_id]=det;
    ranking.push({entry_id:p.entry_id,name:p.name,bet_number:p.bet_number,display_name:p.display_name,total,grupos:groupPoints+classifiedPoints,grupos_jogos:groupPoints,classificados:classifiedPoints,mata_mata:mata,ko_confronto:confrontationPoints,ko_avanco:advancementPoints,ko_placar:exactBonusPoints,bonus:0,cravadas:groupExact+koCravadas,cravadas_grupo:groupExact,cravadas_mata_mata:koCravadas,classificados_acertos:classifiedHits.length,finals:p.finals});
  }
  ranking.sort((a,b)=>b.total-a.total || b.cravadas-a.cravadas || a.display_name.localeCompare(b.display_name,'pt-BR'));
  ranking.forEach((r,i)=>r.posicao=i+1);
  return {ranking,details};
}
