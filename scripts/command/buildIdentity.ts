import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

type ResolveBuildCommitShaOptions = {
	env: NodeJS.ProcessEnv
	projectDir: string
	readGitCommitSha?: (projectDir: string) => string
}

export function commitShaFromEnv(env: NodeJS.ProcessEnv): string {
	return env.SOURCE_COMMIT?.trim() || env.VERCEL_GIT_COMMIT_SHA?.trim() || ''
}

function readFileTrimmed(filePath: string): string {
	return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8').trim() : ''
}

function resolveGitDir(projectDir: string): string {
	const dotGitPath = path.join(projectDir, '.git')
	if (!fs.existsSync(dotGitPath)) return ''
	const stat = fs.statSync(dotGitPath)
	if (stat.isDirectory()) return dotGitPath
	const gitDir = readFileTrimmed(dotGitPath)
	if (!gitDir.startsWith('gitdir:')) return ''
	return path.resolve(projectDir, gitDir.slice('gitdir:'.length).trim())
}

function readPackedRef(gitDir: string, ref: string): string {
	const packedRefs = readFileTrimmed(path.join(gitDir, 'packed-refs'))
	if (!packedRefs) return ''
	for (const line of packedRefs.split(/\r?\n/)) {
		const trimmed = line.trim()
		if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('^')) continue
		const [sha, name] = trimmed.split(' ')
		if (name === ref && sha) return sha
	}
	return ''
}

function readGitHeadCommitSha(projectDir: string): string {
	const gitDir = resolveGitDir(projectDir)
	if (!gitDir) return ''
	const head = readFileTrimmed(path.join(gitDir, 'HEAD'))
	if (!head) return ''
	if (!head.startsWith('ref:')) return head
	const ref = head.slice('ref:'.length).trim()
	return readFileTrimmed(path.join(gitDir, ref)) || readPackedRef(gitDir, ref)
}

export function readGitCommitSha(projectDir: string): string {
	try {
		return execFileSync('git', ['rev-parse', 'HEAD'], {
			cwd: projectDir,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
			timeout: 2000
		}).trim()
	} catch {
		return readGitHeadCommitSha(projectDir)
	}
}

export function resolveBuildCommitSha({
	env,
	projectDir,
	readGitCommitSha: readGitCommit = readGitCommitSha
}: ResolveBuildCommitShaOptions): string {
	return commitShaFromEnv(env) || readGitCommit(projectDir)
}

export function createBuildCommitEnv(options: ResolveBuildCommitShaOptions): NodeJS.ProcessEnv {
	if (commitShaFromEnv(options.env)) return options.env
	const commitSha = resolveBuildCommitSha(options)
	return commitSha ? { ...options.env, SOURCE_COMMIT: commitSha } : options.env
}
