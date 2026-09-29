# 同事使用与交接指南

当前 Skill 版本：**0.2.0**。这是一个包含“生成看板”和“独立核对”两个 Skill 的项目。

## 第一次使用：下载后在 Codex 中打开

1. 打开本 GitHub 仓库，选择 **Code → Download ZIP**，解压到本机。公开仓库下载不需要仓库写权限。
2. 在 Codex 中打开解压后的项目文件夹。选中的是直接包含 `README.md`、`PROMPTS.md`、`package.json` 和 `.agents` 的这一层，不要只打开外层下载目录，也不要只复制 SKILL.md。
3. 让 Codex 检查本项目的两个 Skill 和可用 Node.js。Skill 位于 `.agents/skills/operating-dashboard-workflow/` 与 `.agents/skills/operating-dashboard-data-auditor/`，需要保留各自 scripts、references、assets 等附属文件。
4. 先用虚构示例试跑，再提供已授权的本期经营文档。GitHub 仓库不会附带飞书登录状态或源文档权限；每位使用者需要自己的来源访问权限。

可先给 Codex 这段话：

```text
请检查当前项目里的 operating-dashboard-workflow 和 operating-dashboard-data-auditor 两个 Skill，以及 Node.js 是否可用。
先运行虚构示例和必要的自测，告诉我如何打开生成页面。不要读取真实经营文档。
```

需要自己在终端验证时，在本项目根目录执行：

```powershell
node --version
npm.cmd test
npm.cmd run demo
```

这两个命令使用内置 Node 模块，不需要先 npm install。基础生成要求 Node.js 18+；统一环境建议 Node.js 22 或更新的 LTS 版本。独立浏览器测试的当前依赖要求 Node.js 20+，仅在宿主允许该浏览器驱动时运行；正常生成使用宿主已有的浏览器能力做验收。

## 每月使用

从 [PROMPTS.md](PROMPTS.md) 复制“生成并独立核对”的完整调用文本，替换文档链接、输出目录和当次特殊要求。无需手工填写 report.json 或字段映射。

短版调用示例：

```text
使用 $operating-dashboard-workflow。
本期经营文档：<本期链接或文件路径>
输出目录：<本机输出目录>
特殊要求：暂无。
沿用默认模板，逐店读取完整字段并配对主副值和图标，生成版本化看板与 handoff.json。
生成后使用 $operating-dashboard-data-auditor 独立重读同版本源表，输出差异、来源位置、分维度覆盖率和无法确认项。核对阶段不要修改看板。
```

Codex CLI 和 IDE 支持 `$` 提及或 `/skills`；其他界面的 Skill 入口可能不同，例如 ChatGPT 使用 `@` 选择 Skill。按实际宿主选择已发现的 Skill，不把一段调用文字当作安装完成。若没有发现，可让 Codex 读取上述两个本地 SKILL.md 路径定位，检查是否打开了正确目录；必要时重启宿主。其他 AI 产品须先确认支持 Agent Skills 和本机脚本/浏览器能力。

## 生成和核对分别做什么

1. 生成阶段：读取源表 → 建立完整字段清单 → 配对主副值、图标及可见性 → 形成 report.json → 校验并生成 HTML/handoff.json → 浏览器验收。
2. 核对阶段：读取 handoff.json → 独立重新读取同版本原始材料 → 比较字段、数值、颜色及显示 → 输出差异、覆盖率和无法确认项。核对过程不改看板。
3. 需要修复时，明确提出修复要求，基于源证据生成新版本，再复核。源表发生变化时先确认版本，不能混用新旧来源。

`index.html` 是当次看板，`report.json` 保存数据和来源，`handoff.json` 是核对交接单。目录名里的 v001/v002 是每次生成的看板版本，不是 Skill 的 0.2.0 版本。

## 你交给同事的材料

| 内容 | 如何交接 |
| --- | --- |
| Skill 仓库地址和版本 0.2.0 | 发仓库链接及本指南即可 |
| 本期原始文档及访问权限 | 通过已有的内部授权渠道单独提供 |
| 当期特殊要求、月份和已知口径问题 | 用文字说明，必要时注明对应原表位置 |
| 已生成看板需要接着核对 | 交付完整版本目录，至少包含 index.html、report.json、handoff.json 及其引用的证据 |
| 尚未确认的问题 | 连同差异清单、覆盖率、未读范围一起交接 |

公开仓库只维护模板、规则、测试和虚构示例。真实原始文档、真实看板、report/handoff 及审计证据保留在内部；这些文件可能含经营数据和源链接，不能因扩展名是 JSON/HTML 就直接提交。

## 后续更新

- 只使用：重新下载最新版到新的文件夹，打开新项目；先保存自己的当期产物。不要让旧的个人安装副本与项目版本混用。
- 使用 Git 的同事：克隆一次，以后在该仓库执行 `git pull --ff-only` 获取更新。存在本地改动时先处理自己的改动，不强行覆盖。
- 共同维护：公开仓库允许查看和下载；直接提交需要仓库所有者单独邀请协作者。也可以由同事提交 Pull Request 供所有者审阅。
- 长期规则变更需要同步 Skill、模板和测试，并记录新的 Skill 版本；当期经营数据更新只生成新的看板版本。

当前交接方式是项目内 Skill。面向多个项目统一安装、或作为 ChatGPT/Codex 插件分发，是后续独立的打包工作，本仓库不宣称已安装成插件。

官方依据（2026-09-29 查阅）：[OpenAI Skills 文档](https://learn.chatgpt.com/docs/build-skills)。官方说明了 `.agents/skills` 项目发现、完整 Skill 目录结构及不同宿主的调用方式。
