import { useState, type ReactNode } from 'react'
import type { TelegramStatus } from '~/containers/LlamaAI/api/telegram'
import { useIntegrationLink } from '~/containers/LlamaAI/hooks/useIntegrationLink'

export type IntegrationKind = 'telegram'

type Props = {
	kind: IntegrationKind
	title: string
	description: string
	glyph?: ReactNode
	initialStatus?: TelegramStatus | null
	initialTgloginToken?: string | null
	onInitialStateConsumed?: () => void
}

function formatHandle(raw: string | null | undefined): string {
	if (!raw) return ''
	return raw.startsWith('@') ? raw : `@${raw}`
}

export function getIntegrationRowResetKey(
	initialTgloginToken: string | null | undefined,
	status: TelegramStatus | null | undefined
) {
	if (initialTgloginToken) return `tglogin:${initialTgloginToken}`
	if (status?.pending) return `pending:${status.pending.token}`
	if (status?.link.state === 'linked') return `linked:${status.link.telegramUsername}`
	return 'unlinked'
}

export function IntegrationRow({
	kind,
	title,
	description,
	glyph,
	initialStatus,
	initialTgloginToken,
	onInitialStateConsumed
}: Props) {
	const link = useIntegrationLink({
		initialStatus: kind === 'telegram' ? initialStatus : null,
		initialTgloginToken: kind === 'telegram' ? initialTgloginToken : null
	})

	const [codeDraft, setCodeDraft] = useState('')
	const [inlineError, setInlineError] = useState<string | null>(null)

	return (
		<div className="rounded-xl border border-ai-line-subtle bg-ai-hover-faint p-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="flex min-w-0 flex-1 items-center gap-3">
					{glyph}
					<div className="min-w-0">
						<p className="m-0 label-md text-ai-primary">{title}</p>
						<p className="m-0 mt-0.5 text-xs text-ai-tertiary">{description}</p>
					</div>
				</div>
				{link.state.status === 'linked' ? (
					<div className="flex shrink-0 flex-col items-end gap-2">
						<span className="text-xs whitespace-nowrap text-ai-tertiary">
							Linked as {formatHandle(link.state.username)}
						</span>
						<div className="flex gap-2">
							<button
								onClick={() => link.disconnect()}
								className="shrink-0 rounded-lg border border-ai-line-medium px-3 py-1.5 text-xs whitespace-nowrap hover:bg-ai-hover"
							>
								Disconnect
							</button>
							<button
								onClick={() => link.connect()}
								className="shrink-0 rounded-lg bg-ai-accent-blue-deep px-3 py-1.5 text-xs whitespace-nowrap text-ai-white hover:bg-ai-accent-blue-deep/90"
							>
								Switch account
							</button>
						</div>
					</div>
				) : link.state.status === 'idle' || link.state.status === 'starting' || link.state.status === 'loading' ? (
					<button
						disabled={link.state.status === 'starting' || link.state.status === 'loading'}
						onClick={() => link.connect()}
						className="shrink-0 rounded-lg bg-ai-accent-blue-deep px-3 py-1.5 text-xs whitespace-nowrap text-ai-white disabled:opacity-50"
					>
						{link.state.status === 'starting' ? 'Opening…' : link.state.status === 'loading' ? 'Loading…' : 'Connect'}
					</button>
				) : null}
			</div>

			{link.state.status === 'awaiting_tg' && (
				<div className="mt-3 rounded-lg bg-ai-hover p-3 text-xs text-ai-tertiary">
					Waiting for confirmation in Telegram…
					<div className="mt-2">
						Didn&apos;t see Telegram open?{' '}
						<a href={link.state.deepLink} target="_blank" rel="noopener" className="underline">
							DM /start to the bot
						</a>
						.
					</div>
				</div>
			)}

			{link.state.status === 'confirming' && (
				<div className="mt-3 rounded-lg bg-ai-hover p-3 text-xs text-ai-tertiary">Confirming Telegram link…</div>
			)}

			{link.state.status === 'awaiting_code' && (
				<form
					onSubmit={(e) => {
						e.preventDefault()
						setInlineError(null)
						link
							.confirmCode(codeDraft)
							.then((result) => {
								if (result && 'linked' in result && result.linked) onInitialStateConsumed?.()
							})
							.catch((error: any) => {
								setInlineError(error?.body?.error || error?.message || 'Invalid code')
							})
					}}
					className="mt-3 flex gap-2"
				>
					<input
						value={codeDraft}
						onChange={(e) => setCodeDraft(e.target.value.replace(/\D/g, '').slice(0, 6))}
						placeholder="6-digit code from Telegram"
						maxLength={6}
						inputMode="numeric"
						className="flex-1 rounded-lg border border-ai-line-medium bg-ai-surface-card px-3 py-1.5 text-sm"
					/>
					<button
						type="submit"
						disabled={codeDraft.length !== 6}
						className="rounded-lg bg-ai-accent-blue-deep px-3 py-1.5 text-xs text-ai-white disabled:opacity-50"
					>
						Confirm
					</button>
				</form>
			)}

			{link.state.status === 'awaiting_code' && inlineError && (
				<div className="mt-2 text-xs text-ai-error">{inlineError}</div>
			)}

			{link.state.status === 'switch_confirm' && (
				<div className="mt-3 rounded-lg border border-ai-warning-bright/40 bg-ai-warning-soft p-3 text-xs">
					<p className="m-0 mb-2">
						You&apos;re already linked to {formatHandle(link.state.currentTelegramUsername)}. Switch to this Telegram?
					</p>
					<div className="flex gap-2">
						<button
							onClick={() => {
								link.confirmSwitch().then((consumed) => {
									if (consumed) onInitialStateConsumed?.()
								})
							}}
							className="rounded-lg bg-ai-warning px-3 py-1.5 text-xs text-ai-white"
						>
							Yes, switch
						</button>
						<button
							onClick={() => {
								link.cancelSwitch()
								onInitialStateConsumed?.()
							}}
							className="rounded-lg border border-ai-line-medium px-3 py-1.5 text-xs"
						>
							Cancel
						</button>
					</div>
				</div>
			)}

			{link.state.status === 'error' && (
				<div className="mt-3 rounded-lg border border-ai-error-vivid/40 bg-ai-error-bg p-3 text-xs text-ai-error-strong">
					{link.state.message}
				</div>
			)}
		</div>
	)
}
