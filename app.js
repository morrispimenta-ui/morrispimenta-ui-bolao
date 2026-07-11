import { calculate, isPlayed, phaseKey } from './src/engine.js';
import { computeSimulation, uniqueScorers, summarizeScenario, isEditableGame } from './src/simulator.js';

const files = ['regras','times','resultados','participantes','apostas_detalhes','ranking','estatisticas'];
const CACHE_BUST = Date.now();
const LOCAL_RESULTS_KEY = 'bolao_resultados_publico_local_v8';
const LEGACY_LOCAL_KEYS = ['bolao_resultados_publico_local_v5','bolao_resultados_publico_local_v6','bolao_resultados_publico_local_v7'];
const SIM_PARAM = new URLSearchParams(location.search).get('simulacao');
const USE_LOCAL_SIMULATION = SIM_PARAM === '1';
const CLEAR_LOCAL_SIMULATION = SIM_PARAM === 'limpar';
let usingLocalResults = false;
let resultsSource = 'data/resultados.json';
let resultsMeta = {};
const titles = {home:'Início', ranking:'Ranking Geral', palpites:'Palpites', resultados:'Resultados', estatisticas:'Estatísticas', conferencia:'Conferência Individual', comparar:'Comparar', simulador:'Simulador', regras:'Regras'};
const allPhases = ['Todas','Fase de Grupos','Rodada de 32','Oitavas de Final','Quartas de Final','Semifinais','3º Lugar','Final'];
const phaseLabels = {'Rodada de 32':'1/16 avos','Oitavas de Final':'Oitavas','Quartas de Final':'Quartas','Semifinais':'Semifinal','3º Lugar':'3º lugar','Fase de Grupos':'Fase de grupos'};
const koPhases = ['Rodada de 32','Oitavas de Final','Quartas de Final','Semifinais','Final'];
const TEAM_ISO = {ALG:'dz',ARG:'ar',AUS:'au',AUT:'at',BEL:'be',BIH:'ba',BRA:'br',CAN:'ca',CIV:'ci',COD:'cd',COL:'co',CPV:'cv',CRO:'hr',CUW:'cw',CZE:'cz',ECU:'ec',EGY:'eg',ENG:'gb-eng',ESP:'es',FRA:'fr',GER:'de',GHA:'gh',HAI:'ht',IRN:'ir',IRQ:'iq',JOR:'jo',JPN:'jp',KOR:'kr',KSA:'sa',MAR:'ma',MEX:'mx',NED:'nl',NOR:'no',NZL:'nz',PAN:'pa',PAR:'py',POR:'pt',QAT:'qa',SCO:'gb-sct',SEN:'sn',SUI:'ch',SWE:'se',TUN:'tn',TUR:'tr',URU:'uy',USA:'us',UZB:'uz',ZAF:'za'};

let DATA = {}, CALC = {}, teamMap = {}, gamesById = {}, detailsByEntry = {}, currentDetailTab = 'resumo';
let SIM_CHOICES = {};
let SIM_SCORER = '';
let SIM_CALC = null;
const $ = id => document.getElementById(id);
const fmt = new Intl.NumberFormat('pt-BR');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));


function unpackResultsPayload(payload){
  if(Array.isArray(payload)) return {resultados:payload, meta:{}};
  if(payload && Array.isArray(payload.resultados)) return {resultados:payload.resultados, meta:payload.metadata || payload.meta || {}};
  if(payload && Array.isArray(payload.results)) return {resultados:payload.results, meta:payload.metadata || payload.meta || {}};
  return {resultados:[], meta:{}};
}
function normalizeResultsPayload(payload){ return unpackResultsPayload(payload).resultados; }
function playedCount(results){ return (results || []).filter(isPlayed).length; }
function maxResultUpdatedAt(results){
  const dates = (results || [])
    .map(g => g?.resultados_json_updated_at || g?.updated_at || g?.last_updated_at || g?.exported_at)
    .filter(Boolean)
    .map(d => new Date(d).getTime())
    .filter(Number.isFinite);
  return dates.length ? new Date(Math.max(...dates)) : null;
}
function metaTime(meta){
  const raw = meta?.updated_at || meta?.generated_at || meta?.exported_at || meta?.data_atualizacao;
  const t = raw ? new Date(raw).getTime() : NaN;
  return Number.isFinite(t) ? t : 0;
}
function resultTime(results, meta={}){ return Math.max(metaTime(meta), maxResultUpdatedAt(results)?.getTime() || 0); }
function shouldPreferResults(candidate, candidateMeta, current, currentMeta){
  const pc = playedCount(candidate), cc = playedCount(current);
  if(pc !== cc) return pc > cc;
  return resultTime(candidate, candidateMeta) > resultTime(current, currentMeta);
}
function resultUpdateLabel(){
  const metaDate = resultsMeta?.updated_at || resultsMeta?.generated_at || resultsMeta?.exported_at;
  const fromMeta = metaDate ? new Date(metaDate) : null;
  const fromResults = maxResultUpdatedAt(DATA.resultados);
  const date = fromMeta && Number.isFinite(fromMeta.getTime()) ? fromMeta : (fromResults || new Date(DATA.estatisticas?.generated_at || Date.now()));
  return date.toLocaleString('pt-BR');
}
function resultUpdateShort(){
  return `${lastUpdated()} · ${playedCount(DATA.resultados)} jogos concluídos`;
}
function liveStats(){
  const valid = CALC.ranking.length;
  const played = playedCount(DATA.resultados);
  const pending = (DATA.resultados||[]).length - played;
  const leader = CALC.ranking[0] || {};
  const cr = cravadaStats();
  const totalPoints = CALC.ranking.reduce((s,r)=>s+Number(r.total||0),0);
  const avgPoints = valid ? totalPoints/valid : 0;
  const groupStats = gameAccuracyStats ? gameAccuracyStats().filter(g=>g.phase==='Fase de Grupos') : [];
  const denom = valid * Math.max(1, groupStats.length);
  const acertos = groupStats.reduce((s,g)=>s+g.acertos,0);
  const hitRate = denom ? (acertos/denom*100) : 0;
  return {valid, invalid:(DATA.participantes||[]).filter(p=>!p.valid).length, total:(DATA.participantes||[]).length, played, pending, leader, totalCravadas:cr.total, totalCravadasGrupo:cr.groupTotal, totalCravadasMata:cr.koTotal, avgPoints, mostExact:cr.kingTotal, hitRate};
}

async function loadData(){
  try{
    for(const f of files) {
      const payload = await fetch(`data/${f}.json?v=${CACHE_BUST}`, { cache: 'no-store' }).then(r=>{ if(!r.ok) throw new Error(`Falha ao carregar ${f}`); return r.json(); });
      if(f === 'resultados'){
        const unpacked = unpackResultsPayload(payload);
        DATA.resultados = unpacked.resultados;
        resultsMeta = unpacked.meta || {};
        DATA.resultados_meta = resultsMeta;
      } else {
        DATA[f] = payload;
      }
    }
    // V9: o site público NÃO usa simulação local por padrão. Isso evita que um localStorage antigo
    // mascare o data/resultados.json publicado no GitHub. A simulação só entra com ?simulacao=1.
    if(CLEAR_LOCAL_SIMULATION){
      localStorage.removeItem(LOCAL_RESULTS_KEY);
      for(const k of LEGACY_LOCAL_KEYS) localStorage.removeItem(k);
      history.replaceState(null,'','index.html');
    }
    // Tolerância operacional: se o arquivo foi enviado por engano na raiz, usar só quando ele tiver
    // MAIS jogos concluídos do que data/resultados.json; empate não substitui a fonte correta.
    try{
      const rootResp = await fetch(`resultados.json?v=${CACHE_BUST}`, { cache:'no-store' });
      if(rootResp.ok){
        const rootUnpacked = unpackResultsPayload(await rootResp.json());
        const rootResults = rootUnpacked.resultados;
        if(rootResults.length && shouldPreferResults(rootResults, rootUnpacked.meta, DATA.resultados, resultsMeta)){
          DATA.resultados = rootResults;
          resultsMeta = rootUnpacked.meta || {};
          DATA.resultados_meta = resultsMeta;
          resultsSource = 'resultados.json na raiz';
        }
      }
    }catch(e){ /* arquivo raiz não existe: fluxo normal */ }
    const localRaw = USE_LOCAL_SIMULATION ? localStorage.getItem(LOCAL_RESULTS_KEY) : null;
    if(localRaw){
      try{
        const parsed = JSON.parse(localRaw);
        const localUnpacked = unpackResultsPayload(parsed);
        const localResults = localUnpacked.resultados;
        if(localResults.length && (playedCount(localResults) >= playedCount(DATA.resultados) || shouldPreferResults(localResults, localUnpacked.meta, DATA.resultados, resultsMeta))){
          DATA.resultados = localResults;
          resultsMeta = localUnpacked.meta || {};
          DATA.resultados_meta = resultsMeta;
          usingLocalResults = true;
          resultsSource = 'localStorage / gestao-resultados';
        }
      }catch(e){ console.warn('Resultados locais ignorados', e); }
    }
    teamMap = Object.fromEntries(DATA.times.map(t=>[t.code,t]));
    CALC = calculate(DATA);
    DATA.resultados = CALC.resultados || DATA.resultados;
    gamesById = Object.fromEntries(DATA.resultados.map(g=>[g.game_id,g]));
    detailsByEntry = CALC.details;
    enrichExactLists();
    init();
    toast('Bolão atualizado.');
  }catch(err){ console.error(err); toast('Não foi possível carregar os dados. Atualize a página e tente novamente.', true); }
}

function teamName(code){ if(!code) return 'A definir'; return teamMap[code]?.name || code; }
function flagEmoji(code){ return teamMap[code]?.flag || '🏳️'; }
function flagImg(code){
  if(!code) return '';
  const label = esc(teamName(code));
  const fallback = `<span class="flag-code" title="${label}">${esc(code)}</span>`;
  return `<span class="flag-stack"><img class="flag-img" src="assets/flags/${esc(code)}.svg" alt="Bandeira de ${label}" loading="lazy" onerror="this.style.display='none'; if(this.nextElementSibling){this.nextElementSibling.style.display='inline-grid'}"/>${fallback}</span>`;
}
function team(code, compact=false){ return code ? `<span class="team-chip ${compact?'compact':''}">${flagImg(code)}<span>${esc(teamName(code))}</span></span>` : '<span class="muted">A definir</span>'; }
function teamText(code){ return code ? `${flagEmoji(code)} ${teamName(code)}` : 'A definir'; }
function teamsFromMatch(match){ if(!match || !match.includes(' x ')) return []; return match.split(' x ').map(x=>x.trim()).filter(Boolean); }
function matchHTML(match){ const parts = teamsFromMatch(match); return parts.length===2 ? `${team(parts[0],true)} <b class="x">x</b> ${team(parts[1],true)}` : esc(match || '—'); }
function score(g){ return g?.score && g.score !== 'nullxnull' ? g.score : '—'; }
function safe(v){ return v || '—'; }
function phaseLabel(p){ return phaseLabels[p] || p || 'A definir'; }
function lastUpdated(){ return resultUpdateLabel(); }
function isPenaltyGame(g){ return g && g.game_id>=73 && isPlayed(g) && g.home_goals === g.away_goals && g.advancer; }
function isPending(g){ return !isPlayed(g); }
function pointsCls(n){ return Number(n)>0 ? 'pos-points' : 'zero-points'; }
function gameTitle(g){ return g ? `#${g.game_id} · ${teamText(g.home)} x ${teamText(g.away)}` : 'Jogo não encontrado'; }
function participantsOptions(){ return '<option value="">Selecione...</option>' + CALC.ranking.map(r=>`<option value="${r.entry_id}">${r.posicao}º · ${esc(r.display_name)} · ${r.total} pts</option>`).join(''); }

function nval(v){ return Number(v || 0); }
function cravadasGrupo(r){ return nval(r?.cravadas_grupo ?? r?.cravadas); }
function cravadasMata(r){ return nval(r?.cravadas_mata_mata ?? r?.placares_exatos_mata_mata); }
function cravadasTotal(r){ return cravadasGrupo(r) + cravadasMata(r); }
function cravadaKing(sorter){ return [...CALC.ranking].sort(sorter)[0] || {}; }
function cravadaStats(){
  const groupTotal = CALC.ranking.reduce((sum,r)=>sum+cravadasGrupo(r),0);
  const koTotal = CALC.ranking.reduce((sum,r)=>sum+cravadasMata(r),0);
  const total = groupTotal + koTotal;
  const kingGroup = cravadaKing((a,b)=>cravadasGrupo(b)-cravadasGrupo(a) || a.posicao-b.posicao);
  const kingKo = cravadaKing((a,b)=>cravadasMata(b)-cravadasMata(a) || a.posicao-b.posicao);
  const kingTotal = cravadaKing((a,b)=>cravadasTotal(b)-cravadasTotal(a) || a.posicao-b.posicao);
  return {groupTotal, koTotal, total, kingGroup, kingKo, kingTotal};
}
function statusFilterOk(x,status){
  if(status === 'Todos') return true;
  const s = String(x.status || '').toLowerCase();
  if(status === 'cravada') return s.includes('placar exato') || Number(x.points_placar || 0) > 0;
  return s.includes(status.toLowerCase());
}
function finalTeamCodes(r){
  const f = r.finals || {};
  return ['campeao','vice','terceiro','quarto'].map(k=>teamCodeFromName(f[k])).filter(Boolean);
}
function palpiteRowsByPhase(rows){ return rows.reduce((acc,x)=>{ (acc[x.phase] ||= []).push(x); return acc; },{}); }
function loserPublic(g){ return g?.advancer && g.home && g.away ? (g.advancer === g.home ? g.away : g.home) : null; }
function finalStatusLabel(key, value){
  const code = teamCodeFromName(value); if(!code) return 'pendente';
  const g104 = gamesById[104], g103 = gamesById[103];
  const actual = {};
  if(isPlayed(g104)){ actual.campeao = g104.advancer; actual.vice = loserPublic(g104); }
  if(isPlayed(g103)){ actual.terceiro = g103.advancer; actual.quarto = loserPublic(g103); }
  if(!actual[key]) return 'ainda possível';
  return actual[key] === code ? 'acertou' : 'errou';
}
function exactRankingSection(title, rows, mode){
  return `<section class="stat-tile"><h4>${title}</h4>${rows.map(r=>{
    const n = mode==='grupo' ? cravadasGrupo(r) : mode==='mata' ? cravadasMata(r) : cravadasTotal(r);
    return `<details><summary><span>${esc(r.display_name)}</span><b>${n}</b></summary><p>Grupos: ${cravadasGrupo(r)} · Mata-mata: ${cravadasMata(r)} / ${r.ko_placar||0} pontos de bônus · Total estatístico: ${cravadasTotal(r)}</p>${exactHTML(detailsByEntry[r.entry_id])}</details>`;
  }).join('')}</section>`;
}
function exactGameDetails(g){ return `<details><summary><span>#${g.game_id} · ${team(g.home,true)} x ${team(g.away,true)}</span><b>${g.cravadas}</b></summary><p>${g.cravadores.map(esc).join(', ') || 'nenhuma'}</p></details>`; }
function palpitePhaseAccordion(r, ph, rows){
  const pts = rows.reduce((sum,x)=>sum+nval(x.points),0);
  const cravs = rows.filter(x=>String(x.status||'').toLowerCase().includes('placar exato') || nval(x.points_placar)>0).length;
  return `<details class="palpite-phase-card">
    <summary><div><strong>${phaseLabel(ph)}</strong><small>${rows.length} jogo(s) exibido(s) · ${pts} pontos · ${cravs} cravada(s)</small></div><span>Abrir detalhes</span></summary>
    <div class="palpite-games-list">${rows.sort((a,b)=>a.game_id-b.game_id).map(palpiteGameMiniRow).join('')}</div>
  </details>`;
}
function palpiteGameMiniRow(x){
  const pts = nval(x.points);
  const isKoExact = nval(x.points_placar)>0 || (x.type === 'mata' && String(x.status||'').includes('placar'));
  const statusLabel = isKoExact ? '🎯 Cravada de mata-mata · +3 bônus' : badgeText(x.status);
  return `<article class="palpite-game-mini ${pts>0?'hit':'miss'}">
    <div class="match-no">#${x.game_id}</div>
    <div class="palpite-mini-main"><div class="teams">${x.official}</div><small>${badge(statusLabel)} ${x.type==='mata' && isKoExact ? '<span class="pill good">⭐ bônus mata-mata</span>' : ''}</small></div>
    <div class="palpite-mini-detail"><span>Palpite</span><b>${x.palpite}</b></div>
    <div class="palpite-mini-detail"><span>Resultado</span><b>${x.result || '—'}</b></div>
    <div class="palpite-mini-points"><b>${pts}</b><small>pts</small></div>
  </article>`;
}
function palpitesFinaisSummary(r){
  const f = r.finals || {};
  const items = [['🏆','Campeão','campeao'],['🥈','Vice','vice'],['🥉','Terceiro','terceiro'],['4️⃣','Quarto','quarto']];
  return `<section class="palpites-finais-box"><h4>Palpites finais</h4><div class="final-cards-mini">${items.map(([icon,label,key])=>{
    const code=teamCodeFromName(f[key]);
    return `<article><span>${icon} ${label}</span><b>${code?team(code,true):esc(safe(f[key]))}</b><small>${finalStatusLabel(key, f[key])}</small></article>`;
  }).join('')}<article><span>⚽ Artilheiro</span><b>${esc(safe(f.artilheiro))}</b><small>pendente</small></article></div></section>`;
}
function palpiteParticipantCard(r, rows, filters){
  const finals = r.finals || {};
  const open = filters.selectedParticipant !== 'Todos';
  const champ = teamCodeFromName(finals.campeao);
  const grouped = palpiteRowsByPhase(rows);
  const phaseOrder = ['Fase de Grupos','Rodada de 32','Oitavas de Final','Quartas de Final','Semifinais','3º Lugar','Final'];
  const phaseBlocks = phaseOrder.filter(ph=>grouped[ph]?.length).map(ph=>palpitePhaseAccordion(r, ph, grouped[ph])).join('');
  return `<details class="palpite-participant-card" ${open?'open':''}>
    <summary>
      <div class="rank-pos">${r.posicao<=3?['🥇','🥈','🥉'][r.posicao-1]:r.posicao+'º'}</div>
      <div class="palpite-person-main">
        <strong>${esc(r.display_name)}</strong>
        <small>${r.total} pts · Grupos ${r.grupos} · Mata-mata ${r.mata_mata}</small>
        <span class="palpite-final-line">${champ?team(champ,true):esc(safe(finals.campeao))} · ⚽ ${esc(safe(finals.artilheiro))}</span>
      </div>
      <div class="palpite-summary-metrics">
        <span><b>${cravadasGrupo(r)}</b><small>grupos</small></span>
        <span><b>${cravadasMata(r)}</b><small>mata</small></span>
        <span><b>${cravadasTotal(r)}</b><small>total 🎯</small></span>
      </div>
      <span class="expand-hint">Ver palpites</span>
    </summary>
    <div class="palpite-participant-body">
      <div class="sum-proof"><strong>Prova da soma:</strong> ${r.grupos_jogos} jogos de grupo + ${r.classificados} classificados + ${r.ko_confronto} confronto + ${r.ko_avanco} avanço + ${r.ko_placar} bônus de placar no mata-mata + ${r.bonus||0} bônus finais = <b>${r.total}</b></div>
      <div class="palpite-proof-grid">
        <article><span>Total</span><b>${r.total}</b></article>
        <article><span>Grupos</span><b>${r.grupos}</b></article>
        <article><span>Classificados</span><b>${r.classificados}</b></article>
        <article><span>Mata-mata</span><b>${r.mata_mata}</b></article>
        <article><span>Cravadas de grupos</span><b>${cravadasGrupo(r)}</b></article>
        <article><span>Cravadas de mata-mata</span><b>${cravadasMata(r)} · ${r.ko_placar||0} pts</b></article>
      </div>
      <div class="palpite-phase-list">${phaseBlocks || '<div class="empty-state">Nenhum jogo encontrado para os filtros selecionados.</div>'}</div>
      ${palpitesFinaisSummary(r)}
      <div class="detail-actions"><button class="btn tiny" data-open-entry="${r.entry_id}">Abrir conferência completa</button></div>
    </div>
  </details>`;
}


function init(){
  $('lastUpdate').textContent = `Atualizado em ${lastUpdated()}`;
  bindNavigation(); bindModal(); renderHome(); renderRanking(); renderPalpites(); renderResults(); renderStats(); renderParticipantSelectors(); renderCompare(); renderSimulator(); renderRules();
  const initial = (location.hash || '#home').slice(1); if(titles[initial]) showPage(initial, false);
}
function bindNavigation(){ document.querySelectorAll('[data-page]').forEach(btn=> btn.addEventListener('click',()=>showPage(btn.dataset.page))); document.querySelectorAll('[data-go]').forEach(btn=> btn.addEventListener('click',()=>showPage(btn.dataset.go))); }
function showPage(page, updateHash=true){ document.querySelectorAll('.page').forEach(p=>p.classList.remove('active')); $(`page-${page}`)?.classList.add('active'); document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active', b.dataset.page===page)); $('pageTitle').textContent = titles[page] || 'Bolão'; if(updateHash) history.replaceState(null,'',`#${page}`); window.scrollTo({top:0, behavior:'smooth'}); }
function bindModal(){ $('modalClose').onclick = ()=> $('participantModal').close(); $('participantModal').addEventListener('click', e=>{ if(e.target.id==='participantModal') e.target.close(); }); }

function enrichExactLists(){
  for(const r of CALC.ranking){
    const d = detailsByEntry[r.entry_id]; if(!d) continue;
    d.exact_group_rows = (d.group_predictions||[])
      .filter(x=>x.status==='placar exato')
      .map(x=>{ const g=gamesById[x.game_id]||{}; return {kind:'Cravada de grupos', game_id:x.game_id, points:x.points, prediction:x.prediction, result:g.score||x.result, reason:'Cravada oficial: placar exato na fase de grupos (+5)', home:g.home, away:g.away}; });
    d.ko_exact_rows = (d.knockout_predictions||[])
      .filter(x=>Number(x.points_placar||0)>0)
      .map(x=>{ const g=gamesById[x.game_id]||{}; return {kind:'Cravada de mata-mata', game_id:x.game_id, points:x.points_placar, prediction:x.prediction_score, result:g.score||x.result_in_pdf, reason:'Cravada de mata-mata: bônus de placar exato (+3), com confronto e classificado corretos', home:g.home, away:g.away}; });
    d.exact_rows = [...d.exact_group_rows, ...d.ko_exact_rows];
  }
}
function auditInternal(){
  const issues=[];
  const validCodes = new Set(DATA.times.map(t=>t.code));
  for(const r of CALC.ranking){
    const d=detailsByEntry[r.entry_id]; if(!d){ issues.push(`${r.display_name}: sem detalhe`); continue; }
    const groupSum=(d.group_predictions||[]).reduce((s,x)=>s+Number(x.points||0),0);
    const classPts=(d.classified_hits||[]).length*Number(DATA.regras.classificados_grupos.por_selecao_classificada||5);
    const koSum=(d.knockout_predictions||[]).reduce((s,x)=>s+Number(x.points||0),0);
    const total=groupSum+classPts+koSum+Number(r.bonus||0);
    if(total!==r.total) issues.push(`${r.display_name}: total ${r.total} difere da soma ${total}`);
    const exactCount=(d.exact_group_rows||d.exact_rows||[]).length;
    if(exactCount!==r.cravadas) issues.push(`${r.display_name}: cravadas ${r.cravadas} diferem da lista de grupos ${exactCount}`);
    for(const code of [...(d.predicted_qualified||[]), ...(d.classified_hits||[])]) if(!validCodes.has(code)) issues.push(`${r.display_name}: seleção desconhecida ${code}`);
    for(const row of [...(d.group_predictions||[]), ...(d.knockout_predictions||[])]) if(Number(row.points||0)<0 || Number.isNaN(Number(row.points||0))) issues.push(`${r.display_name}: pontuação inválida no jogo ${row.game_id}`);
  }
  for(const g of DATA.resultados){ if(isPlayed(g) && g.game_id>=73 && !g.advancer) issues.push(`#${g.game_id}: mata-mata concluído sem classificado`); }
  return issues;
}

function phaseBreakdown(id){ const d = detailsByEntry[id] || {}; const out = {}; for(const ph of koPhases) out[ph] = {jogos:0,avanco:0,bonus:0,total:0,cravadas:0}; for(const row of d.knockout_predictions || []){ const ph = phaseKey(row.game_id); if(!ph) continue; out[ph] ||= {jogos:0,avanco:0,bonus:0,total:0,cravadas:0}; out[ph].jogos += Number(row.points_confronto||0); out[ph].avanco += Number(row.points_avanco||0); out[ph].bonus += Number(row.points_placar||0); out[ph].total += Number(row.points||0); if(Number(row.points_placar||0)>0) out[ph].cravadas++; } return out; }
function groupGamePoints(id){ return (detailsByEntry[id]?.group_predictions||[]).reduce((s,x)=>s+Number(x.points||0),0); }
function gamesPlayedByPhase(phase){ return DATA.resultados.filter(g=>g.phase===phase && isPlayed(g)).length; }
function phasesWithResults(){ return ['Fase de Grupos', ...koPhases].filter(ph => ph==='Fase de Grupos' ? gamesPlayedByPhase(ph)>0 : gamesPlayedByPhase(ph)>0); }

function renderHome(){
  const ranking = CALC.ranking, pending = DATA.resultados.filter(isPending).sort((a,b)=>a.game_id-b.game_id), played = DATA.resultados.filter(isPlayed).length;
  const mostExact = [...ranking].sort((a,b)=>b.cravadas-a.cravadas || a.posicao-b.posicao)[0];
  $('podium').innerHTML = ranking.slice(0,3).map((r,i)=>`<div class="podium-card podium-${i+1}"><div class="podium-pos">${i===0?'🥇':i===1?'🥈':'🥉'}</div><div><div class="podium-name">${esc(r.display_name)}</div><span class="podium-meta">${r.grupos} grupos · ${r.mata_mata} mata-mata · ${r.cravadas} 🎯</span></div><div class="podium-points">${r.total}</div></div>`).join('');
  const st=liveStats(); const kpis = [['Participantes', st.valid, 'apostas consideradas'], ['Jogos cadastrados', DATA.resultados.length, `${played} concluídos`], ['Jogos pendentes', pending.length, pending[0] ? `próximo jogo: #${pending[0].game_id}` : 'sem pendências'], ['Líder atual', ranking[0]?.display_name || '—', `${ranking[0]?.total || 0} pontos`], ['Mais cravadas', mostExact?.display_name || '—', `${mostExact?.cravadas || 0} cravadas`], ['Última atualização', lastUpdated(), `${played} jogos concluídos`]];
  $('kpis').innerHTML = kpis.map(([label,value,sub])=>`<div class="kpi"><span>${esc(label)}</span><b>${esc(value)}</b><small>${esc(sub)}</small></div>`).join('');
  $('homeTop10').innerHTML = ranking.slice(0,10).map(rankItem).join('');
  $('pendingGamesHome').innerHTML = pending.slice(0,8).map(gameRow).join('') || `<div class="empty-state">Nenhum jogo pendente.</div>`;
  bindOpeners();
}
function rankItem(r){ const medal = r.posicao===1?'🥇':r.posicao===2?'🥈':r.posicao===3?'🥉':r.posicao; return `<div class="rank-item"><div class="rank-badge">${medal}</div><div><button class="participant-btn" data-open-entry="${r.entry_id}">${esc(r.display_name)}</button><span>${r.grupos} grupos · ${r.mata_mata} mata-mata · ${r.cravadas} cravadas</span></div><div class="rank-score">${r.total}</div></div>`; }

function renderRanking(){
  const draw = ()=>{
    const q = ($('rankingSearch').value||'').toLowerCase().trim();
    const rows = CALC.ranking.filter(r=>r.display_name.toLowerCase().includes(q));
    $('rankingCards').innerHTML = rows.map(rankCardBase44).join('') || `<div class="empty-state big-empty">Nenhum participante encontrado.</div>`;
    bindOpeners();
  };
  $('rankingSearch').addEventListener('input', draw);
  $('rankingExport').onclick = copyTop10;
  draw();
}
function rankCardBase44(r){
  const finals = r.finals || {};
  const medal = r.posicao===1?'🥇':r.posicao===2?'🥈':r.posicao===3?'🥉':`${r.posicao}º`;
  const champ = teamCodeFromName(finals.campeao);
  const b = phaseBreakdown(r.entry_id);
  return `<details class="rank-card-base44 rank-${r.posicao<=3?r.posicao:'normal'}">
    <summary>
      <div class="rank-pos">${medal}</div>
      <div class="rank-main">
        <strong>${esc(r.display_name)}</strong>
        <small>G: ${r.grupos} · M: ${r.mata_mata} · B: ${r.bonus||0}</small>
        <span class="expand-hint">⌄ Ver composição</span>
      </div>
      <div class="rank-metric points"><b>${r.total}</b><small>pts</small></div>
      <div class="rank-metric"><b>⚡ ${r.cravadas}</b><small>cravadas</small></div>
      <div class="rank-champ">${champ?team(champ,true):esc(safe(finals.campeao))}</div>
    </summary>
    <div class="rank-composition">
      <section class="composition-box group">
        <h4>🌎 Fase de grupos</h4>
        <div class="comp-line"><span>Jogos da fase de grupos</span><b>${r.grupos_jogos} pts</b></div>
        <div class="comp-line"><span>Classificados corretos</span><b>${r.classificados_acertos || 0} × 5 = ${r.classificados} pts</b></div>
        <div class="comp-line total"><span>Subtotal grupos</span><b>${r.grupos} pts</b></div>
      </section>
      <section class="composition-box ko">
        <h4>⚔️ Mata-mata</h4>
        <div class="comp-line"><span>Confrontos corretos</span><b>${r.ko_confronto || 0} pts</b></div>
        <div class="comp-line"><span>Avanços corretos</span><b>${r.ko_avanco || 0} pts</b></div>
        <div class="comp-line"><span>Placar exato válido</span><b>${r.ko_placar || 0} pts</b></div>
        <details class="phase-detail-mini"><summary>Avanços por fase</summary>
          ${koPhases.map(ph=>`<div class="comp-line mini"><span>${phaseLabel(ph)}</span><b>${b[ph]?.avanco||0} pts</b></div>`).join('')}
        </details>
        <div class="comp-line total"><span>Subtotal mata-mata</span><b>${r.mata_mata} pts</b></div>
      </section>
      <section class="composition-box finals">
        <h4>⭐ Bônus finais</h4>
        <div class="comp-line"><span>Campeão</span><b>${esc(safe(finals.campeao))}</b></div>
        <div class="comp-line"><span>Vice</span><b>${esc(safe(finals.vice))}</b></div>
        <div class="comp-line"><span>3º lugar</span><b>${esc(safe(finals.terceiro))}</b></div>
        <div class="comp-line"><span>4º lugar</span><b>${esc(safe(finals.quarto))}</b></div>
        <div class="comp-line"><span>Artilheiro</span><b>${esc(safe(finals.artilheiro))}</b></div>
        <div class="comp-line total"><span>Total bônus</span><b>${r.bonus||0} pts</b></div>
      </section>
      <div class="composition-actions"><button class="btn tiny" data-open-entry="${r.entry_id}">Abrir conferência completa</button></div>
    </div>
  </details>`;
}
function bindOpeners(){ document.querySelectorAll('[data-open-entry]').forEach(btn=>btn.onclick=()=>openParticipant(Number(btn.dataset.openEntry))); }
function copyTop10(){ const text = CALC.ranking.slice(0,10).map(r=>`${r.posicao}. ${r.display_name} — ${r.total} pts`).join('\n'); navigator.clipboard?.writeText(text); toast('Top 10 copiado.'); }

function buildPalpiteRows(){
  const rows=[];
  for(const r of CALC.ranking){ const d=detailsByEntry[r.entry_id]; if(!d) continue;
    for(const x of d.group_predictions || []){ const g=gamesById[x.game_id]; rows.push({entry_id:r.entry_id,participant:r.display_name,type:'grupo',phase:'Fase de Grupos',game_id:x.game_id,teams:[g?.home,g?.away].filter(Boolean),palpite:scorePairHTML(g?.home,g?.away,x.prediction),result:scorePairHTML(g?.home,g?.away,x.result||score(g)),status:x.status,points:x.points||0,official:g?`${team(g.home,true)} <b class="x">x</b> ${team(g.away,true)}`:`#${x.game_id}`}); }
    for(const x of d.knockout_predictions || []){ const g=gamesById[x.game_id]; const predTeams=teamsFromMatch(x.prediction_match); rows.push({entry_id:r.entry_id,participant:r.display_name,type:'mata',phase:phaseKey(x.game_id)||g?.phase||'Mata-mata',game_id:x.game_id,teams:[...predTeams,g?.home,g?.away,x.predicted_winner].filter(Boolean),palpite:`${matchHTML(x.prediction_match)} <span class="score-mini">${esc(x.prediction_score||'—')}</span>${x.predicted_winner?` <span class="adv-mini">avança ${team(x.predicted_winner,true)}</span>`:''}`,result:g?`${team(g.home,true)} <span class="score-mini">${score(g)}</span> ${team(g.away,true)}${g.advancer?` <span class="adv-mini">avançou ${team(g.advancer,true)}</span>`:''}`:(x.result_in_pdf||'—'),status:x.status,points:x.points||0,official:g?`${team(g.home,true)} <b class="x">x</b> ${team(g.away,true)}`:(x.official||`#${x.game_id}`)}); }
  }
  return rows;
}
function scorePairHTML(home,away,scoreText){ return `${home?team(home,true):''} <span class="score-mini">${esc(scoreText||'—')}</span> ${away?team(away,true):''}`; }
function renderPalpites(){
  $('palpitePhase').innerHTML = allPhases.map(p=>`<option value="${p}">${phaseLabel(p)}</option>`).join('');
  const pSelect = $('palpiteParticipant');
  if(pSelect) pSelect.innerHTML = '<option value="Todos">Todos os apostadores</option>' + CALC.ranking.map(r=>`<option value="${r.entry_id}">${r.posicao}º · ${esc(r.display_name)} · ${r.total} pts</option>`).join('');
  $('palpiteTeam').innerHTML = `<option value="Todas">Todas as seleções</option>` + DATA.times.map(t=>`<option value="${t.code}">${t.flag} ${esc(t.name)}</option>`).join('');
  $('palpiteStatus').innerHTML = ['Todos','cravada','placar exato','vencedor/empate','confronto correto','classificado correto','confronto + classificado','erro','pendente'].map(s=>`<option value="${s}">${s}</option>`).join('');
  const allRows = buildPalpiteRows();
  const draw = ()=>{
    const q = $('palpiteSearch').value.toLowerCase().trim();
    const selectedParticipant = pSelect ? pSelect.value : 'Todos';
    const teamCode = $('palpiteTeam').value;
    const phase = $('palpitePhase').value;
    const game = $('palpiteGame').value.trim().replace('#','');
    const status = $('palpiteStatus').value;
    const rowMatches = x => (!q || x.participant.toLowerCase().includes(q))
      && (teamCode==='Todas' || x.teams.includes(teamCode))
      && (phase==='Todas' || x.phase===phase)
      && (!game || String(x.game_id)===game)
      && statusFilterOk(x,status);
    const filteredRows = allRows.filter(rowMatches);
    const showParticipant = r => {
      if(selectedParticipant !== 'Todos' && String(r.entry_id)!==String(selectedParticipant)) return false;
      if(q && !r.display_name.toLowerCase().includes(q)) return false;
      const rows = filteredRows.filter(x=>x.entry_id===r.entry_id);
      if(game || phase!=='Todas' || status!=='Todos') return rows.length>0;
      if(teamCode!=='Todas') return rows.length>0 || finalTeamCodes(r).includes(teamCode);
      return true;
    };
    const cards = CALC.ranking.filter(showParticipant).map(r=>palpiteParticipantCard(r, filteredRows.filter(x=>x.entry_id===r.entry_id), {selectedParticipant, q, teamCode, phase, game, status}));
    $('palpitesCount').textContent = `${fmt.format(cards.length)} apostador(es) · ${fmt.format(filteredRows.length)} palpite(s) nos filtros`;
    $('palpitesBody').innerHTML = cards.join('') || `<div class="empty-state big-empty">Nenhum palpite encontrado.</div>`;
    bindOpeners();
  };
  ['palpiteSearch','palpiteParticipant','palpiteTeam','palpitePhase','palpiteGame','palpiteStatus'].forEach(id=>$(id)?.addEventListener('input', draw));
  draw();
}
function palpiteCardBase44(x){
  const pts = Number(x.points||0);
  const cls = pts>0?'hit':'miss';
  const status = String(x.status||'pendente');
  return `<details class="palpite-line-card ${cls}">
    <summary>
      <div class="palpite-person">
        <strong>${esc(x.participant)}</strong>
        <small>#${x.game_id} · ${phaseLabel(x.phase)}</small>
      </div>
      <div class="palpite-match">${x.official}</div>
      <div class="palpite-status-compact">${badge(status)}</div>
      <div class="palpite-score-compact"><b>${pts}</b><small>pts</small></div>
      <span class="expand-hint">Ver detalhes</span>
    </summary>
    <div class="palpite-detail-clean">
      <section><span>Palpite</span><b>${x.palpite}</b></section>
      <section><span>Resultado oficial</span><b>${x.result}</b></section>
      <section><span>Explicação</span><p>${esc(explainPalpiteRow(x))}</p></section>
      <button class="btn tiny" data-open-entry="${x.entry_id}">Abrir conferência do participante</button>
    </div>
  </details>`;
}
function explainPalpiteRow(x){
  if(String(x.status||'').toLowerCase().includes('pendente')) return 'Jogo ainda sem resultado oficial computado.';
  if(Number(x.points||0)===0) return 'Este palpite não gerou ponto neste jogo/fase.';
  if(x.type==='grupo') return x.points===5 ? 'Placar exato na fase de grupos: 5 pontos.' : 'Vencedor ou empate correto na fase de grupos: 3 pontos.';
  const bits=[];
  const status=String(x.status||'');
  if(status.includes('confronto')) bits.push('confronto correto');
  if(status.includes('classificado')) bits.push('classificado/avanço correto');
  if(status.includes('placar')) bits.push('placar exato válido no mata-mata');
  return bits.length ? `Pontuou por ${bits.join(' + ')}.` : 'Sem pontuação neste jogo.';
}

function renderResults(){
  $('resultPhase').innerHTML = allPhases.map(p=>`<option value="${p}">${phaseLabel(p)}</option>`).join('');
  const draw=()=>{ const phase=$('resultPhase').value, status=$('resultStatus').value, q=$('resultSearch').value.toLowerCase().trim(); const games = DATA.resultados.filter(g=>{ const text = `${g.game_id} ${g.home} ${g.away} ${g.home_name} ${g.away_name}`.toLowerCase(); const statusOk = status==='Todos' || (status==='Finalizado' && isPlayed(g)) || (status==='Pendente' && isPending(g)) || (status==='Penaltis' && isPenaltyGame(g)); return (phase==='Todas' || g.phase===phase) && statusOk && (!q || text.includes(q.replace('#',''))); }).sort((a,b)=>a.game_id-b.game_id); $('games').innerHTML = games.map(gameCard).join('') || `<div class="empty-state big-empty">Nenhum jogo encontrado para os filtros.</div>`; };
  ['resultPhase','resultStatus','resultSearch'].forEach(id=>$(id).addEventListener('input', draw)); draw();
}
function gameCard(g){ const played = isPlayed(g), penalty = isPenaltyGame(g); return `<article class="game-card ${played?'finalizado':'pendente'}"><div class="phase"><span>#${g.game_id} · ${phaseLabel(g.phase)}${g.group?` · Grupo ${g.group}`:''}</span><span>${played?'Concluído':'Pendente'}</span></div><div class="score-line"><div class="team-side">${team(g.home)}</div><div class="score-main">${score(g)}</div><div class="team-side away">${team(g.away)}</div></div><div class="game-meta"><span>${esc(g.date_time || 'Data a definir')}</span><span>${esc((g.location || '') + (g.stadium ? ` · ${g.stadium}`:''))}</span></div><div class="status-row">${played ? `<span class="pill good">Computado</span>` : `<span class="pill warn">Sem resultado</span>`}${penalty ? `<span class="pill pen">Pênaltis</span>` : ''}${g.advancer ? `<span class="pill good">Classificado: ${team(g.advancer,true)}</span>` : ''}</div></article>`; }
function gameRow(g){ return `<div class="game-row"><div class="match-no">#${g.game_id}</div><div><div class="teams">${team(g.home,true)} <b class="x">x</b> ${team(g.away,true)}</div><small>${phaseLabel(g.phase)}${g.advancer?` · classificado: ${team(g.advancer,true)}`:''}</small></div><div class="score-badge">${score(g)}</div></div>`; }

function renderParticipantSelectors(){ const options = participantsOptions(); $('participantSelect').innerHTML = options; $('participantSelect').addEventListener('change', e=> renderParticipantDetail(Number(e.target.value))); }
function openParticipant(id){ const r = CALC.ranking.find(x=>x.entry_id===id); if(!r) return; $('modalTitle').textContent = r.display_name; $('modalSub').textContent = `${r.posicao}º lugar · ${r.total} pontos · ${cravadasGrupo(r)} cravadas de grupos + ${cravadasMata(r)} de mata-mata`; $('modalBody').innerHTML = participantDetailHTML(id, true); bindDetailTabs(id, $('modalBody')); $('participantModal').showModal(); }
function renderParticipantDetail(id){ const box = $('participantDetail'); if(!id){ box.className='participant-detail empty-state'; box.textContent='Selecione um participante para conferir a pontuação.'; return; } box.className = 'participant-detail'; box.innerHTML = participantDetailHTML(id, false); bindDetailTabs(id, box); }
function participantDetailHTML(id, modal){
  const r = CALC.ranking.find(x=>x.entry_id===id), d=detailsByEntry[id]; if(!r||!d) return '<div class="empty-state">Participante não encontrado.</div>';
  const b=phaseBreakdown(id), tabs=[['resumo','Resumo'],['pontos','Jogos que pontuaram'],['erros','Jogos sem ponto'],['grupos','Grupos'],['mata','Mata-mata'],['classificados','Classificados'],['cravadas','Cravadas'],['finais','Finais']];
  return `<div class="summary-grid"><div class="summary-card"><span>Posição</span><b>${r.posicao}º</b></div><div class="summary-card"><span>Total</span><b>${r.total}</b></div><div class="summary-card"><span>Jogos de grupo</span><b>${r.grupos_jogos}</b></div><div class="summary-card"><span>Classificados</span><b>${r.classificados}</b></div><div class="summary-card"><span>Mata-mata</span><b>${r.mata_mata}</b></div><div class="summary-card"><span>Cravadas totais</span><b>${cravadasTotal(r)}</b></div></div><div class="sum-proof"><strong>Prova da soma:</strong> ${r.grupos_jogos} jogos de grupo + ${r.classificados} classificados + ${r.ko_confronto} confronto + ${r.ko_avanco} avanço + ${r.ko_placar} bônus de placar no mata-mata + ${r.bonus||0} bônus = <b>${r.total}</b><br><strong>Cravadas:</strong> ${cravadasGrupo(r)} grupos + ${cravadasMata(r)} mata-mata (${r.ko_placar||0} pontos de bônus) = <b>${cravadasTotal(r)}</b> para estatísticas.</div><div class="phase-mini-grid">${koPhases.map(ph=>`<div><span>${phaseLabel(ph)}</span><b>${b[ph]?.total||0}</b><small>${b[ph]?.jogos||0} jogos · ${b[ph]?.avanco||0} avanço · ${b[ph]?.bonus||0} bônus</small></div>`).join('')}</div><div class="detail-actions"><button class="btn tiny" data-copy-summary="${id}">Copiar resumo</button>${modal?'<button class="btn tiny ghost-dark" data-go-detail="conferencia">Abrir na conferência</button>':''}</div><div class="detail-tabs">${tabs.map(([key,label])=>`<button class="${currentDetailTab===key?'active':''}" data-detail-tab="${key}">${label}</button>`).join('')}</div><div class="detailTabContent">${detailTabContent(r,d,currentDetailTab)}</div>`;
}
function bindDetailTabs(id, root){ root.querySelectorAll('[data-detail-tab]').forEach(btn=>btn.onclick=()=>{ currentDetailTab=btn.dataset.detailTab; if(root.id==='modalBody') openParticipant(id); else renderParticipantDetail(id); }); root.querySelector('[data-copy-summary]')?.addEventListener('click',()=>copyParticipantSummary(id)); root.querySelector('[data-go-detail]')?.addEventListener('click',()=>{ $('participantModal').close(); showPage('conferencia'); $('participantSelect').value=id; renderParticipantDetail(id); }); }
function detailTabContent(r,d,tab){
  const groupRows=(d.group_predictions||[]).map(x=>detailRowGroup(x)); const koRows=(d.knockout_predictions||[]).map(x=>detailRowKO(x)); const allRows=[...groupRows,...koRows];
  if(tab==='resumo') return `<div class="rules-grid compact"><article><strong>Classificados corretos</strong><p>${r.classificados_acertos} seleções · ${r.classificados} pontos</p></article><article><strong>Mata sem classificados</strong><p>${r.ko_confronto + r.ko_placar} pontos</p></article><article><strong>Pontos por avanço</strong><p>${r.ko_avanco} pontos</p></article><article><strong>Cravadas de grupos</strong><p>${cravadasGrupo(r)} · valem 5 pontos</p></article><article><strong>Cravadas de mata-mata</strong><p>${cravadasMata(r)} · ${r.ko_placar} pontos de bônus</p></article><article><strong>Total estatístico</strong><p>${cravadasTotal(r)} cravadas</p></article></div><h4>Atalho de conferência</h4><p class="muted-text">Abra as abas “Jogos que pontuaram”, “Jogos sem ponto” e “Cravadas” para ver a origem de cada ponto.</p>`;
  if(tab==='pontos') return rowsTable(allRows.filter(x=>Number(x.points)>0));
  if(tab==='erros') return rowsTable(allRows.filter(x=>Number(x.points)===0));
  if(tab==='grupos') return rowsTable(groupRows);
  if(tab==='mata') return rowsTable(koRows);
  if(tab==='classificados') return classifiedHTML(d);
  if(tab==='cravadas') return exactHTML(d);
  const f=r.finals||{}; return `<div class="rules-grid compact"><article><strong>Campeão</strong><p>${esc(safe(f.campeao))}</p></article><article><strong>Vice</strong><p>${esc(safe(f.vice))}</p></article><article><strong>3º lugar</strong><p>${esc(safe(f.terceiro))}</p></article><article><strong>4º lugar</strong><p>${esc(safe(f.quarto))}</p></article><article><strong>Artilheiro</strong><p>${esc(safe(f.artilheiro))}</p></article></div>`;
}
function detailRowGroup(x){ const g=gamesById[x.game_id]; return {kind:'Grupo', game_id:x.game_id, official: g?`${team(g.home,true)} x ${team(g.away,true)}`:`#${x.game_id}`, pred:scorePairHTML(g?.home,g?.away,x.prediction), result:scorePairHTML(g?.home,g?.away,x.result||score(g)), status:x.status, points:x.points||0, reason:reasonFor(x.status,x.points)}; }
function detailRowKO(x){ const g=gamesById[x.game_id]; return {kind:phaseLabel(phaseKey(x.game_id)), game_id:x.game_id, official:g?`${team(g.home,true)} x ${team(g.away,true)}`:(x.official||`#${x.game_id}`), pred:`${matchHTML(x.prediction_match)} <span class="score-mini">${esc(x.prediction_score||'—')}</span>${x.predicted_winner?` <span class="adv-mini">avança ${team(x.predicted_winner,true)}</span>`:''}`, result:g?`${team(g.home,true)} <span class="score-mini">${score(g)}</span> ${team(g.away,true)}${g.advancer?` <span class="adv-mini">avançou ${team(g.advancer,true)}</span>`:''}`:esc(x.result_in_pdf||'—'), status:x.status, points:x.points||0, reason:koReason(x)}; }
function rowsTable(rows){ return `<div class="table-wrap"><table class="mini-table"><thead><tr><th>Fase</th><th>Jogo oficial</th><th>Palpite</th><th>Resultado</th><th>Status</th><th>Motivo</th><th>Pts</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.kind)}</td><td>#${x.game_id}<br><small>${x.official}</small></td><td>${x.pred}</td><td>${x.result||'—'}</td><td>${badge(x.status)}</td><td>${esc(x.reason)}</td><td class="num total">${x.points||0}</td></tr>`).join('') || `<tr><td colspan="7" class="empty-state">Nenhum item encontrado.</td></tr>`}</tbody></table></div>`; }
function classifiedHTML(d){ const pred=d.predicted_qualified||[], hits=new Set(d.classified_hits||[]); return `<div class="chips classified-chips">${pred.map(c=>`<span class="chip ${hits.has(c)?'hit':'miss'}">${team(c,true)} ${hits.has(c)?'✅ +5':'—'}</span>`).join('') || '<span class="empty-state">Sem classificados apostados.</span>'}</div>`; }
function exactHTML(d){ const rows=(d.exact_rows||[]).map(x=>{ const g=gamesById[x.game_id]; const isKo=String(x.kind||'').toLowerCase().includes('mata'); return `<div class="game-row exact-row ${isKo?'ko-exact':''}"><div class="match-no">#${x.game_id}</div><div><div>${team(g?.home,true)} <b class="x">x</b> ${team(g?.away,true)}</div><small><b>Palpite:</b> ${esc(x.prediction||'—')} · <b>Real:</b> ${esc(x.result||score(g))} · ${esc(x.kind)} · ${x.points} ponto(s)</small><small>${isKo?'🎯 Cravada de mata-mata · +3 pontos de bônus':esc(x.reason||'Placar exato pontuado')}</small></div><div class="score-badge target">🎯</div></div>`; }).join(''); return rows || '<div class="empty-state">Nenhuma cravada pontuada.</div>'; }
function reasonFor(status, points){ if(points===5) return 'Placar exato na fase de grupos (+5)'; if(points===3) return 'Vencedor ou empate correto (+3)'; return 'Palpite não coincidiu com o resultado'; }
function koReason(x){ const bits=[]; if(x.points_confronto) bits.push('confronto correto +5'); if(x.points_avanco) bits.push('avanço correto +5'); if(x.points_placar) bits.push('placar exato +3'); return bits.join('; ') || 'Sem ponto neste jogo/fase'; }
function copyParticipantSummary(id){ const r=CALC.ranking.find(x=>x.entry_id===id); if(!r) return; const text = `${r.display_name}: ${r.total} pts\nJogos de grupo: ${r.grupos_jogos}\nClassificados: ${r.classificados}\nMata-mata: ${r.mata_mata}\nCravadas de grupos: ${cravadasGrupo(r)}\nCravadas de mata-mata: ${cravadasMata(r)}\nCravadas totais: ${cravadasTotal(r)}`; navigator.clipboard?.writeText(text); toast('Resumo copiado.'); }

function renderStats(){
  const st=liveStats(), cr=cravadaStats();
  $('statsUpdate').textContent = resultUpdateShort();
  $('statsCards').innerHTML = `
    <section class="panel stats-card"><h4>🎯 Apostas consideradas</h4><b>${st.valid}</b><p>Participantes no ranking</p></section>
    <section class="panel stats-card"><h4>⚽ Jogos computados</h4><b>${st.played}</b><p>${st.pending} pendentes</p></section>
    <section class="panel stats-card"><h4>📊 Média de pontos</h4><b>${st.avgPoints.toFixed(1)}</b><p>Pontos totais ÷ apostas válidas</p></section>
    <section class="panel stats-card"><h4>🏆 Maior pontuação</h4><b>${st.leader.total||0} pts</b><p>${esc(st.leader.display_name||'—')}</p></section>
    <section class="panel stats-card"><h4>🎯 Cravadas de grupos</h4><b>${cr.groupTotal}</b><p>Placar exato valendo 5 pontos</p></section>
    <section class="panel stats-card"><h4>⭐ Cravadas de mata-mata</h4><b>${cr.koTotal}</b><p>Bônus de placar valendo 3 pontos</p></section>
    <section class="panel stats-card"><h4>✅ Cravadas totais</h4><b>${cr.total}</b><p>Indicador estatístico: grupos + mata-mata</p></section>
    <section class="panel stats-card"><h4>👑 Rei das cravadas totais</h4><b>${cravadasTotal(cr.kingTotal)||0}</b><p>${esc(cr.kingTotal.display_name||'—')}</p></section>
    <section class="panel stats-card"><h4>🎲 % médio de acerto</h4><b>${st.hitRate.toFixed(1)}%</b><p>Acertos em jogos de grupo computados</p></section>`;
  renderRegularStats(); renderFeaturedStats(); renderPhaseSummaryStats(); renderPhaseStats(); renderTeamPhaseStats(); renderFinalsStats(); renderScorerStats(); renderExactStats(); renderHardEasyGames(); renderGameAnalysisStats(); renderEvolution(); bindStatsTabs(); bindFinalSwitches();
}
function bindStatsTabs(){ document.querySelectorAll('[data-stat-tab]').forEach(btn=>{ btn.onclick=()=>{ document.querySelectorAll('[data-stat-tab]').forEach(b=>b.classList.toggle('active', b===btn)); document.querySelectorAll('.stat-tab').forEach(t=>t.classList.remove('active')); $(`stat-${btn.dataset.statTab}`)?.classList.add('active'); }; }); }
function bindFinalSwitches(){ document.querySelectorAll('[data-final-view]').forEach(btn=>{ btn.onclick=()=>{ document.querySelectorAll('[data-final-view]').forEach(b=>b.classList.toggle('active', b===btn)); renderFinalsStats(btn.dataset.finalView); }; }); }
function renderRegularStats(){
  const groupGames = DATA.resultados.filter(g=>g.phase==='Fase de Grupos' && isPlayed(g)).length || 72;
  const rows = CALC.ranking.map(r=>{ const d=detailsByEntry[r.entry_id]; const hits=(d?.group_predictions||[]).filter(x=>Number(x.points||0)>0).length; return {r,hits,pct:groupGames?hits/groupGames*100:0}; }).sort((a,b)=>b.hits-a.hits || b.r.cravadas-a.r.cravadas || a.r.posicao-b.r.posicao).slice(0,5);
  $('regularStats').innerHTML = rows.map((x,i)=>`<div class="stat-rank-line"><b>${i+1}º</b><span>${esc(x.r.display_name)}<small>Pontuou em ${x.hits}/${groupGames} jogos finalizados · ${x.r.cravadas} cravadas</small></span><strong>${x.pct.toFixed(0)}%</strong></div>`).join('');
}
function renderFeaturedStats(){
  const top=CALC.ranking[0]||{};
  const cr=cravadaStats();
  const groupOnly=[...CALC.ranking].sort((a,b)=>b.grupos_jogos-a.grupos_jogos || a.posicao-b.posicao)[0]||{};
  const groupClass=[...CALC.ranking].sort((a,b)=>b.grupos-a.grupos || a.posicao-b.posicao)[0]||{};
  const classif=[...CALC.ranking].sort((a,b)=>b.classificados-a.classificados || a.posicao-b.posicao)[0]||{};
  const cards=[['👑','REI DO BOLÃO',top.display_name,`Líder geral · ${top.total||0} pts · ${top.posicao||'—'}º`],['🎯','REI DAS CRAVADAS DE GRUPOS',cr.kingGroup.display_name,`${cravadasGrupo(cr.kingGroup)||0} placares exatos · valem 5 pts`],['⭐','REI DAS CRAVADAS DE MATA-MATA',cr.kingKo.display_name,`${cravadasMata(cr.kingKo)||0} bônus de placar · valem 3 pts`],['⚡','REI DAS CRAVADAS TOTAIS',cr.kingTotal.display_name,`${cravadasTotal(cr.kingTotal)||0} cravadas estatísticas`],['📚','PROFESSOR DA FASE DE GRUPOS',groupOnly.display_name,`Melhor em jogos de grupo · ${groupOnly.grupos_jogos||0} pts`],['🦁','REI DA FASE DE GRUPOS',groupClass.display_name,`Jogos + classificados · ${groupClass.grupos||0} pts`],['🧙','MAGO DOS CLASSIFICADOS',classif.display_name,`${classif.classificados_acertos||0}/32 classificados · ${classif.classificados||0} pts`]];
  $('featuredStats').innerHTML = cards.map(c=>`<article><span>${c[0]}</span><div><small>${esc(c[1])}</small><b>${esc(c[2]||'—')}</b><p>${esc(c[3]||'')}</p></div></article>`).join('');
}
function renderPhaseSummaryStats(){
  const games=gameAccuracyStats();
  const group=games.filter(g=>g.phase==='Fase de Grupos');
  const ko=games.filter(g=>g.game_id>=73);
  const easiest=[...group].sort((a,b)=>b.acertos-a.acertos || b.cravadas-a.cravadas)[0];
  const hardest=[...group].sort((a,b)=>a.acertos-b.acertos || a.cravadas-b.cravadas)[0];
  const phaseCards=[`<article class="phase-summary-card"><h4>⚽ Fase de Grupos</h4><div class="stat-line"><span>Jogos encerrados</span><b>${group.length}/72</b></div><div class="stat-line"><span>Média de acerto por jogo</span><b>${avgAccuracy(group).toFixed(1)}%</b></div><div class="stat-line"><span>Jogo mais fácil</span><b>${easiest?team(easiest.home,true)+' '+score(easiest)+' '+team(easiest.away,true):'—'}</b></div><div class="stat-line"><span>Jogo mais difícil</span><b>${hardest?team(hardest.home,true)+' '+score(hardest)+' '+team(hardest.away,true):'—'}</b></div></article>`, `<article class="phase-summary-card"><h4>⚔️ Mata-mata</h4><div class="stat-line"><span>Confrontos encerrados</span><b>${ko.length}/32</b></div><div class="stat-line"><span>Taxa de acerto de classificados</span><b>${avgAccuracy(ko).toFixed(1)}%</b></div><div class="stat-line"><span>Confronto mais acertado</span><b>${ko.length ? gameLabel([...ko].sort((a,b)=>b.acertos-a.acertos)[0]) : '—'}</b></div><div class="stat-line"><span>Campeão mais escolhido</span><b>${topMapLabel(finalPositionMap('campeao'))}</b></div></article>`];
  $('phaseSummaryStats').innerHTML = phaseCards.join('');
}
function avgAccuracy(list){ const st=liveStats(); return list.length && st.valid ? list.reduce((s,g)=>s+g.acertos,0)/(list.length*st.valid)*100 : 0; }
function gameLabel(g){ return g ? `${teamName(g.home)} x ${teamName(g.away)}` : '—'; }
function topMapLabel(map){ const e=Object.entries(map||{}).sort((a,b)=>b[1].length-a[1].length)[0]; return e ? `${teamName(e[0])} (${e[1].length}x)` : '—'; }
function renderGameAnalysisStats(){
  const games=gameAccuracyStats().sort((a,b)=>a.game_id-b.game_id); const st=liveStats();
  $('gameAnalysisCount').textContent = `${games.length} jogos finalizados · ${st.valid} apostas consideradas`;
  $('gameAnalysisStats').innerHTML = `<div class="info-note">Nas estatísticas, chamamos de cravada todo placar exato. Na fase de grupos, a cravada vale 5 pontos. No mata-mata, o placar exato é um bônus de 3 pontos e só conta quando o confronto e o classificado também estão corretos.</div>` + games.map(g=>{
    const isKo=g.game_id>=73;
    return `<details class="analysis-game-card"><summary><span class="game-no">M${g.game_id}</span><span class="phase-pill">${phaseLabel(g.phase).replace('Fase de Grupos','Grupo '+(g.group||''))}</span><span class="analysis-match">${team(g.home,true)} <b>${score(g)}</b> ${team(g.away,true)}</span><span>${isKo?'Confronto':'Acertos'}: <b>${isKo?g.confrontoAcertos:g.acertos}/${st.valid}</b></span><span>${isKo?'Cravadas MM':'Cravadas'}: <b>${g.cravadas}/${st.valid}</b></span><strong class="${g.acertos/st.valid>.6?'green':'red'}">${(g.acertos/st.valid*100).toFixed(1)}%</strong><span>Ver detalhes</span></summary><p><b>${isKo?'Acertadores do confronto':'Acertadores'}:</b> ${(isKo?g.confrontoAcertadores:g.acertadores).map(esc).join(', ') || 'ninguém'}</p>${isKo?`<p><b>Acertadores do classificado:</b> ${g.classificadoAcertadores.map(esc).join(', ') || 'ninguém'}</p>`:''}<p><b>Cravadas:</b> ${g.cravadores.map(esc).join(', ') || 'nenhuma'}</p>${isKo?`<p><b>Pontos gerados por bônus de placar:</b> ${g.cravadas} × 3 = ${g.cravadas*3} pts</p>`:''}</details>`;
  }).join('');
}
function renderPhaseStats(){ $('phaseStats').innerHTML = phasesWithResults().map(ph=>{ const participantRows = CALC.ranking.map(r=>({r, pts: ph==='Fase de Grupos' ? r.grupos : (phaseBreakdown(r.entry_id)[ph]?.total||0)})).sort((a,b)=>b.pts-a.pts || a.r.display_name.localeCompare(b.r.display_name,'pt-BR')); const selectionMap = ph==='Fase de Grupos' ? selectionMapFromQualified() : selectionMapFromPredictedWinners(ph); return `<div class="phase-box"><h4>${phaseLabel(ph)}</h4><div class="phase-columns"><div class="mini-box"><h5>Participantes</h5>${participantRows.map(({r,pts},i)=>`<details><summary><span>${i+1}. ${esc(r.display_name)}</span><b>${pts}</b></summary>${phaseParticipantDetails(r.entry_id, ph)}</details>`).join('')}</div><div class="mini-box"><h5>Seleções apostadas</h5>${selectionDetailsList(selectionMap)}</div></div></div>`; }).join(''); }
function phaseParticipantDetails(id, ph){ const d=detailsByEntry[id]; if(ph==='Fase de Grupos') return `<p>${groupGamePoints(id)} pontos em jogos + ${CALC.ranking.find(r=>r.entry_id===id)?.classificados||0} em classificados.</p>`; const rows=(d.knockout_predictions||[]).filter(x=>phaseKey(x.game_id)===ph); return `<ul class="plain-list">${rows.map(x=>`<li>#${x.game_id}: ${matchHTML(x.prediction_match)} ${esc(x.prediction_score||'')} · ${badgeText(x.status)} · ${x.points||0} pts</li>`).join('')}</ul>`; }
function selectionMapFromQualified(){ const m={}; for(const r of CALC.ranking){ for(const code of detailsByEntry[r.entry_id]?.predicted_qualified||[]){ (m[code] ||= []).push(r.display_name); } } return m; }
function selectionMapFromPredictedWinners(ph){ const m={}; for(const r of CALC.ranking){ const set=new Set(); for(const x of detailsByEntry[r.entry_id]?.knockout_predictions||[]){ if(phaseKey(x.game_id)===ph && x.predicted_winner) set.add(x.predicted_winner); } for(const code of set) (m[code] ||= []).push(r.display_name); } return m; }
function selectionDetailsList(map){ return Object.entries(map).sort((a,b)=>b[1].length-a[1].length || teamName(a[0]).localeCompare(teamName(b[0]),'pt-BR')).map(([code,names])=>`<details><summary><span>${teamMap[code]?team(code,true):esc(code)}</span><b>${names.length}</b></summary><p>${names.map(esc).join(', ')}</p></details>`).join('') || `<div class="empty-state">Sem dados.</div>`; }
function renderTeamPhaseStats(){ const cards=[['Aos 1/16 avos', selectionMapFromQualified()], ['Às oitavas', selectionMapFromPredictedWinners('Rodada de 32')], ['Às quartas', selectionMapFromPredictedWinners('Oitavas de Final')], ['À semifinal', selectionMapFromPredictedWinners('Quartas de Final')], ['À final', selectionMapFromPredictedWinners('Semifinais')], ['Como campeã', finalPositionMap('campeao')]]; $('teamPhaseStats').innerHTML = cards.map(([title,map])=>`<section class="stat-tile"><h4>${title}</h4>${selectionDetailsList(map)}</section>`).join(''); }
function finalPositionMap(pos){ const m={}; for(const r of CALC.ranking){ const name=r.finals?.[pos]; const code=teamCodeFromName(name); if(code) (m[code] ||= []).push(r.display_name); else if(name) (m[name] ||= []).push(r.display_name); } return m; }
function teamCodeFromName(name){ if(!name) return null; const t=DATA.times.find(t=>t.name.toLowerCase()===String(name).toLowerCase() || t.code===name); return t?.code || null; }
function renderFinalsStats(pos='campeao'){ const labels={campeao:'Campeão',vice:'Vice',terceiro:'3º lugar',quarto:'4º lugar'}; if(pos==='artilheiro'){ $('finalsStats').style.display='none'; $('scorerStats').style.display='grid'; renderScorerStats(); return; } $('finalsStats').style.display='grid'; $('scorerStats').style.display='none'; $('finalsStats').innerHTML = `<section class="stat-tile final-wide"><h4>${labels[pos]||'Campeão'}</h4>${barsFromMap(finalPositionMap(pos))}</section>`; }
function barsFromMap(map){ const entries=Object.entries(map).sort((a,b)=>b[1].length-a[1].length); const max=Math.max(1,...entries.map(e=>e[1].length)); return entries.map(([code,names])=>`<details class="bar-detail"><summary><span>${teamMap[code]?team(code,true):esc(code)}</span><b>${names.length}</b></summary><div class="bar"><i style="width:${Math.round((names.length/max)*100)}%"></i></div><p>${names.map(esc).join(', ')}</p></details>`).join('') || '<div class="empty-state">Sem apostas.</div>'; }
function renderScorerStats(){ const m={}; for(const r of CALC.ranking){ const name=r.finals?.artilheiro; if(name) (m[name] ||= []).push(r.display_name); } $('scorerStats').innerHTML = `<section class="stat-tile final-wide"><h4>Artilheiro</h4>${Object.entries(m).sort((a,b)=>b[1].length-a[1].length || a[0].localeCompare(b[0],'pt-BR')).map(([name,names])=>`<details class="list-detail"><summary><span>${esc(name)}</span><b>${names.length}</b></summary><p>${names.map(esc).join(', ')}</p></details>`).join('')}</section>`; }
function renderExactStats(){
  const cr=cravadaStats();
  const groupRanking=[...CALC.ranking].sort((a,b)=>cravadasGrupo(b)-cravadasGrupo(a) || a.posicao-b.posicao);
  const koRanking=[...CALC.ranking].sort((a,b)=>cravadasMata(b)-cravadasMata(a) || a.posicao-b.posicao);
  const totalRanking=[...CALC.ranking].sort((a,b)=>cravadasTotal(b)-cravadasTotal(a) || a.posicao-b.posicao);
  const games=gameAccuracyStats();
  const mostGroup=games.filter(g=>g.game_id<=72 && g.cravadas>0).sort((a,b)=>b.cravadas-a.cravadas).slice(0,8);
  const mostKo=games.filter(g=>g.game_id>=73 && g.cravadas>0).sort((a,b)=>b.cravadas-a.cravadas).slice(0,8);
  const phaseMap={}; for(const g of games){ phaseMap[phaseLabel(g.phase)] = (phaseMap[phaseLabel(g.phase)]||0)+g.cravadas; }
  $('exactStats').innerHTML = `<section class="stat-tile exact-explainer"><h4>Como ler as cravadas</h4><p>Na fase de grupos, cravada é placar exato e vale 5 pontos. No mata-mata, cravada é placar exato válido e vira bônus de 3 pontos, desde que confronto e classificado também estejam corretos.</p><div class="stat-line"><span>Total grupos</span><b>${cr.groupTotal}</b></div><div class="stat-line"><span>Total mata-mata</span><b>${cr.koTotal}</b></div><div class="stat-line"><span>Total estatístico</span><b>${cr.total}</b></div></section>${exactRankingSection('Ranking de cravadas de grupos', groupRanking, 'grupo')}${exactRankingSection('Ranking de cravadas de mata-mata', koRanking, 'mata')}${exactRankingSection('Ranking de cravadas totais', totalRanking, 'total')}<section class="stat-tile"><h4>Jogos com mais cravadas de grupos</h4>${mostGroup.map(g=>exactGameDetails(g)).join('') || '<div class="empty-state">Sem cravadas de grupos.</div>'}</section><section class="stat-tile"><h4>Jogos com mais cravadas de mata-mata</h4>${mostKo.map(g=>exactGameDetails(g)).join('') || '<div class="empty-state">Sem cravadas de mata-mata.</div>'}</section><section class="stat-tile"><h4>Cravadas por fase</h4>${Object.entries(phaseMap).map(([ph,n])=>`<div class="stat-line"><span>${ph}</span><b>${n}</b></div>`).join('')}</section>`;
}
function gameAccuracyStats(){
  return DATA.resultados.filter(isPlayed).map(g=>{
    const acertadores=[], cravadores=[], confrontoAcertadores=[], classificadoAcertadores=[];
    for(const r of CALC.ranking){
      const d=detailsByEntry[r.entry_id]; let item;
      if(g.game_id<=72){
        item=(d.group_predictions||[]).find(x=>x.game_id===g.game_id);
        if(item?.points>0) acertadores.push(r.display_name);
        if(item?.status==='placar exato') cravadores.push(r.display_name);
      } else {
        item=(d.knockout_predictions||[]).find(x=>x.game_id===g.game_id);
        if(item?.points>0) acertadores.push(r.display_name);
        if(item?.points_confronto>0) confrontoAcertadores.push(r.display_name);
        if(item?.points_avanco>0) classificadoAcertadores.push(r.display_name);
        if(item?.points_placar>0) cravadores.push(r.display_name);
      }
    }
    return {...g, acertadores, cravadores, confrontoAcertadores, classificadoAcertadores, acertos:acertadores.length, confrontoAcertos:confrontoAcertadores.length, classificadoAcertos:classificadoAcertadores.length, cravadas:cravadores.length};
  });
}
function renderHardEasyGames(){ const groupGames = gameAccuracyStats().filter(g=>g.phase==='Fase de Grupos'), hard=[...groupGames].sort((a,b)=>a.acertos-b.acertos || a.cravadas-b.cravadas).slice(0,5), easy=[...groupGames].sort((a,b)=>b.acertos-a.acertos || b.cravadas-a.cravadas).slice(0,8); $('hardGames').innerHTML = hard.map(gameStatCard).join(''); $('easyGames').innerHTML = easy.map(gameStatCard).join(''); }
function gameStatCard(g){ const isKo=g.game_id>=73; return `<details class="game-row expandable"><summary><div class="match-no">#${g.game_id}</div><div><div class="teams">${team(g.home,true)} <b class="x">x</b> ${team(g.away,true)} · ${score(g)}</div><small>${g.acertos} acertadores · ${g.cravadas} ${isKo?'cravadas de mata-mata':'cravadas'}</small></div><div class="score-badge">${g.acertos}</div></summary><p><b>Acertadores:</b> ${g.acertadores.map(esc).join(', ') || 'ninguém'}</p><p><b>Cravadas:</b> ${g.cravadores.map(esc).join(', ') || 'nenhuma'}</p></details>`; }


function evolutionSnapshots(){
  const playedIds = DATA.resultados.filter(isPlayed).map(g=>g.game_id);
  const maxPlayed = Math.max(...playedIds, 0);
  const milestones = [
    {label:'Após 1ª rodada dos grupos', maxGroup:24, maxGame:24, includeClass:false},
    {label:'Após 2ª rodada dos grupos', maxGroup:48, maxGame:48, includeClass:false},
    {label:'Fim da fase de grupos', maxGroup:72, maxGame:72, includeClass:true},
    {label:'Após 1/16 avos', maxGroup:72, maxGame:88, includeClass:true},
    {label:'Após oitavas', maxGroup:72, maxGame:96, includeClass:true},
    {label:'Após quartas', maxGroup:72, maxGame:100, includeClass:true},
    {label:'Após semifinais', maxGroup:72, maxGame:102, includeClass:true},
    {label:'Após final', maxGroup:72, maxGame:104, includeClass:true}
  ].filter(m=>maxPlayed>=m.maxGame || (m.maxGame<=96 && DATA.resultados.some(g=>g.game_id<=m.maxGame && isPlayed(g))));
  return milestones.map(m=>{
    const rows = CALC.ranking.map(r=>{
      const d=detailsByEntry[r.entry_id]||{};
      const group=(d.group_predictions||[]).filter(x=>x.game_id<=m.maxGroup).reduce((s,x)=>s+Number(x.points||0),0);
      const classif=m.includeClass?Number(r.classificados||0):0;
      const ko=(d.knockout_predictions||[]).filter(x=>x.game_id<=m.maxGame).reduce((s,x)=>s+Number(x.points||0),0);
      return {entry_id:r.entry_id, display_name:r.display_name, cravadas:r.cravadas, total:group+classif+ko, grupos:group+classif, mata_mata:ko};
    }).sort((a,b)=>b.total-a.total || b.cravadas-a.cravadas || a.display_name.localeCompare(b.display_name,'pt-BR'));
    rows.forEach((r,i)=>r.posicao=i+1);
    return {...m, rows};
  }).filter(s=>s.rows.some(r=>r.total>0));
}
function renderEvolution(){
  const snaps=evolutionSnapshots();
  if(!snaps.length){ $('evolutionBox').innerHTML='Ainda não há dados suficientes para evolução.'; return; }
  const current=snaps[snaps.length-1];
  const previous=snaps.length>1 ? snaps[snaps.length-2] : null;
  const prevPos = previous ? Object.fromEntries(previous.rows.map(r=>[r.entry_id,r.posicao])) : {};
  const labels=snaps.map(s=>s.label);
  const leaders=snaps.map(s=>s.rows[0]);
  $('evolutionBox').className='evolution-wrap';
  $('evolutionBox').innerHTML = `
    <div class="evolution-timeline">${snaps.map((s,i)=>`<article><span>${i+1}</span><b>${esc(s.label)}</b><small>Líder: ${esc(s.rows[0]?.display_name||'—')} · ${s.rows[0]?.total||0} pts</small></article>`).join('')}</div>
    <div class="table-wrap evolution-table"><table><thead><tr><th>Pos.</th><th>Participante</th>${labels.map(l=>`<th>${esc(l)}</th>`).join('')}<th>Mov.</th></tr></thead><tbody>${current.rows.slice(0,15).map(r=>{
      const cells=snaps.map(s=>{ const row=s.rows.find(x=>x.entry_id===r.entry_id); return `<td><b>${row?.total||0}</b><small>${row?row.posicao+'º':'—'}</small></td>`; }).join('');
      const old=prevPos[r.entry_id]||r.posicao, mov=old-r.posicao; const arrow=mov>0?`▲ ${mov}`:mov<0?`▼ ${Math.abs(mov)}`:'—';
      return `<tr><td>${r.posicao}º</td><td><button class="participant-btn" data-open-entry="${r.entry_id}">${esc(r.display_name)}</button></td>${cells}<td><b class="${mov>0?'move-up':mov<0?'move-down':'muted'}">${arrow}</b></td></tr>`;
    }).join('')}</tbody></table></div>
    <p class="muted-text">Evolução calculada a partir dos detalhes de cada jogo já finalizado. Não depende de histórico manual.</p>`;
  bindOpeners();
}

function renderCompare(){ const options=participantsOptions(); $('compareA').innerHTML=options; $('compareB').innerHTML=options; const draw=()=>{ const a=Number($('compareA').value), b=Number($('compareB').value); if(!a||!b){ $('compareResult').className='compare-grid empty-state'; $('compareResult').textContent='Selecione dois participantes.'; return; } $('compareResult').className='compare-grid'; const A=CALC.ranking.find(x=>x.entry_id===a), B=CALC.ranking.find(x=>x.entry_id===b); $('compareResult').innerHTML = [A,B].map(r=>`<article class="compare-card"><h4>${esc(r.display_name)}</h4><div class="big-score">${r.total}</div><p>${r.posicao}º lugar</p><div class="stat-line"><span>Grupos</span><b>${r.grupos}</b></div><div class="stat-line"><span>Mata-mata</span><b>${r.mata_mata}</b></div><div class="stat-line"><span>Classificados</span><b>${r.classificados}</b></div><div class="stat-line"><span>Cravadas</span><b>${r.cravadas}</b></div><button class="btn tiny" data-open-entry="${r.entry_id}">Explodir detalhes</button></article>`).join(''); bindOpeners(); }; $('compareA').addEventListener('change',draw); $('compareB').addEventListener('change',draw); draw(); }

function gameByIdFrom(results, id){ return (results||[]).find(g=>Number(g.game_id)===Number(id)); }
function simOfficialById(){ return Object.fromEntries(CALC.ranking.map(r=>[r.entry_id,r])); }
function simPhaseIds(){ return [97,98,99,100,101,102,103,104]; }
function simChoiceKey(gameId){ return String(gameId); }
function simHasAnyChoice(){ return Object.keys(SIM_CHOICES||{}).length>0 || !!SIM_SCORER; }
function simIsComplete(){
  if(!SIM_CALC) return false;
  const ids=[99,100,101,102,103,104];
  return ids.every(id=>{ const g=gameByIdFrom(SIM_CALC.resultados,id); return isPlayed(g); }) && !!SIM_SCORER;
}
function computeCurrentSimulation(){
  SIM_CALC = computeSimulation(DATA, CALC.ranking, SIM_CHOICES, SIM_SCORER || null);
  return SIM_CALC;
}
function renderSimulator(){
  const scorerOptions = uniqueScorers(DATA.participantes || []);
  const scorerSelect = $('simScorer');
  if(scorerSelect){
    scorerSelect.innerHTML = `<option value="">Escolha o artilheiro...</option>` + scorerOptions.map(s=>`<option value="${esc(s.name)}">${esc(s.name)} · ${s.count} aposta${s.count===1?'':'s'}</option>`).join('');
    scorerSelect.value = SIM_SCORER || '';
    scorerSelect.onchange = e=>{ SIM_SCORER = e.target.value || ''; updateSimulator(); };
  }
  $('simRecalc')?.addEventListener('click', updateSimulator);
  $('simClear')?.addEventListener('click', clearSimulation);
  $('simCopy')?.addEventListener('click', copySimulationScenario);
  updateSimulator();
}
function updateSimulator(){
  const sim = computeCurrentSimulation();
  renderSimStatus();
  renderSimRanking(sim);
  renderSimBracket(sim);
  renderSimFinals(sim);
}
function renderSimStatus(){
  const box = $('simStatus'); if(!box) return;
  if(!simHasAnyChoice()) box.textContent = 'Escolha os vencedores dos confrontos pendentes para ver como o bolão pode mudar.';
  else if(!simIsComplete()) box.textContent = 'Complete os confrontos pendentes para projetar campeão, vice, terceiro e quarto.';
  else box.textContent = 'Cenário completo simulado. Esta projeção não altera o ranking oficial.';
}
function renderSimRanking(sim){
  const container = $('simRanking'); if(!container || !sim) return;
  const officialLast = CALC.ranking[CALC.ranking.length-1];
  const prizeIds = new Set(sim.ranking.slice(0,3).map(r=>r.entry_id));
  if(officialLast) prizeIds.add(officialLast.entry_id);
  container.innerHTML = sim.ranking.map((r,i)=>{
    const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':(officialLast && r.entry_id===officialLast.entry_id?'🎁':`${i+1}º`);
    const mov = Number(r.variacao_posicao||0);
    const movLabel = mov>0 ? `▲ ${mov}` : mov<0 ? `▼ ${Math.abs(mov)}` : '—';
    const movCls = mov>0?'move-up':mov<0?'move-down':'muted';
    const diff = Number(r.diferenca_pontos||0);
    const diffLabel = `${diff>=0?'+':''}${diff}`;
    const finals = r.finals || {};
    return `<details class="sim-rank-card ${prizeIds.has(r.entry_id)?'sim-prize':''}">
      <summary>
        <div class="sim-pos">${medal}</div>
        <div class="sim-player"><strong>${esc(r.display_name)}</strong><small>Oficial: ${r.total_oficial} pts · Simulado: ${r.total_simulado} pts</small></div>
        <div class="sim-delta ${diff>0?'move-up':diff<0?'move-down':'muted'}"><b>${diffLabel}</b><small>pontos</small></div>
        <div class="sim-delta ${movCls}"><b>${movLabel}</b><small>posição</small></div>
        <div class="sim-finals-mini"><small>${esc(safe(finals.campeao))} · ${esc(safe(finals.artilheiro))}</small></div>
      </summary>
      <div class="sim-rank-detail">
        <div class="sim-detail-grid">
          <div><span>Pontos oficiais já conquistados</span><b>${r.total_oficial}</b></div>
          <div><span>Pontos que entrariam nesta simulação</span><b>${diffLabel}</b></div>
          <div><span>Bônus final possível</span><b>${r.bonus_final_simulado || 0}</b></div>
          <div><span>Total simulado</span><b>${r.total_simulado}</b></div>
        </div>
        <div class="sim-bonus-lines">
          <div><span>Campeão apostado</span><b>${esc(safe(finals.campeao))}</b><em>${r.bonus_final_detalhe?.campeao||0} pts</em></div>
          <div><span>Vice apostado</span><b>${esc(safe(finals.vice))}</b><em>${r.bonus_final_detalhe?.vice||0} pts</em></div>
          <div><span>3º lugar apostado</span><b>${esc(safe(finals.terceiro))}</b><em>${r.bonus_final_detalhe?.terceiro||0} pts</em></div>
          <div><span>4º lugar apostado</span><b>${esc(safe(finals.quarto))}</b><em>${r.bonus_final_detalhe?.quarto||0} pts</em></div>
          <div><span>Artilheiro apostado</span><b>${esc(safe(finals.artilheiro))}</b><em>${r.bonus_final_detalhe?.artilheiro||0} pts</em></div>
        </div>
        <button class="btn tiny" data-open-entry="${r.entry_id}">Ver detalhes do participante</button>
      </div>
    </details>`;
  }).join('');
  bindOpeners();
}
function renderSimBracket(sim){
  const box = $('simBracket'); if(!box || !sim) return;
  const phaseGroups = [
    ['Quartas de final',[97,98,99,100]],
    ['Semifinais',[101,102]],
    ['Disputa de 3º lugar',[103]],
    ['Final',[104]]
  ];
  box.innerHTML = phaseGroups.map(([title, ids])=>`<section class="sim-phase"><h4>${esc(title)}</h4>${ids.map(id=>simGameCard(gameByIdFrom(sim.resultados,id))).join('')}</section>`).join('');
  box.querySelectorAll('[data-sim-winner]').forEach(btn=>{
    btn.onclick = ()=>{
      const gameId=btn.dataset.gameId, adv=btn.dataset.simWinner;
      const card=btn.closest('.sim-game-card');
      const hg=card?.querySelector('[data-sim-home]')?.value;
      const ag=card?.querySelector('[data-sim-away]')?.value;
      SIM_CHOICES[simChoiceKey(gameId)] = { home_goals:hg, away_goals:ag, advancer:adv };
      updateSimulator();
    };
  });
  box.querySelectorAll('[data-sim-home],[data-sim-away]').forEach(inp=>{
    inp.onchange = ()=>{
      const card=inp.closest('.sim-game-card'), gameId=card?.dataset.gameId;
      if(!gameId) return;
      const g=gameByIdFrom(SIM_CALC?.resultados,gameId);
      const current = SIM_CHOICES[simChoiceKey(gameId)] || {};
      const hg=card.querySelector('[data-sim-home]')?.value;
      const ag=card.querySelector('[data-sim-away]')?.value;
      let adv=current.advancer;
      if(hg!=='' && ag!=='' && Number(hg)!==Number(ag) && g?.home && g?.away) adv = Number(hg)>Number(ag) ? g.home : g.away;
      if(adv) SIM_CHOICES[simChoiceKey(gameId)] = { home_goals:hg, away_goals:ag, advancer:adv };
      updateSimulator();
    };
  });
}
function simGameCard(g){
  if(!g) return `<article class="sim-game-card empty-state">Jogo não encontrado</article>`;
  const official = isPlayed(g) && !g.simulated;
  const simulated = isPlayed(g) && !!g.simulated;
  const pending = !isPlayed(g);
  const choice = SIM_CHOICES[simChoiceKey(g.game_id)] || {};
  const status = official ? 'oficial' : simulated ? 'simulado' : 'pendente';
  const canEdit = !official && g.home && g.away;
  return `<article class="sim-game-card ${status}" data-game-id="${g.game_id}">
    <div class="sim-game-top"><span class="match-no">#${g.game_id}</span><b>${phaseLabel(g.phase)}</b><span class="pill ${official?'good':simulated?'warn':'neutral'}">${status}</span></div>
    <div class="sim-match-row"><div>${team(g.home,true)}</div><input ${canEdit?'':'disabled'} data-sim-home type="number" min="0" value="${esc(choice.home_goals ?? (isPlayed(g)?g.home_goals:''))}" aria-label="gols mandante"/><span>x</span><input ${canEdit?'':'disabled'} data-sim-away type="number" min="0" value="${esc(choice.away_goals ?? (isPlayed(g)?g.away_goals:''))}" aria-label="gols visitante"/><div>${team(g.away,true)}</div></div>
    ${g.advancer ? `<div class="sim-advancer">avança ${team(g.advancer,true)}</div>` : ''}
    <div class="sim-choice-row">
      <button class="btn tiny ${g.advancer===g.home?'primary':''}" ${canEdit?'':'disabled'} data-game-id="${g.game_id}" data-sim-winner="${esc(g.home||'')}">${g.home?`Avança ${teamName(g.home)}`:'A definir'}</button>
      <button class="btn tiny ${g.advancer===g.away?'primary':''}" ${canEdit?'':'disabled'} data-game-id="${g.game_id}" data-sim-winner="${esc(g.away||'')}">${g.away?`Avança ${teamName(g.away)}`:'A definir'}</button>
    </div>
  </article>`;
}
function renderSimFinals(sim){
  const box = $('simFinals'); if(!box || !sim) return;
  const pos = [
    ['🥇 Campeão','campeao'],['🥈 Vice','vice'],['🥉 Terceiro','terceiro'],['4️⃣ Quarto','quarto']
  ];
  const finalMaps = {
    campeao: finalPositionMap('campeao'), vice: finalPositionMap('vice'), terceiro: finalPositionMap('terceiro'), quarto: finalPositionMap('quarto')
  };
  box.innerHTML = pos.map(([label,key])=>{
    const code = sim.podium?.[key];
    const names = code ? (finalMaps[key]?.[code] || []) : [];
    return `<div class="sim-final-line"><span>${label}</span><b>${code?team(code,true):'A definir'}</b><small>${names.length} aposta${names.length===1?'':'s'} nessa posição</small></div>`;
  }).join('');
  const scorer = uniqueScorers(DATA.participantes || []).find(x=>x.name===SIM_SCORER);
  $('simScorerHint').textContent = SIM_SCORER ? `${scorer?.count || 0} participante${(scorer?.count||0)===1?'':'s'} apostaram em ${SIM_SCORER}.` : 'Escolha um nome da lista de artilheiros apostados.';
}
function clearSimulation(){
  SIM_CHOICES = {}; SIM_SCORER = '';
  if($('simScorer')) $('simScorer').value='';
  updateSimulator();
  toast('Simulação limpa.');
}
function copySimulationScenario(){
  const sim = SIM_CALC || computeCurrentSimulation();
  const text = summarizeScenario(sim, DATA.times || []);
  navigator.clipboard?.writeText(text).then(()=>toast('Cenário copiado.'),()=>toast('Não foi possível copiar automaticamente.', true));
}

function renderRules(){ const r=DATA.regras, audit=auditInternal(); $('rulesGrid').innerHTML = `<article><strong>Fase de grupos</strong><p>Placar exato/cravada: <b>${r.fase_grupos.placar_exato}</b> pontos. Vencedor ou empate correto: <b>${r.fase_grupos.vencedor_ou_empate}</b> pontos. A cravada substitui o acerto simples.</p></article><article><strong>Classificados aos 1/16 avos</strong><p>Cada seleção corretamente classificada vale <b>${r.classificados_grupos.por_selecao_classificada}</b> pontos. A ordem no grupo não importa.</p></article><article><strong>Mata-mata</strong><p>Confronto correto: <b>${r.mata_mata.confronto_correto}</b>. Seleção que avança: <b>${r.mata_mata.avanco_por_fase}</b>. Placar exato vale <b>${r.mata_mata.placar_exato_bonus}</b> pontos, não 5, e exige confronto + classificado correto.</p></article><article><strong>Bônus finais</strong><p>Campeão: <b>${r.bonus_finais.campeao}</b>. Vice: <b>${r.bonus_finais.vice}</b>. 3º lugar: <b>${r.bonus_finais.terceiro}</b>. 4º lugar: <b>${r.bonus_finais.quarto}</b>. Artilheiro: <b>${r.bonus_finais.artilheiro}</b>.</p></article><article><strong>Desempate</strong><p>${(r.desempate||[]).map(esc).join(' → ') || 'Não informado nos dados.'}</p></article><article><strong>Conferência</strong><p>Compare Ranking, Palpites e Resultados para entender cada ponto.</p></article>`; }

function badge(status){ const s=String(status||'pendente').toLowerCase(); const cls=s.includes('exato')||s.includes('correto')||s.includes('classificado')?'good':s.includes('erro')?'bad':'warn'; return `<span class="pill ${cls}">${esc(status||'pendente')}</span>`; }
function badgeText(status){ return String(status||'pendente'); }
function toast(msg, error=false){ const t=$('toast'); t.textContent=msg; t.style.background=error?'var(--red)':'var(--navy)'; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2600); }

loadData();
