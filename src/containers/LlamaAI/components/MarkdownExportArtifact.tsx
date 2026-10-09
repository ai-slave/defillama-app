import * as Ariakit from '@ariakit/react'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { getOwnRegistryValue } from '~/containers/LlamaAI/utils/getOwnRegistryValue'
import { sanitizeUrl } from '~/containers/LlamaAI/utils/markdownHelpers'
import { Button } from '~/ui/Button'
import { focusRegionOnLeave } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { InlineStatus } from '~/ui/Status'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { ArtifactCard } from './messages/ArtifactCard'

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
}

export function MarkdownExportArtifact({ mdExport, sessionId, messageId }: MarkdownExportArtifactProps) {
	const safeUrl = sanitizeUrl(mdExport.url)
	// The error stays up while a retry runs (mutation.error clears when it starts), so the retry keeps focus.
	const [failed, setFailed] = useState(false)
	const downloadMarkdownMutation = useMutation({
		mutationFn: downloadMarkdownFile,
		onError: () => setFailed(true),
		onSuccess: () => setFailed(false)
	})

	if (!safeUrl) return null

	const download = () => {
		trackUmamiEvent('llamaai-download', {
			kind: 'artifact-md',
			filename: mdExport.filename,
			title: mdExport.title,
			artifactId: mdExport.id,
			sessionId: sessionId ?? '',
			messageId: messageId ?? ''
		})
		downloadMarkdownMutation.mutate({ url: safeUrl, filename: mdExport.filename })
	}

	return (
		<div className="flex flex-col gap-2">
			<ArtifactCard
				as={Ariakit.Button}
				icon="file-text"
				title={mdExport.title}
				meta={
					downloadMarkdownMutation.isPending
						? 'Downloading…'
						: (getOwnRegistryValue(FILE_TYPE_LABELS, fileExtension(mdExport.filename)) ?? 'File')
				}
				trailing={
					<span className="flex shrink-0 items-center gap-1 label-sm text-link">
						<Icon name="download-paper" className="size-3.5" />.{fileExtension(mdExport.filename)}
					</span>
				}
				disabled={downloadMarkdownMutation.isPending}
				accessibleWhenDisabled
				aria-busy={downloadMarkdownMutation.isPending || undefined}
				onClick={download}
				className="w-full"
			/>
			{failed ? (
				<InlineStatus
					variant="error"
					action={
						<Button
							type="button"
							size="sm"
							// The retry leaves once the download succeeds; the message region keeps focus.
							ref={focusRegionOnLeave}
							onClick={download}
							pendingLabel={downloadMarkdownMutation.isPending ? 'Retrying…' : null}
						>
							Try again
						</Button>
					}
				>
					Couldn&rsquo;t download this file.
				</InlineStatus>
			) : null}
		</div>
	)
}
