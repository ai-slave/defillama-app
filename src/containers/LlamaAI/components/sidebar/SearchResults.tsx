import { memo } from 'react'
import type { SearchMatch, SearchResult } from '~/containers/LlamaAI/types'
import { Button } from '~/ui/Button'
import { ListRow } from '~/ui/ListRow'
import { RelativeTime } from '~/ui/RelativeTime'
import { InlineStatus, LoadingIndicator } from '~/ui/Status'

function SourceBadge({ type }: { type: SearchMatch['source_type'] }) {
	const label = type === 'user_message' ? 'You' : type === 'session_title' ? 'Title' : 'AI'
	const colorClass =
		type === 'user_message'
			? 'bg-brand-muted text-link'
			: type === 'session_title'
				? 'bg-ai-violet-tint text-ai-violet'
				: 'bg-surface-elevated-2 text-secondary'
	return <span className={`shrink-0 rounded-sm px-1 py-0.5 label-xs ${colorClass}`}>{label}</span>
}

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
					<Button type="button" size="sm" pendingLabel={isSearching ? 'Retrying…' : null} onClick={onRetry}>
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
		return (
			<p className="flex items-center justify-center rounded-lg border border-dashed border-medium p-4 text-center body-sm text-tertiary">
				No results for &ldquo;{query}&rdquo;
			</p>
		)
	}

	return (
		<div className="flex flex-col gap-1.5">
			{results.map((result) => (
				<div key={result.session_id} className="flex flex-col rounded-lg border border-subtle bg-surface">
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
									<SourceBadge type={match.source_type} />
									<span className="line-clamp-2 min-w-0 text-secondary">{match.content_preview}</span>
								</ListRow>
							))}
					</div>
				</div>
			))}
			{isSearching ? (
				<div role="status" aria-live="polite" className="flex items-center justify-center py-2">
					<LoadingIndicator label="Loading more" />
				</div>
			) : null}
		</div>
	)
})
