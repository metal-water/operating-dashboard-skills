const formats = new Set(['amount', 'number', 'percent', 'text']);
const states = new Set(['present', 'missing', 'unreadable', 'unresolved']);
const pointer = value => String(value).replace(/~/g, '~0').replace(/\//g, '~1');

function slots(report) {
  const result = [];
  const add = (path, datum, kind = 'number', precision = 0, unit = '') => result.push({ path, datum, kind, precision, unit });
  function kpis(items, base) { (items || []).forEach((kpi, i) => {
    for (const period of ['month', 'ytd']) {
      add(`${base}/${i}/${period}`, kpi[period], kpi.kind || 'amount', kpi.precision ?? 0, kpi.unit || '');
      if (kpi[`${period}Note`] && typeof kpi[`${period}Note`] === 'object') add(`${base}/${i}/${period}Note`, kpi[`${period}Note`], 'text');
    }
  }); }
  kpis(report.kpis, '/kpis');
  (report.stores || []).forEach((store, i) => kpis(store.kpis, `/stores/${i}/kpis`));
  function table(table, path) {
    function visit(item, rowPath) {
      for (const group of table.groups || []) for (const col of group.columns || []) {
        const key = `${group.id}.${col.id}`;
        const cell = item.cells?.[key];
        add(`${rowPath}/cells/${pointer(key)}/primary`, cell?.primary, col.kind, col.precision ?? 0);
        add(`${rowPath}/cells/${pointer(key)}/secondary`, cell?.secondary, col.secondaryFormat, col.secondaryPrecision ?? 0);
      }
      (item.children || []).forEach((child, i) => visit(child, `${rowPath}/children/${i}`));
    }
    (table.rows || []).forEach((item, i) => visit(item, `${path}/rows/${i}`));
  }
  if (report.overview) table(report.overview, '/overview');
  (report.stores || []).forEach((store, i) => (store.tables || []).forEach((item, j) => table(item, `/stores/${i}/tables/${j}`)));
  (report.schedule?.rows || []).forEach((row, i) => (report.schedule.columns || []).forEach(col => add(`/schedule/rows/${i}/${pointer(col.id)}`, row[col.id], 'text')));
  return result;
}

function validate(report) {
  const errors = [];
  const check = (condition, message) => { if (!condition) errors.push(message); };
  check(report.schemaVersion === 1, 'schemaVersion must be 1');
  check(/^[a-z0-9][a-z0-9-]{0,63}$/.test(report.id || ''), 'id must be a portable lowercase slug');
  check(typeof report.title === 'string' && report.title.trim(), 'title is required');
  for (const field of ['month', 'ytdStart', 'ytdEnd']) check(/^\d{4}-(0[1-9]|1[0-2])$/.test(report.period?.[field] || ''), `period.${field} must be YYYY-MM`);
  check(report.period?.ytdStart <= report.period?.ytdEnd, 'YTD range must be chronological');
  check(report.period?.month === report.period?.ytdEnd, 'YTD end must equal report month');
  check(typeof report.period?.budgetVersion === 'string', 'budgetVersion must be explicit');
  check(Array.isArray(report.openIssues), 'openIssues must be an array');
  check(Array.isArray(report.sources) && report.sources.length > 0, 'sources are required');
  const sourceIds = new Set();
  const sourceTables = new Map();
  for (const source of report.sources || []) {
    check(source.id && !sourceIds.has(source.id), `duplicate or missing source id: ${source.id}`);
    sourceIds.add(source.id);
    check(source.location && source.revision, `source ${source.id} needs location and revision/snapshot`);
    const ids = new Set();
    for (const table of source.tables || []) {
      check(table.id && !ids.has(table.id), `duplicate or missing source table id: ${table.id}`);
      ids.add(table.id);
      check(['read', 'partial', 'inaccessible'].includes(table.coverage), `table ${table.id} coverage required`);
    }
    sourceTables.set(source.id, ids);
  }
  const checkRef = (ref, path) => {
    check(ref && sourceTables.get(ref.sourceId)?.has(ref.tableId), `${path}: unknown source/table`);
    check(Array.isArray(ref?.rowPath) && ref.rowPath.length && Array.isArray(ref?.columnPath) && ref.columnPath.length, `${path}: rowPath/columnPath required`);
  };
  const visibility = (item, path) => {
    check([true,false,null].includes(item.sourceHidden), `${path}: sourceHidden must be true, false or null (unknown)`);
    check(typeof item.visibilityEvidence === 'string' && item.visibilityEvidence.trim(), `${path}: visibilityEvidence required, including why unknown`);
  };
  const signal = (indicator, path) => {
    check(['good','bad','neutral','warn'].includes(indicator.status), `${path}: invalid indicator status`);
    check(['dot','flag','arrow'].includes(indicator.shape), `${path}: invalid indicator shape`);
    check(indicator.evidence, `${path}: indicator evidence required`);
    checkRef(indicator.ref,path);
  };
  function checkKpis(items, path) {
    const ids=['turnover','revenue','issueGross','projectGross'];
    check(Array.isArray(items) && items.length===4 && ids.every(id=>items.some(k=>k.id===id)), `${path}: four explicit KPI cards required; use evidenced missing/unknown values when unavailable`);
    (items||[]).forEach((k,i)=>['month','ytd'].forEach(p=>{if(k[p+'Indicator'])signal(k[p+'Indicator'],`${path}/${i}/${p}Indicator`)}));
  }
  check(Array.isArray(report.kpis), 'kpis must be an array');
  checkKpis(report.kpis,'/kpis');
  (report.stores||[]).forEach((store,i)=>checkKpis(store.kpis,`/stores/${i}/kpis`));
  const storeIds = new Set((report.stores || []).map(store => store.id));
  check(storeIds.size === (report.stores || []).length, 'duplicate store id');
  const tableIds = new Set();
  function checkTable(table, path, overview = false) {
    check(table?.id && !tableIds.has(table.id), `${path}: duplicate/missing table id`);
    tableIds.add(table?.id);
    check(table?.groups?.length > 0, `${path}: groups required`);
    const keys = new Set();
    const groupIds = new Set();
    for (const group of table.groups || []) {
      check(group.id && !groupIds.has(group.id), `${path}: duplicate/missing group id`);
      groupIds.add(group.id);
      check(group.columns?.length > 0, `${path}: group columns required`);
      for (const col of group.columns || []) {
        const key = `${group.id}.${col.id}`;
        check(col.id && col.label && !keys.has(key), `${path}: duplicate/missing column ${key}`);
        keys.add(key);
        visibility(col,`${path}/${key}`);
        check(formats.has(col.kind) && formats.has(col.secondaryFormat) && col.secondaryKind, `${path}: formats and secondaryKind required for ${key}`);
      }
    }
    const ids = new Set();
    function visit(row, depth = 0) {
      check(row.id && row.name && !ids.has(row.id), `${path}: duplicate or missing row identity ${row.id}`);
      ids.add(row.id);
      visibility(row,`${path}/${row.id}`);
      if (row.storeId) check(storeIds.has(row.storeId), `${path}: unknown store ${row.storeId}`);
      check(!row.children?.length || (overview && depth === 0), `${path}: only one child level is supported in overview`);
      for (const key of Object.keys(row.cells || {})) check(keys.has(key), `${path}/${row.id}: unmapped extra cell ${key}`);
      for (const key of keys) {
        check(row.cells?.[key], `${path}/${row.id}: missing explicit cell ${key}`);
        const indicator = row.cells?.[key]?.indicator;
        if (indicator) {
          check(['primary','secondary'].includes(indicator.slot),`${path}: invalid indicator slot`);
          signal(indicator,`${path}/${row.id}/${key}/indicator`);
        }
        for(const [slot,ind] of Object.entries(row.cells?.[key]?.indicators||{})) {
          check(['primary','secondary'].includes(slot),`${path}: invalid indicators key`);
          check(!indicator || indicator.slot!==slot,`${path}: duplicate indicator for ${slot}`);
          signal(ind,`${path}/${row.id}/${key}/indicators/${slot}`);
        }
      }
      (row.children || []).forEach(child => visit(child, depth + 1));
    }
    check(Array.isArray(table.rows), `${path}: rows required`);
    (table.rows || []).forEach(row => visit(row));
  }
  if (report.overview) checkTable(report.overview, '/overview', true); else errors.push('overview required');
  (report.stores || []).forEach(store => (store.tables || []).forEach(table => checkTable(table, `/stores/${store.id}`)));
  if (errors.length) return { errors, slots: [] };
  const all = slots(report);
  for (const { path, datum, kind, precision } of all) {
    check(states.has(datum?.state), `${path}: explicit datum state required`);
    check(formats.has(kind), `${path}: invalid format`);
    check(Number.isInteger(precision) && precision >= 0 && precision <= 6, `${path}: precision must be 0..6`);
    if (datum?.state === 'present') {
      check(kind === 'text' ? typeof datum.value === 'string' : typeof datum.value === 'number' && Number.isFinite(datum.value), `${path}: invalid ${kind} value`);
      checkRef(datum.ref, path);
      check(datum.ref?.raw != null && datum.ref?.unit != null && datum.ref?.period && datum.ref?.basis, `${path}: raw/unit/period/basis required`);
    } else {
      check(datum?.value === null && datum?.reason, `${path}: missing/unreadable/unresolved requires null and reason`);
      if(datum?.state==='missing') {
        check(['no_source_column','source_blank','source_dash'].includes(datum.missingKind),`${path}: missingKind must distinguish absent column, blank and dash`);
        check(datum.evidence,`${path}: missing evidence required`);
        checkRef(datum.ref,path);
      }
    }
  }
  check(Array.isArray(report.sourceFields) && report.sourceFields.length>0,'sourceFields inventory required before mapping');
  check(typeof report.sourceInventoryComplete==='boolean','sourceInventoryComplete required');
  const paths=new Set(all.map(s=>s.path)), fieldIds=new Set();
  for(const field of report.sourceFields||[]) {
    check(field.id && !fieldIds.has(field.id),'sourceFields: duplicate/missing field id');fieldIds.add(field.id);
    checkRef(field.ref,`sourceFields/${field.id}`);
    check(['mapped','not_applicable','unreadable','unresolved'].includes(field.state),`sourceFields/${field.id}: invalid state`);
    check(['primary','secondary','note'].includes(field.slot) && field.semantic,`sourceFields/${field.id}: slot/semantic required`);
    visibility(field,`sourceFields/${field.id}`);
    check(['current_read','snapshot'].includes(field.evidenceMode),`sourceFields/${field.id}: evidenceMode required`);
    check(Array.isArray(field.targetPaths),`sourceFields/${field.id}: targetPaths required`);
    if(field.state==='mapped')check(field.targetPaths?.length>0,`sourceFields/${field.id}: mapped field needs targets`);
    if(field.state!=='mapped')check(field.reason,`sourceFields/${field.id}: reason required`);
    for(const target of field.targetPaths||[])check(paths.has(target),`sourceFields/${field.id}: unknown target ${target}`);
  }
  const inventoriedPaths=new Set((report.sourceFields||[]).flatMap(f=>f.targetPaths||[]));
  for(const s of all)check(inventoriedPaths.has(s.path),`${s.path}: absent from sourceFields inventory`);
  return { errors, slots: all };
}

module.exports = { validate, slots, pointer };
