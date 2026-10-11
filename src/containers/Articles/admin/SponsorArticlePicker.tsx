import * as Ariakit from '@ariakit/react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuthContext } from '~/auth'
import { searchResearchSponsorArticles } from '~/containers/Articles/api'
import type { ResearchSponsorArticleSearchResult } from '~/containers/Articles/types'
import { ARTICLE_SECTION_LABELS } from '~/containers/Articles/types'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { ListLoading } from '~/ui/NoResults'
import { popoverMeasuredRowStyles } from '~/ui/Popover'
import { ComboboxSurface } from '~/ui/PopoverSurface'

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
				<Icon name="search" className="pointer-events-none absolute left-3 size-3.5 text-tertiary" />
				<Ariakit.Combobox
					aria-label="Research article to link"
					placeholder="Search Research articles…"
					autoSelect
					// Focusable while a pick links: the pick disables the field that holds focus.
					disabled={disabled}
					accessibleWhenDisabled
					render={<Input className="w-full pl-9" />}
				/>
			</div>
			<ComboboxSurface
				variant="search-results"
				sameWidth
				className="max-h-[min(320px,var(--popover-available-height))]"
			>
				{isFetching && items.length === 0 ? <ListLoading label="Searching" /> : null}
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
						className={popoverMeasuredRowStyles}
					>
						<span className="grid min-w-0 gap-1">
							<span className="line-clamp-2 label-md text-primary">{article.title}</span>
							<span className="flex flex-wrap items-center gap-2 body-sm text-tertiary">
								<span>{article.section ? ARTICLE_SECTION_LABELS[article.section] : 'No section'}</span>
								<span aria-hidden>·</span>
								<span className="truncate">/{article.slug}</span>
								<span className={article.lifecycleStatus === 'published' ? 'text-success' : 'text-warning'}>
									{article.lifecycleStatus}
								</span>
							</span>
						</span>
					</Ariakit.ComboboxItem>
				))}
			</ComboboxSurface>
		</Ariakit.ComboboxProvider>
	)
}
