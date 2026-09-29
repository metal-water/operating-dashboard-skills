const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { validate } = require('./contract.cjs');
const assetDir = path.resolve(__dirname, '../assets');

function build(input, output) {
  const report = JSON.parse(fs.readFileSync(input, 'utf8'));
  const { errors, slots } = validate(report);
  if (errors.length) throw new Error(errors.join('\n'));
  const defaults = JSON.parse(fs.readFileSync(path.join(assetDir, 'defaults.json'), 'utf8'));
  const display = { ...defaults };
  for (const [key, value] of Object.entries(report.display || {})) {
    if (!(key in defaults)) throw new Error(`Unknown display option: ${key}`);
    if (key === 'fontFamily' ? typeof value !== 'string' : !Number.isFinite(value) || value < 0 || value > 2000) throw new Error(`Invalid display option: ${key}`);
    display[key] = value;
  }
  fs.mkdirSync(output, { recursive: true });
  let version = 1;
  let dir;
  for (;;) {
    dir = path.resolve(output, `${report.id}-v${String(version).padStart(3, '0')}`);
    try { fs.mkdirSync(dir); break; } catch (error) { if (error.code !== 'EEXIST') throw error; version++; }
  }
  const reportJson = JSON.stringify(report, null, 2);
  const safeJson = JSON.stringify({ report, display }).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const css = fs.readFileSync(path.join(assetDir, 'dashboard.css'), 'utf8');
  const js = fs.readFileSync(path.join(assetDir, 'dashboard.js'), 'utf8');
  const title = report.title.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const html = `<!doctype html>\n<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>${css}</style></head><body><header id="topbar"></header><main id="app"></main><script type="application/json" id="report-data">${safeJson}</script><script>${js}</script></body></html>`;
  const pending = slots.filter(slot => ['unreadable', 'unresolved'].includes(slot.datum.state)).map(slot => ({path: slot.path, reason: slot.datum.reason}));
  const unknownVisibility=[];
  const walk=(item,p='')=>{if(!item||typeof item!=='object')return;if(Object.hasOwn(item,'sourceHidden')&&item.sourceHidden===null)unknownVisibility.push({path:p,reason:item.visibilityEvidence});for(const [k,v]of Object.entries(item))walk(v,p+'/'+k.replace(/~/g,'~0').replace(/\//g,'~1'));};
  walk(report);
  const handoff = {
    schemaVersion: 1, templateVersion: '0.2.0', generatedAt: new Date().toISOString(),
    html: 'index.html', report: 'report.json', period: report.period, sources: report.sources,
    hash: crypto.createHash('sha256').update(html).digest('hex'),
    reportHash: crypto.createHash('sha256').update(reportJson).digest('hex'),
    sourceAudit: 'not_run', openIssues: [...report.openIssues, ...pending, ...unknownVisibility, ...report.sourceFields.filter(f=>['unreadable','unresolved'].includes(f.state))],
    inventory: { values: slots.length, present: slots.filter(slot => slot.datum.state === 'present').length, pending: pending.length, sourceFields:report.sourceFields.length, mappedFields:report.sourceFields.filter(f=>f.state==='mapped').length, sourceInventoryComplete:report.sourceInventoryComplete, unknownVisibility:unknownVisibility.length },
    prompt: '使用 $operating-dashboard-data-auditor，读取本 handoff.json 并核验 HTML/report hash，独立重新读取同版本原始公司表、门店汇总及所有店分表的完整多级表头、隐藏行列和右侧对照列。先形成独立源字段清单，再核对主副值、字段语义、原表图标和数字颜色；一级保持默认可见行列，二级全部字段同时检查已读取的隐藏行列。疑似图标遮挡时核对公式栏或完整单元格值。输出差异、来源位置、字段映射/主副值/空白/隐藏行列/图标/DOM 的覆盖率、当次重读与既有快照范围及无法确认项。核对阶段不要修改看板。'
  };
  for (const [file, content] of Object.entries({'index.html': html, 'report.json': reportJson, 'handoff.json': JSON.stringify(handoff, null, 2)})) fs.writeFileSync(path.join(dir, file), content, {encoding: 'utf8', flag: 'wx'});
  return { directory: dir, html: path.join(dir, 'index.html'), handoff: path.join(dir, 'handoff.json'), ...handoff.inventory };
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    const get = key => { const index = args.indexOf(key); return index < 0 ? null : args[index + 1]; };
    const input = get('--input'), output = get('--out');
    if (!input || !output) throw new Error('Usage: node build.cjs --input report.json --out output-directory');
    console.log(JSON.stringify(build(path.resolve(input), path.resolve(output)), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { build };
