import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import path from 'node:path'
import { homedir } from 'node:os'
import { isRcloneSupported, MIN_RCLONE_VERSION, summarizeRcloneError } from './sync-domain.js'

const localRclone = path.join(homedir(), '.local', 'bin', 'rclone')

export async function rcloneBinary() {
  if (process.env.NUVEM_RCLONE) return process.env.NUVEM_RCLONE
  try { await access(localRclone); return localRclone } catch { return 'rclone' }
}

export function runCommand(binary, args, options = {}) {
  const { timeoutMs = 120_000, input, env = process.env, maxOutput = 64 * 1024 * 1024 } = options
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'], env })
    let stdout = '', stderr = '', finished = false
    const finishError = error => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      reject(error)
    }
    const add = (target, chunk, stream) => {
      if (target.length + chunk.length > maxOutput) {
        child.kill('SIGTERM')
        finishError(new Error('A saída do rclone ultrapassou o limite de segurança.'))
        return target
      }
      return target + chunk.toString()
    }
    child.stdout.on('data', chunk => {
      stdout = add(stdout, chunk, 'stdout')
      if (typeof options.onLogChunk === 'function') options.onLogChunk(chunk.toString(), 'stdout')
    })
    child.stderr.on('data', chunk => {
      stderr = add(stderr, chunk, 'stderr')
      if (typeof options.onLogChunk === 'function') options.onLogChunk(chunk.toString(), 'stderr')
    })
    child.on('error', finishError)
    child.on('close', code => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      if (code === 0) resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code })
      else reject(new Error(summarizeRcloneError(stderr || stdout || `Processo terminou com código ${code}`)))
    })
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      const killer = setTimeout(() => child.kill('SIGKILL'), 3000)
      killer.unref()
      finishError(new Error(`O comando excedeu o limite de ${Math.round(timeoutMs / 1000)} segundos.`))
    }, timeoutMs)
    timer.unref()
    if (input !== undefined) child.stdin.end(input)
  })
}

export async function runRclone(args, options = {}) {
  const binary = await rcloneBinary()
  const env = { ...process.env, RCLONE_DRIVE_USE_TRASH: 'true', ...(options.env || {}) }
  return runCommand(binary, args, { ...options, env })
}

let versionCache = { checkedAt: 0, version: null, supported: false, error: null }
export async function rcloneHealth(force = false) {
  if (!force && Date.now() - versionCache.checkedAt < 60_000) return versionCache
  try {
    const { stdout } = await runRclone(['version'], { timeoutMs: 10_000 })
    const version = stdout.split('\n')[0].trim()
    versionCache = { checkedAt: Date.now(), version, supported: isRcloneSupported(version), minimum: MIN_RCLONE_VERSION, error: null }
  } catch (error) {
    versionCache = { checkedAt: Date.now(), version: null, supported: false, minimum: MIN_RCLONE_VERSION, error: error.message }
  }
  return versionCache
}

export async function requireSupportedRclone() {
  const health = await rcloneHealth()
  if (!health.supported) {
    const found = health.version || health.error || 'não encontrado'
    throw new Error(`A sincronização exige rclone estável ${health.minimum} ou superior. Encontrado: ${found}.`)
  }
  return health
}
