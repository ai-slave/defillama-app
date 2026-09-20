import { useCallback, useState } from 'react'
import type { UploadSelectionFeedback } from '../components/UploadSelectionNotice'
import { useUploadProjectFiles } from './hooks'

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

export function useProjectFileUpload(projectId: string) {
	const upload = useUploadProjectFiles(projectId)
	const [feedback, setFeedback] = useState<UploadSelectionFeedback | null>(null)

	const handleFiles = useCallback(
		async (fileList: Array<File>) => {
			if (fileList.length === 0) return

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
			setFeedback(skipped.length > 0 ? { added: 0, skipped } : null)
			if (files.length === 0) return
			try {
				const res = await upload.mutateAsync(files)
				setFeedback({
					added: res.imported.length,
					skipped: [...skipped, ...res.skipped.map(({ path, reason }) => ({ filename: path, reason }))]
				})
			} catch (error) {
				const reason = error instanceof Error ? error.message : 'Upload failed. Select the file again to retry.'
				setFeedback({
					added: 0,
					skipped: [...skipped, ...files.map((file) => ({ filename: getProjectFileName(file), reason }))]
				})
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
