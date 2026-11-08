/**
 * Bundled AWS skills provider for DeepSeek Harness.
 *
 * Registers one `ctx.skills` provider that advertises the skills under
 * `../skills/<name>/SKILL.md` in the model catalog and loads each body on
 * demand. Every loaded skill carries its skill directory as the resource base,
 * so a body that points at `references/...` resolves against real files.
 *
 * The assets come from `aws/agent-toolkit-for-aws` (Apache-2.0); see NOTICE.
 *
 * @module @local/aws-agent-toolkit
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Registry name for this bundled provider; must be stable across loads. */
const PROVIDER_NAME = 'aws-agent-toolkit'

/** Precedence rank for packaged skill providers and local bundled roots. */
const BUNDLED_SKILL_RANK = 600

/** Absolute directory holding `<skill>/SKILL.md` asset folders. */
const SKILLS_DIR = fileURLToPath(new URL('../skills/', import.meta.url))

/** Frontmatter block at the very start of a SKILL.md file. */
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u

/** Public skill-name grammar enforced by the registry. */
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u

/** Cordis plugin identity. */
export const name = 'aws-agent-toolkit'

/** Service required by this plugin. */
export const inject = ['skills']

/**
 * Parse one SKILL.md: its YAML frontmatter subset and body.
 *
 * Only the flat scalar fields present in the AWS toolkit assets are supported
 * (`name`, `description`, `version`, `argument-hint`), including folded (`>-`)
 * and literal (`|`) block scalars. Anything else is ignored on purpose: the
 * catalog contract needs a name and a description, and the body is loaded
 * verbatim minus frontmatter.
 *
 * @param raw - complete file text.
 * @param path - source path, used in error messages.
 * @returns parsed description and body.
 */
function parseSkill(raw, path) {
  const match = FRONTMATTER.exec(raw)
  if (match === null) throw new Error(`aws-agent-toolkit: ${path} has no YAML frontmatter`)
  const fields = parseFrontmatter(match[1], path)
  const description = fields.description
  if (typeof description !== 'string' || description.length === 0) {
    throw new Error(`aws-agent-toolkit: ${path} has no description`)
  }
  return { description, content: raw.slice(match[0].length).trim() }
}

/**
 * Parse the flat scalar subset of YAML frontmatter used by the skill assets.
 *
 * @param text - frontmatter body without the `---` fence lines.
 * @param path - source path, used in error messages.
 * @returns scalar field values.
 */
function parseFrontmatter(text, path) {
  const fields = {}
  const lines = text.split(/\r?\n/u)
  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    index += 1
    const entry = /^([A-Za-z0-9_-]+):(?:[ \t]*(.*))?$/u.exec(line)
    if (entry === null) continue
    const key = entry[1]
    const rawValue = (entry[2] ?? '').trim()
    if (rawValue === '>' || rawValue === '>-' || rawValue === '|' || rawValue === '|-') {
      const block = []
      while (index < lines.length && (lines[index].trim() === '' || /^[ \t]+/u.test(lines[index]))) {
        block.push(lines[index].trim())
        index += 1
      }
      fields[key] = rawValue.startsWith('>') ? foldBlock(block) : block.join('\n').replace(/\s+$/u, '')
      continue
    }
    fields[key] = unquote(rawValue, path)
  }
  return fields
}

/**
 * Fold a YAML `>` block: lines join with spaces, blank lines separate paragraphs.
 *
 * @param lines - trimmed block lines, possibly containing empty strings.
 * @returns folded scalar text.
 */
function foldBlock(lines) {
  const parts = []
  let paragraph = []
  const flush = () => {
    if (paragraph.length > 0) {
      parts.push(paragraph.join(' '))
      paragraph = []
    }
  }
  for (const line of lines) {
    if (line === '') flush()
    else paragraph.push(line)
  }
  flush()
  return parts.join('\n\n')
}

/**
 * Remove one pair of surrounding quotes from a plain scalar.
 *
 * @param value - trimmed scalar text.
 * @param path - source path, used in error messages.
 * @returns unquoted scalar text.
 */
function unquote(value, path) {
  if (value.length >= 2) {
    const first = value[0]
    const last = value[value.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) return value.slice(1, -1)
    if (first === '"' || first === "'") throw new Error(`aws-agent-toolkit: ${path} has an unterminated quoted value`)
  }
  return value
}

/**
 * Discover skill directories and build their catalog candidates.
 *
 * Invalid asset folders are skipped with a warning so one broken file cannot
 * hide the rest of the bundle; a missing skills directory is a packaging error
 * and fails activation.
 *
 * @param logger - context logger used for skip diagnostics.
 * @returns candidate list, sorted by skill name.
 */
function discoverCandidates(logger) {
  let entries
  try {
    entries = readdirSync(SKILLS_DIR, { withFileTypes: true })
  } catch (error) {
    throw new Error(`aws-agent-toolkit: cannot read bundled skills at ${SKILLS_DIR}: ${String(error)}`)
  }
  const candidates = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    // One bad name must not poison the provider's list(): drop it here instead
    // of letting the registry reject the whole catalog.
    if (!SKILL_NAME.test(entry.name)) {
      logger.warn?.(`aws-agent-toolkit: skipping ${entry.name}: not a kebab-case skill name`)
      continue
    }
    const directory = join(SKILLS_DIR, entry.name)
    const path = join(directory, 'SKILL.md')
    try {
      if (!statSync(path).isFile()) continue
      const parsed = parseSkill(readFileSync(path, 'utf8'), path)
      candidates.push({
        name: entry.name,
        description: parsed.description,
        invocation: { modelInvocable: true, userInvocable: true },
        provider: PROVIDER_NAME,
        source: 'bundled',
        rank: BUNDLED_SKILL_RANK,
        path,
        resourceBase: { kind: 'directory', path: directory.split(sep).join('/') },
        locator: path,
      })
    } catch (error) {
      logger.warn?.(`aws-agent-toolkit: skipping ${entry.name}: ${String(error)}`)
    }
  }
  candidates.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))
  if (candidates.length === 0) throw new Error(`aws-agent-toolkit: no bundled skills found at ${SKILLS_DIR}`)
  return candidates
}

/**
 * Register the bundled AWS skill provider on `ctx.skills`.
 *
 * @param ctx - context carrying the skill registry.
 */
export function apply(ctx) {
  // Guard the service lookup so a composition without the skill registry fails
  // with a readable message instead of a property access error.
  const registry = ctx.skills
  if (registry === undefined) throw new Error('aws-agent-toolkit: the skill registry service (skills) is not mounted')
  const candidates = discoverCandidates(ctx.logger)
  const provider = {
    name: PROVIDER_NAME,
    list: () => Promise.resolve(candidates),
    async get(candidate, options) {
      const { rank: _rank, locator, ...summary } = candidate
      const parsed = parseSkill(await readFile(locator, { encoding: 'utf8', signal: options?.signal }), locator)
      return { ...summary, content: parsed.content }
    },
  }
  registry.registerProvider(() => provider)
}
