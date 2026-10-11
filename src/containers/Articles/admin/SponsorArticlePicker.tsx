import * as Ariakit from '@ariakit/react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuthContext } from '~/auth'
import { searchResearchSponsorArticles } from '~/containers/Articles/api'
import type { ResearchSponsorArticleSearchResult } from '~/containers/Articles/types'
import { ARTICLE_SECTION_LABELS } from '~/containers/Articles/types'
import { MetaLine } from '~/ui/MetaLine'
import { ListLoading } from '~/ui/NoResults'
import { ComboboxSurface, PopoverRow } from '~/ui/PopoverSurface'
import { SearchField } from '~/ui/SearchField'

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
			<SearchField
				combobox
				label="Research article to link"
				placeholder="Search Research articles…"
				autoSelect
				// Focusable while a pick links: the pick disables the field that holds focus.
				disabled={disabled}
				accessibleWhenDisabled
			/>
			<ComboboxSurface variant="search-results" sameWidth maxHeight="md">
				{isFetching && items.length === 0 ? <ListLoading label="Searching" /> : null}
				{!isFetching && items.length === 0 ? (
					<p className="p-3 body-sm text-tertiary">
						{query ? 'No matching unlinked articles.' : 'No additional Research articles available.'}
					</p>
				) : null}
				{items.map((article) => (
					<PopoverRow
						key={article.id}
						onClick={() => {
							onSelect(article)
							setSearchValue('')
							setOpen(false)
						}}
						render={<Ariakit.ComboboxItem value={article.title} setValueOnClick={false} />}
					>
						<span className="grid min-w-0 gap-1">
							<span className="line-clamp-2 label-md text-primary">{article.title}</span>
							<MetaLine>
								{article.section ? ARTICLE_SECTION_LABELS[article.section] : 'No section'}
								<span className="min-w-0 truncate">/{article.slug}</span>
								<span className={article.lifecycleStatus === 'published' ? 'text-success' : 'text-warning'}>
									{article.lifecycleStatus}
								</span>
							</MetaLine>
						</span>
					</PopoverRow>
				))}
			</ComboboxSurface>
		</Ariakit.ComboboxProvider>
	)
}
