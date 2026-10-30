import express from 'express'
import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { access, chmod, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, stat, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'
import chokidar from 'chokidar'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
import {
  buildInitialPlan,
  compareSemver,
  conflictCopyPath,
  normalizeDrivePath,
  parseConflictName,
  parseIgnorePatterns,
  pathsOverlap,
  validatePairOverlap,
} from './lib/sync-domain.js'
import { requireSupportedRclone, rcloneHealth, runRclone, runCommand } from './lib/rclone.js'
import { findLinuxTrashItem, moveToLinuxTrash, purgeLinuxTrashItem, restoreFromLinuxTrash } from './lib/linux-trash.js'

const execFileAsync = promisify(execFile)
const app = express()
const port = Number(process.env.PORT || 4173)
const dataDir = path.join(homedir(), '.local', 'share', 'nuvem-linux')
const dataFile = path.join(dataDir, 'sync-folders.json')
const trashFile = path.join(dataDir, 'sync-trash.json')
const activityFile = path.join(dataDir, 'sync-activity.json')
const updateCacheFile = path.join(dataDir, 'update-check.json')
const connectFile = path.join(dataDir, 'connect-process.json')
const accountFile = path.join(dataDir, 'drive-account.json')
const storageFile = path.join(dataDir, 'drive-storage.json')
const driveCacheFile = path.join(dataDir, 'drive-listings.json')
const retentionMs = 30 * 24 * 60 * 60 * 1000

let APP_VERSION = '0.2.0'
try {
  const pkg = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf8'))
  if (pkg.version) APP_VERSION = pkg.version
} catch {}

app.use(express.json({ limit: '1mb' }))
app.use(express.static('dist'))
app.use('/src', express.static('src'))
const visibleDriveFiles = files => files.filter(entry => !['.nuvem-linux-trash', '.nuvem-linux-backups'].includes(entry.name))

async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')) } catch { return fallback }
}
async function writeJson(file, value) {
  await mkdir(dataDir, { recursive: true, mode: 0o700 })
  const temp = `${file}.${process.pid}.tmp`
  await writeFile(temp, JSON.stringify(value, null, 2), { mode: 0o600 })
  await chmod(temp, 0o600)
  await rename(temp, file)
  await chmod(file, 0o600)
}
function sanitizeFolder(folder) {
  const { baseline, ...visible } = folder
  return visible
}
async function readFolders() {
  const rows = await readJson(dataFile, [])
  return rows.map(folder => ({
    paused: false,
    initialized: false,
    preview: null,
    baseline: null,
    status: { state: 'waiting', message: 'Aguardando primeira sincronização.' },
    ...folder,
    preview: folder.preview && typeof folder.preview === 'object' ? folder.preview : null,
    status: folder.status && typeof folder.status === 'object' ? folder.status : { state: 'waiting', message: 'Aguardando primeira sincronização.' },
  }))
}
async function readActivity() {
  return readJson(activityFile, [])
}
async function recordActivity(entry) {
  try {
    const list = await readActivity()
    const item = {
      id: randomUUID(),
      timestamp: Date.now(),
      ...entry,
    }
    list.unshift(item)
    if (list.length > 80) list.length = 80
    await writeJson(activityFile, list)
    return item
  } catch (err) {
    console.warn('Erro ao registrar atividade:', err.message)
    return null
  }
}

const watchers = new Map()
const debounceTimers = new Map()

function getFolderIgnorePatterns(folder) {
  const defaultIgnored = [
    '**/.nuvem-linux-trash/**',
    '**/.nuvem-linux-backups/**',
    '**/.~lock.*#',
    '**/~$*',
    '**/*.tmp',
    '**/.git/**',
    '**/node_modules/**',
  ]
  const ignoreFile = path.join(folder.localPath, '.nuvemignore')
  if (existsSync(ignoreFile)) {
    try {
      const content = readFileSync(ignoreFile, 'utf8')
      const custom = parseIgnorePatterns(content).map(p => {
        return p.endsWith('/') ? `**/${p}**` : `**/${p}`
      })
      return [...defaultIgnored, ...custom]
    } catch {}
  }
  return defaultIgnored
}

function stopFolderWatcher(folderId) {
  if (debounceTimers.has(folderId)) {
    clearTimeout(debounceTimers.get(folderId))
    debounceTimers.delete(folderId)
  }
  const watcher = watchers.get(folderId)
  if (watcher) {
    watcher.close().catch(() => {})
    watchers.delete(folderId)
  }
}

function startFolderWatcher(folder) {
  stopFolderWatcher(folder.id)
  if (!folder.initialized || folder.paused || !existsSync(folder.localPath)) return

  try {
    const ignored = getFolderIgnorePatterns(folder)
    const watcher = chokidar.watch(folder.localPath, {
      ignored,
      persistent: true,
      ignoreInitial: true,
      ignorePermissionErrors: true,
      awaitWriteFinish: {
        stabilityThreshold: 1500,
        pollInterval: 250,
      },
    })

    const onFileEvent = (event, filePath) => {
      if (filePath.includes('.nuvem-linux-trash') || filePath.includes('.nuvem-linux-backups')) return

      if (debounceTimers.has(folder.id)) {
        clearTimeout(debounceTimers.get(folder.id))
      }
      const timer = setTimeout(() => {
        debounceTimers.delete(folder.id)
        if (!activeSync.has(folder.id) && !folder.paused) {
          console.log(`[Watch] Alteração em "${path.basename(filePath)}" (${event}) -> disparando sincronização de "${path.basename(folder.localPath)}"`)
          runFolderSync(folder.id).catch(err => {
            console.error(`[Watch] Erro ao sincronizar ${folder.localPath}:`, err.message)
          })
        }
      }, 2500)
      timer.unref()
      debounceTimers.set(folder.id, timer)
    }

    watcher.on('add', p => onFileEvent('add', p))
    watcher.on('change', p => onFileEvent('change', p))
    watcher.on('unlink', p => onFileEvent('unlink', p))
    watcher.on('error', err => console.warn(`[Watch] Erro no observador de ${folder.localPath}:`, err.message))

    watchers.set(folder.id, watcher)
  } catch (err) {
    console.warn(`[Watch] Falha ao iniciar observador para ${folder.localPath}:`, err.message)
  }
}

function updateFolderWatchers(folders) {
  const activeIds = new Set()
  for (const folder of folders) {
    if (!folder.initialized || folder.paused || !existsSync(folder.localPath)) {
      stopFolderWatcher(folder.id)
      continue
    }
    activeIds.add(folder.id)
    if (!watchers.has(folder.id)) {
      startFolderWatcher(folder)
    }
  }
  for (const id of Array.from(watchers.keys())) {
    if (!activeIds.has(id)) {
      stopFolderWatcher(id)
    }
  }
}

function stopAllFolderWatchers() {
  for (const id of Array.from(watchers.keys())) {
    stopFolderWatcher(id)
  }
}

const syncProgress = {
  active: false,
  folderId: null,
  folderName: null,
  speed: 0,
  bytes: 0,
  totalBytes: 0,
  percentage: 0,
  transfers: 0,
  totalTransfers: 0,
  transferring: [],
  recentTransfers: [],
  startedAt: 0,
  lastUpdated: 0,
}

let rcloneLogBuffer = ''
function processRcloneChunk(chunk, folder) {
  rcloneLogBuffer += chunk
  const lines = rcloneLogBuffer.split('\n')
  rcloneLogBuffer = lines.pop() || ''
  for (const line of lines) {
    if (!line.trim()) continue
    try {
      const data = JSON.parse(line.trim())
      if (data.stats) {
        const s = data.stats
        syncProgress.active = true
        syncProgress.folderId = folder.id
        syncProgress.folderName = path.basename(folder.localPath)
        syncProgress.speed = s.speed || 0
        syncProgress.bytes = s.bytes || 0
        syncProgress.totalBytes = s.totalBytes || 0
        syncProgress.percentage = s.totalBytes > 0 ? Math.min(100, Math.round((s.bytes / s.totalBytes) * 100)) : 0
        syncProgress.transfers = s.transfers || 0
        syncProgress.totalTransfers = s.totalTransfers || 0
        if (Array.isArray(s.transferring)) {
          syncProgress.transferring = s.transferring.map(t => ({
            name: t.name,
            percentage: t.percentage || 0,
            size: t.size || 0,
            bytes: t.bytes || 0,
            speed: t.speed || 0,
            eta: t.eta,
          }))
        }
        syncProgress.lastUpdated = Date.now()
      }
      if (data.object && (data.msg?.includes('Copied') || data.msg?.includes('Deleted') || data.msg?.includes('Moved'))) {
        syncProgress.recentTransfers.unshift({
          name: data.object,
          size: data.size || 0,
          action: data.msg.includes('Copied') ? 'upload_download' : data.msg.includes('Deleted') ? 'delete' : 'move',
          msg: data.msg,
          time: Date.now(),
        })
        if (syncProgress.recentTransfers.length > 30) syncProgress.recentTransfers.length = 30
      }
    } catch {}
  }
}

async function findFolderConflicts(folder) {
  const conflicts = []
  if (!folder.localPath || !existsSync(folder.localPath)) return conflicts

  async function scan(dir, relPrefix = '') {
    try {
      const entries = await readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        const relPath = relPrefix ? `${relPrefix}/${entry.name}` : entry.name

        if (entry.isDirectory()) {
          if (!['.nuvem-linux-trash', '.nuvem-linux-backups', 'node_modules', '.git'].includes(entry.name)) {
            await scan(fullPath, relPath)
          }
        } else if (entry.isFile()) {
          const originalName = parseConflictName(entry.name)
          if (originalName) {
            const originalFullPath = path.join(dir, originalName)
            const conflictStat = await stat(fullPath).catch(() => null)
            const originalStat = await stat(originalFullPath).catch(() => null)
            conflicts.push({
              id: Buffer.from(relPath).toString('base64url'),
              folderId: folder.id,
              folderName: path.basename(folder.localPath),
              conflictFile: entry.name,
              originalFile: originalName,
              relativeConflictPath: relPath,
              relativeOriginalPath: relPrefix ? `${relPrefix}/${originalName}` : originalName,
              conflictPath: fullPath,
              originalPath: originalFullPath,
              conflictSize: conflictStat?.size || 0,
              originalSize: originalStat?.size || 0,
              conflictMtime: conflictStat?.mtimeMs || 0,
              originalMtime: originalStat?.mtimeMs || 0,
              hasOriginal: !!originalStat,
            })
          }
        }
      }
    } catch {}
  }

  await scan(folder.localPath)
  return conflicts
}

async function listAllConflicts() {
  const folders = await readFolders()
  const all = []
  for (const folder of folders) {
    if (folder.localPath && existsSync(folder.localPath)) {
      const found = await findFolderConflicts(folder)
      all.push(...found)
    }
  }
  return all
}


async function saveFolders(rows) {
  await writeJson(dataFile, rows)
  updateFolderWatchers(rows)
}
async function changeFolder(id, updater) {
  const rows = await readFolders()
  const index = rows.findIndex(item => item.id === id)
  if (index < 0) return null
  rows[index] = await updater(rows[index]) || rows[index]
  await saveFolders(rows)
  return rows[index]
}
async function readTrash() { return readJson(trashFile, []) }
async function saveTrash(rows) { await writeJson(trashFile, rows) }
const activeSync = new Set()
let syncCycle = false
let connectJob = { state: 'idle', message: 'Conecte sua conta Google para começar.' }
let connectProcess = null
let accountCache = { checkedAt: 0, accounts: [] }
let accountRequest = null
const refreshingStorage = new Set()
const lastNotifiedErrors = new Map()

function driveRemotes(config) {
  return Object.entries(config).filter(([, value]) => value.type === 'drive').map(([name]) => name)
}
function parseStoredToken(config, remote) {
  let token = config[remote]?.token
  try { if (typeof token === 'string') token = JSON.parse(token) } catch { return null }
  return token && typeof token === 'object' ? token : null
}
async function rcloneConfig() {
  const { stdout } = await runRclone(['config', 'dump'], { timeoutMs: 15_000 })
  return JSON.parse(stdout)
}
async function getDriveAccounts(remotes) {
  if (!remotes.length) return []
  if (Date.now() - accountCache.checkedAt < 300_000) return accountCache.accounts
  if (accountRequest) return accountRequest
  accountRequest = queryDriveAccounts(remotes).finally(() => { accountRequest = null })
  return accountRequest
}
async function queryDriveAccounts(remotes) {
  const saved = await readJson(accountFile, {})
  const savedStorage = await readJson(storageFile, {})
  const config = await rcloneConfig().catch(() => ({}))
  const accounts = []
  for (const remote of remotes) {
    const token = parseStoredToken(config, remote)
    if (!token?.access_token) continue
    let email = saved[remote] || null
    let storage = savedStorage[remote]?.storage || null
    if (storage) {
      accounts.push({ remote, email, storage })
      if (Date.now() - Number(savedStorage[remote]?.checkedAt || 0) > 300_000 && !refreshingStorage.has(remote)) {
        refreshingStorage.add(remote)
        refreshDriveStorage(remote, token).catch(() => {}).finally(() => refreshingStorage.delete(remote))
      }
      continue
    }
    try {
      const response = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress),storageQuota(limit,usage,usageInDrive,usageInDriveTrash)', {
        headers: { Authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(8000),
      })
      if (response.ok) {
        const about = await response.json()
        email = about.user?.emailAddress || null
        const quota = about.storageQuota
        if (quota && Number(quota.limit) > 0) storage = quota
      }
    } catch {}
    if (!storage) {
      try {
        const { stdout } = await runRclone(['about', `${remote}:`, '--json'], { timeoutMs: 15_000 })
        const about = JSON.parse(stdout)
        if (Number.isFinite(Number(about.total))) storage = {
          limit: String(about.total),
          usage: String(Number(about.used || 0) + Number(about.other || 0)),
          usageInDrive: String(about.used || 0),
          usageInDriveTrash: String(about.trashed || 0),
        }
      } catch (error) { console.warn(`Não foi possível consultar a cota com rclone para ${remote}: ${error.message}`) }
    }
    storage ||= savedStorage[remote]?.storage || null
    if (storage) savedStorage[remote] = { storage, checkedAt: Date.now() }
    email ||= saved[remote] || null
    if (email && email !== saved[remote]) {
      saved[remote] = email
      await writeJson(accountFile, saved)
    }
    accounts.push({ remote, email, storage })
  }
  if (Object.keys(savedStorage).length) await writeJson(storageFile, savedStorage)
  accountCache = { checkedAt: Date.now(), accounts }
  return accounts
}
async function refreshDriveStorage(remote, token) {
  let storage = null
  let email = null
  try {
    const response = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress),storageQuota(limit,usage,usageInDrive,usageInDriveTrash)', {
      headers: { Authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(8000),
    })
    if (response.ok) {
      const about = await response.json()
      email = about.user?.emailAddress || null
      if (about.storageQuota && Number(about.storageQuota.limit) > 0) storage = about.storageQuota
    }
  } catch {}
  if (!storage) {
    try {
      const { stdout } = await runRclone(['about', `${remote}:`, '--json'], { timeoutMs: 15_000 })
      const about = JSON.parse(stdout)
      if (Number.isFinite(Number(about.total))) storage = {
        limit: String(about.total), usage: String(Number(about.used || 0) + Number(about.other || 0)),
        usageInDrive: String(about.used || 0), usageInDriveTrash: String(about.trashed || 0),
      }
    } catch (error) { console.warn(`Não foi possível atualizar a cota do Google Drive para ${remote}: ${error.message}`) }
  }
  if (!storage) return
  const cache = await readJson(storageFile, {})
  cache[remote] = { storage, checkedAt: Date.now() }
  await writeJson(storageFile, cache)
  if (email) {
    const saved = await readJson(accountFile, {})
    if (saved[remote] !== email) { saved[remote] = email; await writeJson(accountFile, saved) }
  }
  accountCache.accounts = accountCache.accounts.map(account => account.remote === remote ? { ...account, email: email || account.email, storage } : account)
}
async function readActiveConnect() {
  try {
    const lock = await readJson(connectFile, null)
    const cmd = await readFile(`/proc/${lock.pid}/cmdline`, 'utf8')
    if (cmd.includes('rclone') && cmd.includes('config') && (cmd.includes('create') || cmd.includes('reconnect'))) return lock
  } catch {}
  try { await access(connectFile); await rename(connectFile, `${connectFile}.stale-${Date.now()}`) } catch {}
  return null
}

async function jsonEntries(args, options = {}) {
  const { stdout } = await runRclone(args, { timeoutMs: options.timeoutMs || 180_000, maxOutput: 128 * 1024 * 1024 })
  const values = JSON.parse(stdout || '[]')
  return values.filter(entry => !entry.IsDir && typeof entry.Path === 'string').map(entry => {
    const relative = entry.Path.replace(/^\/+/, '')
    if (!relative || relative.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('O rclone retornou um caminho relativo inseguro; operação interrompida.')
    return { Path: relative, Size: Number(entry.Size || 0), ModTime: entry.ModTime || '', Hashes: entry.Hashes || {}, ID: entry.ID || null }
  }).sort((a, b) => a.Path.localeCompare(b.Path))
}
async function computeFileMd5(filePath) {
  try {
    const { createHash } = await import('node:crypto')
    const { createReadStream } = await import('node:fs')
    return await new Promise((resolve) => {
      const hash = createHash('md5')
      const stream = createReadStream(filePath)
      stream.on('data', chunk => hash.update(chunk))
      stream.on('end', () => resolve(hash.digest('hex')))
      stream.on('error', () => resolve(null))
    })
  } catch {
    return null
  }
}

async function listLocalFiles(localPath) {
  const args = ['lsjson', '--recursive', '--files-only', '--skip-links']
  const ignoreFile = path.join(localPath, '.nuvemignore')
  if (existsSync(ignoreFile)) {
    args.push('--exclude-from', ignoreFile)
  }
  args.push(localPath)
  return jsonEntries(args)
}
async function listRemoteFiles(remote, remotePath, localPath = null) {
  try {
    const args = ['lsjson', '--recursive', '--files-only', '--hash']
    if (localPath) {
      const ignoreFile = path.join(localPath, '.nuvemignore')
      if (existsSync(ignoreFile)) {
        args.push('--exclude-from', ignoreFile)
      }
    }
    args.push(`${remote}:${remotePath}`)
    return await jsonEntries(args)
  }
  catch (error) {
    if (/directory not found|doesn.t exist|not found/i.test(error.message)) return []
    throw error
  }
}
async function listRemoteDirectoryFiles(remote, remotePath) {
  try { return await jsonEntries(['lsjson', '--files-only', '--hash', `${remote}:${remotePath}`]) }
  catch (error) {
    if (/directory not found|doesn.t exist|not found/i.test(error.message)) return []
    throw error
  }
}
async function folderSnapshot(folder) {
  await requireSupportedRclone()
  const [local, remote] = await Promise.all([
    listLocalFiles(folder.localPath),
    listRemoteFiles(folder.remote, folder.remotePath, folder.localPath),
  ])
  if (remote.length > 0 && local.length > 0) {
    const remotePaths = new Set(remote.map(r => r.Path))
    const commonLocal = local.filter(l => remotePaths.has(l.Path))
    if (commonLocal.length > 0 && commonLocal.length <= 1000) {
      await Promise.all(commonLocal.map(async entry => {
        const fullPath = path.join(folder.localPath, entry.Path)
        const md5 = await computeFileMd5(fullPath)
        if (md5) entry.Hashes = { md5 }
      }))
    }
  }
  return { local, remote }
}
function createPreview(snapshot) {
  return buildInitialPlan(snapshot.local, snapshot.remote, randomUUID())
}
function makeRcloneSyncArgs(folder, initial = false) {
  const args = ['bisync', folder.localPath, `${folder.remote}:${folder.remotePath}`,
    '--log-level', 'INFO', '--retries', '3', '--retries-sleep', '10s',
    '--skip-links',
    '--use-json-log',
    '--stats', '1s',
    '--exclude', '/.nuvem-linux-trash/**',
    '--exclude', '.nuvem-linux-backups/**',
    '--exclude', '.~lock.*#',
    '--exclude', '~$*',
    '--exclude', '*.tmp']

  const ignoreFile = path.join(folder.localPath, '.nuvemignore')
  if (existsSync(ignoreFile)) {
    args.push('--exclude-from', ignoreFile)
  }

  const localBackup = path.join(dataDir, 'bisync-backups', folder.id)
  const remoteBackup = `${folder.remote}:.nuvem-linux-backups/${folder.id}`
  args.push('--backup-dir1', localBackup, '--backup-dir2', remoteBackup)
  if (initial) args.push('--resync', '--resync-mode', 'path1')
  else args.push('--resilient', '--recover', '--conflict-resolve', 'none', '--conflict-loser', 'num', '--conflict-suffix', 'conflito')
  return args
}
function trashPathFor(folder, relativePath = '') { return path.posix.join(folder.remotePath, '.nuvem-linux-trash', relativePath) }
function remotePathFor(folder, relativePath) {
  return path.posix.join(folder.remotePath, relativePath)
}
function localPathFor(folder, relativePath) {
  const target = path.resolve(folder.localPath, ...relativePath.split('/'))
  if (!isWithinFolder(folder.localPath, target) || target === folder.localPath) throw new Error('Caminho fora da pasta sincronizada; operação interrompida.')
  return target
}
function baselineEntries(folder) { return Array.isArray(folder.baseline) ? folder.baseline : [] }
function entryMap(entries) { return new Map(entries.map(entry => [entry.Path, entry])) }
function mergeBaseline(localEntries, remoteEntries) {
  const local = entryMap(localEntries), remote = entryMap(remoteEntries)
  return [...new Set([...local.keys(), ...remote.keys()])].sort().map(relativePath => {
    const left = local.get(relativePath) || {}
    const right = remote.get(relativePath) || {}
    return { Path: relativePath, Size: left.Size ?? right.Size ?? 0, ModTime: left.ModTime || right.ModTime || '', Hashes: left.Hashes || right.Hashes || {}, ID: right.ID || null }
  })
}
async function recordTrashItem(item) {
  const rows = await readTrash()
  if (!rows.some(row => row.side === item.side && (row.side === 'linux' ? row.infoPath === item.infoPath : row.driveFileId === item.driveFileId))) {
    rows.push(item)
    await saveTrash(rows)
  }
}
async function notify(title, message) {
  try { await runCommand('notify-send', ['--app-name=Nuvem Linux', title, String(message).slice(0, 300)], { timeoutMs: 5000 }) } catch {}
}

let cachedUpdateInfo = null

async function getUpdateStatus(force = false) {
  try {
    if (!cachedUpdateInfo) {
      cachedUpdateInfo = await readJson(updateCacheFile, null)
    }

    const now = Date.now()
    const fourHours = 4 * 60 * 60 * 1000
    if (!force && cachedUpdateInfo && (now - (cachedUpdateInfo.lastChecked || 0) < fourHours)) {
      return { ...cachedUpdateInfo, currentVersion: APP_VERSION }
    }

    const res = await fetch('https://api.github.com/repos/fabianocarcosta/nuvem-linux/releases/latest', {
      headers: {
        'User-Agent': `nuvem-linux/${APP_VERSION}`,
        'Accept': 'application/vnd.github.v3+json',
      },
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      if (cachedUpdateInfo) return { ...cachedUpdateInfo, currentVersion: APP_VERSION }
      return {
        currentVersion: APP_VERSION,
        latestVersion: APP_VERSION,
        latestTag: `v${APP_VERSION}`,
        hasUpdate: false,
        error: `GitHub API HTTP ${res.status}`,
        lastChecked: now,
      }
    }

    const data = await res.json()
    const latestTag = data.tag_name || ''
    const cleanTag = latestTag.replace(/^v/i, '')
    const hasUpdate = compareSemver(cleanTag, APP_VERSION) > 0

    let debUrl = null
    let appImageUrl = null
    if (Array.isArray(data.assets)) {
      for (const asset of data.assets) {
        if (asset.name.endsWith('.deb')) debUrl = asset.browser_download_url
        if (asset.name.endsWith('.AppImage')) appImageUrl = asset.browser_download_url
      }
    }

    const lastNotified = cachedUpdateInfo?.lastNotifiedVersion || null

    cachedUpdateInfo = {
      currentVersion: APP_VERSION,
      latestVersion: cleanTag,
      latestTag,
      hasUpdate,
      releaseName: data.name || latestTag,
      releaseUrl: data.html_url || 'https://github.com/fabianocarcosta/nuvem-linux/releases',
      releaseNotes: data.body || '',
      publishedAt: data.published_at || null,
      debUrl,
      appImageUrl,
      lastChecked: now,
      lastNotifiedVersion: lastNotified,
    }

    if (hasUpdate && lastNotified !== latestTag) {
      cachedUpdateInfo.lastNotifiedVersion = latestTag
      await notify(
        'Atualização do Nuvem Linux!',
        `Uma nova versão (${latestTag}) está disponível com novidades. Abra o aplicativo para atualizar.`
      )
      await recordActivity({
        type: 'update_available',
        folderName: 'Nuvem Linux',
        message: `Nova versão ${latestTag} disponível no GitHub para atualização.`,
      })
    }

    await writeJson(updateCacheFile, cachedUpdateInfo)
    return { ...cachedUpdateInfo, currentVersion: APP_VERSION }
  } catch (err) {
    if (cachedUpdateInfo) return { ...cachedUpdateInfo, currentVersion: APP_VERSION }
    return {
      currentVersion: APP_VERSION,
      latestVersion: APP_VERSION,
      latestTag: `v${APP_VERSION}`,
      hasUpdate: false,
      error: err.message,
      lastChecked: Date.now(),
    }
  }
}
async function recordRemoteDeletion(folder, entry) {
  if (!entry?.ID) return
  const deletedAt = Date.now()
  await recordTrashItem({
    id: randomUUID(), folderId: folder.id, side: 'drive', name: path.posix.basename(entry.Path),
    driveFileId: entry.ID, remote: folder.remote, remotePath: remotePathFor(folder, entry.Path),
    deletedAt, expiresAt: deletedAt + retentionMs,
  })
}
async function countDriveDeletions(folder, snapshot) {
  if (!folder.initialized || !baselineEntries(folder).length) return 0
  const baseline = entryMap(baselineEntries(folder))
  const local = entryMap(snapshot.local), remote = entryMap(snapshot.remote)
  let deleted = 0
  for (const [relativePath] of baseline) {
    if (local.has(relativePath) && !remote.has(relativePath)) deleted++
  }
  return deleted
}
async function preserveLocalDeletions(folder, previousBaseline, afterSync) {
  const previous = entryMap(previousBaseline)
  const local = entryMap(afterSync.local), remote = entryMap(afterSync.remote)
  let moved = 0
  for (const [relativePath, oldEntry] of previous) {
    if (!local.has(relativePath) && !remote.has(relativePath)) {
      const originalPath = localPathFor(folder, relativePath)
      const trashItem = await findLinuxTrashItem(originalPath, { id: randomUUID(), folderId: folder.id, driveFileId: oldEntry.ID, remote: folder.remote, remotePath: remotePathFor(folder, relativePath) })
      if (trashItem) { await recordTrashItem(trashItem); moved++ }
    }
  }
  return moved
}
async function moveDriveItemToTrash(folder, entry) {
  const target = `${folder.remote}:${trashPathFor(folder, entry.Path)}`
  await runRclone(['mkdir', `${folder.remote}:${trashPathFor(folder, path.posix.dirname(entry.Path))}`], { timeoutMs: 60_000 })
  await runRclone(['moveto', `${folder.remote}:${remotePathFor(folder, entry.Path)}`, target], { timeoutMs: 180_000 })
  const deletedAt = Date.now()
  await recordTrashItem({ id: randomUUID(), folderId: folder.id, side: 'drive', name: path.posix.basename(entry.Path), driveFileId: entry.ID, remote: folder.remote, remotePath: target, folderRemotePath: folder.remotePath, deletedAt, expiresAt: deletedAt + retentionMs })
}
async function applyInitialSync(folder, freshSnapshot) {
  await runRclone(['mkdir', `${folder.remote}:${folder.remotePath}`], { timeoutMs: 60_000 })
  const existingPaths = new Set([...freshSnapshot.local, ...freshSnapshot.remote].map(entry => entry.Path))
  const conflicts = folder.preview.rows.filter(row => row.action === 'conflict')
  for (const conflict of conflicts) {
    const copyPath = conflict.preserveAs || conflictCopyPath(conflict.path, existingPaths)
    const localCopy = localPathFor(folder, copyPath)
    await runRclone(['copyto', `${folder.remote}:${remotePathFor(folder, conflict.path)}`, localCopy], { timeoutMs: 180_000 })
    await runRclone(['copyto', localCopy, `${folder.remote}:${remotePathFor(folder, copyPath)}`], { timeoutMs: 180_000 })
  }
  return runRclone(makeRcloneSyncArgs(folder, true), {
    timeoutMs: 60 * 60_000,
    maxOutput: 32 * 1024 * 1024,
    onLogChunk: chunk => processRcloneChunk(chunk, folder),
  })
}
function detectConflictNames(output) {
  const names = new Set()
  for (const match of String(output).matchAll(/([^\s"']+\.conflito\d+(?:\.[^"'\s]+)?)/gi)) names.add(match[1])
  for (const match of String(output).matchAll(/([^\s"']+\s*\(conflito[^\)]*\)[^"'\s]*)/gi)) names.add(match[1])
  return [...names]
}
async function runFolderSync(folderId, options = {}) {
  if (activeSync.has(folderId)) return { state: 'busy', message: 'A sincronização desta pasta já está em andamento.' }
  activeSync.add(folderId)
  let folder = (await readFolders()).find(item => item.id === folderId)
  if (!folder) { activeSync.delete(folderId); return { state: 'error', message: 'Pasta não encontrada.' } }
  if (folder.paused) { activeSync.delete(folderId); return { state: 'paused', message: 'Sincronização pausada.' } }
  try {
    syncProgress.active = true
    syncProgress.folderId = folderId
    syncProgress.folderName = path.basename(folder.localPath)
    syncProgress.startedAt = Date.now()
    syncProgress.transferring = []
    syncProgress.percentage = 0

    folder.status = { ...folder.status, state: 'syncing', message: folder.initialized ? 'Sincronizando PC e Google Drive…' : 'Preparando a primeira sincronização…', startedAt: Date.now() }
    await changeFolder(folderId, current => ({ ...current, status: folder.status }))

    if (!folder.initialized) {
      const snapshot = await folderSnapshot(folder)
      const currentPreview = createPreview(snapshot)
      if (!folder.preview || !options.previewId || options.previewId !== folder.preview.id || currentPreview.fingerprint !== folder.preview.fingerprint) {
        folder = await changeFolder(folderId, current => ({ ...current, preview: currentPreview, status: { state: 'preview', message: 'A prévia foi atualizada. Revise e aplique novamente.' } }))
        return { state: 'preview-changed', message: 'Os arquivos mudaram desde a prévia. Confira o plano atualizado antes de aplicar.', preview: folder.preview }
      }
      folder.preview = currentPreview
      await applyInitialSync({ ...folder, preview: currentPreview }, snapshot)
    } else {
      const before = await folderSnapshot(folder)
      const oldBaseline = baselineEntries(folder)
      const remoteDeleted = await countDriveDeletions(folder, before)
      await mkdir(path.join(dataDir, 'bisync-backups', folder.id), { recursive: true, mode: 0o700 })
      await runRclone(['mkdir', `${folder.remote}:${trashPathFor(folder)}`], { timeoutMs: 60_000 })
      let result
      const needsResync = oldBaseline.length === 0
      try {
        result = await runRclone(makeRcloneSyncArgs(folder, needsResync), {
          timeoutMs: 60 * 60_000,
          maxOutput: 32 * 1024 * 1024,
          onLogChunk: chunk => processRcloneChunk(chunk, folder),
        })
      } catch (err) {
        const errText = `${err?.message || ''} ${err?.stderr || ''} ${err?.stdout || ''}`
        if (
          !needsResync &&
          (errText.includes('empty prior') ||
           errText.includes('Must run --resync to recover') ||
           errText.includes('bisync aborted') ||
           errText.includes('cannot find prior'))
        ) {
          result = await runRclone(makeRcloneSyncArgs(folder, true), {
            timeoutMs: 60 * 60_000,
            maxOutput: 32 * 1024 * 1024,
            onLogChunk: chunk => processRcloneChunk(chunk, folder),
          })
        } else {
          throw err
        }
      }
      const afterFirstSync = await folderSnapshot(folder)
      const localEntries = entryMap(afterFirstSync.local)
      const remoteEntries = entryMap(afterFirstSync.remote)
      const localDeleted = oldBaseline.filter(entry => !localEntries.has(entry.Path) && remoteEntries.has(entry.Path))
      for (const entry of localDeleted) await moveDriveItemToTrash(folder, remoteEntries.get(entry.Path))
      const after = localDeleted.length ? await folderSnapshot(folder) : afterFirstSync
      const movedToLinuxTrash = await preserveLocalDeletions(folder, oldBaseline, after)
      const baseline = mergeBaseline(after.local, after.remote)
      const conflictNames = detectConflictNames(result.stdout + '\n' + result.stderr)
      const updated = await changeFolder(folderId, current => ({
        ...current,
        baseline,
        status: {
          state: conflictNames.length ? 'conflict' : 'ok',
          message: conflictNames.length ? `${conflictNames.length} versão(ões) conflitante(s) preservada(s).` : 'Sincronizado',
          lastSuccess: Date.now(), lastError: null, conflicts: conflictNames,
        },
      }))
      await recordActivity({
        type: conflictNames.length ? 'conflict' : 'sync_ok',
        folderId,
        folderName: path.basename(folder.localPath),
        localPath: folder.localPath,
        conflicts: conflictNames,
        message: conflictNames.length
          ? `${conflictNames.length} versão(ões) conflitante(s) preservada(s) em ${path.basename(folder.localPath)}.`
          : `Sincronização de "${path.basename(folder.localPath)}" concluída com sucesso.`,
      })
      if (conflictNames.length) await notify('Conflito preservado', `${conflictNames.length} cópia(s) conflitante(s) foram mantidas em ${path.basename(folder.localPath)}.`)
      if (movedToLinuxTrash) {
        await recordActivity({
          type: 'trash_linux',
          folderId,
          folderName: path.basename(folder.localPath),
          count: movedToLinuxTrash,
          message: `${movedToLinuxTrash} item(ns) movidos para a lixeira do Linux.`,
        })
        await notify('Exclusão do Drive sincronizada', `${movedToLinuxTrash} item(ns) foram movidos para a lixeira do Linux.`)
      }
      if (localDeleted.length) {
        await recordActivity({
          type: 'trash_drive',
          folderId,
          folderName: path.basename(folder.localPath),
          count: localDeleted.length,
          message: `${localDeleted.length} item(ns) movidos para a lixeira do Google Drive.`,
        })
        await notify('Exclusão local sincronizada', `${localDeleted.length} item(ns) foram movidos para a lixeira do Google Drive.`)
      }
      if (remoteDeleted) await notify('Exclusão do Drive sincronizada', `${remoteDeleted} item(ns) foram removidos do Linux; o Google Drive mantém os itens na lixeira.`)
      return updated.status
    }

    const after = await folderSnapshot(folder)
    const updated = await changeFolder(folderId, current => ({
      ...current,
      initialized: true,
      preview: null,
      baseline: mergeBaseline(after.local, after.remote),
      status: { state: 'ok', message: 'Primeira sincronização concluída.', lastSuccess: Date.now(), lastError: null, conflicts: [] },
    }))
    await recordActivity({
      type: 'first_sync_ok',
      folderId,
      folderName: path.basename(folder.localPath),
      localPath: folder.localPath,
      message: `Primeira sincronização de "${path.basename(folder.localPath)}" concluída.`,
    })
    return updated.status
  } catch (error) {
    const message = error.message || 'Falha durante a sincronização.'
    await recordActivity({
      type: 'error',
      folderId,
      folderName: folder ? path.basename(folder.localPath) : folderId,
      message: `Erro na sincronização: ${message}`,
    })
    const updated = await changeFolder(folderId, current => ({
      ...current,
      status: { ...current.status, state: 'error', message, lastError: message, failedAt: Date.now() },
    })).catch(() => null)
    if (updated && lastNotifiedErrors.get(folderId) !== message) {
      lastNotifiedErrors.set(folderId, message)
      await notify('Falha na sincronização', `${path.basename(updated.localPath)}: ${message}`)
    }
    return { state: 'error', message }
  } finally {
    activeSync.delete(folderId)
    if (activeSync.size === 0) {
      syncProgress.active = false
      syncProgress.transferring = []
      syncProgress.speed = 0
    }
  }
}

async function refreshPreview(folderId) {
  const folder = (await readFolders()).find(item => item.id === folderId)
  if (!folder) return null
  if (folder.initialized) throw new Error('Esta sincronização já foi iniciada; use Sincronizar agora.')
  const snapshot = await folderSnapshot(folder)
  const preview = createPreview(snapshot)
  return changeFolder(folderId, current => ({ ...current, preview, status: { state: 'preview', message: 'Prévia pronta. Confira as ações antes de aplicar.' } }))
}
function isWithinFolder(parent, child) {
  const rel = path.relative(parent, child)
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel))
}
async function validateLocalFolder(input) {
  if (typeof input !== 'string' || !input.trim()) throw new Error('Informe um caminho para uma pasta local.')
  const trimmed = input.trim()
  const resolved = trimmed.startsWith('~/') ? path.join(homedir(), trimmed.slice(2)) : trimmed
  if (!path.isAbsolute(resolved)) throw new Error('Informe um caminho absoluto para uma pasta local.')
  await mkdir(resolved, { recursive: true })
  const absolute = await realpath(resolved)
  if (!(await stat(absolute)).isDirectory()) throw new Error('O caminho local precisa ser uma pasta.')
  if (absolute === path.parse(absolute).root || absolute === homedir()) throw new Error('Escolha uma subpasta específica, não a raiz nem a pasta pessoal inteira.')
  return absolute
}

async function getConfigAccessToken(remote, refresh = true) {
  let config = await rcloneConfig()
  let token = parseStoredToken(config, remote)
  if (!token?.access_token) throw new Error('A conta do Google Drive precisa ser reconectada.')
  if (refresh && token.expiry && Date.parse(token.expiry) < Date.now() + 60_000) {
    await runRclone(['lsd', `${remote}:`], { timeoutMs: 30_000 })
    config = await rcloneConfig()
    token = parseStoredToken(config, remote)
  }
  if (token?.access_token) return token.access_token
  throw new Error('A conta do Google Drive precisa ser reconectada.')
}
async function restoreGoogleDriveItem(item) {
  let token = await getConfigAccessToken(item.remote)
  let response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(item.driveFileId)}?fields=id,trashed`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: false }), signal: AbortSignal.timeout(15_000),
  })
  if (response.status === 401) {
    await runRclone(['lsd', `${item.remote}:`], { timeoutMs: 30_000 })
    token = await getConfigAccessToken(item.remote, false)
    response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(item.driveFileId)}?fields=id,trashed`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashed: false }), signal: AbortSignal.timeout(15_000),
    })
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error?.message || `O Google Drive recusou a restauração (HTTP ${response.status}).`)
  }
}

app.get('/api/status', async (_req, res) => {
  const [health, active, updateInfo] = await Promise.all([rcloneHealth(), readActiveConnect(), getUpdateStatus(false)])
  if (active) connectJob = { state: 'authorizing', remote: active.remote, message: 'Aguardando autorização do Google…', url: null }
  let remotes = []
  try { remotes = driveRemotes(await rcloneConfig()) } catch {}
  const accounts = await getDriveAccounts(remotes)
  if (accounts.length && connectJob.state !== 'authorizing') {
    connectJob = { state: 'connected', remote: accounts[0].remote, message: `Google Drive conectado${accounts[0].email ? ` · ${accounts[0].email}` : ''}.` }
  } else if (!accounts.length && connectJob.state !== 'authorizing') {
    connectJob = { state: 'idle', message: 'Conecte sua conta Google para começar.' }
  }
  if (!active && connectJob.state === 'authorizing') connectJob = accounts.length
    ? { state: 'connected', remote: accounts[0].remote, message: 'Google Drive conectado.' }
    : { state: 'error', message: 'A autorização não foi concluída. Tente conectar novamente.' }
  const folders = await readFolders()
  res.json({ rclone: health, connected: accounts.length > 0, remotes, accounts, connectJob, folders: folders.map(sanitizeFolder), homeDir: homedir(), updateInfo })
})

app.get('/api/updates', async (req, res) => {
  const force = req.query.check === 'true'
  const info = await getUpdateStatus(force)
  res.json(info)
})

app.post('/api/updates/check', async (_req, res) => {
  const info = await getUpdateStatus(true)
  res.json(info)
})

app.get('/api/drive/files', async (req, res) => {
  const remote = String(req.query.remote || '')
  let drivePath = ''
  let cache = {}
  try {
    await requireSupportedRclone()
    const config = await rcloneConfig()
    if (config[remote]?.type !== 'drive' || !parseStoredToken(config, remote)?.access_token) return res.status(401).json({ error: 'Conecte sua conta Google Drive.' })
    drivePath = req.query.path ? normalizeDrivePath(req.query.path) : ''
    const cacheKey = `${remote}|${drivePath}`
    cache = await readJson(driveCacheFile, {})
    const previous = cache[cacheKey]
    if (previous && Date.now() - previous.cachedAt < 20_000) return res.json({ remote, path: drivePath, files: visibleDriveFiles(previous.files), cached: true })
    const entries = await listDriveChildrenWithRclone(remote, drivePath)
    const files = entries.map(entry => ({
      id: entry.id, name: entry.name,
      path: path.posix.join(drivePath, entry.name), isDir: entry.isDir,
      size: entry.size, modTime: entry.modTime, mimeType: entry.mimeType, starred: entry.starred,
    }))
    cache[cacheKey] = { cachedAt: Date.now(), files }
    await writeJson(driveCacheFile, cache)
    res.json({ remote, path: drivePath, files: visibleDriveFiles(files) })
  } catch (error) {
    const previous = cache[`${remote}|${drivePath}`]
    if (previous && Date.now() - previous.cachedAt < 24 * 60 * 60_000) return res.json({ remote, path: drivePath, files: visibleDriveFiles(previous.files), stale: true, warning: `Exibindo a última lista salva. O Google Drive não atualizou agora: ${error.message}` })
    res.status(400).json({ error: error.message })
  }
})

app.get('/api/drive/folders', async (req, res) => {
  const remote = String(req.query.remote || '')
  let drivePath = ''
  try {
    await requireSupportedRclone()
    const config = await rcloneConfig()
    if (config[remote]?.type !== 'drive' || !parseStoredToken(config, remote)?.access_token) return res.status(401).json({ error: 'Conecte sua conta Google Drive.' })
    drivePath = req.query.path ? normalizeDrivePath(req.query.path) : ''
    const entries = await listDriveFoldersWithRclone(remote, drivePath)
    res.json({ remote, path: drivePath, folders: entries.filter(e => !['.nuvem-linux-trash', '.nuvem-linux-backups'].includes(e.name)) })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.post('/api/drive/mkdir', async (req, res) => {
  try {
    await requireSupportedRclone()
    const remote = String(req.body?.remote || '').trim()
    const rawPath = String(req.body?.path || '').trim()
    const name = String(req.body?.name || '').trim()
    if (!/^[a-zA-Z0-9_-]{2,40}$/.test(remote)) return res.status(400).json({ error: 'Escolha uma conta Google Drive conectada.' })
    if (!name || name === '.' || name === '..' || /[/\\\x00-\x1f]/.test(name)) return res.status(400).json({ error: 'Nome de pasta inválido.' })
    const parentPath = rawPath ? normalizeDrivePath(rawPath) : ''
    const fullPath = parentPath ? path.posix.join(parentPath, name) : name
    await runRclone(['mkdir', `${remote}:${fullPath}`], { timeoutMs: 60_000 })
    const cache = await readJson(driveCacheFile, {})
    delete cache[`${remote}|${parentPath}`]
    delete cache[`${remote}|${fullPath}`]
    await writeJson(driveCacheFile, cache)
    res.json({ ok: true, path: fullPath, name })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.post('/api/drive/upload', express.raw({ type: 'application/octet-stream', limit: '100mb' }), async (req, res) => {
  let uploadDir = null
  try {
    const remote = String(req.query.remote || '')
    const name = String(req.query.name || '')
    const rawDrivePath = String(req.query.path || '')
    const drivePath = rawDrivePath ? normalizeDrivePath(rawDrivePath) : ''
    if (!/^[a-zA-Z0-9_-]{2,40}$/.test(remote)) return res.status(400).json({ error: 'Escolha uma conta Google Drive conectada.' })
    if (!name || name === '.' || name === '..' || /[/\\\x00-\x1f]/.test(name)) return res.status(400).json({ error: 'Nome de arquivo inválido.' })
    if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'O arquivo está vazio.' })
    const existing = await listRemoteDirectoryFiles(remote, drivePath)
    if (existing.some(item => path.posix.basename(item.Path) === name)) return res.status(409).json({ error: `Já existe um arquivo chamado “${name}” nesta pasta. Renomeie o arquivo antes de enviar para evitar substituir a cópia existente.` })
    uploadDir = await mkdtemp(path.join(tmpdir(), 'nuvem-upload-'))
    const tempFile = path.join(uploadDir, 'upload')
    await writeFile(tempFile, req.body, { mode: 0o600 })
    await runRclone(['copyto', tempFile, `${remote}:${path.posix.join(drivePath, name)}`], { timeoutMs: 60 * 60_000 })
    res.json({ ok: true, name })
  } catch (error) { res.status(400).json({ error: error.message }) }
  finally { if (uploadDir) await rm(uploadDir, { recursive: true, force: true }).catch(() => {}) }
})

app.patch('/api/drive/files/:id', async (req, res) => {
  try {
    const remote = String(req.query.remote || '')
    if (!/^[a-zA-Z0-9_-]{2,40}$/.test(remote)) return res.status(400).json({ error: 'Escolha uma conta Google Drive conectada.' })
    const changes = {}
    if (typeof req.body?.name === 'string') {
      if (!req.body.name.trim() || /[/\\\x00-\x1f]/.test(req.body.name)) return res.status(400).json({ error: 'Nome de arquivo inválido.' })
      changes.name = req.body.name.trim()
    }
    for (const key of ['starred', 'trashed']) if (typeof req.body?.[key] === 'boolean') changes[key] = req.body[key]
    if (!Object.keys(changes).length) return res.status(400).json({ error: 'Nenhuma alteração válida foi enviada.' })
    const token = await getConfigAccessToken(remote)
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(req.params.id)}?supportsAllDrives=true&fields=id,name,mimeType,size,modifiedTime,parents,starred,trashed`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(changes), signal: AbortSignal.timeout(30_000),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) return res.status(response.status).json({ error: result.error?.message || `O Google Drive recusou a alteração (HTTP ${response.status}).` })
    res.json(result)
  } catch (error) { res.status(400).json({ error: error.message }) }
})

app.get('/api/drive/download/:id', async (req, res) => {
  try {
    const remote = String(req.query.remote || '')
    if (!/^[a-zA-Z0-9_-]{2,40}$/.test(remote)) return res.status(400).send('Conta Google Drive inválida.')
    const token = await getConfigAccessToken(remote)
    const metadataResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(req.params.id)}?supportsAllDrives=true&fields=name,mimeType`, {
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000),
    })
    const metadata = await metadataResponse.json().catch(() => ({}))
    if (!metadataResponse.ok) return res.status(metadataResponse.status).send(metadata.error?.message || 'Não foi possível localizar o arquivo.')
    const nativeGoogleFile = metadata.mimeType?.startsWith('application/vnd.google-apps.')
    const exportType = nativeGoogleFile ? 'application/pdf' : null
    const endpoint = nativeGoogleFile
      ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(req.params.id)}/export?mimeType=${encodeURIComponent(exportType)}`
      : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(req.params.id)}?alt=media&supportsAllDrives=true`
    const download = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(120_000) })
    if (!download.ok || !download.body) return res.status(download.status || 502).send('O Google Drive não conseguiu baixar esse arquivo.')
    const filename = metadata.name || 'download'
    const isInline = req.query.inline === 'true'
    let contentType = nativeGoogleFile ? exportType : download.headers.get('content-type') || 'application/octet-stream'
    if (filename.toLowerCase().endsWith('.pdf') && (contentType === 'application/octet-stream' || !contentType)) {
      contentType = 'application/pdf'
    }
    const finalFilename = filename + (nativeGoogleFile && !filename.toLowerCase().endsWith('.pdf') ? '.pdf' : '')
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `${isInline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(finalFilename)}`)
    Readable.fromWeb(download.body).pipe(res)
  } catch (error) { if (!res.headersSent) res.status(400).send(error.message); else res.destroy(error) }
})

app.post('/api/drive/open-desktop/:id', async (req, res) => {
  try {
    const remote = String(req.body?.remote || req.query.remote || '')
    if (!/^[a-zA-Z0-9_-]{2,40}$/.test(remote)) return res.status(400).json({ error: 'Conta Google Drive inválida.' })
    const filePathOnDrive = String(req.body?.path || '')

    const folders = await readFolders()
    let localPath = null

    for (const folder of folders) {
      if (folder.remote === remote && folder.initialized && !folder.paused && filePathOnDrive) {
        const rel = path.posix.relative(folder.remotePath, filePathOnDrive)
        if (rel && !rel.startsWith('..') && !path.posix.isAbsolute(rel)) {
          const candidate = path.join(folder.localPath, ...rel.split('/'))
          if (existsSync(candidate)) {
            localPath = candidate
            break
          }
        }
      }
    }

    if (!localPath) {
      const token = await getConfigAccessToken(remote)
      const metadataResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(req.params.id)}?supportsAllDrives=true&fields=name,mimeType`, {
        headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000),
      })
      const metadata = await metadataResponse.json().catch(() => ({}))
      if (!metadataResponse.ok) return res.status(metadataResponse.status).json({ error: metadata.error?.message || 'Arquivo não encontrado no Google Drive.' })

      const nativeGoogleFile = metadata.mimeType?.startsWith('application/vnd.google-apps.')
      const exportType = nativeGoogleFile ? 'application/pdf' : null
      const endpoint = nativeGoogleFile
        ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(req.params.id)}/export?mimeType=${encodeURIComponent(exportType)}`
        : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(req.params.id)}?alt=media&supportsAllDrives=true`

      const download = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(120_000) })
      if (!download.ok || !download.body) return res.status(502).json({ error: 'Falha ao baixar o arquivo para visualização.' })

      let filename = metadata.name || 'documento'
      if (nativeGoogleFile && !filename.toLowerCase().endsWith('.pdf')) {
        filename += '.pdf'
      }

      const cacheDir = path.join(dataDir, 'preview-cache')
      await mkdir(cacheDir, { recursive: true })
      localPath = path.join(cacheDir, `${req.params.id}-${filename}`)

      const arrayBuffer = await download.arrayBuffer()
      await writeFile(localPath, Buffer.from(arrayBuffer))
    }

    const child = spawn('xdg-open', [localPath], {
      detached: true,
      stdio: 'ignore',
      env: process.env,
    })
    child.unref()

    res.json({
      success: true,
      path: localPath,
      name: path.basename(localPath),
      message: `Arquivo aberto no visualizador padrão do computador.`
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/open-local', async (req, res) => {
  try {
    const targetPath = String(req.body?.path || '').trim()
    if (!targetPath || !existsSync(targetPath)) {
      return res.status(404).json({ error: 'Arquivo ou pasta não encontrado no computador.' })
    }
    const child = spawn('xdg-open', [targetPath], {
      detached: true,
      stdio: 'ignore',
      env: process.env,
    })
    child.unref()
    res.json({ success: true, path: targetPath })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/open-window', async (req, res) => {
  try {
    const profileDir = path.join(homedir(), '.config', 'nuvem-linux', 'app-profile')
    await mkdir(profileDir, { recursive: true })
    const appUrl = 'http://127.0.0.1:4173'
    const flags = [
      `--app=${appUrl}`,
      '--class=nuvem-linux',
      '--name=nuvem-linux',
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1120,760',
    ]

    for (const binPath of ['/usr/bin/nuvem-linux', '/usr/local/bin/nuvem-linux']) {
      if (existsSync(binPath)) {
        const child = spawn(binPath, ['window'], { detached: true, stdio: 'ignore', env: process.env })
        child.unref()
        return res.json({ success: true, message: 'Janela do aplicativo aberta.' })
      }
    }

    const candidates = ['microsoft-edge', 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'brave-browser']
    let spawned = false
    for (const bin of candidates) {
      try {
        const child = spawn(bin, flags, { detached: true, stdio: 'ignore', env: process.env })
        child.unref()
        spawned = true
        break
      } catch {}
    }
    if (!spawned) {
      const child = spawn('xdg-open', [appUrl], { detached: true, stdio: 'ignore', env: process.env })
      child.unref()
    }
    res.json({ success: true, message: 'Janela do aplicativo aberta.' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

async function listDriveChildrenWithRclone(remote, drivePath) {
  const { stdout } = await runRclone(['lsjson', '--hash', `${remote}:${drivePath}`], { timeoutMs: 90_000 })
  return JSON.parse(stdout || '[]').map(entry => ({
    id: entry.ID, name: entry.Name, isDir: entry.IsDir === true,
    size: Number(entry.Size || 0), modTime: entry.ModTime || null,
    mimeType: entry.MimeType || '', starred: null,
  }))
}

async function listDriveFoldersWithRclone(remote, drivePath) {
  const { stdout } = await runRclone(['lsjson', '--dirs-only', `${remote}:${drivePath}`], { timeoutMs: 90_000 })
  return JSON.parse(stdout || '[]').map(entry => ({
    id: entry.ID, name: entry.Name,
    path: drivePath ? path.posix.join(drivePath, entry.Name) : entry.Name,
    isDir: true,
    modTime: entry.ModTime || null,
  })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
}

app.post('/api/connect', async (req, res) => {
  const remote = String(req.body?.remote || 'meu-drive').trim()
  if (!/^[a-zA-Z0-9_-]{2,40}$/.test(remote)) return res.status(400).json({ error: 'Use de 2 a 40 letras, números, hífens ou sublinhados no nome.' })
  if (connectJob.state === 'authorizing') return res.status(409).json({ error: 'A autorização já está em andamento.' })
  let command = ['config', 'create', remote, 'drive', 'scope', 'drive', 'config_is_local', 'true']
  try {
    const config = await rcloneConfig()
    if (config[remote]) {
      if (config[remote].type !== 'drive') return res.status(409).json({ error: `Já existe uma conexão chamada “${remote}” para outro serviço.` })
      if (parseStoredToken(config, remote)?.access_token) return res.status(409).json({ error: 'Esta conta já está autorizada. Atualize o painel.' })
      await runRclone(['config', 'update', remote, 'config_is_local', 'true'])
      command = ['config', 'reconnect', `${remote}:`]
    }
  } catch (error) { return res.status(503).json({ error: `Não foi possível preparar a conexão: ${error.message}` }) }
  connectJob = { state: 'authorizing', remote, message: 'Aguardando autorização do Google…', url: null, updatedAt: Date.now() }
  const binary = process.env.NUVEM_RCLONE || await (async () => {
    const local = path.join(homedir(), '.local', 'bin', 'rclone')
    try { await access(local); return local } catch { return 'rclone' }
  })()
  const child = spawn(binary, command, { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, RCLONE_DRIVE_USE_TRASH: 'true' } })
  child.stdin.end('\n\n\n\n')
  connectProcess = child
  await mkdir(dataDir, { recursive: true, mode: 0o700 })
  await writeJson(connectFile, { pid: child.pid, remote })
  let output = '', error = ''
  const capture = chunk => {
    output = (output + chunk.toString().replace(/\x1b\[[0-9;]*m/g, '')).slice(-12000)
    const match = output.match(/https?:\/\/127\.0\.0\.1:\d+\/auth\?state=[^\s"']+/)
    if (match) connectJob.url = match[0]
  }
  child.stdout.on('data', capture)
  child.stderr.on('data', chunk => { error = (error + chunk.toString()).slice(-12000); capture(chunk) })
  child.on('error', e => { connectJob = { state: 'error', remote, message: `Não foi possível iniciar o rclone: ${e.message}` } })
  child.on('close', async code => {
    connectProcess = null
    try { await rename(connectFile, `${connectFile}.finished-${Date.now()}`) } catch {}
    accountCache.checkedAt = 0
    const accounts = await getDriveAccounts([remote])
    if (accounts.some(account => account.remote === remote)) {
      connectJob = { state: 'connected', remote, message: `Google Drive conectado${accounts.find(account => account.remote === remote)?.email ? ` · ${accounts.find(account => account.remote === remote).email}` : ''}.` }
      return
    }
    if (connectJob.state === 'cancelled') return
    const details = error.replace(/\x1b\[[0-9;]*m/g, '').trim().split('\n').filter(line => !line.includes('auth?state=')).slice(-3).join(' ')
    connectJob = { state: 'error', remote, message: details || `O Google não concluiu a autorização (código ${code}).` }
  })
  res.json({ state: connectJob.state, message: connectJob.message, remote })
})
app.post('/api/connect/cancel', (_req, res) => {
  if (connectProcess) { connectJob = { state: 'cancelled', message: 'Conexão cancelada.' }; connectProcess.kill('SIGTERM'); connectProcess = null }
  res.json(connectJob)
})

app.delete('/api/accounts/:remote', async (req, res) => {
  try {
    await requireSupportedRclone()
    const remote = String(req.params.remote || '').trim()
    if (!/^[a-zA-Z0-9_-]{2,40}$/.test(remote)) return res.status(400).json({ error: 'Nome de conexão inválido.' })
    const config = await rcloneConfig()
    if (config[remote]) {
      await runRclone(['config', 'delete', remote], { timeoutMs: 30_000 })
    }
    const saved = await readJson(accountFile, {})
    delete saved[remote]
    await writeJson(accountFile, saved)

    const savedStorage = await readJson(storageFile, {})
    delete savedStorage[remote]
    await writeJson(storageFile, savedStorage)

    const cache = await readJson(driveCacheFile, {})
    for (const key of Object.keys(cache)) {
      if (key.startsWith(`${remote}|`)) delete cache[key]
    }
    await writeJson(driveCacheFile, cache)

    accountCache = { checkedAt: 0, accounts: [] }
    res.json({ ok: true, remote })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.post('/api/pick-folder', (_req, res) => {
  const picker = spawn('zenity', ['--file-selection', '--directory', '--title=Selecione uma pasta para sincronizar'], { stdio: ['ignore', 'pipe', 'ignore'] })
  let selected = ''
  picker.stdout.on('data', chunk => { selected += chunk.toString() })
  picker.on('error', () => res.status(503).json({ error: 'Seletor de pastas indisponível. Digite o caminho absoluto da pasta.' }))
  picker.on('close', code => code === 0 && selected.trim() ? res.json({ path: selected.trim() }) : res.status(204).end())
})

app.post('/api/folders', async (req, res) => {
  try {
    await requireSupportedRclone()
    const localPath = await validateLocalFolder(req.body?.localPath)
    const remote = String(req.body?.remote || '').trim()
    if (!/^[a-zA-Z0-9_-]{2,40}$/.test(remote)) return res.status(400).json({ error: 'Escolha uma conta Google Drive conectada.' })
    const remotePath = normalizeDrivePath(req.body?.remotePath)
    if (remotePath === '.nuvem-linux-backups' || remotePath.startsWith('.nuvem-linux-backups/')) throw new Error('Essa pasta é reservada para cópias de recuperação do aplicativo.')
    const config = await rcloneConfig()
    if (config[remote]?.type !== 'drive' || !parseStoredToken(config, remote)?.access_token) return res.status(400).json({ error: 'A conta Google Drive escolhida não está autorizada.' })
    const rows = await readFolders()
    validatePairOverlap({ localPath, remote, remotePath }, rows)
    const folder = {
      id: randomUUID(), localPath, remote, remotePath, initialized: false, paused: false,
      createdAt: Date.now(), baseline: null, preview: null,
      status: { state: 'preparing', message: 'Lendo as duas pastas para preparar a prévia…' },
    }
    const snapshot = await folderSnapshot(folder)
    folder.preview = createPreview(snapshot)
    folder.status = { state: 'preview', message: 'Prévia pronta. Revise antes de aplicar.' }
    rows.push(folder)
    await saveFolders(rows)
    await recordActivity({
      type: 'folder_added',
      folderId: folder.id,
      folderName: path.basename(folder.localPath),
      localPath: folder.localPath,
      remotePath: `${folder.remote}:${folder.remotePath}`,
      message: `Nova pasta configurada: ${folder.localPath} → ${folder.remote}:${folder.remotePath}`,
    })
    res.json(sanitizeFolder(folder))
  } catch (error) { res.status(400).json({ error: error.message }) }
})

app.get('/api/activity', async (_req, res) => {
  res.json(await readActivity())
})

app.get('/api/sync/queue', async (_req, res) => {
  const folders = await readFolders()
  const activeFolders = folders.filter(f => activeSync.has(f.id))
  res.json({
    ...syncProgress,
    activeFolders: activeFolders.map(f => ({ id: f.id, name: path.basename(f.localPath), path: f.localPath })),
  })
})

app.get('/api/conflicts', async (_req, res) => {
  try {
    const list = await listAllConflicts()
    res.json({ conflicts: list })
  } catch (error) {
    res.status(500).json({ error: error.message, conflicts: [] })
  }
})

app.post('/api/conflicts/resolve', async (req, res) => {
  try {
    const { folderId, conflictPath, resolution: rawResolution, action } = req.body || {}
    const resolution = rawResolution || action
    if (!folderId || !conflictPath || !resolution) {
      return res.status(400).json({ error: 'Parâmetros incompletos para resolver o conflito.' })
    }
    const folders = await readFolders()
    const folder = folders.find(f => f.id === folderId)
    if (!folder) return res.status(404).json({ error: 'Pasta sincronizada não encontrada.' })

    const resolvedConflict = path.resolve(conflictPath)
    if (!isWithinFolder(folder.localPath, resolvedConflict) && resolvedConflict !== folder.localPath) {
      return res.status(400).json({ error: 'Arquivo fora da pasta sincronizada.' })
    }
    if (!existsSync(resolvedConflict)) {
      return res.status(404).json({ error: 'Arquivo conflitante não encontrado no disco.' })
    }

    const filename = path.basename(resolvedConflict)
    const originalName = parseConflictName(filename)
    if (!originalName) {
      return res.status(400).json({ error: 'O arquivo especificado não parece ser uma versão conflitante.' })
    }

    const dir = path.dirname(resolvedConflict)
    const originalPath = path.join(dir, originalName)

    if (resolution === 'keep_local') {
      await moveToLinuxTrash(resolvedConflict)
      await recordActivity({
        type: 'conflict_resolved',
        folderId,
        folderName: path.basename(folder.localPath),
        message: `Conflito resolvido em "${originalName}": versão local mantida; cópia conflitante enviada à lixeira.`,
      })
    } else if (resolution === 'keep_remote') {
      if (existsSync(originalPath)) {
        await moveToLinuxTrash(originalPath)
      }
      await rename(resolvedConflict, originalPath)
      await recordActivity({
        type: 'conflict_resolved',
        folderId,
        folderName: path.basename(folder.localPath),
        message: `Conflito resolvido em "${originalName}": versão da nuvem aplicada sobre a versão local.`,
      })
    } else if (resolution === 'keep_both') {
      const ext = path.extname(originalName)
      const base = path.basename(originalName, ext)
      let cleanName = `${base} (cópia Google Drive)${ext}`
      let counter = 2
      while (existsSync(path.join(dir, cleanName))) {
        cleanName = `${base} (cópia Google Drive ${counter++})${ext}`
      }
      await rename(resolvedConflict, path.join(dir, cleanName))
      await recordActivity({
        type: 'conflict_resolved',
        folderId,
        folderName: path.basename(folder.localPath),
        message: `Conflito resolvido em "${originalName}": mantidas ambas as versões como "${cleanName}".`,
      })
    } else {
      return res.status(400).json({ error: 'Tipo de resolução inválido.' })
    }

    if (!folder.paused && !activeSync.has(folder.id)) {
      setTimeout(() => runFolderSync(folder.id), 500).unref()
    }

    res.json({ ok: true, resolution, originalName })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/conflicts/diff', async (req, res) => {
  try {
    const conflictPath = req.query?.conflictPath
    if (!conflictPath || !existsSync(conflictPath)) {
      return res.status(404).json({ error: 'Arquivo conflitante não encontrado.' })
    }
    const filename = path.basename(conflictPath)
    const originalName = parseConflictName(filename)
    if (!originalName) return res.status(400).json({ error: 'Arquivo inválido.' })
    const dir = path.dirname(conflictPath)
    const originalPath = path.join(dir, originalName)

    const isTextExt = /\.(txt|md|json|yml|yaml|qmd|r|py|js|ts|html|css|csv|tsv|sh|xml|log|ini|cfg)$/i.test(originalName)
    let localContent = ''
    let remoteContent = ''
    let isText = false

    if (isTextExt) {
      try {
        const cStat = await stat(conflictPath)
        const oStat = existsSync(originalPath) ? await stat(originalPath) : null
        if (cStat.size < 512 * 1024 && (!oStat || oStat.size < 512 * 1024)) {
          remoteContent = await readFile(conflictPath, 'utf8')
          localContent = oStat ? await readFile(originalPath, 'utf8') : ''
          isText = true
        }
      } catch {}
    }

    res.json({
      isText,
      localContent: isText ? localContent.slice(0, 50000) : null,
      remoteContent: isText ? remoteContent.slice(0, 50000) : null,
      originalName,
      conflictName: filename,
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/conflicts/resolve-all', async (req, res) => {
  try {
    const { folderId, resolution: rawResolution, action } = req.body || {}
    const resolution = rawResolution || action
    if (!resolution || !['keep_local', 'keep_remote', 'keep_both'].includes(resolution)) {
      return res.status(400).json({ error: 'Tipo de resolução inválido.' })
    }
    const folders = await readFolders()
    const targetFolders = folderId ? folders.filter(f => f.id === folderId) : folders
    let resolvedCount = 0

    for (const folder of targetFolders) {
      if (!folder.localPath || !existsSync(folder.localPath)) continue
      const conflicts = await findFolderConflicts(folder)
      for (const item of conflicts) {
        try {
          const resolvedConflict = item.conflictPath
          const originalPath = item.originalPath
          const originalName = item.originalFile
          const dir = path.dirname(resolvedConflict)

          if (resolution === 'keep_local') {
            await moveToLinuxTrash(resolvedConflict)
          } else if (resolution === 'keep_remote') {
            if (existsSync(originalPath)) {
              await moveToLinuxTrash(originalPath)
            }
            await rename(resolvedConflict, originalPath)
          } else if (resolution === 'keep_both') {
            const ext = path.extname(originalName)
            const base = path.basename(originalName, ext)
            let cleanName = `${base} (cópia Google Drive)${ext}`
            let counter = 2
            while (existsSync(path.join(dir, cleanName))) {
              cleanName = `${base} (cópia Google Drive ${counter++})${ext}`
            }
            await rename(resolvedConflict, path.join(dir, cleanName))
          }
          resolvedCount++
        } catch {}
      }
      if (conflicts.length > 0 && !folder.paused && !activeSync.has(folder.id)) {
        setTimeout(() => runFolderSync(folder.id), 1000).unref()
      }
    }

    await recordActivity({
      type: 'conflict_resolved',
      message: `Resolução em massa: ${resolvedCount} conflito(s) resolvido(s) com a regra "${resolution === 'keep_local' ? 'Manter Local' : resolution === 'keep_remote' ? 'Manter Drive' : 'Manter Ambos'}".`,
    })

    res.json({ ok: true, resolvedCount })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/folders/:id/preview', async (req, res) => {
  try {
    const folder = await refreshPreview(req.params.id)
    if (!folder) return res.status(404).json({ error: 'Pasta não encontrada.' })
    res.json(sanitizeFolder(folder))
  } catch (error) { res.status(400).json({ error: error.message }) }
})

app.post('/api/folders/:id/sync', async (req, res) => {
  const folder = (await readFolders()).find(item => item.id === req.params.id)
  const result = await runFolderSync(req.params.id, { previewId: req.body?.previewId || folder?.preview?.id })
  const status = result.state === 'preview-changed' ? 409 : result.state === 'error' ? 400 : 200
  res.status(status).json(result)
})

app.post('/api/folders/:id/pause', async (req, res) => {
  if (activeSync.has(req.params.id)) return res.status(409).json({ error: 'Aguarde a sincronização atual terminar antes de pausar.' })
  const folder = await changeFolder(req.params.id, current => ({ ...current, paused: true, status: { ...current.status, state: 'paused', message: 'Sincronização pausada.' } }))
  if (!folder) return res.status(404).json({ error: 'Pasta não encontrada.' })
  res.json(sanitizeFolder(folder))
})
app.post('/api/folders/:id/resume', async (req, res) => {
  const folder = await changeFolder(req.params.id, current => ({ ...current, paused: false, status: { ...current.status, state: current.initialized ? 'waiting' : 'preview', message: current.initialized ? 'Retomando sincronização.' : 'Revise e aplique a prévia inicial.' } }))
  if (!folder) return res.status(404).json({ error: 'Pasta não encontrada.' })
  if (folder.initialized) setTimeout(() => runFolderSync(folder.id), 0).unref()
  res.json(sanitizeFolder(folder))
})
app.delete('/api/folders/:id', async (req, res) => {
  if (activeSync.has(req.params.id)) return res.status(409).json({ error: 'Aguarde a sincronização atual terminar. Os arquivos serão mantidos.' })
  const rows = await readFolders()
  const removedFolder = rows.find(folder => folder.id === req.params.id)
  const next = rows.filter(folder => folder.id !== req.params.id)
  if (next.length === rows.length) return res.status(404).json({ error: 'Pasta não encontrada.' })
  await saveFolders(next)
  if (removedFolder) {
    await recordActivity({
      type: 'folder_removed',
      folderId: req.params.id,
      folderName: path.basename(removedFolder.localPath),
      message: `Pasta desvinculada da sincronização: ${removedFolder.localPath}`,
    })
  }
  res.json({ ok: true, filesKept: true })
})

app.post('/api/folders/:id/retry', async (req, res) => {
  const folder = (await readFolders()).find(item => item.id === req.params.id)
  if (!folder) return res.status(404).json({ error: 'Pasta não encontrada.' })
  if (folder.paused) return res.status(409).json({ error: 'Retome a pasta antes de tentar novamente.' })
  const result = await runFolderSync(folder.id, { previewId: folder.preview?.id })
  res.status(result.state === 'error' ? 400 : 200).json(result)
})

app.get('/api/trash', async (_req, res) => {
  const rows = await readTrash()
  const folders = await readFolders()
  const activeIds = new Set(folders.map(folder => folder.id))
  const live = []
  for (const item of rows) {
    if (item.expiresAt <= Date.now()) continue
    if (item.side === 'linux') {
      try { await stat(item.infoPath); await stat(item.filePath); live.push(item) } catch {}
    } else if (activeIds.has(item.folderId) && !item.remotePath?.includes('/.nuvem-linux-trash/')) {
      try { if (await isGoogleTrashItemTrashed(item)) live.push(item) } catch { live.push(item) }
    } else if (activeIds.has(item.folderId)) {
      try {
        const { stdout } = await runRclone(['lsjson', `${item.remote}:${item.remotePath}`], { timeoutMs: 15_000 })
        if (JSON.parse(stdout || '[]').length) live.push(item)
      } catch { /* expirado ou indisponível: só exibe se listado com sucesso */ }
    }
  }
  if (live.length !== rows.length) await saveTrash(live)
  res.json({ items: live, googleTrashUrl: 'https://drive.google.com/drive/trash' })
})

async function isGoogleTrashItemTrashed(item) {
  const token = await getConfigAccessToken(item.remote)
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(item.driveFileId)}?fields=id,trashed`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`Consulta da lixeira Google falhou (HTTP ${response.status}).`)
  return (await response.json()).trashed === true
}

app.post('/api/trash/:id/restore', async (req, res) => {
  const rows = await readTrash()
  const item = rows.find(row => row.id === req.params.id)
  if (!item) return res.status(404).json({ error: 'Item não encontrado ou expirado.' })
  try {
    if (item.side === 'linux') await restoreFromLinuxTrash(item)
    else if (item.remotePath?.includes('/.nuvem-linux-trash/')) {
      const suffix = item.remotePath.slice(item.remotePath.indexOf('/.nuvem-linux-trash/') + '/.nuvem-linux-trash/'.length)
      const restoreTarget = `${item.remote}:${path.posix.join(item.folderRemotePath || '', suffix)}`
      const current = await listRemoteFiles(item.remote, path.posix.join(item.folderRemotePath || '', suffix)).catch(() => [])
      if (current.length) throw new Error('Já existe um arquivo nesse caminho. Renomeie ou mova a versão atual antes de restaurar.')
      await runRclone(['moveto', item.remotePath, restoreTarget], { timeoutMs: 60_000 })
    } else await restoreGoogleDriveItem(item)
    await saveTrash(rows.filter(row => row.id !== item.id))
    if (item.folderId) setTimeout(() => runFolderSync(item.folderId), 0).unref()
    res.json({ ok: true, message: 'Item restaurado. A próxima sincronização atualizará a outra ponta.' })
  } catch (error) { res.status(409).json({ error: error.message }) }
})

async function purgeExpiredTrash() {
  const rows = await readTrash(), keep = []
  for (const item of rows) {
    if (item.expiresAt > Date.now()) { keep.push(item); continue }
    if (item.side === 'linux') {
      try { await purgeLinuxTrashItem(item) } catch (error) { console.error(`Não foi possível limpar item da lixeira do Linux: ${error.message}`); keep.push(item) }
    }
  }
  if (keep.length !== rows.length) await saveTrash(keep)
}

async function initializeServiceState() {
  const rows = await readFolders()
  let changed = false
  for (const folder of rows) {
    if (folder.status?.state === 'syncing') {
      folder.status = { ...folder.status, state: folder.initialized ? 'waiting' : 'preview', message: 'Serviço retomado após uma interrupção.' }
      changed = true
    }
  }
  if (changed) await saveFolders(rows)
  await purgeExpiredTrash()
  setTimeout(() => syncCycleOnce().catch(error => console.error(`Falha ao retomar sincronizações: ${error.message}`)), 0).unref()
}

async function syncCycleOnce() {
  if (syncCycle) return
  syncCycle = true
  try {
    const health = await rcloneHealth()
    if (!health.supported) return
    for (const folder of await readFolders()) {
      if (folder.paused || activeSync.has(folder.id)) continue
      if (!folder.initialized && folder.preview && folder.status?.state === 'applying') await runFolderSync(folder.id, { previewId: folder.preview.id })
      else if (folder.initialized) await runFolderSync(folder.id)
    }
  } finally { syncCycle = false }
}
function scheduleNextCycle(delay = 30_000) {
  const timer = setTimeout(async () => {
    await syncCycleOnce()
    await purgeExpiredTrash().catch(error => console.error(`Falha ao limpar lixeira: ${error.message}`))
    scheduleNextCycle()
  }, delay)
  timer.unref()
}

let trayProcess = null
function startTrayIndicator() {
  const trayScript = path.join(__dirname, 'scripts', 'tray-indicator.py')
  try {
    if (!process.env.DBUS_SESSION_BUS_ADDRESS && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) return
    trayProcess = spawn('python3', [trayScript], {
      stdio: 'ignore',
      env: process.env,
    })
    trayProcess.on('error', (err) => {
      console.warn('Não foi possível iniciar o indicador da bandeja:', err.message)
    })
    trayProcess.on('exit', () => {
      trayProcess = null
    })
  } catch (err) {
    console.warn('Erro ao inicializar indicador de bandeja:', err.message)
  }
}

process.on('exit', () => {
  stopAllFolderWatchers()
  if (trayProcess) {
    try { trayProcess.kill() } catch {}
  }
})
process.on('SIGINT', () => process.exit(0))
process.on('SIGTERM', () => process.exit(0))

await initializeServiceState()
updateFolderWatchers(await readFolders())
scheduleNextCycle(30_000)
startTrayIndicator()
setTimeout(() => {
  getUpdateStatus(false).catch(() => {})
}, 3000)
setInterval(() => {
  getUpdateStatus(false).catch(() => {})
}, 4 * 60 * 60 * 1000)
app.listen(port, '127.0.0.1', () => console.log(`Nuvem Linux em http://localhost:${port}`))
