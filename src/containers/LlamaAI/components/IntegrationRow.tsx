import { useId, useRef, useState, type ReactNode } from 'react'
import type { TelegramStatus } from '~/containers/LlamaAI/api/telegram'
import { useIntegrationLink } from '~/containers/LlamaAI/hooks/useIntegrationLink'
import { Button } from '~/ui/Button'
import { ConfirmDialog } from '~/ui/ConfirmDialog'
import { takeLostFocus } from '~/ui/focus'
import { Input } from '~/ui/Input'
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

	const codeId = useId()
	const [codeDraft, setCodeDraft] = useState('')
	const [inlineError, setInlineError] = useState<string | null>(null)
	// Which prompt started the confirm request, so that prompt stays on screen with its button pending.
	const [confirming, setConfirming] = useState<'code' | 'switch' | null>(null)
	const linkedHandle = link.state.status === 'linked' ? formatHandle(link.state.username) : ''
	const [disconnectHandle, setDisconnectHandle] = useState<string | null>(null)
	const rowRef = useRef<HTMLDivElement>(null)
	// Once unlinked there is nothing left to confirm.
	if (disconnectHandle !== null && link.state.status !== 'linked') setDisconnectHandle(null)

	// Each step replaces the controls of the one before, including the one that had focus, so each step's own control
	// takes focus as it mounts (takeLostFocus). A step with no control of its own leaves it to the Settings dialog's net.
	return (
		<div ref={rowRef} className="rounded-lg border border-subtle bg-surface-elevated-1 p-4">
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
						<span className="body-sm whitespace-nowrap text-secondary">Linked as {linkedHandle}</span>
						<div className="flex gap-2">
							<Button
								type="button"
								size="md"
								onClick={() => {
									link.resetDisconnect()
									setDisconnectHandle(linkedHandle)
								}}
							>
								Disconnect
							</Button>
							<Button type="button" size="md" variant="primary" onClick={() => link.connect()}>
								Switch account
							</Button>
						</div>
					</div>
				) : link.state.status === 'idle' || link.state.status === 'starting' || link.state.status === 'loading' ? (
					<Button
						ref={takeLostFocus}
						type="button"
						size="md"
						variant="primary"
						pendingLabel={
							link.state.status === 'starting' ? 'Opening…' : link.state.status === 'loading' ? 'Loading…' : null
						}
						onClick={() => link.connect()}
					>
						Connect
					</Button>
				) : null}
			</div>

			{link.state.status === 'awaiting_tg' && (
				<div className="mt-3 rounded-lg bg-surface-elevated-2 p-3 body-sm text-secondary">
					Waiting for confirmation in Telegram…
					<div className="mt-2">
						Didn&apos;t see Telegram open?{' '}
						<a ref={takeLostFocus} href={link.state.deepLink} target="_blank" rel="noopener" className="underline">
							DM /start to the bot
						</a>
						.
					</div>
				</div>
			)}

			{link.state.status === 'awaiting_code' || (link.state.status === 'confirming' && confirming === 'code') ? (
				<form
					onSubmit={(e) => {
						e.preventDefault()
						setInlineError(null)
						setConfirming('code')
						link
							.confirmCode(codeDraft)
							.then((result) => {
								if (result && 'linked' in result && result.linked) onInitialStateConsumed?.()
							})
							.catch(() => setInlineError("That code didn't work. Check it in Telegram and try again."))
							.finally(() => setConfirming(null))
					}}
					className="mt-3 flex flex-col gap-1.5"
				>
					<label htmlFor={codeId} className="label-sm text-secondary">
						Code from Telegram
					</label>
					<div className="flex gap-2">
						<Input
							ref={takeLostFocus}
							id={codeId}
							value={codeDraft}
							onChange={(e) => setCodeDraft(e.target.value.replace(/\D/g, '').slice(0, 6))}
							placeholder="123456"
							maxLength={6}
							inputMode="numeric"
							autoComplete="one-time-code"
							aria-invalid={inlineError !== null}
							aria-describedby={`${codeId}-hint`}
							className="flex-1"
						/>
						<Button
							type="submit"
							size="md"
							variant="primary"
							pendingLabel={confirming === 'code' ? 'Confirming…' : null}
							disabled={codeDraft.length !== 6}
						>
							Confirm
						</Button>
					</div>
					{inlineError ? (
						<p id={`${codeId}-hint`} role="alert" className="m-0 body-sm text-error">
							{inlineError}
						</p>
					) : (
						<p id={`${codeId}-hint`} className="m-0 body-sm text-secondary">
							Enter the 6-digit code the bot sent you.
						</p>
					)}
				</form>
			) : null}

			{link.state.status === 'switch_confirm' || (link.state.status === 'confirming' && confirming === 'switch') ? (
				<div className="mt-3 flex flex-col gap-3">
					<InlineStatus variant="warning">
						{link.state.status === 'switch_confirm'
							? `You're already linked to ${formatHandle(link.state.currentTelegramUsername)}. Switch to this Telegram?`
							: "You're already linked to another Telegram account. Switch to this one?"}
					</InlineStatus>
					<div className="flex gap-2">
						<Button
							ref={takeLostFocus}
							type="button"
							size="md"
							variant="primary"
							pendingLabel={confirming === 'switch' ? 'Switching…' : null}
							onClick={() => {
								setConfirming('switch')
								void link.confirmSwitch().then((consumed) => {
									setConfirming(null)
									if (consumed) onInitialStateConsumed?.()
								})
							}}
						>
							Yes, switch
						</Button>
						<Button
							type="button"
							size="md"
							disabled={confirming === 'switch'}
							onClick={() => {
								link.cancelSwitch()
								onInitialStateConsumed?.()
							}}
						>
							Cancel
						</Button>
					</div>
				</div>
			) : null}

			{link.state.status === 'error' && (
				<div className="mt-3">
					<InlineStatus variant="error">{link.state.message}</InlineStatus>
				</div>
			)}

			<ConfirmDialog
				open={disconnectHandle !== null}
				onClose={() => setDisconnectHandle(null)}
				portal
				unmountOnHide
				autoFocusOnHide={(element) => {
					// Unlinking takes the Disconnect button with it; the row's first control, Connect, takes focus.
					if (element) return true
					rowRef.current?.querySelector('button')?.focus()
					return false
				}}
				title="Disconnect Telegram?"
				description={`LlamaAI stops chatting with ${disconnectHandle ?? 'your account'} and sending alerts there.`}
				confirmLabel="Disconnect"
				pendingLabel={link.isDisconnecting ? 'Disconnecting…' : null}
				error={link.disconnectFailed ? "Couldn't disconnect Telegram. Try again." : null}
				onConfirm={link.disconnect}
			/>
		</div>
	)
}
