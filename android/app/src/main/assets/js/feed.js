/* ============================================================
 * 母乳喂养记录 PWA — 模块化拆分（自动由 index.html 切分）
 * 加载顺序须为：store → util → feed → growth → vaccine → sync → io → app
 * 本文件位置：3/8 喂养页
 * 普通 <script src>（非 ES module），共享全局作用域，兼容 android_asset
 * ============================================================ */

/* ---------- 渲染 ---------- */
function render(){
  renderTimer();
  renderStats();
  renderHistory();
}
/* 每秒刷新计时卡片：喂养中显示本次时长；空闲且有记录时显示距上次喂养的时长 */
function tickUpdate(){
  const clock = document.getElementById('clock');
  const active = getActive();
  if(active){
    clock.textContent = fmtHMS(liveElapsed(active));
  } else {
    const done = sessions.filter(s=>s.end!==null && !s._deleted);
    if(done.length){
      const lastS = done[done.length-1];
      clock.textContent = fmtHMS(Date.now() - lastS.end);
    }
  }
}
function renderTimer(){
  const active = getActive();
  const label = document.getElementById('timerLabel');
  const clock = document.getElementById('clock');
  const last = document.getElementById('lastLine');
  const mainBtn = document.getElementById('mainBtn');
  const activeBtns = document.getElementById('activeBtns');
  const pauseBtn = document.getElementById('pauseBtn');
  const sides = document.getElementById('sides').children;
  const done = sessions.filter(s=>s.end!==null && !s._deleted);

  if(!active){
    label.textContent = '准备开始';
    clock.textContent = '00:00:00';
    mainBtn.style.display = '';
    activeBtns.style.display = 'none';
    for(const el of sides){
      el.classList.toggle('on', el.dataset.side === selectedSide);
      el.style.pointerEvents = ''; el.style.opacity = '';
    }
    if(done.length){
      const lastS = done[done.length-1];
      label.textContent = '距上次喂养';
      clock.textContent = fmtHMS(Date.now() - lastS.end);
      last.textContent = '上次结束：' + fmtClock(lastS.end) + ' · 时长 ' + fmtMinSec(netDuration(lastS));
    } else {
      last.textContent = '还没有记录，开始第一次吧';
    }
  } else {
    mainBtn.style.display = 'none';
    activeBtns.style.display = 'flex';
    for(const el of sides){ el.classList.remove('on'); el.style.pointerEvents='none'; el.style.opacity='.5'; }

    if(active.pausedAt){
      label.textContent = '已暂停 · ' + SIDE_NAME[active.side];
      clock.textContent = fmtHMS(liveElapsed(active));
      pauseBtn.textContent = '继续';
      last.textContent = '暂停于 ' + fmtClock(active.pausedAt);
    } else {
      label.textContent = '喂养中 · ' + SIDE_NAME[active.side];
      clock.textContent = fmtHMS(liveElapsed(active));
      pauseBtn.textContent = '暂停';
      last.textContent = '开始于 ' + fmtClock(active.start);
    }
  }

  // 喂养中 或 空闲但已有记录（需实时显示距上次喂养）时保持每秒刷新
  const needTick = !!active || done.length > 0;
  if(needTick){ if(!tick) tick = setInterval(tickUpdate, 1000); }
  else { if(tick){ clearInterval(tick); tick = null; } }
}
function renderStats(){
  const done = sessions.filter(s=>s.end!==null && !s._deleted);
  const today = done.filter(s=>isSameDay(s.end,Date.now()));
  const yes = done.filter(s=>isSameDay(s.end,Date.now()-86400000));
  document.getElementById('stTodayN').textContent = today.length;
  document.getElementById('stYesN').textContent = yes.length;
  document.getElementById('stAllN').textContent = done.length;
}
function renderHistory(){
  const list = document.getElementById('histList');
  const today0 = startOfDay(Date.now());
  let dl;
  if(viewDate === today0) dl = '今天';
  else if(viewDate === today0 - 86400000) dl = '昨天';
  else dl = fmtDateCn(viewDate);
  document.getElementById('dayLabel').textContent = dl;
  document.getElementById('prevDay').disabled = false;
  document.getElementById('nextDay').disabled = (viewDate >= today0);
  document.getElementById('todayBtn').style.display = (viewDate === today0) ? 'none' : '';

  const daySessions = sessions
    .filter(s => isSameDay(s.start, viewDate) && !s._deleted)
    .sort((a,b)=> b.start - a.start);

  /* 计算每条记录距上一次喂养的间隔：基于全部记录按开始时间升序，跨天也计入 */
  const gapMap = {};
  const allSorted = sessions.filter(s=> s.start != null && !s._deleted).sort((a,b)=> a.start - b.start);
  for(let i=1;i<allSorted.length;i++){
    const prev = allSorted[i-1];
    const pEnd = (prev.end != null) ? prev.end : prev.start;
    gapMap[allSorted[i].id] = allSorted[i].start - pEnd;
  }

  document.getElementById('histCnt').textContent = daySessions.length ? ('共 '+daySessions.length+' 次') : '';
  if(!daySessions.length){
    list.innerHTML = '<div class="empty">这一天还没有记录<br>点击下方按钮开始喂养 🤱</div>';
    return;
  }
  let html = '';
  for(const s of daySessions){
    const isBottle = s.type === 'bottle';
    const active = s.end === null;
    let badge, timeStr, meta, durStr;
    if(isBottle){
      badge = '<div class="badge BTL">瓶</div>';
      timeStr = fmtClock(s.start);
      meta = '瓶喂 · ' + s.volume + 'ml';
      durStr = s.volume + 'ml';
    } else {
      badge = '<div class="badge '+s.side+'">'+s.side+'</div>';
      const sameDay = isSameDay(s.start, s.end == null ? Date.now() : s.end);
      timeStr = sameDay ? (fmtClock(s.start)+' – '+(active ? '进行中' : fmtClock(s.end)))
                         : (fmtClock(s.start)+' 起');
      const paused = (s.pausedTotal||0) + (s.pausedAt ? (Date.now()-s.pausedAt) : 0);
      meta = SIDE_NAME[s.side] + (paused>60000 ? ' · 含暂停'+fmtMinSec(paused) : '');
      durStr = active ? fmtMinSec(liveElapsed(s)) : fmtMinSec(netDuration(s));
    }
    let gapHtml;
    if(Object.prototype.hasOwnProperty.call(gapMap, s.id)){
      gapHtml = '<div class="gap">距上次 '+fmtGap(gapMap[s.id])+'</div>';
    } else {
      gapHtml = '<div class="gap first">首次记录</div>';
    }
    html += '<div class="item" data-id="'+s.id+'">'
      + badge
      + '<div class="info"><div class="time">'+timeStr+'</div>'
      + '<div class="meta">'+meta+'</div>'+gapHtml+'</div>'
      + '<div class="dur">'+durStr+'</div>'
      + '</div>';
  }
  list.innerHTML = html;
}

/* ---------- 计时交互 ---------- */
document.getElementById('sides').addEventListener('click', e=>{
  const el = e.target.closest('.side'); if(!el || getActive()) return;
  selectedSide = el.dataset.side; buzz(15); renderTimer();
});
document.getElementById('mainBtn').addEventListener('click', ()=>{
  if(getActive()) return;
  sessions.push({id:uid(), type:'nurse', start:Date.now(), end:null, side:selectedSide, pausedTotal:0, pausedAt:null, updatedAt:Date.now()});
  buzz(30); save(); render();
});
document.getElementById('pauseBtn').addEventListener('click', ()=>{
  const active = getActive(); if(!active) return;
  if(active.pausedAt){
    active.pausedTotal = (active.pausedTotal||0) + (Date.now() - active.pausedAt);
    active.pausedAt = null; buzz(20);
  } else {
    active.pausedAt = Date.now(); buzz(20);
  }
  active.updatedAt = Date.now();
  save(); render();
});
document.getElementById('endBtn').addEventListener('click', ()=>{
  const active = getActive(); if(!active) return;
  if(active.pausedAt){
    active.pausedTotal = (active.pausedTotal||0) + (Date.now() - active.pausedAt);
    active.pausedAt = null;
  }
  active.end = Date.now();
  active.updatedAt = Date.now();
  selectedSide = computeDefaultSide();
  buzz([20,40,20]); save(); render();
});

/* ---------- 时间字段绑定（点击唤起滚轮） ---------- */
// 每个时间字段维护一个 "HH:MM" 值，显示在 .tfield 上
const timeFields = {};
function bindTimeField(id, initH, initM){
  const el = document.getElementById(id);
  timeFields[id] = {h:initH, m:initM};
  el.textContent = pad(initH)+':'+pad(initM);
  el.addEventListener('click', ()=>{
    openPicker(timeFields[id].h, timeFields[id].m, (h,m)=>{
      timeFields[id].h = h; timeFields[id].m = m;
      el.textContent = pad(h)+':'+pad(m);
    });
  });
}
bindTimeField('mStartD', 9, 0);
bindTimeField('mEndD', 9, 15);
bindTimeField('bTimeD', 9, 0);
bindTimeField('eStartD', 9, 0);
bindTimeField('eEndD', 9, 15);

/* ---------- 补记（喂养） ---------- */
let mSide = 'L';
const overlay = document.getElementById('overlay');
function openModal(){
  const nh = bjH(), nm = bjM();
  document.getElementById('mDate').value = fmtDate(Date.now());
  timeFields['mStartD'].h = nh; timeFields['mStartD'].m = nm;
  document.getElementById('mStartD').textContent = pad(nh)+':'+pad(nm);
  const end = new Date(Date.now()+15*60000);
  const eh = bj(end.getTime()).getUTCHours(), em = bj(end.getTime()).getUTCMinutes();
  timeFields['mEndD'].h = eh; timeFields['mEndD'].m = em;
  document.getElementById('mEndD').textContent = pad(eh)+':'+pad(em);
  mSide = 'L';
  document.querySelectorAll('#mSeg button').forEach(b=>b.classList.toggle('on', b.dataset.side==='L'));
  overlay.classList.add('show');
}
function closeModal(){ overlay.classList.remove('show'); }
document.getElementById('addBtn').addEventListener('click', openModal);
document.getElementById('mCancel').addEventListener('click', closeModal);
overlay.addEventListener('click', e=>{ if(e.target===overlay) closeModal(); });
document.querySelectorAll('#mSeg button').forEach(b=>{
  b.onclick = ()=>{ mSide=b.dataset.side; document.querySelectorAll('#mSeg button').forEach(x=>x.classList.toggle('on', x===b)); };
});
document.getElementById('mSave').addEventListener('click', ()=>{
  const date = document.getElementById('mDate').value;
  const sh = timeFields['mStartD'].h, sm = timeFields['mStartD'].m;
  const eh = timeFields['mEndD'].h, em = timeFields['mEndD'].m;
  if(!date){ toast('请选择日期'); return; }
  const start = parseBJ(date, pad(sh)+':'+pad(sm));
  const end = parseBJ(date, pad(eh)+':'+pad(em));
  if(isNaN(start)||isNaN(end)){ toast('时间格式有误'); return; }
  if(end <= start){ toast('结束时间需晚于开始时间'); return; }
  if(end > Date.now()+60000){ toast('结束时间不能晚于现在'); return; }
  sessions.push({id:uid(), type:'nurse', start, end, side:mSide, pausedTotal:0, pausedAt:null, updatedAt:Date.now()});
  save(); render(); closeModal();
});

/* ---------- 瓶喂 ---------- */
const bottleOverlay = document.getElementById('bottleOverlay');
function openBottle(){
  const nh = bjH(), nm = bjM();
  document.getElementById('bDate').value = fmtDate(Date.now());
  timeFields['bTimeD'].h = nh; timeFields['bTimeD'].m = nm;
  document.getElementById('bTimeD').textContent = pad(nh)+':'+pad(nm);
  document.getElementById('bVol').value = 120;
  bottleOverlay.classList.add('show');
}
function closeBottle(){ bottleOverlay.classList.remove('show'); }
document.getElementById('bottleBtn').addEventListener('click', openBottle);
document.getElementById('bCancel').addEventListener('click', closeBottle);
bottleOverlay.addEventListener('click', e=>{ if(e.target===bottleOverlay) closeBottle(); });
document.getElementById('bSave').addEventListener('click', ()=>{
  const date = document.getElementById('bDate').value;
  const h = timeFields['bTimeD'].h, m = timeFields['bTimeD'].m;
  const vol = parseInt(document.getElementById('bVol').value,10);
  if(!date){ toast('请选择日期'); return; }
  if(!vol || vol<1){ toast('请填写容量'); return; }
  const start = parseBJ(date, pad(h)+':'+pad(m));
  if(isNaN(start)){ toast('时间格式有误'); return; }
  if(start > Date.now()+60000){ toast('喂养时间不能晚于现在'); return; }
  sessions.push({id:uid(), type:'bottle', start, end:start, volume:vol, pausedTotal:0, pausedAt:null, updatedAt:Date.now()});
  save(); render(); closeBottle();
});

/* ---------- 详情 / 修改 / 删除 ---------- */
const detailOverlay = document.getElementById('detailOverlay');
const editOverlay = document.getElementById('editOverlay');
function openDetail(id){
  const s = sessions.find(x=>x.id===id); if(!s) return;
  const isBottle = s.type === 'bottle';
  const active = s.end === null;
  const paused = (s.pausedTotal||0) + (s.pausedAt ? (Date.now()-s.pausedAt) : 0);
  let rows = '';
  rows += '<div class="detail-row"><span class="k">日期</span><span class="v">'+fmtDateCn(s.start)+'</span></div>';
  if(isBottle){
    rows += '<div class="detail-row"><span class="k">时间</span><span class="v">'+fmtClock(s.start)+'</span></div>';
    rows += '<div class="detail-row"><span class="k">容量</span><span class="v">'+s.volume+' ml</span></div>';
    rows += '<div class="detail-row"><span class="k">类型</span><span class="v">瓶喂</span></div>';
  } else if(active){
    rows += '<div class="detail-row"><span class="k">开始</span><span class="v">'+fmtClock(s.start)+'</span></div>';
    rows += '<div class="detail-row"><span class="k">状态</span><span class="v">进行中</span></div>';
    rows += '<div class="detail-row"><span class="k">已用</span><span class="v">'+fmtHMS(liveElapsed(s))+'</span></div>';
  } else {
    rows += '<div class="detail-row"><span class="k">开始</span><span class="v">'+fmtClock(s.start)+'</span></div>';
    rows += '<div class="detail-row"><span class="k">结束</span><span class="v">'+fmtClock(s.end)+'</span></div>';
    rows += '<div class="detail-row"><span class="k">时长</span><span class="v">'+fmtMinSec(netDuration(s))+'</span></div>';
    if(paused>60000) rows += '<div class="detail-row"><span class="k">暂停</span><span class="v">'+fmtMinSec(paused)+'</span></div>';
    rows += '<div class="detail-row"><span class="k">乳房</span><span class="v">'+SIDE_NAME[s.side]+'</span></div>';
  }
  document.getElementById('detailBody').innerHTML = rows;
  // 按钮显隐：进行中不可修改，但可删除
  document.getElementById('dEdit').style.display = active ? 'none' : '';
  detailOverlay.classList.add('show');
  document.getElementById('dEdit').onclick = ()=>{ detailOverlay.classList.remove('show'); openEdit(id); };
  document.getElementById('dDelete').onclick = ()=>{
    detailOverlay.classList.remove('show');
    confirmDialog('删除这条记录？删除后不可恢复。', ()=>{
      sessions = sessions.map(x => x.id===id ? Object.assign({}, x, {_deleted:true, updatedAt:Date.now(), end: x.end==null ? Date.now() : x.end}) : x);
      save(); render(); toast('已删除');
    }, '删除记录');
  };
}
document.getElementById('dClose').addEventListener('click', ()=>detailOverlay.classList.remove('show'));
detailOverlay.addEventListener('click', e=>{ if(e.target===detailOverlay) detailOverlay.classList.remove('show'); });

function openEdit(id){
  const s = sessions.find(x=>x.id===id); if(!s) return;
  editId = id;
  const isBottle = s.type === 'bottle';
  document.getElementById('eDate').value = fmtDate(s.start);
  // 自动带出原开始时间
  const sd = bj(s.start);
  timeFields['eStartD'].h = sd.getUTCHours();
  timeFields['eStartD'].m = sd.getUTCMinutes();
  document.getElementById('eStartD').textContent = pad(sd.getUTCHours())+':'+pad(sd.getUTCMinutes());
  // 自动带出原结束时间（无结束则沿用开始）
  const ed = bj(s.end != null ? s.end : s.start);
  timeFields['eEndD'].h = ed.getUTCHours();
  timeFields['eEndD'].m = ed.getUTCMinutes();
  document.getElementById('eEndD').textContent = pad(ed.getUTCHours())+':'+pad(ed.getUTCMinutes());
  // 切换字段显示：瓶喂无结束时间/乳房，有容量
  document.getElementById('eEndField').style.display = isBottle ? 'none' : '';
  document.getElementById('eVolField').style.display = isBottle ? '' : 'none';
  document.getElementById('eSideField').style.display = isBottle ? 'none' : '';
  if(isBottle){
    document.getElementById('eVol').value = s.volume;
  } else {
    document.querySelectorAll('#eSeg button').forEach(b=>b.classList.toggle('on', b.dataset.side===s.side));
  }
  editOverlay.classList.add('show');
}
document.getElementById('eCancel').addEventListener('click', ()=>editOverlay.classList.remove('show'));
editOverlay.addEventListener('click', e=>{ if(e.target===editOverlay) editOverlay.classList.remove('show'); });
document.querySelectorAll('#eSeg button').forEach(b=>{
  b.onclick = ()=>{ document.querySelectorAll('#eSeg button').forEach(x=>x.classList.toggle('on', x===b)); };
});
document.getElementById('eSave').addEventListener('click', ()=>{
  const s = sessions.find(x=>x.id===editId); if(!s) return;
  const date = document.getElementById('eDate').value;
  const h = timeFields['eStartD'].h, m = timeFields['eStartD'].m;
  if(!date){ toast('请选择日期'); return; }
  const start = parseBJ(date, pad(h)+':'+pad(m));
  if(isNaN(start)){ toast('时间格式有误'); return; }
  if(s.type === 'bottle'){
    const vol = parseInt(document.getElementById('eVol').value,10);
    if(!vol||vol<1){ toast('请填写容量'); return; }
    if(start > Date.now()+60000){ toast('时间不能晚于现在'); return; }
    s.start = start; s.end = start; s.volume = vol; s.updatedAt = Date.now();
  } else {
    const eh = timeFields['eEndD'].h, em = timeFields['eEndD'].m;
    const end = parseBJ(date, pad(eh)+':'+pad(em));
    if(isNaN(end)){ toast('时间格式有误'); return; }
    if(end <= start){ toast('结束时间需晚于开始时间'); return; }
    if(end > Date.now()+60000){ toast('结束时间不能晚于现在'); return; }
    let side = document.querySelector('#eSeg button.on');
    s.start = start; s.end = end; s.side = side ? side.dataset.side : s.side;
    // 保留原有暂停信息（修改记录时不再清零）
    s.updatedAt = Date.now();
  }
  save(); render(); editOverlay.classList.remove('show');
});

/* 历史列表点击：打开详情 */
document.getElementById('histList').addEventListener('click', e=>{
  const item = e.target.closest('.item');
  if(item) openDetail(item.dataset.id);
});

/* 日期导航 + 选择 + 回到今天 */
document.getElementById('prevDay').addEventListener('click', ()=>{ viewDate -= 86400000; render(); });
document.getElementById('nextDay').addEventListener('click', ()=>{
  const today0 = startOfDay(Date.now());
  if(viewDate < today0){ viewDate += 86400000; render(); }
});
document.getElementById('todayBtn').addEventListener('click', ()=>{ viewDate = startOfDay(Date.now()); render(); });
document.getElementById('dayLabel').addEventListener('click', ()=>{
  const dp = document.getElementById('dayPicker');
  dp.value = fmtDate(viewDate);
  dp.showPicker ? dp.showPicker() : dp.click();
});
document.getElementById('dayPicker').addEventListener('change', e=>{
  if(e.target.value){ viewDate = parseBJ(e.target.value); render(); }
});

/* ---------- 确认弹窗通用按钮 ---------- */
document.getElementById('cfCancel').addEventListener('click', ()=>document.getElementById('confirmOverlay').classList.remove('show'));
document.getElementById('confirmOverlay').addEventListener('click', e=>{ if(e.target===e.currentTarget) e.currentTarget.classList.remove('show'); });

/* PWA */
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{ navigator.serviceWorker.register('sw.js').catch(()=>{}); });
}
