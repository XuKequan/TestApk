/* ============================================================
 * 母乳喂养记录 PWA — 模块化拆分（自动由 index.html 切分）
 * 加载顺序须为：store → util → feed → growth → vaccine → sync → io → app
 * 本文件位置：2/8 工具函数
 * 普通 <script src>（非 ES module），共享全局作用域，兼容 android_asset
 * ============================================================ */

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function buzz(ms){ try{ navigator.vibrate && navigator.vibrate(ms); }catch(e){} }

/* 时区：强制使用北京时间（UTC+8），不受设备所在时区影响（出国也不变）。
   所有日期显示/解析统一走北京时区；中国 UTC+8 无夏令时，与历史数据存储一致。 */
const APP_TZ = 8 * 3600 * 1000;
function bj(ts){ return new Date((ts == null ? Date.now() : ts) + APP_TZ); }
/* 把「北京时间的 日期+时分」字符串解析为 UTC 毫秒（存储用） */
function parseBJ(dateStr, timeStr){ return new Date(dateStr + 'T' + (timeStr || '00:00') + ':00+08:00').getTime(); }
/* 当前北京时间的时/分，用于表单默认填充 */
function bjH(){ return bj(Date.now()).getUTCHours(); }
function bjM(){ return bj(Date.now()).getUTCMinutes(); }
function startOfDay(ts){ const d = bj(ts); d.setUTCHours(0,0,0,0); return d.getTime() - APP_TZ; }
function isSameDay(a,b){ return startOfDay(a) === startOfDay(b); }

function pad(n){ return n<10 ? '0'+n : ''+n; }
function fmtHMS(ms){
  let s = Math.max(0, Math.floor(ms/1000));
  const h = Math.floor(s/3600); s -= h*3600;
  const m = Math.floor(s/60); s -= m*60;
  return pad(h)+':'+pad(m)+':'+pad(s);
}
// 时长显示为「时分」 H:MM
function fmtHM(ms){
  const m = Math.max(0, Math.round(ms/60000));
  return Math.floor(m/60) + ':' + pad(m%60);
}
// 时长显示为「分秒」带单位，如 10分15秒；超过1小时则加「时」
function fmtMinSec(ms){
  let s = Math.max(0, Math.round(ms/1000));
  const h = Math.floor(s/3600); s -= h*3600;
  const m = Math.floor(s/60); s -= m*60;
  if(h>0) return h+'时'+m+'分'+s+'秒';
  return m+'分'+s+'秒';
}
/* 间隔显示：距上一次喂养的时长（天/小时/分钟，不带秒） */
function fmtGap(ms){
  if(ms < 60000) return '不到1分钟';
  const totalMin = Math.round(ms/60000);
  const days = Math.floor(totalMin/1440);
  const hours = Math.floor((totalMin%1440)/60);
  const mins = totalMin%60;
  if(days>0) return days+'天'+(hours>0?hours+'小时':'')+(mins>0&&hours===0?mins+'分钟':'');
  if(hours>0) return hours+'小时'+(mins>0?mins+'分钟':'');
  return mins+'分钟';
}
function fmtClock(ts){
  const d = bj(ts);
  return pad(d.getUTCHours())+':'+pad(d.getUTCMinutes());
}
function fmtDate(ts){
  const d = bj(ts);
  return d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate());
}
function fmtDateCn(ts){
  const d = bj(ts);
  const wk = ['日','一','二','三','四','五','六'][d.getUTCDay()];
  return (d.getUTCMonth()+1)+'月'+d.getUTCDate()+'日 周'+wk;
}
/* 预约时间格式：8月15日 10:30 */
function fmtDateTime(ts){
  const d = bj(ts);
  const hh = pad(d.getUTCHours()), mm = pad(d.getUTCMinutes());
  return (d.getUTCMonth()+1)+'月'+d.getUTCDate()+'日 '+(hh==='00'&&mm==='00'?'':hh+':'+mm);
}
function fmtRelative(ts){
  const diff = Date.now() - ts;
  if(diff < 60000) return '刚刚';
  if(diff < 3600000) return Math.floor(diff/60000)+'分钟前';
  if(diff < 86400000) return Math.floor(diff/3600000)+'小时前';
  return Math.floor(diff/86400000)+'天前';
}
function netDuration(s){
  const end = s.end != null ? s.end : Date.now();
  let paused = s.pausedTotal || 0;
  if(s.end == null && s.pausedAt) paused += Date.now() - s.pausedAt;
  return Math.max(0, end - s.start - paused);
}
function liveElapsed(s){
  let paused = s.pausedTotal || 0;
  if(s.pausedAt) paused += Date.now() - s.pausedAt;
  return Math.max(0, Date.now() - s.start - paused);
}

/* ---------- 轻提示 / 确认弹窗 ---------- */
let toastTimer = null;
function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove('show'), 2200);
}
function confirmDialog(msg, onOk, title){
  document.getElementById('cfMsg').textContent = msg;
  document.getElementById('cfTitle').textContent = title || '确认';
  const ov = document.getElementById('confirmOverlay');
  ov.classList.add('show');
  const ok = document.getElementById('cfOk');
  const cancel = document.getElementById('cfCancel');
  ok.onclick = ()=>{ ov.classList.remove('show'); onOk(); };
  cancel.onclick = ()=>{ ov.classList.remove('show'); };
}
/* HTML 转义，避免用户输入（疫苗名称/备注）造成 XSS */
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* ---------- 滚轮时间选择器 ---------- */
let pickerApply = null;
function buildWheel(wheel, max){
  let html = '';
  for(let i=0;i<=max;i++) html += '<div class="witem" data-v="'+i+'">'+pad(i)+'</div>';
  wheel.innerHTML = '<div class="wpad"></div>'+html+'<div class="wpad"></div>';
  wheel.onscroll = ()=> markWheel(wheel, max);
}
function markWheel(wheel, max){
  const idx = Math.min(max, Math.max(0, Math.round(wheel.scrollTop/40)));
  wheel.querySelectorAll('.witem').forEach(el=>{
    el.classList.toggle('on', parseInt(el.dataset.v,10)===idx);
  });
}
function wheelVal(wheel, max){ return Math.min(max, Math.max(0, Math.round(wheel.scrollTop/40))); }
function setWheel(wheel, val){ wheel.scrollTop = val*40; }
function openPicker(initH, initM, apply){
  pickerApply = apply;
  const wh = document.getElementById('wheelH'), wm = document.getElementById('wheelM');
  document.getElementById('pickerOverlay').classList.add('show');
  // 弹窗显示后（有布局）再定位滚轮，保证高亮与选中带精确对齐
  requestAnimationFrame(()=>{
    setWheel(wh, initH); setWheel(wm, initM);
    markWheel(wh, 23); markWheel(wm, 59);
  });
}
buildWheel(document.getElementById('wheelH'), 23);
buildWheel(document.getElementById('wheelM'), 59);
document.getElementById('pCancel').addEventListener('click', ()=>document.getElementById('pickerOverlay').classList.remove('show'));
document.getElementById('pOk').addEventListener('click', ()=>{
  const h = wheelVal(document.getElementById('wheelH'),23);
  const m = wheelVal(document.getElementById('wheelM'),59);
  document.getElementById('pickerOverlay').classList.remove('show');
  if(pickerApply) pickerApply(h, m);
});

