import { useCallback, useState } from 'react'
import { LlamaAITransportError } from '../api/transport'
import type { UploadSelectionFeedback } from '../components/UploadSelectionNotice'
import { useUploadProjectFiles } from './hooks'
import type { ImportResult } from './types'

const PROJECT_FILE_ACCEPT_EXTENSIONS = [
	'.md',
	'.mdx',
	'.txt',
	'.csv',
	'.json',
	'.pdf',
	'.js',
	'.jsx',
	'.ts',
	'.tsx',
	'.py',
	'.go',
	'.rs',
	'.sol',
	'.java',
	'.c',
	'.cc',
	'.cpp',
	'.h',
	'.hpp',
	'.cs',
	'.php',
	'.rb',
	'.swift',
	'.kt',
	'.kts',
	'.scala',
	'.sh',
	'.bash',
	'.zsh',
	'.fish',
	'.sql',
	'.html',
	'.css',
	'.scss',
	'.sass',
	'.less',
	'.yml',
	'.yaml',
	'.toml',
	'.xml',
	'.graphql',
	'.proto',
	'.vue',
	'.svelte'
] as const

const PROJECT_FILE_ACCEPT_TYPES = [
	'text/markdown',
	'text/plain',
	'text/csv',
	'application/json',
	'application/pdf'
] as const

const PROJECT_FILE_ACCEPT_EXTENSION_SET = new Set<string>(PROJECT_FILE_ACCEPT_EXTENSIONS)
const PROJECT_FILE_ACCEPT_TYPE_SET = new Set<string>(PROJECT_FILE_ACCEPT_TYPES)
const PROJECT_FILE_ACCEPT_FILENAMES = new Set(['dockerfile', 'makefile'])
const PROJECT_MAX_FILE_BYTES = 100 * 1024 * 1024

export const PROJECT_FILE_ACCEPT = [...PROJECT_FILE_ACCEPT_EXTENSIONS, ...PROJECT_FILE_ACCEPT_TYPES].join(',')

function isArchiveFile(file: File): boolean {
	return /\.(zip|tar|tgz|gz|7z|rar)$/i.test(file.name) || file.type === 'application/zip'
}

function getProjectFileName(file: File) {
	return ((file as any).webkitRelativePath || file.name).split('/').pop() ?? file.name
}

function isAcceptedProjectFile(file: File): boolean {
	if (PROJECT_FILE_ACCEPT_TYPE_SET.has(file.type)) return true

	const name = getProjectFileName(file).toLowerCase()
	if (PROJECT_FILE_ACCEPT_FILENAMES.has(name)) return true

	const extensionStart = name.lastIndexOf('.')
	if (extensionStart === -1) return false

	return PROJECT_FILE_ACCEPT_EXTENSION_SET.has(name.slice(extensionStart))
}

/** Rejects files the server would refuse before uploading, keeping the reason per file. */
export function partitionProjectUploadFiles(fileList: Array<File>) {
	const files: Array<File> = []
	const skipped: UploadSelectionFeedback['skipped'] = []
	for (const file of fileList) {
		let reason = ''
		if (isArchiveFile(file)) reason = 'Unzip the archive and upload its files instead.'
		else if (file.size > PROJECT_MAX_FILE_BYTES) reason = 'Exceeds the 100 MB per-file limit.'
		else if (!isAcceptedProjectFile(file)) reason = 'Unsupported file type.'
		if (reason) skipped.push({ filename: getProjectFileName(file), reason })
		else files.push(file)
	}
	return { files, skipped }
}

/** Client and server rejections are reported together; a failed request rejects every sent file. */
export function getProjectUploadFeedback(
	clientSkipped: UploadSelectionFeedback['skipped'],
	sent: Array<File>,
	outcome: { result: ImportResult } | { error: unknown }
): UploadSelectionFeedback {
	if ('result' in outcome) {
		return {
			added: outcome.result.imported.length,
			skipped: [...clientSkipped, ...outcome.result.skipped.map(({ path, reason }) => ({ filename: path, reason }))]
		}
	}
	// The project route's 4xx JSON `error` is written for readers ("Project storage quota exceeded"). A 5xx, a proxy's
	// text page and the 401 `unauthenticated` code are not.
	const { error } = outcome
	const refusal =
		error instanceof LlamaAITransportError && error.status < 500 && error.status !== 401
			? (error.body as { error?: unknown } | null)?.error
			: null
	const reason = typeof refusal === 'string' ? refusal : "Couldn't upload the file. Select it again to retry."
	return {
		added: 0,
		skipped: [...clientSkipped, ...sent.map((file) => ({ filename: getProjectFileName(file), reason }))]
	}
}

export function useProjectFileUpload(projectId: string) {
	const upload = useUploadProjectFiles(projectId)
	const [feedback, setFeedback] = useState<UploadSelectionFeedback | null>(null)

	const handleFiles = useCallback(
		async (fileList: Array<File>) => {
			if (fileList.length === 0) return

			const { files, skipped } = partitionProjectUploadFiles(fileList)
			setFeedback(skipped.length > 0 ? { added: 0, skipped } : null)
			if (files.length === 0) return
			try {
				setFeedback(getProjectUploadFeedback(skipped, files, { result: await upload.mutateAsync(files) }))
			} catch (error) {
				setFeedback(getProjectUploadFeedback(skipped, files, { error }))
			}
		},
		[upload]
	)

	return {
		handleFiles,
		feedback,
		dismissFeedback: () => setFeedback(null),
		isUploading: upload.isPending
	}
}
