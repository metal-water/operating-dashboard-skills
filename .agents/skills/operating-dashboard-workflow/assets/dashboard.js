(() => {
  'use strict';
  const {report,display}=JSON.parse(document.getElementById('report-data').textContent);
  for(const [k,v]of Object.entries(display))document.documentElement.style.setProperty('--'+k.replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),typeof v==='number'?v+'px':v);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ptr=v=>String(v).replace(/~/g,'~0').replace(/\//g,'~1');
  const month=Number(report.period.month.slice(5)), range=`${Number(report.period.ytdStart.slice(5))}–${Number(report.period.ytdEnd.slice(5))}月`;
  const state={store:null,expanded:new Set(),full:new Set()};
  const app=document.getElementById('app');
  const iconLabels={good:'绿色标志',bad:'红色标志',warn:'黄色标志',neutral:'待核标志'};
  const displayName=name=>String(name??'').replace(/\s*小计/g,'').trim();
  function format(d,kind,precision=0){if(!d||d.state!=='present')return '--';if(kind==='text')return d.value;const rawDecimals=kind==='percent'?d.ref?.raw?.match(/\.(\d+)%$/)?.[1]?.length:null;if(rawDecimals!=null)precision=rawDecimals;const n=kind==='percent'?d.value*100:d.value;return typeof n==='number'?n.toLocaleString('en-US',{minimumFractionDigits:precision,maximumFractionDigits:precision})+(kind==='percent'?'%':''):String(n);}
  function value(d,kind,precision,path,signal,signalPath){
    const present=d?.state==='present',status=signal&&present?signal.status:null;
    const cls=!present?'empty':status?'signal-'+status:'';
    const icon=status?`<i class="indicator ${esc(signal.shape||'dot')} ${esc(status)}" role="img" aria-label="${esc(iconLabels[status])}" data-indicator-path="${esc(signalPath || path.replace(/\/(primary|secondary)$/,'/indicator'))}"></i>`:'';
    const title=!present?(d?.reason||'待核对'):'';
    return `<span class="value ${cls}" title="${esc(title)}">${icon}<span class="${kind==='text'?'':'number'}" data-value-path="${esc(path)}">${esc(format(d,kind,precision))}</span></span>`;
  }
  function badge(text,life){
    if(!text)return '<span class="status-empty">—</span>';
    const label=text.replace(/[✅❌\uFE0F\u200b]/g,'').trim();
    const cls=life||({'达成':'pass','不达成':'fail','未达成':'fail','临界':'risk'})[label]||'neutral';
    return `<span class="badge ${esc(cls)}">${esc(label)}</span>`;
  }
  function kpis(store){
    const items=store?store.kpis:report.kpis,base=store?`/stores/${report.stores.indexOf(store)}/kpis`:'/kpis';
    return `${store?.kpiNote?`<p class="basis-note">${esc(store.kpiNote)}</p>`:''}<section class="kpis" aria-label="${esc(store?.name||'公司')}四项经营指标">${items.map((k,i)=>`<article class="kpi" style="--accent:${/^#[a-f0-9]{6}$/i.test(k.color||'')?k.color:'#2573e8'}"><h3 class="kpi-title"><span class="kpi-icon" aria-hidden="true">${({turnover:'流',revenue:'收',issueGross:'发',projectGross:'利'})[k.id]||'经'}</span>${esc(k.label)}${k.sourceLabel&&k.sourceLabel!==k.label?`<small>${esc(k.sourceLabel)}</small>`:''}</h3><div class="kpi-periods">${['month','ytd'].map(g=>{
      const note=k[g+'Note'];
      return `<div class="kpi-period"><div class="period-label">${g==='month'?month+'月实际':range+'累计'}</div><div class="period-value">${value(k[g],k.kind||'amount',k.precision??0,`${base}/${i}/${g}`)}<small>${esc(k.unit||'万')}</small></div><div class="period-note">${note&&typeof note==='object'?value(note,'text',0,`${base}/${i}/${g}Note`,k[g+'Indicator'],`${base}/${i}/${g}Indicator`):esc(note||(k[g]?.state==='present'?'':k[g]?.missingKind==='no_source_column'?'原表未提供同口径指标':['unreadable','unresolved'].includes(k[g]?.state)?'待核对':'--'))}</div></div>`;
    }).join('')}</div></article>`).join('')}</section>`;
  }
  function fieldsButton(table){const full=state.full.has(table.id);return `<button class="command" data-full="${esc(table.id)}" aria-pressed="${full}" title="${full?'恢复原表默认可见行、列':'展示已读取的隐藏行和隐藏列'}">${full?'精简字段':'全部字段'}</button>`;}
  function tableHtml(table,path,overview){
    const full=!overview&&state.full.has(table.id);
    const groups=table.groups.map(g=>({...g,columns:g.columns.filter(c=>full||c.sourceHidden!==true)})).filter(g=>g.columns.length);
    const cols=groups.flatMap((g,gi)=>g.columns.map((c,ci)=>({g,c,key:g.id+'.'+c.id,boundary:gi>0&&ci===0})));
    const orderedRows=table.rows.map((row,index)=>({row,index}));
    if(!overview){
      const rank=r=>r.role==='total'?100:({new:0,old:1,dev:2,end:3})[r.lifecycle]??4;
      orderedRows.sort((a,b)=>rank(a.row)-rank(b.row)||(rank(a.row)>1&&rank(a.row)<100?String(a.row.statusText||'').localeCompare(String(b.row.statusText||''),'zh-CN'):0)||a.index-b.index);
    }
    let longest=0;
    const measure=rows=>rows.forEach(r=>{for(const {c,key}of cols){for(const s of ['primary','secondary']){const d=r.cells[key]?.[s];if(d?.state==='present')longest=Math.max(longest,String(format(d,s==='primary'?c.kind:c.secondaryFormat,s==='primary'?c.precision??0:c.secondaryPrecision??0)).length);}}measure(r.children||[]);});
    measure(table.rows);
    const metricWidth=Math.max(display.metricWidth,longest*display.tableMainSize*.62+40);
    const nw=display.nameWidth,sw=display.statusWidth;
    const colgroup=`<colgroup><col style="width:${nw}px"><col style="width:${sw}px">${cols.map(()=>'<col>').join('')}</colgroup>`;
    const head1=overview?`<th class="name" rowspan="2">${esc(table.nameLabel||'游戏项目组')}</th><th class="status" rowspan="2"><span class="status-heading">达成情况</span><small>${range}</small></th>`:`<th class="name unit">${esc(table.unitLabel||'人民币 万元')}</th><th class="status unit"></th>`;
    const heads=`<thead><tr>${head1}${groups.map((g,gi)=>`<th class="${esc(g.id)}${gi>0?' period-divider':''}" colspan="${g.columns.length}"><span class="group-title">${esc(!overview&&g.id==='month'?`${report.period.month.slice(0,4)}年${month}月实际`:g.label)}</span><small>${esc(!overview&&g.id==='month'?'下行：月度达成率':g.sublabel)}</small></th>`).join('')}</tr><tr>${overview?'':`<th class="name">${esc(table.nameLabel||'游戏项目')}</th><th class="status">状态</th>`}${cols.map(({g,c,boundary})=>`<th class="${esc(g.id)}${boundary?' period-divider':''}" data-column="${esc(g.id+'.'+c.id)}">${esc(c.label)}</th>`).join('')}</tr></thead>`;
    function rows(row,rowPath,child=false,parent=null,parentHidden=false){
      const hidden=parentHidden||(child&&!state.expanded.has(parent))||(!full&&row.sourceHidden===true);
      const expanded=state.expanded.has(rowPath),parentRow=overview&&!child&&!!row.storeId;
      const toggle=parentRow?`<button class="icon-button row-toggle" data-toggle="${esc(rowPath)}" aria-label="${expanded?'收起':'展开'}${esc(row.name)}项目" aria-expanded="${expanded}">${expanded?'−':'+'}</button>`:'';
      const name=parentRow?`<button class="store-link label" data-store="${esc(row.storeId)}">${esc(displayName(row.name))}</button>`:`<span class="label">${esc(displayName(row.name))}</span>`;
      const classes=`${row.role==='total'?'total ':''}${['old','new','dev','end'].includes(row.lifecycle)?row.lifecycle:'neutral'}${child?' child-row':''}`;
      const attrs=`${hidden?' hidden':''} data-row-id="${esc(row.id)}" data-source-hidden="${row.sourceHidden===null?'unknown':row.sourceHidden}"${child?` data-child-of="${esc(parent)}"`:''}`;
      const cells=slot=>cols.map(({g,c,key,boundary})=>{const cell=row.cells[key]||{};return `<td class="${esc(g.id)}${boundary?' period-divider':''}">${value(cell[slot],slot==='primary'?c.kind:c.secondaryFormat,slot==='primary'?c.precision??0:c.secondaryPrecision??0,`${rowPath}/cells/${ptr(key)}/${slot}`,cell.indicators?.[slot]||(cell.indicator?.slot===slot?cell.indicator:null), cell.indicators?.[slot]?`${rowPath}/cells/${ptr(key)}/indicators/${slot}`:null)}</td>`;}).join('');
      let html=`<tr class="primary ${classes}"${attrs}><td class="name" rowspan="2"><div class="name-content${child?' child':''}">${toggle}${name}</div></td><td class="status" rowspan="2">${badge(row.statusText,overview&&!child?null:row.lifecycle)}</td>${cells('primary')}</tr><tr class="secondary ${classes}"${attrs}>${cells('secondary')}</tr>`;
      html+=(row.children||[]).map((r,i)=>rows(r,`${rowPath}/children/${i}`,true,rowPath,hidden)).join('');
      if(parentRow&&!row.children?.length){
        const content=row.detailNote||'暂无可展示的同口径项目明细，可点击店名查看详情';
        html+=`<tr class="disclosure" data-child-of="${esc(rowPath)}"${hidden||!expanded?' hidden':''}><td colspan="${cols.length+2}">${esc(content)}</td></tr>`;
      }
      return html;
    }
    return `<div class="table-wrap ${overview?'overview':''}" tabindex="0" aria-label="${esc(table.title||table.nameLabel||'经营表格')}，可横向滚动"><table class="${overview?'overview-table':'detail-table'}" style="--table-min:${nw+sw+cols.length*metricWidth}px;--metric-count:${cols.length}">${colgroup}${heads}<tbody>${orderedRows.map(({row,index})=>rows(row,`${path}/rows/${index}`)).join('')}${table.rows.length?'':`<tr><td colspan="${cols.length+2}" class="no-data">暂无可展示的项目明细</td></tr>`}</tbody></table></div>`;
  }
  function schedule(){if(!report.schedule?.rows?.length)return '';return `<section class="table-section"><div class="heading"><h3>${esc(report.schedule.title||'产品排期')}</h3></div><div class="table-wrap schedule-wrap"><table class="schedule-table"><thead><tr>${report.schedule.columns.map(c=>`<th>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${report.schedule.rows.map((r,i)=>`<tr>${report.schedule.columns.map(c=>`<td>${value(r[c.id],'text',0,`/schedule/rows/${i}/${ptr(c.id)}`)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`;}
  let observers=[];
  function render(){
    observers.forEach(o=>o.disconnect());observers=[];
    const store=report.stores.find(s=>s.id===state.store);
    if(store){
      const si=report.stores.indexOf(store);
      app.innerHTML=`<div class="page-heading"><button class="back icon-button" data-back aria-label="返回总览">←</button><div><div class="eyebrow">门店经营</div><h2>${esc(store.name)}</h2></div><div class="crumb"><button data-back>公司总览</button><span>/</span><strong>${esc(store.name)}</strong></div></div>${kpis(store)}${store.tables.map((t,i)=>`<section class="table-section"><div class="heading"><h3>${esc(t.title||'项目经营明细')}</h3><div class="table-tools"><div class="legend" aria-label="项目状态图例"><span class="new">新在营</span><span class="old">在营</span><span class="dev">在研 / 未立项</span><span class="end">终止</span></div>${fieldsButton(t)}</div></div>${tableHtml(t,`/stores/${si}/tables/${i}`,false)}</section>`).join('')}`;
    }else{
      const paths=report.overview.rows.map((r,i)=>r.storeId&&r.sourceHidden!==true?`/overview/rows/${i}`:null).filter(Boolean),all=paths.every(p=>state.expanded.has(p));
      app.innerHTML=`<div class="page-heading"><div><div class="eyebrow">经营总览</div><h2>${esc(report.overviewTitle||'公司经营与门店总览')}</h2></div><span class="view-label">店维度</span></div>${kpis()}<section class="table-section"><div class="heading"><h3>${esc(report.overview.title||'门店经营汇总')}</h3><div class="table-tools"><button class="command primary-command" data-toggle-all>${all?'收起全部':'展开全部'}</button></div></div>${tableHtml(report.overview,'/overview',true)}</section>${schedule()}`;
      app.querySelector('[data-toggle-all]').onclick=()=>{paths.forEach(p=>all?state.expanded.delete(p):state.expanded.add(p));renderPreservingScroll();};
    }
    app.querySelectorAll('[data-toggle]').forEach(b=>b.onclick=()=>{const p=b.dataset.toggle;state.expanded.has(p)?state.expanded.delete(p):state.expanded.add(p);renderPreservingScroll();});
    app.querySelectorAll('[data-full]').forEach(b=>b.onclick=()=>{const id=b.dataset.full;state.full.has(id)?state.full.delete(id):state.full.add(id);renderPreservingScroll();});
    app.querySelectorAll('[data-store]').forEach(b=>b.onclick=()=>{state.store=b.dataset.store;render();window.scrollTo(0,0);});
    app.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>{state.store=null;render();window.scrollTo(0,0);});
    for(const t of app.querySelectorAll('table:not(.schedule-table)')){const update=()=>{t.style.setProperty('--head1',t.tHead.rows[0].getBoundingClientRect().height+'px');t.style.setProperty('--name-actual',t.tHead.querySelector('.name').getBoundingClientRect().width+'px');};update();const o=new ResizeObserver(update);o.observe(t);observers.push(o);}
  }
  function renderPreservingScroll(){const p=Array.from(app.querySelectorAll('.table-wrap')).map(e=>[e.scrollLeft,e.scrollTop]),y=window.scrollY;render();app.querySelectorAll('.table-wrap').forEach((e,i)=>{if(p[i]){e.scrollLeft=p[i][0];e.scrollTop=p[i][1];}});window.scrollTo(0,y);}
  document.getElementById('topbar').innerHTML=`<div class="brand"><span class="brand-mark">经</span><div><h1>${esc(report.title)}</h1><p>经营结果 · 产品排期 · 门店项目</p></div></div><div class="period">${month}月实际 <span>/</span> ${range}累计 <b>${esc(report.meetingLabel||report.period.month+' 实际')}</b></div>`;
  render();
})();
