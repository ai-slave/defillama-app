import { useState, type ReactNode } from 'react'
import type { TelegramStatus } from '~/containers/LlamaAI/api/telegram'
import { useIntegrationLink } from '~/containers/LlamaAI/hooks/useIntegrationLink'
import { Button } from '~/ui/Button'
import { Input } from '~/ui/Input'
import { LoadingSpinner } from '~/ui/Loaders'
import { InlineStatus } from '~/ui/Status'

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
		<div className="rounded-lg border border-subtle bg-surface-elevated-1 p-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="flex min-w-0 flex-1 items-center gap-3">
					{glyph}
					<div className="min-w-0">
						<p className="m-0 label-md text-primary">{title}</p>
						<p className="m-0 mt-0.5 body-sm text-secondary">{description}</p>
					</div>
				</div>
				{link.state.status === 'linked' ? (
					<div className="flex shrink-0 flex-col items-end gap-2">
						<span className="body-sm whitespace-nowrap text-secondary">
							Linked as {formatHandle(link.state.username)}
						</span>
						<div className="flex gap-2">
							<Button type="button" size="md" onClick={() => link.disconnect()}>
								Disconnect
							</Button>
							<Button type="button" size="md" variant="primary" onClick={() => link.connect()}>
								Switch account
							</Button>
						</div>
					</div>
				) : link.state.status === 'idle' || link.state.status === 'starting' || link.state.status === 'loading' ? (
					<Button
						type="button"
						size="md"
						variant="primary"
						disabled={link.state.status === 'starting' || link.state.status === 'loading'}
						onClick={() => link.connect()}
					>
						{link.state.status !== 'idle' ? <LoadingSpinner size={14} /> : null}
						{link.state.status === 'starting' ? 'Opening…' : link.state.status === 'loading' ? 'Loading…' : 'Connect'}
					</Button>
				) : null}
			</div>

			{link.state.status === 'awaiting_tg' && (
				<div className="mt-3 rounded-lg bg-surface-elevated-2 p-3 body-sm text-secondary">
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
				<div className="mt-3 rounded-lg bg-surface-elevated-2 p-3 body-sm text-secondary">
					Confirming Telegram link…
				</div>
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
					<Input
						value={codeDraft}
						onChange={(e) => setCodeDraft(e.target.value.replace(/\D/g, '').slice(0, 6))}
						placeholder="6-digit code from Telegram"
						aria-label="Telegram code"
						maxLength={6}
						inputMode="numeric"
						className="flex-1"
					/>
					<Button type="submit" size="md" variant="primary" disabled={codeDraft.length !== 6}>
						Confirm
					</Button>
				</form>
			)}

			{link.state.status === 'awaiting_code' && inlineError && (
				<p role="alert" className="mt-2 body-sm text-error">
					{inlineError}
				</p>
			)}

			{link.state.status === 'switch_confirm' && (
				<div className="mt-3 rounded-lg border border-warning/40 bg-warning/10 p-3 body-sm text-primary">
					<p className="m-0 mb-2">
						You&apos;re already linked to {formatHandle(link.state.currentTelegramUsername)}. Switch to this Telegram?
					</p>
					<div className="flex gap-2">
						<Button
							type="button"
							size="md"
							variant="primary"
							onClick={() => {
								link.confirmSwitch().then((consumed) => {
									if (consumed) onInitialStateConsumed?.()
								})
							}}
						>
							Yes, switch
						</Button>
						<Button
							type="button"
							size="md"
							onClick={() => {
								link.cancelSwitch()
								onInitialStateConsumed?.()
							}}
						>
							Cancel
						</Button>
					</div>
				</div>
			)}

			{link.state.status === 'error' && (
				<div className="mt-3">
					<InlineStatus variant="error">{link.state.message}</InlineStatus>
				</div>
			)}
		</div>
	)
}
