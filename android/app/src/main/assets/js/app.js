/* ============================================================
 * 母乳喂养记录 PWA — 模块化拆分（自动由 index.html 切分）
 * 加载顺序须为：store → util → feed → growth → vaccine → sync → io → app
 * 本文件位置：8/8 初始化/导航/锁定
 * 普通 <script src>（非 ES module），共享全局作用域，兼容 android_asset
 * ============================================================ */

/* ---------- 仅明亮模式（无主题切换） ---------- */
/* 进入页面时确保安卓原生状态栏/导航栏为浅色背景 + 深色图标 */
(function(){
  try{
    const b = window.AndroidBridge;
    if(b && typeof b.setBarColors === 'function') b.setBarColors('#fff5f3','#fff5f3', true);
  }catch(e){}
})();

/* ---------- 页面切换（喂养 / 成长） ---------- */
function showPage(which){
  const map = {
    feed: { page: document.getElementById('pageFeed'), tab: document.getElementById('tabFeed') },
    grow: { page: document.getElementById('pageGrow'), tab: document.getElementById('tabGrow') },
    vac:  { page: document.getElementById('pageVaccine'), tab: document.getElementById('tabVaccine') }
  };
  for(const k in map){
    if(!map[k].page || !map[k].tab) continue;
    const active = (k === which);
    map[k].page.style.display = active ? '' : 'none';
    map[k].tab.classList.toggle('on', active);
  }
  if(which === 'grow') renderGrowth();   // 进入成长页时刷新列表与曲线
  if(which === 'vac')  renderVaccine();  // 进入疫苗页时刷新列表
}
document.getElementById('tabFeed').addEventListener('click', ()=>showPage('feed'));
document.getElementById('tabGrow').addEventListener('click', ()=>showPage('grow'));
document.getElementById('tabVaccine').addEventListener('click', ()=>showPage('vac'));


/* 锁定模式：禁用喂养页所有交互（仅查看数据），自动同步不受影响 */
let locked = false;
try { locked = localStorage.getItem('bf_locked') === '1'; } catch(e){}
function applyLock(){
  const page = document.getElementById('pageFeed');
  if(page) page.classList.toggle('locked', locked);
  const b = document.getElementById('lockBtn');
  if(b){
    b.textContent = locked ? '🔓 解锁' : '🔒 锁定';
    b.classList.toggle('on', locked);
  }
}
(function initLock(){
  const b = document.getElementById('lockBtn');
  if(b) b.addEventListener('click', ()=>{
    locked = !locked;
    try{ localStorage.setItem('bf_locked', locked ? '1' : '0'); }catch(e){}
    applyLock();
  });
  applyLock();
})();


window.addEventListener('resize', ()=>{
  if(document.getElementById('pageGrow').style.display !== 'none') drawGrowthChart();
});

/* 初始化成长页表单 */
renderBabyInfo();

render();
