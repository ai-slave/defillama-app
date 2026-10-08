import * as Ariakit from '@ariakit/react'
import { useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useAuthContext } from '~/auth'
import { listArticles, type ArticleListResponse } from '~/containers/Articles/api'
import type { ArticleDocument } from '~/containers/Articles/types'
import { ARTICLE_SECTION_LABELS } from '~/containers/Articles/types'
import { Button } from '~/ui/Button'
import { keepFocus, neighbourRowControl } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { popoverMeasuredRowStyles } from '~/ui/Popover'
import { ComboboxSurface } from '~/ui/PopoverSurface'
import { Tooltip } from '~/ui/Tooltip'

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
	value: Array<string>
	onChange: (ids: Array<string>) => void
	hint?: string
	listArticlesParams?: Partial<ListArticlesParams>
}

export function ArticleMultiPicker({ value, onChange, hint, listArticlesParams }: Props) {
	const { authorizedFetch } = useAuthContext()
	const [searchValue, setSearchValue] = useState('')
	const [open, setOpen] = useState(false)
	const [titles, setTitles] = useState<Record<string, string>>({})

	const trimmed = searchValue.trim()

	const { data: results, isFetching } = useQuery<ArticleListResponse>({
		queryKey: ['research', 'admin', 'article-multi-picker', trimmed, listArticlesParams],
		queryFn: () =>
			listArticles({ query: trimmed || undefined, limit: 20, sort: 'newest', ...listArticlesParams }, authorizedFetch),
		retry: false,
		staleTime: 30_000,
		enabled: open
	})

	const items = results?.items ?? EMPTY_ARTICLE_DOCUMENTS

	const hasUnresolved = value.some((id) => !titles[id])
	const resolveQuery = useQuery<Array<ArticleDocument>>({
		queryKey: ['research', 'admin', 'article-multi-picker', 'resolve', value, listArticlesParams],
		queryFn: async () => {
			const fallback = await listArticles({ limit: 100, sort: 'newest', ...listArticlesParams }, authorizedFetch)
			return fallback.items
		},
		enabled: hasUnresolved,
		retry: false,
		staleTime: 60_000
	})

	// Every title seen in search results or resolved ids stays known, so a selection keeps its label through
	// later value changes and failed lookups. Fresh data still updates a title.
	const [seen, setSeen] = useState({ items, resolved: resolveQuery.data })
	if (seen.items !== items || seen.resolved !== resolveQuery.data) {
		setSeen({ items, resolved: resolveQuery.data })
		setTitles(mergeTitles(titles, items, resolveQuery.data))
	}

	const addArticle = (article: ArticleDocument) => {
		setTitles((prev) => ({ ...prev, [article.id]: article.title }))
		setSearchValue('')
		setOpen(false)
		if (value.includes(article.id)) return
		onChange([...value, article.id])
	}

	const inputRef = useRef<HTMLInputElement>(null)

	return (
		<div className="grid gap-2">
			<Ariakit.ComboboxProvider
				open={open}
				setOpen={setOpen}
				setInputValue={(next) => setSearchValue(next)}
				resetValueOnHide
			>
				<div className="relative flex items-center rounded-md border border-medium bg-page">
					<Icon name="search" height={14} width={14} className="absolute left-3 text-tertiary" />
					<Ariakit.Combobox
						ref={inputRef}
						placeholder="Search articles by title…"
						autoSelect
						className="min-h-10 w-full rounded-md bg-transparent px-3 py-2 pr-3 pl-9 text-sm text-primary placeholder:text-tertiary"
					/>
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
					{items.map((article) => {
						const selected = value.includes(article.id)
						return (
							<Ariakit.ComboboxItem
								key={article.id}
								value={article.title}
								setValueOnClick={false}
								onClick={() => addArticle(article)}
								className={popoverMeasuredRowStyles}
							>
								<span className="grid min-w-0 gap-0.5">
									<span className="truncate">{article.title}</span>
									<span className="font-jetbrains text-[10px] tracking-[0.16em] text-tertiary uppercase">
										{article.section ? ARTICLE_SECTION_LABELS[article.section] : 'No section'} · /{article.slug}
									</span>
								</span>
								{selected ? <Icon name="check" height={14} width={14} className="shrink-0 text-link" /> : null}
							</Ariakit.ComboboxItem>
						)
					})}
				</ComboboxSurface>
			</Ariakit.ComboboxProvider>

			{value.length > 0 ? (
				<div className="flex flex-wrap gap-2">
					{value.map((id) => (
						<span
							key={id}
							className="inline-flex max-w-full items-center gap-0.5 rounded-md border border-medium bg-surface pl-2.5 body-sm text-primary"
						>
							<span className="truncate">{titles[id] ?? id}</span>
							<Tooltip
								content="Remove"
								render={
									<Button
										variant="ghost"
										size="sm"
										square
										aria-label={`Remove ${titles[id] ?? 'article'}`}
										onClick={(event) => {
											// The chip takes its button with it: the next chip's takes focus, else the search field.
											const next = neighbourRowControl(event.currentTarget.parentElement!, event.currentTarget)
											keepFocus(
												() => onChange(value.filter((entry) => entry !== id)),
												() => next ?? inputRef.current
											)
										}}
									/>
								}
							>
								<Icon name="x" className="size-4" />
							</Tooltip>
						</span>
					))}
				</div>
			) : null}
			{hint ? <p className="body-sm text-tertiary">{hint}</p> : null}
		</div>
	)
}
