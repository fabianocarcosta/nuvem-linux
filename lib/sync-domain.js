import path from 'node:path'
import { createHash } from 'node:crypto'

export const MIN_RCLONE_VERSION = '1.71.0'

function versionTuple(value) {
  const match = String(value).match(/(?:rclone\s+)?v?(\d+)\.(\d+)\.(\d+)(?:[-+][\w.-]+)?/i)
  return match ? match.slice(1, 4).map(Number) : null
}

export function isRcloneSupported(value) {
  const found = versionTuple(value)
  const minimum = versionTuple(MIN_RCLONE_VERSION)
  if (!found || !minimum) return false
  for (let index = 0; index < found.length; index++) {
    if (found[index] !== minimum[index]) return found[index] > minimum[index]
  }
  return true
}

export function normalizeDrivePath(value) {
  const raw = String(value || '').trim().replaceAll('\\', '/')
  if (!raw || raw.startsWith('/') || /^[a-zA-Z]:/.test(raw)) throw new Error('Informe uma pasta de destino relativa à raiz do Google Drive.')
  const parts = raw.split('/').filter(part => part && part !== '.')
  if (!parts.length || parts.some(part => part === '..')) throw new Error('O destino não pode sair da pasta raiz do Google Drive.')
  return parts.join('/')
}

export function pathsOverlap(first, second, flavor = path) {
  const a = flavor.resolve(first)
  const b = flavor.resolve(second)
  const aToB = flavor.relative(a, b)
  const bToA = flavor.relative(b, a)
  return aToB === '' || bToA === '' || (!aToB.startsWith(`..${flavor.sep}`) && aToB !== '..') || (!bToA.startsWith(`..${flavor.sep}`) && bToA !== '..')
}

export function validatePairOverlap(candidate, folders) {
  for (const existing of folders) {
    if (pathsOverlap(candidate.localPath, existing.localPath)) {
      throw new Error(`A pasta local se sobrepõe ao vínculo já configurado “${existing.localPath}”.`)
    }
    if (candidate.remote === existing.remote && pathsOverlap(candidate.remotePath, existing.remotePath, path.posix)) {
      throw new Error(`O destino no Drive se sobrepõe ao vínculo já configurado “${existing.remote}:${existing.remotePath}”.`)
    }
  }
}

function hashMatch(local, remote) {
  const localHashes = local.Hashes || {}
  const remoteHashes = remote.Hashes || {}
  const common = Object.keys(localHashes).find(name => remoteHashes[name])
  return common ? String(localHashes[common]).toLowerCase() === String(remoteHashes[common]).toLowerCase() : false
}

export function fingerprintEntries(localEntries, remoteEntries) {
  const canonical = entries => [...entries]
    .map(entry => ({ path: entry.Path, size: entry.Size, modTime: entry.ModTime, hashes: entry.Hashes || {} }))
    .sort((a, b) => a.path.localeCompare(b.path))
  return createHash('sha256').update(JSON.stringify([canonical(localEntries), canonical(remoteEntries)])).digest('hex')
}

export function buildInitialPlan(localEntries, remoteEntries, previewId, generatedAt = Date.now()) {
  const local = new Map(localEntries.map(entry => [entry.Path, entry]))
  const remote = new Map(remoteEntries.map(entry => [entry.Path, entry]))
  const paths = [...new Set([...local.keys(), ...remote.keys()])].sort((a, b) => a.localeCompare(b))
  const rows = []
  const summary = { upload: 0, download: 0, identical: 0, conflicts: 0 }
  for (const relativePath of paths) {
    const left = local.get(relativePath)
    const right = remote.get(relativePath)
    if (left && !right) { summary.upload++; rows.push({ path: relativePath, action: 'upload', size: left.Size }); continue }
    if (right && !left) { summary.download++; rows.push({ path: relativePath, action: 'download', size: right.Size }); continue }
    if (hashMatch(left, right)) { summary.identical++; continue }
    summary.conflicts++
    rows.push({ path: relativePath, action: 'conflict', size: left.Size, remoteSize: right.Size })
  }
  const fingerprint = fingerprintEntries(localEntries, remoteEntries)
  const existingPaths = new Set(paths)
  for (const row of rows) {
    if (row.action === 'conflict') row.preserveAs = conflictCopyPath(row.path, existingPaths, fingerprint.slice(0, 8))
  }
  return {
    id: previewId,
    generatedAt,
    fingerprint,
    summary,
    rows: rows.slice(0, 300),
    truncated: rows.length > 300,
  }
}

export function conflictCopyPath(relativePath, existingPaths, stamp = new Date().toISOString().replace(/[:.]/g, '-')) {
  const parsed = path.posix.parse(relativePath)
  const base = `${parsed.name} (conflito Google Drive ${stamp})`
  let candidate = path.posix.join(parsed.dir, `${base}${parsed.ext}`)
  let suffix = 2
  while (existingPaths.has(candidate)) candidate = path.posix.join(parsed.dir, `${base} ${suffix++}${parsed.ext}`)
  existingPaths.add(candidate)
  return candidate
}

export function summarizeRcloneError(message) {
  const clean = String(message || 'Erro desconhecido').replace(/\u001b\[[0-9;]*m/g, '')
  return clean.split('\n').filter(Boolean).slice(-5).join(' ').slice(0, 1000)
}

export const DEFAULT_IGNORE_PATTERNS = [
  '/.nuvem-linux-trash/**',
  '.nuvem-linux-backups/**',
  '.~lock.*#',
  '~$*',
  '*.tmp',
]

export function parseIgnorePatterns(content) {
  if (!content || typeof content !== 'string') return []
  return content
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
}

export function parseConflictName(filename) {
  if (!filename || typeof filename !== 'string') return null
  let m = filename.match(/^(.*?)\s*\((?:cópia em\s+)?conflito[^\)]*\)(?:\s*\d+)?(\.[^.]+)?$/i)
  if (m) return m[1] + (m[2] || '')
  m = filename.match(/^(.*?)\.conflito\d+(\.[^.]+)?$/i)
  if (m) return m[1] + (m[2] || '')
  m = filename.match(/^(.*?)\.conflito\d+$/i)
  if (m) return m[1]
  return null
}

export function compareSemver(v1, v2) {
  const clean = v => String(v || '').replace(/^v/i, '').trim()
  const p1 = clean(v1).split('.').map(n => parseInt(n, 10) || 0)
  const p2 = clean(v2).split('.').map(n => parseInt(n, 10) || 0)
  const len = Math.max(p1.length, p2.length, 3)
  for (let i = 0; i < len; i++) {
    const a = p1[i] || 0
    const b = p2[i] || 0
    if (a > b) return 1
    if (a < b) return -1
  }
  return 0
}


