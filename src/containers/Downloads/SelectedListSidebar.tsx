import { Button } from '~/ui/Button'
import { focusNeighbourOnLeave, keepFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { Tooltip } from '~/ui/Tooltip'
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
	return (
		<aside
			className={`w-full shrink-0 flex-col border-subtle sm:flex sm:w-72 sm:border-l ${showOnPhone ? 'flex' : 'hidden'}`}
		>
			<div className="flex items-center justify-between gap-2 border-b border-subtle px-3 py-2">
				<div className="min-w-0">
					<p className="title-sm text-primary">
						Selected {noun}s ({items.length})
					</p>
					{loadingCount > 0 ? (
						<p className="label-xs text-tertiary">
							Ready {readyCount}/{items.length}
						</p>
					) : null}
				</div>
				{items.length > 0 ? (
					<span className="shrink-0 label-sm">
						<Button variant="link" onClick={() => keepFocus(onClearAll, pickerTrigger)}>
							Clear all
						</Button>
					</span>
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
							data-row
							className={`flex items-center gap-1.5 border-b border-subtle px-2.5 py-2 body-sm transition-colors ${
								isActive ? 'bg-hover-row' : 'hover:bg-hover-row'
							}`}
						>
							<button
								type="button"
								onClick={() => onPreview(item.value)}
								className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
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
								<span className={`truncate ${isActive ? 'font-medium text-primary' : 'text-secondary'}`}>
									{item.label}
								</span>
							</button>
							{isPreview ? null : (
								<Tooltip
									content="Download CSV"
									render={
										<Button
											variant="ghost"
											size="sm"
											square
											onClick={() => onDownload(item)}
											disabled={!isReady}
											// Stays focusable while the row loads, so the tooltip still opens.
											accessibleWhenDisabled
											aria-label={`Download ${item.label} CSV`}
										/>
									}
								>
									<ConfirmableContent
										confirmed={confirmed(`download:${item.value}`)}
										idle={<Icon name="download-cloud" className="size-4" />}
										done={<Icon name="check" className="size-4" />}
									/>
								</Tooltip>
							)}
							<Tooltip
								content="Remove"
								render={
									<Button
										variant="ghost"
										size="sm"
										square
										// The modals show the list only for two or more items, so the last row's × leaves with it and the
										// picker takes focus.
										ref={focusNeighbourOnLeave(pickerTrigger)}
										onClick={() => onRemove(item.value)}
										aria-label={`Remove ${item.label}`}
									/>
								}
							>
								<Icon name="x" className="size-4" />
							</Tooltip>
						</div>
					)
				})}
			</div>
			{isPreview ? null : (
				<p className="border-t border-subtle p-3 text-center body-xs text-tertiary">
					Download combined puts each {noun} in its own column
				</p>
			)}
		</aside>
	)
}
