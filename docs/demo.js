'use strict';

// All entities below are invented for interaction only. No source report is loaded.
// Financial values do not exist in this file, the HTML, CSS, attributes, or storage.
(() => {
  const state = { store: null, project: null, expanded: new Set(), full: false, sort: 'group', notesOpen: false, notes: '' };
  const statuses = { new: { label: '新在营', order: 0 }, old: { label: '老在营', order: 1 }, dev: { label: '在研 / 预研', order: 2 }, end: { label: '终止', order: 3 } };
  const sampleCounts = [5, 4, 3, 2, 4, 1];
  const stores = sampleCounts.map((count, index) => {
    const letter = String.fromCharCode(65 + index);
    return { id: letter, name: `示例门店 ${letter}`, pass: index % 2 === 0, projects: Array.from({ length: count }, (_, j) => ({
      id: `${letter}-${j + 1}`, name: `示例项目 ${letter}-${j + 1}`, status: ['new', 'old', 'dev', 'end', 'new'][j], order: count - j
    })) };
  });
  const overviewFields = ['收入', '研发店净利', '发行店净利', '研发店费毛比', '发行店费毛比', '研发净利人效', '发行净利人效'];
  const detailFields = [
    { label: '收入' }, { label: '广告', extra: true }, { label: '宣传', extra: true }, { label: '运维', extra: true },
    { label: '分成', extra: true }, { label: '版权金摊销', extra: true }, { label: '外包', extra: true },
    { label: '毛利' }, { label: '研发外包', extra: true }, { label: '项目人力', extra: true }, { label: '毛利2' },
    { label: '研发利润占比', extra: true }, { label: '费毛比' }, { label: '项目净利' },
    { label: '项目成本', extra: true }, { label: '研发费毛比' }, { label: '研发店净利' }
  ];
  const mask = (size = '') => `<span class="mosaic ${size}" role="img" aria-label="经营数据已隐藏" title="公开演示：原始数据已移除"></span>`;
  const badge = pass => `<span class="badge ${pass ? 'pass' : 'fail'} demo-status" title="虚构状态，仅演示样式">${pass ? '达成' : '未达成'}</span>`;
  const statusBadge = code => `<span class="badge ${code}" title="虚构状态，仅演示分组">${statuses[code].label}</span>`;
  const toast = text => {
    const el = document.getElementById('toast');
    el.textContent = text; el.hidden = false;
    clearTimeout(toast.timer); toast.timer = setTimeout(() => { el.hidden = true; }, 2800);
  };
  function navigate(store = null, project = null) {
    const next = store ? `#store-${store}${project ? `/project-${project}` : ''}` : '#overview';
    if (location.hash === next) loadRoute(); else location.hash = next;
  }
  function loadRoute() {
    const match = /^#store-([A-F])(?:\/project-([A-F]-\d+))?$/.exec(location.hash);
    state.store = match ? stores.find(s => s.id === match[1]) : null;
    state.project = state.store && match?.[2] ? state.store.projects.find(p => p.id === match[2]) || null : null;
    state.full = false; state.sort = 'group'; state.notesOpen = false;
    render();
    if (location.hash === '#schedule') document.getElementById('schedule')?.scrollIntoView({ block: 'start' });
    else window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function renderHead() {
    const entity = state.project || state.store;
    document.getElementById('pageTitle').innerHTML = entity
      ? `<button class="back demo-back" data-action="back" aria-label="返回${state.project ? '门店明细' : '公司与门店总览'}">←</button><div><h2>${entity.name} · ${state.project ? '项目明细' : '全部项目明细'}</h2></div>`
      : '<div><h2>公司经营与门店总览</h2></div>';
    document.getElementById('crumb').innerHTML = entity
      ? `<button data-action="overview">门店经营总览</button><span>/</span><strong>${entity.name}</strong>`
      : '<strong>脱敏交互演示</strong><span>/</span><span>实际月 · 累计月</span>';
    document.getElementById('schedule-link').hidden = Boolean(entity);
  }
  function renderKpis() {
    document.getElementById('kpis').innerHTML = [['流水', '流', '#2573e8'], ['收入', '收', '#735ed8'], ['发行毛利', '发', '#e49a22'], ['项目毛利', '利', '#16a474']].map(([label, icon, color]) =>
      `<article class="kpi" style="--kpi-color:${color}"><div class="kpi-copy"><div class="kpi-label"><span class="kpi-icon" aria-hidden="true">${icon}</span><span>${label}</span></div><div class="kpi-periods">${['实际月', '累计月'].map(period => `<div class="kpi-period"><div class="period-label">${period}</div><div class="period-value">${mask('large')}<small>万</small></div><div class="period-meta">${mask('small')}<strong>对照信息已隐藏</strong></div></div>`).join('')}</div></div></article>`).join('');
  }
  function overviewCells(lower = false) {
    return ['month', 'ytd'].map(scope => overviewFields.map((_, i) => `<td class="${scope === 'ytd' ? 'overview-ytd-cell' : lower ? 'overview-month-compare-cell' : 'overview-month-cell'} ${scope === 'ytd' && i === 0 ? 'overview-ytd-start demo-period-divider' : ''}"><div class="${lower ? 'metric-meta' : 'metric-main'}">${mask(lower ? 'small' : '')}</div></td>`).join('')).join('');
  }
  function overviewPair(entity, total = false, child = false) {
    const expanded = state.expanded.has(entity.id);
    const name = total ? '公司合计' : child
      ? `<button class="entity-link demo-child-link child-name" data-action="project" data-id="${entity.id}">${entity.name}</button>`
      : `<button class="row-toggle" data-action="toggle-store" data-id="${entity.id}" aria-expanded="${expanded}" aria-label="${expanded ? '收起' : '展开'}${entity.name}">${expanded ? '−' : '+'}</button><button class="entity-link" data-action="store" data-id="${entity.id}">${entity.name}</button>`;
    const status = total ? mask('status-mask') : child ? statusBadge(entity.status) : badge(entity.pass);
    const cls = total ? 'total' : child ? 'child-row' : 'store-row';
    return `<tr class="${cls} store-actual-row tree-parent"><td class="entity-cell" rowspan="2">${name}</td><td rowspan="2">${status}</td>${overviewCells()}</tr><tr class="${cls} store-budget-row">${overviewCells(true)}</tr>`;
  }
  function renderOverview() {
    const all = stores.every(s => state.expanded.has(s.id));
    const head = `<colgroup><col style="width:210px"><col style="width:110px">${overviewFields.concat(overviewFields).map(() => '<col style="width:96px">').join('')}</colgroup><thead><tr><th rowspan="2" class="overview-fixed-head demo-overview-name">游戏项目组</th><th rowspan="2" class="overview-fixed-head overview-status-head demo-overview-status"><span class="overview-head-title">达成情况</span><span class="subvalue">虚构示例</span></th><th colspan="7" class="overview-month-head"><span class="overview-head-title">实际月</span><span class="subvalue">完成率</span></th><th colspan="7" class="overview-ytd-head overview-ytd-start demo-period-divider"><span class="overview-head-title">累计月</span><span class="subvalue">实际 / 预算对照</span></th></tr><tr>${overviewFields.map(x => `<th class="overview-month-head">${x}</th>`).join('')}${overviewFields.map((x, i) => `<th class="overview-ytd-head ${i === 0 ? 'overview-ytd-start demo-period-divider' : ''}">${x}</th>`).join('')}</tr></thead>`;
    document.getElementById('content').innerHTML = `<section class="board"><div class="board-head"><div><h3>门店经营汇总</h3></div><div class="board-tools"><span class="demo-table-help">点击 ＋ 展开项目，点击名称进入明细</span><button class="secondary" data-action="toggle-all" aria-expanded="${all}">${all ? '收起全部' : '展开全部'}</button><span class="count-note">${stores.length} 个示例门店</span></div></div><div class="store-overview-shell" tabindex="0" aria-label="门店汇总，可横向和纵向滚动"><table class="compact-table store-overview-table">${head}<tbody>${overviewPair({}, true)}${stores.map(s => overviewPair(s) + (state.expanded.has(s.id) ? s.projects.map(p => overviewPair(p, false, true)).join('') : '')).join('')}</tbody></table></div></section>${scheduleHtml()}`;
  }
  function detailCells(fields, lower = false) {
    return fields.map(() => `<td class="${lower ? 'compare-cell' : 'month-cell'}"><div class="${lower ? 'metric-meta' : 'metric-main'}">${mask(lower ? 'small' : '')}</div></td>`).join('');
  }
  function detailPair(project, fields, total = false) {
    const cls = total ? 'report-total' : `status-${project.status}`;
    const name = total ? '门店合计' : project.name;
    const nameHtml = total || state.project ? name : `<button class="entity-link" data-action="project" data-id="${project.id}">${name}</button>`;
    return `<tr class="actual-row project-start ${cls}"><td rowspan="2" class="unified-project-name project-name-main"><span class="project-name-text">${nameHtml}</span></td><td rowspan="2" class="unified-status">${total ? mask('status-mask') : statusBadge(project.status)}</td>${detailCells(fields)}<td class="scope-label demo-period-divider">累计实际</td>${detailCells(fields)}</tr><tr class="compare-row ${cls}">${detailCells(fields, true)}<td class="scope-label demo-period-divider">对照指标</td>${detailCells(fields, true)}</tr>`;
  }
  function renderDetail() {
    const fields = detailFields.filter(f => state.full || !f.extra).map(f => f.label);
    const rows = (state.project ? [state.project] : [...state.store.projects]).sort((a, b) => state.sort === 'group' ? statuses[a.status].order - statuses[b.status].order : a.order - b.order);
    const width = 190 + 85 + 88 + fields.length * 184;
    const head = `<colgroup><col style="width:190px"><col style="width:85px">${fields.map(() => '<col style="width:92px">').join('')}<col style="width:88px">${fields.map(() => '<col style="width:92px">').join('')}</colgroup><thead><tr><th class="unit-head">人民币 万元</th><th class="status-unit-head" aria-label="状态"></th><th colspan="${fields.length}" class="month-group">实际月及达成</th><th colspan="${fields.length + 1}" class="ytd-group demo-period-divider">累计月</th></tr><tr><th class="name-col">游戏项目</th><th class="status-head">状态</th>${fields.map(f => `<th class="month-head">${f}</th>`).join('')}<th class="ytd-head demo-period-divider">口径</th>${fields.map(f => `<th class="ytd-head">${f}</th>`).join('')}</tr></thead>`;
    document.getElementById('content').innerHTML = `<div class="report-table-stack"><section class="metric-section joined-detail unified-store-section"><div class="metric-section-title"><div><h3>${state.project ? state.project.name : state.store.name}</h3><div class="status-legend">${Object.entries(statuses).map(([code, s]) => `<span><i class="${code}"></i>${s.label}</span>`).join('')}<span class="demo-state-legend">虚构状态</span></div></div><div class="metric-title-tools demo-detail-tools"><div class="segmented demo-sort"><button data-action="sort-group" class="${state.sort === 'group' ? 'active' : ''}" aria-pressed="${state.sort === 'group'}">新旧分组</button><button data-action="sort-time" class="${state.sort === 'time' ? 'active' : ''}" aria-pressed="${state.sort === 'time'}">时间排序</button></div><button class="secondary" data-action="fields" aria-pressed="${state.full}">${state.full ? '精简字段' : '全部字段'}</button></div></div><div class="metric-table-wrap" tabindex="0" aria-label="项目明细，可横向和纵向滚动" style="--detail-name-width:190px"><table class="metric-table joined-metric-table unified-store-table" style="min-width:${width}px;--detail-name-width:190px">${head}<tbody>${rows.map(p => detailPair(p, fields)).join('')}${!state.project && rows.length > 1 ? detailPair({}, fields, true) : ''}</tbody></table></div></section></div><div class="bottom-note-dock"><button class="note-tab-left ${state.notesOpen ? 'active' : ''}" data-action="notes" aria-expanded="${state.notesOpen}">备注 ${state.notesOpen ? '−' : '+'}</button>${state.notesOpen ? '<div class="notes-panel demo-note"><label for="demo-note">演示备注</label><textarea id="demo-note" placeholder="可输入文字体验备注；请勿填写真实经营内容。"></textarea><small>仅保留在当前页面，刷新后清空。</small></div>' : ''}</div>`;
    const note = document.getElementById('demo-note');
    if (note) { note.value = state.notes; note.addEventListener('input', () => { state.notes = note.value; }); }
  }
  function scheduleHtml() {
    const stages = [ ['live', '已上线'], ['pending', '待上线'], ['stopped', '挂起 / 取消'], ['reserve', '产品储备'] ];
    const planning = stages.map(([code, label], i) => `<tr class="group-row ${code}"><td colspan="5">${label} <span class="demo-section-label">· 虚构分组</span></td></tr>${[0, 1].map((_, j) => `<tr><td>演示产品 ${i * 2 + j + 1}</td><td>${mask('small')}</td><td>${mask()}</td><td>${mask('small')}</td><td>${mask('wide')}</td></tr>`).join('')}`).join('');
    const milestones = Array.from({ length: 5 }, (_, i) => `<tr><td>演示项目 ${i + 1}</td><td>${mask('small')}</td><td>${mask()}</td><td>${mask('wide')}</td></tr>`).join('');
    return `<div class="schedule-suite demo-schedule" id="schedule"><section class="schedule-panel"><div class="schedule-title"><div><h3>产品排期</h3><p>项目名称为示例，日期与进展已隐藏</p></div><span class="schedule-badge">排期演示</span></div><div class="demo-schedule-wrap"><table class="schedule-table"><thead><tr><th>产品</th><th>模式</th><th>计划节点</th><th>业务状态</th><th>进展</th></tr></thead><tbody>${planning}</tbody></table></div></section><section class="schedule-panel"><div class="schedule-title"><div><h3>研发与产品节点</h3><p>体验排期表的布局与横向滚动</p></div><span class="schedule-badge">节点演示</span></div><div class="demo-schedule-wrap"><table class="schedule-table"><thead><tr><th>项目</th><th>模式</th><th>节点</th><th>里程碑</th></tr></thead><tbody>${milestones}</tbody></table></div></section></div>`;
  }
  function render() { renderHead(); renderKpis(); state.store ? renderDetail() : renderOverview(); }
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const { action, id } = button.dataset;
    if (action === 'store') navigate(id);
    else if (action === 'project') {
      const store = stores.find(s => s.projects.some(p => p.id === id));
      if (store) navigate(store.id, id);
    } else if (action === 'overview') navigate();
    else if (action === 'back') state.project ? navigate(state.store.id) : navigate();
    else if (action === 'toggle-store') {
      const shell = document.querySelector('.store-overview-shell');
      const position = [shell.scrollLeft, shell.scrollTop];
      state.expanded.has(id) ? state.expanded.delete(id) : state.expanded.add(id);
      renderOverview();
      const next = document.querySelector('.store-overview-shell'); next.scrollLeft = position[0]; next.scrollTop = position[1];
      document.querySelector(`[data-action="toggle-store"][data-id="${id}"]`)?.focus({ preventScroll: true });
    } else if (action === 'toggle-all') {
      const collapse = stores.every(s => state.expanded.has(s.id));
      state.expanded.clear(); if (!collapse) stores.forEach(s => state.expanded.add(s.id));
      renderOverview(); document.querySelector('[data-action="toggle-all"]')?.focus({ preventScroll: true });
    } else if (action === 'fields') {
      state.full = !state.full; renderDetail(); document.querySelector('[data-action="fields"]')?.focus({ preventScroll: true });
    } else if (action === 'sort-group' || action === 'sort-time') {
      state.sort = action === 'sort-group' ? 'group' : 'time'; renderDetail();
      document.querySelector(`[data-action="${action}"]`)?.focus({ preventScroll: true });
    } else if (action === 'notes') { state.notesOpen = !state.notesOpen; renderDetail(); }
  });
  document.getElementById('copy-link').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(location.href); toast('分享链接已复制'); }
    catch { toast('可复制浏览器地址栏中的链接进行分享'); }
  });
  window.addEventListener('hashchange', loadRoute);
  loadRoute();
})();
