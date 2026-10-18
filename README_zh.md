# dsh-thinking-token-stat

> [English](./README.md) | **中文**

[![awesome · DSH plugin](https://awesome-dsh-plugin.com/badge.svg)](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)
[![dsh](https://img.shields.io/badge/dsh-plugin-4B32C3)](https://github.com/deepseek-ai/deepseek-harness)
[![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![npm version](https://img.shields.io/npm/v/dsh-thinking-token-stat?color=4a6cf7)](https://www.npmjs.com/package/dsh-thinking-token-stat)
[![npm downloads](https://img.shields.io/npm/dt/dsh-thinking-token-stat?color=4a6cf7)](https://www.npmjs.com/package/dsh-thinking-token-stat)
[![repo](https://img.shields.io/badge/repo-github-181717?logo=github)](https://github.com/Six6stRINgs/dsh-thinking-token-stat)
[![GitHub stars](https://img.shields.io/github/stars/Six6stRINgs/dsh-thinking-token-stat?color=4a6cf7)](https://github.com/Six6stRINgs/dsh-thinking-token-stat/)

轻量级 DeepSeek Harness（DSH）会话思考 Token 统计插件。在输入框底栏常驻显示全会话思考 Token 总量与占比，支持展开与官方完全一致的毛玻璃详情面板及逐轮模型明细。

![输入框下方的读数，以及展开后的总览](./assets/screenshot.png)

![逐轮明细](./assets/screenshot-turns.png)

## 功能特性

### 1. 底栏读数（Composer Dock）
在输入框底部的统计条中常驻显示：
```
💭 37.2K · 70.7% · 4 / 6 轮
```
- **会话思考总量**：整场对话累计消耗的思考（reasoning）token 数。
- **思考占输出比例**：思考 token 占模型推理状态下产出内容的总比例。
- **有效思考轮次**：思考轮次 / 总轮数（仅在会话中存在非思考轮次时显示，全思考会话保持简洁）。

### 2. 一级概览面板（Session Overview）
点击底栏读数即可弹出概览面板。样式与官方浮层完全对齐，具备原生毛玻璃遮蔽质感：
- **思考 / 推理输出**：思考 token 占推理输出总量的百分比。
- **思考 / 全部 token**：思考 token 占整场计费 token 总量（输入+输出+缓存）的比例。
- **推理轮次统计**：显示参与思考的轮次与会话总轮次。
- **推算部分标示**：若部分模型未上报思考 token，单独标出估算轮次与估算 token 总量，并提供 `?` 说明依据。
- **统计范围说明**：清楚说明统计实际覆盖的范围（包括是否有未产出消息的轮次、fork 继承历史剔除等）。

### 3. 二级逐轮明细（Turn-by-turn Breakdown）
点击概览底部的「多轮具体统计」，进入逐轮表格视图（最新轮次排在最前）：
- **轮次与思考量**：每轮的思考 token（推算值前带 `~` 并高亮提示）。
- **本轮总输出**：该轮模型生成的总 token 数量。
- **思考来源**：精确标明来源（提供方直接上报 `reported` / 文本按字符推算 `estimated` / 混合）。
- **执行模型**：记录该轮实际运行的 Provider 与模型名称（如 `deepseek-official/deepseek-reasoner`），重试切换模型时均有记录。
- **输出占比**：思考 token 占本轮输出的百分比。
- **来源筛选**：支持按「已上报」、「已推算」、「未提供」快速过滤视图。
- **一键定位跳转**：每行末尾提供跳转按钮，即使目标轮次在当前窗口之外，也会自动驱动历史翻页并定位到对应回复。

---

## 思考 Token 统计机制

并非所有模型提供方都会在 API 响应中上报 `reasoning_tokens`。为了在任何情况下都能提供可信的参考，插件采用双轨统计机制：

| 提供方数据 | 统计方式 | 界面显示 |
| :--- | :--- | :--- |
| **已上报推理 token 数** | 直接采用提供方数据，完全精确 | 正常显示数字，标明来源为「已上报」 |
| **仅返回思考过程文本** | 按文字多语种密度科学折算 | 数字前加 `~` 提示估算（如 `~5.1K`），标明来源为「已推算」 |
| **两者皆无** | 计为无思考轮次 | 默认在逐轮列表中折叠（可在筛选中开启） |

### 多语种字符密度折算规则

当必须从思考文本推算 token 时，单一的英文经验规则（如 4 字符/token）会严重低估其他语种。插件按文字类型细分折算密度：

| 文字类型 | 字符 / Token | 折算依据 |
| :--- | :---: | :--- |
| **CJK（中日韩汉字、假名、谚文、全角字符）** | **1** | 实测分词器密度约为 0.6–1.7 token/字符（DeepSeek 与 Qwen 自研分词器在 0.6–0.8 左右）。取 1 字符/token 略偏保守，避免虚高。 |
| **西里尔、希腊、阿拉伯、希伯来、印度诸文字、泰文等** | **2.5** | 实测大致介于 2–3 字符/token 之间。 |
| **拉丁字母、数字、英文标点、空格** | **4** | 国际通用英文经验基准值。 |

所有推算数字均诚实标注 `~`，绝不将推算伪装为实测。

---

## 架构与性能

- **宿主持久化投影（Session Projection）**：
  - 核心计算在宿主 Node 侧作为纯函数 Reducer 运行，仅监听 `assistant/message` 结算事件。
  - 折叠结果随会话持久化为检查点文件（存储于 `<root>/session_projcache/sessions/<id>.json`，单场长对话通常仅占几 KB）。
  - 统计天然覆盖整场会话日志，不受客户端视窗分页、虚拟滚动或会话上下文压缩（compaction）的影响，冷启动瞬间加载。
- **前端零额外开销**：
  - 浏览器端仅订阅单个投影值渲染 UI，不扫描历史消息、不发起额外网络请求、不写入 `localStorage`。
- **对齐官方 UI 规范**：
  - 严格遵循 DSH `stat-dialog.module.css` 规范，应用 `var(--dsw-menu-backdrop-filter)` 40px 高斯模糊与 `var(--dsw-radius-lg)` 圆角。
  - 自动适配深色（Dark）与浅色（Light）主题。
  - 界面语言自动同步 DSH 客户端语言环境（中英双语）。

---

## 安装与使用

### 方式一：DSH 插件市场安装（推荐）
在 DSH 桌面端或 Web 界面中打开 **插件市场（Market）**，搜索 `dsh-thinking-token-stat`，点击安装即可。

### 方式二：命令行安装
在终端中执行：
```sh
dsh plugin add dsh-thinking-token-stat
```
*或直接从 GitHub 安装最新主分支：*
```sh
dsh plugin add github:Six6stRINgs/dsh-thinking-token-stat
```

安装后刷新界面（或按 `Ctrl+R`）即可生效。模型开始输出思考过程后，底栏读数将自动显示。

---

## 参与开发

插件由两部分组成：
- `lib/index.js`：宿主端代码，注册 `thinkingStats` 会话投影与数据折叠逻辑。
- `lib/client.js`：客户端界面代码，向底栏 slot 注入读数、弹窗与表格。

运行测试：
```sh
npm test
```
（包含针对折叠逻辑的 `projection.mjs` 以及针对界面交互与降级分支的 `harness.mjs`）。

---

## 许可证

[MIT](./LICENSE)
