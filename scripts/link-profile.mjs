#!/usr/bin/env node
/**
 * Link every @javenlu233 cost-plugin package into the dsh profile's global
 * @javenlu233 namespace (~/.dsh/profiles/node_modules/@javenlu233).
 *
 * The dsh loader resolves plugin rows (cordis.patch.yml `name:` entries) by
 * Node package resolution from the profile directory, which walks up through
 * ~/.dsh/profiles/node_modules. The cost-monitor aggregate bundle depends on the
 * session-cost and ui-turn-cost children, so they must resolve there for
 * `dsh plugin --profile web add link:<...>/packages/cost-monitor` to succeed.
 *
 * Idempotent and safe to rerun. Windows (without Developer Mode) uses
 * directory junctions, which require absolute targets.
 *
 * Usage:
 *   node scripts/link-profile.mjs            # link/refresh the family
 *   node scripts/link-profile.mjs --dry-run  # report without changing
 */
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, rmdirSync, symlinkSync, unlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, relative, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url))
const REPO_ROOT = resolvePath(SCRIPT_DIR, '..')
const FAMILY_SCOPE = '@javenlu233/'

function report(msg) {
  console.log(`[link-profile] ${msg}`)
}

/** Every family package under packages/<group>/<name>. */
function familyPackages() {
  const found = []
  for (const group of readdirSync(join(REPO_ROOT, 'packages')).sort()) {
    const groupDir = join(REPO_ROOT, 'packages', group)
    if (!lstatSync(groupDir).isDirectory()) continue
    for (const entry of readdirSync(groupDir).sort()) {
      const pkgJson = join(groupDir, entry, 'package.json')
      if (!existsSync(pkgJson)) continue
      let name
      try { name = JSON.parse(readFileSync(pkgJson, 'utf8')).name } catch { continue }
      if (name && name.startsWith(FAMILY_SCOPE)) {
        found.push({ name: name.slice(FAMILY_SCOPE.length), dir: join(groupDir, entry) })
      }
    }
  }
  return found
}

function main() {
  const DRY = process.argv.includes('--dry-run')
  const HOME = process.env.HOME || homedir()
  if (!HOME) {
    report('cannot determine home directory')
    process.exit(1)
  }
  const LINK_DIR = join(HOME, '.dsh', 'profiles', 'node_modules', FAMILY_SCOPE)
  const packages = familyPackages()
  report(`found ${packages.length} family package(s) under packages/`)
  if (DRY) report('--dry-run: no changes will be made')

  if (!existsSync(LINK_DIR)) {
    if (DRY) {
      report(`would create link dir: ${LINK_DIR}`)
      process.exit(0)
    }
    mkdirSync(LINK_DIR, { recursive: true })
    report(`created link dir: ${LINK_DIR}`)
  }

  const WIN32 = process.platform === 'win32'
  let changed = 0
  for (const { name, dir } of packages) {
    const linkPath = join(LINK_DIR, name)
    const target = WIN32 ? dir : relative(LINK_DIR, dir)
    let existing = 'missing'
    let linkIsJunctionDir = false
    try {
      const st = lstatSync(linkPath)
      existing = st.isSymbolicLink() ? 'symlink' : st.isDirectory() ? 'dir' : 'file'
      if (existing === 'symlink' && st.isDirectory()) linkIsJunctionDir = true
    } catch {}
    let current = null
    if (existing === 'symlink') {
      try { current = readlinkSync(linkPath) } catch {}
    }
    if (existing === 'symlink' && current === target) continue
    if (existing === 'dir' || existing === 'file') {
      report(`skipped (not a symlink, untouched): ${linkPath}`)
      continue
    }
    if (existing === 'symlink') {
      if (DRY) { report(`would replace ${name} -> ${target}`); changed++; continue }
      if (linkIsJunctionDir) rmdirSync(linkPath)
      else unlinkSync(linkPath)
      symlinkSync(target, linkPath, WIN32 ? 'junction' : undefined)
      report(`replaced ${name} -> ${target}`)
    } else {
      if (DRY) { report(`would link ${name} -> ${target}`); changed++; continue }
      symlinkSync(target, linkPath, WIN32 ? 'junction' : undefined)
      report(`linked ${name} -> ${target}`)
    }
    changed++
  }
  report(changed === 0 ? 'nothing to do' : `${changed} link(s) ${DRY ? 'would be ' : ''}updated`)
}

if (resolvePath(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main()
}
