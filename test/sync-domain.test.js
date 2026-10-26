import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildInitialPlan,
  conflictCopyPath,
  isRcloneSupported,
  normalizeDrivePath,
  pathsOverlap,
  validatePairOverlap,
} from '../lib/sync-domain.js'

test('rclone gate rejects the installed prerelease and accepts stable compatible versions', () => {
  assert.equal(isRcloneSupported('rclone v1.60.1-DEV'), false)
  assert.equal(isRcloneSupported('rclone v1.70.9'), false)
  assert.equal(isRcloneSupported('rclone v1.71.0'), true)
  assert.equal(isRcloneSupported('rclone v1.75.2'), true)
})

test('Drive path normalization rejects absolute and parent traversal paths', () => {
  assert.equal(normalizeDrivePath(' Nuvem\\Projetos//2026/ '), 'Nuvem/Projetos/2026')
  assert.throws(() => normalizeDrivePath('/Nuvem/Projeto'))
  assert.throws(() => normalizeDrivePath('../fora'))
})

test('overlap detection blocks equal, ancestor, and descendant folder pairs', () => {
  assert.equal(pathsOverlap('/data/a', '/data/a'), true)
  assert.equal(pathsOverlap('/data/a', '/data/a/sub'), true)
  assert.equal(pathsOverlap('/data/a/sub', '/data/a'), true)
  assert.equal(pathsOverlap('/data/a', '/data/ab'), false)
  assert.throws(() => validatePairOverlap({ localPath: '/data/a/sub', remote: 'drive', remotePath: 'Backup/sub' }, [
    { localPath: '/data/a', remote: 'drive', remotePath: 'Backup' },
  ]), /sobrepõe/)
})

test('initial preview identifies one-sided files, identical hashes, and conflicts', () => {
  const local = [
    { Path: 'upload.txt', Size: 3, Hashes: { MD5: 'abc' } },
    { Path: 'same.txt', Size: 3, Hashes: { MD5: 'same' } },
    { Path: 'conflict.txt', Size: 3, Hashes: { MD5: 'local' } },
  ]
  const remote = [
    { Path: 'download.txt', Size: 4, Hashes: { MD5: 'def' } },
    { Path: 'same.txt', Size: 3, Hashes: { MD5: 'same' } },
    { Path: 'conflict.txt', Size: 4, Hashes: { MD5: 'remote' } },
  ]
  const plan = buildInitialPlan(local, remote, 'preview-1', 100)
  assert.deepEqual(plan.summary, { upload: 1, download: 1, identical: 1, conflicts: 1 })
  assert.deepEqual(plan.rows.map(row => [row.path, row.action]), [
    ['conflict.txt', 'conflict'], ['download.txt', 'download'], ['upload.txt', 'upload'],
  ])
  assert.equal(plan.id, 'preview-1')
})

test('initial preview treats files without comparable hashes as conflicts', () => {
  const plan = buildInitialPlan([{ Path: 'doc.txt', Size: 10 }], [{ Path: 'doc.txt', Size: 10 }], 'p')
  assert.equal(plan.summary.conflicts, 1)
})

test('conflict copy names keep the extension and avoid existing names', () => {
  const paths = new Set(['docs/report (conflito Google Drive stamp).pdf'])
  assert.equal(conflictCopyPath('docs/report.pdf', paths, 'stamp'), 'docs/report (conflito Google Drive stamp) 2.pdf')
})
