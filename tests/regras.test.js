import fs from 'fs';
import assert from 'assert/strict';
import { calculate, scoreGroup } from '../src/engine.js';
const read = name => JSON.parse(fs.readFileSync(new URL(`../data/${name}.json`, import.meta.url),'utf8'));
assert.equal(scoreGroup('2x1','2x1').points,5,'placar exato deve valer 5');
assert.equal(scoreGroup('3x1','2x0').points,3,'vencedor correto deve valer 3');
assert.equal(scoreGroup('1x1','2x1').points,0,'empate previsto não pode pontuar em vitória');
const data={resultados:read('resultados'),participantes:read('participantes'),apostas_detalhes:read('apostas_detalhes')};
const expected=read('ranking');
const result=calculate(data).ranking;
assert.equal(result.length, expected.length);
for(let i=0;i<result.length;i++){
  assert.equal(result[i].entry_id, expected[i].entry_id, `posição ${i+1} deveria manter entry_id`);
  assert.equal(result[i].total, expected[i].total, `${result[i].display_name}: total divergente`);
  assert.equal(result[i].grupos, expected[i].grupos, `${result[i].display_name}: grupos divergente`);
  assert.equal(result[i].mata_mata, expected[i].mata_mata, `${result[i].display_name}: mata-mata divergente`);
}
console.log('Todos os testes passaram.');
