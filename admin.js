import { calculate, isPlayed } from './src/engine.js';
const files=['regras','times','resultados','participantes','apostas_detalhes','ranking'];
let DATA={}, ORIGINAL={}, teamMap={}, filter='pending';
const $=id=>document.getElementById(id);
async function load(){ for(const f of files) DATA[f]=await fetch(`data/${f}.json`).then(r=>r.json()); ORIGINAL=structuredClone(DATA); teamMap=Object.fromEntries(DATA.times.map(t=>[t.code,t])); }
function team(c){ return c?`${teamMap[c]?.flag||''} ${teamMap[c]?.name||c}`:'A definir'; }
function phase(gid){ if(gid>=97&&gid<=100)return 'Quartas de Final'; if(gid>=101&&gid<=102)return 'Semifinais'; if(gid===103)return '3º Lugar'; if(gid===104)return 'Final'; return ''; }
function render(){
  const rows=DATA.resultados.filter(g=>filter==='all'||!isPlayed(g)).sort((a,b)=>a.game_id-b.game_id);
  $('adminRows').innerHTML=rows.map(g=>`<tr data-id="${g.game_id}"><td>#${g.game_id}</td><td><input class="phase" value="${g.phase||phase(g.game_id)}"></td><td><input class="home" value="${g.home||''}" placeholder="FRA"></td><td><input class="away" value="${g.away||''}" placeholder="MAR"></td><td><input class="gh" value="${g.home_goals??''}" type="number" min="0"></td><td><input class="ga" value="${g.away_goals??''}" type="number" min="0"></td><td><input class="adv" value="${g.advancer||''}" placeholder="classificado"></td><td><select class="status"><option ${!isPlayed(g)?'selected':''}>Pendente</option><option ${isPlayed(g)?'selected':''}>Finalizado</option></select></td></tr>`).join('');
  document.querySelectorAll('#adminRows input,#adminRows select').forEach(el=>el.addEventListener('input',updatePreview));
  updatePreview();
}
function applyEdits(){
  for(const tr of document.querySelectorAll('#adminRows tr')){
    const gid=Number(tr.dataset.id); const g=DATA.resultados.find(x=>x.game_id===gid); if(!g) continue;
    g.phase=tr.querySelector('.phase').value.trim(); g.home=tr.querySelector('.home').value.trim().toUpperCase()||null; g.away=tr.querySelector('.away').value.trim().toUpperCase()||null;
    const gh=tr.querySelector('.gh').value, ga=tr.querySelector('.ga').value; g.home_goals=gh===''?null:Number(gh); g.away_goals=ga===''?null:Number(ga); g.score=(gh!==''&&ga!=='')?`${Number(gh)}x${Number(ga)}`:null;
    g.advancer=tr.querySelector('.adv').value.trim().toUpperCase()||null; g.status=tr.querySelector('.status').value;
    if(g.status==='Finalizado' && g.score && !g.advancer && g.game_id>=73){ if(g.home_goals>g.away_goals) g.advancer=g.home; if(g.away_goals>g.home_goals) g.advancer=g.away; }
    if(g.game_id<73) g.winner = g.home_goals===null||g.away_goals===null ? null : (g.home_goals>g.away_goals?g.home:g.away_goals>g.home_goals?g.away:'EMPATE');
    else g.winner = g.advancer;
  }
}
function validate(){
  const errors=[];
  for(const g of DATA.resultados){
    if(g.status==='Finalizado'){
      if(g.home_goals===null || g.away_goals===null) errors.push(`#${g.game_id}: jogo finalizado sem placar.`);
      if(g.home_goals<0 || g.away_goals<0) errors.push(`#${g.game_id}: placar negativo não é aceito.`);
      if(g.game_id>=73){
        if(!g.advancer) errors.push(`#${g.game_id}: mata-mata finalizado sem classificado.`);
        if(g.advancer && ![g.home,g.away].includes(g.advancer)) errors.push(`#${g.game_id}: classificado precisa ser uma das seleções do jogo.`);
        if(g.home_goals===g.away_goals && !g.advancer) errors.push(`#${g.game_id}: empate no mata-mata exige classificado/pênaltis.`);
      }
    }
  }
  return errors;
}
function updatePreview(){
  applyEdits(); const errors=validate(); $('adminErrors').innerHTML=errors.map(e=>`<div>${e}</div>`).join('');
  if(errors.length){ $('preview').innerHTML='<article><b>Corrija as inconsistências</b><p>A prévia só deve ser usada sem erros de validação.</p></article>'; return; }
  const calc=calculate(structuredClone(DATA)).ranking; const old=ORIGINAL.ranking; const byId=Object.fromEntries(old.map(r=>[r.entry_id,r]));
  $('preview').innerHTML=calc.slice(0,10).map(r=>{ const o=byId[r.entry_id]; const delta=(r.total-(o?.total||0)); const posDelta=(o?.posicao||r.posicao)-r.posicao; return `<article><span>${r.posicao}º ${posDelta?`(${posDelta>0?'subiu':'caiu'} ${Math.abs(posDelta)})`:''}</span><h4>${r.display_name}</h4><b>${r.total} pts</b><p>${delta>=0?'+':''}${delta} pts vs. publicado</p></article>`; }).join('');
}
function download(filename,obj){ const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json;charset=utf-8'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url); }
$('unlockBtn').onclick=()=>{ if($('unlockInput').value.trim().toUpperCase()==='GESTAO'){ $('unlockBox').style.display='none'; $('adminBox').style.display='block'; render(); } };
$('showPending').onclick=()=>{filter='pending'; render();}; $('showAll').onclick=()=>{filter='all'; render();}; $('resetLocal').onclick=()=>{DATA=structuredClone(ORIGINAL); render();}; $('recalc').onclick=updatePreview; $('downloadResults').onclick=()=>{applyEdits(); const e=validate(); if(e.length) return; download('resultados.json',DATA.resultados);}; $('downloadRanking').onclick=()=>{applyEdits(); const e=validate(); if(e.length) return; download('ranking_recalculado.json',calculate(structuredClone(DATA)).ranking);};
load();
