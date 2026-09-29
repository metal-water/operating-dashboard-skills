const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const {build}=require('../.agents/skills/operating-dashboard-workflow/scripts/build.cjs');
const {sample}=require('../examples/create-sample.cjs');
async function main(){
  const out=path.resolve(__dirname,'../outputs/browser-tests');fs.mkdirSync(out,{recursive:true});
  const input=path.join(out,'sample.json');fs.writeFileSync(input,JSON.stringify(sample()));
  const artifact=build(input,out);
  const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
  try{
    const page=await browser.newPage({viewport:{width:1920,height:1080}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(pathToFileURL(artifact.html).href);await page.locator('[data-toggle-all]').click();
    assert.equal(await page.locator('[data-toggle-all]').innerText(),'收起全部');
    assert.equal(await page.locator('.overview tbody tr[hidden]').count(),2);
    assert.equal(await page.locator('[data-full]').count(),0);
    assert.equal(await page.locator('.row-toggle').count(),2);
    assert.equal(await page.locator('[data-value-path="/overview/rows/1/children/0/cells/ytd.revenue/secondary"]').innerText(),'--');
    assert(await page.locator('.overview thead th.name').evaluate(el=>el.getBoundingClientRect().width<=175));
    await page.screenshot({path:path.join(artifact.directory,'desktop.png')});
    const colors=await page.evaluate(()=>{const a=document.querySelector('.overview tr.primary:not(.total) td.ytd'),b=document.querySelector('.overview tr.secondary:not(.total) td.ytd');return[getComputedStyle(a).backgroundImage,getComputedStyle(b).backgroundImage]});assert.notEqual(...colors);
    const zero=await page.locator('[data-value-path="/overview/rows/2/cells/month.revenue/primary"]').innerText();assert.equal(zero,'0');
    await page.locator('[data-store="a"]').click();
    assert.equal(await page.locator('.kpi').count(),4);
    assert.equal(await page.locator('thead [data-column="month.gross2"]').innerText(),'毛利2');
    const pair=await page.locator('tr.primary:not([hidden])').first().locator('[data-value-path]').first().getAttribute('data-value-path');assert(pair.includes('/rows/1/'));
    const signalColors=await page.locator('[data-value-path="/stores/0/tables/0/rows/1/cells/ytd.ratio/secondary"]').evaluate(e=>({text:e.textContent,number:getComputedStyle(e).color,icon:getComputedStyle(e.previousElementSibling).color}));assert.equal(signalColors.text,'3,456,789%');assert.equal(signalColors.number,signalColors.icon);
    await page.locator('[data-full]').click();assert.equal(await page.locator('tr[data-source-hidden="true"]:not([hidden])').count(),2);await page.locator('[data-full]').click();
    assert.equal(await page.locator('[data-value-path="/stores/0/tables/0/rows/0/cells/ytd.revenue/secondary"]').innerText(),'104%');
    assert(await page.locator('.detail-table td.name[rowspan="2"]').count()>0);
    await page.setViewportSize({width:390,height:844});
    await page.locator('.table-wrap').evaluate(el=>{el.scrollLeft=300;el.scrollTop=150});
    const freeze=await page.evaluate(()=>{
      const wrap=document.querySelector('.table-wrap'),box=wrap.getBoundingClientRect(),head=wrap.querySelector('thead tr:nth-child(2) th.name'),cell=[...wrap.querySelectorAll('tbody td.name')].find(e=>{const r=e.getBoundingClientRect();return r.top>head.getBoundingClientRect().bottom+2 && r.top<box.bottom-40});
      const r=cell.getBoundingClientRect();return{left:r.left-box.left,owner:cell.contains(document.elementFromPoint(r.left+10,r.top+10)),overflow:document.documentElement.scrollWidth>innerWidth};
    });assert(Math.abs(freeze.left)<=2);assert(freeze.owner);assert(!freeze.overflow);
    await page.screenshot({path:path.join(artifact.directory,'mobile-detail-scroll.png')});
    await page.getByRole('button',{name:'返回总览',exact:true}).click();
    assert(await page.locator('[data-toggle-all]').count());
    const layout=await page.locator('.kpi').evaluateAll(cards=>cards.every(card=>card.scrollWidth<=card.clientWidth+1));assert(layout);
    await page.screenshot({path:path.join(artifact.directory,'mobile-overview.png')});
    await page.setViewportSize({width:1280,height:800});await page.screenshot({path:path.join(artifact.directory,'narrow.png')});
    await page.locator('[data-store="b"]').click();const before=await page.locator('.detail-table thead tr:nth-child(2) th').count();await page.locator('[data-full]').click();assert(await page.locator('.detail-table thead tr:nth-child(2) th').count()>before);
    assert.equal(await page.locator('[data-value-path="/stores/1/tables/0/rows/0/cells/month.issueNet/primary"]').innerText(),'-12');
    assert.equal(await page.locator('[data-value-path="/stores/1/tables/0/rows/0/cells/month.issueNet/secondary"]').innerText(),'--');
    assert.deepEqual(errors,[]);console.log(JSON.stringify({status:'passed',views:['1920x1080','1280x800','390x844'],freeze,artifact}));
  }finally{await browser.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1});
