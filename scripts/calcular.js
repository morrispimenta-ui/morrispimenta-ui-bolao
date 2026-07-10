import fs from 'fs';
import { calculate } from '../src/engine.js';
const read = name => JSON.parse(fs.readFileSync(new URL(`../data/${name}.json`, import.meta.url),'utf8'));
const data={resultados:read('resultados'),participantes:read('participantes'),apostas_detalhes:read('apostas_detalhes')};
const result=calculate(data);
fs.writeFileSync(new URL('../data/ranking_calculado.json', import.meta.url), JSON.stringify(result.ranking,null,2));
console.log(`Ranking recalculado: ${result.ranking.length} participantes válidos.`);
console.log(`Líder: ${result.ranking[0].display_name} (${result.ranking[0].total} pts)`);
