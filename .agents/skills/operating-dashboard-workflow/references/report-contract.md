# 生成器输入

生成器接收 UTF-8 JSON，示例位于仓库 `examples/synthetic-report.json`。本文件描述 schemaVersion=1；配置由代理写入每次运行目录。

顶层包含 `schemaVersion`、`id`、`title`、`period`、`sources`、`kpis`、`overview`、`stores`、`schedule`、`openIssues`。月份必须是本期确认值；`period` 含 month、ytdStart、ytdEnd、budgetVersion。

`sources[]` 每项有 id、title、location、revision、tables（各含 id、title、coverage）；访问状态在 coverage 中明确。

## 表格

每张表包含 id、nameLabel、groups、rows。group 包含 id、label、sublabel、columns。每一 column 包含 id、label、kind、precision、secondaryKind、secondaryFormat、secondaryPrecision。组和列均有序；每店可使用不同字段。

row 有 id、name、storeId（可选）、statusText、lifecycle、role、cells、children。children 仅一级展开使用，列定义继承父表。role 可为 total 或普通行。

`cells` 的键为 `<group.id>.<column.id>`。每个键必须显式存在；确定原表无对应列/空白才写 missing，未读写 unreadable。其值有 primary、secondary、indicator（兼容旧版单图标），或 `indicators: {primary: {...}, secondary: {...}}`。每个图标独立 ref/evidence/status/shape；同槽位不可同时使用两个格式。status 是源图标颜色语义 good/bad/warn/neutral，shape 支持 dot/flag/arrow，不是从数值正负推断的达成计算。副行含义由列的 secondaryKind 定义。

```json
{
  "primary": {"value": 123, "state": "present", "ref": {
    "sourceId": "report", "tableId": "summary", "rowPath": ["虚构店"],
    "columnPath": ["7月实际", "收入"], "cell": "C5", "raw": "123", "unit": "万元",
    "period": "2026-07", "basis": "研发责任", "budgetVersion": null
  }},
  "secondary": {"value": 0.96, "state": "present", "ref": {
    "sourceId": "report", "tableId": "summary", "rowPath": ["虚构店"],
    "columnPath": ["7月实际vs预算完成率%", "收入"], "cell": "J5", "raw": "96%", "unit": "percent",
    "period": "2026-07", "basis": "研发责任", "budgetVersion": "T2+10"
  }},
  "indicator": {"status": "bad", "shape": "dot", "slot": "secondary", "evidence": "源表红色且有未达成说明", "ref": {"sourceId": "report", "tableId": "summary", "rowPath": ["虚构店"], "columnPath": ["7月实际vs预算完成率%", "收入"], "cell": "J5"}}
}
```

datum 的 state 为 present、missing、unreadable、unresolved。只有 present 允许数值/字符串，其他状态必须 value=null 且有 reason。不会自动用 0 代替。present 必须有 ref；计算值要在 ref 中记录 transform、依赖来源和获准公式。sourceId/tableId 必须对应来源清单。

0.2 输入沿用 schemaVersion=1 并加强证据要求：missing 另需 `missingKind: no_source_column / source_blank / source_dash`、`evidence`、`ref`。无对应列引用已读完整表头范围，空白/破折号引用原单元格；不是从生成模型缺列反推原表没列。旧报告须补证据后再构建，不能用默认 false 补齐未知可见性。

每个 row、column 必须有 `sourceHidden: true / false / null`、`visibilityEvidence`。true 在默认界面隐藏；false 展示；null 暂展示并进入 handoff 未确认项。`optional` 可保留旧输入但不影响渲染。主指标可见性决定这两小行是否展示；它的隐藏对照源列仍必须读取并配对。

`name` 保留原始名称（含小计），renderer 仅清洗显示名称，不改 ID、role 或来源。排序只改展示顺序，DOM 路径保留原始 report 数组索引。一级没有同口径 children 时仍有展开框，可用 `detailNote` 说明并点击店名进入详情；不得强塞不同币种的值到总表列。

`ref.raw` 保存完整原值，`visibleText` 可记录裁切后的单元格外观，`readMethod` 记录公式栏/导出等方式。规范值来自完整值，不能来自被红旗遮挡的文本；主、副值不互相计算替代。

kind/secondaryFormat 可为 amount、number、percent、text。percent 内部用比例，显示时乘 100；百分点差额必须由配置选择适当转换并记录 transform。secondaryKind 为原字段规范语义，不控制数值猜测。primary/secondary 格式各自明确。

## KPI、店分表、排期

KPI 含 id、label、color、unit、kind（默认 amount）、precision、month/ytd（datum）、monthNote/ytdNote（字符串或同样有血缘的 datum）；数值型 note 使用独立 note 格式，不由 CSS 决定类型。可用如 `96% 达成率` 的有来源字符串。

store 有 id、name、kpis、tables（结构同上），可有 kpiNote 解释必要的口径差异。公司和每店各须四张卡，id 为 turnover/revenue/issueGross/projectGross，对应流水/收入/发行毛利/项目毛利。缺同口径值仍显式保留四卡及 missing/unreadable datum；不按子表强行推导合计。排期可有 title、columns（id/label）、rows，每个单元格也是 datum；无排期数据时不显示示例占位。

## 源字段清单

顶层必须有 `sourceInventoryComplete`（完整表头与应有字段已确认的布尔值）和 `sourceFields` 数组，先读来源再生成；不是从 report 反向枚举来宣称完整。按表/期间/指标/主副语义建一项，可映射多个项目行。每项有：

- `id`、`slot: primary / secondary / note`、`semantic`、`ref`（源头定位）、`sourceHidden`、`visibilityEvidence`。
- `state: mapped / not_applicable / unreadable / unresolved`、`targetPaths`（所有对应 datum 路径）；mapped 不允许空路径，其他状态有 reason。
- `evidenceMode: current_read / snapshot`；真实快照保留日期、版本和实际证据位置，不能把旧快照包装成本轮重读。

完整字段清单并不代表每个值/图标都已读取；表覆盖、字段映射和单元格取证分别报告。虚构 examples 由脚本生成清单仅为测契约，不能照此生成真实审计期望。

## 视觉覆盖

可选 display 对象只覆盖 `assets/defaults.json` 中的已知字段：fontFamily、kpiTitleSize、kpiValueSize、kpiMetaSize、tableMainSize、tableSecondarySize、metricHeaderSize、nameWidth、statusWidth、metricWidth、overviewHeightOffset。保留合理正数，不自动改共享默认值。

## 审计位置

导出的每个值由 JSON 路径定位，例如 `/overview/rows/1/cells/month.revenue/secondary`。HTML DOM 对应 `data-value-path`，内容读取必须包含被折叠/隐藏的字段。这个定位是审计交接用，不作为页面文案显示。

handoff.json 保存 HTML/report 路径及各自 hash、templateVersion、来源、快照/版本、字段清单计数、未知可见性、openIssues 和下一对话 Prompt。sourceAudit 初始为 not_run；数据真实通过只能由独立读取源表的审计流程确认。
