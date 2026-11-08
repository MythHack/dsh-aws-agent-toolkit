// Smoke test for the AWS Agent Toolkit bundle without installing it:
// imports the Host plugin, captures the registered provider, and validates
// that every bundled skill parses and loads.
//
// Run from anywhere: node aws-agent-toolkit/scripts/verify.mjs
import assert from 'node:assert/strict'

const mod = await import('../lib/index.js')
assert.equal(mod.name, 'aws-agent-toolkit')
assert.deepEqual(mod.inject, ['skills'])

let provider
const ctx = {
  skills: { registerProvider: (create) => { provider = create({}) } },
  logger: { warn: (message) => console.warn('WARN', message) },
}
mod.apply(ctx)
assert.ok(provider, 'provider registered')

const candidates = await provider.list()
console.log('candidates:', candidates.length)
const names = candidates.map((candidate) => candidate.name)
assert.equal(names.length, 25, `expected 25 skills, got ${names.length}`)
assert.equal(new Set(names).size, names.length, 'duplicate skill names')
for (const candidate of candidates) {
  assert.match(candidate.name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  assert.ok(candidate.description.length > 20, `${candidate.name}: weak description`)
  assert.equal(candidate.provider, 'aws-agent-toolkit')
  assert.equal(candidate.rank, 600)
  assert.equal(candidate.resourceBase.kind, 'directory')
}

for (const name of ['amazon-bedrock', 'aws-cdk', 'aws-observability', 'launch-with-aws', 'signing-in-to-aws']) {
  const candidate = candidates.find((entry) => entry.name === name)
  const definition = await provider.get(candidate, {})
  assert.equal(definition.name, name)
  assert.ok(!definition.content.startsWith('---'), `${name}: frontmatter leaked into body`)
  assert.ok(definition.content.includes('#'), `${name}: empty body?`)
  console.log(`${name}: ${definition.content.length} chars, base=${definition.resourceBase.path}`)
}

console.log('sample descriptions:')
for (const name of ['amazon-bedrock', 'aws-cdk', 'signing-in-to-aws']) {
  const candidate = candidates.find((entry) => entry.name === name)
  console.log(`- ${name}: ${candidate.description.slice(0, 110)}...`)
}
console.log('OK')
