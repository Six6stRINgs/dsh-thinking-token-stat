# dsh-thinking-token-stat

> [English](./README.md) | **中文**

[![awesome · DSH plugin](https://awesome-dsh-plugin.com/badge.svg)](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)
[![dsh](https://img.shields.io/badge/dsh-plugin-4B32C3)](https://github.com/deepseek-ai/deepseek-harness)
[![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![npm version](https://img.shields.io/npm/v/dsh-thinking-token-stat?color=4a6cf7)](https://www.npmjs.com/package/dsh-thinking-token-stat)
[![npm downloads](https://img.shields.io/npm/dt/dsh-thinking-token-stat?color=4a6cf7)](https://www.npmjs.com/package/dsh-thinking-token-stat)
[![repo](https://img.shields.io/badge/repo-github-181717?logo=github)](https://github.com/Six6stRINgs/dsh-thinking-token-stat)
[![GitHub stars](https://img.shields.io/github/stars/Six6stRINgs/dsh-thinking-token-stat?color=4a6cf7)](https://github.com/Six6stRINgs/dsh-thinking-token-stat/)


在底部 Dock 和每次对话结尾添加模型 thinking token 统计的轻量化插件。纯前端、空闲零
成本：只读取现有的会话快照，没有可用的思考数据时**完全不渲染**。

统计结果取决于模型和 provider。部分模型不会向客户端提供 reasoning token 或 reasoning
文本；对于这类回复，插件没有可统计的 thinking 数据，因此不会显示读数。这是正常行为，
并不表示插件出错。

[English version](./README.md)

![thinking-token 统计](./assets/screenshot.png)

它提供两个读数，二者在相应范围内**没有任何 thinking 时都不渲染**：

| 位置 | 插槽 | 范围 |
| --- | --- | --- |
| 底部 composer dock | `conversation.composer.dock` | 整个会话（累计） |
| 每条助手回复（计时行） | `conversation.chat.assistant-actions` | 单轮 |

单轮读数会被追加到该回复的计时条后面，与内置的用量和计时 pill 保持一致，
看起来像是同一部件的一部分。点击 thinking pill 后，会打开与 DSH 原生 UI 风格一致的
详情面板。面板会显示 thinking token 总量、全部 token 分母及比例、输出 token 分母及
比例，并跟随当前 DSH 语言切换。

百分比保留一位小数；token 数量会根据大小使用紧凑单位，例如 `K` 和 `M`。

## thinking token 如何统计

对每条已完成的助手消息，按顺序：

1. **provider 上报** —— 若存在 `usage.reasoningTokens`（DeepSeek、OpenAI
   o 系列、Anthropic 等），直接采用，精确。
2. **否则** —— 用 harness 的固定启发式（4 字符 ≈ 1 token）为 reasoning 块计价，
   这样即使 provider 只返回思考文本而没有 token 数，也能得到一个数字。
3. **两者都没有** → 该消息计为 0 个 thinking，不做贡献。

两个分母都来自*同一批*助手消息，因此比例与数量总能在一致的范围上对齐：

- **占全部 token** = thinking ÷ (输入 + 输出 + 缓存读 + 缓存写)
- **占输出 token** = thinking ÷ 输出

## 为什么轻量

- **纯前端、零宿主行为。** 节点半边（`lib/index.js`）是一个空的 `apply`，
  只是为了让包出现在宿主 Loader 中，所有逻辑都在浏览器里完成。
- **只读。** 只消费现有的会话快照，不新增服务、投影、工具或 RPC。
- **自包含。** 不依赖任何其他插件。
- **空闲零成本。** 没有思考时，两个读数都渲染为 `null` —— 没有元素、没有布局开销。
- **跟随主题。** 颜色取自 `--dsw-alias-*` 主题变量，自动适配深浅色。

## 安装

插件遵循标准的 `dsh.bundle` + `dsh.client` 约定，安装方式与其他 DSH 插件一致。

从 GitHub 安装：

```sh
dsh plugin add github:Six6stRINgs/dsh-thinking-token-stat
```

或者通过 npm 安装已发布的包：

```sh
npm install dsh-thinking-token-stat
```

通过 npm 安装后，请确保将该包加入 DSH profile 的 bundles，然后重启 `dsh web`
并刷新页面。模型开始思考后读数就会出现。

## 测试

`test/harness.mjs` 会桩化浏览器/React 环境、运行真实的 factory 与 `apply`，
并针对样例数据渲染两个读数（provider 上报与块估算路径、一位小数格式、以及
无思考时隐藏的分支）。运行：

```
node test/harness.mjs
```

## 已知限制

- 数字来自**当前窗口内**的会话快照。对于超长、分页的会话，可见窗口即统计范围；
  内置的状态栏与投影使用的是全量日志折叠。
- 字符转 token 的估算只是近似，与 harness 的固定启发式同样如此；
  provider 上报的 `reasoningTokens` 始终优先。
