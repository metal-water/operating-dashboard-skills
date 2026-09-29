const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {sample}=require('../examples/create-sample.cjs');
const {validate,slots}=require('../.agents/skills/operating-dashboard-workflow/scripts/contract.cjs');
const {build}=require('../.agents/skills/operating-dashboard-workflow/scripts/build.cjs');
const {compare,visuals}=require('../.agents/skills/operating-dashboard-data-auditor/scripts/compare.cjs');
const report=sample();
assert.deepEqual(validate(report).errors,[]);
assert.equal(report.overview.rows[1].children[0].cells['ytd.revenue'].secondary.state,'missing');
assert.equal(report.stores[0].tables[0].rows[0].cells['ytd.revenue'].secondary.value,1.04);
const nextMonth=structuredClone(report);
nextMonth.period.month='2026-08';nextMonth.period.ytdEnd='2026-08';
nextMonth.overview.groups[0].label='8月实际';nextMonth.overview.groups[1].label='1-8月累计';
assert.deepEqual(validate(nextMonth).errors,[]);
const broken=structuredClone(report);delete broken.overview.rows[0].cells['month.revenue'];
assert(validate(broken).errors.some(error=>error.includes('missing explicit cell')));
const unknown=structuredClone(report);unknown.kpis[0].month.ref.tableId='nonexistent';assert(validate(unknown).errors.some(error=>error.includes('unknown source')));
const nan=structuredClone(report);nan.kpis[0].month.value=NaN;assert(validate(nan).errors.length);
const inputs=slots(report);
// This tests the comparator mechanics only, never substitutes for independent real-source evidence.
const expected={sourceRevisionVerified:true,independentSourceRead:true,sourceInventoryComplete:true,visualInventoryComplete:true,
  observations:inputs.map(slot=>({path:slot.path,state:slot.datum.state,value:slot.datum.value,missingKind:slot.datum.missingKind,evidence:slot.datum.evidence,mappingVerified:true,sourceRef:slot.datum.ref,evidenceMode:'current_read'})),
  sourceFields:report.sourceFields.map(f=>({...f,sourceRef:f.ref,mappingVerified:true})),
  visualObservations:visuals(report).map(v=>({...v,evidence:'synthetic fixture only',sourceRef:v.category==='indicator'?v.value.ref:report.kpis[0].month.ref,evidenceMode:'current_read'}))
};
assert.equal(compare(report,expected).status,'passed');
const incomplete=structuredClone(expected);incomplete.observations.pop();assert.equal(compare(report,incomplete).status,'incomplete');
const wrong=structuredClone(expected);wrong.observations[0].value+=1;assert(compare(report,wrong).differences.some(d=>d.type==='value_mismatch'));
const mapping=structuredClone(expected);mapping.observations[0].sourceRef.columnPath=['different period','same value'];assert(compare(report,mapping).differences.some(d=>d.type==='source_mapping_mismatch'));
const noProof=structuredClone(expected);noProof.observations[0].mappingVerified=false;assert(compare(report,noProof).uncovered.length);
const absentSourceField=structuredClone(expected);absentSourceField.sourceFields.push({id:'independent-extra-field',state:'mapped',sourceRef:report.kpis[0].month.ref,targetPaths:[],mappingVerified:true,evidenceMode:'current_read'});
assert(compare(report,absentSourceField).differences.some(d=>d.type==='source_field_unmapped'));
const snapshot=structuredClone(expected);snapshot.observations[0].evidenceMode='snapshot';assert.equal(compare(report,snapshot).status,'incomplete');
const blank=structuredClone(expected);delete blank.observations.find(o=>o.state==='missing').missingKind;assert(compare(report,blank).differences.some(d=>d.type==='insufficient_blank_evidence'));
const wrongSignal=structuredClone(expected);wrongSignal.visualObservations.find(v=>v.category==='indicator').value.status='bad';assert(compare(report,wrongSignal).differences.some(d=>d.type==='indicator_mismatch'));
const wrongSignalRef=structuredClone(expected);wrongSignalRef.visualObservations.find(v=>v.category==='indicator').sourceRef.cell='synthetic:wrong-source';assert(compare(report,wrongSignalRef).differences.some(d=>d.type==='indicator_source_mapping_mismatch'));
const wrongVisibility=structuredClone(expected);wrongVisibility.visualObservations.find(v=>v.category==='visibility').value=true;assert(compare(report,wrongVisibility).differences.some(d=>d.type==='visibility_mismatch'));
const noInventory=structuredClone(expected);delete noInventory.sourceFields;assert.equal(compare(report,noInventory).status,'incomplete');
const noVisibility=structuredClone(report);delete noVisibility.overview.rows[0].sourceHidden;assert(validate(noVisibility).errors.some(e=>e.includes('sourceHidden')));
const noStoreKpis=structuredClone(report);delete noStoreKpis.stores[0].kpis;assert(validate(noStoreKpis).errors.some(e=>e.includes('four explicit KPI')));
const wrongSlot=structuredClone(report);wrongSlot.stores[0].tables[0].rows[0].cells['ytd.ratio'].indicators.extra=wrongSlot.stores[0].tables[0].rows[0].cells['ytd.ratio'].indicators.primary;assert(validate(wrongSlot).errors.some(e=>e.includes('invalid indicators key')));
const longValue=report.stores[0].tables[0].rows[0].cells['ytd.ratio'];assert.equal(longValue.secondary.value,34567.89);assert.notEqual(longValue.primary.ref.cell,longValue.secondary.ref.cell);assert.equal(longValue.secondary.ref.raw,'3456789%');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'dashboard-skills-'));
try{
  const input=path.join(tmp,'input.json');fs.writeFileSync(input,JSON.stringify(report));
  const one=build(input,path.join(tmp,'out'));const first=fs.readFileSync(one.html,'utf8');const two=build(input,path.join(tmp,'out'));
  assert.notEqual(one.directory,two.directory);assert.equal(fs.readFileSync(one.html,'utf8'),first);
  const handoff=JSON.parse(fs.readFileSync(one.handoff,'utf8'));assert.equal(handoff.templateVersion,'0.2.0');assert.equal(handoff.sourceAudit,'not_run');assert.equal(handoff.reportHash,require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(one.directory,'report.json'))).digest('hex'));
  const uncertain=structuredClone(report);uncertain.overview.rows[0].sourceHidden=null;uncertain.overview.rows[0].visibilityEvidence='unknown in fixture';fs.writeFileSync(input,JSON.stringify(uncertain));const uncertainty=build(input,path.join(tmp,'out'));assert(JSON.parse(fs.readFileSync(uncertainty.handoff,'utf8')).inventory.unknownVisibility>0);
  const evil=structuredClone(report);evil.title='</script><script>window.injected=true</script>';fs.writeFileSync(input,JSON.stringify(evil));
  const safe=build(input,path.join(tmp,'out'));assert(!fs.readFileSync(safe.html,'utf8').includes('<script>window.injected'));
  console.log(JSON.stringify({contract:'passed',versioning:'passed',auditComparator:'passed',independentInventoryMissingField:'detected',snapshotOnlyAudit:'incomplete',unknownVisibility:'reported',missingEvidence:'required',independentSignals:'checked',htmlEscaping:'passed',sourceAudit:'not_run',values:slots(report).length}));
}finally{
  assert.equal(path.dirname(path.resolve(tmp)),path.resolve(os.tmpdir()));
  assert(path.basename(tmp).startsWith('dashboard-skills-'));
  fs.rmSync(tmp,{recursive:true,force:true});
}
