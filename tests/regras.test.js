import fs from 'fs';
import assert from 'assert/strict';
import { calculate, scoreGroup } from '../src/engine.js';
const read = name => JSON.parse(fs.readFileSync(new URL(`../data/${name}.json`, import.meta.url),'utf8'));

assert.equal(scoreGroup('2x1','2x1').points,5,'placar exato na fase de grupos deve valer 5');
assert.equal(scoreGroup('3x1','2x0').points,3,'vencedor correto na fase de grupos deve valer 3');
assert.equal(scoreGroup('1x1','2x1').points,0,'empate previsto não pontua quando houve vencedor');

const mini={
  resultados:[{game_id:73,phase:'Rodada de 32',home:'BRA',away:'JPN',home_goals:2,away_goals:1,score:'2x1',status:'Finalizado',advancer:'BRA'}],
  participantes:[{entry_id:1,name:'Teste',bet_number:1,display_name:'Teste #1',valid:true,finals:{}}],
  apostas_detalhes:{'1':{entry_id:1,display_name:'Teste #1',group_predictions:[],predicted_qualified:[],classified_hits:[],knockout_predictions:[{game_id:73,prediction_match:'BRA x JPN',prediction_score:'2x1',predicted_winner:'BRA'}]}}
};
const miniRank=calculate(structuredClone(mini)).ranking[0];
assert.equal(miniRank.ko_confronto,5,'confronto correto no mata-mata deve valer 5');
assert.equal(miniRank.ko_avanco,5,'avanço/classificado no mata-mata deve valer 5');
assert.equal(miniRank.ko_placar,3,'placar exato no mata-mata deve valer 3, não 5');
assert.equal(miniRank.total,13,'soma do mata-mata deve bater: 5+5+3');

const data={resultados:read('resultados'),participantes:read('participantes'),apostas_detalhes:read('apostas_detalhes')};
const expected=read('ranking');
const result=calculate(structuredClone(data)).ranking;
assert.equal(result.length, expected.length, 'quantidade de participantes válidos deve permanecer igual');
for(let i=0;i<result.length;i++){
  assert.equal(result[i].entry_id, expected[i].entry_id, `posição ${i+1} deveria manter entry_id`);
  assert.equal(result[i].total, expected[i].total, `${result[i].display_name}: total divergente`);
  assert.equal(result[i].grupos, expected[i].grupos, `${result[i].display_name}: grupos divergente`);
  assert.equal(result[i].mata_mata, expected[i].mata_mata, `${result[i].display_name}: mata-mata divergente`);
  assert.equal(result[i].bonus, expected[i].bonus, `${result[i].display_name}: bônus divergente`);
  assert.ok(Number.isFinite(result[i].total), `${result[i].display_name}: total inválido`);
  assert.ok(result[i].total>=0, `${result[i].display_name}: total negativo`);
}

for(const r of result){
  const sum = r.grupos + r.mata_mata + r.bonus;
  assert.equal(r.total, sum, `${r.display_name}: total deve ser soma de grupos, mata-mata e bônus`);
}

const phasesShown = ['Fase de Grupos','Rodada de 32','Oitavas de Final'];
const games = read('resultados');
for(const ph of phasesShown) assert.ok(games.some(g=>g.phase===ph && g.status!=='Pendente' && g.score), `fase ${ph} deve ter jogos finalizados para estatísticas`);
assert.ok(!games.some(g=>g.phase==='Quartas de Final' && g.status!=='Pendente' && g.score), 'quartas ainda não deve aparecer como fase definida nas estatísticas por resultado');

console.log('Todos os testes passaram. Motor preservado e ranking sem regressão.');
