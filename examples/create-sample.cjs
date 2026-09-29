const fs=require('node:fs');
const path=require('node:path');

// Deliberately fictional values; the small data set is generated to keep every ref consistent.
const ref=(table,row,col,value,unit='万元')=>({sourceId:'sample',tableId:table,rowPath:[row],columnPath:col,cell:`synthetic:${row}:${col.join('/')}`,raw:unit==='percent'?Number((value*100).toFixed(6))+'%':String(value),unit,period:col[0].includes('累计')?'2026-01/2026-07':'2026-07',basis:'虚构同口径示例',budgetVersion:col[0].includes('预算')||col[0].includes('完成')||col[0].includes('VS')?'T2+10':null});
const datum=(value,table,row,col,unit)=>({value,state:'present',ref:ref(table,row,col,value,unit)});
const missing=()=>({value:null,state:'missing',reason:'虚构源表没有提供此字段'});
function cell(table,row,label,period,a,b,type='amount',secondaryKind='completion_rate') {
  const primary=datum(a,table,row,[period==='month'?'7月实际':'1-7月累计实际',label],type==='percent'?'percent':'万元');
  const secondary=b===null?missing():datum(b,table,row,[period==='month'?'7月实际vs预算完成率%':secondaryKind==='budget'?'1-7月累计T2+10预算':'1-7月累计VS T2+10',label],secondaryKind==='budget'?'万元':'percent');
  return {primary,secondary};
}
const groups=(detail=false)=>[
  {id:'month',label:'7月实际',sublabel:'完成率 / 完成绝对值',columns:[
    {id:'revenue',label:'收入',kind:'amount',secondaryKind:'completion_rate',secondaryFormat:'percent'},
    {id:'ratio',label:'研发店费毛比',kind:'percent',secondaryKind:'absolute_difference',secondaryFormat:'percent'}
  ]},
  {id:'ytd',label:'1-7月累计',sublabel:detail?'实际 / VS T2+10':'实际 / T2+10预算',columns:[
    {id:'revenue',label:'收入',kind:'amount',secondaryKind:detail?'completion_rate':'budget',secondaryFormat:detail?'percent':'amount'}
  ]}
];
function row(id,name,table,detail=false,seed=0) {
  const item={id,name,lifecycle:seed%2?'new':'old',statusText:seed%2?'未达成':'达成',cells:{
    'month.revenue':cell(table,name,'收入','month',seed===1?0:420+seed*7,.96),
    'month.ratio':cell(table,name,'研发店费毛比','month',.71,-.02,'percent','absolute_difference'),
    'ytd.revenue':cell(table,name,'收入','ytd',2140+seed*9,detail?1.04:2100+seed*5,'amount',detail?'completion_rate':'budget')
  }};
  item.cells['month.ratio'].secondary.ref.columnPath[0]='7月实际vs预算完成绝对值';
  item.cells['month.ratio'].indicator={status:'good',shape:'flag',slot:'secondary',ref:item.cells['month.ratio'].secondary.ref,evidence:'虚构表明确提供达成标志'};
  return item;
}
function sample(){
  const a=row('a','示例研发店','summary');a.storeId='a';
  a.children=Array.from({length:12},(_,i)=>row(`pa${i}`,i===1?'示例长项目名称（海外与移动版）':`示例游戏 ${i+1}`,'detail-a',true,i));
  const b=row('b','示例发行店','summary',false,1);b.storeId='b';
  b.children=[row('pb1','示例发行游戏','detail-b',true,2)];
  const company=row('company','公司合计','summary');company.role='total';company.cells['month.revenue'].primary.value=420;company.cells['month.revenue'].primary.ref.raw='420';
  const detailA={id:'detail-a',title:'示例研发项目',nameLabel:'游戏项目',groups:groups(true),rows:JSON.parse(JSON.stringify(a.children))};
  const detailB={id:'detail-b',title:'示例发行项目',nameLabel:'游戏项目',groups:groups(true),rows:JSON.parse(JSON.stringify(b.children))};
  for(const child of [...a.children,...b.children]) child.cells['ytd.revenue'].secondary={value:null,state:'missing',reason:'源表仅列 VS T2+10 完成率，未列该项目原始预算；不按完成率逆算预算'};
  detailB.groups[0].columns.push({id:'issueNet',label:'发行店净利',kind:'amount',secondaryKind:'completion_rate',secondaryFormat:'percent',optional:true});
  detailB.rows[0].cells['month.issueNet']={primary:datum(-12,'detail-b','示例发行游戏',['7月实际','发行店净利']),secondary:missing()};
  const report={
    schemaVersion:1,id:'synthetic-monthly',title:'示例经营看板（虚构数据）',period:{month:'2026-07',ytdStart:'2026-01',ytdEnd:'2026-07',budgetVersion:'T2+10'},
    sources:[{id:'sample',title:'虚构月报',location:'synthetic://example/monthly',revision:'sample-v1',tables:['company','summary','detail-a','detail-b','schedule'].map(id=>({id,title:id,coverage:'read'}))}],
    kpis:[['turnover','流水','#2573e8',820,6100],['revenue','收入','#735ed8',420,3500],['issueGross','发行毛利','#e49a22',128,930],['projectGross','项目毛利','#16a474',90,720]].map(([id,label,color,m,y])=>({id,label,color,unit:'万',month:datum(m,'company','公司',[`7月实际`,label]),ytd:datum(y,'company','公司',['1-7月累计实际',label]),monthNote:datum('96% 达成率','company','公司',['7月实际vs预算完成率%',label],'text'),ytdNote:datum('104% 达成率','company','公司',['1-7月累计完成率%',label],'text')})),
    overview:{id:'summary',nameLabel:'游戏项目组',groups:groups(),rows:[company,a,b]},
    stores:[{id:'a',name:a.name,tables:[detailA]},{id:'b',name:b.name,tables:[detailB]}],
    schedule:{title:'产品排期',columns:[{id:'project',label:'项目'},{id:'milestone',label:'节点'},{id:'date',label:'日期'}],rows:[{project:datum('示例新产品','schedule','示例新产品',['项目'],'text'),milestone:datum('版本测试','schedule','示例新产品',['节点'],'text'),date:datum('2026-08','schedule','示例新产品',['计划月份'],'text')}]},
    openIssues:[]
  };
  // Test fixtures are generated mechanically; they are never independent source-audit evidence.
  for(const store of report.stores) {
    store.kpis=report.kpis.map(k=>({id:k.id,label:k.label,color:k.color,unit:k.unit,
      month:{value:null,state:'missing',missingKind:'no_source_column',reason:'虚构分表没有同口径指标',evidence:'虚构完整表头检查',ref:ref(store.tables[0].id,store.name,['7月实际',k.label],'--')},
      ytd:{value:null,state:'missing',missingKind:'no_source_column',reason:'虚构分表没有同口径指标',evidence:'虚构完整表头检查',ref:ref(store.tables[0].id,store.name,['1-7月累计',k.label],'--')}
    }));
  }
  a.name+='小计';
  detailA.rows[10].sourceHidden=true;detailA.rows[10].name='示例隐藏项目';a.children[10].sourceHidden=true;
  for(const item of detailA.rows) { item.statusText=item.lifecycle==='new'?'新在营':'在营'; }
  detailA.rows[2].lifecycle='end';detailA.rows[2].statusText='终止';
  detailA.rows[4].lifecycle='dev';detailA.rows[4].statusText='在研';
  detailA.rows[6].lifecycle='dev';detailA.rows[6].statusText='未立项';
  const detailTotal=row('a-total','示例项目小计','detail-a',true);detailTotal.role='total';detailA.rows.splice(2,0,detailTotal);
  detailA.groups[0].columns.push({id:'internalCost',label:'隐藏成本',kind:'amount',secondaryKind:'completion_rate',secondaryFormat:'percent'});
  for(const item of detailA.rows)item.cells['month.internalCost']=cell('detail-a',item.name,'隐藏成本','month',18,.9);
  for(const group of detailA.groups)for(const [id,label]of [['gross','毛利'],['gross2','毛利2']]){
    group.columns.push({id,label,kind:'amount',secondaryKind:'completion_rate',secondaryFormat:'percent',optional:true});
    for(const item of detailA.rows)item.cells[`${group.id}.${id}`]=cell('detail-a',item.name,label,group.id,30,1.12);
  }
  detailA.groups[1].columns.push({id:'ratio',label:'项目费毛比',kind:'percent',secondaryKind:'absolute_difference',secondaryFormat:'percent'});
  for(const item of detailA.rows) {
    const c=cell('detail-a',item.name,'项目费毛比','ytd',-34567.89,34567.89,'percent','absolute_difference');
    c.secondary.ref.columnPath=['1-7月累计远端对照：绝对差额','项目费毛比'];
    c.secondary.ref.cell='synthetic:far-right:'+item.id;
    c.secondary.ref.visibleText='456789%';c.secondary.ref.readMethod='synthetic full cell';
    c.indicators={primary:{status:'good',shape:'dot',evidence:'虚构绿色图标',ref:c.primary.ref},secondary:{status:'bad',shape:'flag',evidence:'虚构红旗及完整单元格值',ref:c.secondary.ref}};
    item.cells['ytd.ratio']=c;
  }
  for(const table of [report.overview,detailA,detailB]) {
    for(const group of table.groups)for(const col of group.columns){col.sourceHidden=['issueNet','internalCost'].includes(col.id);col.visibilityEvidence='虚构源列可见性标记';}
    const visit=item=>{
      item.sourceHidden??=false;item.visibilityEvidence='虚构源行可见性标记';
      for(const [key,c]of Object.entries(item.cells))for(const slot of ['primary','secondary'])if(c[slot].state==='missing') {
        Object.assign(c[slot],{missingKind:'no_source_column',evidence:'虚构完整表头检查',ref:ref(table.id,item.name,[key.split('.')[0]==='ytd'?'1-7月累计':'7月实际',key.split('.')[1],slot],'--')});
      }
      (item.children||[]).forEach(visit);
    };table.rows.forEach(visit);
  }
  const {slots}=require('../.agents/skills/operating-dashboard-workflow/scripts/contract.cjs');
  const fields=new Map();
  for(const s of slots(report)) {
    const kind=s.path.endsWith('secondary')?'secondary':s.path.endsWith('Note')?'note':'primary';
    const r=s.datum.ref, key=JSON.stringify([r.tableId,r.columnPath,kind]);
    if(!fields.has(key))fields.set(key,{id:'fixture-field-'+fields.size,slot:kind,semantic:kind==='secondary'?'source_comparison':'source_value',state:'mapped',sourceHidden:r.columnPath.some(label=>['发行店净利','隐藏成本'].includes(label)),visibilityEvidence:'虚构源字段清单',evidenceMode:'current_read',ref:r,targetPaths:[]});
    fields.get(key).targetPaths.push(s.path);
  }
  report.sourceFields=[...fields.values()];report.sourceInventoryComplete=true;
  return report;
}
if(require.main===module){const destination=path.join(__dirname,'synthetic-report.json');fs.writeFileSync(destination,JSON.stringify(sample(),null,2),'utf8');console.log(destination)}
module.exports={sample};
