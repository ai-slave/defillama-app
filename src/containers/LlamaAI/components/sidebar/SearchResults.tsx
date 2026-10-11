import { memo } from 'react'
import type { SearchResult } from '~/containers/LlamaAI/types'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { ListRow } from '~/ui/ListRow'
import { NoResults } from '~/ui/NoResults'
import { RelativeTime } from '~/ui/RelativeTime'
import { InlineStatus, LoadingIndicator } from '~/ui/Status'
import { Tag } from '~/ui/Tag'

export const SearchResults = memo(function SearchResults({
	results,
	isSearching,
	failed,
	onRetry,
	query,
	onMatchClick,
	onSessionClick
}: {
	results: Array<SearchResult>
	isSearching: boolean
	failed: boolean
	onRetry: () => void
	query: string
	onMatchClick: (sessionId: string, messageId: string) => void
	onSessionClick: (sessionId: string) => void
}) {
	if (failed) {
		return (
			<InlineStatus
				variant="error"
				action={
					<Button type="button" size="sm" pendingLabel="Retrying…" pending={isSearching} onClick={onRetry}>
						Try again
					</Button>
				}
			>
				Couldn&rsquo;t search your chats.
			</InlineStatus>
		)
	}

	if (isSearching && results.length === 0) {
		return (
			<div role="status" aria-live="polite" className="flex items-center justify-center p-6">
				<LoadingIndicator label="Searching" />
			</div>
		)
	}

	if (!isSearching && results.length === 0 && query.trim()) {
		return <NoResults>No results for &ldquo;{query}&rdquo;</NoResults>
	}

	return (
		<div className="flex flex-col gap-1.5">
			{results.map((result) => (
				<Card key={result.session_id} padding="none" className="flex flex-col">
					<button
						type="button"
						onClick={() => onSessionClick(result.session_id)}
						className="flex items-center justify-between gap-2 rounded-t-lg px-2 py-1.5 text-left not-disabled:not-aria-disabled:hover:bg-hover-row"
					>
						<span className="min-w-0 truncate label-sm text-primary">{result.session_title || 'Untitled'}</span>
						<RelativeTime className="shrink-0 body-sm text-tertiary" value={result.last_activity} />
					</button>
					<div className="flex flex-col gap-0.5 px-1 pb-1">
						{result.matches
							.filter((m) => m.message_id)
							.map((match, i) => (
								<ListRow
									// oxlint-disable-next-line react/no-array-index-key -- A message can yield multiple anonymous search chunks; these preview slots share its navigation target.
									key={`${result.session_id}-${match.message_id}-${i}`}
									onClick={() => match.message_id && onMatchClick(result.session_id, match.message_id)}
									className="items-start gap-1.5"
								>
									<Tag className="shrink-0">
										{match.source_type === 'user_message'
											? 'You'
											: match.source_type === 'session_title'
												? 'Title'
												: 'AI'}
									</Tag>
									<span className="line-clamp-2 min-w-0 text-secondary">{match.content_preview}</span>
								</ListRow>
							))}
					</div>
				</Card>
			))}
			{isSearching ? (
				<div role="status" aria-live="polite" className="flex items-center justify-center py-2">
					<LoadingIndicator label="Loading more" />
				</div>
			) : null}
		</div>
	)
})
