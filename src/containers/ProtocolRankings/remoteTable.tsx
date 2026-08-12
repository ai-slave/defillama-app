import type { ExpandedState, SortingState } from '@tanstack/react-table'
import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { isProtocolListTvlKey } from '~/containers/ProtocolLists/api.types'
import type { CustomColumnDef, TvlSettingsKey } from '~/contexts/LocalStorage'
import { useDebouncedValue } from '~/hooks/useDebounce'
import { useTablePages, type TablePageRequestResult } from '~/hooks/useTablePages'
import {
	DEFAULT_PROTOCOL_RANKING_QUERY,
	PROTOCOL_RANKINGS_LIMITS,
	isProtocolRankingSortKey,
	protocolRankingQuery,
	type ProtocolRankingInitialPage,
	type ProtocolRankingPage,
	type ProtocolRankingQuery
} from './tableQuery'
import type { IProtocol } from './types'

type ExportColumn = { key: string; name: string; formula?: string }

/** Wire page (public contract: `snapshot`) widened with the kernel's `version`. */
type RankingPage = ProtocolRankingPage<IProtocol> & { version: string }

export function buildProtocolRankingApiUrl({
	chain,
	query,
	snapshot,
	cursor
}: {
	chain: string
	query: ProtocolRankingQuery
	snapshot: string | null | undefined
	cursor: string | null | undefined
}): string {
	const params = new URLSearchParams({
		chain,
		sort: query.sort,
		order: query.order,
		limit: String(PROTOCOL_RANKINGS_LIMITS.page)
	})
	if (query.search) params.set('search', query.search)
	if (query.minTvl !== null) params.set('minTvl', String(query.minTvl))
	if (query.maxTvl !== null) params.set('maxTvl', String(query.maxTvl))
	if (query.tvlKeys.length) params.set('tvlKeys', query.tvlKeys.join(','))
	if (query.sort === 'custom' && query.customSort) {
		params.set('customFormula', query.customSort.formula)
		params.set('customFormat', query.customSort.formatType)
	}
	if (snapshot) params.set('snapshot', snapshot)
	if (cursor) params.set('cursor', cursor)
	return `/api/public/protocol-rankings?${params.toString()}`
}

async function fetchProtocolRankingsCsv({
	chain,
	query,
	snapshot,
	columns,
	signal
}: {
	chain: string
	query: ProtocolRankingQuery
	snapshot: string
	columns: ExportColumn[]
	signal: AbortSignal
}): Promise<Blob | null> {
	const request = (requestedSnapshot: string) =>
		fetch('/api/dynamic/protocol-rankings/export', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ chain, query, snapshot: requestedSnapshot, columns }),
			signal
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
	exportFilename,
	onRequestSettled
}: {
	enabled: boolean
	chain: string
	initialRows: IProtocol[]
	initialPage: ProtocolRankingInitialPage | undefined
	nameSearch: string
	minTvl: number | null
	maxTvl: number | null
	sorting: SortingState
	customColumns: CustomColumnDef[]
	extraTvlsEnabled: Record<TvlSettingsKey, boolean>
	exportColumns: ExportColumn[]
	exportFilename: string
	onRequestSettled?: (result: TablePageRequestResult) => void
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
	const querySignature = protocolRankingQuery.signature(query)
	const pages = useTablePages<IProtocol, RankingPage>({
		mode: 'cursor',
		enabled,
		sourceKey: `${chain}:${fallbackPage.snapshot}`,
		initialRows,
		initialPage: { ...fallbackPage, version: fallbackPage.snapshot },
		querySignature,
		defaultQuerySignature: protocolRankingQuery.signature(DEFAULT_PROTOCOL_RANKING_QUERY),
		getRowKey: (row) => row.id ?? row.slug,
		buildPageUrl: ({ version, cursor }) => buildProtocolRankingApiUrl({ chain, query, snapshot: version, cursor }),
		onRequestSettled,
		parsePage: (json) => {
			const page = json as ProtocolRankingPage<IProtocol>
			return { ...page, version: page.snapshot }
		}
	})
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

	const [csvLoading, setCsvLoading] = useState(false)
	const csvPendingRef = useRef(false)
	const csvAbortRef = useRef<AbortController | null>(null)
	useEffect(() => () => csvAbortRef.current?.abort(), [])
	const downloadCsv = async () => {
		if (!enabled || csvPendingRef.current) return
		csvPendingRef.current = true
		setCsvLoading(true)
		const controller = new AbortController()
		csvAbortRef.current = controller
		const blob = await fetchProtocolRankingsCsv({
			chain,
			query,
			snapshot: pages.version,
			columns: exportColumns,
			signal: controller.signal
		})
		csvPendingRef.current = false
		// Unmounted mid-download: skip state updates and the browser download.
		if (controller.signal.aborted) return
		setCsvLoading(false)
		if (blob) downloadBlob(blob, exportFilename)
		else toast.error('Failed to download CSV')
	}

	return {
		...pages,
		query,
		search,
		searchExpanded,
		csvButton: enabled ? <CSVDownloadButton onClick={downloadCsv} isLoading={csvLoading} smol size="md" /> : null
	}
}
