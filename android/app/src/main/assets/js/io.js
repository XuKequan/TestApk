/* ============================================================
 * 母乳喂养记录 PWA — 模块化拆分（自动由 index.html 切分）
 * 加载顺序须为：store → util → feed → growth → vaccine → sync → io → app
 * 本文件位置：7/8 导入导出
 * 普通 <script src>（非 ES module），共享全局作用域，兼容 android_asset
 * ============================================================ */

/* 导出 / 清空成长数据 */
/* 导出 / 清空 / 导入（同时操纵喂养与成长两套数据） */
function downloadJSON(obj, filename){
  const json = JSON.stringify(obj, null, 2);
  if(window.AndroidBridge && window.AndroidBridge.exportData){
    window.AndroidBridge.exportData(json);
  } else {
    try{
      const blob = new Blob([json], {type:'application/json'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    }catch(err){ toast('导出失败：'+err.message); }
  }
}
document.getElementById('exportAllBtn').addEventListener('click', ()=>{
  downloadJSON({ sessions: sessions, info: babyInfo, records: growth, vaccines: vaccines, appts: vacAppts, orgs: vacOrgs }, '喂养与成长与疫苗_'+fmtDate(Date.now())+'.json');
});
document.getElementById('clearAllBtn').addEventListener('click', ()=>{
  confirmDialog('确定清空全部数据（喂养记录、成长记录、宝宝信息、疫苗接种）？此操作不可恢复。', ()=>{
    sessions = []; selectedSide='L'; viewDate = startOfDay(Date.now()); save();
    growth = []; babyInfo = null; saveGrowth(); saveInfo();
    vaccines = []; saveVaccines(); renderVaccine();
    vacAppts = []; saveVacAppts();
    renderBabyInfo(); renderGrowth(); render();
    toast('已清空全部数据');
  }, '清空全部数据');
});
/* 导入：仅导入喂养记录（兼容旧版裸数组 / 新格式 {sessions}） */
document.getElementById('importBtn').addEventListener('click', ()=>{
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.onchange = e=>{
    const file = e.target.files && e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ev=>{
      try{
        const parsed = JSON.parse(ev.target.result);
        let arr = null;
        if(Array.isArray(parsed)) arr = parsed;
        else if(parsed && Array.isArray(parsed.sessions)) arr = parsed.sessions;
        let added = 0, addedG = 0;
        // 喂养记录
        if(arr && arr.length){
          const ids = new Set(sessions.map(s=>s.id));
          for(const s of arr){
            if(!s || s.start == null) continue;
            const id = s.id || uid();
            if(ids.has(id)) continue;
            ids.add(id);
            sessions.push(Object.assign({ id: id, updatedAt: Date.now() }, s));
            added++;
          }
          if(added){ save(); render(); }
        }
        // 成长记录（兼容 records / growth 两种键名；date 字段兼容 date/time/ts）
        const recArr = (parsed && Array.isArray(parsed.records)) ? parsed.records
                    : (parsed && Array.isArray(parsed.growth)) ? parsed.growth : [];
        if(recArr.length){
          const gids = new Set(growth.map(g=>g.id));
          for(const g of recArr){
            if(!g) continue;
            const gdate = (g.date != null) ? g.date : (g.time != null ? g.time : (g.ts != null ? g.ts : null));
            if(gdate == null) continue;
            const id = g.id || uid();
            if(gids.has(id)) continue;
            gids.add(id);
            growth.push(Object.assign({ id: id, date: gdate, updatedAt: Date.now() }, g));
            addedG++;
          }
          if(addedG){ saveGrowth(); renderGrowth(); }
        }
        // 宝宝信息
        if(parsed && parsed.info){
          babyInfo = Object.assign({}, parsed.info, { updatedAt: Date.now() });
          saveInfo(); renderBabyInfo();
        }
        // 疫苗接种
        let addedV = 0;
        if(parsed && Array.isArray(parsed.vaccines)){
          const vids = new Set(vaccines.map(v=>v.id));
          for(const v of parsed.vaccines){
            if(!v || v.start == null && v.date == null) continue;
            const id = v.id || uid();
            if(vids.has(id)) continue;
            vids.add(id);
            vaccines.push(Object.assign({ id: id, updatedAt: Date.now() }, v));
            addedV++;
          }
          if(addedV){ saveVaccines(); renderVaccine(); }
        }
        let addedA = 0;
        if(parsed && Array.isArray(parsed.appts)){
          const aids = new Set(vacAppts.map(a=>a.id));
          for(const a of parsed.appts){
            if(!a || !a.name || a.date == null) continue;
            const id = a.id || uid();
            if(aids.has(id)) continue;
            aids.add(id);
            vacAppts.push(Object.assign({ id: id, done: false, createdAt: Date.now() }, a));
            addedA++;
          }
          if(addedA){ saveVacAppts(); renderVaccine(); }
        }
        // 接种机构列表（合并去重，不删除设备上已有的机构）
        let addedO = 0;
        if(parsed && Array.isArray(parsed.orgs)){
          for(const o of parsed.orgs){
            if(!o) continue;
            const t = String(o).trim();
            if(!t || vacOrgs.includes(t)) continue;
            vacOrgs.push(t); addedO++;
          }
          if(addedO){ saveVacOrgs(); if(typeof refreshOrgSelectsKeep === 'function') refreshOrgSelectsKeep(); }
        }
        const msg = '已导入 ' + added + ' 条喂养记录' + (addedG ? '、' + addedG + ' 条成长记录' : '') + (addedV ? '、' + addedV + ' 条疫苗记录' : '') + (addedA ? '、' + addedA + ' 条疫苗预约' : '') + (addedO ? '、' + addedO + ' 个接种机构' : '') + (parsed && parsed.info ? '，宝宝信息已更新' : '');
        if(added || addedG || addedV || addedA || (parsed && parsed.info)) toast(msg);
        else toast('没有新的数据可导入');
      }catch(err){ toast('解析失败：'+err.message); }
    };
    reader.readAsText(file);
  };
  input.click();
});

