/* ============================================================
 * 母乳喂养记录 PWA — 模块化拆分（自动由 index.html 切分）
 * 加载顺序须为：store → util → feed → growth → vaccine → sync → io → app
 * 本文件位置：4/8 成长页
 * 普通 <script src>（非 ES module），共享全局作用域，兼容 android_asset
 * ============================================================ */

function ageText(birthTs){
  const days = Math.floor((Date.now() - birthTs) / 86400000);
  if(days < 0) return '还未出生';
  if(days < 30) return '出生 ' + days + ' 天';
  const months = Math.floor(days / 30);
  const rem = days % 30;
  return months + ' 个月' + (rem ? (' ' + rem + ' 天') : '');
}
/* 宝宝信息：展示卡渲染（头像 / 姓名 / 月龄） */
function applyBabyToCard(ids){
  const img = document.getElementById(ids.img);
  const ph = document.getElementById(ids.ph);
  const nameEl = document.getElementById(ids.name);
  const metaEl = document.getElementById(ids.meta);
  if(!img) return;
  if(babyInfo && babyInfo.avatar){
    img.src = babyInfo.avatar; img.style.display = ''; ph.style.display = 'none';
  } else {
    img.removeAttribute('src'); img.style.display = 'none'; ph.style.display = '';
  }
  nameEl.textContent = (babyInfo && babyInfo.name) ? babyInfo.name : '宝宝';
  if(babyInfo && (babyInfo.sex || babyInfo.birth)){
    let s = '';
    if(babyInfo.sex) s += (babyInfo.sex === 'M' ? '男' : '女');
    if(babyInfo.birth){
      const t = new Date(babyInfo.birth).getTime();
      if(!isNaN(t)) s += (s ? ' · ' : '') + ageText(t);
    }
    metaEl.textContent = s || '未填写出生信息';
  } else {
    metaEl.textContent = '未填写信息';
  }
}
function renderBabyInfo(){
  applyBabyToCard({img:'babyAvatar', ph:'babyAvatarPh', name:'babyDispName', meta:'babyDispMeta'});
  applyBabyToCard({img:'feedBabyAvatar', ph:'feedBabyAvatarPh', name:'feedBabyName', meta:'feedBabyMeta'});
}

/* 打开宝宝信息编辑弹窗（含头像上传） */
let babyAvatarDraft = null;
function openBabyEdit(){
  const name = document.getElementById('babyName');
  const sex = document.getElementById('babySex');
  const birth = document.getElementById('babyBirth');
  const img = document.getElementById('babyAvEdit');
  const ph = document.getElementById('babyAvEditPh');
  name.value = babyInfo ? (babyInfo.name || '') : '';
  birth.value = babyInfo ? (babyInfo.birth || '') : '';
  sex.querySelectorAll('button').forEach(b=>b.classList.toggle('on', b.dataset.sex === (babyInfo ? (babyInfo.sex || '') : '')));
  babyAvatarDraft = babyInfo ? (babyInfo.avatar || null) : null;
  if(babyAvatarDraft){ img.src = babyAvatarDraft; img.style.display=''; ph.style.display='none'; }
  else { img.removeAttribute('src'); img.style.display='none'; ph.style.display=''; }
  document.getElementById('babyEditOverlay').classList.add('show');
}
document.getElementById('editBabyBtn').addEventListener('click', openBabyEdit);
document.getElementById('babyAvatarWrap').addEventListener('click', openBabyEdit);
document.getElementById('babyAvEditWrap').addEventListener('click', ()=>document.getElementById('babyAvatarInput').click());
document.getElementById('babyAvatarInput').addEventListener('change', e=>{
  const file = e.target.files && e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ev=>{
    babyAvatarDraft = ev.target.result;
    const img = document.getElementById('babyAvEdit');
    const ph = document.getElementById('babyAvEditPh');
    img.src = babyAvatarDraft; img.style.display=''; ph.style.display='none';
  };
  reader.readAsDataURL(file);
});
document.querySelectorAll('#babySex button').forEach(b=>{
  b.onclick = ()=>{ document.querySelectorAll('#babySex button').forEach(x=>x.classList.toggle('on', x===b)); };
});
document.getElementById('babySave').addEventListener('click', ()=>{
  const name = document.getElementById('babyName').value.trim();
  const birth = document.getElementById('babyBirth').value;
  const sexBtn = document.querySelector('#babySex button.on');
  const sex = sexBtn ? sexBtn.dataset.sex : '';
  if(!name && !birth && !babyAvatarDraft){ toast('请至少填写姓名或出生日期'); return; }
  babyInfo = { name: name || '', sex, birth, avatar: babyAvatarDraft, updatedAt: Date.now() };
  saveInfo(); renderBabyInfo();
  document.getElementById('babyEditOverlay').classList.remove('show');
  toast('已保存宝宝信息');
});
document.getElementById('babyCancel').addEventListener('click', ()=>{
  babyInfo = { _deleted: true, updatedAt: Date.now() }; saveInfo(); renderBabyInfo();
  document.getElementById('babyEditOverlay').classList.remove('show');
  toast('已清除宝宝信息');
});
/* 点击弹窗外的遮罩区域关闭（仅丢弃草稿，不清空已保存信息） */
document.getElementById('babyEditOverlay').addEventListener('click', e=>{ if(e.target===e.currentTarget) e.currentTarget.classList.remove('show'); });

/* 添加成长记录 */
document.getElementById('gDate').value = fmtDate(Date.now());
document.getElementById('gAdd').addEventListener('click', ()=>{
  const date = document.getElementById('gDate').value;
  const w = parseFloat(document.getElementById('gWeight').value);
  const h = parseFloat(document.getElementById('gHeight').value);
  if(!date){ toast('请选择日期'); return; }
  if(isNaN(w) && isNaN(h)){ toast('请至少填写体重或身高'); return; }
  if(!isNaN(w) && w <= 0){ toast('体重需大于 0'); return; }
  if(!isNaN(h) && h <= 0){ toast('身高需大于 0'); return; }
  const ts = new Date(date + 'T00:00').getTime();
  growth.push({ id: uid(), date: ts, weight: isNaN(w) ? null : w, height: isNaN(h) ? null : h, updatedAt: Date.now() });
  growPage = 1; saveGrowth(); renderGrowth();
  document.getElementById('gWeight').value = '';
  document.getElementById('gHeight').value = '';
  document.getElementById('gDate').value = fmtDate(Date.now());
  toast('已添加记录');
});


/* 记录列表 + 曲线 */
function renderGrowth(){
  renderGrowList();
  drawGrowthChart();
}
let growPage = 1;
const GROW_PER_PAGE = 10;
function renderGrowList(){
  const list = document.getElementById('growList');
  const pager = document.getElementById('growPager');
  const sorted = growth.slice().filter(g=>!g._deleted).sort((a,b)=>b.date - a.date);
  const total = sorted.length;
  const pages = Math.max(1, Math.ceil(total / GROW_PER_PAGE));
  if(growPage > pages) growPage = pages;
  document.getElementById('growCnt').textContent = total ? ('共 ' + total + ' 条') : '';
  if(!total){
    list.innerHTML = '<div class="empty">还没有成长记录<br>在上方添加体重 / 身高吧 📏</div>';
    pager.innerHTML = '';
    return;
  }
  const startIdx = (growPage - 1) * GROW_PER_PAGE;
  const pageItems = sorted.slice(startIdx, startIdx + GROW_PER_PAGE);
  let html = '';
  for(const r of pageItems){
    const d = new Date(r.date);
    const dateStr = (d.getMonth()+1) + '月' + d.getDate() + '日';
    const vals = [];
    if(r.weight != null) vals.push('体重 ' + r.weight + ' kg');
    if(r.height != null) vals.push('身高 ' + r.height + ' cm');
    html += '<div class="gitem" data-id="'+r.id+'">'
      + '<div class="info"><div class="date">'+dateStr+'</div>'
      + '<div class="vals">'+vals.join(' · ')+'</div></div>'
      + '<div class="acts"><button class="edit" data-id="'+r.id+'">修改</button>'
      + '<button class="del" data-id="'+r.id+'">删除</button></div></div>';
  }
  list.innerHTML = html;
  if(pages > 1){
    pager.innerHTML = '<button id="gpPrev"' + (growPage<=1 ? ' disabled' : '') + '>上一页</button>'
      + '<span class="pginfo">'+growPage+' / '+pages+'</span>'
      + '<button id="gpNext"' + (growPage>=pages ? ' disabled' : '') + '>下一页</button>';
  } else {
    pager.innerHTML = '';
  }
}
document.getElementById('growPager').addEventListener('click', e=>{
  if(e.target.id === 'gpPrev' && growPage > 1){ growPage--; renderGrowList(); }
  else if(e.target.id === 'gpNext'){ growPage++; renderGrowList(); }
});
document.getElementById('growList').addEventListener('click', e=>{
  const delBtn = e.target.closest('.del');
  const editBtn = e.target.closest('.edit');
  if(delBtn){
    const id = delBtn.dataset.id;
    confirmDialog('删除这条成长记录？', ()=>{
      growth = growth.map(x => x.id === id ? Object.assign({}, x, {_deleted:true, updatedAt:Date.now()}) : x);
      growPage = 1; saveGrowth(); renderGrowth(); toast('已删除');
    }, '删除记录');
  } else if(editBtn){
    openGrowEdit(editBtn.dataset.id);
  }
});
function openGrowEdit(id){
  const r = growth.find(x=>x.id === id); if(!r) return;
  growEditId = id;
  document.getElementById('geDate').value = fmtDate(r.date);
  document.getElementById('geWeight').value = r.weight != null ? r.weight : '';
  document.getElementById('geHeight').value = r.height != null ? r.height : '';
  document.getElementById('growEditOverlay').classList.add('show');
}
document.getElementById('geCancel').addEventListener('click', ()=>document.getElementById('growEditOverlay').classList.remove('show'));
document.getElementById('growEditOverlay').addEventListener('click', e=>{ if(e.target === e.currentTarget) e.currentTarget.classList.remove('show'); });
document.getElementById('geSave').addEventListener('click', ()=>{
  const r = growth.find(x=>x.id === growEditId); if(!r) return;
  const date = document.getElementById('geDate').value;
  if(!date){ toast('请选择日期'); return; }
  const w = parseFloat(document.getElementById('geWeight').value);
  const h = parseFloat(document.getElementById('geHeight').value);
  r.date = new Date(date + 'T00:00').getTime();
  r.weight = isNaN(w) ? null : w;
  r.height = isNaN(h) ? null : h;
  r.updatedAt = Date.now();
  saveGrowth(); renderGrowth();
  document.getElementById('growEditOverlay').classList.remove('show');
  toast('已保存');
});


/* 成长曲线（Canvas，单条曲线：体重 kg 或 身高 cm，各自独立绘制） */
function drawOneChart(cv, getVal, color, unit){
  if(!cv) return;
  const wrap = cv.parentElement;
  const cssW = wrap.clientWidth || 320;
  const cssH = 240;
  const dpr = window.devicePixelRatio || 1;
  cv.width = Math.round(cssW * dpr);
  cv.height = Math.round(cssH * dpr);
  cv.style.width = cssW + 'px';
  cv.style.height = cssH + 'px';
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const cs = getComputedStyle(document.documentElement);
  const sub = (cs.getPropertyValue('--sub') || '#999').trim();
  const line = (cs.getPropertyValue('--line') || '#eee').trim();

  const recs = growth.slice().sort((a,b)=>a.date - b.date);
  const pts = recs.map((r,i)=>({i, v:getVal(r)})).filter(p=>p.v != null);
  if(pts.length < 2){
    ctx.fillStyle = sub;
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('至少需要 2 条记录才能绘制' + unit + '曲线', cssW/2, cssH/2);
    return;
  }

  const padL = 42, padR = 16, padT = 16, padB = 28;
  const plotW = cssW - padL - padR;
  const plotH = cssH - padT - padB;
  const x0 = padL, y0 = padT;

  function yScale(val, mn, mx){
    if(mx === mn) return y0 + plotH/2;
    return y0 + plotH - (val - mn) / (mx - mn) * plotH;
  }
  function xAt(i){ return x0 + (recs.length === 1 ? 0 : i / (recs.length - 1) * plotW); }

  const vals = pts.map(p=>p.v);
  let mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
  const p = (mx - mn) * 0.15 || 1;
  mn -= p; mx += p;

  // 网格 + y 轴标签
  const rows = 4;
  ctx.lineWidth = 1;
  ctx.font = '11px sans-serif';
  for(let g = 0; g <= rows; g++){
    const yy = y0 + plotH * g / rows;
    ctx.strokeStyle = line;
    ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x0 + plotW, yy); ctx.stroke();
    const v = mx - (mx - mn) * g / rows;
    ctx.fillStyle = color; ctx.textAlign = 'right';
    ctx.fillText(unit === 'kg' ? v.toFixed(1) : v.toFixed(0), x0 - 6, yy + 4);
  }
  // x 轴日期标签
  ctx.fillStyle = sub; ctx.textAlign = 'center';
  const xt = Math.min(recs.length, 5);
  for(let t = 0; t < xt; t++){
    const i = xt === 1 ? 0 : Math.round(t * (recs.length - 1) / (xt - 1));
    const d = new Date(recs[i].date);
    ctx.fillText((d.getMonth()+1) + '/' + d.getDate(), xAt(i), cssH - 8);
  }

  // 曲线 + 数据点
  ctx.strokeStyle = color; ctx.lineWidth = 2.5;
  ctx.beginPath();
  pts.forEach((p, idx)=>{
    const xx = xAt(p.i), yy = yScale(p.v, mn, mx);
    if(idx === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
  });
  ctx.stroke();
  ctx.fillStyle = color;
  pts.forEach(p=>{
    const xx = xAt(p.i), yy = yScale(p.v, mn, mx);
    ctx.beginPath(); ctx.arc(xx, yy, 3.2, 0, Math.PI * 2); ctx.fill();
  });
}
function drawGrowthChart(){
  const accent = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#ff7088').trim();
  const blue = (getComputedStyle(document.documentElement).getPropertyValue('--L') || '#5b8def').trim();
  drawOneChart(document.getElementById('growthChartW'), r=>r.weight, accent, 'kg');
  drawOneChart(document.getElementById('growthChartH'), r=>r.height, blue, 'cm');
}
