import type { ExpandedState, SortingState } from '@tanstack/react-table'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import toast from 'react-hot-toast'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { isProtocolListTvlKey } from '~/containers/ProtocolLists/api.types'
import type { CustomColumnDef, TvlSettingsKey } from '~/contexts/LocalStorage'
import { useDebouncedValue } from '~/hooks/useDebounce'
import {
	DEFAULT_PROTOCOL_RANKING_QUERY,
	isProtocolRankingSortKey,
	protocolRankingQuerySignature,
	type ProtocolRankingInitialPage,
	type ProtocolRankingQuery
} from './query'
import type { IProtocol } from './types'
import { useProtocolRankingPages } from './useProtocolRankingPages'

type ExportColumn = { key: string; name: string; formula?: string }

async function fetchProtocolRankingsCsv({
	chain,
	query,
	snapshot,
	columns
}: {
	chain: string
	query: ProtocolRankingQuery
	snapshot: string
	columns: ExportColumn[]
}): Promise<Blob | null> {
	const request = (requestedSnapshot: string) =>
		fetch('/api/dynamic/protocol-rankings/export', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ chain, query, snapshot: requestedSnapshot, columns })
		})
	try {
		let response = await request(snapshot)
		if (response.status === 409) {
			const mismatch = (await response.json()) as { snapshot?: string }
			if (mismatch.snapshot) response = await request(mismatch.snapshot)
		}
		return response.ok ? await response.blob() : null
	} catch {
		return null
	}
}

function downloadBlob(blob: Blob, filename: string) {
	const downloadUrl = window.URL.createObjectURL(blob)
	const link = document.createElement('a')
	link.href = downloadUrl
	link.download = filename
	link.style.display = 'none'
	document.body.appendChild(link)
	link.click()
	link.remove()
	window.URL.revokeObjectURL(downloadUrl)
}

export function useRemoteProtocolRankingsTable({
	enabled,
	chain,
	initialRows,
	initialPage,
	nameSearch,
	minTvl,
	maxTvl,
	sorting,
	customColumns,
	extraTvlsEnabled,
	exportColumns,
	exportFilename
}: {
	enabled: boolean
	chain: string
	initialRows: IProtocol[]
	initialPage?: ProtocolRankingInitialPage
	nameSearch: string
	minTvl: number | null
	maxTvl: number | null
	sorting: SortingState
	customColumns: CustomColumnDef[]
	extraTvlsEnabled: Record<TvlSettingsKey, boolean>
	exportColumns: ExportColumn[]
	exportFilename: string
}) {
	const normalizedSearch = nameSearch.trim()
	const search = useDebouncedValue(normalizedSearch, enabled && normalizedSearch ? 250 : 0)

	const query = useMemo<ProtocolRankingQuery>(() => {
		const sortEntry = sorting[0]
		const sortId = sortEntry?.id ?? DEFAULT_PROTOCOL_RANKING_QUERY.sort
		const customIndex = sortId.startsWith('custom_formula_') ? Number(sortId.slice('custom_formula_'.length)) : -1
		const customColumn = Number.isInteger(customIndex) && customIndex >= 0 ? customColumns[customIndex] : undefined
		return {
			search,
			minTvl,
			maxTvl,
			sort: isProtocolRankingSortKey(sortId) ? sortId : customColumn ? 'custom' : 'tvl',
			order: sortEntry?.desc === false ? 'asc' : 'desc',
			customSort: customColumn
				? {
						formula: customColumn.formula,
						formatType: customColumn.determinedFormat || customColumn.formatType
					}
				: null,
			tvlKeys: Object.keys(extraTvlsEnabled).filter(
				(key) => extraTvlsEnabled[key as TvlSettingsKey] && isProtocolListTvlKey(key)
			)
		}
	}, [customColumns, extraTvlsEnabled, maxTvl, minTvl, search, sorting])

	const fallbackPage: ProtocolRankingInitialPage = initialPage ?? {
		nextCursor: null,
		snapshot: 'local',
		total: initialRows.length,
		hasMore: false,
		availableActivityMetrics: []
	}
	const pages = useProtocolRankingPages({
		chain,
		initialRows,
		initialPage: fallbackPage,
		query,
		enabled
	})
	const querySignature = protocolRankingQuerySignature(query)
	const searchExpanded = useMemo<ExpandedState | null>(() => {
		const normalizedQuery = search.trim().toLowerCase()
		if (!enabled || !normalizedQuery || pages.loadedQuerySignature !== querySignature) return null
		const expanded: Record<string, boolean> = {}
		for (let index = 0; index < pages.rows.length; index++) {
			const row = pages.rows[index]
			if (row?.childProtocols?.length && !row.name.toLowerCase().includes(normalizedQuery)) {
				expanded[row.id ?? `root:${row.slug || index}`] = true
			}
		}
		return expanded
	}, [enabled, pages.loadedQuerySignature, pages.rows, querySignature, search])

	const sentinelRef = useRef<HTMLDivElement>(null)
	const { loadMore } = pages
	useEffect(() => {
		const sentinel = sentinelRef.current
		if (!enabled || !sentinel || !pages.hasMore || pages.error) return
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) void loadMore()
			},
			{ rootMargin: '800px 0px' }
		)
		observer.observe(sentinel)
		return () => observer.disconnect()
	}, [enabled, loadMore, pages.error, pages.hasMore])

	const [csvLoading, setCsvLoading] = useState(false)
	const csvPendingRef = useRef(false)
	const downloadCsv = async () => {
		if (!enabled || csvPendingRef.current) return
		csvPendingRef.current = true
		setCsvLoading(true)
		const blob = await fetchProtocolRankingsCsv({
			chain,
			query,
			snapshot: pages.snapshot,
			columns: exportColumns
		})
		csvPendingRef.current = false
		setCsvLoading(false)
		if (blob) downloadBlob(blob, exportFilename)
		else toast.error('Failed to download CSV')
	}

	return {
		...pages,
		query,
		search,
		searchExpanded,
		sentinelRef,
		csvButton: enabled ? <CSVDownloadButton onClick={downloadCsv} isLoading={csvLoading} smol size="md" /> : null
	}
}

export function RemoteProtocolRankingsStatus({
	sentinelRef,
	error,
	isReplacing,
	isLoadingMore,
	rowCount,
	total,
	hasMore,
	retry
}: {
	sentinelRef: RefObject<HTMLDivElement | null>
	error: 'replace' | 'append' | null
	isReplacing: boolean
	isLoadingMore: boolean
	rowCount: number
	total: number
	hasMore: boolean
	retry?: () => Promise<void>
}) {
	return (
		<div
			ref={sentinelRef}
			role="status"
			aria-live="polite"
			className="flex min-h-8 items-center justify-center px-3 py-4 text-xs text-tertiary"
		>
			{error ? (
				<>
					Couldn't {error === 'replace' ? 'update rankings' : 'load more protocols'}.
					<button type="button" className="ml-1 underline" onClick={() => void retry?.()}>
						Retry
					</button>
				</>
			) : isReplacing ? (
				'Updating rankings…'
			) : isLoadingMore ? (
				`Loading more protocols… ${rowCount} of ${total}`
			) : hasMore ? (
				`${rowCount} of ${total} protocols`
			) : (
				`${total} protocols`
			)}
		</div>
	)
}
