import * as Ariakit from '@ariakit/react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuthContext } from '~/auth'
import { searchResearchSponsorArticles } from '~/containers/Articles/api'
import type { ResearchSponsorArticleSearchResult } from '~/containers/Articles/types'
import { ARTICLE_SECTION_LABELS } from '~/containers/Articles/types'
import { Icon } from '~/ui/Icon'
import { inputStyles } from '~/ui/Input'

type Props = {
	excludedIds: ReadonlySet<string>
	onSelect: (article: ResearchSponsorArticleSearchResult) => void
	disabled?: boolean
}

export function SponsorArticlePicker({ excludedIds, onSelect, disabled = false }: Props) {
	const { authorizedFetch } = useAuthContext()
	const [open, setOpen] = useState(false)
	const [searchValue, setSearchValue] = useState('')
	const query = searchValue.trim()

	const { data, isFetching } = useQuery({
		queryKey: ['research', 'admin', 'sponsor-article-search', query],
		queryFn: () => searchResearchSponsorArticles(query, authorizedFetch),
		enabled: open,
		staleTime: 30_000,
		retry: false
	})
	const items = (data ?? []).filter((article) => !excludedIds.has(article.id))

	return (
		<Ariakit.ComboboxProvider open={open} setOpen={setOpen} setInputValue={setSearchValue} resetValueOnHide>
			<div className="relative flex items-center">
				<Icon name="search" height={14} width={14} className="pointer-events-none absolute left-3 text-tertiary" />
				<Ariakit.Combobox
					aria-label="Research article to link"
					placeholder="Search Research articles…"
					autoSelect
					// Focusable while a pick links: the pick disables the field that holds focus.
					disabled={disabled}
					accessibleWhenDisabled
					className={`${inputStyles} w-full pl-9 aria-disabled:cursor-not-allowed aria-disabled:opacity-60`}
				/>
			</div>
			<Ariakit.ComboboxPopover
				gutter={6}
				sameWidth
				portal
				unmountOnHide
				className="z-50 flex max-h-80 flex-col overflow-auto rounded-lg border border-medium bg-overlay py-1 shadow-md outline-hidden"
			>
				{isFetching && items.length === 0 ? <p className="p-3 body-sm text-tertiary">Searching…</p> : null}
				{!isFetching && items.length === 0 ? (
					<p className="p-3 body-sm text-tertiary">
						{query ? 'No matching unlinked articles.' : 'No additional Research articles available.'}
					</p>
				) : null}
				{items.map((article) => (
					<Ariakit.ComboboxItem
						key={article.id}
						value={article.title}
						setValueOnClick={false}
						onClick={() => {
							onSelect(article)
							setSearchValue('')
							setOpen(false)
						}}
						className="grid cursor-pointer gap-1 px-3 py-2 data-active-item:bg-hover-row"
					>
						<span className="line-clamp-2 label-md text-primary">{article.title}</span>
						<span className="flex flex-wrap items-center gap-2 body-sm text-tertiary">
							<span>{article.section ? ARTICLE_SECTION_LABELS[article.section] : 'No section'}</span>
							<span aria-hidden>·</span>
							<span className="truncate">/{article.slug}</span>
							<span className={article.lifecycleStatus === 'published' ? 'text-data-up' : 'text-warning'}>
								{article.lifecycleStatus}
							</span>
						</span>
					</Ariakit.ComboboxItem>
				))}
			</Ariakit.ComboboxPopover>
		</Ariakit.ComboboxProvider>
	)
}
