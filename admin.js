import { calculate, isPlayed } from './src/engine.js';

const files = ['regras','times','resultados','participantes','apostas_detalhes','estatisticas'];
let DATA={}, originalResults=[], localResults=[], originalCalc={}, localCalc={}, showMode='pending';
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const teamName = code => DATA.times?.find(t=>t.code===code)?.name || code || 'A definir';
const teamFlag = code => DATA.times?.find(t=>t.code===code)?.flag || '🏳️';
const team = code => `${teamFlag(code)} ${teamName(code)}`;
const phaseOrder = ['Todas','Fase de Grupos','Rodada de 32','Oitavas de Final','Quartas de Final','Semifinais','3º Lugar','Final'];
const bracketMap = {101:[97,98],102:[99,100],104:[101,102]};

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
  if($('inferBracket')) $('inferBracket').onclick=()=>{ normalizeAll(true); recalc(); renderAdmin(); toast('Chaves futuras atualizadas com base nos classificados já lançados.'); };
  if($('downloadBundle')) $('downloadBundle').onclick=()=>download('bolao-dados-atualizados.json', JSON.stringify({resultados: localResults, ranking_previo: localCalc.ranking, gerado_em: new Date().toISOString()}, null, 2));
}
function renderFilters(){ $('phaseFilter').innerHTML = phaseOrder.map(p=>`<option value="${p}">${p}</option>`).join(''); }
function recalc(){ normalizeAll(); localCalc = calculate({...DATA, resultados: structuredClone(localResults)}); localStorage.setItem('bolao_resultados_local_v3', JSON.stringify(localResults)); renderPreview(); }
function normalizeGame(g){
  if(g.home === '') g.home = null;
  if(g.away === '') g.away = null;
  g.home_name = teamName(g.home);
  g.away_name = teamName(g.away);
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
function getGame(id){ return localResults.find(x=>x.game_id===id); }
function loserOf(g){ if(!g?.home || !g?.away || !g?.advancer) return null; return g.advancer===g.home ? g.away : g.home; }
function setMatchIfNeeded(gameId, home, away, force=false){
  const g=getGame(gameId); if(!g || !home || !away) return false;
  if(force || !g.home || !g.away || g.status==='Pendente'){
    g.home=home; g.away=away; g.home_name=teamName(home); g.away_name=teamName(away);
    if(g.advancer && ![home, away].includes(g.advancer)) g.advancer=null;
    return true;
  }
  return false;
}
function deriveBracket(force=false){
  const q97=getGame(97), q98=getGame(98), q99=getGame(99), q100=getGame(100), s101=getGame(101), s102=getGame(102);
  setMatchIfNeeded(101, q97?.advancer, q98?.advancer, force);
  setMatchIfNeeded(102, q99?.advancer, q100?.advancer, force);
  setMatchIfNeeded(104, s101?.advancer, s102?.advancer, force);
  const l101=loserOf(s101), l102=loserOf(s102); setMatchIfNeeded(103, l101, l102, force);
}
function normalizeAll(forceBracket=false){ localResults.forEach(normalizeGame); deriveBracket(forceBracket); localResults.forEach(normalizeGame); }
function validate(){
  const errs=[]; normalizeAll();
  for(const g of localResults){
    if(g.status==='Pendente') continue;
    if(!g.home || !g.away) errs.push(`#${g.game_id}: jogo concluído precisa ter as duas seleções definidas.`);
    if(g.home && g.away && g.home===g.away) errs.push(`#${g.game_id}: mandante e visitante não podem ser a mesma seleção.`);
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
function teamOptions(selected){ return `<option value="">A definir</option>` + (DATA.times||[]).map(t=>`<option value="${t.code}" ${selected===t.code?'selected':''}>${esc(t.flag||'🏳️')} ${esc(t.name)} (${t.code})</option>`).join(''); }
function rowHTML(g){
  const advOptions = `<option value="">—</option>` + [g.home,g.away].filter(Boolean).map(code=>`<option value="${code}" ${g.advancer===code?'selected':''}>${team(code)}</option>`).join('');
  const futureEditable = g.game_id>=97;
  const homeCell = futureEditable ? `<select data-id="${g.game_id}" data-field="home">${teamOptions(g.home)}</select>` : team(g.home);
  const awayCell = futureEditable ? `<select data-id="${g.game_id}" data-field="away">${teamOptions(g.away)}</select>` : team(g.away);
  const autoHint = g.game_id>=101 ? `<small class="muted-text">chave automática se fases anteriores tiverem classificado</small>` : '';
  return `<tr><td><b>#${g.game_id}</b>${autoHint}</td><td>${esc(g.phase||'')}</td><td>${homeCell}</td><td>${awayCell}</td><td><input type="number" min="0" data-id="${g.game_id}" data-field="home_goals" value="${g.home_goals ?? ''}"></td><td><input type="number" min="0" data-id="${g.game_id}" data-field="away_goals" value="${g.away_goals ?? ''}"></td><td><select data-id="${g.game_id}" data-field="advancer" ${g.game_id<73?'disabled':''}>${advOptions}</select></td><td><select data-id="${g.game_id}" data-field="status"><option ${g.status==='Pendente'?'selected':''}>Pendente</option><option ${g.status==='Finalizado'?'selected':''}>Finalizado</option></select></td></tr>`;
}
function onEdit(e){
  const id=Number(e.target.dataset.id), field=e.target.dataset.field; const g=localResults.find(x=>x.game_id===id); if(!g) return;
  let val=e.target.value;
  if(field==='home_goals' || field==='away_goals') val = val==='' ? null : Number(val);
  if((field==='home' || field==='away') && val==='') val=null;
  g[field]=val;
  if((field==='home' || field==='away') && g.advancer && ![g.home,g.away].includes(g.advancer)) g.advancer=null;
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
