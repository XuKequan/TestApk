/* ============================================================
 * 母乳喂养记录 PWA — 模块化拆分（自动由 index.html 切分）
 * 加载顺序须为：store → util → feed → growth → vaccine → sync → io → app
 * 本文件位置：5/8 疫苗页
 * 普通 <script src>（非 ES module），共享全局作用域，兼容 android_asset
 * ============================================================ */

/* 计算疫苗预约摘要：{upcoming, overdue, next, hasAny} —— 倒计时基于用户预约时间，不依赖出生日期 */
function vacApptSummary(){
  const now = Date.now();
  const upcoming = [], overdue = [], doneList = [];
  for(const a of vacAppts){
    if(a._deleted) continue;
    if(a.done){ doneList.push(a); continue; }
    if(a.date >= now) upcoming.push(a);
    else overdue.push(a);
  }
  upcoming.sort((x,y)=>x.date - y.date);
  overdue.sort((x,y)=>x.date - y.date);
  return { upcoming, overdue, doneList, next: upcoming[0] || null, hasAny: (upcoming.length + overdue.length + doneList.length) > 0 };
}

/* 渲染下次接种倒计时卡片（基于预约时间） */
function renderVacNext(){
  const el = document.getElementById('vacNext');
  if(!el) return;
  const s = vacApptSummary();
  let html = '';
  if(s.overdue.length){
    html += '<div class="next-hero overdue">'
      + '<div class="next-big">⚠ ' + s.overdue.length + ' 个预约已过期</div>'
      + '<div class="next-sub">预约时间已过，请尽快补种或重新预约</div>'
      + '</div>';
    html += '<ul class="ow-list">';
    for(const a of s.overdue.slice(0, 4)){
      html += '<li>'
        + '<span class="ow-name">' + esc(a.name) + '</span>'
        + '<span class="ow-age">' + fmtDateTime(a.date) + '</span>'
        + '</li>';
    }
    if(s.overdue.length > 4) html += '<li class="ow-more">还有 ' + (s.overdue.length - 4) + ' 个已过期…</li>';
    html += '</ul>';
  }
  if(s.next){
    const days = Math.ceil((s.next.date - Date.now()) / 86400000);
    const heroCls = days <= 3 ? 'next-hero soon' : 'next-hero';
    const big = days <= 0 ? '今天' : (days + ' 天');
    html += '<div class="' + heroCls + '">'
      + '<div class="next-big"><span class="hl">' + big + '</span> 后</div>'
      + '<div class="next-name">' + esc(s.next.name) + '</div>'
      + '<div class="next-meta">' + fmtDateTime(s.next.date) + (s.next.note ? (' · ' + esc(s.next.note)) : '') + '</div>'
      + '</div>';
  } else if(!s.overdue.length){
    html += '<div class="empty-tip">还没有疫苗预约<br>在下方「疫苗预约」添加第一针吧 🗓️</div>';
  }
  const rest = s.upcoming.slice(1, 4);
  if(rest.length){
    html += '<div class="ow-title">后续预约</div><ul class="ow-list">';
    for(const a of rest){
      const d = Math.ceil((a.date - Date.now()) / 86400000);
      html += '<li><span class="ow-name">' + esc(a.name) + '</span><span class="ow-age">还差 ' + (d<=0?'今天':d+' 天') + '</span></li>';
    }
    html += '</ul>';
  }
  el.innerHTML = html;
}

/* 渲染方案预览（按月龄分组，标记完成/漏打/未来） */
function renderVacSchedule(){
  const el = document.getElementById('vacSched');
  const cnt = document.getElementById('schedCnt');
  if(cnt){
    const done = vacDoneTags();
    const total = VAC_SCHEDULE.length;
    let finished = 0;
    for(const it of VAC_SCHEDULE){ if(done.has(vacNorm(it.v))) finished++; }
    cnt.textContent = ' ' + finished + ' / ' + total;
  }
  if(!el) return;
  const done = vacDoneTags();
  // 按月龄分组（用 d 桶化），仅作参考清单；倒计时改由「疫苗预约」驱动，不按出生日期推算
  const groups = {};
  for(const it of VAC_SCHEDULE){
    const key = vacAgeLabel(it.d);
    if(!groups[key]) groups[key] = [];
    groups[key].push(it);
  }
  let html = '';
  for(const key of Object.keys(groups)){
    const items = groups[key];
    const allDone = items.every(x => done.has(vacNorm(x.v)));
    const tag = allDone ? '<span class="g-tag done">✓ 完成</span>' : '<span class="g-tag">待接种</span>';
    html += '<div class="sched-group">'
      + '<div class="sched-title">' + key + tag + '</div>'
      + '<ul class="sched-list">';
    for(const it of items){
      const finished = done.has(vacNorm(it.v));
      html += '<li class="' + (finished ? 'done' : '') + '">'
        + '<span class="ck">' + (finished ? '✓' : '·') + '</span>'
        + '<span class="nm">' + esc(it.v) + '</span>'
        + (it.self ? '<span class="chip self">自费</span>' : '<span class="chip free">免费</span>')
        + '</li>';
    }
    html += '</ul></div>';
  }
  el.innerHTML = html;
}

/* ---------- 疫苗接种页面逻辑 ---------- */
function renderVaccine(){
  renderVacNext();
  renderVacSchedule();
  renderVacPick();
  renderApptPick();
  renderAppts();
  renderVacList();
}
let vacPage = 1;
const VAC_PER_PAGE = 30;
function renderVacList(){
  const list = document.getElementById('vacList');
  if(!list) return;
  const sorted = vaccines.slice().filter(v=>!v._deleted).sort((a,b)=>b.date - a.date);
  const total = sorted.length;
  const cnt = document.getElementById('vacCnt');
  if(cnt) cnt.textContent = total ? ('共 ' + total + ' 条') : '';
  if(!total){
    list.innerHTML = '<div class="empty">还没有接种记录<br>在上方添加第一针吧 💉</div>';
    return;
  }
  const pages = Math.max(1, Math.ceil(total / VAC_PER_PAGE));
  if(vacPage > pages) vacPage = pages;
  const startIdx = (vacPage - 1) * VAC_PER_PAGE;
  const items = sorted.slice(startIdx, startIdx + VAC_PER_PAGE);
  let html = '';
  for(const v of items){
    const d = new Date(v.date);
    const dateStr = (d.getMonth()+1) + '月' + d.getDate() + '日';
    const sub = [];
    if(v.site) sub.push(esc(v.site));
    if(v.org) sub.push(esc(v.org));
    html += '<div class="gitem" data-id="'+v.id+'">'
      + '<div class="info"><div class="date">'+esc(v.name || '(未命名)')+' · '+dateStr+'</div>'
      + (sub.length ? '<div class="vals">'+sub.join(' · ')+'</div>' : '')
      + (v.note ? '<div class="vals">'+esc(v.note)+'</div>' : '')
      + '</div>'
      + '<div class="acts"><button class="edit" data-id="'+v.id+'">修改</button>'
      + '<button class="del" data-id="'+v.id+'">删除</button></div></div>';
  }
  list.innerHTML = html;
}

/* 方案速选下拉：列出方案中所有项（按方案顺序），标记"已完成"，选中后自动填名称与备注。倒计时不依赖出生日期 */
function renderVacPick(){
  const sel = document.getElementById('vPick');
  if(!sel) return;
  const done = vacDoneTags();
  // 按月龄分组
  const groups = {};
  for(const it of VAC_SCHEDULE){
    const key = vacAgeLabel(it.d);
    if(!groups[key]) groups[key] = [];
    groups[key].push(it);
  }
  let html = '<option value="">— 请选择疫苗 —</option>';
  // 待接种优先，最后显示已完成的
  const unfinishedKeys = [];
  const finishedKeys = [];
  for(const key of Object.keys(groups)){
    const items = groups[key];
    const allDone = items.every(x => done.has(vacNorm(x.v)));
    (allDone ? finishedKeys : unfinishedKeys).push({key, items});
  }
  if(unfinishedKeys.length){
    html += '<optgroup label="— 待接种 —">';
    for(const g of unfinishedKeys){
      for(const it of g.items){
        const label = it.v + (it.self ? ' (¥' + it.price + ')' : '');
        html += '<option value="' + esc(it.v) + '" data-d="' + it.d + '" data-self="' + (it.self?1:0) + '" data-price="' + (it.price||0) + '" data-note="' + esc(it.note || '') + '">' + esc(label) + ' · ' + g.key + '</option>';
      }
    }
    html += '</optgroup>';
  }
  if(finishedKeys.length){
    html += '<optgroup label="— 已完成（可重新选择以补记）—">';
    for(const g of finishedKeys){
      for(const it of g.items){
        html += '<option value="' + esc(it.v) + '" data-d="' + it.d + '" data-self="' + (it.self?1:0) + '" data-price="' + (it.price||0) + '" data-note="' + esc(it.note || '') + '">✓ ' + esc(it.v) + ' · ' + g.key + '</option>';
      }
    }
    html += '</optgroup>';
  }
  sel.innerHTML = html;
}

/* 方案时间表折叠 */
document.getElementById('schedToggle').addEventListener('click', e=>{ e.stopPropagation(); });
document.getElementById('schedHead').addEventListener('click', ()=>{
  const body = document.getElementById('vacSched');
  const btn = document.getElementById('schedToggle');
  if(!body) return;
  const shown = body.style.display !== 'none';
  body.style.display = shown ? 'none' : '';
  btn.textContent = shown ? '展开 ▾' : '收起 ▴';
});

/* 速选下拉 → 自动填名称/日期/机构/备注（剂次从疫苗名①-⑨已含，不再单独填） */
document.getElementById('vPick').addEventListener('change', e=>{
  const opt = e.target.selectedOptions[0];
  if(!opt || !opt.value) return;
  const it = VAC_SCHEDULE.find(x => x.v === opt.value);
  if(!it) return;
  // 日期：未填写时默认填今天（倒计时不按出生日期推算，由「疫苗预约」决定）
  const dateInput = document.getElementById('vDate');
  if(!dateInput.value){
    dateInput.value = fmtDate(Date.now());
  }
  // 备注：根据方案自费性自动选"自费/免费"
  if(!document.getElementById('vNote').value){
    document.getElementById('vNote').value = it.self ? '自费' : '免费';
  }
  toast('已填入方案：' + it.v);
});

/* 添加 / 修改 之前：处理机构下拉的"＋ 添加机构…"选项 */
function handleOrgAdd(sel){
  if(sel && sel.value === '__add__'){
    const t = addVacOrgViaPrompt();
    if(t) fillOrgSelect(sel, t);
    else sel.value = '';
  }
}
document.getElementById('vOrg').addEventListener('change', e=>handleOrgAdd(e.target));
document.getElementById('veOrg').addEventListener('change', e=>handleOrgAdd(e.target));
document.getElementById('aOrg').addEventListener('change', e=>handleOrgAdd(e.target));

/* 进入疫苗页时填充机构下拉（默认空选） */
function refreshVacOrgSelects(){
  fillOrgSelect(document.getElementById('vOrg'), '');
  fillOrgSelect(document.getElementById('veOrg'), '');
  fillOrgSelect(document.getElementById('aOrg'), '');
}
/* 在 renderVaccine 之前先确保机构下拉就绪 */
if(document.getElementById('vOrg')) refreshVacOrgSelects();

/* 机构管理：增删改（改名 / 删除 / 添加），改完保留当前选中并刷新三个下拉 */
function refreshOrgSelectsKeep(){
  for(const id of ['vOrg','veOrg','aOrg']){
    const sel = document.getElementById(id);
    if(!sel) continue;
    const cur = (sel.value && sel.value !== '__add__' && vacOrgs.includes(sel.value)) ? sel.value : '';
    fillOrgSelect(sel, cur);
  }
}
function renderOrgManage(){
  const list = document.getElementById('orgManageList');
  if(!list) return;
  if(!vacOrgs.length){ list.innerHTML = '<div class="empty-tip">还没有机构，点下方"＋ 添加机构"</div>'; return; }
  let html = '';
  for(const o of vacOrgs){
    html += '<div class="org-manage-row" data-org="'+esc(o)+'">'
      + '<span class="nm">'+esc(o)+'</span>'
      + '<button type="button" class="rename" data-act="rename" data-org="'+esc(o)+'">改名</button>'
      + '<button type="button" class="del" data-act="del" data-org="'+esc(o)+'">删除</button>'
      + '</div>';
  }
  list.innerHTML = html;
}
document.getElementById('vOrgManageBtn').addEventListener('click', ()=>{
  renderOrgManage();
  document.getElementById('orgManageOverlay').classList.add('show');
});
document.getElementById('orgManageClose').addEventListener('click', ()=>{
  document.getElementById('orgManageOverlay').classList.remove('show');
});
document.getElementById('orgManageAdd').addEventListener('click', ()=>{
  const t = addVacOrgViaPrompt();
  if(t){ saveVacOrgs(); refreshOrgSelectsKeep(); renderOrgManage(); }
});
document.getElementById('orgManageList').addEventListener('click', e=>{
  const btn = e.target.closest('button');
  if(!btn) return;
  const act = btn.dataset.act;
  const oldName = btn.dataset.org;
  const row = btn.closest('.org-manage-row');
  if(act === 'rename'){
    /* 进入行内编辑（不用 window.prompt，安卓 WebView 未设 WebChromeClient 会吞掉原生对话框） */
    row.innerHTML = '<input type="text" class="org-edit-input" value="'+esc(oldName)+'">'
      + '<button type="button" class="ok" data-act="rename-ok" data-org="'+esc(oldName)+'">保存</button>'
      + '<button type="button" class="cancel" data-act="rename-cancel" data-org="'+esc(oldName)+'">取消</button>';
    const inp = row.querySelector('input');
    inp.focus(); inp.select();
  } else if(act === 'rename-ok'){
    const t = row.querySelector('input').value.trim();
    if(!t){ toast('名称不能为空'); return; }
    if(t !== oldName && vacOrgs.includes(t)){ toast('已存在同名机构'); return; }
    const idx = vacOrgs.indexOf(oldName);
    if(idx >= 0) vacOrgs[idx] = t;
    saveVacOrgs(); refreshOrgSelectsKeep(); renderOrgManage();
    toast('已改名');
  } else if(act === 'rename-cancel'){
    renderOrgManage();
  } else if(act === 'del'){
    confirmDialog('删除机构「'+oldName+'」？已接种记录中写过的该机构名称不会自动更改。', ()=>{
      const idx = vacOrgs.indexOf(oldName);
      if(idx >= 0) vacOrgs.splice(idx, 1);
      saveVacOrgs(); refreshOrgSelectsKeep(); renderOrgManage();
      toast('已删除');
    }, '删除机构');
  }
});
document.getElementById('orgManageOverlay').addEventListener('click', e=>{
  if(e.target.id === 'orgManageOverlay') e.currentTarget.classList.remove('show');
});

document.getElementById('vAdd').addEventListener('click', ()=>{
  const name = document.getElementById('vPick').value.trim();
  const date = document.getElementById('vDate').value;
  const orgSel = document.getElementById('vOrg');
  if(orgSel && orgSel.value === '__add__') handleOrgAdd(orgSel);
  if(!name){ toast('请先从方案选择疫苗'); return; }
  if(!date){ toast('请选择接种日期'); return; }
  const ts = new Date(date + 'T00:00').getTime();
  vaccines.push({
    id: uid(), name: name, date: ts,
    site: document.getElementById('vSite').value,
    org: document.getElementById('vOrg').value,
    note: document.getElementById('vNote').value,
    updatedAt: Date.now()
  });
  saveVaccines(); renderVaccine();
  document.getElementById('vPick').value = '';
  document.getElementById('vSite').value = '';
  document.getElementById('vOrg').value = '';
  document.getElementById('vNote').value = '';
  document.getElementById('vDate').value = fmtDate(Date.now());
  toast('已添加记录');
});
document.getElementById('vacList').addEventListener('click', e=>{
  const delBtn = e.target.closest('.del');
  const editBtn = e.target.closest('.edit');
  if(delBtn){
    const id = delBtn.dataset.id;
    confirmDialog('删除这条接种记录？', ()=>{
      vaccines = vaccines.map(x => x.id === id ? Object.assign({}, x, {_deleted:true, updatedAt:Date.now()}) : x);
      vacPage = 1; saveVaccines(); renderVaccine(); toast('已删除');
    }, '删除记录');
  } else if(editBtn){
    openVacEdit(editBtn.dataset.id);
  }
});

/* ---------- 疫苗预约逻辑（倒计时基于预约时间，不依赖出生日期） ---------- */
/* 预约速选下拉：列出方案中所有项（按方案顺序） */
function renderApptPick(){
  const sel = document.getElementById('aPick');
  if(!sel) return;
  const groups = {};
  for(const it of VAC_SCHEDULE){
    const key = vacAgeLabel(it.d);
    if(!groups[key]) groups[key] = [];
    groups[key].push(it);
  }
  let html = '<option value="">— 请选择疫苗 —</option>';
  for(const key of Object.keys(groups)){
    const items = groups[key];
    html += '<optgroup label="'+key+'">';
    for(const it of items){
      const label = it.v + (it.self ? ' (¥' + it.price + ')' : '');
      html += '<option value="'+esc(it.v)+'">'+esc(label)+'</option>';
    }
    html += '</optgroup>';
  }
  sel.innerHTML = html;
}
/* 预约列表渲染：未完成按时间升序在前，已完成排最后 */
function renderAppts(){
  const list = document.getElementById('apptList');
  if(!list) return;
  const now = Date.now();
  const sorted = vacAppts.slice().filter(a=>!a._deleted).sort((a,b)=>{
    if(a.done !== b.done) return a.done ? 1 : -1;
    return a.date - b.date;
  });
  if(!sorted.length){
    list.innerHTML = '<div class="empty">还没有疫苗预约<br>在上方添加，倒计时会自动更新 🗓️</div>';
    return;
  }
  let html = '';
  for(const a of sorted){
    const overdue = !a.done && a.date < now;
    const cls = a.done ? 'done' : (overdue ? 'ovd' : '');
    html += '<div class="appt-item '+cls+'" data-id="'+a.id+'">'
      + '<div class="info">'
      + '<div class="date">' + esc(a.name || '(未命名)') + ' · ' + fmtDateTime(a.date) + (a.done ? ' · 已完成' : '') + '</div>'
      + (a.note ? '<div class="vals">'+esc(a.note)+'</div>' : '')
      + '</div>'
      + '<div class="acts">'
      + (a.done ? '' : '<button class="rec" data-id="'+a.id+'">记录接种</button>')
      + '<button class="toggle" data-id="'+a.id+'">' + (a.done ? '恢复' : '完成') + '</button>'
      + '<button class="del" data-id="'+a.id+'">删除</button>'
      + '</div>'
      + '</div>';
  }
  list.innerHTML = html;
}
/* 预约名称直接取 aPick 的值，无需额外回填 */
/* 预约日期时间：日期原生日历 + 时分线性滚轮（不循环），合并为一个选择组件 */
let apptDT = { dateStr: fmtDate(Date.now()), h: new Date().getHours(), m: new Date().getMinutes() };
const aDateTimeBtn = document.getElementById('aDateTimeBtn');
function refreshApptDateTime(){
  const d = new Date(apptDT.dateStr + 'T00:00');
  aDateTimeBtn.textContent = (d.getMonth()+1)+'月'+d.getDate()+'日 ' + pad(apptDT.h)+':'+pad(apptDT.m);
}
refreshApptDateTime();
/* 构建预约专用时分滚轮（与补记的滚轮 DOM 独立，避免冲突） */
buildWheel(document.getElementById('awH'), 23);
buildWheel(document.getElementById('awM'), 59);
document.getElementById('aDateTimeBtn').addEventListener('click', ()=>{
  const ov = document.getElementById('apptPickerOverlay');
  document.getElementById('apDate').value = apptDT.dateStr;
  ov.classList.add('show');
  requestAnimationFrame(()=>{
    setWheel(document.getElementById('awH'), apptDT.h);
    setWheel(document.getElementById('awM'), apptDT.m);
    markWheel(document.getElementById('awH'), 23);
    markWheel(document.getElementById('awM'), 59);
  });
});
document.getElementById('apCancel').addEventListener('click', ()=>document.getElementById('apptPickerOverlay').classList.remove('show'));
document.getElementById('apOk').addEventListener('click', ()=>{
  const d = document.getElementById('apDate').value;
  if(d) apptDT.dateStr = d;
  apptDT.h = wheelVal(document.getElementById('awH'), 23);
  apptDT.m = wheelVal(document.getElementById('awM'), 59);
  refreshApptDateTime();
  document.getElementById('apptPickerOverlay').classList.remove('show');
});
/* 添加预约 */
document.getElementById('aAdd').addEventListener('click', ()=>{
  const name = document.getElementById('aPick').value.trim();
  const orgSel = document.getElementById('aOrg');
  if(orgSel && orgSel.value === '__add__') handleOrgAdd(orgSel);
  if(!name){ toast('请先从方案选择疫苗'); return; }
  if(!apptDT.dateStr){ toast('请选择预约日期'); return; }
  const ts = new Date(apptDT.dateStr + 'T' + pad(apptDT.h) + ':' + pad(apptDT.m)).getTime();
  if(isNaN(ts)){ toast('预约时间无效'); return; }
  vacAppts.push({ id: uid(), name: name, date: ts, org: orgSel ? orgSel.value : '', done: false, createdAt: Date.now() });
  saveVacAppts(); renderVaccine();
  document.getElementById('aPick').value = '';
  document.getElementById('aOrg').value = '';
  apptDT = { dateStr: fmtDate(Date.now()), h: new Date().getHours(), m: new Date().getMinutes() }; refreshApptDateTime();
  toast('已添加预约');
});
/* 预约列表操作：记录接种 / 完成 / 删除 */
document.getElementById('apptList').addEventListener('click', e=>{
  const btn = e.target.closest('button');
  if(!btn) return;
  const id = btn.dataset.id;
  const a = vacAppts.find(x=>x.id === id);
  if(!a) return;
  if(btn.classList.contains('del')){
    confirmDialog('删除这条预约？', ()=>{
      vacAppts = vacAppts.map(x => x.id === id ? Object.assign({}, x, {_deleted:true}) : x);
      saveVacAppts(); renderVaccine(); toast('已删除');
    }, '删除预约');
  } else if(btn.classList.contains('toggle')){
    a.done = !a.done; a.updatedAt = Date.now();
    saveVacAppts(); renderVaccine(); toast(a.done ? '已标记为完成' : '已恢复为待接种');
  } else if(btn.classList.contains('rec')){
    const pick = document.getElementById('vPick');
    pick.value = a.name;
    // 兜底：预约名不在标准方案选项里时，动态插入一个 option 以确保能选中
    if(pick.value !== a.name){
      const opt = document.createElement('option');
      opt.value = a.name; opt.textContent = a.name + '（自定义）';
      pick.appendChild(opt); pick.value = a.name;
    }
    document.getElementById('vDate').value = fmtDate(a.date);
    const noteSel = document.getElementById('vNote');
    if(noteSel && a.note && !noteSel.value) noteSel.value = a.note;
    // 注意：此处不调用 renderVaccine()，否则 renderVacPick 会重建 option 把选中值冲掉
    if(pick.scrollIntoView) pick.scrollIntoView({behavior:'smooth', block:'center'});
    toast('已预填到「添加接种记录」，填好部位/机构后点添加即可');
  }
});

function openVacEdit(id){
  const v = vaccines.find(x=>x.id === id); if(!v) return;
  vacEditId = id;
  document.getElementById('veName').value = v.name || '';
  document.getElementById('veDate').value = fmtDate(v.date);
  document.getElementById('veSite').value = v.site || '';
  document.getElementById('veNote').value = v.note || '';
  fillOrgSelect(document.getElementById('veOrg'), v.org || '');
  document.getElementById('vacEditOverlay').classList.add('show');
}
document.getElementById('veCancel').addEventListener('click', ()=>document.getElementById('vacEditOverlay').classList.remove('show'));
document.getElementById('vacEditOverlay').addEventListener('click', e=>{ if(e.target === e.currentTarget) e.currentTarget.classList.remove('show'); });
document.getElementById('veSave').addEventListener('click', ()=>{
  const v = vaccines.find(x=>x.id === vacEditId); if(!v) return;
  const name = document.getElementById('veName').value.trim();
  const date = document.getElementById('veDate').value;
  const orgSel = document.getElementById('veOrg');
  if(orgSel.value === '__add__'){ toast('请先添加并选择机构'); return; }
  if(!name){ toast('请填写疫苗名称'); return; }
  if(!date){ toast('请选择接种日期'); return; }
  v.name = name;
  v.date = new Date(date + 'T00:00').getTime();
  v.site = document.getElementById('veSite').value;
  v.org = orgSel.value;
  v.note = document.getElementById('veNote').value;
  v.updatedAt = Date.now();
  saveVaccines(); renderVaccine();
  document.getElementById('vacEditOverlay').classList.remove('show');
  toast('已保存');
});
