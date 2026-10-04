import { keepFocus, neighbourRowControl } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { ConfirmableContent } from './ActionFeedback'

export interface CsvQueryStatus {
	data: unknown
	isLoading: boolean
	error: unknown
}

interface SelectedItem {
	value: string
	label: string
}

interface SelectedListSidebarProps {
	/** Names the list ("Selected protocols") and the combined download's footer. */
	noun: string
	items: Array<SelectedItem>
	/** The fetch of each item, in the same order. */
	queries: ReadonlyArray<CsvQueryStatus>
	activeValue: string | null
	onPreview: (value: string) => void
	onRemove: (value: string) => void
	onClearAll: () => void
	onDownload: (item: SelectedItem) => void
	/** Whether a download button shows its confirmation now. */
	confirmed: (action: string) => boolean
	/** Takes focus when the last row leaves. */
	pickerTrigger: () => HTMLElement | null
	/** Below sm the list replaces the table instead of sitting beside it. */
	showOnPhone: boolean
	/** A preview downloads nothing: the header Download opens the subscribe prompt. */
	isPreview: boolean
	readyCount: number
	loadingCount: number
}

/** The selected items of a bulk preview: pick the one the table shows, download or remove one, or clear them all. */
export function SelectedListSidebar({
	noun,
	items,
	queries,
	activeValue,
	onPreview,
	onRemove,
	onClearAll,
	onDownload,
	confirmed,
	pickerTrigger,
	showOnPhone,
	isPreview,
	readyCount,
	loadingCount
}: SelectedListSidebarProps) {
	// A removed row's × hands focus to the next row's ×, the one above, or the picker once the list closes: the
	// modals show it only for two or more items, so the last row's × leaves with it.
	const removeRow = (value: string, remove: HTMLElement) => {
		const next = neighbourRowControl(remove.parentElement!, remove)
		keepFocus(
			() => onRemove(value),
			() => (next?.isConnected ? next : pickerTrigger())
		)
	}
	return (
		<aside
			className={`w-full shrink-0 flex-col border-subtle sm:flex sm:w-72 sm:border-l ${showOnPhone ? 'flex' : 'hidden'}`}
		>
			<div className="flex items-center justify-between gap-2 border-b border-subtle px-3 py-2">
				<div className="min-w-0">
					<p className="text-xs font-semibold text-pro-text-primary">
						Selected {noun}s ({items.length})
					</p>
					{loadingCount > 0 ? (
						<p className="text-[10px] text-pro-text-tertiary">
							Ready {readyCount}/{items.length}
						</p>
					) : null}
				</div>
				{items.length > 0 ? (
					<button
						type="button"
						onClick={() => keepFocus(onClearAll, pickerTrigger)}
						className="shrink-0 text-[11px] text-pro-text-tertiary hover:text-pro-text-primary hover:underline"
					>
						Clear all
					</button>
				) : null}
			</div>
			<div className="flex-1 overflow-auto">
				{items.map((item, i) => {
					const query = queries[i]
					const isActive = item.value === activeValue
					const isReady = typeof query?.data === 'string'
					return (
						<div
							key={item.value}
							className={`flex items-center gap-1.5 border-b border-subtle px-2.5 py-2 text-xs transition-colors ${
								isActive ? 'bg-hover-row' : 'hover:bg-hover-row'
							}`}
						>
							<button
								type="button"
								onClick={() => onPreview(item.value)}
								className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
								title={`Preview ${item.label}`}
								aria-current={isActive ? true : undefined}
							>
								<span className="flex size-4 shrink-0 items-center justify-center">
									{query?.isLoading ? (
										<LoadingSpinner size={12} />
									) : query?.error ? (
										<Icon name="alert-triangle" className="size-3.5 text-error" />
									) : isReady ? (
										<Icon name="check" className="size-3.5 text-success" />
									) : null}
								</span>
								<span
									className={`truncate ${isActive ? 'font-medium text-pro-text-primary' : 'text-pro-text-secondary'}`}
								>
									{item.label}
								</span>
							</button>
							{isPreview ? null : (
								<button
									type="button"
									onClick={() => onDownload(item)}
									disabled={!isReady}
									aria-label={`Download ${item.label} CSV`}
									className="shrink-0 rounded-sm p-1 text-pro-text-tertiary transition-colors hover:bg-surface hover:text-brand disabled:cursor-not-allowed disabled:opacity-30"
								>
									<ConfirmableContent
										confirmed={confirmed(`download:${item.value}`)}
										idle={<Icon name="download-cloud" className="size-3.5" />}
										done={<Icon name="check" className="size-3.5" />}
									/>
								</button>
							)}
							<button
								type="button"
								onClick={(event) => removeRow(item.value, event.currentTarget)}
								title="Remove"
								aria-label={`Remove ${item.label}`}
								className="shrink-0 rounded-sm p-1 text-pro-text-tertiary transition-colors hover:bg-surface hover:text-error"
							>
								<Icon name="x" className="size-3.5" />
							</button>
						</div>
					)
				})}
			</div>
			{isPreview ? null : (
				<p className="border-t border-subtle p-3 text-center text-[10px] text-pro-text-tertiary">
					Download combined puts each {noun} in its own column
				</p>
			)}
		</aside>
	)
}
