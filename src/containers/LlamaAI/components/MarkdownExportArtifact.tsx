import { useMutation } from '@tanstack/react-query'
import { sanitizeUrl } from '~/containers/LlamaAI/utils/markdownHelpers'
import { Icon } from '~/ui/Icon'
import { trackUmamiEvent } from '~/utils/analytics/umami'

interface MarkdownExportArtifactProps {
	mdExport: {
		id: string
		title: string
		url: string
		filename: string
	}
	sessionId?: string | null
	messageId?: string
}

const FILE_TYPE_LABELS: Record<string, string> = {
	md: 'Markdown file',
	xlsx: 'Excel workbook',
	docx: 'Word document',
	pptx: 'PowerPoint deck'
}

function fileExtension(filename: string): string {
	const ext = filename.split('.').pop()?.toLowerCase() ?? ''
	return ext || 'file'
}

async function downloadMarkdownFile({ url, filename }: { url: string; filename: string }) {
	try {
		const response = await fetch(url)
		if (!response.ok) {
			throw new Error(`Failed to download markdown (${response.status})`)
		}

		const blob = await response.blob()
		const objectUrl = URL.createObjectURL(blob)
		const link = document.createElement('a')
		link.href = objectUrl
		link.download = filename
		link.style.display = 'none'
		document.body.appendChild(link)
		link.click()
		document.body.removeChild(link)
		URL.revokeObjectURL(objectUrl)
	} catch (error) {
		throw new Error(error instanceof Error ? error.message : 'Failed to download markdown')
	}
}

export function MarkdownExportArtifact({ mdExport, sessionId, messageId }: MarkdownExportArtifactProps) {
	const safeUrl = sanitizeUrl(mdExport.url)
	const downloadMarkdownMutation = useMutation({
		mutationFn: downloadMarkdownFile
	})

	if (!safeUrl) return null

	return (
		<button
			type="button"
			disabled={downloadMarkdownMutation.isPending}
			onClick={() => {
				trackUmamiEvent('llamaai-download', {
					kind: 'artifact-md',
					filename: mdExport.filename,
					title: mdExport.title,
					artifactId: mdExport.id,
					sessionId: sessionId ?? '',
					messageId: messageId ?? ''
				})
				downloadMarkdownMutation.mutate({ url: safeUrl, filename: mdExport.filename })
			}}
			className="flex w-full items-center gap-3 rounded-lg border border-ai-line bg-ai-surface-card p-3 text-left transition-colors hover:border-ai-action hover:bg-ai-action/5 disabled:cursor-not-allowed disabled:opacity-70"
		>
			<span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-ai-action/10">
				<Icon name="file-text" className="size-5 text-ai-action" />
			</span>
			<span className="flex min-w-0 flex-1 flex-col gap-0.5">
				<span className="m-0 truncate text-sm font-medium text-(--text1)">{mdExport.title}</span>
				<span className="m-0 text-xs text-(--text3)">
					{downloadMarkdownMutation.isPending
						? 'Downloading…'
						: (FILE_TYPE_LABELS[fileExtension(mdExport.filename)] ?? 'File')}
				</span>
				{downloadMarkdownMutation.error ? (
					<span role="alert" className="m-0 text-xs text-error">
						{downloadMarkdownMutation.error.message}
					</span>
				) : null}
			</span>
			<span className="flex shrink-0 items-center gap-1.5 text-ai-action">
				<Icon name="download-paper" className="size-4" />
				<span className="text-sm font-medium">.{fileExtension(mdExport.filename)}</span>
			</span>
		</button>
	)
}
