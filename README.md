# dsh-aws-agent-toolkit

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![verify](https://github.com/MythHack/dsh-aws-agent-toolkit/actions/workflows/verify.yml/badge.svg)](https://github.com/MythHack/dsh-aws-agent-toolkit/actions/workflows/verify.yml)

A community [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
plugin bundle that brings the
[Agent Toolkit for AWS](https://github.com/aws/agent-toolkit-for-aws) to DSH —
the same two-part setup AWS ships for Claude Code, Codex, Cursor, and Devin,
packaged as one installable DSH bundle:

| Row | What it adds |
|---|---|
| `aws-agent-toolkit-skills` | 25 AWS skills registered through `ctx.skills`. Catalog summaries are cheap; bodies load on demand and `references/**` resolve against each skill directory. |
| `aws-agent-toolkit-mcp` | The managed **AWS MCP Server** (`https://aws-mcp.us-east-1.api.aws/mcp`) over the SigV4 `uvx mcp-proxy-for-aws-cli` bridge, exposed as `mcp__aws__*` tools. |

Skills work with no AWS account. MCP tools connect once the standard AWS
credential chain has credentials (`aws login` or a configured profile).

## Requirements

- DeepSeek Harness with the plugin manager (Desktop or a profile-backed CLI).
- **Node.js 20+** on `PATH` — the MCP row runs
  [`lib/aws-mcp-bridge.mjs`](lib/aws-mcp-bridge.mjs).
- **`uvx`** from [uv](https://docs.astral.sh/uv/) on `PATH` — runs the
  `mcp-proxy-for-aws-cli` package on demand.
- **AWS credentials** for the MCP tools — `aws login` (AWS CLI 2.39+) or
  `aws configure`. Skills alone need none.

## Install

```bash
git clone https://github.com/MythHack/dsh-aws-agent-toolkit.git
```

Then install that directory as a profile bundle. From a DSH session, ask the
agent to install it with the plugin manager, pointing at the absolute path:

```
plugin_manager install_bundle "C:/path/to/dsh-aws-agent-toolkit"
```

(or use **Settings → Plugins** in the DSH Desktop UI). The plugin manager adds
the dependency to the current profile, applies the bundle patch, and the two
rows activate immediately.

After installation:

1. The skill catalog gains 25 AWS skills — usable right away.
2. The MCP row attempts its authenticated connection. If you have not logged in
   yet it stays `disconnected`; run `aws login`, then reload the row (disable
   and re-enable `aws-agent-toolkit-mcp` in the plugin manager) or restart DSH.

Verify tools callable in the session:

```
mcp__aws__search_documentation   mcp__aws__read_documentation
mcp__aws__run_script             mcp__aws__get_presigned_url
mcp__aws__retrieve_skill         mcp__aws__list_regions
mcp__aws__get_regional_availability   mcp__aws__get_tasks
```

## MCP tools

| Tool | Purpose |
|---|---|
| `search_documentation` | Search AWS docs/API references; returns verbatim page chunks. |
| `read_documentation` | Fetch full allow-listed AWS doc pages as markdown. |
| `retrieve_skill` | Fetch an AWS-published skill by the `skill_name` a search returned. |
| `run_script` | Run Python in a sandbox with `call_boto3`-based AWS API access. |
| `get_presigned_url` | Generate S3 presigned upload/download URLs. |
| `list_regions` | List all AWS regions. |
| `get_regional_availability` | Check product/API/CloudFormation availability per region. |
| `get_tasks` | Poll long-running calls that returned a task ID. |

## Skills

| Skill | Covers |
|---|---|
| `amazon-bedrock` | Bedrock model invocation, Knowledge Bases, Agents, AgentCore |
| `aws-ai-ml` | SageMaker training, tuning, deployment, evaluation |
| `aws-auth` | Cognito user pools and Amplify auth flows |
| `aws-billing-and-cost-management` | Cost analysis, budgets, Savings Plans, pricing |
| `aws-blocks` | Full-stack apps on AWS Blocks |
| `aws-cdk` | CDK authoring, deploys, drift, troubleshooting |
| `aws-cloudformation` | CFN authoring, validation, failed-stack diagnosis |
| `aws-compute` | EC2 fleets, Auto Scaling, IMDSv2, Systems Manager |
| `aws-containers` | EKS, ECS, Fargate, ECR, Elastic Beanstalk |
| `aws-database` | Aurora, DSQL, RDS, DynamoDB, Keyspaces, DocumentDB, Neptune, … |
| `aws-deployment` | CodePipeline, CodeBuild, CodeDeploy, CodeArtifact |
| `aws-iam` | IAM policy-evaluation edge cases and role workflows |
| `aws-investigation` | Evidence-based account investigation |
| `aws-messaging-and-streaming` | SQS, SNS, EventBridge, Kinesis, MSK, MQ |
| `aws-networking` | Route 53, CloudFront, Transit Gateway, Direct Connect, VPN, WAF, Shield |
| `aws-observability` | CloudWatch, X-Ray/ADOT, Application Signals, Omni |
| `aws-sdk-js-v3-usage` | AWS SDK for JavaScript v3 patterns |
| `aws-sdk-python-usage` | boto3 / botocore patterns |
| `aws-sdk-swift-usage` | AWS SDK for Swift patterns |
| `aws-security` | Security Hub, GuardDuty, Inspector, Macie, Security Lake |
| `aws-serverless` | Lambda, API Gateway, Step Functions routing |
| `aws-storage` | S3, EFS, FSx, EBS selection and operations |
| `aws-well-architected-review` | Full Well-Architected review with findings |
| `launch-with-aws` | Vibe-coded web apps → AWS Blocks deployment |
| `signing-in-to-aws` | Get credentials through `aws login` |

## Why the bridge

The managed AWS server names its tools `aws___<tool>`, while DSH names every
MCP tool `mcp__<serverName>__<rawName>`. With `serverName: aws` the prefixes
stack into `mcp__aws__aws___search_documentation`. DSH's MCP client has no
per-tool rename option, so [`lib/aws-mcp-bridge.mjs`](lib/aws-mcp-bridge.mjs) is
a transparent stdio relay: it strips `aws___` from `tools/list` results and
re-adds it on `tools/call`. Initialization, instructions, resources, pagination,
progress, and errors pass through untouched.

## Configuration

The rows live in [`cordis.patch.yml`](cordis.patch.yml); row configuration is
read at profile load, so edit and then restart DSH (or reload the row from the
plugin manager).

- **Region** — change the endpoint URL and the `AWS_REGION` metadata argument,
  for example `https://aws-mcp.eu-west-1.api.aws/mcp` with `AWS_REGION=eu-west-1`.
- **Docs-only preview without credentials** — add `--skip-auth` to the bridge
  arguments. Documentation calls work; `run_script` and other AWS API tools
  still need a signed identity, so remove the flag once logged in.
- **Tool timeout** — `toolCallTimeoutMs: 180000` (the proxy's own default call
  timeout is 120 s).
- **Skills only** — delete the `aws-agent-toolkit-mcp` row.
- **MCP only** — delete the `aws-agent-toolkit-skills` row; the skill assets can
  then be removed too.

## How it works

- `lib/index.js` is a Host plugin (`inject: ['skills']`). On activation it scans
  `skills/`, parses each `SKILL.md` frontmatter once, and registers one provider.
  `list()` returns summaries; `get()` re-reads the current body and returns it
  with a `directory` resource base, so edits show up on the next load.
- `cordis.patch.yml` inserts that plugin and one `@deepseek-ai/dsh-mcp-client`
  row. The MCP row launches `node <profile>/node_modules/<bundle>/lib/aws-mcp-bridge.mjs`
  with the proxy arguments; the bridge starts `uvx mcp-proxy-for-aws-cli@latest`.

## Repository layout

```
package.json            bundle manifest (dsh.bundle.patch, locale/icon exports)
cordis.patch.yml        loader rows: bundled skills + AWS MCP client
lib/index.js            Host plugin: bundled skill provider
lib/aws-mcp-bridge.mjs  stdio relay that strips the aws___ tool-name prefix
skills/<name>/SKILL.md  25 AWS skills, copied from aws/agent-toolkit-for-aws
locale/en.json, zh.json plugin-manager display metadata
icon.svg                plugin inventory icon
scripts/verify.mjs      offline smoke test
.github/workflows/      CI: verify on Linux and Windows
LICENSE, NOTICE         Apache-2.0 and attribution
```

## Development

```
npm run verify        # or: node scripts/verify.mjs
```

The smoke test imports the Host plugin with a fake skill registry, asserts all
25 skills parse and load, and fails on any contract violation. It needs no
network and no AWS account. CI runs it on Ubuntu and Windows for every push and
pull request.

## Uninstall

```
plugin_manager remove_bundle dsh-aws-agent-toolkit
```

Removes the rows, the profile dependency, and the MCP tools.

## License and attribution

Apache-2.0. The skill content under `skills/` is copied from
[`aws/agent-toolkit-for-aws`](https://github.com/aws/agent-toolkit-for-aws),
Copyright Amazon.com, Inc. or its affiliates, and is redistributed under the
Apache License 2.0 — see [NOTICE](NOTICE). The bundle code, patch, bridge, and
documentation are original work under the same license.

This is an unofficial community project, not affiliated with or endorsed by
Amazon Web Services or DeepSeek. "AWS" and service names are trademarks of
Amazon.com, Inc. or its affiliates.

中文说明见 [README.zh.md](README.zh.md)。
