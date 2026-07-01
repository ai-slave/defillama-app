import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { commitShaFromEnv, createBuildCommitEnv, readGitCommitSha, resolveBuildCommitSha } from '../buildIdentity'
import { testEnv } from './testEnv'

const tempDirs: string[] = []

afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((tempDir) => fs.rm(tempDir, { force: true, recursive: true })))
})

async function createTempProject() {
	const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'build-identity-test-'))
	tempDirs.push(projectDir)
	await fs.mkdir(path.join(projectDir, '.git', 'refs', 'heads'), { recursive: true })
	return projectDir
}

describe('build identity', () => {
	it('prefers SOURCE_COMMIT over other build identity sources', () => {
		const env = testEnv({ SOURCE_COMMIT: 'source-sha', VERCEL_GIT_COMMIT_SHA: 'vercel-sha' })

		expect(commitShaFromEnv(env)).toBe('source-sha')
		expect(
			resolveBuildCommitSha({
				env,
				projectDir: '/missing',
				readGitCommitSha: () => 'git-sha'
			})
		).toBe('source-sha')
	})

	it('uses Vercel commit SHA when SOURCE_COMMIT is blank', () => {
		const env = testEnv({ SOURCE_COMMIT: '', VERCEL_GIT_COMMIT_SHA: 'vercel-sha' })

		expect(commitShaFromEnv(env)).toBe('vercel-sha')
		expect(
			resolveBuildCommitSha({
				env,
				projectDir: '/missing',
				readGitCommitSha: () => 'git-sha'
			})
		).toBe('vercel-sha')
	})

	it('adds SOURCE_COMMIT from git when deploy commit env vars are blank', () => {
		const env = testEnv({ SOURCE_COMMIT: '', VERCEL_GIT_COMMIT_SHA: '' })
		const buildEnv = createBuildCommitEnv({
			env,
			projectDir: '/repo',
			readGitCommitSha: () => 'git-sha'
		})

		expect(buildEnv).not.toBe(env)
		expect(buildEnv.SOURCE_COMMIT).toBe('git-sha')
		expect(env.SOURCE_COMMIT).toBe('')
	})

	it('returns the original env when a deploy commit env var is already set', () => {
		const env = testEnv({ VERCEL_GIT_COMMIT_SHA: 'vercel-sha' })

		expect(createBuildCommitEnv({ env, projectDir: '/repo', readGitCommitSha: () => 'git-sha' })).toBe(env)
	})

	it('reads a checked-out ref from minimal git metadata', async () => {
		const projectDir = await createTempProject()
		await fs.writeFile(path.join(projectDir, '.git', 'HEAD'), 'ref: refs/heads/main\n')
		await fs.writeFile(path.join(projectDir, '.git', 'refs', 'heads', 'main'), 'abc123\n')

		expect(readGitCommitSha(projectDir)).toBe('abc123')
	})

	it('reads packed refs from minimal git metadata', async () => {
		const projectDir = await createTempProject()
		await fs.writeFile(path.join(projectDir, '.git', 'HEAD'), 'ref: refs/heads/main\n')
		await fs.writeFile(path.join(projectDir, '.git', 'packed-refs'), '# pack-refs\nabc123 refs/heads/main\n')

		expect(readGitCommitSha(projectDir)).toBe('abc123')
	})
})
