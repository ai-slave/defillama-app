import * as Ariakit from '@ariakit/react'
import { useQuery } from '@tanstack/react-query'
import { type Ref, useMemo, useRef, useState } from 'react'
import { useDebouncedValue } from '~/hooks/useDebounce'
import { Button } from '~/ui/Button'
import { focusNeighborOnLeave } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Logo } from '~/ui/Logo'
import { ListLoading, NoResults } from '~/ui/NoResults'
import { ComboboxSurface, PopoverRow } from '~/ui/PopoverSurface'
import { SearchField } from '~/ui/SearchField'
import { ErrorLine } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import { geckoTokenIconUrl } from '~/utils/icons'
import type { PageAssetSearchHit } from '../pageAssetMarket'
import type { ArticlePageAsset } from '../types'

const MAX_PAGE_ASSETS = 12

export function ArticlePageAssetPicker({
	value,
	onChange
}: {
	value: Array<ArticlePageAsset>
	onChange: (next: Array<ArticlePageAsset>) => void
}) {
	const [searchValue, setSearchValue] = useState('')
	const [open, setOpen] = useState(false)
	const debouncedQuery = useDebouncedValue(searchValue.trim(), 200)
	const atLimit = value.length >= MAX_PAGE_ASSETS
	const selectedIds = useMemo(() => new Set(value.map((asset) => asset.geckoId)), [value])

	const {
		data: results,
		isFetching,
		isError
	} = useQuery({
		queryKey: ['research', 'page-asset-search', debouncedQuery],
		queryFn: async ({ signal }) => {
			const res = await fetch(`/api/public/research/page-assets/search?q=${encodeURIComponent(debouncedQuery)}`, {
				signal
			})
			if (!res.ok) throw new Error('Asset search failed')
			const json = await res.json()
			return (json?.results ?? []) as Array<PageAssetSearchHit>
		},
		enabled: open && debouncedQuery.length > 0 && !atLimit,
		retry: false,
		staleTime: 60_000
	})

	const hits = useMemo(
		() => (results ?? []).filter((hit) => !selectedIds.has(hit.geckoId)).slice(0, 12),
		[results, selectedIds]
	)

	const searchRef = useRef<HTMLInputElement>(null)
	// The search lists only tokens not picked yet, and closes at the limit.
	const addAsset = (hit: PageAssetSearchHit) => {
		onChange([...value, { geckoId: hit.geckoId, symbol: hit.symbol, name: hit.name }])
		setSearchValue('')
	}
	// The edge rows' moves are disabled, so the target always exists.
	const moveAsset = (index: number, direction: -1 | 1) => {
		const target = index + direction
		const next = value.slice()
		;[next[index], next[target]] = [next[target], next[index]]
		onChange(next)
	}

	return (
		<div className="grid gap-2">
			<p className="-mt-1 body-sm text-tertiary">
				Pick the tokens this article covers. Live price and 24h change render in the sidebar — only the token identity
				is saved.
			</p>

			<Ariakit.ComboboxProvider
				open={open && !atLimit}
				setOpen={setOpen}
				inputValue={searchValue}
				setInputValue={setSearchValue}
				resetValueOnHide
			>
				<SearchField
					combobox
					ref={searchRef}
					label="Search tokens to add"
					placeholder={atLimit ? `Limit reached (max ${MAX_PAGE_ASSETS})` : 'Search a token by symbol or name…'}
					disabled={atLimit}
					autoSelect
				/>
				<ComboboxSurface variant="search-results" sameWidth maxHeight="md">
					{isFetching && hits.length === 0 ? <ListLoading label="Searching" /> : null}
					{!isFetching && isError ? (
						<ErrorLine inset="menuRow">Couldn&apos;t search tokens. Edit the search to try again.</ErrorLine>
					) : !isFetching && debouncedQuery.length > 0 && hits.length === 0 ? (
						<NoResults>No tokens found</NoResults>
					) : null}
					{hits.map((hit) => (
						<PopoverRow
							key={hit.geckoId}
							onClick={() => addAsset(hit)}
							render={<Ariakit.ComboboxItem value={hit.geckoId} setValueOnClick={false} />}
						>
							<span className="flex min-w-0 items-center gap-2">
								<Logo src={hit.image ?? geckoTokenIconUrl(`coingecko:${hit.geckoId}`)} size={20} alt={hit.symbol} />
								<span className="label-md text-primary">{hit.symbol}</span>
								<span className="truncate body-sm text-tertiary">{hit.name}</span>
							</span>
						</PopoverRow>
					))}
				</ComboboxSurface>
			</Ariakit.ComboboxProvider>

			{value.length > 0 ? (
				<ul className="m-0 grid list-none gap-2 p-0">
					{value.map((asset, index) => (
						<li
							key={asset.geckoId}
							data-row
							className="flex items-center gap-2 rounded-lg border border-subtle bg-page px-3 py-2"
						>
							<Logo src={geckoTokenIconUrl(`coingecko:${asset.geckoId}`)} size={20} alt={asset.symbol} />
							<div className="flex min-w-0 flex-col">
								<span className="label-md text-primary">{asset.symbol}</span>
								<span className="truncate body-sm text-tertiary">{asset.name}</span>
							</div>
							{/* Always visible: a remove that appears on hover never appears on a touch screen. */}
							<div className="ml-auto flex items-center gap-1">
								<RowAction
									tip="Move up"
									label={`Move ${asset.symbol} up`}
									icon="chevron-up"
									disabled={index === 0}
									onClick={() => moveAsset(index, -1)}
								/>
								<RowAction
									tip="Move down"
									label={`Move ${asset.symbol} down`}
									icon="chevron-down"
									disabled={index === value.length - 1}
									onClick={() => moveAsset(index, 1)}
								/>
								<RowAction
									tip="Remove"
									label={`Remove ${asset.symbol}`}
									icon="x"
									ref={focusNeighborOnLeave(() => searchRef.current)}
									onClick={() => onChange(value.filter((_, i) => i !== index))}
								/>
							</div>
						</li>
					))}
				</ul>
			) : (
				<NoResults>No assets yet. Search above to add the tokens this article covers.</NoResults>
			)}
		</div>
	)
}

function RowAction({
	tip,
	label,
	icon,
	disabled = false,
	ref,
	onClick
}: {
	tip: string
	label: string
	icon: 'chevron-up' | 'chevron-down' | 'x'
	disabled?: boolean
	ref?: Ref<HTMLButtonElement>
	onClick: () => void
}) {
	return (
		<Tooltip
			content={tip}
			render={
				<Button
					type="button"
					variant="ghost"
					size="sm"
					square
					// A move that reaches the edge disables the button it was made with, which keeps focus.
					disabled={disabled}
					accessibleWhenDisabled
					aria-label={label}
					ref={ref}
					onClick={onClick}
				/>
			}
		>
			<Icon name={icon} className="size-4" aria-hidden="true" />
		</Tooltip>
	)
}
