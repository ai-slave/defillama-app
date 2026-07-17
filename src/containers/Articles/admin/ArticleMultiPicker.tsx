import * as Ariakit from '@ariakit/react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Icon } from '~/components/Icon'
import { listArticles, type ArticleListResponse } from '~/containers/Articles/api'
import type { ArticleDocument } from '~/containers/Articles/types'
import { ARTICLE_SECTION_LABELS } from '~/containers/Articles/types'
import { useAuthContext } from '~/containers/Subscription/auth'

type ListArticlesParams = NonNullable<Parameters<typeof listArticles>[0]>

type Props = {
	value: string[]
	onChange: (ids: string[]) => void
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

	const items = useMemo<ArticleDocument[]>(() => results?.items ?? [], [results])

	const hasUnresolved = value.some((id) => !titles[id])
	const resolveQuery = useQuery<ArticleDocument[]>({
		queryKey: ['research', 'admin', 'article-multi-picker', 'resolve', value, listArticlesParams],
		queryFn: async () => {
			const fallback = await listArticles({ limit: 100, sort: 'newest', ...listArticlesParams }, authorizedFetch)
			return fallback.items
		},
		enabled: hasUnresolved,
		retry: false,
		staleTime: 60_000
	})

	useEffect(() => {
		const incoming: Record<string, string> = {}
		for (const article of items) incoming[article.id] = article.title
		if (resolveQuery.data) for (const article of resolveQuery.data) incoming[article.id] = article.title
		if (Object.keys(incoming).length === 0) return
		setTitles((prev) => {
			let changed = false
			const merged = { ...prev }
			for (const [id, title] of Object.entries(incoming)) {
				if (merged[id] !== title) {
					merged[id] = title
					changed = true
				}
			}
			return changed ? merged : prev
		})
	}, [items, resolveQuery.data])

	const addArticle = (article: ArticleDocument) => {
		setTitles((prev) => ({ ...prev, [article.id]: article.title }))
		setSearchValue('')
		setOpen(false)
		if (value.includes(article.id)) return
		onChange([...value, article.id])
	}

	const removeArticle = (id: string) => {
		onChange(value.filter((entry) => entry !== id))
	}

	return (
		<div className="grid gap-2">
			<Ariakit.ComboboxProvider
				open={open}
				setOpen={setOpen}
				setValue={(next) => setSearchValue(next)}
				resetValueOnHide
			>
				<div className="relative flex items-center rounded-md border border-medium bg-page focus-within:border-link/60">
					<Icon name="search" height={14} width={14} className="absolute left-3 text-tertiary" />
					<Ariakit.Combobox
						placeholder="Search articles by title…"
						autoSelect
						className="min-h-10 w-full rounded-md bg-transparent px-3 py-2 pr-3 pl-9 text-sm text-primary outline-hidden placeholder:text-tertiary"
					/>
				</div>
				<Ariakit.ComboboxPopover
					gutter={6}
					sameWidth
					portal
					unmountOnHide
					className="z-[90] flex max-h-72 flex-col overflow-auto overscroll-contain rounded-md border border-medium bg-surface py-1 text-sm shadow-xl outline-hidden"
				>
					{isFetching && !items.length ? <p className="p-3 text-center text-xs text-tertiary">Searching…</p> : null}
					{!isFetching && !items.length ? <p className="p-3 text-center text-xs text-tertiary">No results</p> : null}
					{items.map((article) => {
						const selected = value.includes(article.id)
						return (
							<Ariakit.ComboboxItem
								key={article.id}
								value={article.title}
								setValueOnClick={false}
								onClick={() => addArticle(article)}
								className="flex cursor-pointer items-start justify-between gap-3 px-3 py-2 text-secondary data-active-item:bg-research-link-button-bg data-active-item:text-link"
							>
								<span className="grid min-w-0 gap-0.5">
									<span className="truncate text-sm text-primary">{article.title}</span>
									<span className="font-jetbrains text-[10px] tracking-[0.16em] text-tertiary uppercase">
										{article.section ? ARTICLE_SECTION_LABELS[article.section] : 'No section'} · /{article.slug}
									</span>
								</span>
								{selected ? <Icon name="check" height={14} width={14} className="mt-0.5 shrink-0 text-link" /> : null}
							</Ariakit.ComboboxItem>
						)
					})}
				</Ariakit.ComboboxPopover>
			</Ariakit.ComboboxProvider>

			{value.length ? (
				<div className="flex flex-wrap gap-2">
					{value.map((id) => (
						<span
							key={id}
							className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-medium bg-surface py-1 pr-1 pl-2.5 text-xs text-primary"
						>
							<span className="truncate">{titles[id] ?? id}</span>
							<button
								type="button"
								onClick={() => removeArticle(id)}
								aria-label="Remove article"
								className="flex size-5 shrink-0 items-center justify-center rounded-sm text-tertiary transition-colors hover:bg-research-link-hover-bg hover:text-primary"
							>
								<Icon name="x" height={11} width={11} />
							</button>
						</span>
					))}
				</div>
			) : null}
			{hint ? <p className="text-xs text-tertiary">{hint}</p> : null}
		</div>
	)
}
