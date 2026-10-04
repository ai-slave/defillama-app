import * as Ariakit from '@ariakit/react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuthContext } from '~/auth'
import { listArticles, type ArticleListResponse } from '~/containers/Articles/api'
import type { ArticleDocument } from '~/containers/Articles/types'
import { ARTICLE_SECTION_LABELS } from '~/containers/Articles/types'
import { Icon } from '~/ui/Icon'
import { popoverMeasuredRowStyles } from '~/ui/Popover'
import { ComboboxSurface } from '~/ui/PopoverSurface'

type ListArticlesParams = NonNullable<Parameters<typeof listArticles>[0]>
const EMPTY_ARTICLE_DOCUMENTS: Array<ArticleDocument> = []

function mergeTitles(
	titles: Record<string, string>,
	...sources: Array<Array<ArticleDocument> | undefined>
): Record<string, string> {
	let merged = titles
	for (const source of sources) {
		for (const article of source ?? []) {
			if (merged[article.id] === article.title) continue
			if (merged === titles) merged = { ...titles }
			merged[article.id] = article.title
		}
	}
	return merged
}

type Props = {
	value: string | null
	onChange: (article: ArticleDocument | null) => void
	hint?: string
	error?: string | null
	listArticlesParams?: Partial<ListArticlesParams>
}

export function ArticlePicker({ value, onChange, hint, error, listArticlesParams }: Props) {
	const { authorizedFetch } = useAuthContext()
	const [searchValue, setSearchValue] = useState('')
	const [open, setOpen] = useState(false)
	// Every title seen (search results, the resolved selection, a pick) stays known by id, so the selected
	// article keeps its label through later search changes and failed lookups.
	const [titles, setTitles] = useState<Record<string, string>>({})

	const trimmed = searchValue.trim()

	const { data: results, isFetching } = useQuery<ArticleListResponse>({
		queryKey: ['research', 'admin', 'article-picker', trimmed, listArticlesParams],
		queryFn: () =>
			listArticles({ query: trimmed || undefined, limit: 20, sort: 'newest', ...listArticlesParams }, authorizedFetch),
		retry: false,
		staleTime: 30_000,
		enabled: open
	})

	const items = results?.items ?? EMPTY_ARTICLE_DOCUMENTS

	const selectedQuery = useQuery<ArticleDocument | null>({
		queryKey: ['research', 'admin', 'article-picker', 'selected', value, listArticlesParams],
		queryFn: async () => {
			if (!value) return null
			const matched = items.find((item) => item.id === value)
			if (matched) return matched
			const fallback = await listArticles({ limit: 50, sort: 'newest', ...listArticlesParams }, authorizedFetch)
			return fallback.items.find((item) => item.id === value) ?? null
		},
		enabled: !!value && !titles[value],
		retry: false,
		staleTime: 60_000
	})

	const [seen, setSeen] = useState({ items, resolved: selectedQuery.data })
	if (seen.items !== items || seen.resolved !== selectedQuery.data) {
		setSeen({ items, resolved: selectedQuery.data })
		setTitles(mergeTitles(titles, items, selectedQuery.data ? [selectedQuery.data] : undefined))
	}
	const selectedLabel = value ? (titles[value] ?? '') : ''

	return (
		<div className="grid gap-1.5">
			<Ariakit.ComboboxProvider
				open={open}
				setOpen={setOpen}
				setInputValue={(next) => setSearchValue(next)}
				resetValueOnHide
			>
				<div
					className={`relative flex items-center rounded-md border bg-page ${error ? 'border-error/60' : 'border-medium focus-within:border-link/60'}`}
				>
					<Icon name="search" height={14} width={14} className="absolute left-3 text-tertiary" />
					<Ariakit.Combobox
						placeholder={selectedLabel ? selectedLabel : 'Search articles by title…'}
						autoSelect
						className="min-h-10 w-full rounded-md bg-transparent px-3 py-2 pr-9 pl-9 text-sm text-primary outline-hidden placeholder:text-tertiary"
					/>
					{value ? (
						<button
							type="button"
							onClick={() => {
								setSearchValue('')
								onChange(null)
							}}
							aria-label="Clear selection"
							className="absolute right-2 flex size-6 items-center justify-center rounded-md text-tertiary transition-colors hover:bg-research-tint-hover hover:text-primary"
						>
							<Icon name="x" height={12} width={12} />
						</button>
					) : null}
				</div>
				<ComboboxSurface
					variant="search-results"
					sameWidth
					className="max-h-[min(288px,var(--popover-available-height))]"
				>
					{isFetching && items.length === 0 ? (
						<p className="p-3 text-center text-xs text-tertiary">Searching…</p>
					) : null}
					{!isFetching && items.length === 0 ? (
						<p className="p-3 text-center text-xs text-tertiary">No results</p>
					) : null}
					{items.map((article) => (
						<Ariakit.ComboboxItem
							key={article.id}
							value={article.title}
							setValueOnClick={false}
							onClick={() => {
								setTitles((prev) =>
									prev[article.id] === article.title ? prev : { ...prev, [article.id]: article.title }
								)
								setSearchValue('')
								onChange(article)
								setOpen(false)
							}}
							className={popoverMeasuredRowStyles}
						>
							<span className="grid min-w-0 gap-0.5">
								<span className="truncate">{article.title}</span>
								<span className="font-jetbrains text-[10px] tracking-[0.16em] text-tertiary uppercase">
									{article.section ? ARTICLE_SECTION_LABELS[article.section] : 'No section'} · /{article.slug}
								</span>
							</span>
						</Ariakit.ComboboxItem>
					))}
				</ComboboxSurface>
			</Ariakit.ComboboxProvider>
			{value && selectedLabel ? (
				<p className="font-jetbrains text-[10px] tracking-[0.16em] text-tertiary uppercase">
					Selected: <span className="tracking-normal text-secondary normal-case">{selectedLabel}</span>
				</p>
			) : null}
			{hint ? <p className="text-xs text-tertiary">{hint}</p> : null}
			{error ? <p className="text-xs text-error">{error}</p> : null}
		</div>
	)
}
