import { calculate, isPlayed } from './src/engine.js';

const files = ['regras','times','resultados','participantes','apostas_detalhes','ranking','estatisticas'];
const titles = {home:'Home', ranking:'Ranking', palpites:'Palpites', jogos:'Jogos', estatisticas:'Estatísticas', comparar:'Comparar', simulador:'Simulador', regras:'Regras'};
const phaseNames = ['Todas','Fase de Grupos','Rodada de 32','Oitavas de Final','Quartas de Final','Semifinais','3º Lugar','Final'];
let DATA = {}, CALC = {}, teamMap = {}, currentPhase = 'Todas', currentDetailTab = 'grupos';

const $ = (id)=>document.getElementById(id);
const fmt = new Intl.NumberFormat('pt-BR');

async function loadData(){
  try{
    for(const f of files){ DATA[f] = await fetch(`data/${f}.json`).then(r=>r.json()); }
    teamMap = Object.fromEntries(DATA.times.map(t=>[t.code,t]));
    CALC = calculate(DATA);
    init();
    toast('Dados carregados com segurança.');
  }catch(err){
    console.error(err);
    toast('Erro ao carregar dados. Verifique os arquivos JSON.', true);
  }
}

function flag(code){ return teamMap[code]?.flag || ''; }
function teamName(code){ if(!code) return 'A definir'; return teamMap[code]?.name || code; }
function team(code){ return code ? `${flag(code)} ${teamName(code)}` : 'A definir'; }
function score(g){ return g?.score && g.score !== 'nullxnull' ? g.score : '—'; }
function safe(v){ return v ?? '—'; }
function statusClass(s){ return String(s||'').toLowerCase().includes('final') ? 'finalizado' : 'pendente'; }
function lastUpdated(){ return new Date(DATA.estatisticas.generated_at).toLocaleString('pt-BR'); }

function init(){
  $('lastUpdate').textContent = `Atualizado em ${lastUpdated()}`;
  bindNavigation();
  renderHome();
  renderRanking();
  renderParticipantSelectors();
  renderGames();
  renderStats();
  renderCompare();
  renderSimulator();
}

function bindNavigation(){
  document.querySelectorAll('[data-page]').forEach(btn=>{
    btn.addEventListener('click',()=>showPage(btn.dataset.page));
  });
  document.querySelectorAll('[data-go]').forEach(btn=>{
    btn.addEventListener('click',()=>showPage(btn.dataset.go));
  });
}

function showPage(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  $(`page-${page}`)?.classList.add('active');
  document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active', b.dataset.page===page));
  $('pageTitle').textContent = titles[page] || 'Bolão';
  window.scrollTo({top:0, behavior:'smooth'});
}

function renderHome(){
  const ranking = CALC.ranking;
  $('podium').innerHTML = ranking.slice(0,3).map((r,i)=>`
    <div class="podium-card">
      <div class="podium-pos">${i===0?'🥇':i===1?'🥈':'🥉'}</div>
      <div><div class="podium-name">${r.display_name}</div><span class="podium-meta">${r.grupos} grupos · ${r.mata_mata} mata-mata</span></div>
      <div class="podium-points">${r.total}</div>
    </div>`).join('');

  $('kpis').innerHTML = `
    <div class="kpi"><span>Participantes válidos</span><b>${fmt.format(DATA.estatisticas.entries_valid)}</b><small>${DATA.estatisticas.entries_total} apostas no relatório</small></div>
    <div class="kpi"><span>Jogos computados</span><b>${fmt.format(DATA.estatisticas.played_games)}</b><small>${DATA.estatisticas.pending_games} jogos pendentes</small></div>
    <div class="kpi"><span>Líder</span><b>${ranking[0]?.display_name || '—'}</b><small>${ranking[0]?.total || 0} pontos</small></div>
    <div class="kpi"><span>Validação</span><b>${DATA.estatisticas.pdf_validation?.ranking_matches_pdf_totals ? 'OK' : 'Verificar'}</b><small>recalculo x relatório original</small></div>`;

  $('homeTop10').innerHTML = ranking.slice(0,10).map(rankItem).join('');
  document.querySelectorAll('[data-open-entry]').forEach(btn=>btn.onclick=()=>openParticipant(Number(btn.dataset.openEntry)));

  const games = DATA.resultados.filter(isPlayed).sort((a,b)=>b.game_id-a.game_id).slice(0,5);
  $('recentGames').innerHTML = games.map(gameRow).join('');
}

function rankItem(r){
  return `<div class="rank-item">
    <div class="rank-badge">${r.posicao}</div>
    <div><button class="participant-btn" data-open-entry="${r.entry_id}">${r.display_name}</button><span>${r.grupos} grupos · ${r.mata_mata} mata-mata · ${r.cravadas} cravadas</span></div>
    <div class="rank-score">${r.total}</div>
  </div>`;
}

function renderRanking(){
  const body = $('rankingBody');
  const draw = ()=>{
    const q = ($('rankingSearch').value||'').toLowerCase().trim();
    const rows = CALC.ranking.filter(r=>r.display_name.toLowerCase().includes(q));
    body.innerHTML = rows.map(r=>`
      <tr>
        <td class="pos">${r.posicao}</td>
        <td><button class="participant-btn" data-open-entry="${r.entry_id}">${r.display_name}</button></td>
        <td class="num total">${r.total}</td>
        <td class="num">${r.grupos}</td>
        <td class="num">${r.grupos_jogos}</td>
        <td class="num">${r.classificados}</td>
        <td class="num">${r.mata_mata}</td>
        <td class="num">${r.ko_confronto}</td>
        <td class="num">${r.ko_avanco}</td>
        <td class="num">${r.ko_placar}</td>
        <td class="num">${r.cravadas}</td>
      </tr>`).join('');
    body.querySelectorAll('[data-open-entry]').forEach(btn=>btn.onclick=()=>openParticipant(Number(btn.dataset.openEntry)));
  };
  $('rankingSearch').addEventListener('input', draw);
  draw();
}

function renderParticipantSelectors(){
  const options = '<option value="">Selecione...</option>' + CALC.ranking.map(r=>`<option value="${r.entry_id}">${r.posicao}º · ${r.display_name} · ${r.total} pts</option>`).join('');
  $('participantSelect').innerHTML = options;
  $('participantSelect').addEventListener('change', e=> renderParticipantDetail(Number(e.target.value)));
  $('compareA').innerHTML = options;
  $('compareB').innerHTML = options;
  if(CALC.ranking[0]) $('compareA').value = CALC.ranking[0].entry_id;
  if(CALC.ranking[1]) $('compareB').value = CALC.ranking[1].entry_id;
  $('compareA').addEventListener('change', renderCompare);
  $('compareB').addEventListener('change', renderCompare);
}

function openParticipant(id){
  showPage('palpites');
  $('participantSelect').value = id;
  renderParticipantDetail(id);
}

function renderParticipantDetail(id){
  const box = $('participantDetail');
  if(!id){ box.className='participant-detail empty-state'; box.textContent='Selecione um participante para conferir a pontuação.'; return; }
  box.className = 'participant-detail';
  const r = CALC.ranking.find(x=>x.entry_id===id);
  const d = CALC.details[id];
  if(!r || !d){ box.textContent='Participante não encontrado.'; return; }
  const tabs = [
    ['grupos','Fase de grupos'], ['classificados','Classificados'], ['mata','Mata-mata'], ['finais','Finais']
  ].map(([key,label])=>`<button class="${currentDetailTab===key?'active':''}" data-detail-tab="${key}">${label}</button>`).join('');

  box.innerHTML = `
    <div class="summary-grid">
      <div class="summary-card"><span>Posição</span><b>${r.posicao}º</b></div>
      <div class="summary-card"><span>Total</span><b>${r.total}</b></div>
      <div class="summary-card"><span>Grupos</span><b>${r.grupos}</b></div>
      <div class="summary-card"><span>Mata-mata</span><b>${r.mata_mata}</b></div>
      <div class="summary-card"><span>Cravadas</span><b>${r.cravadas}</b></div>
    </div>
    <div class="panel-head" style="padding-left:0;padding-right:0"><h3>${r.display_name}</h3><span class="status-pill">${r.classificados_acertos} classificados corretos</span></div>
    <div class="detail-tabs">${tabs}</div>
    <div id="detailTabContent"></div>`;
  box.querySelectorAll('[data-detail-tab]').forEach(btn=>btn.onclick=()=>{ currentDetailTab=btn.dataset.detailTab; renderParticipantDetail(id); });
  renderDetailContent(r,d);
}

function renderDetailContent(r,d){
  const box = $('detailTabContent');
  if(currentDetailTab === 'grupos'){
    box.innerHTML = tableWrap(`<table class="mini-table"><thead><tr><th>Jogo</th><th>Palpite</th><th>Resultado</th><th>Status</th><th>Pts</th></tr></thead><tbody>${d.group_predictions.map(x=>`
      <tr><td>#${x.game_id}</td><td>${x.prediction||'—'}</td><td>${x.result||'—'}</td><td>${badge(x.status)}</td><td class="num total">${x.points}</td></tr>`).join('')}</tbody></table>`);
  }else if(currentDetailTab === 'classificados'){
    box.innerHTML = `<h4>Seleções corretamente classificadas</h4><div class="chips">${d.classified_hits.map(c=>`<span class="chip">${team(c)}</span>`).join('') || '<span class="empty-state">Nenhum acerto.</span>'}</div>`;
  }else if(currentDetailTab === 'mata'){
    box.innerHTML = tableWrap(`<table class="mini-table"><thead><tr><th>Jogo</th><th>Palpite</th><th>Avança</th><th>Status</th><th>Conf.</th><th>Avanço</th><th>Placar</th><th>Total</th></tr></thead><tbody>${d.knockout_predictions.map(x=>`
      <tr><td>#${x.game_id}</td><td>${x.prediction_match||'—'} ${x.prediction_score||''}</td><td>${x.predicted_winner||'—'}</td><td>${badge(x.status)}</td><td class="num">${x.points_confronto||0}</td><td class="num">${x.points_avanco||0}</td><td class="num">${x.points_placar||0}</td><td class="num total">${x.points||0}</td></tr>`).join('')}</tbody></table>`);
  }else{
    const f = r.finals || {};
    box.innerHTML = `<div class="rules-grid"><article><strong>Campeão</strong><p>${safe(f.campeao)}</p></article><article><strong>Vice</strong><p>${safe(f.vice)}</p></article><article><strong>3º Lugar</strong><p>${safe(f.terceiro)}</p></article><article><strong>4º Lugar</strong><p>${safe(f.quarto)}</p></article><article><strong>Artilheiro</strong><p>${safe(f.artilheiro)}</p></article></div>`;
  }
}

function tableWrap(html){ return `<div class="table-wrap">${html}</div>`; }
function badge(status){
  const s = String(status||'').toLowerCase();
  const cls = s.includes('exato') || s.includes('correto') ? 'good' : s.includes('erro') ? 'bad' : 'warn';
  return `<span class="pill ${cls}">${status||'—'}</span>`;
}

function renderGames(){
  const filters = $('phaseFilters');
  filters.innerHTML = phaseNames.map(p=>`<button class="${p===currentPhase?'active':''}" data-phase="${p}">${p}</button>`).join('');
  filters.querySelectorAll('button').forEach(btn=>btn.onclick=()=>{ currentPhase=btn.dataset.phase; renderGames(); });
  const games = DATA.resultados.filter(g=>currentPhase==='Todas'||g.phase===currentPhase).sort((a,b)=>a.game_id-b.game_id);
  $('games').innerHTML = games.map(gameCard).join('');
}

function gameCard(g){
  const played = isPlayed(g);
  return `<article class="game-card ${statusClass(g.status)}">
    <div class="phase"><span>#${g.game_id} · ${g.phase}${g.group?` · Grupo ${g.group}`:''}</span><span>${g.status}</span></div>
    <div class="score-line"><div class="team-side">${team(g.home)}</div><div class="score-main">${score(g)}</div><div class="team-side away">${team(g.away)}</div></div>
    <div class="game-meta"><span>${g.date_time || 'Data a definir'}</span><span>${g.location || ''}${g.stadium ? ` · ${g.stadium}`:''}</span></div>
    <div style="margin-top:10px">${g.advancer ? `<span class="pill good">Classificado: ${team(g.advancer)}</span>` : played ? `<span class="pill good">Computado</span>` : `<span class="pill warn">Pendente</span>`}</div>
  </article>`;
}
function gameRow(g){
  return `<div class="game-row"><div class="match-no">#${g.game_id}</div><div><div class="teams">${team(g.home)} x ${team(g.away)}</div><small>${g.phase}${g.advancer?` · classificado: ${team(g.advancer)}`:''}</small></div><div class="score-badge">${score(g)}</div></div>`;
}

function renderStats(){
  const champs = statList(DATA.estatisticas.campeoes_mais_apostados.slice(0,8));
  const scorers = statList(DATA.estatisticas.artilheiros_mais_apostados.slice(0,8));
  const adv = Object.entries(DATA.estatisticas.actual_advancers_by_phase||{}).map(([phase,arr])=>`<li><b>${phase}</b><span>${arr.length}</span></li>`).join('');
  $('statsCards').innerHTML = `
    <section class="panel stats-card"><h4>🏆 Campeões mais apostados</h4><ul class="stat-list">${champs}</ul></section>
    <section class="panel stats-card"><h4>🥅 Artilheiros mais apostados</h4><ul class="stat-list">${scorers}</ul></section>
    <section class="panel stats-card"><h4>🚀 Classificados reais por fase</h4><ul class="stat-list">${adv}</ul></section>`;
  const hard = [...DATA.estatisticas.game_stats].filter(g=>g.phase==='Fase de Grupos').sort((a,b)=>a.cravadas-b.cravadas || b.erros-a.erros).slice(0,10);
  $('hardGames').innerHTML = hard.map(g=>`<div class="game-row"><div class="match-no">#${g.game_id}</div><div><div class="teams">${team(g.home)} x ${team(g.away)}</div><small>${g.erros} erros · ${g.vencedor_empate} vencedores/empates</small></div><div class="score-badge">${g.cravadas} 🎯</div></div>`).join('');
}
function statList(items){ return items.map(([name,val])=>`<li><b>${name}</b><span>${val}</span></li>`).join(''); }

function renderCompare(){
  const a = Number($('compareA')?.value || CALC.ranking[0]?.entry_id);
  const b = Number($('compareB')?.value || CALC.ranking[1]?.entry_id);
  if(!a || !b) return;
  $('compareResult').innerHTML = [a,b].map(id=>compareCard(CALC.ranking.find(r=>r.entry_id===id))).join('');
}
function compareCard(r){
  if(!r) return '';
  const max = Math.max(1, CALC.ranking[0]?.total || r.total);
  const rows = [
    ['Total',r.total,max], ['Grupos',r.grupos,300], ['Jogos grupos',r.grupos_jogos,180], ['Classificados',r.classificados,160], ['Mata-mata',r.mata_mata,160], ['Cravadas',r.cravadas,20]
  ];
  return `<article class="compare-card"><h4>${r.posicao}º · ${r.display_name}</h4>${rows.map(([label,val,den])=>`<div class="bar-row"><span><b>${label}</b><b>${val}</b></span><div class="bar"><i style="width:${Math.min(100,Math.round((val/den)*100))}%"></i></div></div>`).join('')}</article>`;
}

function renderSimulator(){
  const pending = DATA.resultados.filter(g=>!isPlayed(g));
  $('simulatorBox').innerHTML = `
    <div class="summary-grid">
      <div class="summary-card"><span>Jogos pendentes</span><b>${pending.length}</b></div>
      <div class="summary-card"><span>Fase atual</span><b>${pending[0]?.phase || '—'}</b></div>
      <div class="summary-card"><span>Último jogo</span><b>#${Math.max(...DATA.resultados.filter(isPlayed).map(g=>g.game_id))}</b></div>
      <div class="summary-card"><span>Próximo jogo</span><b>#${pending[0]?.game_id || '—'}</b></div>
      <div class="summary-card"><span>Modo</span><b>Leitura</b></div>
    </div>
    <div class="pending-list">${pending.map(gameCard).join('')}</div>`;
}

function toast(msg, error=false){
  const t = $('toast');
  t.textContent = msg;
  t.style.background = error ? 'var(--red)' : 'var(--navy)';
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2600);
}

loadData();
