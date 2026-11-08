#!/usr/bin/env node
/**
 * Tool-name bridge in front of the AWS MCP Server proxy.
 *
 * The managed AWS endpoint names its tools with an `aws___` service prefix
 * (`aws___search_documentation`). DSH's MCP client already prefixes every tool
 * with `mcp__<serverName>__`, so a server named `aws` would expose
 * `mcp__aws__aws___search_documentation` — two "aws" segments for no reason.
 *
 * This bridge is a transparent stdio relay around
 * `uvx mcp-proxy-for-aws-cli@latest`: it rewrites `tools/list` results to strip
 * the prefix and re-adds it on `tools/call`. Everything else passes through
 * byte-for-byte, so capabilities, instructions, resources, pagination, progress
 * and error payloads are untouched.
 *
 * Usage: node aws-mcp-bridge.mjs <endpoint> [proxy args...]
 */
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

/** Prefix the AWS MCP Server puts on its tool names. */
const TOOL_PREFIX = 'aws___'

/** Package specifier run through uvx; pinned to the same proxy AWS documents. */
const PROXY_PACKAGE = 'mcp-proxy-for-aws-cli@latest'

const proxyArgs = process.argv.slice(2)
if (proxyArgs.length === 0) {
  process.stderr.write('aws-mcp-bridge: expected the endpoint URL and optional proxy arguments\n')
  process.exit(2)
}

const proxy = spawn('uvx', [PROXY_PACKAGE, ...proxyArgs], {
  stdio: ['pipe', 'pipe', 'pipe'],
  windowsHide: true,
})

proxy.on('error', (error) => {
  process.stderr.write(`aws-mcp-bridge: cannot start ${PROXY_PACKAGE}: ${error.message}\n`)
  process.exit(1)
})
proxy.stderr.on('data', (chunk) => process.stderr.write(chunk))
proxy.on('exit', (code, signal) => {
  // Mirror the proxy's own exit so the MCP client reconnects on its failure path.
  process.exit(code ?? (signal === null ? 0 : 1))
})

/** Strip the AWS service prefix from one advertised tool name. */
function stripPrefix(name) {
  return typeof name === 'string' && name.startsWith(TOOL_PREFIX) ? name.slice(TOOL_PREFIX.length) : name
}

/** Add the AWS service prefix back for one outbound tool call. */
function addPrefix(name) {
  return typeof name === 'string' && name.startsWith(TOOL_PREFIX) ? name : TOOL_PREFIX + name
}

/** Write one JSON-RPC message (newline-delimited) to a stream. */
function writeMessage(stream, message) {
  stream.write(`${JSON.stringify(message)}\n`)
}

/**
 * Rewrite an outbound (`client -> proxy`) message.
 *
 * Only `tools/call` needs translation: the client sees stripped names, the
 * server expects prefixed ones. Requests are rewritten as parsed JSON so the
 * name change is visible; everything else is forwarded as the original line to
 * avoid re-serializing values we do not understand.
 */
function forwardToProxy(line) {
  let message
  try {
    message = JSON.parse(line)
  } catch {
    proxy.stdin.write(`${line}\n`)
    return
  }
  if (
    message !== null &&
    typeof message === 'object' &&
    message.method === 'tools/call' &&
    message.params !== null &&
    typeof message.params === 'object' &&
    typeof message.params.name === 'string'
  ) {
    message.params.name = addPrefix(message.params.name)
    writeMessage(proxy.stdin, message)
    return
  }
  proxy.stdin.write(`${line}\n`)
}

/**
 * Rewrite an inbound (`proxy -> client`) message: strip the prefix from every
 * tool advertised by a `tools/list` result. Other traffic is forwarded verbatim.
 */
function forwardToClient(line) {
  let message
  try {
    message = JSON.parse(line)
  } catch {
    process.stdout.write(`${line}\n`)
    return
  }
  const tools = message?.result?.tools
  if (Array.isArray(tools)) {
    for (const tool of tools) {
      if (tool !== null && typeof tool === 'object' && typeof tool.name === 'string') {
        tool.name = stripPrefix(tool.name)
      }
    }
    writeMessage(process.stdout, message)
    return
  }
  process.stdout.write(`${line}\n`)
}

const clientInput = createInterface({ input: process.stdin, crlfDelay: Infinity })
clientInput.on('line', forwardToProxy)
clientInput.on('close', () => {
  proxy.stdin.end()
})

const proxyOutput = createInterface({ input: proxy.stdout, crlfDelay: Infinity })
proxyOutput.on('line', forwardToClient)

process.stdin.on('end', () => {
  try {
    proxy.kill()
  } catch {
    // The proxy already exited; nothing to clean up.
  }
})
