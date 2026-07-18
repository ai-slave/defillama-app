import { memo } from 'react'
import { Icon } from '~/components/Icon'
import type { SearchMatch, SearchResult } from '~/containers/LlamaAI/types'

function formatTimeAgo(dateStr: string | null) {
	if (!dateStr) return ''
	const diff = Date.now() - new Date(dateStr).getTime()
	const days = Math.floor(diff / 86400000)
	if (days === 0) return 'Today'
	if (days === 1) return 'Yesterday'
	if (days < 7) return `${days}d ago`
	if (days < 30) return `${Math.floor(days / 7)}w ago`
	return `${Math.floor(days / 30)}mo ago`
}

function SourceBadge({ type }: { type: SearchMatch['source_type'] }) {
	const label = type === 'user_message' ? 'You' : type === 'session_title' ? 'Title' : 'AI'
	const colorClass =
		type === 'user_message'
			? 'bg-ai-accent-blue-deep/10 text-ai-accent-blue-deep'
			: type === 'session_title'
				? 'bg-ai-mention/10 text-ai-mention'
				: 'bg-ai-hover text-ai-tertiary'
	return <span className={`shrink-0 rounded-sm px-1 py-0.5 text-[9px] font-medium ${colorClass}`}>{label}</span>
}

export const SearchResults = memo(function SearchResults({
	results,
	isSearching,
	query,
	onMatchClick,
	onSessionClick
}: {
	results: SearchResult[]
	isSearching: boolean
	query: string
	onMatchClick: (sessionId: string, messageId: string) => void
	onSessionClick: (sessionId: string) => void
}) {
	if (isSearching && results.length === 0) {
		return (
			<div className="flex items-center justify-center p-6 text-xs text-ai-muted">
				<Icon name="search" height={12} width={12} className="mr-2 animate-pulse" />
				Searching...
			</div>
		)
	}

	if (!isSearching && results.length === 0 && query.trim()) {
		return (
			<p className="rounded-sm border border-dashed border-ai-line-strong p-4 text-center text-xs text-ai-tertiary">
				No results for &ldquo;{query}&rdquo;
			</p>
		)
	}

	return (
		<div className="flex flex-col gap-1.5">
			{results.map((result) => (
				<div key={result.session_id} className="flex flex-col rounded-md bg-ai-surface-muted">
					<button
						type="button"
						onClick={() => onSessionClick(result.session_id)}
						className="flex items-center justify-between px-2.5 py-1.5 text-left"
					>
						<span className="min-w-0 truncate text-[11px] font-medium text-ai-secondary">
							{result.session_title || 'Untitled'}
						</span>
						<span className="ml-2 shrink-0 text-[10px] text-ai-muted">{formatTimeAgo(result.last_activity)}</span>
					</button>
					<div className="flex flex-col gap-0.5 px-1.5 pb-1.5">
						{result.matches
							.filter((m) => m.message_id)
							.map((match, i) => (
								<button
									key={`${result.session_id}-${match.message_id}-${i}`}
									type="button"
									onClick={() => match.message_id && onMatchClick(result.session_id, match.message_id)}
									className="flex items-start gap-1.5 rounded-sm px-1.5 py-1 text-left transition-colors hover:bg-ai-surface-muted"
								>
									<SourceBadge type={match.source_type} />
									<span className="line-clamp-2 min-w-0 text-[10px] leading-relaxed text-ai-secondary">
										{match.content_preview}
									</span>
								</button>
							))}
					</div>
				</div>
			))}
			{isSearching ? (
				<div className="flex items-center justify-center py-2 text-[10px] text-ai-muted">
					<Icon name="search" height={10} width={10} className="mr-1.5 animate-pulse" />
					Loading more...
				</div>
			) : null}
		</div>
	)
})
