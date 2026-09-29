# 独立期望值契约

compare.cjs 只做输入的结构和规范化数值比对。它不连接飞书，不证明 expected 是独立取证，不代替视觉检查。

输入：

```json
{
  "sourceRevisionVerified": true,
  "independentSourceRead": true,
  "sourceInventoryComplete": false,
  "visualInventoryComplete": false,
  "observations": [{
    "path": "/overview/rows/1/cells/month.revenue/secondary",
    "state": "present",
    "value": 0.96,
    "mappingVerified": true,
    "evidenceMode": "current_read",
    "tolerance": 0,
    "sourceRef": {
      "sourceId": "report", "tableId": "store-summary", "rowPath": ["示例店"],
      "columnPath": ["7月实际vs预算完成率%", "收入"],
      "period": "2026-07", "basis": "研发责任", "unit": "percent",
      "budgetVersion": "T2+10", "cell": "J5", "raw": "96%"
    }
  }]
}
```

如果生成器映射选错，即使数值巧合一致，仍须把 independently verified 的 sourceRef 写为正确位置，比较器会报告 source_mapping_mismatch。原表地址不是唯一依据，必须包含完整行列头和责任/期间。

value 已统一为标准比例/金额单位。容差默认 0，只有源表舍入精度得到确认才设置 tolerance 并记录 toleranceReason；不能给所有字段一个大容差以消除差异。原币转换需要记录转换依据。

未读取字段不生成伪期望；它们进入 uncovered 列表。observations 覆盖 missing 时 value=null，并须 missingKind（no_source_column/source_blank/source_dash）、evidence 和完整 sourceRef。原文与快照修订不一致时 sourceRevisionVerified=false；旧快照即便有效也标 evidenceMode=snapshot，不当成本轮重读 current_read。

## 独立字段分母与视觉状态

先从源表构建 `sourceFields`，再对照报告，不能复制生成报告的清单。每项 id、state（mapped/not_applicable/unreadable/unresolved）、sourceRef、sourceHidden、mappingVerified、evidenceMode、targetPaths（独立定位的全部主副 datum 路径）。确认不适用必须 reason；原表有字段但看板没位置也必须列入并保留空 targetPaths，比较器报告 source_field_unmapped，而不是从分母删除。表头、右侧对照列、隐藏范围还没读完时 sourceInventoryComplete=false。

`visualObservations` 每项 path、category（indicator/visibility/row_status）、value、sourceRef、evidence、evidenceMode。例如 path `/stores/0/tables/0/rows/0/cells/ytd.ratio/indicators/secondary`，category=indicator，value={status:bad,shape:flag}。visibility 的 path 指向源隐藏布尔值，row_status 指向 lifecycle 或 statusText。图标 value 比较 status/shape，来源期次、原单元格及实际颜色仍需独立审阅。

visualInventoryComplete 只有在源图标/状态/隐藏行列范围已独立枚举时才为 true；也要查源中存在但模型完全没有的图标。将预期指向模型应有位置，比较器会报告缺少/不符。未知可见性 value=null 不算已确认。颜色和图形未知必须进入无法确认项，不能任意赋 good/neutral 冒充原表状态。

## 输出与通过边界

输出 required/observed/checked/coverage、coverageByDimension、differences、uncovered、blankUncovered、visualUncovered、fieldPending、unresolved 和 status。coverage 兼容旧数值分母；新的维度含源字段、主值、副值、空白证据、当前重读、既有快照、图标、源可见性、行状态、隐藏源字段。checked 表示已提供足够取证参加比较，并不表示该值一致；一致性看 differences。

status 为 passed、differences、incomplete。缺独立清单、缺空白/视觉证据、含旧快照或未读项均不能判本轮全量通过。独立字段及视觉清单的真实性不是脚本可自动认证的；即使 passed，也仅表示所提供的规范值、映射与元数据证据一致。报告另列源隐藏行/列数量和读取覆盖、DOM 覆盖、图标颜色实测、归属及总分表会计口径桥，不能写成完整财务通过。

## 疑似数字截断与普通纠错

主副行分别读取：完整原文 raw、visibleText、地址、期间、单位、语义、读法和截图。图标与窄列可能遮住首位/负号，以公式栏/完整单元格值或授权导出交叉证据判断。若看板与完整值一致，只报原表显示截断并解释，不照裁切外观改数；若确实错误，核对阶段只列差异，用户要求修复后再做新版本。不能对主值取绝对值、删除负号或倒算副值。

`path` 和 DOM `data-value-path` 对应。若 DOM 渲染字符串与 report.json 不符，记录 display_mismatch；可通过浏览器完整枚举折叠和可选字段后另存 `display-values.json`。不以模型一致推断 HTML 正确。

一级无全部字段入口，保持源隐藏行不展示；审计原表隐藏项目可通过源数据清单及二级全部字段核对。排序后按稳定原始路径对照，不用展示序号取 report 数组值。主副各有图标时读取各自 data-indicator-path，主副数值与源图标颜色都检查。审计前后确认交付 HTML/report hash 没变化，核对阶段不修改看板。
