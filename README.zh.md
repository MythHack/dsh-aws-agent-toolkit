# dsh-aws-agent-toolkit（中文说明）

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

把 [Agent Toolkit for AWS](https://github.com/aws/agent-toolkit-for-aws) 带到
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的社区插件包。
AWS 为 Claude Code、Codex、Cursor、Devin 提供的那套「技能 + MCP Server」组合，
现在可以作为一个 DSH bundle 一次装好：

| 行 | 内容 |
|---|---|
| `aws-agent-toolkit-skills` | 25 个 AWS 技能，通过 `ctx.skills` 注册；catalog 只放摘要，正文按需加载，`references/**` 相对技能目录解析 |
| `aws-agent-toolkit-mcp` | 托管的 **AWS MCP Server**（`https://aws-mcp.us-east-1.api.aws/mcp`），经 SigV4 的 `uvx mcp-proxy-for-aws-cli` 接入，工具名 `mcp__aws__*` |

技能部分不需要 AWS 账号；MCP 部分需要标准 AWS 凭据链中有凭据（`aws login` 或已配置 profile）。

## 依赖

- 带插件管理器的 DeepSeek Harness；
- **Node.js 20+** 在 `PATH` 中（MCP 行会运行 `lib/aws-mcp-bridge.mjs`）；
- **`uvx`**（来自 [uv](https://docs.astral.sh/uv/)）在 `PATH` 中；
- 使用 MCP 工具需要 **AWS 凭据**（`aws login`，AWS CLI 2.39+，或 `aws configure`）。

## 安装

### 直接从 GitHub 安装（不用 clone）

在 DSH 会话里让插件管理器按包规格安装：

```
plugin_manager install_bundle github:MythHack/dsh-aws-agent-toolkit
```

pnpm 会拉取仓库 tarball，profile 里记录 git 规格，`pnpm-lock.yaml` 会锁定安装到的
具体 commit。要锁版本可以写 `github:MythHack/dsh-aws-agent-toolkit#v0.1.0`。
安装后两行立即激活；不需要先 clone 或构建。

### 从本地 checkout 安装（开发用）

```bash
git clone https://github.com/MythHack/dsh-aws-agent-toolkit.git
plugin_manager install_bundle "C:/path/to/dsh-aws-agent-toolkit"
```

目录安装是 `link:` 依赖，改完代码重启 DSH（或重载该行）即可生效，不用重装。

### 更新

安装会固定在某个 commit；要跟到仓库最新状态就移除后重装：

```
plugin_manager remove_bundle dsh-aws-agent-toolkit
plugin_manager install_bundle github:MythHack/dsh-aws-agent-toolkit
```

### Windows 上的一个小坑

已装过本地 `link:` 版本的 profile，直接改装 GitHub 规格时可能报
`ERR_PNPM_EPERM ... rename ... node_modules/dsh-aws-agent-toolkit`——旧的链接目录
挡住了 pnpm 的导入。先 `plugin_manager remove_bundle dsh-aws-agent-toolkit` 再装
git 规格即可；全新 profile 不会有这个问题。

安装后：技能目录马上多出 25 个 AWS 技能；MCP 行会用凭据尝试连接，若还没登录会保持
`disconnected`，执行 `aws login` 后在插件管理器里重载该行（或重启 DSH）即可。

连上后的工具：

```
mcp__aws__search_documentation   mcp__aws__read_documentation
mcp__aws__run_script             mcp__aws__get_presigned_url
mcp__aws__retrieve_skill         mcp__aws__list_regions
mcp__aws__get_regional_availability   mcp__aws__get_tasks
```

## 为什么有 bridge

AWS 托管服务器的工具名自带 `aws___` 前缀，而 DSH 统一按
`mcp__<serverName>__<rawName>` 命名，两者叠加会出现
`mcp__aws__aws___search_documentation`。DSH 的 MCP 客户端没有改名配置，所以
`lib/aws-mcp-bridge.mjs` 做一个透明 stdio 中继：`tools/list` 返回时去掉
`aws___`，`tools/call` 时加回去，其余内容原样透传。

## 配置

行配置在 [`cordis.patch.yml`](cordis.patch.yml)，profile 加载时读取，改完需重启
DSH（或在插件管理器里重载该行）。

- **区域**：同时改 endpoint 和 `AWS_REGION` 参数，例如
  `https://aws-mcp.eu-west-1.api.aws/mcp` + `AWS_REGION=eu-west-1`；
- **无凭据仅预览文档**：在 bridge 参数里加 `--skip-auth`（`run_script` 等 API
  工具仍需签名身份，登录后请去掉该参数）；
- **工具超时**：`toolCallTimeoutMs: 180000`（proxy 自身默认 120s）；
- **只要技能**：删除 `aws-agent-toolkit-mcp` 行；**只要 MCP**：删除
  `aws-agent-toolkit-skills` 行。

## 开发与验证

```
npm run verify        # 等价于 node scripts/verify.mjs
```

离线冒烟测试：用假的 skill registry 加载 Host 插件，校验 25 个技能全部能解析、
正文能加载，不联网、不需要 AWS 账号。CI 在 Ubuntu 和 Windows 上各跑一遍。

## 卸载

```
plugin_manager remove_bundle dsh-aws-agent-toolkit
```

## 许可与归属

Apache-2.0。`skills/` 下的内容复制自
[`aws/agent-toolkit-for-aws`](https://github.com/aws/agent-toolkit-for-aws)
（Copyright Amazon.com, Inc. or its affiliates），按 Apache License 2.0 再分发，
详见 [NOTICE](NOTICE)；bundle 的代码、patch、bridge、文档为原创，同样以
Apache-2.0 发布。

本项目是非官方社区项目，与 Amazon Web Services、DeepSeek 无隶属或背书关系。
"AWS" 及各服务名是 Amazon.com, Inc. 或其关联公司的商标。
