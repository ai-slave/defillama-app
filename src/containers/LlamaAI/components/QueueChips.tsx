import * as Ariakit from '@ariakit/react'
import { useRef, useState, type RefObject } from 'react'
import { useCurrentSecond } from '~/containers/LlamaAI/components/status/useCurrentSecond'
import type { QueueRowStatus, QueueSurface } from '~/containers/LlamaAI/hooks/useChatQueueController'
import type { QueueNotSentReason } from '~/containers/LlamaAI/queue/protocol'
import { Button } from '~/ui/Button'
import { ConfirmDialog } from '~/ui/ConfirmDialog'
import { neighbourRowControl, passFocusOnLeave } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { textareaStyles } from '~/ui/Input'
import { LoadingSpinner } from '~/ui/Loaders'
import { Tooltip } from '~/ui/Tooltip'

const REASON_COPY: Record<QueueNotSentReason, string> = {
	execution_stopped: 'You stopped the run',
	execution_failed: 'The previous run failed',
	// The server sends this after an edit, a switch to another reply, or a duel vote for the other answer.
	epoch_changed: 'The conversation changed',
	quota_exceeded: 'Out of messages',
	server_restarted: 'Server restarted',
	expired: 'Message expired',
	edit_expired: 'Edit expired before it was saved'
}

const RETRY_PRIMARY_REASONS = new Set<QueueNotSentReason>(['expired'])
const PAUSED_REASONS = new Set<QueueNotSentReason>([
	'execution_stopped',
	'execution_failed',
	'quota_exceeded',
	'server_restarted'
])
const ROW = 'flex items-center gap-2 rounded-lg border border-subtle bg-surface px-3 py-2'
// A row's controls change with its state; when the ones that had focus leave (a saved edit, a retried send), the row
// itself holds focus. Rows take tabIndex -1 for it.
const focusRowOnLeave = passFocusOnLeave((controls) => controls.closest('li'))

function formatResetIn(resetTime: string | null | undefined, now: number): string | null {
	if (!resetTime) return null
	const ms = new Date(resetTime).getTime() - now
	if (ms <= 0) return null
	const hours = Math.floor(ms / 3_600_000)
	const minutes = Math.floor((ms % 3_600_000) / 60_000)
	return hours >= 24 ? `${Math.floor(hours / 24)}d ${hours % 24}h` : `${hours}h ${minutes}m`
}

function QueueChipEditor({
	id,
	initialMessage,
	paused,
	status,
	onDraftChange,
	onCancel,
	onSave
}: {
	id: string
	initialMessage: string
	paused: boolean
	status: QueueRowStatus | undefined
	onDraftChange: (message: string) => void
	onCancel: () => void
	onSave: (message: string) => void
}) {
	const busy = status?.action === 'saving_edit' || status?.action === 'canceling_edit'
	return (
		<form
			ref={focusRowOnLeave}
			className="flex min-w-0 flex-1 flex-col gap-1.5"
			onSubmit={(event) => {
				event.preventDefault()
				const message = String(new FormData(event.currentTarget).get('message') ?? '').trim()
				if (message) onSave(message)
			}}
		>
			<textarea
				key={id}
				autoFocus
				name="message"
				defaultValue={initialMessage}
				onChange={(event) => onDraftChange(event.currentTarget.value)}
				className={`${textareaStyles} w-full resize-none`}
				rows={2}
			/>
			{status?.error ? <p className="m-0 body-sm text-error">{status.error}</p> : null}
			{paused && !status?.error ? <p className="m-0 body-sm text-tertiary">Queue paused while you edit</p> : null}
			<div className="flex items-center gap-1.5">
				<Button
					type="submit"
					accessibleWhenDisabled
					disabled={busy}
					pendingLabel={status?.action === 'saving_edit' ? 'Saving…' : null}
					variant="primary"
					size="sm"
				>
					Save
				</Button>
				<Button
					type="button"
					accessibleWhenDisabled
					disabled={busy}
					pendingLabel={status?.action === 'canceling_edit' ? 'Canceling…' : null}
					size="sm"
					onClick={onCancel}
				>
					Cancel
				</Button>
			</div>
		</form>
	)
}

function RowError({ status }: { status: QueueRowStatus | undefined }) {
	return status?.error ? <p className="m-0 body-sm text-error">{status.error}</p> : null
}

export function QueueChips({
	surface,
	quotaResetTime,
	promptInputRef
}: {
	surface: QueueSurface
	quotaResetTime?: string | null
	promptInputRef: RefObject<HTMLTextAreaElement | null>
}) {
	const clearStore = Ariakit.useDialogStore()
	const returnFocus = useRef<HTMLElement | null>(null)
	const {
		rows,
		ownedEditId,
		rowStatus,
		onEditStart,
		onEditDraftChange,
		onEditSave,
		onEditCancel,
		onDismiss,
		onRetry,
		onContinue,
		onClear,
		queueAction,
		queueActionError
	} = surface
	const hasQuotaCountdown =
		!!quotaResetTime &&
		rows.some((item) => item.kind === 'server' && item.state === 'not_sent' && item.reason === 'quota_exceeded')
	const now = useCurrentSecond(hasQuotaCountdown) * 1000
	const [showAll, setShowAll] = useState(false)
	const quotaResetCopy = hasQuotaCountdown ? formatResetIn(quotaResetTime, now) : null
	if (rows.length === 0) return null
	const isHeadBlocked = rows[0]?.state === 'not_sent' || rows[0]?.state === 'editing'
	const isPaused = rows.some(
		(item) => item.kind === 'server' && item.state === 'not_sent' && PAUSED_REASONS.has(item.reason)
	)
	const showQueueActions = isPaused || queueActionError?.action === 'clearing'
	// A long queue folds after its first two prompts so it never buries the thread on a phone. A row that needs the
	// reader (failed, paused, being edited) always stays on screen, and folded rows keep their real positions.
	const isFolded = (item: (typeof rows)[number], index: number) =>
		!showAll &&
		rows.length > 3 &&
		index >= 2 &&
		(item.kind === 'local' ? item.state !== 'failed' : item.state === 'pending' || item.state === 'firing')
	let foldedCount = 0
	for (let index = 0; index < rows.length; index++) if (isFolded(rows[index], index)) foldedCount++
	// A row that leaves with focus (dismissed, sent) hands it to the next row, else the one before, else the composer.
	const focusNeighbourOnLeave = passFocusOnLeave((row) => neighbourRowControl(row, row) ?? promptInputRef.current)

	return (
		<div className="flex flex-col gap-1.5">
			{showQueueActions ? (
				// Continuing the queue removes this bar with its focused button; the composer takes focus.
				<div ref={passFocusOnLeave(() => promptInputRef.current)} className="flex items-center justify-between gap-2">
					<p className="m-0 body-sm text-tertiary">{isPaused ? 'Queue paused' : 'Clear was not confirmed'}</p>
					<div className="flex items-center gap-1.5">
						{isPaused ? (
							<Button
								type="button"
								size="sm"
								variant="primary"
								disabled={queueAction === 'clearing' || quotaResetCopy !== null}
								pendingLabel={queueAction === 'continuing' ? 'Continuing…' : null}
								onClick={onContinue}
							>
								{quotaResetCopy ? `Continue in ${quotaResetCopy}` : 'Continue queue'}
							</Button>
						) : null}
						<Button
							type="button"
							size="sm"
							disabled={queueAction === 'continuing'}
							pendingLabel={queueAction === 'clearing' ? 'Clearing…' : null}
							onClick={(event) => {
								returnFocus.current = event.currentTarget
								clearStore.show()
							}}
						>
							{queueActionError?.action === 'clearing' ? 'Retry clear' : 'Clear queue'}
						</Button>
					</div>
				</div>
			) : null}
			{queueActionError ? (
				<p role="alert" className="m-0 body-sm text-error">
					{queueActionError.message}
				</p>
			) : null}
			<span role="status" className="sr-only">
				{queueAction === 'clearing' ? 'Clearing queued prompts' : ''}
			</span>
			<ConfirmDialog
				store={clearStore}
				unmountOnHide
				finalFocus={returnFocus}
				title="Clear all queued prompts?"
				description="This removes every queued and waiting prompt from this conversation."
				confirmLabel="Clear queue"
				// The dialog closes on confirm: the queue row owns pending and error feedback, including a lost response.
				pendingLabel={null}
				error={null}
				onConfirm={() => {
					returnFocus.current = promptInputRef.current ?? returnFocus.current
					clearStore.hide()
					onClear()
				}}
			/>
			<ul className="flex flex-col gap-1.5">
				{rows.map((item, index) => {
					if (isFolded(item, index)) return null
					const rowKey = item.kind === 'local' ? item.payload.clientMutationId : (item.clientMutationId ?? item.id)
					if (item.kind === 'local') {
						const adding = item.state === 'adding'
						const failed = item.state === 'failed'
						return (
							<li key={rowKey} ref={focusNeighbourOnLeave} tabIndex={-1} className={ROW}>
								{adding ? (
									<span aria-label="Adding to queue" role="status" className="shrink-0 text-tertiary">
										<LoadingSpinner size={14} />
									</span>
								) : (
									<Icon
										name={failed ? 'alert-triangle' : 'clock'}
										height={14}
										width={14}
										className={`shrink-0 ${failed ? 'text-error' : 'text-tertiary'}`}
									/>
								)}
								<div className="min-w-0 flex-1">
									<p id={`queue-row-${rowKey}`} className="m-0 truncate body-sm text-primary">
										{item.payload.message}
									</p>
									<p className={`m-0 body-sm ${failed ? 'text-error' : 'text-tertiary'}`}>
										{adding ? 'Adding…' : failed ? item.error : 'Waiting'}
									</p>
								</div>
								{!adding ? (
									<div ref={focusRowOnLeave} className="flex shrink-0 items-center gap-1">
										{failed ? (
											<Button
												type="button"
												aria-describedby={`queue-row-${rowKey}`}
												size="sm"
												onClick={() => onRetry(item.id)}
											>
												Retry
											</Button>
										) : null}
										<Tooltip
											content="Dismiss"
											render={
												<Button
													type="button"
													aria-describedby={`queue-row-${rowKey}`}
													variant="ghost"
													size="sm"
													square
													onClick={() => onDismiss(item.id)}
												/>
											}
										>
											<Icon name="x" height={14} width={14} />
											<span className="sr-only">Dismiss</span>
										</Tooltip>
									</div>
								) : null}
							</li>
						)
					}

					const status = rowStatus[item.id]
					const message = status?.unsavedDraft ?? item.displayMessage ?? item.message
					if (item.state === 'firing') {
						return (
							<li key={rowKey} ref={focusNeighbourOnLeave} tabIndex={-1} className={ROW}>
								<span aria-label="Sending" role="status" className="shrink-0 text-tertiary">
									<LoadingSpinner size={14} />
								</span>
								<p className="m-0 min-w-0 flex-1 truncate body-sm text-secondary">{message}</p>
							</li>
						)
					}

					if (item.state === 'editing') {
						return (
							<li key={rowKey} ref={focusNeighbourOnLeave} tabIndex={-1} className={`${ROW} items-start`}>
								{ownedEditId === item.id ? (
									<QueueChipEditor
										id={item.id}
										initialMessage={message}
										paused={index === 0}
										status={status}
										onDraftChange={(nextMessage) => onEditDraftChange(item.id, nextMessage)}
										onCancel={() => onEditCancel(item.id)}
										onSave={(nextMessage) => onEditSave(item.id, nextMessage)}
									/>
								) : status?.unsavedDraft ? (
									<>
										<Icon name="alert-triangle" height={14} width={14} className="mt-0.5 shrink-0 text-error" />
										<div className="min-w-0 flex-1">
											<p className="m-0 body-sm break-words whitespace-pre-wrap text-primary select-text">
												{status.unsavedDraft}
											</p>
											<RowError status={status} />
											<p className="m-0 body-sm text-tertiary">Copy this unsaved edit before leaving.</p>
										</div>
									</>
								) : (
									<>
										<LoadingSpinner size={14} />
										<div className="min-w-0 flex-1">
											<p className="m-0 truncate body-sm text-primary">{message}</p>
											<p className="m-0 body-sm text-tertiary">Being edited</p>
										</div>
									</>
								)}
							</li>
						)
					}

					if (item.state === 'pending') {
						const busy = status?.action !== null && status?.action !== undefined
						return (
							<li key={rowKey} ref={focusNeighbourOnLeave} tabIndex={-1} className={ROW}>
								<Icon name="clock" height={14} width={14} className="shrink-0 text-tertiary" />
								<div className="min-w-0 flex-1">
									<p id={`queue-row-${rowKey}`} className="m-0 truncate body-sm text-primary">
										{message}
									</p>
									<p className="m-0 body-sm text-tertiary">
										{index > 0 && isHeadBlocked ? 'waiting for the message above' : `#${index + 1}`}
									</p>
									<RowError status={status} />
								</div>
								<div className="flex shrink-0 items-center gap-1">
									<Tooltip
										content="Edit"
										render={
											<Button
												type="button"
												aria-describedby={`queue-row-${rowKey}`}
												accessibleWhenDisabled
												disabled={busy}
												pendingLabel={status?.action === 'opening_edit' ? 'Opening editor…' : null}
												variant="ghost"
												size="sm"
												square
												onClick={() => onEditStart(item.id)}
											/>
										}
									>
										<Icon name="pencil" height={16} width={16} />
										<span className="sr-only">Edit</span>
									</Tooltip>
									<Tooltip
										content="Dismiss"
										render={
											<Button
												type="button"
												aria-describedby={`queue-row-${rowKey}`}
												accessibleWhenDisabled
												disabled={busy}
												pendingLabel={status?.action === 'dismissing' ? 'Dismissing…' : null}
												variant="ghost"
												size="sm"
												square
												onClick={() => onDismiss(item.id)}
											/>
										}
									>
										<Icon name="x" height={14} width={14} />
										<span className="sr-only">Dismiss</span>
									</Tooltip>
								</div>
							</li>
						)
					}

					const retryPrimary = RETRY_PRIMARY_REASONS.has(item.reason)
					const canRetry = !PAUSED_REASONS.has(item.reason)
					const resetCopy = item.reason === 'quota_exceeded' ? formatResetIn(quotaResetTime, now) : null
					const busy = status?.action !== null && status?.action !== undefined
					return (
						<li key={rowKey} ref={focusNeighbourOnLeave} tabIndex={-1} className={`${ROW} items-start`}>
							<Icon name="alert-triangle" height={14} width={14} className="mt-0.5 shrink-0 text-error" />
							<div className="min-w-0 flex-1">
								<p
									id={`queue-row-${rowKey}`}
									className={`m-0 body-sm text-primary ${status?.unsavedDraft ? 'break-words whitespace-pre-wrap select-text' : 'truncate'}`}
								>
									{message}
								</p>
								<p className="m-0 body-sm text-error">
									{REASON_COPY[item.reason]}
									{resetCopy ? ` · Resets in ${resetCopy}` : ''}
								</p>
								{status?.unsavedDraft ? (
									<p className="m-0 body-sm text-tertiary">Copy the unsaved edit before dismissing it.</p>
								) : null}
								<RowError status={status} />
							</div>
							<div className="flex shrink-0 items-center gap-1.5">
								{canRetry ? (
									<Tooltip
										content="Retry"
										render={
											<Button
												type="button"
												aria-describedby={`queue-row-${rowKey}`}
												data-primary={retryPrimary ? 'true' : undefined}
												accessibleWhenDisabled
												disabled={busy || !!status?.unsavedDraft}
												pendingLabel={status?.action === 'retrying' ? 'Retrying…' : null}
												variant={retryPrimary ? 'primary' : 'secondary'}
												size="sm"
												square
												onClick={() => onRetry(item.id)}
											/>
										}
									>
										<Icon name="repeat" height={16} width={16} />
										<span className="sr-only">Retry</span>
									</Tooltip>
								) : null}
								<Tooltip
									content="Dismiss"
									render={
										<Button
											type="button"
											aria-describedby={`queue-row-${rowKey}`}
											accessibleWhenDisabled
											disabled={busy}
											pendingLabel={status?.action === 'dismissing' ? 'Dismissing…' : null}
											variant="ghost"
											size="sm"
											square
											onClick={() => onDismiss(item.id)}
										/>
									}
								>
									<Icon name="x" height={14} width={14} />
									<span className="sr-only">Dismiss</span>
								</Tooltip>
							</div>
						</li>
					)
				})}
			</ul>
			{foldedCount > 0 || showAll ? (
				<Button type="button" size="sm" variant="ghost" className="self-start" onClick={() => setShowAll(!showAll)}>
					{showAll ? 'Show fewer' : `${foldedCount} more queued`}
				</Button>
			) : null}
		</div>
	)
}
