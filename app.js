import { calculate, isPlayed, phaseKey } from './src/engine.js';

const files = ['regras','times','resultados','participantes','apostas_detalhes','ranking','estatisticas'];
const titles = {home:'Início', ranking:'Ranking Geral', palpites:'Palpites', resultados:'Resultados', estatisticas:'Estatísticas', conferencia:'Conferência Individual', regras:'Regras'};
const allPhases = ['Todas','Fase de Grupos','Rodada de 32','Oitavas de Final','Quartas de Final','Semifinais','3º Lugar','Final'];
const phaseLabels = {'Rodada de 32':'1/16 avos','Oitavas de Final':'Oitavas','Quartas de Final':'Quartas','Semifinais':'Semifinal','3º Lugar':'3º lugar','Fase de Grupos':'Fase de grupos'};
const koPhases = ['Rodada de 32','Oitavas de Final','Quartas de Final','Semifinais','Final'];
let DATA = {}, CALC = {}, teamMap = {}, gamesById = {}, detailsByEntry = {}, currentDetailTab = 'resumo';

const $ = id => document.getElementById(id);
const fmt = new Intl.NumberFormat('pt-BR');
const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

async function loadData(){
  try{
    for(const f of files) DATA[f] = await fetch(`data/${f}.json`).then(r=>r.json());
    teamMap = Object.fromEntries(DATA.times.map(t=>[t.code,t]));
    gamesById = Object.fromEntries(DATA.resultados.map(g=>[g.game_id,g]));
    CALC = calculate(DATA);
    detailsByEntry = CALC.details;
    init();
    toast('Dados carregados. Motor de cálculo preservado.');
  }catch(err){ console.error(err); toast('Erro ao carregar dados. Verifique os arquivos JSON.', true); }
}

function flag(code){ return teamMap[code]?.flag || '🏳️'; }
function teamName(code){ if(!code) return 'A definir'; return teamMap[code]?.name || code; }
function team(code){ return code ? `<span class="flag">${flag(code)}</span> ${esc(teamName(code))}` : 'A definir'; }
function teamText(code){ return code ? `${teamMap[code]?.flag || ''} ${teamMap[code]?.name || code}` : 'A definir'; }
function score(g){ return g?.score && g.score !== 'nullxnull' ? g.score : '—'; }
function safe(v){ return v || '—'; }
function phaseLabel(p){ return phaseLabels[p] || p || 'A definir'; }
function lastUpdated(){ return new Date(DATA.estatisticas.generated_at).toLocaleString('pt-BR'); }
function isPenaltyGame(g){ return g && g.game_id>=73 && isPlayed(g) && g.home_goals === g.away_goals && g.advancer; }
function isPending(g){ return !isPlayed(g); }
function pointsCls(n){ return Number(n)>0 ? 'pos-points' : 'zero-points'; }
function gameTitle(g){ return `#${g.game_id} · ${teamText(g.home)} x ${teamText(g.away)}`; }

function init(){
  $('lastUpdate').textContent = `Atualizado em ${lastUpdated()}`;
  bindNavigation();
  bindModal();
  renderHome();
  renderRanking();
  renderPalpites();
  renderResults();
  renderStats();
  renderParticipantSelectors();
  renderRules();
}

function bindNavigation(){
  document.querySelectorAll('[data-page]').forEach(btn=> btn.addEventListener('click',()=>showPage(btn.dataset.page)));
  document.querySelectorAll('[data-go]').forEach(btn=> btn.addEventListener('click',()=>showPage(btn.dataset.go)));
}
function showPage(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  $(`page-${page}`)?.classList.add('active');
  document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active', b.dataset.page===page));
  $('pageTitle').textContent = titles[page] || 'Bolão';
  window.scrollTo({top:0, behavior:'smooth'});
}
function bindModal(){
  $('modalClose').onclick = ()=> $('participantModal').close();
  $('participantModal').addEventListener('click', e=>{ if(e.target.id==='participantModal') e.target.close(); });
}

function phaseBreakdown(id){
  const d = detailsByEntry[id] || {};
  const out = {};
  for(const ph of koPhases) out[ph] = {acertos:0,avanco:0,bonus:0,total:0,cravadas:0};
  for(const row of d.knockout_predictions || []){
    const ph = phaseKey(row.game_id); if(!ph) continue;
    out[ph] ||= {acertos:0,avanco:0,bonus:0,total:0,cravadas:0};
    out[ph].acertos += Number(row.points_confronto||0);
    out[ph].avanco += Number(row.points_avanco||0);
    out[ph].bonus += Number(row.points_placar||0);
    out[ph].total += Number(row.points||0);
    if(Number(row.points_placar||0)>0) out[ph].cravadas++;
  }
  return out;
}
function groupGamePoints(id){ return (detailsByEntry[id]?.group_predictions||[]).reduce((s,x)=>s+Number(x.points||0),0); }
function gamesPlayedByPhase(phase){ return DATA.resultados.filter(g=>g.phase===phase && isPlayed(g)).length; }
function phasesWithResults(){
  const phases = ['Fase de Grupos', ...koPhases];
  return phases.filter(ph => gamesPlayedByPhase(ph)>0 || ph==='Fase de Grupos');
}

function renderHome(){
  const ranking = CALC.ranking;
  const pending = DATA.resultados.filter(isPending).sort((a,b)=>a.game_id-b.game_id);
  const mostExact = [...ranking].sort((a,b)=>b.cravadas-a.cravadas || a.posicao-b.posicao)[0];
  $('podium').innerHTML = ranking.slice(0,3).map((r,i)=>`
    <div class="podium-card">
      <div class="podium-pos">${i===0?'🥇':i===1?'🥈':'🥉'}</div>
      <div><div class="podium-name">${esc(r.display_name)}</div><span class="podium-meta">${r.grupos} grupos · ${r.mata_mata} mata-mata · ${r.cravadas} 🎯</span></div>
      <div class="podium-points">${r.total}</div>
    </div>`).join('');

  const kpis = [
    ['Participantes', DATA.estatisticas.entries_valid, `${DATA.estatisticas.entries_total} apostas no relatório`],
    ['Jogos cadastrados', DATA.resultados.length, `${DATA.estatisticas.played_games} concluídos`],
    ['Jogos pendentes', pending.length, pending[0] ? `próximo: #${pending[0].game_id}` : 'sem pendências'],
    ['Líder atual', ranking[0]?.display_name || '—', `${ranking[0]?.total || 0} pontos`],
    ['Mais cravadas', mostExact?.display_name || '—', `${mostExact?.cravadas || 0} placares exatos`],
    ['Última atualização', lastUpdated(), 'dados estruturados'],
  ];
  $('kpis').innerHTML = kpis.map(([label,value,sub])=>`<div class="kpi"><span>${esc(label)}</span><b>${esc(value)}</b><small>${esc(sub)}</small></div>`).join('');
  $('homeTop10').innerHTML = ranking.slice(0,10).map(rankItem).join('');
  $('pendingGamesHome').innerHTML = pending.slice(0,8).map(gameRow).join('') || `<div class="empty-state">Nenhum jogo pendente.</div>`;
  bindOpeners();
}
function rankItem(r){
  const medal = r.posicao===1?'🥇':r.posicao===2?'🥈':r.posicao===3?'🥉':r.posicao;
  return `<div class="rank-item">
    <div class="rank-badge">${medal}</div>
    <div><button class="participant-btn" data-open-entry="${r.entry_id}">${esc(r.display_name)}</button><span>${r.grupos} grupos · ${r.mata_mata} mata-mata · ${r.cravadas} cravadas</span></div>
    <div class="rank-score">${r.total}</div>
  </div>`;
}

function renderRanking(){
  $('rankingHead').innerHTML = `<tr class="group-row"><th colspan="3" class="block-main">Principal</th><th colspan="3" class="block-synth">Síntese</th><th colspan="3" class="block-r32">1/16 avos</th><th colspan="3" class="block-oct">Oitavas</th><th colspan="3" class="block-qua">Quartas</th><th colspan="3" class="block-semi">Semifinal</th><th colspan="3" class="block-final">Final</th><th colspan="5" class="block-bonus">Finais</th></tr>
  <tr><th class="block-main">#</th><th class="block-main">Participante</th><th class="block-main">Total</th><th class="block-synth">Mata s/ avanço</th><th class="block-synth">Classificados</th><th class="block-synth">Cravadas</th>${koPhases.map(ph=>`<th class="phase-col">Conf.</th><th class="phase-col">Avanço</th><th class="phase-col">Placar +3</th>`).join('')}<th class="block-bonus">Campeão</th><th class="block-bonus">Vice</th><th class="block-bonus">3º</th><th class="block-bonus">4º</th><th class="block-bonus">Artilheiro</th></tr>`;
  const draw = ()=>{
    const q = ($('rankingSearch').value||'').toLowerCase().trim();
    const rows = CALC.ranking.filter(r=>r.display_name.toLowerCase().includes(q));
    $('rankingBody').innerHTML = rows.map(r=>{
      const b = phaseBreakdown(r.entry_id);
      const finals = r.finals || {};
      const medal = r.posicao===1?'🥇':r.posicao===2?'🥈':r.posicao===3?'🥉':r.posicao;
      return `<tr class="rank-row rank-${r.posicao<=3?r.posicao:'normal'}"><td class="pos block-main">${medal}</td><td class="block-main"><button class="participant-btn" data-open-entry="${r.entry_id}">${esc(r.display_name)}</button></td><td class="num total block-main">${r.total}</td><td class="num block-synth">${r.ko_confronto + r.ko_placar}</td><td class="num block-synth">${r.classificados}</td><td class="num block-synth">🎯 ${r.cravadas}</td>${koPhases.map(ph=>`<td class="num phase-col ${pointsCls(b[ph]?.acertos)}">${b[ph]?.acertos||0}</td><td class="num phase-col ${pointsCls(b[ph]?.avanco)}">${b[ph]?.avanco||0}</td><td class="num phase-col ${pointsCls(b[ph]?.bonus)}">${b[ph]?.bonus||0}</td>`).join('')}<td class="block-bonus">${esc(safe(finals.campeao))}</td><td class="block-bonus">${esc(safe(finals.vice))}</td><td class="block-bonus">${esc(safe(finals.terceiro))}</td><td class="block-bonus">${esc(safe(finals.quarto))}</td><td class="block-bonus">${esc(safe(finals.artilheiro))}</td></tr>`;
    }).join('');
    bindOpeners();
  };
  $('rankingSearch').addEventListener('input', draw);
  $('rankingExport').onclick = copyTop10;
  draw();
}
function bindOpeners(){ document.querySelectorAll('[data-open-entry]').forEach(btn=>btn.onclick=()=>openParticipant(Number(btn.dataset.openEntry))); }
function copyTop10(){
  const text = CALC.ranking.slice(0,10).map(r=>`${r.posicao}. ${r.display_name} — ${r.total} pts`).join('\n');
  navigator.clipboard?.writeText(text); toast('Top 10 copiado.');
}

function buildPalpiteRows(){
  const rows=[];
  for(const r of CALC.ranking){
    const d=detailsByEntry[r.entry_id]; if(!d) continue;
    for(const x of d.group_predictions || []){
      const g=gamesById[x.game_id];
      rows.push({entry_id:r.entry_id,participant:r.display_name,type:'grupo',phase:'Fase de Grupos',game_id:x.game_id,teams:[g?.home,g?.away].filter(Boolean),palpite:x.prediction,result:x.result||score(g),status:x.status,points:x.points||0,official:g?`${teamText(g.home)} x ${teamText(g.away)}`:`#${x.game_id}`});
    }
    for(const x of d.knockout_predictions || []){
      const g=gamesById[x.game_id];
      rows.push({entry_id:r.entry_id,participant:r.display_name,type:'mata',phase:phaseKey(x.game_id)||g?.phase||'Mata-mata',game_id:x.game_id,teams:[...(x.prediction_match||'').split(' x '),g?.home,g?.away,x.predicted_winner].filter(Boolean),palpite:`${x.prediction_match||'—'} ${x.prediction_score||''}`.trim(),result:g?`${score(g)}${g.advancer?` · avança ${teamName(g.advancer)}`:''}`:(x.result_in_pdf||'—'),status:x.status,points:x.points||0,official:g?`${teamText(g.home)} x ${teamText(g.away)}`:(x.official||`#${x.game_id}`)});
    }
  }
  return rows;
}
function renderPalpites(){
  const phaseSelect = $('palpitePhase');
  phaseSelect.innerHTML = allPhases.map(p=>`<option value="${p}">${phaseLabel(p)}</option>`).join('');
  $('palpiteTeam').innerHTML = `<option value="Todas">Todas as seleções</option>` + DATA.times.map(t=>`<option value="${t.code}">${t.flag} ${esc(t.name)}</option>`).join('');
  $('palpiteStatus').innerHTML = ['Todos','placar exato','vencedor/empate','confronto correto','classificado correto','confronto + classificado','erro','pendente'].map(s=>`<option value="${s}">${s}</option>`).join('');
  const allRows = buildPalpiteRows();
  const draw = ()=>{
    const q = $('palpiteSearch').value.toLowerCase().trim();
    const team = $('palpiteTeam').value;
    const phase = $('palpitePhase').value;
    const game = $('palpiteGame').value.trim();
    const status = $('palpiteStatus').value;
    let filtered = allRows.filter(x => (!q || x.participant.toLowerCase().includes(q)) && (team==='Todas' || x.teams.includes(team)) && (phase==='Todas' || x.phase===phase) && (!game || String(x.game_id)===game.replace('#','')) && (status==='Todos' || String(x.status||'').toLowerCase().includes(status.toLowerCase())));
    $('palpitesCount').textContent = `${fmt.format(filtered.length)} palpites encontrados`;
    const limit = filtered.length>650 ? filtered.slice(0,650) : filtered;
    $('palpitesBody').innerHTML = limit.map(x=>`<tr><td><button class="participant-btn" data-open-entry="${x.entry_id}">${esc(x.participant)}</button></td><td>${phaseLabel(x.phase)}</td><td>#${x.game_id}<br><small>${esc(x.official)}</small></td><td>${esc(x.palpite)}</td><td>${esc(x.result)}</td><td>${badge(x.status)}</td><td class="num total">${x.points}</td></tr>`).join('') + (filtered.length>650 ? `<tr><td colspan="7" class="empty-state">Exibindo 650 primeiros resultados. Refine os filtros para ver mais.</td></tr>` : '');
    bindOpeners();
  };
  ['palpiteSearch','palpiteTeam','palpitePhase','palpiteGame','palpiteStatus'].forEach(id=>$(id).addEventListener('input', draw));
  draw();
}

function renderResults(){
  $('resultPhase').innerHTML = allPhases.map(p=>`<option value="${p}">${phaseLabel(p)}</option>`).join('');
  const draw=()=>{
    const phase=$('resultPhase').value, status=$('resultStatus').value, q=$('resultSearch').value.toLowerCase().trim();
    const games = DATA.resultados.filter(g=>{
      const text = `${g.game_id} ${g.home} ${g.away} ${g.home_name} ${g.away_name}`.toLowerCase();
      const statusOk = status==='Todos' || (status==='Finalizado' && isPlayed(g)) || (status==='Pendente' && isPending(g)) || (status==='Penaltis' && isPenaltyGame(g));
      return (phase==='Todas' || g.phase===phase) && statusOk && (!q || text.includes(q.replace('#','')));
    }).sort((a,b)=>a.game_id-b.game_id);
    $('games').innerHTML = games.map(gameCard).join('') || `<div class="empty-state big-empty">Nenhum jogo encontrado para os filtros.</div>`;
  };
  ['resultPhase','resultStatus','resultSearch'].forEach(id=>$(id).addEventListener('input', draw));
  draw();
}
function gameCard(g){
  const played = isPlayed(g), penalty = isPenaltyGame(g);
  return `<article class="game-card ${played?'finalizado':'pendente'}">
    <div class="phase"><span>#${g.game_id} · ${phaseLabel(g.phase)}${g.group?` · Grupo ${g.group}`:''}</span><span>${played?'Concluído':'Pendente'}</span></div>
    <div class="score-line"><div class="team-side">${team(g.home)}</div><div class="score-main">${score(g)}</div><div class="team-side away">${team(g.away)}</div></div>
    <div class="game-meta"><span>${esc(g.date_time || 'Data a definir')}</span><span>${esc((g.location || '') + (g.stadium ? ` · ${g.stadium}`:''))}</span></div>
    <div class="status-row">${played ? `<span class="pill good">Computado</span>` : `<span class="pill warn">Sem resultado</span>`}${penalty ? `<span class="pill pen">Pênaltis</span>` : ''}${g.advancer ? `<span class="pill good">Classificado: ${team(g.advancer)}</span>` : ''}</div>
  </article>`;
}
function gameRow(g){ return `<div class="game-row"><div class="match-no">#${g.game_id}</div><div><div class="teams">${team(g.home)} x ${team(g.away)}</div><small>${phaseLabel(g.phase)}${g.advancer?` · classificado: ${team(g.advancer)}`:''}</small></div><div class="score-badge">${score(g)}</div></div>`; }

function renderParticipantSelectors(){
  const options = '<option value="">Selecione...</option>' + CALC.ranking.map(r=>`<option value="${r.entry_id}">${r.posicao}º · ${esc(r.display_name)} · ${r.total} pts</option>`).join('');
  $('participantSelect').innerHTML = options;
  $('participantSelect').addEventListener('change', e=> renderParticipantDetail(Number(e.target.value)));
}
function openParticipant(id){
  const r = CALC.ranking.find(x=>x.entry_id===id); if(!r) return;
  $('modalTitle').textContent = r.display_name;
  $('modalSub').textContent = `${r.posicao}º lugar · ${r.total} pontos · ${r.cravadas} cravadas`;
  $('modalBody').innerHTML = participantDetailHTML(id, true);
  bindDetailTabs(id, $('modalBody'));
  $('participantModal').showModal();
}
function renderParticipantDetail(id){
  const box = $('participantDetail');
  if(!id){ box.className='participant-detail empty-state'; box.textContent='Selecione um participante para conferir a pontuação.'; return; }
  box.className = 'participant-detail';
  box.innerHTML = participantDetailHTML(id, false);
  bindDetailTabs(id, box);
}
function participantDetailHTML(id, modal){
  const r = CALC.ranking.find(x=>x.entry_id===id), d=detailsByEntry[id]; if(!r||!d) return '<div class="empty-state">Participante não encontrado.</div>';
  const b=phaseBreakdown(id), finals=r.finals||{};
  const tabs=[['resumo','Resumo'],['pontos','Jogos que pontuaram'],['erros','Jogos sem ponto'],['grupos','Grupos'],['mata','Mata-mata'],['finais','Finais']];
  return `<div class="summary-grid">
    <div class="summary-card"><span>Posição</span><b>${r.posicao}º</b></div><div class="summary-card"><span>Total</span><b>${r.total}</b></div><div class="summary-card"><span>Grupos</span><b>${r.grupos}</b></div><div class="summary-card"><span>Mata-mata</span><b>${r.mata_mata}</b></div><div class="summary-card"><span>Cravadas</span><b>${r.cravadas}</b></div>
  </div>
  <div class="phase-mini-grid">${['Rodada de 32','Oitavas de Final','Quartas de Final','Semifinais','Final'].map(ph=>`<div><span>${phaseLabel(ph)}</span><b>${b[ph]?.total||0}</b><small>${b[ph]?.acertos||0} conf. · ${b[ph]?.avanco||0} avanço · ${b[ph]?.bonus||0} bônus</small></div>`).join('')}</div>
  <div class="detail-actions"><button class="btn tiny" data-copy-summary="${id}">Copiar resumo</button>${modal?'<button class="btn tiny ghost-dark" data-go-detail="conferencia">Abrir na conferência</button>':''}</div>
  <div class="detail-tabs">${tabs.map(([key,label])=>`<button class="${currentDetailTab===key?'active':''}" data-detail-tab="${key}">${label}</button>`).join('')}</div>
  <div class="detailTabContent">${detailTabContent(r,d,currentDetailTab)}</div>`;
}
function bindDetailTabs(id, root){
  root.querySelectorAll('[data-detail-tab]').forEach(btn=>btn.onclick=()=>{ currentDetailTab=btn.dataset.detailTab; if(root.id==='modalBody') openParticipant(id); else renderParticipantDetail(id); });
  root.querySelector('[data-copy-summary]')?.addEventListener('click',()=>copyParticipantSummary(id));
  root.querySelector('[data-go-detail]')?.addEventListener('click',()=>{ $('participantModal').close(); showPage('conferencia'); $('participantSelect').value=id; renderParticipantDetail(id); });
}
function detailTabContent(r,d,tab){
  const allRows = [...(d.group_predictions||[]).map(x=>({kind:'Grupo',game_id:x.game_id,pred:x.prediction,result:x.result,status:x.status,points:x.points,reason:reasonFor(x.status,x.points)})), ...(d.knockout_predictions||[]).map(x=>({kind:phaseLabel(phaseKey(x.game_id)),game_id:x.game_id,pred:`${x.prediction_match||'—'} ${x.prediction_score||''}`,result:gamesById[x.game_id]?`${score(gamesById[x.game_id])} · avança ${teamName(gamesById[x.game_id].advancer)}`:x.result_in_pdf,status:x.status,points:x.points,reason:koReason(x)}))];
  if(tab==='resumo'){
    return `<div class="rules-grid compact"><article><strong>Classificados corretos</strong><p>${r.classificados_acertos} seleções · ${r.classificados} pontos</p></article><article><strong>Mata-mata sem avanço</strong><p>${r.ko_confronto + r.ko_placar} pontos</p></article><article><strong>Pontos por avanço</strong><p>${r.ko_avanco} pontos</p></article><article><strong>Bônus atuais</strong><p>${r.bonus || 0} pontos</p></article></div><h4>Classificados acertados</h4><div class="chips">${(d.classified_hits||[]).map(c=>`<span class="chip">${team(c)}</span>`).join('') || '<span class="empty-state">Nenhum acerto.</span>'}</div>`;
  }
  if(tab==='pontos') return rowsTable(allRows.filter(x=>Number(x.points)>0));
  if(tab==='erros') return rowsTable(allRows.filter(x=>Number(x.points)===0));
  if(tab==='grupos') return rowsTable(allRows.filter(x=>x.kind==='Grupo'));
  if(tab==='mata') return rowsTable(allRows.filter(x=>x.kind!=='Grupo'));
  const f=r.finals||{}; return `<div class="rules-grid compact"><article><strong>Campeão</strong><p>${esc(safe(f.campeao))}</p></article><article><strong>Vice</strong><p>${esc(safe(f.vice))}</p></article><article><strong>3º lugar</strong><p>${esc(safe(f.terceiro))}</p></article><article><strong>4º lugar</strong><p>${esc(safe(f.quarto))}</p></article><article><strong>Artilheiro</strong><p>${esc(safe(f.artilheiro))}</p></article></div>`;
}
function rowsTable(rows){
  return `<div class="table-wrap"><table class="mini-table"><thead><tr><th>Fase</th><th>Jogo</th><th>Palpite</th><th>Resultado</th><th>Status</th><th>Motivo</th><th>Pts</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.kind)}</td><td>#${x.game_id}<br><small>${esc(gameTitle(gamesById[x.game_id]||{game_id:x.game_id}))}</small></td><td>${esc(x.pred)}</td><td>${esc(x.result||'—')}</td><td>${badge(x.status)}</td><td>${esc(x.reason)}</td><td class="num total">${x.points||0}</td></tr>`).join('') || `<tr><td colspan="7" class="empty-state">Nenhum item encontrado.</td></tr>`}</tbody></table></div>`;
}
function reasonFor(status, points){ if(points===5) return 'Placar exato na fase de grupos'; if(points===3) return 'Vencedor ou empate correto'; return 'Palpite não coincidiu com o resultado'; }
function koReason(x){ const bits=[]; if(x.points_confronto) bits.push('confronto correto +5'); if(x.points_avanco) bits.push('avanço correto +5'); if(x.points_placar) bits.push('placar exato +3'); return bits.join('; ') || 'Sem ponto neste jogo/fase'; }
function copyParticipantSummary(id){
  const r=CALC.ranking.find(x=>x.entry_id===id); if(!r) return;
  const text = `${r.display_name}: ${r.total} pts\nGrupos: ${r.grupos}\nMata-mata: ${r.mata_mata}\nClassificados: ${r.classificados}\nCravadas: ${r.cravadas}`;
  navigator.clipboard?.writeText(text); toast('Resumo copiado.');
}

function renderStats(){
  const mostExact = [...CALC.ranking].sort((a,b)=>b.cravadas-a.cravadas || a.posicao-b.posicao)[0];
  const played=DATA.resultados.filter(isPlayed).length, pending=DATA.resultados.length-played;
  $('statsCards').innerHTML = `<section class="panel stats-card"><h4>👥 Participantes</h4><b>${DATA.estatisticas.entries_valid}</b><p>${DATA.estatisticas.entries_invalid} apostas fora da pontuação</p></section><section class="panel stats-card"><h4>⚽ Jogos</h4><b>${played}</b><p>${pending} pendentes</p></section><section class="panel stats-card"><h4>🎯 Rei/Rainha das cravadas</h4><b>${esc(mostExact.display_name)}</b><p>${mostExact.cravadas} placares exatos</p></section>`;
  renderPhaseStats(); renderTeamPhaseStats(); renderFinalsStats(); renderScorerStats(); renderExactStats(); renderHardEasyGames();
  $('evolutionBox').innerHTML = 'A evolução aparecerá quando houver histórico de rankings por rodada/fase salvo em arquivo próprio. A versão atual preserva apenas o ranking consolidado.';
}
function renderPhaseStats(){
  $('phaseStats').innerHTML = phasesWithResults().map(ph=>{
    const participantRows = CALC.ranking.map(r=>({r, pts: ph==='Fase de Grupos' ? r.grupos : (phaseBreakdown(r.entry_id)[ph]?.total||0)})).sort((a,b)=>b.pts-a.pts || a.r.display_name.localeCompare(b.r.display_name,'pt-BR'));
    const selectionMap = ph==='Fase de Grupos' ? selectionMapFromQualified() : selectionMapFromPredictedWinners(ph);
    return `<div class="phase-box"><h4>${phaseLabel(ph)}</h4><div class="phase-columns"><div class="mini-box"><h5>Participantes</h5>${participantRows.map(({r,pts},i)=>`<details><summary><span>${i+1}. ${esc(r.display_name)}</span><b>${pts}</b></summary>${phaseParticipantDetails(r.entry_id, ph)}</details>`).join('')}</div><div class="mini-box"><h5>Seleções apostadas</h5>${selectionDetailsList(selectionMap)}</div></div></div>`;
  }).join('');
}
function phaseParticipantDetails(id, ph){
  const d=detailsByEntry[id];
  if(ph==='Fase de Grupos') return `<p>${groupGamePoints(id)} pontos em jogos + ${CALC.ranking.find(r=>r.entry_id===id)?.classificados||0} em classificados.</p>`;
  const rows=(d.knockout_predictions||[]).filter(x=>phaseKey(x.game_id)===ph);
  return `<ul class="plain-list">${rows.map(x=>`<li>#${x.game_id}: ${esc(x.prediction_match)} ${esc(x.prediction_score)} · ${badgeText(x.status)} · ${x.points||0} pts</li>`).join('')}</ul>`;
}
function selectionMapFromQualified(){ const m={}; for(const r of CALC.ranking){ for(const code of detailsByEntry[r.entry_id]?.predicted_qualified||[]){ (m[code] ||= []).push(r.display_name); } } return m; }
function selectionMapFromPredictedWinners(ph){ const m={}; for(const r of CALC.ranking){ const set=new Set(); for(const x of detailsByEntry[r.entry_id]?.knockout_predictions||[]){ if(phaseKey(x.game_id)===ph && x.predicted_winner) set.add(x.predicted_winner); } for(const code of set) (m[code] ||= []).push(r.display_name); } return m; }
function selectionDetailsList(map){ return Object.entries(map).sort((a,b)=>b[1].length-a[1].length || teamName(a[0]).localeCompare(teamName(b[0]),'pt-BR')).map(([code,names])=>`<details><summary><span>${team(code)}</span><b>${names.length}</b></summary><p>${names.map(esc).join(', ')}</p></details>`).join('') || `<div class="empty-state">Sem dados.</div>`; }
function renderTeamPhaseStats(){
  const cards=[['Aos 1/16 avos', selectionMapFromQualified()], ['Às oitavas', selectionMapFromPredictedWinners('Rodada de 32')], ['Às quartas', selectionMapFromPredictedWinners('Oitavas de Final')], ['À semifinal', selectionMapFromPredictedWinners('Quartas de Final')], ['À final', selectionMapFromPredictedWinners('Semifinais')], ['Como campeã', finalPositionMap('campeao')]];
  $('teamPhaseStats').innerHTML = cards.map(([title,map])=>`<section class="stat-tile"><h4>${title}</h4>${selectionDetailsList(map)}</section>`).join('');
}
function finalPositionMap(pos){ const m={}; for(const r of CALC.ranking){ const name=r.finals?.[pos]; const code=teamCodeFromName(name); if(code) (m[code] ||= []).push(r.display_name); else if(name) (m[name] ||= []).push(r.display_name); } return m; }
function teamCodeFromName(name){ if(!name) return null; const t=DATA.times.find(t=>t.name.toLowerCase()===String(name).toLowerCase() || t.code===name); return t?.code || null; }
function renderFinalsStats(){
  const positions=[['campeao','Campeão'],['vice','Vice'],['terceiro','3º lugar'],['quarto','4º lugar']];
  $('finalsStats').innerHTML = positions.map(([key,label])=>`<section class="stat-tile"><h4>${label}</h4>${barsFromMap(finalPositionMap(key))}</section>`).join('');
}
function barsFromMap(map){ const entries=Object.entries(map).sort((a,b)=>b[1].length-a[1].length); const max=Math.max(1,...entries.map(e=>e[1].length)); return entries.map(([code,names])=>`<details class="bar-detail"><summary><span>${teamMap[code]?team(code):esc(code)}</span><b>${names.length}</b></summary><div class="bar"><i style="width:${Math.round((names.length/max)*100)}%"></i></div><p>${names.map(esc).join(', ')}</p></details>`).join('') || '<div class="empty-state">Sem apostas.</div>'; }
function renderScorerStats(){
  const m={}; for(const r of CALC.ranking){ const name=r.finals?.artilheiro; if(name) (m[name] ||= []).push(r.display_name); }
  $('scorerStats').innerHTML = Object.entries(m).sort((a,b)=>b[1].length-a[1].length || a[0].localeCompare(b[0],'pt-BR')).map(([name,names])=>`<details class="list-detail"><summary><span>${esc(name)}</span><b>${names.length}</b></summary><p>${names.map(esc).join(', ')}</p></details>`).join('');
}
function renderExactStats(){
  const exactRanking=[...CALC.ranking].sort((a,b)=>b.cravadas-a.cravadas || a.posicao-b.posicao);
  const games=gameAccuracyStats();
  const most=games.filter(g=>g.cravadas>0).sort((a,b)=>b.cravadas-a.cravadas).slice(0,10);
  const phaseMap={}; for(const g of games){ phaseMap[phaseLabel(g.phase)] = (phaseMap[phaseLabel(g.phase)]||0)+g.cravadas; }
  $('exactStats').innerHTML = `<section class="stat-tile"><h4>Ranking de cravadas</h4>${exactRanking.map(r=>`<details><summary><span>${esc(r.display_name)}</span><b>${r.cravadas}</b></summary><p>${r.cravadas_grupo} em grupos · ${r.cravadas_mata_mata} no mata-mata</p></details>`).join('')}</section><section class="stat-tile"><h4>Jogos com mais cravadas</h4>${most.map(g=>`<details><summary><span>#${g.game_id} · ${team(g.home)} x ${team(g.away)}</span><b>${g.cravadas}</b></summary><p>${g.cravadores.map(esc).join(', ')}</p></details>`).join('')}</section><section class="stat-tile"><h4>Cravadas por fase</h4>${Object.entries(phaseMap).map(([ph,n])=>`<div class="stat-line"><span>${ph}</span><b>${n}</b></div>`).join('')}</section>`;
}
function gameAccuracyStats(){
  return DATA.resultados.filter(isPlayed).map(g=>{
    const acertadores=[], cravadores=[];
    for(const r of CALC.ranking){ const d=detailsByEntry[r.entry_id]; let item;
      if(g.game_id<=72){ item=(d.group_predictions||[]).find(x=>x.game_id===g.game_id); if(item?.points>0) acertadores.push(r.display_name); if(item?.status==='placar exato') cravadores.push(r.display_name); }
      else { item=(d.knockout_predictions||[]).find(x=>x.game_id===g.game_id); if(item?.points>0) acertadores.push(r.display_name); if(item?.points_placar>0) cravadores.push(r.display_name); }
    }
    return {...g, acertadores, cravadores, acertos:acertadores.length, cravadas:cravadores.length};
  });
}
function renderHardEasyGames(){
  const groupGames = gameAccuracyStats().filter(g=>g.phase==='Fase de Grupos');
  const hard=[...groupGames].sort((a,b)=>a.acertos-b.acertos || a.cravadas-b.cravadas).slice(0,5);
  const easy=[...groupGames].sort((a,b)=>b.acertos-a.acertos || b.cravadas-a.cravadas).slice(0,8);
  $('hardGames').innerHTML = hard.map(gameStatCard).join('');
  $('easyGames').innerHTML = easy.map(gameStatCard).join('');
}
function gameStatCard(g){ return `<details class="game-row expandable"><summary><div class="match-no">#${g.game_id}</div><div><div class="teams">${team(g.home)} x ${team(g.away)} · ${score(g)}</div><small>${g.acertos} acertadores · ${g.cravadas} cravadas</small></div><div class="score-badge">${g.acertos}</div></summary><p><b>Acertadores:</b> ${g.acertadores.map(esc).join(', ') || 'ninguém'}</p><p><b>Cravadas:</b> ${g.cravadores.map(esc).join(', ') || 'nenhuma'}</p></details>`; }

function renderRules(){
  const r=DATA.regras;
  $('rulesGrid').innerHTML = `<article><strong>Fase de grupos</strong><p>Placar exato/cravada: <b>${r.fase_grupos.placar_exato}</b> pontos. Vencedor ou empate correto: <b>${r.fase_grupos.vencedor_ou_empate}</b> pontos. A cravada substitui o acerto simples.</p></article><article><strong>Classificados aos 1/16 avos</strong><p>Cada seleção corretamente classificada vale <b>${r.classificados_grupos.por_selecao_classificada}</b> pontos. A ordem no grupo não importa.</p></article><article><strong>Mata-mata</strong><p>Confronto correto: <b>${r.mata_mata.confronto_correto}</b>. Seleção que avança: <b>${r.mata_mata.avanco_por_fase}</b>. Placar exato vale <b>${r.mata_mata.placar_exato_bonus}</b> pontos, não 5.</p></article><article><strong>Bônus finais</strong><p>Campeão: <b>${r.bonus_finais.campeao}</b>. Vice: <b>${r.bonus_finais.vice}</b>. 3º lugar: <b>${r.bonus_finais.terceiro}</b>. 4º lugar: <b>${r.bonus_finais.quarto}</b>. Artilheiro: <b>${r.bonus_finais.artilheiro}</b>.</p></article><article><strong>Desempate</strong><p>${(r.desempate||[]).map(esc).join(' → ') || 'Não informado nos dados.'}</p></article><article><strong>Auditoria</strong><p>Todo total exibido deve bater com a soma do detalhe individual. Não há total manual no Ranking.</p></article>`;
}

function badge(status){ const s=String(status||'pendente').toLowerCase(); const cls=s.includes('exato')||s.includes('correto')||s.includes('classificado')?'good':s.includes('erro')?'bad':'warn'; return `<span class="pill ${cls}">${esc(status||'pendente')}</span>`; }
function badgeText(status){ return String(status||'pendente'); }
function toast(msg, error=false){ const t=$('toast'); t.textContent=msg; t.style.background=error?'var(--red)':'var(--navy)'; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2600); }

loadData();
