import fs from 'fs';
import { calculate } from '../src/engine.js';
const read = name => JSON.parse(fs.readFileSync(new URL(`../data/${name}.json`, import.meta.url),'utf8'));
const data={resultados:read('resultados'),participantes:read('participantes'),apostas_detalhes:read('apostas_detalhes')};
const old=read('ranking');
const current=calculate(structuredClone(data)).ranking;
const divergences=[];
for(let i=0;i<current.length;i++){
  const a=current[i], b=old[i];
  if(!b || a.entry_id!==b.entry_id || a.total!==b.total || a.grupos!==b.grupos || a.mata_mata!==b.mata_mata || a.bonus!==b.bonus){
    divergences.push({posicao:i+1, atual:a, anterior:b});
  }
}
const audit={generated_at:new Date().toISOString(),ranking_antes:old.length,ranking_depois:current.length,divergencias:divergences.length,detalhes:divergences};
fs.writeFileSync(new URL('../AUDITORIA_RANKING.json', import.meta.url), JSON.stringify(audit,null,2));
console.log(JSON.stringify(audit,null,2));
