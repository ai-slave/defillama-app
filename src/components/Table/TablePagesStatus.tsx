import type { RefObject } from 'react'

/**
 * Status footer for cursor-mode tables (useTablePages). The footer IS the
 * infinite-scroll sentinel: pass the hook's `sentinelRef` here and rows load
 * before the reader reaches them — there is no scroll listener anywhere.
 */
export function TablePagesStatus({
	sentinelRef,
	error,
	isReplacing,
	isLoadingMore,
	rowCount,
	total,
	hasMore,
	retry,
	noun = 'rows',
	replacingLabel = 'Updating…',
	replaceFailedLabel = "Couldn't update results."
}: {
	sentinelRef: RefObject<HTMLDivElement | null>
	error: 'replace' | 'append' | null
	isReplacing: boolean
	isLoadingMore: boolean
	rowCount: number
	total: number
	hasMore: boolean
	retry: (() => Promise<void>) | undefined
	/** Plural item label, e.g. 'protocols'. */
	noun?: string
	/** Pass null when an overlay owns the replacing signal; the footer then keeps showing the row count. */
	replacingLabel?: string | null
	replaceFailedLabel?: string
}) {
	return (
		<div
			ref={sentinelRef}
			role="status"
			aria-live="polite"
			className="flex min-h-8 items-center justify-center px-3 py-4 text-xs text-tertiary"
		>
			{error ? (
				<>
					{error === 'replace' ? replaceFailedLabel : `Couldn't load more ${noun}.`}
					<button type="button" className="ml-1 underline" onClick={() => void retry?.()}>
						Retry
					</button>
				</>
			) : isReplacing && replacingLabel !== null ? (
				replacingLabel
			) : isLoadingMore ? (
				`Loading more ${noun}… ${rowCount} of ${total}`
			) : hasMore ? (
				`${rowCount} of ${total} ${noun}`
			) : (
				`${total} ${noun}`
			)}
		</div>
	)
}
