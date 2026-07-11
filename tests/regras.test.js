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
