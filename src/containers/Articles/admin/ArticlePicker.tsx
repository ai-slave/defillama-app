import * as Ariakit from '@ariakit/react'
import { useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useAuthContext } from '~/auth'
import { listArticles, type ArticleListResponse } from '~/containers/Articles/api'
import type { ArticleDocument } from '~/containers/Articles/types'
import { ARTICLE_SECTION_LABELS } from '~/containers/Articles/types'
import { Button } from '~/ui/Button'
import { keepFocus } from '~/ui/focus'
import { ListLoading, NoResults } from '~/ui/NoResults'
import { ComboboxSurface, PopoverRow } from '~/ui/PopoverSurface'
import { SearchField } from '~/ui/SearchField'

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
	listArticlesParams?: Partial<ListArticlesParams>
}

export function ArticlePicker({ value, onChange, hint, listArticlesParams }: Props) {
	const { authorizedFetch } = useAuthContext()
	const [searchValue, setSearchValue] = useState('')
	const [open, setOpen] = useState(false)
	const inputRef = useRef<HTMLInputElement>(null)
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
				<SearchField
					combobox
					ref={inputRef}
					label="Search articles by title"
					placeholder={selectedLabel ? selectedLabel : 'Search articles by title…'}
					autoSelect
				/>
				<ComboboxSurface variant="search-results" sameWidth maxHeight="md">
					{isFetching && items.length === 0 ? <ListLoading label="Searching" /> : null}
					{!isFetching && items.length === 0 ? <NoResults>No results</NoResults> : null}
					{items.map((article) => (
						<PopoverRow
							key={article.id}
							onClick={() => {
								setTitles((prev) =>
									prev[article.id] === article.title ? prev : { ...prev, [article.id]: article.title }
								)
								setSearchValue('')
								onChange(article)
								setOpen(false)
							}}
							render={<Ariakit.ComboboxItem value={article.title} setValueOnClick={false} />}
						>
							<span className="grid min-w-0 gap-0.5">
								<span className="truncate">{article.title}</span>
								<span className="label-xs tracking-[0.16em] text-tertiary uppercase">
									{article.section ? ARTICLE_SECTION_LABELS[article.section] : 'No section'} · /{article.slug}
								</span>
							</span>
						</PopoverRow>
					))}
				</ComboboxSurface>
			</Ariakit.ComboboxProvider>
			{value ? (
				<div className="flex items-center gap-2">
					{selectedLabel ? (
						<p className="min-w-0 label-xs tracking-[0.16em] text-tertiary uppercase">
							Selected: <span className="tracking-normal text-secondary normal-case">{selectedLabel}</span>
						</p>
					) : null}
					{/* The search field's × clears the typed text; this clears the pick. */}
					<Button
						type="button"
						variant="link"
						className="ml-auto"
						onClick={() =>
							keepFocus(
								() => onChange(null),
								() => inputRef.current
							)
						}
					>
						Clear selection
					</Button>
				</div>
			) : null}
			{hint ? <p className="body-sm text-tertiary">{hint}</p> : null}
		</div>
	)
}
