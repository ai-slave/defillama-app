import { useMutation } from '@tanstack/react-query'
import { getOwnRegistryValue } from '~/containers/LlamaAI/utils/getOwnRegistryValue'
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

const FILE_TYPE_LABELS = {
	md: 'Markdown file',
	xlsx: 'Excel workbook',
	docx: 'Word document',
	pptx: 'PowerPoint deck'
} satisfies Record<string, string>

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
			className="flex w-full items-center gap-3 rounded-lg border border-subtle bg-surface p-3 text-left not-disabled:not-aria-disabled:hover:bg-hover-row disabled:cursor-not-allowed disabled:opacity-60"
		>
			<span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-muted">
				<Icon name="file-text" className="size-5 text-link-on-tint" />
			</span>
			<span className="flex min-w-0 flex-1 flex-col gap-0.5">
				<span className="m-0 truncate label-md text-primary">{mdExport.title}</span>
				<span className="m-0 body-sm text-secondary">
					{downloadMarkdownMutation.isPending
						? 'Downloading…'
						: (getOwnRegistryValue(FILE_TYPE_LABELS, fileExtension(mdExport.filename)) ?? 'File')}
				</span>
				{downloadMarkdownMutation.error ? (
					<span role="alert" className="m-0 body-sm text-error">
						{downloadMarkdownMutation.error.message}
					</span>
				) : null}
			</span>
			<span className="flex shrink-0 items-center gap-1 label-sm text-link">
				<Icon name="download-paper" className="size-3.5" />.{fileExtension(mdExport.filename)}
			</span>
		</button>
	)
}
