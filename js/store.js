/* ============================================================
 * 母乳喂养记录 PWA — 模块化拆分（自动由 index.html 切分）
 * 加载顺序须为：store → util → feed → growth → vaccine → sync → io → app
 * 本文件位置：1/8 数据层
 * 普通 <script src>（非 ES module），共享全局作用域，兼容 android_asset
 * ============================================================ */

const KEY = 'bf_sessions_v1';
const SIDE_NAME = {L:'左', R:'右', B:'双侧'};
let sessions = load();
// 喂养方式默认为「双侧」
function computeDefaultSide(){
  return 'B';
}
let selectedSide = computeDefaultSide();
let tick = null;
let viewDate = startOfDay(Date.now());
let editId = null;

function load(){ try{ return JSON.parse(localStorage.getItem(KEY)) || []; }catch(e){ return []; } }
let inSync = false;
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(sessions)); }catch(e){ console.warn('save failed', e); } if(!inSync) scheduleSync(); }
function getActive(){ return sessions.find(s => s.end === null && !s._deleted) || null; }

/* ---------- 宝宝成长记录 ---------- */
const KEY_INFO = 'bf_baby_info_v1';
const KEY_GROW = 'bf_growth_v1';
let babyInfo = loadInfo();
let growth = loadGrowth();
let growEditId = null;

function loadInfo(){ try{ return JSON.parse(localStorage.getItem(KEY_INFO)) || null; }catch(e){ return null; } }
function saveInfo(){ try{ localStorage.setItem(KEY_INFO, JSON.stringify(babyInfo)); }catch(e){} if(!inSync) scheduleSync(); }
function loadGrowth(){ try{ return JSON.parse(localStorage.getItem(KEY_GROW)) || []; }catch(e){ return []; } }
function saveGrowth(){ try{ localStorage.setItem(KEY_GROW, JSON.stringify(growth)); }catch(e){} if(!inSync) scheduleSync(); }

/* ---------- 疫苗接种记录（本地保存，不纳入 WebDAV 同步） ---------- */
const KEY_VAC = 'bf_vaccines_v1';
let vaccines = loadVaccines();
let vacEditId = null;
function loadVaccines(){ try{ return JSON.parse(localStorage.getItem(KEY_VAC)) || []; }catch(e){ return []; } }
function saveVaccines(){ try{ localStorage.setItem(KEY_VAC, JSON.stringify(vaccines)); }catch(e){ console.warn('save vaccines failed', e); } }

/* 接种机构列表（用户自定义，本地保存，不纳入 WebDAV 同步） */
const KEY_VAC_ORG = 'bf_vac_orgs_v1';
let vacOrgs = loadVacOrgs();
function loadVacOrgs(){
  try{
    const a = JSON.parse(localStorage.getItem(KEY_VAC_ORG));
    if(Array.isArray(a) && a.length) return a;
  }catch(e){}
  return ['社区卫生服务中心', '妇幼保健院', '儿童门诊', '街道防保科'];
}
function saveVacOrgs(){ try{ localStorage.setItem(KEY_VAC_ORG, JSON.stringify(vacOrgs)); }catch(e){ console.warn('save vac orgs failed', e); } }
/* 填充机构下拉：sel 为 select 元素，selected 为预选值 */
function fillOrgSelect(sel, selected){
  if(!sel) return;
  let html = '<option value="">— 请选择 —</option>';
  for(const o of vacOrgs){
    html += '<option value="'+esc(o)+'"'+(o === selected ? ' selected' : '')+'>'+esc(o)+'</option>';
  }
  html += '<option value="__add__">＋ 添加机构…</option>';
  sel.innerHTML = html;
}
/* 弹窗新增机构：成功返回机构名，取消返回 null */
function addVacOrgViaPrompt(preset){
  const name = prompt('添加接种机构名称：' + (preset ? '（' + preset + '）' : ''));
  if(name == null) return null;
  const t = name.trim();
  if(!t) return null;
  if(!vacOrgs.includes(t)){ vacOrgs.push(t); saveVacOrgs(); }
  return t;
}

/* 疫苗预约（用户自行选择接种时间，本地保存，不纳入 WebDAV 同步） */
const KEY_VAC_APPTS = 'bf_vac_appts_v1';
let vacAppts = loadVacAppts();
function loadVacAppts(){
  try{
    const a = JSON.parse(localStorage.getItem(KEY_VAC_APPTS));
    return Array.isArray(a) ? a : [];
  }catch(e){ return []; }
}
function saveVacAppts(){ try{ localStorage.setItem(KEY_VAC_APPTS, JSON.stringify(vacAppts)); }catch(e){ console.warn('save vac appts failed', e); } }

/* ---------- 疫苗方案库（参考平西府防保科免疫规划，含免费+自费） ---------- */
/* d = 目标接种天数（按出生起算，30≈1月龄）; v = 疫苗名（带剂次）; tag = 同类去重词; self = 自费; price = 参考价 ¥ */
const VAC_SCHEDULE = [
  { d: 0,    v: '乙肝①',                     tag: '乙肝',     note: '出生后24小时内' },
  { d: 0,    v: '卡介苗(BCG)',               tag: '卡介苗',   note: '出生后尽快接种' },
  { d: 30,   v: '乙肝②',                     tag: '乙肝' },
  { d: 45,   v: '五价轮状①',                 tag: '五价轮状', self: true, price: 305 },
  { d: 45,   v: '13价肺炎①',                 tag: '13价肺炎', self: true, price: 483 },
  { d: 60,   v: '脊灰(IPV)①',                tag: '脊灰' },
  { d: 60,   v: '百白破①',                   tag: '百白破' },
  { d: 60,   v: '五联①',                     tag: '五联',     self: true, price: 663, note: '替代 IPV+百白破+HIB' },
  { d: 75,   v: '五价轮状②',                 tag: '五价轮状', self: true, price: 305 },
  { d: 90,   v: '脊灰(IPV)②',                tag: '脊灰' },
  { d: 90,   v: '五联②',                     tag: '五联',     self: true, price: 663 },
  { d: 105,  v: '五价轮状③',                 tag: '五价轮状', self: true, price: 305 },
  { d: 105,  v: '13价肺炎②',                 tag: '13价肺炎', self: true, price: 483 },
  { d: 105,  v: '五联③',                     tag: '五联',     self: true, price: 663 },
  { d: 120,  v: '脊灰(OPV)③',                tag: '脊灰' },
  { d: 120,  v: '百白破②',                   tag: '百白破' },
  { d: 120,  v: 'HIB①',                      tag: 'HIB',      self: true, price: 127 },
  { d: 150,  v: 'HIB②',                      tag: 'HIB',      self: true, price: 127 },
  { d: 165,  v: '13价肺炎③',                 tag: '13价肺炎', self: true, price: 483 },
  { d: 180,  v: '流脑A① 或 AC结合①',         tag: '流脑',     self: true, price: 145 },
  { d: 180,  v: '百白破③(未种五联免)',       tag: '百白破',   note: '已选五联则免' },
  { d: 210,  v: 'AC结合② + HIB③',            tag: 'HIB',      self: true, price: 145 },
  { d: 240,  v: '麻风腮①',                   tag: '麻腮风' },
  { d: 270,  v: '流脑A② 或 AC结合②',         tag: '流脑',     self: true, price: 145 },
  { d: 300,  v: 'EV71手足口①',               tag: 'EV71手足口', self: true, price: 213 },
  { d: 330,  v: 'EV71手足口②',               tag: 'EV71手足口', self: true, price: 213 },
  { d: 365,  v: '乙脑减毒① 或 乙脑灭活①',    tag: '乙脑',     self: true, price: 241 },
  { d: 365,  v: '国产口服轮状①',             tag: '国产轮状', self: true, price: 163 },
  { d: 365,  v: '水痘①',                     tag: '水痘',     self: true, price: 149 },
  { d: 380,  v: '乙脑灭活②',                 tag: '乙脑',     self: true, price: 241 },
  { d: 420,  v: '13价肺炎④',                 tag: '13价肺炎', self: true, price: 483 },
  { d: 540,  v: '甲肝① + 麻风腮②',           tag: '甲肝' },
  { d: 540,  v: '百白破④',                   tag: '百白破' },
  { d: 540,  v: 'HIB③(未种五联)',            tag: 'HIB',      self: true, price: 127 },
  { d: 540,  v: '五联④(已种五联)',           tag: '五联',     self: true, price: 663 },
  { d: 730,  v: '甲肝②',                     tag: '甲肝' },
  { d: 730,  v: '乙脑减毒② 或 乙脑灭活③',    tag: '乙脑',     self: true, price: 241 },
  { d: 1095, v: '23价肺炎',                  tag: '23价肺炎', self: true, price: 205 },
  { d: 1460, v: '脊灰④',                     tag: '脊灰' },
  { d: 2190, v: '流脑A+C 或 ACYW135流脑',    tag: '流脑',     self: true, price: 161 },
  { d: 2190, v: '麻腮风③ + 百白破⑤',         tag: '百白破' },
  { d: 2190, v: '乙脑灭活④',                 tag: '乙脑',     self: true, price: 241 }
];

/* 归一疫苗名：去掉剂次符号 / 第N剂 / 括号 / "或"后面的可选项 等，用于同疫苗去重 */
function vacNorm(name){
  if(!name) return '';
  let s = String(name);
  s = s.replace(/[①②③④⑤⑥⑦⑧⑨]/g, '');
  s = s.replace(/第[一二三四五六七八九十0-9]+剂/g, '');
  s = s.replace(/[1-9]\s*剂/g, '');
  s = s.replace(/[()（）\[\]]/g, '');
  s = s.replace(/\s+/g, '');
  const bar = s.indexOf('或');
  if(bar >= 0) s = s.slice(0, bar);
  return s;
}
function vacDoneTags(){
  const set = new Set();
  for(const v of vaccines){
    if(v._deleted) continue;
    const n = vacNorm(v.name);
    if(n) set.add(n);
  }
  return set;
}
/* 把目标天数 d 转为"X 月龄" 或 "X 岁" 等可读字符串 */
function vacAgeLabel(d){
  if(d < 30) return d + ' 天';
  if(d < 365){
    const m = Math.floor(d / 30);
    const r = d % 30;
    return m + ' 月龄' + (r ? (' · ' + r + ' 天') : '');
  }
  const y = Math.floor(d / 365);
  const remD = d - y * 365;
  const m = Math.floor(remD / 30);
  return y + ' 岁' + (m ? (' · ' + m + ' 月') : '');
}
