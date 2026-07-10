import { calculate, isPlayed } from './src/engine.js';

const files = ['regras','times','resultados','participantes','apostas_detalhes','estatisticas'];
let DATA={}, originalResults=[], localResults=[], originalCalc={}, localCalc={}, showMode='pending';
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const teamName = code => DATA.times?.find(t=>t.code===code)?.name || code || 'A definir';
const teamFlag = code => DATA.times?.find(t=>t.code===code)?.flag || '🏳️';
const team = code => `${teamFlag(code)} ${teamName(code)}`;
const phaseOrder = ['Todas','Fase de Grupos','Rodada de 32','Oitavas de Final','Quartas de Final','Semifinais','3º Lugar','Final'];

async function loadData(){
  for(const f of files) DATA[f] = await fetch(`data/${f}.json`).then(r=>r.json());
  originalResults = structuredClone(DATA.resultados);
  const saved = localStorage.getItem('bolao_resultados_local_v3');
  localResults = saved ? JSON.parse(saved) : structuredClone(originalResults);
  originalCalc = calculate({...DATA, resultados: structuredClone(originalResults)});
  localCalc = calculate({...DATA, resultados: structuredClone(localResults)});
  bind(); renderFilters(); renderAdmin(); renderPreview();
}
function bind(){
  $('unlockBtn').onclick=()=>{ if(($('unlockInput').value||'').trim().toUpperCase()==='GESTAO'){ $('unlockBox').style.display='none'; $('adminBox').style.display='block'; toast('Modo de edição local aberto.'); } else toast('Digite GESTAO para desbloquear.', true); };
  $('unlockInput').addEventListener('keydown',e=>{ if(e.key==='Enter') $('unlockBtn').click(); });
  $('showPending').onclick=()=>{ showMode='pending'; renderAdmin(); };
  $('showAll').onclick=()=>{ showMode='all'; renderAdmin(); };
  $('phaseFilter').onchange=()=>renderAdmin();
  $('resetLocal').onclick=()=>{ if(confirm('Descartar alterações locais e voltar aos resultados publicados?')){ localStorage.removeItem('bolao_resultados_local_v3'); localResults=structuredClone(originalResults); recalc(); renderAdmin(); toast('Alterações locais descartadas.'); }};
  $('recalc').onclick=()=>{ recalc(); renderAdmin(); toast('Prévia recalculada.'); };
  $('downloadResults').onclick=()=>download('resultados.json', JSON.stringify(localResults,null,2));
  $('downloadRanking').onclick=()=>download('ranking_previo.json', JSON.stringify(localCalc.ranking,null,2));
}
function renderFilters(){ $('phaseFilter').innerHTML = phaseOrder.map(p=>`<option value="${p}">${p}</option>`).join(''); }
function recalc(){ normalizeAll(); localCalc = calculate({...DATA, resultados: structuredClone(localResults)}); localStorage.setItem('bolao_resultados_local_v3', JSON.stringify(localResults)); renderPreview(); }
function normalizeGame(g){
  const hg = g.home_goals === '' || g.home_goals == null ? null : Number(g.home_goals);
  const ag = g.away_goals === '' || g.away_goals == null ? null : Number(g.away_goals);
  if(g.status==='Pendente') { g.home_goals=null; g.away_goals=null; g.score=null; g.winner=null; g.advancer=null; return; }
  g.home_goals=Number.isFinite(hg)?hg:null; g.away_goals=Number.isFinite(ag)?ag:null;
  g.score = g.home_goals!=null && g.away_goals!=null ? `${g.home_goals}x${g.away_goals}` : null;
  if(g.score){
    if(g.home_goals>g.away_goals) g.winner=g.home;
    else if(g.home_goals<g.away_goals) g.winner=g.away;
    else g.winner=null;
    if(g.game_id>=73 && !g.advancer && g.winner) g.advancer=g.winner;
  }
}
function normalizeAll(){ localResults.forEach(normalizeGame); }
function validate(){
  const errs=[]; normalizeAll();
  for(const g of localResults){
    if(g.status==='Pendente') continue;
    if(g.home_goals==null || g.away_goals==null) errs.push(`#${g.game_id}: jogo concluído precisa ter placar.`);
    if(g.home_goals<0 || g.away_goals<0) errs.push(`#${g.game_id}: placar não pode ser negativo.`);
    if(g.game_id>=73){
      if(!g.advancer) errs.push(`#${g.game_id}: mata-mata concluído precisa ter classificado.`);
      else if(![g.home,g.away].includes(g.advancer)) errs.push(`#${g.game_id}: classificado precisa ser uma das seleções do jogo.`);
      if(g.home_goals===g.away_goals && !g.advancer) errs.push(`#${g.game_id}: empate no mata-mata exige classificado/pênaltis.`);
    }
  }
  return errs;
}
function renderAdmin(){
  const phase=$('phaseFilter')?.value || 'Todas';
  const rows = localResults.filter(g=> (showMode==='all' || !isPlayed(g)) && (phase==='Todas' || g.phase===phase));
  $('adminKpis').innerHTML = kpi('Jogos cadastrados', localResults.length) + kpi('Concluídos', localResults.filter(isPlayed).length) + kpi('Pendentes', localResults.filter(g=>!isPlayed(g)).length) + kpi('Ranking prévio', `${localCalc.ranking[0]?.display_name || '—'} · ${localCalc.ranking[0]?.total || 0}`);
  $('adminRows').innerHTML = rows.map(g=>rowHTML(g)).join('') || `<tr><td colspan="8" class="empty-state">Nenhum jogo neste filtro.</td></tr>`;
  document.querySelectorAll('[data-field]').forEach(el=>el.addEventListener('change',onEdit));
  renderErrors();
}
function kpi(label,value){ return `<article><span>${esc(label)}</span><b>${esc(value)}</b></article>`; }
function rowHTML(g){
  const advOptions = `<option value="">—</option><option value="${g.home}" ${g.advancer===g.home?'selected':''}>${team(g.home)}</option><option value="${g.away}" ${g.advancer===g.away?'selected':''}>${team(g.away)}</option>`;
  return `<tr><td><b>#${g.game_id}</b></td><td>${esc(g.phase||'')}</td><td>${team(g.home)}</td><td>${team(g.away)}</td><td><input type="number" min="0" data-id="${g.game_id}" data-field="home_goals" value="${g.home_goals ?? ''}"></td><td><input type="number" min="0" data-id="${g.game_id}" data-field="away_goals" value="${g.away_goals ?? ''}"></td><td><select data-id="${g.game_id}" data-field="advancer" ${g.game_id<73?'disabled':''}>${advOptions}</select></td><td><select data-id="${g.game_id}" data-field="status"><option ${g.status==='Pendente'?'selected':''}>Pendente</option><option ${g.status==='Finalizado'?'selected':''}>Finalizado</option></select></td></tr>`;
}
function onEdit(e){
  const id=Number(e.target.dataset.id), field=e.target.dataset.field; const g=localResults.find(x=>x.game_id===id); if(!g) return;
  let val=e.target.value;
  if(field==='home_goals' || field==='away_goals') val = val==='' ? null : Number(val);
  g[field]=val;
  if(field==='home_goals' || field==='away_goals') g.status='Finalizado';
  normalizeGame(g); recalc(); renderAdmin();
}
function renderErrors(){ const errs=validate(); $('adminErrors').innerHTML = errs.length ? errs.map(e=>`<div>${esc(e)}</div>`).join('') : '<div class="ok">✅ Validações OK para os dados locais.</div>'; }
function renderPreview(){
  const before=Object.fromEntries(originalCalc.ranking.map(r=>[r.entry_id,r]));
  const changed=localCalc.ranking.map(r=>({r, old:before[r.entry_id]})).filter(x=>!x.old || x.r.total!==x.old.total || x.r.posicao!==x.old.posicao).slice(0,12);
  $('preview').innerHTML = `<article><span>Líder prévio</span><b>${esc(localCalc.ranking[0]?.display_name || '—')}</b><p>${localCalc.ranking[0]?.total || 0} pontos</p></article>` + (changed.length? changed.map(({r,old})=>`<article><span>${esc(r.display_name)}</span><b>${old?.posicao || '—'}º → ${r.posicao}º</b><p>${old?.total ?? '—'} → ${r.total} pontos</p></article>`).join('') : '<article><b>Sem mudança</b><p>Nenhuma diferença no ranking em relação à base publicada.</p></article>');
}
function download(filename, content){ const blob=new Blob([content],{type:'application/json;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click(); URL.revokeObjectURL(a.href); toast(`${filename} gerado. Agora suba esse arquivo no GitHub.`); }
function toast(msg, error=false){ const t=$('toast'); t.textContent=msg; t.style.background=error?'var(--red)':'var(--navy)'; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2800); }
loadData().catch(e=>{ console.error(e); toast('Erro ao carregar dados.', true); });
