import * as Ariakit from '@ariakit/react'
import { useRef, useState, type ReactNode } from 'react'
import type { TelegramStatus } from '~/containers/LlamaAI/api/telegram'
import { LlamaAITransportError } from '~/containers/LlamaAI/api/transport'
import { useIntegrationLink } from '~/containers/LlamaAI/hooks/useIntegrationLink'
import { Button } from '~/ui/Button'
import { ConfirmDialog } from '~/ui/ConfirmDialog'
import { Field } from '~/ui/Field'
import { showFieldErrors, takeLostFocus } from '~/ui/focus'
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

	const [codeDraft, setCodeDraft] = useState('')
	const [submitted, setSubmitted] = useState(false)
	// Why the last confirm failed: the server refused the code (any 4xx), or the request itself failed (a 5xx, going
	// offline). The next edit clears it.
	const [confirmFailure, setConfirmFailure] = useState<'code' | 'request' | null>(null)
	const codeError =
		submitted && codeDraft.length !== 6
			? 'Enter the 6-digit code from Telegram.'
			: confirmFailure === 'code'
				? "That code didn't work. Check it in Telegram and try again."
				: null
	const confirming = link.state.status === 'confirming' ? link.state.step : null
	const linkedHandle = link.state.status === 'linked' ? formatHandle(link.state.username) : ''
	const [disconnectHandle, setDisconnectHandle] = useState<string | null>(null)
	const rowRef = useRef<HTMLDivElement>(null)
	const error =
		link.startError ??
		(link.state.status === 'error' ? link.state.message : null) ??
		(confirmFailure === 'request' ? "Couldn't confirm the code. Try again." : null)
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
							<Button
								// A finished code or switch step leaves; the linked account's main action takes its focus.
								ref={takeLostFocus}
								type="button"
								size="md"
								variant="primary"
								pendingLabel="Opening…"
								pending={link.isStarting}
								onClick={() => link.connect()}
							>
								Switch account
							</Button>
						</div>
					</div>
				) : link.state.status === 'idle' ||
				  link.state.status === 'starting' ||
				  link.state.status === 'loading' ||
				  link.state.status === 'error' ? (
					<Button
						ref={takeLostFocus}
						type="button"
						size="md"
						variant="primary"
						pendingLabel={link.state.status === 'loading' ? 'Loading…' : 'Opening…'}
						pending={link.state.status === 'starting' || link.state.status === 'loading'}
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

			{link.state.status === 'awaiting_code' || confirming === 'code' ? (
				<form
					noValidate
					onSubmit={(e) => {
						e.preventDefault()
						const form = e.currentTarget
						if (codeDraft.length !== 6) return showFieldErrors(form, () => setSubmitted(true))
						setConfirmFailure(null)
						link
							.confirmCode(codeDraft)
							.then((result) => {
								if (result && 'linked' in result && result.linked) onInitialStateConsumed?.()
							})
							.catch((caughtError: unknown) => {
								if (
									caughtError instanceof LlamaAITransportError &&
									caughtError.status >= 400 &&
									caughtError.status < 500
								) {
									showFieldErrors(form, () => setConfirmFailure('code'))
								} else setConfirmFailure('request')
							})
					}}
					className="mt-3"
				>
					<Field label="Code from Telegram" hint="Enter the 6-digit code the bot sent you." error={codeError}>
						{(control) => (
							<div className="flex gap-2">
								{/* Ariakit's autoFocus, so Settings opened from a Telegram login link starts on the code instead of its
						    ×, and a cancelled switch returns here. */}
								<Ariakit.Focusable
									autoFocus
									render={
										<Input
											{...control}
											value={codeDraft}
											onChange={(e) => {
												setCodeDraft(e.target.value.replace(/\D/g, '').slice(0, 6))
												setConfirmFailure(null)
											}}
											placeholder="123456"
											maxLength={6}
											inputMode="numeric"
											autoComplete="one-time-code"
											className="flex-1"
										/>
									}
								/>
								<Button
									type="submit"
									size="md"
									variant="primary"
									pendingLabel="Confirming…"
									pending={confirming === 'code'}
								>
									Confirm
								</Button>
							</div>
						)}
					</Field>
				</form>
			) : null}

			{link.state.status === 'switch_confirm' || confirming === 'switch' ? (
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
							pendingLabel="Switching…"
							pending={confirming === 'switch'}
							onClick={() => {
								void link.confirmSwitch().then((consumed) => {
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

			{error ? (
				<div className="mt-3">
					<InlineStatus variant="error">{error}</InlineStatus>
				</div>
			) : null}

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
				pendingLabel="Disconnecting…"
				pending={link.isDisconnecting}
				error={link.disconnectFailed ? "Couldn't disconnect Telegram. Try again." : null}
				onConfirm={link.disconnect}
			/>
		</div>
	)
}
