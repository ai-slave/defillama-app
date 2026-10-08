import toast from 'react-hot-toast'
import { Button } from '~/ui/Button'
import { useCopy } from '~/ui/Copy'
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

const EMPTY_NOTEBOOK_CELLS: NonNullable<ShareQueryButtonProps['notebookCells']> = []

export function ShareQueryButton({
	sql,
	tables,
	chartConfig,
	disabled,
	mode = 'query',
	notebookCells = EMPTY_NOTEBOOK_CELLS,
	notebookTitle
}: ShareQueryButtonProps) {
	const { copied, copy } = useCopy()

	const isNotebook = mode === 'notebook'
	const hasContent = isNotebook ? notebookCells.some((c) => c.source.trim()) : !!sql.trim()

	// A value block, which the compiler cannot lower inside a try or catch. Building the link is called
	// out to so a failure there is still caught.
	const buildShareLink = () => {
		const url = isNotebook
			? buildNotebookShareUrl(window.location.origin, '/downloads', { title: notebookTitle, cells: notebookCells })
			: buildShareUrl(window.location.origin, '/downloads', extractQueryConfig({ sql, tables, chartConfig }))
		return url.includes('mode=sql') ? url : `${url}${url.includes('?') ? '&' : '?'}mode=sql`
	}
	const onClick = () => {
		try {
			const withMode = buildShareLink()
			if (withMode.length > MAX_SAFE_URL_LENGTH) {
				toast(`Link is long (${formatNumber(withMode.length)} chars) — some apps may truncate it.`, { duration: 4000 })
			}
			void copy(withMode)
		} catch {
			toast.error('Could not copy link')
		}
	}

	return (
		<Button variant="secondary" size="md" onClick={onClick} disabled={disabled || !hasContent}>
			<Icon name={copied ? 'check' : 'share'} className="size-3.5" />
			{copied ? 'Copied' : 'Share'}
		</Button>
	)
}
