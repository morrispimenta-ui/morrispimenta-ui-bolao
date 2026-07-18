import fs from 'fs';
import assert from 'assert/strict';
import { calculate, scoreGroup, prepareResults } from '../src/engine.js';
const read = name => JSON.parse(fs.readFileSync(new URL(`../data/${name}.json`, import.meta.url),'utf8'));
const rawResultados = read('resultados');
const resultadosArray = Array.isArray(rawResultados) ? rawResultados : (rawResultados.resultados || rawResultados.results || []);
const data = {resultados:rawResultados,participantes:read('participantes'),apostas_detalhes:read('apostas_detalhes'),regras:read('regras'),times:read('times')};

// Regras unitárias de grupo
assert.equal(scoreGroup('2x1','2x1').points,5,'placar exato na fase de grupos deve valer 5');
assert.equal(scoreGroup('3x1','2x0').points,3,'vencedor correto na fase de grupos deve valer 3');
assert.equal(scoreGroup('1x1','2x1').points,0,'empate previsto não pontua quando houve vencedor');
assert.equal(scoreGroup('1x1','0x0').points,3,'empate correto sem placar exato vale 3');

// Regras unitárias de mata-mata: placar exato vale 3, não 5.
const mini={
  resultados:[{game_id:73,phase:'Rodada de 32',home:'BRA',away:'JPN',home_goals:2,away_goals:1,score:'2x1',status:'Finalizado',winner:'BRA',advancer:'BRA'}],
  participantes:[{entry_id:1,name:'Teste',bet_number:1,display_name:'Teste #1',valid:true,finals:{}}],
  apostas_detalhes:{'1':{entry_id:1,display_name:'Teste #1',group_predictions:[],predicted_qualified:[],classified_hits:[],knockout_predictions:[{game_id:73,prediction_match:'BRA x JPN',prediction_score:'2x1',predicted_winner:'BRA'}]}}
};
const miniRank=calculate(structuredClone(mini)).ranking[0];
assert.equal(miniRank.ko_confronto,5,'confronto correto no mata-mata deve valer 5');
assert.equal(miniRank.ko_avanco,5,'avanço/classificado no mata-mata deve valer 5');
assert.equal(miniRank.ko_placar,3,'placar exato no mata-mata deve valer 3, não 5');
assert.equal(miniRank.total,13,'soma do mata-mata deve bater: 5+5+3');
assert.equal(miniRank.cravadas,0,'bônus de placar exato no mata-mata não entra na coluna de cravadas oficiais');
assert.equal(miniRank.placares_exatos_mata_mata,1,'bônus de placar exato do mata-mata deve ficar em coluna própria');

// V20: na final, não existe ponto de avanço do campeão; esse item é remunerado pelo bônus final.
const miniFinal={
  resultados:[{game_id:104,phase:'Final',home:'ESP',away:'ARG',home_goals:2,away_goals:1,score:'2x1',status:'Finalizado',winner:'ESP',advancer:'ESP'}],
  participantes:[{entry_id:2,name:'Teste Final',bet_number:1,display_name:'Teste Final #1',valid:true,finals:{campeao:'Espanha'}}],
  apostas_detalhes:{'2':{entry_id:2,display_name:'Teste Final #1',group_predictions:[],predicted_qualified:[],classified_hits:[],knockout_predictions:[{game_id:104,prediction_match:'ESP x ARG',prediction_score:'2x1',predicted_winner:'ESP'}]}},
  times: data.times,
  regras: data.regras
};
const miniFinalRank=calculate(structuredClone(miniFinal)).ranking[0];
assert.equal(miniFinalRank.ko_confronto,5,'confronto correto na final deve valer 5');
assert.equal(miniFinalRank.ko_avanco,0,'vencedor da final não deve gerar +5 de avanço; campeão é bônus final');
assert.equal(miniFinalRank.ko_placar,3,'placar exato na final deve valer +3 de bônus de placar');
assert.equal(miniFinalRank.bonus,70,'campeão correto deve receber o bônus final de 70 pontos quando a final estiver concluída');
assert.equal(miniFinalRank.total,78,'final deve somar confronto + placar + bônus de campeão, sem avanço: 5+3+70');

// V24: quando a final terminar, campeão e vice precisam ser creditados, e o artilheiro
// precisa vir da fonte de resultados/metadados sem depender de alteração manual no código.
const miniFinalComplete={
  resultados:[{game_id:104,phase:'Final',home:'ESP',away:'ARG',home_goals:4,away_goals:2,score:'4x2',status:'Finalizado',winner:'ESP',advancer:'ESP'}],
  resultados_meta:{artilheiro_oficial:'Lionel Messi'},
  participantes:[
    {entry_id:20,name:'Acertou final e artilheiro',bet_number:1,display_name:'Acertou final e artilheiro #1',valid:true,finals:{campeao:'Espanha',vice:'Argentina',artilheiro:'Lionel Messi'}},
    {entry_id:21,name:'Errou final e artilheiro',bet_number:1,display_name:'Errou final e artilheiro #1',valid:true,finals:{campeao:'Argentina',vice:'Espanha',artilheiro:'Kylian Mbappé'}}
  ],
  apostas_detalhes:{
    '20':{entry_id:20,display_name:'Acertou final e artilheiro #1',group_predictions:[],predicted_qualified:[],classified_hits:[],knockout_predictions:[]},
    '21':{entry_id:21,display_name:'Errou final e artilheiro #1',group_predictions:[],predicted_qualified:[],classified_hits:[],knockout_predictions:[]}
  },
  times: data.times,
  regras: data.regras
};
const completeFinalRanking=calculate(structuredClone(miniFinalComplete)).ranking;
const finalHit=completeFinalRanking.find(r=>r.entry_id===20);
const finalMiss=completeFinalRanking.find(r=>r.entry_id===21);
assert.equal(finalHit.bonus_final_detalhe.campeao,70,'campeão correto deve ser creditado quando #104 terminar');
assert.equal(finalHit.bonus_final_detalhe.vice,50,'vice correto deve ser creditado quando #104 terminar');
assert.equal(finalHit.bonus_final_detalhe.artilheiro,40,'artilheiro oficial vindo dos metadados deve ser creditado');
assert.equal(finalHit.bonus,160,'campeão + vice + artilheiro devem somar 160 pontos');
assert.equal(finalMiss.bonus,0,'quem inverteu campeão/vice e errou artilheiro não deve receber esses bônus');

// V23: a disputa de 3º lugar libera os bônus finais de 3º e 4º colocados assim que terminar,
// mesmo antes da final. Inglaterra vence a França: Inglaterra = 3º, França = 4º.
const miniThird={
  resultados:[
    {game_id:101,phase:'Semifinais',home:'FRA',away:'ESP',home_goals:0,away_goals:2,score:'0x2',status:'Finalizado',winner:'ESP',advancer:'ESP'},
    {game_id:102,phase:'Semifinais',home:'ENG',away:'ARG',home_goals:1,away_goals:2,score:'1x2',status:'Finalizado',winner:'ARG',advancer:'ARG'},
    {game_id:103,phase:'3º Lugar',home:'FRA',away:'ENG',home_goals:3,away_goals:6,score:'3x6',status:'Finalizado',winner:'ENG',advancer:'ENG'},
    {game_id:104,phase:'Final',home:null,away:null,home_goals:null,away_goals:null,score:null,status:'Pendente',winner:null,advancer:null}
  ],
  participantes:[
    {entry_id:3,name:'Acertou terceiro',bet_number:1,display_name:'Acertou terceiro #1',valid:true,finals:{terceiro:'Inglaterra',quarto:'França'}},
    {entry_id:4,name:'Errou terceiro',bet_number:1,display_name:'Errou terceiro #1',valid:true,finals:{terceiro:'França',quarto:'Inglaterra'}}
  ],
  apostas_detalhes:{
    '3':{entry_id:3,display_name:'Acertou terceiro #1',group_predictions:[],predicted_qualified:[],classified_hits:[],knockout_predictions:[]},
    '4':{entry_id:4,display_name:'Errou terceiro #1',group_predictions:[],predicted_qualified:[],classified_hits:[],knockout_predictions:[]}
  },
  times: data.times,
  regras: data.regras
};
const thirdRank=calculate(structuredClone(miniThird)).ranking;
const hitThird=thirdRank.find(r=>r.entry_id===3);
const missThird=thirdRank.find(r=>r.entry_id===4);
assert.equal(hitThird.bonus,40,'quem acertou Inglaterra em 3º e França em 4º deve receber 30+10 pontos');
assert.deepEqual(hitThird.bonus_final_detalhe, {campeao:0,vice:0,terceiro:30,quarto:10,artilheiro:0,total:40}, 'detalhe do bônus de 3º/4º deve ficar explícito');
assert.equal(missThird.bonus,0,'quem inverteu França/Inglaterra não deve receber bônus de 3º/4º');

// Regressão do ranking publicado: pontos e posições não podem mudar sem regra explícita.
const expected=read('ranking');
const result=calculate(structuredClone(data)).ranking;
assert.equal(result.length, expected.length, 'quantidade de participantes válidos deve permanecer igual');
for(let i=0;i<result.length;i++){
  assert.equal(result[i].entry_id, expected[i].entry_id, `posição ${i+1} deveria manter entry_id`);
  for(const field of ['total','grupos','grupos_jogos','classificados','mata_mata','ko_confronto','ko_avanco','ko_placar','bonus','cravadas']){
    assert.equal(result[i][field], expected[i][field], `${result[i].display_name}: ${field} divergente`);
  }
  assert.ok(Number.isFinite(result[i].total), `${result[i].display_name}: total inválido`);
  assert.ok(result[i].total>=0, `${result[i].display_name}: total negativo`);
  assert.equal(result[i].total, result[i].grupos + result[i].mata_mata + result[i].bonus, `${result[i].display_name}: total deve ser soma de grupos, mata-mata e bônus`);
}

// Auditoria de detalhes: todo total precisa bater com soma de linhas.
for(const r of result){
  const d = calculate(structuredClone(data)).details[r.entry_id];
  const groupSum = (d.group_predictions||[]).reduce((s,x)=>s+Number(x.points||0),0);
  const classifiedSum = (d.classified_hits||[]).length * 5;
  const koSum = (d.knockout_predictions||[]).reduce((s,x)=>s+Number(x.points||0),0);
  assert.equal(r.total, groupSum + classifiedSum + koSum + Number(r.bonus||0), `${r.display_name}: soma detalhada não bate`);
  const groupCravadas = (d.group_predictions||[]).filter(x=>x.status==='placar exato').length;
  assert.equal(r.cravadas, groupCravadas, `${r.display_name}: cravadas deve contar só placares exatos de grupos`);
}


// Estatísticas de cravadas: o ranking oficial usa cravadas de grupos, mas as estatísticas também exibem mata-mata.
const groupExactTotal = result.reduce((sum,r)=>sum+Number(r.cravadas_grupo || r.cravadas || 0),0);
const koExactTotal = result.reduce((sum,r)=>sum+Number(r.cravadas_mata_mata || r.placares_exatos_mata_mata || 0),0);
const koExactPoints = result.reduce((sum,r)=>sum+Number(r.ko_placar || 0),0);
assert.ok(groupExactTotal > 0, 'deve haver cravadas de grupos nas estatísticas');
assert.ok(koExactTotal > 0, 'deve haver cravadas de mata-mata nas estatísticas');
assert.equal(koExactPoints, koExactTotal * 3, 'cada cravada de mata-mata deve gerar exatamente 3 pontos de bônus');
for(const r of result){
  assert.equal(Number(r.ko_placar || 0), Number(r.cravadas_mata_mata || r.placares_exatos_mata_mata || 0) * 3, `${r.display_name}: bônus de placar do mata-mata deve ser cravadas_mata_mata x 3`);
}

// Fluxo de gestão: alterar resultados.json/exportar objeto com metadata e reabrir deve produzir o mesmo ranking.
const editedResults = structuredClone(resultadosArray);
const g97 = editedResults.find(g=>g.game_id===97);
g97.home='FRA'; g97.away='MAR'; g97.home_name='França'; g97.away_name='Marrocos'; g97.home_goals=2; g97.away_goals=0; g97.score='2x0'; g97.status='Finalizado'; g97.winner='FRA'; g97.advancer='FRA';
const g98 = editedResults.find(g=>g.game_id===98);
g98.home='ESP'; g98.away='BEL'; g98.home_name='Espanha'; g98.away_name='Bélgica'; g98.home_goals=2; g98.away_goals=1; g98.score='2x1'; g98.status='Finalizado'; g98.winner='ESP'; g98.advancer='ESP';
const preview = calculate({...structuredClone(data), resultados: editedResults}).ranking;
const exportedPrepared = prepareResults(editedResults, data.times);
const exportedJson = JSON.stringify(exportedPrepared,null,2);
const importedResults = JSON.parse(exportedJson);
const afterPublish = calculate({...structuredClone(data), resultados: importedResults}).ranking;
assert.deepEqual(afterPublish.map(r=>({id:r.entry_id,total:r.total,pos:r.posicao})), preview.map(r=>({id:r.entry_id,total:r.total,pos:r.posicao})), 'ranking após substituir resultados.json deve bater com prévia da gestão');
assert.deepEqual(preview.map(r=>({id:r.entry_id,total:r.total,pos:r.posicao})), result.map(r=>({id:r.entry_id,total:r.total,pos:r.posicao})), 'o cenário França 2x0 e Espanha 2x1 já está publicado nesta V10');
assert.equal(exportedPrepared.find(g=>g.game_id===97)?.home, 'FRA', 'exportação deve preservar/derivar França no jogo 97');
assert.equal(exportedPrepared.find(g=>g.game_id===98)?.home, 'ESP', 'exportação deve preservar/derivar Espanha no jogo 98');

// Fases exibidas: quartas só aparece como definida quando houver resultado.
for(const ph of ['Fase de Grupos','Rodada de 32','Oitavas de Final']) assert.ok(resultadosArray.some(g=>g.phase===ph && g.status!=='Pendente' && g.score), `fase ${ph} deve ter jogos finalizados para estatísticas`);
assert.ok(resultadosArray.some(g=>g.phase==='Quartas de Final' && g.status!=='Pendente' && g.score), 'quartas deve aparecer como fase definida quando #97/#98 estão publicados');

console.log('Todos os testes passaram. Motor recalculado, cravadas auditadas e fluxo resultados.json validado.');

// Simulador: deve trabalhar apenas em cópia temporária, sem alterar ranking oficial nem resultados oficiais.
import { computeSimulation, buildSimulatedResults, getFinalPodium } from '../src/simulator.js';
const officialBefore = result.map(r=>({id:r.entry_id,total:r.total,pos:r.posicao}));
const officialResultsBefore = JSON.stringify(resultadosArray);
const simChoices = {
  99:{home_goals:1,away_goals:2,advancer:'ENG'},
  100:{home_goals:2,away_goals:0,advancer:'ARG'},
  101:{home_goals:2,away_goals:1,advancer:'FRA'},
  102:{home_goals:1,away_goals:3,advancer:'ARG'},
  103:{home_goals:2,away_goals:0,advancer:'ESP'},
  104:{home_goals:2,away_goals:1,advancer:'FRA'}
};
const simulated = computeSimulation(structuredClone(data), result, simChoices, 'Kylian Mbappé');
assert.deepEqual(result.map(r=>({id:r.entry_id,total:r.total,pos:r.posicao})), officialBefore, 'simulador não pode alterar o ranking oficial em memória');
assert.equal(JSON.stringify(resultadosArray), officialResultsBefore, 'simulador não pode alterar os resultados oficiais em memória');
assert.notDeepEqual(simulated.ranking.map(r=>({id:r.entry_id,total:r.total_simulado,pos:r.posicao_simulada})), officialBefore, 'ranking simulado precisa ser independente e mudar conforme cenário');
const podium = getFinalPodium(simulated.resultados);
assert.deepEqual(podium, {campeao:'FRA', vice:'ARG', terceiro:'ESP', quarto:'ENG'}, 'campeão/vice/3º/4º devem ser derivados automaticamente da chave simulada');
const withBonus = simulated.ranking.find(r => r.bonus_final_simulado > 0);
assert.ok(withBonus, 'ao simular finais e artilheiro, pelo menos um participante deve receber bônus potencial');
assert.ok(simulated.ranking.every(r => Number.isFinite(r.total_simulado) && Number.isFinite(r.diferenca_pontos)), 'ranking simulado deve ter totais e variações numéricas válidas');
const simResults = buildSimulatedResults(data.resultados, data.times, simChoices);
assert.equal(simResults.find(g=>g.game_id===99).status, 'Simulado', 'jogo pendente deve poder virar simulado');
assert.equal(simResults.find(g=>g.game_id===97).status, 'Finalizado', 'jogo oficial já finalizado não pode ser sobrescrito pela simulação');

// V20: o simulador exige placar. Escolher só classificado não deve simular o jogo.
const noScoreChoices = {
  99:{advancer:'ENG'},
  100:{advancer:'ARG'},
  101:{advancer:'FRA'},
  102:{advancer:'ARG'},
  103:{advancer:'FRA'},
  104:{advancer:'FRA'}
};
const noScoreResults = buildSimulatedResults(data.resultados, data.times, noScoreChoices);
const g99NoScore = noScoreResults.find(g=>g.game_id===99);
assert.equal(g99NoScore?.status, 'Pendente', 'sem placar, o jogo pendente não deve virar simulado');
assert.equal(g99NoScore?.score, null, 'sem placar, o simulador não pode criar placar técnico');
// Participante teste que apostou num placar qualquer não pode ganhar ponto em jogo não simulado.
const noScoreMiniData = structuredClone(data);
noScoreMiniData.participantes = [{entry_id:999,name:'Teste Sim',bet_number:1,display_name:'Teste Sim #1',valid:true,finals:{}}];
noScoreMiniData.apostas_detalhes = {'999':{entry_id:999,display_name:'Teste Sim #1',group_predictions:[],predicted_qualified:[],classified_hits:[],knockout_predictions:[{game_id:99,prediction_match:`${g99NoScore.home} x ${g99NoScore.away}`,prediction_score:'1x0',predicted_winner:g99NoScore.home}]}};
const noScoreRank = calculate({...noScoreMiniData, resultados:noScoreResults}).ranking[0];
assert.equal(noScoreRank.total,0,'sem placar lançado no simulador, não há pontos simulados para aquele jogo');
const withScoreChoices = {...noScoreChoices, 99:{home_goals:1, away_goals:2, advancer:'ENG'}};
const withScoreResults = buildSimulatedResults(data.resultados, data.times, withScoreChoices);
const g99WithScore = withScoreResults.find(g=>g.game_id===99);
assert.equal(g99WithScore?.status, 'Simulado', 'com placar e classificado coerentes, o jogo deve virar simulado');
const withScoreRank = calculate({...noScoreMiniData, resultados:withScoreResults}).ranking[0];
assert.equal(withScoreRank.ko_placar,0,'placar diferente não gera bônus de placar exato');

// V18: a planilha pode trazer confrontos futuros preenchidos/defasados. O motor deve derivar a chave
// pelos classificados oficiais e limpar jogos futuros que ainda não têm os dois classificados definidos.
const staleFuture = structuredClone(resultadosArray);
const sg101 = staleFuture.find(g=>g.game_id===101);
sg101.home='BRA'; sg101.away='ARG'; sg101.home_name='Brasil'; sg101.away_name='Argentina'; sg101.status='Pendente'; sg101.home_goals=null; sg101.away_goals=null; sg101.score=null; sg101.advancer=null;
const preparedStale = prepareResults(staleFuture, data.times);
assert.equal(preparedStale.find(g=>g.game_id===101).home, 'FRA', 'jogo #101 pendente deve obedecer à chave: vencedor #97 x vencedor #98');
assert.equal(preparedStale.find(g=>g.game_id===101).away, 'ESP', 'jogo #101 pendente deve obedecer à chave: vencedor #97 x vencedor #98');
assert.equal(preparedStale.find(g=>g.game_id===102).home, null, 'jogo #102 ainda deve ficar A definir enquanto #99/#100 não terminarem');
assert.equal(preparedStale.find(g=>g.game_id===104).home, null, 'final deve ficar A definir enquanto semifinais não terminarem');
