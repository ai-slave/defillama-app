import { useCurrentSecond } from '~/containers/LlamaAI/components/status/useCurrentSecond'
import type { QueueRowStatus, QueueSurface } from '~/containers/LlamaAI/hooks/useChatQueueController'
import type { QueueNotSentReason } from '~/containers/LlamaAI/queue/protocol'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'

const REASON_COPY: Record<QueueNotSentReason, string> = {
	execution_stopped: 'You stopped the run',
	execution_failed: 'The previous run failed',
	epoch_changed: 'You edited the conversation',
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
const primaryButtonClass =
	'rounded-md bg-brand px-2 py-1 text-xs font-medium text-ai-white transition-opacity hover:opacity-90 disabled:opacity-40'
const secondaryButtonClass =
	'rounded-md border border-ai-line px-2 py-1 text-xs font-medium text-ai-secondary transition-colors hover:bg-ai-hover disabled:opacity-40'
const iconButtonClass =
	'flex size-6 shrink-0 items-center justify-center rounded-full text-ai-tertiary transition-colors hover:bg-ai-hover hover:text-ai-secondary disabled:opacity-40'

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
				className="w-full resize-none rounded-md border border-ai-line bg-page px-2 py-1.5 text-xs text-ai-secondary sm:text-sm"
				rows={2}
			/>
			{status?.error ? <p className="m-0 body-xs text-ai-error-strong">{status.error}</p> : null}
			{paused && !status?.error ? <p className="m-0 body-xs text-ai-tertiary">Queue paused while you edit</p> : null}
			<div className="flex items-center gap-1.5">
				<button type="submit" aria-label="Save" disabled={busy} className={primaryButtonClass}>
					{status?.action === 'saving_edit' ? <LoadingSpinner size={12} /> : 'Save'}
				</button>
				<button type="button" aria-label="Cancel" disabled={busy} className={secondaryButtonClass} onClick={onCancel}>
					{status?.action === 'canceling_edit' ? <LoadingSpinner size={12} /> : 'Cancel'}
				</button>
			</div>
		</form>
	)
}

function RowError({ status }: { status: QueueRowStatus | undefined }) {
	return status?.error ? <p className="m-0 body-xs text-ai-error-strong">{status.error}</p> : null
}

export function QueueChips({ surface, quotaResetTime }: { surface: QueueSurface; quotaResetTime?: string | null }) {
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
	const quotaResetCopy = hasQuotaCountdown ? formatResetIn(quotaResetTime, now) : null
	if (rows.length === 0) return null
	const isHeadBlocked = rows[0]?.state === 'not_sent' || rows[0]?.state === 'editing'
	const isPaused = rows.some(
		(item) => item.kind === 'server' && item.state === 'not_sent' && PAUSED_REASONS.has(item.reason)
	)
	const showQueueActions = isPaused || queueActionError?.action === 'clearing'

	return (
		<div className="flex flex-col gap-1.5">
			{showQueueActions ? (
				<div className="flex items-center justify-between gap-2">
					<p className="m-0 body-xs text-ai-tertiary">{isPaused ? 'Queue paused' : 'Clear was not confirmed'}</p>
					<div className="flex items-center gap-1.5">
						{isPaused ? (
							<button
								type="button"
								disabled={queueAction !== null || quotaResetCopy !== null}
								className={primaryButtonClass}
								onClick={onContinue}
							>
								{queueAction === 'continuing' ? (
									<LoadingSpinner size={12} />
								) : quotaResetCopy ? (
									`Continue in ${quotaResetCopy}`
								) : (
									'Continue queue'
								)}
							</button>
						) : null}
						<button
							type="button"
							disabled={queueAction !== null}
							className={secondaryButtonClass}
							onClick={() => {
								if (window.confirm('Clear every queued and waiting prompt?')) onClear()
							}}
						>
							{queueAction === 'clearing' ? (
								<LoadingSpinner size={12} />
							) : queueActionError?.action === 'clearing' ? (
								'Retry clear'
							) : (
								'Clear queue'
							)}
						</button>
					</div>
				</div>
			) : null}
			{queueActionError ? <p className="m-0 body-xs text-ai-error-strong">{queueActionError.message}</p> : null}
			<ul className="flex flex-col gap-1.5">
				{rows.map((item, index) => {
					const rowKey = item.kind === 'local' ? item.payload.clientMutationId : (item.clientMutationId ?? item.id)
					if (item.kind === 'local') {
						const adding = item.state === 'adding'
						const failed = item.state === 'failed'
						return (
							<li
								key={rowKey}
								className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${failed ? 'border-ai-error-vivid/30 bg-ai-error-vivid/5' : 'border-ai-line bg-surface'}`}
							>
								{adding ? (
									<span aria-label="Adding to queue" role="status" className="shrink-0 text-ai-tertiary">
										<LoadingSpinner size={14} />
									</span>
								) : (
									<Icon
										name={failed ? 'alert-triangle' : 'clock'}
										height={14}
										width={14}
										className={`shrink-0 ${failed ? 'text-ai-error-vivid' : 'text-ai-tertiary'}`}
									/>
								)}
								<div className="min-w-0 flex-1">
									<p className="m-0 truncate text-xs text-ai-secondary sm:text-sm">{item.payload.message}</p>
									<p className={`m-0 body-xs ${failed ? 'text-ai-error-strong' : 'text-ai-tertiary'}`}>
										{adding ? 'Adding…' : failed ? item.error : 'Waiting'}
									</p>
								</div>
								{!adding ? (
									<div className="flex shrink-0 items-center gap-1">
										{failed ? (
											<button
												type="button"
												aria-label="Retry"
												className={secondaryButtonClass}
												onClick={() => onRetry(item.id)}
											>
												Retry
											</button>
										) : null}
										<button
											type="button"
											aria-label="Dismiss"
											className={iconButtonClass}
											onClick={() => onDismiss(item.id)}
										>
											<Icon name="x" height={14} width={14} />
										</button>
									</div>
								) : null}
							</li>
						)
					}

					const status = rowStatus[item.id]
					const message = status?.unsavedDraft ?? item.displayMessage ?? item.message
					if (item.state === 'firing') {
						return (
							<li
								key={rowKey}
								className="flex items-center gap-2 rounded-lg border border-ai-line bg-surface px-3 py-2"
							>
								<span aria-label="Sending" role="status" className="shrink-0 text-ai-tertiary">
									<LoadingSpinner size={14} />
								</span>
								<p className="m-0 min-w-0 flex-1 truncate text-xs text-ai-tertiary sm:text-sm">{message}</p>
							</li>
						)
					}

					if (item.state === 'editing') {
						return (
							<li key={rowKey} className="flex items-start gap-2 rounded-lg border border-ai-line bg-surface px-3 py-2">
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
										<Icon
											name="alert-triangle"
											height={14}
											width={14}
											className="mt-0.5 shrink-0 text-ai-error-vivid"
										/>
										<div className="min-w-0 flex-1">
											<p className="m-0 text-xs break-words whitespace-pre-wrap text-ai-secondary select-text sm:text-sm">
												{status.unsavedDraft}
											</p>
											<RowError status={status} />
											<p className="m-0 body-xs text-ai-tertiary">Copy this unsaved edit before leaving.</p>
										</div>
									</>
								) : (
									<>
										<LoadingSpinner size={14} />
										<div className="min-w-0 flex-1">
											<p className="m-0 truncate text-xs text-ai-secondary sm:text-sm">{message}</p>
											<p className="m-0 body-xs text-ai-tertiary">Being edited</p>
										</div>
									</>
								)}
							</li>
						)
					}

					if (item.state === 'pending') {
						const busy = status?.action !== null && status?.action !== undefined
						return (
							<li
								key={rowKey}
								className="flex items-center gap-2 rounded-lg border border-ai-line bg-surface px-3 py-2"
							>
								<Icon name="clock" height={14} width={14} className="shrink-0 text-ai-tertiary" />
								<div className="min-w-0 flex-1">
									<p className="m-0 truncate text-xs text-ai-secondary sm:text-sm">{message}</p>
									<p className="m-0 body-xs text-ai-tertiary">
										{index > 0 && isHeadBlocked ? 'waiting for the message above' : `#${index + 1}`}
									</p>
									<RowError status={status} />
								</div>
								<div className="flex shrink-0 items-center gap-1">
									<button
										type="button"
										aria-label="Edit"
										disabled={busy}
										className={iconButtonClass}
										onClick={() => onEditStart(item.id)}
									>
										{status?.action === 'opening_edit' ? (
											<LoadingSpinner size={12} />
										) : (
											<Icon name="pencil" height={12} width={12} />
										)}
									</button>
									<button
										type="button"
										aria-label="Dismiss"
										disabled={busy}
										className={iconButtonClass}
										onClick={() => onDismiss(item.id)}
									>
										{status?.action === 'dismissing' ? (
											<LoadingSpinner size={12} />
										) : (
											<Icon name="x" height={14} width={14} />
										)}
									</button>
								</div>
							</li>
						)
					}

					const retryPrimary = RETRY_PRIMARY_REASONS.has(item.reason)
					const canRetry = !PAUSED_REASONS.has(item.reason)
					const resetCopy = item.reason === 'quota_exceeded' ? formatResetIn(quotaResetTime, now) : null
					const busy = status?.action !== null && status?.action !== undefined
					return (
						<li
							key={rowKey}
							className="flex items-start gap-2 rounded-lg border border-ai-error-vivid/30 bg-ai-error-vivid/5 px-3 py-2"
						>
							<Icon name="alert-triangle" height={14} width={14} className="mt-0.5 shrink-0 text-ai-error-vivid" />
							<div className="min-w-0 flex-1">
								<p
									className={`m-0 text-xs text-ai-secondary sm:text-sm ${status?.unsavedDraft ? 'break-words whitespace-pre-wrap select-text' : 'truncate'}`}
								>
									{message}
								</p>
								<p className="m-0 body-xs text-ai-error-strong">
									{REASON_COPY[item.reason]}
									{resetCopy ? ` · Resets in ${resetCopy}` : ''}
								</p>
								{status?.unsavedDraft ? (
									<p className="m-0 body-xs text-ai-tertiary">Copy the unsaved edit before dismissing it.</p>
								) : null}
								<RowError status={status} />
							</div>
							<div className="flex shrink-0 items-center gap-1.5">
								{canRetry ? (
									<button
										type="button"
										aria-label="Retry"
										data-primary={retryPrimary ? 'true' : undefined}
										disabled={busy || !!status?.unsavedDraft}
										className={retryPrimary ? primaryButtonClass : secondaryButtonClass}
										onClick={() => onRetry(item.id)}
									>
										{status?.action === 'retrying' ? (
											<LoadingSpinner size={12} />
										) : (
											<Icon name="repeat" height={12} width={12} />
										)}
									</button>
								) : null}
								<button
									type="button"
									aria-label="Dismiss"
									disabled={busy}
									className={iconButtonClass}
									onClick={() => onDismiss(item.id)}
								>
									{status?.action === 'dismissing' ? (
										<LoadingSpinner size={12} />
									) : (
										<Icon name="x" height={14} width={14} />
									)}
								</button>
							</div>
						</li>
					)
				})}
			</ul>
		</div>
	)
}
