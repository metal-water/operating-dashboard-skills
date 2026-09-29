const fs = require('node:fs');
const path = require('node:path');

function enumerate(value, prefix = '', result = []) {
  if (!value || typeof value !== 'object') return result;
  if ('state' in value && 'value' in value) { result.push({path: prefix, datum: value}); return result; }
  for (const [key, child] of Object.entries(value)) enumerate(child, prefix + '/' + key.replace(/~/g,'~0').replace(/\//g,'~1'), result);
  return result;
}

function at(object,path) { return path.split('/').slice(1).reduce((v,k)=>v?.[k.replace(/~1/g,'/').replace(/~0/g,'~')],object); }
function visuals(report) {
  const result=[];
  function visit(value,p='') {
    if(!value||typeof value!=='object')return;
    if('state' in value&&'value' in value)return;
    for(const [key,child]of Object.entries(value)) {
      const next=p+'/'+key.replace(/~/g,'~0').replace(/\//g,'~1');
      if(key==='sourceFields'||key==='sources')continue;
      if(key==='sourceHidden')result.push({path:next,category:'visibility',value:child});
      else if(key==='statusText'||key==='lifecycle')result.push({path:next,category:'row_status',value:child});
      else if(key==='indicator'||key.endsWith('Indicator'))result.push({path:next,category:'indicator',value:child});
      else if(key==='indicators')for(const [slot,signal]of Object.entries(child))result.push({path:next+'/'+slot,category:'indicator',value:signal});
      else visit(child,next);
    }
  }
  visit(report);return result;
}
const proof=ref=>ref?.sourceId&&ref?.tableId&&ref?.rowPath?.length&&ref?.columnPath?.length&&ref.period&&ref.basis&&ref.unit&&ref.raw!=null;

function compare(report, expected) {
  if (!Array.isArray(expected.observations)) throw new Error('observations array required');
  const slots = enumerate(report);
  const required = slots.filter(slot => slot.datum.state === 'present');
  const byPath = new Map(slots.map(slot => [slot.path, slot.datum]));
  const seen = new Set(), checked = new Set(), evidenced = new Set(), fresh = new Set(), differences = [];
  for (const obs of expected.observations) {
    if (!obs.path || seen.has(obs.path)) throw new Error(`Duplicate/missing observation path: ${obs.path}`);
    seen.add(obs.path);
    const actual = byPath.get(obs.path);
    if (!actual) { differences.push({path:obs.path, type:'unknown_display_slot'}); continue; }
    const ref = obs.sourceRef;
    if (!obs.mappingVerified || !proof(ref) || !['current_read','snapshot'].includes(obs.evidenceMode)) {
      differences.push({path:obs.path,type:'insufficient_source_evidence'}); continue;
    }
    if (!['present','missing','unreadable','unresolved'].includes(obs.state)) throw new Error(`Invalid expected state: ${obs.path}`);
    if (obs.state === 'present' && !(typeof obs.value === 'string' || typeof obs.value === 'number' && Number.isFinite(obs.value))) throw new Error(`Invalid expected value: ${obs.path}`);
    if(obs.state!=='present'&&obs.value!==null)throw new Error(`Non-present expected value must be null: ${obs.path}`);
    const tolerance = obs.tolerance ?? 0;
    if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 0 && !obs.toleranceReason) throw new Error(`Invalid/unjustified tolerance: ${obs.path}`);
    if(['present','missing'].includes(obs.state)) {
      if(obs.state==='missing'&&(!['no_source_column','source_blank','source_dash'].includes(obs.missingKind)||!obs.evidence)) {
        differences.push({path:obs.path,type:'insufficient_blank_evidence',sourceRef:ref});continue;
      }
      evidenced.add(obs.path);if(obs.evidenceMode==='current_read')fresh.add(obs.path);
    }
    if (actual.state === 'present' && obs.state === 'present') checked.add(obs.path);
    const refFields = ['sourceId','tableId','rowPath','columnPath','period','basis','budgetVersion','unit','cell'];
    if (actual.ref && refFields.some(field => JSON.stringify(actual.ref[field] ?? null) !== JSON.stringify(ref[field] ?? null))) differences.push({path:obs.path,type:'source_mapping_mismatch',expected:ref,actual:actual.ref});
    if (actual.state !== obs.state) { differences.push({path:obs.path,type:'state_mismatch',expected:obs.state,actual:actual.state,sourceRef:ref}); continue; }
    if(obs.state==='missing'&&actual.missingKind!==obs.missingKind)differences.push({path:obs.path,type:'missing_kind_mismatch',expected:obs.missingKind,actual:actual.missingKind,sourceRef:ref});
    if (obs.state === 'present') {
      const equal = typeof obs.value === 'number' && typeof actual.value === 'number' ? Math.abs(obs.value - actual.value) <= tolerance : obs.value === actual.value;
      if (!equal) differences.push({path:obs.path,type:'value_mismatch',expected:obs.value,actual:actual.value,sourceRef:ref});
    }
  }
  const uncovered = required.filter(slot => !checked.has(slot.path)).map(slot => slot.path);
  const unresolved = slots.filter(slot => ['unreadable','unresolved'].includes(slot.datum.state)).map(slot => slot.path);
  const coverage = required.length ? checked.size / required.length : null;
  const fields=expected.sourceFields||[], fieldSeen=new Set(), fieldChecked=new Set(), fieldFresh=new Set(), fieldPending=[];
  for(const field of fields) {
    if(!field.id||fieldSeen.has(field.id))throw Error('Duplicate/missing independent source field id');fieldSeen.add(field.id);
    if(!['mapped','not_applicable','unreadable','unresolved'].includes(field.state))throw Error('Invalid independent source field state: '+field.id);
    if(!proof(field.sourceRef)||!field.mappingVerified||!['current_read','snapshot'].includes(field.evidenceMode)) { differences.push({type:'insufficient_field_evidence',fieldId:field.id,sourceRef:field.sourceRef});continue; }
    if(field.state==='not_applicable'&&field.reason) { fieldChecked.add(field.id);if(field.evidenceMode==='current_read')fieldFresh.add(field.id);continue; }
    if(['unreadable','unresolved'].includes(field.state)){fieldPending.push(field.id);continue;}
    if(!Array.isArray(field.targetPaths)||!field.targetPaths.length||field.targetPaths.some(p=>!byPath.has(p))) {
      differences.push({type:'source_field_unmapped',fieldId:field.id,sourceRef:field.sourceRef,targetPaths:field.targetPaths||[]});continue;
    }
    // Every paired target must have independently evidenced values, not just exist in the model.
    if(field.targetPaths.every(p=>evidenced.has(p))) {fieldChecked.add(field.id);if(field.evidenceMode==='current_read'&&field.targetPaths.every(p=>fresh.has(p)))fieldFresh.add(field.id);}
    else fieldPending.push(field.id);
  }
  const visualSlots=visuals(report), visualSeen=new Set(), visualChecked=new Set(), visualFresh=new Set();
  const visualObs=expected.visualObservations||[];
  for(const obs of visualObs)if(!visualSlots.some(s=>s.path===obs.path))visualSlots.push({path:obs.path,category:obs.category,value:at(report,obs.path)});
  for(const obs of visualObs) {
    if(!obs.path||visualSeen.has(obs.path))throw Error('Duplicate/missing visual observation path');visualSeen.add(obs.path);
    if(!['indicator','visibility','row_status'].includes(obs.category)||!obs.evidence||!proof(obs.sourceRef)||!['current_read','snapshot'].includes(obs.evidenceMode)||obs.value===undefined) {differences.push({path:obs.path,type:'insufficient_visual_evidence'});continue;}
    const actual=at(report,obs.path);
    const normalize=v=>obs.category==='indicator'&&v?{status:v.status,shape:v.shape}:v;
    if(JSON.stringify(normalize(actual))!==JSON.stringify(normalize(obs.value)))differences.push({path:obs.path,type:obs.category+'_mismatch',expected:obs.value,actual:actual??null,sourceRef:obs.sourceRef});
    if(obs.category==='indicator'&&actual?.ref&&['sourceId','tableId','rowPath','columnPath','period','basis','budgetVersion','unit','cell'].some(k=>JSON.stringify(actual.ref[k]??null)!==JSON.stringify(obs.sourceRef[k]??null)))differences.push({path:obs.path,type:'indicator_source_mapping_mismatch',expected:obs.sourceRef,actual:actual.ref});
    if(obs.category==='visibility'&&obs.value===null)continue;
    visualChecked.add(obs.path);if(obs.evidenceMode==='current_read')visualFresh.add(obs.path);
  }
  const dimension=(items,predicate)=>{const checkedItems=items.filter(predicate);return{required:items.length,checked:checkedItems.length,coverage:items.length?checkedItems.length/items.length:null};};
  const checkedState=state=>dimension(slots.filter(s=>s.datum.state===state),s=>evidenced.has(s.path));
  const coverageByDimension={
    sourceFields:dimension(fields,f=>fieldChecked.has(f.id)),
    primary:dimension(required.filter(s=>/\/(primary|month|ytd)$/.test(s.path)),s=>checked.has(s.path)),
    secondary:dimension(required.filter(s=>/\/(secondary|monthNote|ytdNote)$/.test(s.path)),s=>checked.has(s.path)),
    blanks:checkedState('missing'),
    currentRead:dimension(slots,s=>fresh.has(s.path)),
    snapshotEvidence:dimension(slots,s=>evidenced.has(s.path)&&!fresh.has(s.path)),
    indicators:dimension(visualSlots.filter(s=>s.category==='indicator'),s=>visualChecked.has(s.path)),
    visibility:dimension(visualSlots.filter(s=>s.category==='visibility'),s=>visualChecked.has(s.path)),
    rowStatus:dimension(visualSlots.filter(s=>s.category==='row_status'),s=>visualChecked.has(s.path)),
    hiddenSourceFields:dimension(fields.filter(f=>f.sourceHidden===true),f=>fieldChecked.has(f.id))
  };
  const visualUncovered=visualSlots.filter(s=>!visualChecked.has(s.path)).map(s=>s.path);
  const blankUncovered=slots.filter(s=>s.datum.state==='missing'&&!evidenced.has(s.path)).map(s=>s.path);
  const incomplete=uncovered.length||unresolved.length||blankUncovered.length||visualUncovered.length||!expected.sourceRevisionVerified||!expected.independentSourceRead||!required.length||!fields.length||!expected.sourceInventoryComplete||!expected.visualInventoryComplete||fieldChecked.size<fields.length||fresh.size<slots.length||fieldFresh.size<fields.length||visualFresh.size<visualSeen.size;
  const status = differences.length ? 'differences' : incomplete ? 'incomplete' : 'passed';
  return {status, scope:'supplied independent normalized values, source inventory and metadata only; DOM geometry/colors and accounting bridges require separate checks; this script does not prove independent reading', required:required.length, observed:seen.size, checked:checked.size, coverage, coverageByDimension, differences, uncovered, unresolved, blankUncovered, visualUncovered, fieldPending, sourceRevisionVerified:expected.sourceRevisionVerified === true};
}

if (require.main === module) {
  try {
    const args=process.argv.slice(2), get=key=>{const i=args.indexOf(key);return i<0?null:args[i+1]};
    const report=get('--report'), expected=get('--expected'), out=get('--out');
    if (!report || !expected || !out) throw new Error('Usage: node compare.cjs --report report.json --expected expected.json --out audit.json');
    const result=compare(JSON.parse(fs.readFileSync(report,'utf8')), JSON.parse(fs.readFileSync(expected,'utf8')));
    fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});
    fs.writeFileSync(out,JSON.stringify(result,null,2),{encoding:'utf8',flag:'wx'});
    console.log(JSON.stringify({path:path.resolve(out),status:result.status,coverage:result.coverage}));
    if(result.status!=='passed')process.exitCode=2;
  } catch(error) { console.error(error.message); process.exitCode=1; }
}
module.exports={compare,enumerate,visuals};
