/* ============================================================
 * 母乳喂养记录 PWA — 模块化拆分（自动由 index.html 切分）
 * 加载顺序须为：store → util → feed → growth → vaccine → sync → io → app
 * 本文件位置：6/8 WebDAV 同步
 * 普通 <script src>（非 ES module），共享全局作用域，兼容 android_asset
 * ============================================================ */

/* ===================== WebDAV 多端同步 ===================== */
const WEBDAV_KEY = 'bf_webdav';
let wdBusy = false, wdTimer = null, wdLast = 0, wdErr = '', wdStatus = '';
function getWebDav(){ try{ return JSON.parse(localStorage.getItem(WEBDAV_KEY)||'null'); }catch(e){ return null; } }
function wdBasic(cfg){ try{ return 'Basic ' + btoa(unescape(encodeURIComponent((cfg.user||'')+':'+(cfg.pass||'')))); }catch(e){ return ''; } }
function wdHeaders(cfg, extra){ return Object.assign({ 'Authorization': wdBasic(cfg) }, extra||{}); }
async function wdMkcol(cfg, url){
  try{
    const u = new URL(url); const segs = u.pathname.split('/').filter(Boolean); segs.pop();
    let base = u.origin;
    for(const seg of segs){ base += '/' + seg; try{ await fetch(base, { method:'MKCOL', headers: wdHeaders(cfg) }); }catch(e){} }
  }catch(e){}
}
async function wdGet(cfg){
  const r = await fetch(cfg.url, { method:'GET', headers: wdHeaders(cfg) });
  if(r.status === 404) return null;
  if(!r.ok) throw new Error('下载失败 HTTP '+r.status);
  try{ return await r.json(); }catch(e){ return null; }
}
async function wdPut(cfg, obj){
  await wdMkcol(cfg, cfg.url);
  const r = await fetch(cfg.url, { method:'PUT', headers: wdHeaders(cfg, {'Content-Type':'application/json'}), body: JSON.stringify(obj) });
  if(!r.ok) throw new Error('上传失败 HTTP '+r.status);
}
function mergeBoth(local, remote){
  const map = new Map();
  for(const x of (local||[])) if(x && x.id) map.set(x.id, x);
  for(const x of (remote||[])){
    if(!x || !x.id) continue;
    const cur = map.get(x.id);
    if(!cur || (x.updatedAt||0) > (cur.updatedAt||0)) map.set(x.id, x);
  }
  const out = []; const seen = new Set();
  for(const x of (local||[])){ if(x && x.id){ out.push(map.get(x.id)); seen.add(x.id); } }
  for(const x of (remote||[])){ if(x && x.id && !seen.has(x.id)){ out.push(x); seen.add(x.id); } }
  return out;
}
function sigArr(arr){ return (arr||[]).map(x=> x && x.id ? x.id+':'+(x.updatedAt||0)+':'+(x._deleted?1:0) : '').join('|'); }
function scheduleSync(){
  const cfg = getWebDav();
  if(!cfg || !cfg.url || wdBusy) return;
  clearTimeout(wdTimer);
  wdTimer = setTimeout(()=>{ syncNow(); }, 1500);
}
async function syncNow(){
  const cfg = getWebDav();
  if(!cfg || !cfg.url || wdBusy) return;
  wdBusy = true; updateWdUI('syncing');
  const prev = inSync; inSync = true;
  try{
    // 宝宝信息仅保存在本地，不同步、也不从远端更新
    const remote = await wdGet(cfg) || { sessions: [], growth: [] };
    const ms = mergeBoth(sessions, remote.sessions);
    const mg = mergeBoth(growth, remote.growth);
    const localSig = sigArr(sessions)+'#'+sigArr(growth);
    const remoteSig = sigArr(ms)+'#'+sigArr(mg);
    if(localSig !== remoteSig){
      sessions = ms; growth = mg;
      save(); saveGrowth();
      render(); renderGrowth();
    }
    // 锁定状态下：只读同步文件，不上传更新
    if(locked){
      wdLast = Date.now(); wdErr = ''; wdStatus = 'ok'; updateWdUI('ok');
      return;
    }
    // 同步内容仅含喂养(sessions)与成长(growth)
    const out = {
      sessions: sessions.map(s=> s.updatedAt ? s : Object.assign({}, s, {updatedAt:Date.now()})),
      growth: growth.map(g=> g.updatedAt ? g : Object.assign({}, g, {updatedAt:Date.now()}))
    };
    await wdPut(cfg, out);
    wdLast = Date.now(); wdErr = ''; wdStatus = 'ok'; updateWdUI('ok');
  }catch(e){
    wdErr = (e && e.message) ? e.message : String(e);
    wdStatus = 'error'; updateWdUI('error');
  }finally{
    inSync = prev; wdBusy = false;
  }
}
function updateWdUI(status){
  const el = document.getElementById('wdStatus'); if(!el) return;
  const cfg = getWebDav();
  if(!cfg || !cfg.url){ el.textContent = '未配置同步'; el.className = 'wd-status none'; return; }
  if(status === 'syncing'){ el.textContent = '同步中…'; el.className = 'wd-status syncing'; }
  else if(status === 'error'){ el.textContent = '同步失败：' + wdErr; el.className = 'wd-status error'; }
  else { el.textContent = '已同步 · ' + (wdLast ? fmtClock(wdLast) : ''); el.className = 'wd-status ok'; }
}
let wdIntStarted = false;
function startWdInterval(){ if(wdIntStarted) return; wdIntStarted = true; setInterval(()=>{ const c = getWebDav(); if(c && c.url) syncNow(); }, 60000); }
(function initSync(){
  const u = document.getElementById('wdUrl'), us = document.getElementById('wdUser'), p = document.getElementById('wdPass');
  const cfg = getWebDav() || {};
  if(u) u.value = cfg.url || '';
  if(us) us.value = cfg.user || '';
  if(p) p.value = cfg.pass || '';
  const saveCfg = ()=>{ const c = { url: u.value.trim(), user: us.value.trim(), pass: p.value }; localStorage.setItem(WEBDAV_KEY, JSON.stringify(c)); return c; };
  const bSave = document.getElementById('wdSave'), bNow = document.getElementById('wdNow');
  if(bSave) bSave.addEventListener('click', ()=>{ saveCfg(); startWdInterval(); toast('已保存同步配置'); syncNow(); });
  if(bNow) bNow.addEventListener('click', ()=>{ syncNow(); });
  updateWdUI('');
  if(cfg && cfg.url){ startWdInterval(); syncNow(); }
})();

/* 同步设置弹窗开关 */
(function initSyncOverlay(){
  const ov = document.getElementById('syncOverlay');
  const open = ()=>{ const cfg = getWebDav() || {}; const u = document.getElementById('wdUrl'); if(u) u.value = cfg.url || ''; ov.classList.add('show'); };
  const close = ()=> ov.classList.remove('show');
  const bOpen = document.getElementById('syncSetBtn');
  if(bOpen) bOpen.addEventListener('click', open);
  const bClose = document.getElementById('syncClose');
  if(bClose) bClose.addEventListener('click', close);
  if(ov) ov.addEventListener('click', e=>{ if(e.target === ov) close(); });
})();

