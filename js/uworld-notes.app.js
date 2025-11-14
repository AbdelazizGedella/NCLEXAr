/* ===== ثابتات الاشتراك والداتا ===== */
// هنملّاهم من Firestore بعد تسجيل الدخول
let SUBS_CSV_URL  = null; // Sheet الاشتراكات (email + expire_date)
let DATA_CSV_URL  = null; // Sheet الأسئلة الرئيسي

const LINKEDIN_URL  = "https://www.linkedin.com/in/abdelaziz-ibrahim-gedeleila-773b2b141/";

/* ========== تحميل روابط الشيت من Firestore ========== */
async function loadUworldConfig() {
  const db = firebase.firestore();
  const snap = await db.collection('config').doc('uworldNotes').get();
  if (!snap.exists) {
    throw new Error('Uworld config document not found');
  }
  const cfg = snap.data();
  SUBS_CSV_URL = cfg.subsCsvUrl;
  DATA_CSV_URL = cfg.dataCsvUrl;

  if (!SUBS_CSV_URL || !DATA_CSV_URL) {
    throw new Error('subsCsvUrl أو dataCsvUrl غير موجودين في config/uworldNotes');
  }
}

/* ===== Helpers ===== */
const els = {
  csvUrl: document.getElementById('csvUrl'),
  saveUrl: document.getElementById('saveUrl'),
  loadBtn: document.getElementById('loadBtn'),
  search: document.getElementById('searchInput'),
  sectionFilter: document.getElementById('sectionFilter'),
  difficultyFilter: document.getElementById('difficultyFilter'),
  favOnly: document.getElementById('favOnly'),
  tagsBar: document.getElementById('tagsBar'),
  stats: document.getElementById('stats'),
  results: document.getElementById('results'),
  noData: document.getElementById('noData'),
  tpl: document.getElementById('cardTpl'),
  prodChart: document.getElementById('prodChart'),
  secCountChart: document.getElementById('secCountChart'),
  secPointsChart: document.getElementById('secPointsChart'),
  modal: document.getElementById('qaModal'),
  mQuestion: document.getElementById('mQuestion'),
  mAnswer: document.getElementById('mAnswer'),
  mSection: document.getElementById('mSection'),
  mDifficulty: document.getElementById('mDifficulty'),
  mDate: document.getElementById('mDate'),
  mTags: document.getElementById('mTags'),
  mMediaWrap: document.getElementById('mMediaWrap'),
  mMedia: document.getElementById('mMedia'),
  mSpeak: document.getElementById('mSpeak'),
  mStop: document.getElementById('mStop'),
  stopAll: document.getElementById('stopAll'),
  sectionChips: document.getElementById('sectionChips'),
  mLevel: document.getElementById('mLevel'),
  mRelated: document.getElementById('mRelated'),
  analyticsPanel: document.getElementById('analyticsPanel'),
  arVoiceSelect: document.getElementById('arVoiceSelect'),
  csvSection: document.getElementById('csvSection'),
  currentUserName: document.getElementById('currentUserName')
};

/* LocalStorage keys */
const LS_URL_KEY='study_csv_url';
const LS_AR_VOICE='study_ar_voice';

function decodeEntitiesDeep(s){
  if(s==null) return '';
  let cur = String(s), prev = null, i=0;
  while(i<3 && cur!==prev){
    prev = cur;
    const txt = document.createElement('textarea');
    txt.innerHTML = cur;
    cur = txt.value;
    i++;
  }
  return cur;
}
function htmlEscapeBasic(s){
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function colorEnglish(escaped){
  return escaped.replace(/[A-Za-z0-9#@._/%+\-]+(?:\s+[A-Za-z0-9#@._/%+\-]+)*/g,
    m => '<span class="en">'+m+'</span>');
}
function addArrows(html){
  html = html.replace(/<span class="en">\s*Increase\s*<\/span>/gi,
          '<span class="text-green-400">⬆️ <span class="en">Increase</span></span>');
  html = html.replace(/<span class="en">\s*Decrease\s*<\/span>/gi,
          '<span class="text-red-400">⬇️ <span class="en">Decrease</span></span>');
  html = html.replace(/\bIncrease\b/gi,
          '<span class="text-green-400">⬆️ <span class="en">Increase</span></span>');
  html = html.replace(/\bDecrease\b/gi,
          '<span class="text-red-400">⬇️ <span class="en">Decrease</span></span>');
  return html;
}

/* Stage flow */
function renderStageFlow(rawLine){
  const parts = rawLine.split(/\s*=>\s*/).filter(Boolean);
  const nodes = parts.map(p=> `<span class="stage-node">${htmlEscapeBasic(p)}</span>`).join('<span class="stage-arrow">⇒</span>');
  return `<div class="stage-flow" dir="ltr" role="list">${nodes}</div>`;
}

/* ==== Table parsing (Markdown-style) ==== */
function isSepRow(line){
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}
function splitRow(line){
  let row = line.trim();
  if(row.startsWith('|')) row = row.slice(1);
  if(row.endsWith('|')) row = row.slice(0,-1);
  return row.split('|').map(c => c.trim());
}
function renderTableFromLines(lines, startIndex){
  const header = splitRow(lines[startIndex]);
  let i = startIndex + 2;
  const body = [];
  while(i < lines.length && /\|/.test(lines[i])){
    body.push(splitRow(lines[i]));
    i++;
  }
  const ths = header.map(h=> `<th>${addArrows(colorEnglish(htmlEscapeBasic(h)))}</th>`).join('');
  const trs = body.map(r=>{
    const tds = r.map(c=> `<td>${addArrows(colorEnglish(htmlEscapeBasic(c)))}</td>`).join('');
    return `<tr>${tds}</tr>`;
  }).join('');
  const html = `
    <div class="overflow-x-auto">
      <table class="qa-table table table-zebra w-full text-center">
        <thead><tr>${ths}</tr></thead>
        <tbody>${trs}</tbody>
      </table>
    </div>`;
  return { html, next: i - 1 };
}

/* تمييزات + جداول + عناوين منتهية بنقطتين */
function formatAnswerText(raw){
  const s = decodeEntitiesDeep(raw);
  const lines = String(s||'').split(/\r?\n|\r/);
  const out = [];

  for(let i=0;i<lines.length;i++){
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Stage flow
    if(trimmed.includes('=>')){
      out.push(renderStageFlow(trimmed));
      continue;
    }

    // Markdown table detection
    if(/\|/.test(rawLine) && i+1 < lines.length && isSepRow(lines[i+1])){
      const tbl = renderTableFromLines(lines, i);
      out.push(tbl.html);
      i = tbl.next;
      continue;
    }

    const esc = htmlEscapeBasic(rawLine).replace(/^\s+/,'');

    if(/^ممنوع/.test(esc)){
      let rest = esc.replace(/^ممنوع\s*[:\-]?/, '');
      out.push('<span class="badge badge-error mr-2">ممنوع</span><span class="text-red-400">'+ addArrows(colorEnglish(rest.trimStart())) +'</span>');
      continue;
    }
    if(/^دورنا من ناحية التمريض/.test(esc)){
      let rest = esc.replace(/^دورنا من ناحية التمريض\s*[:\-]?/, '');
      out.push('<span class="badge badge-success mr-2">دورنا من ناحية التمريض</span><span class="text-green-400">'+ addArrows(colorEnglish(rest.trimStart())) +'</span>');
      continue;
    }
    if(/^يفضل/.test(esc)){
      let rest = esc.replace(/^يفضل\s*[:\-]?/, '');
      out.push('<span class="badge badge-info mr-2">يفضل</span><span class="text-blue-400">'+ addArrows(colorEnglish(rest.trimStart())) +'</span>');
      continue;
    }
    if(/^أفضل/.test(esc)){
      let rest = esc.replace(/^أفضل\s*[:\-]?/, '');
      out.push('<span class="badge badge-success mr-2">أفضل</span><span class="text-green-400">'+ addArrows(colorEnglish(rest.trimStart())) +'</span>');
      continue;
    }
    if(/^معلومات عامة/.test(esc)){
      let rest = esc.replace(/^معلومات عامة\s*[:\-]?/, '');
      out.push('<span class="badge-burgundy mr-2">معلومات عامة</span>'+ addArrows(colorEnglish(rest.trimStart())));
      continue;
    }
    if(/^مثال/.test(esc)){
      let rest = esc.replace(/^مثال\s*[:\-]?/, '');
      out.push('<span class="example-badge mr-2">مثال</span><span class="example-line">'+ addArrows(colorEnglish(rest.trimStart())) +'</span>');
      continue;
    }
    if(/^مهم/.test(esc)){
      let rest = esc.replace(/^مهم\s*[:\-]?/, '');
      out.push('<span class="badge-important mr-2">مهم</span><span class="important-line">'+ addArrows(colorEnglish(rest.trimStart())) +'</span>');
      continue;
    }

    if(/[:：]\s*$/.test(trimmed) && trimmed.replace(/[:：]\s*$/,'').length){
      const head = esc.replace(/[:：]\s*$/,'');
      out.push('<div class="answer-heading">'+ addArrows(colorEnglish(head)) +'</div>');
      continue;
    }

    out.push(addArrows(colorEnglish(esc)));
  }

  return out.join('<br>');
}

function formatQuestionText(raw){
  const s = decodeEntitiesDeep(raw);
  const esc = htmlEscapeBasic(s);
  return addArrows(esc);
}
function countPointsFromAnswer(raw){
  const s = decodeEntitiesDeep(raw);
  return String(s||'').split(/\r?\n|\r/).map(x=>x.trim()).filter(Boolean).length;
}

function sectionColors(section){
  const name = String(section||'عام');
  let h=0; for(let i=0;i<name.length;i++){ h=(h*31 + name.charCodeAt(i))>>>0; }
  h=h%360;
  const bg='hsla('+h+',70%,20%,0.35)', bd='hsla('+h+',80%,60%,0.65)', fg='hsla('+h+',90%,85%,0.95)';
  return {h,bg,bd,fg};
}
function tokenize(txt){
  return String(txt||'').toLowerCase().replace(/[^\w\u0600-\u06FF\s]/g,' ')
              .split(/\s+/).filter(Boolean);
}
function toISODate(d){
  if(!d) return null;
  const m = String(d).match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if(!m) return null;
  const yyyy=m[1], mm=('0'+m[2]).slice(-2), dd=('0'+m[3]).slice(-2);
  return `${yyyy}-${mm}-${dd}`;
}
const linesToDifficulty = (pts)=> Math.max(1, Math.min(5, Math.ceil(pts/2)));

/* ===== State ===== */
let RAW=[], DATA=[], INDEX=null;
const TAGS = new Set(), SECTIONS = new Set();

const getCSVUrl=()=> localStorage.getItem(LS_URL_KEY)||'';
const setCSVUrl=(url)=> localStorage.setItem(LS_URL_KEY, url);
const getSavedArVoice=()=> localStorage.getItem(LS_AR_VOICE)||'';
const setSavedArVoice=(name)=> localStorage.setItem(LS_AR_VOICE, name||'');

function buildIndex(){
  INDEX = lunr(function(){
    this.ref('id');
    this.field('question'); this.field('answer'); this.field('tagsStr'); this.field('section');
    DATA.forEach(d=> this.add({id:d.id, question:d.question, answer:d.answer, tagsStr:d.tags.join(' '), section:d.section}));
  });
}

function normalizeRow(r, idx){
  const id = (r.id||'').trim() || String(idx+1);
  const question = decodeEntitiesDeep((r.question||'').trim());
  const answer = (r.answer||'').trim();
  const section = (r.section||'عام').trim();
  const givenDiff = parseInt(r.difficulty||'') || '';
  const addedAt = (r.addedAt||r.updatedAt||'').trim();

  const pics = String(r.Pic||r.pic||'').trim();
  const videos = String(r.Video||r.video||'').trim();
  const legacy = String(r.media||r.mediaUrl||'').trim();
  const toArr = (s)=> s ? s.split(/[|,،\s]+/).filter(Boolean) : [];
  const media = [...toArr(pics), ...toArr(videos), ...toArr(legacy)];

  const tags = String(r.tags||'').split(/[|,،]/).map(t=>t.trim()).filter(Boolean);
  tags.forEach(t=>TAGS.add(t)); SECTIONS.add(section);

  const points = countPointsFromAnswer(answer);
  const difficulty = givenDiff || linesToDifficulty(points);

  return { id, question, answer, section, difficulty, addedAt, tags, media, points };
}

function filterAndRank(){
  const q = els.search.value.trim();
  const sec = els.sectionFilter.value;
  const diff = els.difficultyFilter.value;
  const activeTags = getActiveTags();

  let idsOrder = null;
  if(q && INDEX){ idsOrder = INDEX.search(q).map(r=>r.ref); }

  let list = DATA.filter(d=>{
    if (sec && d.section !== sec) return false;
    if (diff && String(d.difficulty) !== String(diff)) return false;
    if (activeTags.length && !activeTags.some(t=> d.tags.includes(t))) return false;
    return true;
  });

  if(idsOrder){
    const pos = new Map(idsOrder.map((id,i)=>[id,i]));
    list.sort((a,b)=> (pos.get(a.id)??9999) - (pos.get(b.id)??9999));
  } else {
    list.sort((a,b)=> (b.addedAt||'').localeCompare(a.addedAt||'')); 
  }
  return list;
}

function renderStats(){
  const bySection={}, byTag={}, bySectionPoints={};
  let totalPoints=0;
  DATA.forEach(d=>{
    bySection[d.section]=(bySection[d.section]||0)+1;
    bySectionPoints[d.section]=(bySectionPoints[d.section]||0)+d.points;
    totalPoints += d.points;
    d.tags.forEach(t=> byTag[t]=(byTag[t]||0)+1);
  });
  const total=DATA.length, secCount=Object.keys(bySection).length, tagCount=Object.keys(byTag).length;

  const secLines = Object.keys(bySection).sort().map(sec=>{
    const sc = sectionColors(sec);
    const style = 'background:'+sc.bg+';border-color:'+sc.bd+';color:'+sc.fg+';';
    return '<li class="mt-1"><span class="chip" style="'+style+'">'+sec+
           '</span> — <strong>'+bySection[sec]+'</strong> سؤال • <strong>'+ (bySectionPoints[sec]||0) +'</strong> نقطة</li>';
  }).join('');

  els.stats.innerHTML =
    '<li>المجموع: <strong>'+total+'</strong> سؤال</li>'+
    '<li>إجمالي النقاط: <strong>'+totalPoints+'</strong></li>'+
    '<li>الأقسام: <strong>'+secCount+'</strong></li>'+
    '<li>الوسوم: <strong>'+tagCount+'</strong></li>'+
    '<li class="mt-2">حسب القسم:</li>'+ secLines;
}

function renderFilters(){
  const cur = els.sectionFilter.value;
  els.sectionFilter.innerHTML = '<option value="">كل الأقسام</option>' +
    [...SECTIONS].sort().map(s=>'<option '+(s===cur?'selected':'')+' value="'+s+'">'+s+'</option>').join('');

  const active = new Set(Array.from(document.querySelectorAll('#tagsBar button[data-active="1"]')).map(b=>b.dataset.tag));
  els.tagsBar.innerHTML = '';
  [...TAGS].sort().forEach(tag=>{
    const btn = document.createElement('button');
    btn.className='btn btn-xs btn-outline'; btn.textContent='#'+tag; btn.dataset.tag=tag;
    btn.dataset.active = active.has(tag)?'1':'0';
    if(btn.dataset.active==='1') btn.classList.add('btn-info');
    btn.addEventListener('click', ()=>{
      btn.dataset.active = btn.dataset.active==='1'?'0':'1';
      if(btn.dataset.active==='1') btn.classList.add('btn-info'); else btn.classList.remove('btn-info');
      render();
    });
    els.tagsBar.appendChild(btn);
  });

  els.sectionChips.innerHTML = '';
  const addChip = (txt, val)=>{
    const chip = document.createElement('button');
    chip.className = 'chip hover:border-sky-400 hover:text-sky-200';
    chip.textContent = txt; chip.dataset.val = val;
    chip.addEventListener('click', ()=>{
      els.sectionFilter.value = val;
      render();
    });
    els.sectionChips.appendChild(chip);
  };
  addChip('الكل','');
  [...SECTIONS].sort().forEach(s=> addChip(s, s));
}

const getActiveTags=()=> Array.from(document.querySelectorAll('#tagsBar button[data-active="1"]')).map(b=>b.dataset.tag);

/* ========== Media helpers ========== */
function gdriveIdFromUrl(url){
  const m1 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return (m1 && m1[1]) || (m2 && m2[1]) || null;
}
function buildMediaNode(url){
  const u = url.trim();
  const wrap = document.createElement('div');

  if(/\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(u)){
    const img = document.createElement('img');
    img.src = u; img.referrerPolicy="no-referrer"; img.loading="lazy";
    img.className="w-full rounded-lg";
    wrap.appendChild(img); return wrap;
  }
  if(/\.(mp4|webm|ogg)(\?.*)?$/i.test(u)){
    const dv = document.createElement('div'); dv.className="aspect-video";
    const video = document.createElement('video'); video.controls=true; video.src=u; video.className="rounded-lg";
    dv.appendChild(video); wrap.appendChild(dv); return wrap;
  }
  if(/drive\.google\.com/i.test(u)){
    const id = gdriveIdFromUrl(u);
    const src = id ? `https://drive.google.com/file/d/${id}/preview` : u;
    const dv = document.createElement('div'); dv.className="aspect-video";
    const iframe = document.createElement('iframe');
    iframe.src = src; iframe.allow="autoplay"; iframe.className="rounded-lg"; iframe.loading="lazy";
    dv.appendChild(iframe); wrap.appendChild(dv); return wrap;
  }
  const a = document.createElement('a'); a.href=u; a.target="_blank"; a.rel="noopener"; a.textContent=u; a.className="link link-info break-all";
  wrap.appendChild(a); return wrap;
}

function difficultySquaresHTML(level){
  level = Math.max(1, Math.min(5, parseInt(level)||1));
  const colors = ['#22c55e','#16a34a','#eab308','#f97316','#ef4444'];
  let html = '';
  for(let i=1;i<=5;i++){
    const color = i<=level ? ` style="background:${colors[i-1]};opacity:1;border-color:transparent"` : '';
    html += `<span class="${i<=level?'active':''}"${color}></span>`;
  }
  return html;
}

function findRelated(item, count=4){
  const toks = new Set(tokenize(item.question+' '+item.answer+' '+(item.tags||[]).join(' ')));
  const same = DATA.filter(d=> d.id!==item.id && d.section===item.section);
  const scored = same.map(d=>{
    const b = new Set(tokenize(d.question+' '+d.answer+' '+(d.tags||[]).join(' ')));
    let inter=0; b.forEach(x=>{ if(toks.has(x)) inter++; });
    let s = inter / (Math.sqrt(toks.size)*Math.sqrt(b.size) || 1);
    if (d.tags?.some(t=> item.tags?.includes(t))) s += 0.15;
    return {d,s};
  }).filter(x=> x.s>0.05).sort((x,y)=> y.s-x.s);
  return scored.slice(0,count).map(x=>x.d);
}

function openModal(item){
  els.mQuestion.innerHTML = formatQuestionText(item.question);
  els.mAnswer.innerHTML = formatAnswerText(item.answer);
  els.mTags.innerHTML = '';
  (item.tags||[]).forEach(t=>{ const span=document.createElement('span'); span.className='chip'; span.textContent='#'+t; els.mTags.appendChild(span); });

  const sc = sectionColors(item.section);
  els.mSection.textContent = item.section;
  els.mSection.style.background=sc.bg; els.mSection.style.borderColor=sc.bd; els.mSection.style.color=sc.fg;

  els.mDifficulty.textContent = 'تصنيف: '+item.difficulty+'/5';
  els.mLevel.innerHTML = difficultySquaresHTML(item.difficulty);
  els.mDate.textContent = item.addedAt ? ('تاريخ الإضافة: ' + item.addedAt) : '';

  els.mMedia.innerHTML = '';
  els.mMediaWrap.style.display = item.media && item.media.length ? '' : 'none';
  (item.media||[]).forEach(url=> els.mMedia.appendChild(buildMediaNode(url)));

  const rel = findRelated(item, 6);
  if(rel.length){
    els.mRelated.innerHTML =
      '<div class="text-sm text-[var(--ink-soft)] mb-2">أسئلة مشابهة:</div>'+
      '<div class="flex flex-wrap gap-2">' +
      rel.map(r=> `<button class="btn btn-xs btn-outline" data-jump="${r.id}">${htmlEscapeBasic(r.question)}</button>`).join('') +
      '</div>';
    els.mRelated.querySelectorAll('button[data-jump]').forEach(b=>{
      b.addEventListener('click',()=>{
        els.modal.close();
        const target = DATA.find(x=> x.id===b.dataset.jump);
        if(target){ openModal(target); }
      });
    });
  }else{
    els.mRelated.innerHTML = '';
  }

  populateArabicVoiceSelect();

  els.mSpeak.onclick = ()=> {
    const text = decodeEntitiesDeep(item.question) + '. ' +
                 decodeEntitiesDeep(item.answer).replace(/\r?\n|\r/g, '. ');
    const selectedName = els.arVoiceSelect.value || getSavedArVoice();
    speakQA(text, selectedName);
  };
  els.mStop.onclick = ()=> window.speechSynthesis.cancel();

  els.modal.showModal();
}

function render(){
  const list = filterAndRank();
  els.results.innerHTML='';
  if(!list.length){ els.noData.classList.remove('hidden'); return; } else els.noData.classList.add('hidden');

  list.forEach(item=>{
    const node = els.tpl.content.cloneNode(true);
    const qEl=node.querySelector('[data-q]');
    const secLine=node.querySelector('[data-sectionline]');
    const lvl=node.querySelector('[data-level]');
    const openBtn=node.querySelector('[data-open]');

    qEl.innerHTML = formatQuestionText(item.question);
    const sc = sectionColors(item.section);
    secLine.textContent = item.section;
    secLine.style.color = sc.bd;
    secLine.classList.add('text-xs');

    lvl.innerHTML = difficultySquaresHTML(item.difficulty);

    const tagsEl=node.querySelector('[data-tags]');
    (item.tags||[]).forEach(t=>{ const span=document.createElement('span'); span.className='chip'; span.textContent='#'+t; tagsEl.appendChild(span); });

    openBtn.addEventListener('click', ()=> openModal(item));

    const card = node.firstElementChild;
    card.dataset.cardId=item.id;
    card.style.borderLeftColor=sc.bd; card.style.borderLeftWidth='3px'; card.style.borderLeftStyle='solid';

    els.results.appendChild(node);
  });
}

function populateFromCSV(rows){
  RAW = rows || []; TAGS.clear(); SECTIONS.clear();
  DATA = RAW.map(normalizeRow);
  buildIndex(); renderStats(); renderFilters(); render(); ensureCharts();
}

function loadCSV(url){
  return new Promise((resolve,reject)=>{
    if(!url){
      const csv =
'id,question,answer,tags,section,difficulty,addedAt,Pic,Video\n'
+'1,Sample?,Sample answer.,sample,General,3,2025-01-01,,\n';
      Papa.parse(csv,{header:true,complete:(res)=>resolve(res.data)}); return;
    }
    Papa.parse(url,{download:true,header:true,skipEmptyLines:true,
      complete:(res)=>resolve(res.data), error:(err)=>reject(err)});
  });
}

/* ===== Charts ===== */
const charts = { prod:null, secCount:null, secPoints:null };

function renderCharts(){
  const byDatePoints = {};
  const bySectionCount = {};
  const bySectionPoints = {};
  DATA.forEach(d=>{
    const iso = toISODate(d.addedAt);
    if(iso){ byDatePoints[iso] = (byDatePoints[iso]||0) + d.points; }
    bySectionCount[d.section] = (bySectionCount[d.section]||0) + 1;
    bySectionPoints[d.section] = (bySectionPoints[d.section]||0) + d.points;
  });

  const dates = Object.keys(byDatePoints).sort();
  const points = dates.map(k=> byDatePoints[k]);

  const secLabels = Object.keys(bySectionCount).sort();
  const secCounts = secLabels.map(k=> bySectionCount[k]);
  const secPts = secLabels.map(k=> bySectionPoints[k]);

  for (const k of Object.keys(charts)){ if(charts[k]){ charts[k].destroy(); charts[k]=null; } }

  charts.prod = new Chart(els.prodChart.getContext('2d'), {
    type:'line',
    data:{ labels:dates, datasets:[{ label:'نقاط يومية', data:points, tension:0.3 }]},
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:true} } }
  });

  charts.secCount = new Chart(els.secCountChart.getContext('2d'), {
    type:'doughnut',
    data:{ labels:secLabels, datasets:[{ label:'عدد الأسئلة', data:secCounts }]},
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{position:'bottom'} } }
  });

  charts.secPoints = new Chart(els.secPointsChart.getContext('2d'), {
    type:'doughnut',
    data:{ labels:secLabels, datasets:[{ label:'النقاط', data:secPts }]},
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{position:'bottom'} } }
  });
}

function ensureCharts(){
  if (els.analyticsPanel.open) {
    renderCharts();
  } else {
    els.analyticsPanel.addEventListener('toggle', ()=>{
      if (els.analyticsPanel.open) renderCharts();
    }, { once:true });
  }
}

/* ===== TTS ===== */
let VOICES = [];
function loadVoices(){ VOICES = window.speechSynthesis.getVoices(); }
loadVoices();
if (typeof speechSynthesis !== 'undefined'){
  speechSynthesis.onvoiceschanged = ()=>{
    loadVoices();
    if (els.modal?.open) populateArabicVoiceSelect();
  };
}

function pickArabicMaleVoice(){
  const cand = VOICES.filter(v=> v.lang && v.lang.toLowerCase().startsWith('ar'));
  const maleHints = ['naayf','tarik','maged','hamza','hassan','omar','ahmad','microsoft','saudi','ksa','male'];
  const femaleHints = ['salma','zehra','laila','hoda','female'];
  const score = (v)=>{
    let s=0;
    const name=(v.name||'').toLowerCase();
    const lang=(v.lang||'').toLowerCase();
    maleHints.forEach(h=>{ if(name.includes(h)) s+=5; });
    if(lang.includes('sa')) s+=3;
    femaleHints.forEach(h=>{ if(name.includes(h)) s-=6; });
    return s;
  };
  cand.sort((a,b)=> score(b)-score(a));
  return cand[0] || null;
}
function pickENVoice(){
  const cand = VOICES.filter(v=> v.lang && v.lang.toLowerCase().startsWith('en'));
  return cand.find(v=> /us|gb/.test((v.lang||'').toLowerCase())) || cand[0] || null;
}

function populateArabicVoiceSelect(){
  const prev = els.arVoiceSelect.value || getSavedArVoice() || '';
  const arVoices = VOICES.filter(v=> v.lang && v.lang.toLowerCase().startsWith('ar'));
  els.arVoiceSelect.innerHTML = '<option value="">صوت عربي (افتراضي)</option>';
  arVoices.forEach(v=>{
    const opt = document.createElement('option');
    opt.value = v.name; opt.textContent = `${v.name} (${v.lang})`;
    els.arVoiceSelect.appendChild(opt);
  });
  if(prev){
    const found = Array.from(els.arVoiceSelect.options).find(o=> o.value===prev);
    if(found) els.arVoiceSelect.value = prev;
  }
}
els.arVoiceSelect?.addEventListener('change', ()=>{
  setSavedArVoice(els.arVoiceSelect.value || '');
});

function splitLangSegments(text){
  const parts = [];
  const re = /([A-Za-z0-9#@._/%+\-]+|\s+|[^\sA-Za-z0-9#@._/%+\-]+)/g;
  let buffer='', mode=null;
  for(const m of text.matchAll(re)){
    const tok = m[0];
    const isEN = /^[A-Za-z0-9#@._/%+\-]+$/.test(tok);
    const isSpace = /^\s+$/.test(tok);
    const cur = isEN ? 'en' : 'ar';
    if(isSpace){ buffer += tok; continue; }
    if(mode===null){ mode=cur; buffer=tok; }
    else if(cur===mode){ buffer += tok; }
    else{ parts.push({lang:mode, text:buffer}); mode=cur; buffer=tok; }
  }
  if(buffer) parts.push({lang:mode||'ar', text:buffer});
  return parts;
}

function speakQA(fullText, arabicVoiceName=''){
  if(!('speechSynthesis' in window)){ alert('المتصفح لا يدعم تحويل النص إلى كلام.'); return; }
  window.speechSynthesis.cancel();
  const segs = splitLangSegments(fullText);

  let arVoice = null;
  if(arabicVoiceName){
    arVoice = VOICES.find(v=> (v.name||'')===arabicVoiceName) || null;
  }
  if(!arVoice){ arVoice = pickArabicMaleVoice(); }

  const enVoice = pickENVoice();

  segs.forEach(seg=>{
    const u = new SpeechSynthesisUtterance(seg.text);
    if(seg.lang==='en'){
      if(enVoice){ u.voice=enVoice; u.lang=enVoice.lang; } else { u.lang='en-US'; }
    }else{
      if(arVoice){ u.voice=arVoice; u.lang=arVoice.lang; } else { u.lang='ar'; }
    }
    u.rate=1.0; u.pitch=1.0;
    window.speechSynthesis.speak(u);
  });
}

/* ===== اشتراك و Auth ===== */

function redirectToLinkedIn(msg){
  if(typeof showToast === 'function' && msg){
    showToast('error', msg);
  }
  setTimeout(()=> {
    window.location.href = LINKEDIN_URL;
  }, 1500);
}

async function checkSubscriptionAndLoad(user) {
  // 1) هات روابط الشيت من Firestore
  await loadUworldConfig();

  const email = (user.email || '').trim().toLowerCase();

  // تحميل شيت الاشتراكات
  const subsRows = await new Promise((resolve, reject) => {
    Papa.parse(SUBS_CSV_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (res) => resolve(res.data),
      error: reject
    });
  });

  const subRow = subsRows.find(r =>
    String(r.email || '').trim().toLowerCase() === email
  );

  if (!subRow) {
    redirectToLinkedIn("لا يوجد اشتراك مرتبط بهذا الإيميل.");
    return;
  }

  const expStr = (subRow.expire_date || '').trim();
  const expDate = new Date(expStr);
  const today = new Date();
  today.setHours(0,0,0,0);

  if (!expStr || isNaN(expDate.getTime()) || expDate < today) {
    redirectToLinkedIn("انتهت فترة اشتراكك أو التاريخ غير مضبوط.");
    return;
  }

  // هنا الاشتراك سليم → حمّل الداتا الأساسية
  const dataRows = await new Promise((resolve, reject) => {
    Papa.parse(DATA_CSV_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (res) => resolve(res.data),
      error: reject
    });
  });

  // حدّث اسم المستخدم في الهيدر
  if (els.currentUserName) {
    els.currentUserName.textContent = user.displayName || user.email || 'عضو';
  }

  // أخفي خانة CSV اليدوية
  if (els.csvSection) {
    els.csvSection.classList.add('hidden');
  }

  populateFromCSV(dataRows);
}

/* ===== Events ===== */
if (els.saveUrl) {
  els.saveUrl.addEventListener('click', ()=>{
    setCSVUrl(els.csvUrl.value.trim());
  });
}
if (els.loadBtn) {
  els.loadBtn.addEventListener('click', async ()=>{
    const url = els.csvUrl.value.trim() || getCSVUrl();
    try{
      const rows = await loadCSV(url);
      populateFromCSV(rows);
    }catch(e){
      console.error(e);
      alert('تعذر تحميل CSV. تأكد من الرابط أو إعدادات النشر.');
    }
  });
}
els.search.addEventListener('input',()=>render());
els.sectionFilter.addEventListener('change',()=>render());
els.difficultyFilter.addEventListener('change',()=>render());
els.stopAll.addEventListener('click', ()=> window.speechSynthesis.cancel());

/* ===== Init ===== */
(function initApp(){
  // مش هنظهر الرابط الحقيقي في الـ input
  if (els.csvUrl) els.csvUrl.value = '';

  firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = 'Login.html';
      return;
    }
    try {
      await checkSubscriptionAndLoad(user);
    } catch (e) {
      console.error(e);
      redirectToLinkedIn("تعذر التحقق من الاشتراك حالياً.");
    }
  });
})();
