import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readdir, readFile, rm, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { runCommand } from './rclone.js'

const execFileAsync = promisify(execFile)

export function parseTrashInfo(contents) {
  const value = String(contents).match(/^Path=(.*)$/m)?.[1]
  if (!value) return null
  try { return decodeURIComponent(value.replaceAll('+', '%20')) } catch { return value }
}

function decodeMountPath(value) {
  return value.replace(/\\([0-7]{3})/g, (_match, octal) => String.fromCharCode(parseInt(octal, 8)))
}

async function trashLocations(originalPath) {
  const xdgDataHome = process.env.XDG_DATA_HOME || path.join(homedir(), '.local', 'share')
  const roots = new Set([path.join(xdgDataHome, 'Trash')])
  try {
    const { stdout } = await execFileAsync('findmnt', ['--noheadings', '--output', 'TARGET', '--target', originalPath], { timeout: 5000 })
    const mount = decodeMountPath(stdout.trim())
    roots.add(path.join(mount, `.Trash-${process.getuid()}`))
    roots.add(path.join(mount, '.Trash', String(process.getuid())))
  } catch {}
  return [...roots].map(root => ({ root, info: path.join(root, 'info'), files: path.join(root, 'files') }))
}

async function infoFiles(location) {
  try { return new Set((await readdir(location.info)).filter(name => name.endsWith('.trashinfo'))) } catch { return new Set() }
}

function inside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child))
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
}

export async function moveToLinuxTrash(originalPath, metadata = {}) {
  await stat(originalPath)
  const locations = await trashLocations(originalPath)
  const before = new Map()
  for (const location of locations) before.set(location.info, await infoFiles(location))
  await runCommand('gio', ['trash', originalPath], { timeoutMs: 30_000 })

  for (const location of locations) {
    const now = await infoFiles(location)
    for (const name of now) {
      if (before.get(location.info)?.has(name)) continue
      const infoPath = path.join(location.info, name)
      let original = null
      try { original = parseTrashInfo(await readFile(infoPath, 'utf8')) } catch {}
      if (path.resolve(original || '') !== path.resolve(originalPath)) continue
      const filePath = path.join(location.files, name.slice(0, -'.trashinfo'.length))
      if (!inside(location.files, filePath)) throw new Error('O arquivo movido não está dentro da lixeira esperada.')
      return {
        id: metadata.id,
        folderId: metadata.folderId,
        side: 'linux',
        name: path.basename(originalPath),
        originalPath,
        infoPath,
        filePath,
        deletedAt: Date.now(),
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        driveFileId: metadata.driveFileId || null,
        remote: metadata.remote || null,
        remotePath: metadata.remotePath || null,
      }
    }
  }

  try { await runCommand('gio', ['trash', '--restore', originalPath], { timeoutMs: 30_000 }) } catch {}
  throw new Error('O arquivo foi enviado à lixeira, mas não consegui registrar o item para recuperação automática. A sincronização foi interrompida.')
}

export async function findLinuxTrashItem(originalPath, metadata = {}) {
  const target = path.resolve(originalPath)
  for (const location of await trashLocations(target)) {
    for (const name of await infoFiles(location)) {
      const infoPath = path.join(location.info, name)
      try {
        const original = parseTrashInfo(await readFile(infoPath, 'utf8'))
        if (path.resolve(original || '') !== target) continue
        const filePath = path.join(location.files, name.slice(0, -'.trashinfo'.length))
        const item = {
          id: metadata.id, folderId: metadata.folderId, side: 'linux', name: path.basename(target), originalPath: target,
          infoPath, filePath, deletedAt: Date.now(), expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
          driveFileId: metadata.driveFileId || null, remote: metadata.remote || null, remotePath: metadata.remotePath || null,
        }
        assertTrackedTrashPaths(item)
        await stat(filePath)
        return item
      } catch {}
    }
  }
  return null
}

export async function restoreFromLinuxTrash(item) {
  assertTrackedTrashPaths(item)
  await stat(item.infoPath)
  await stat(item.filePath)
  await runCommand('gio', ['trash', '--restore', item.originalPath], { timeoutMs: 30_000 })
  return true
}

function assertTrackedTrashPaths(item) {
  const infoPath = path.resolve(item.infoPath || '')
  const filePath = path.resolve(item.filePath || '')
  const infoRoot = path.dirname(path.dirname(infoPath))
  const filesRoot = path.dirname(path.dirname(filePath))
  if (path.basename(path.dirname(infoPath)) !== 'info'
    || path.basename(path.dirname(filePath)) !== 'files'
    || infoRoot !== filesRoot
    || path.basename(infoPath) !== `${path.basename(filePath)}.trashinfo`
    || !infoPath.endsWith('.trashinfo')) {
    throw new Error('O item de lixeira tem caminhos inválidos; operação cancelada.')
  }
}

export async function purgeLinuxTrashItem(item) {
  assertTrackedTrashPaths(item)
  try { await rm(item.filePath, { recursive: true, force: true }) } catch {}
  try { await rm(item.infoPath, { force: true }) } catch {}
}
