# Changelog

## 0.1.0 — 2026-11-08

Initial release.

- Bundled 25 AWS skills from the Agent Toolkit for AWS (`skills/`), registered
  through one `ctx.skills` provider with on-demand body loading and per-skill
  resource bases.
- AWS MCP Server row for `@deepseek-ai/dsh-mcp-client`: `uvx
  mcp-proxy-for-aws-cli@latest` against `https://aws-mcp.us-east-1.api.aws/mcp`.
- `lib/aws-mcp-bridge.mjs`: stdio relay that strips the server's `aws___` tool
  prefix, so tools are `mcp__aws__<tool>` instead of
  `mcp__aws__aws___<tool>`.
- Offline verification script (`npm run verify`) and CI for Ubuntu and Windows.
- Plugin-manager display metadata and icon; Apache-2.0 licensing with AWS
  attribution in `NOTICE`.
