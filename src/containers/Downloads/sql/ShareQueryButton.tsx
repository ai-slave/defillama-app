import { useState } from 'react'
import toast from 'react-hot-toast'
import { Icon } from '~/ui/Icon'
import { formatNumber } from '~/utils/numberFormat'
import type { QueryTableRef } from '../savedDownloads'
import { extractQueryConfig } from '../savedDownloads'
import { buildNotebookShareUrl, buildShareUrl, type NotebookShareCell } from '../urlState'
import type { ChartConfig } from './chartConfig'

interface ShareQueryButtonProps {
	sql: string
	tables: Array<QueryTableRef>
	chartConfig?: ChartConfig
	disabled?: boolean
	mode?: 'query' | 'notebook'
	notebookCells?: Array<NotebookShareCell>
	notebookTitle?: string
}

const MAX_SAFE_URL_LENGTH = 7500

export function ShareQueryButton({
	sql,
	tables,
	chartConfig,
	disabled,
	mode = 'query',
	notebookCells = [],
	notebookTitle
}: ShareQueryButtonProps) {
	const [copied, setCopied] = useState(false)

	const isNotebook = mode === 'notebook'
	const hasContent = isNotebook ? notebookCells.some((c) => c.source.trim()) : !!sql.trim()

	// Both are value blocks, which the compiler cannot lower inside a try or catch. Building the link is
	// called out to so a failure there is still caught; the message does not depend on anything in the
	// try, so it is computed before it.
	const buildShareLink = () => {
		const url = isNotebook
			? buildNotebookShareUrl(window.location.origin, '/downloads', { title: notebookTitle, cells: notebookCells })
			: buildShareUrl(window.location.origin, '/downloads', extractQueryConfig({ sql, tables, chartConfig }))
		return url.includes('mode=sql') ? url : `${url}${url.includes('?') ? '&' : '?'}mode=sql`
	}
	const copiedMessage = isNotebook ? 'Notebook link copied' : 'Share link copied'

	const onClick = async () => {
		try {
			const withMode = buildShareLink()
			if (withMode.length > MAX_SAFE_URL_LENGTH) {
				toast(
					(t) => (
						<span>
							Link is long ({formatNumber(withMode.length)} chars) — some apps may truncate it.
							<button type="button" onClick={() => toast.dismiss(t.id)} style={{ marginLeft: 8 }}>
								OK
							</button>
						</span>
					),
					{ duration: 4000 }
				)
			}
			await navigator.clipboard.writeText(withMode)
			setCopied(true)
			toast.success(copiedMessage)
			setTimeout(() => setCopied(false), 1500)
		} catch {
			toast.error('Could not copy link')
		}
	}

	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled || !hasContent}
			className="inline-flex items-center gap-1.5 rounded-md border border-subtle bg-surface px-3 py-1.5 text-xs font-medium text-pro-text-primary transition-colors hover:bg-hover-row disabled:cursor-not-allowed disabled:opacity-40"
		>
			<Icon name={copied ? 'check' : 'share'} className="size-3.5" />
			{copied ? 'Copied' : 'Share'}
		</button>
	)
}
