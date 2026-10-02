import * as Ariakit from '@ariakit/react'
import type { TurnstileInstance } from '@marsidev/react-turnstile'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { TokenLogo } from '~/components/TokenLogo'
import { Turnstile } from '~/containers/Subscription/Turnstile'
import { useStorageItem } from '~/contexts/localStorageStore'
import { useNowSeconds } from '~/hooks/useNowSeconds'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { CopyHelper } from '~/ui/Copy'
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '~/ui/Dialog'
import { takeLostFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { InlineStatus } from '~/ui/Status'
import { fetchInviteAvailability, revealInvite } from './inviteApi'

type InviteBannerProps = { protocol: string; name: string; website: string | null }

export function InviteBanner({ protocol, name, website }: InviteBannerProps) {
	const [open, setOpen] = useState(false)
	const hasRequestedCode = Boolean(useStorageItem(`protocol-invite:${protocol}`, null))
	const queryClient = useQueryClient()
	const availability = useQuery({
		queryKey: ['protocol-invites', protocol],
		queryFn: ({ signal }) => fetchInviteAvailability({ protocol, signal }),
		staleTime: 30_000,
		retry: 1
	})

	if (!availability.data?.available && !hasRequestedCode && !open) return null

	return (
		<Ariakit.DialogProvider open={open} setOpen={setOpen}>
			<Card padding="strip" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-3">
					<TokenLogo name={name} kind="token" size={28} alt="" />
					<div>
						<p className="label-md text-primary">Skip the {name} waitlist</p>
						<p className="body-md text-secondary">Invite-only access. Grab a code and start trading.</p>
					</div>
				</div>
				<Ariakit.DialogDisclosure render={<Button size="md" variant="primary" />}>
					<Icon name="key" className="size-4" aria-hidden="true" />
					{hasRequestedCode ? 'View your code' : 'Get invite code'}
				</Ariakit.DialogDisclosure>
			</Card>
			<Dialog size="sm" unmountOnHide portal>
				<InviteDialog
					protocol={protocol}
					name={name}
					website={website}
					onAssigned={() => {
						void queryClient.invalidateQueries({ queryKey: ['protocol-invites', protocol] })
					}}
				/>
			</Dialog>
		</Ariakit.DialogProvider>
	)
}

function InviteDialog({ protocol, name, website, onAssigned }: InviteBannerProps & { onAssigned: () => void }) {
	const [token, setToken] = useState('')
	const [verificationError, setVerificationError] = useState(false)
	const turnstile = useRef<TurnstileInstance>(undefined)
	const claim = useMutation({
		mutationFn: revealInvite,
		retry: false,
		onSuccess: (result) => {
			setToken('')
			const nextAttemptAt =
				result.status === 'assigned' ? result.refreshAt : result.status === 'cooldown' ? result.retryAt : null
			// An existing assignment can already be eligible for refresh, leaving the widget mounted.
			if (nextAttemptAt && Date.parse(nextAttemptAt) <= Date.now()) turnstile.current?.reset()
			if (result.status === 'assigned') onAssigned()
		},
		onError: () => {
			turnstile.current?.reset()
		}
	})
	const result = claim.data
	const retryAt =
		result?.status === 'assigned' ? result.refreshAt : result?.status === 'cooldown' ? result.retryAt : null
	// The dialog body mounts only after the visitor opens it, never while hydrating. The clock ticks every second
	// from the claim on, so a new retry time is measured against a current second.
	const nowSeconds = useNowSeconds(undefined, claim.isPending || retryAt ? 1000 : 30_000)
	const minutesLeft = retryAt ? Math.max(0, Math.ceil((Math.floor(Date.parse(retryAt) / 1000) - nowSeconds) / 60)) : 0

	const canRequest = minutesLeft === 0 && result?.status !== 'unavailable' && !verificationError
	const submit = () => {
		if (!token || claim.isPending || minutesLeft > 0) return
		claim.mutate({
			protocol,
			turnstileToken: token,
			refresh: result?.status === 'assigned' || claim.variables?.refresh === true
		})
		setToken('')
	}

	return (
		<>
			<DialogHeader
				title={
					result?.status === 'assigned'
						? `Your ${name} invite`
						: result?.status === 'cooldown' && minutesLeft > 0
							? `Try again in ${minutesLeft} min`
							: result?.status === 'unavailable'
								? 'No invite codes available'
								: `Get a ${name} invite code`
				}
			/>
			<DialogBody>
				{result?.status === 'assigned' ? (
					<>
						<p className="body-md text-secondary">Copy your code, then enter it when joining {name}.</p>
						<div className="flex items-center justify-between gap-4 rounded-lg border border-medium bg-surface p-4">
							<output
								ref={takeLostFocus}
								tabIndex={-1}
								className="min-w-0 mono-xl tracking-widest break-all text-primary"
								aria-label="Invite code"
							>
								{result.code}
							</output>
							<CopyHelper toCopy={result.code} size={20} aria-label="Copy invite code" />
						</div>
						<p className="body-md text-secondary">
							{minutesLeft > 0
								? `Need another code? Try again in ${minutesLeft} min.`
								: 'Code already used? You can try another.'}
						</p>
					</>
				) : !result && !claim.isError ? (
					<p className="body-md text-secondary">
						Use an invite code to join {name}. Verify below, then reveal your code.
					</p>
				) : null}
				{result?.status === 'cooldown' ? (
					<p role="status" className="body-md text-secondary">
						{minutesLeft > 0
							? 'A code was recently requested on your network.'
							: 'You can request a code now. Verify below to continue.'}
					</p>
				) : null}
				{result?.status === 'unavailable' ? (
					<p role="status" className="body-md text-secondary">
						Please check back later.
					</p>
				) : null}
				{claim.isError ? <InlineStatus variant="error">{claim.error.message}</InlineStatus> : null}
				{minutesLeft === 0 && result?.status !== 'unavailable' ? (
					<>
						{claim.isError ? <p className="body-md text-secondary">Verify again, then retry your request.</p> : null}
						<Turnstile
							ref={turnstile}
							action={`${protocol}_invite`}
							onVerify={(value) => {
								setToken(value)
								setVerificationError(false)
							}}
							onExpire={() => setToken('')}
							onError={() => {
								setToken('')
								setVerificationError(true)
							}}
						/>
						{verificationError ? (
							<InlineStatus variant="error">
								<span className="flex flex-wrap items-center justify-between gap-2">
									Verification could not load.
									<Button
										type="button"
										size="sm"
										onClick={() => {
											setVerificationError(false)
											turnstile.current?.reset()
										}}
									>
										Try again
									</Button>
								</span>
							</InlineStatus>
						) : null}
					</>
				) : null}
			</DialogBody>
			{canRequest || (result?.status === 'assigned' && website) ? (
				<DialogFooter>
					{canRequest ? (
						// Focusable while disabled: a failed claim clears the verification token, which disables the button the
						// reader just pressed.
						<Button
							type="button"
							size="md"
							variant={result?.status === 'assigned' ? 'secondary' : 'primary'}
							pendingLabel={claim.isPending ? 'Getting your code…' : null}
							disabled={!token && !claim.isPending}
							accessibleWhenDisabled
							onClick={submit}
						>
							{result?.status === 'assigned' ? 'Try another code' : claim.isError ? 'Try again' : 'Reveal my code'}
						</Button>
					) : null}
					{result?.status === 'assigned' && website ? (
						<Button as="a" href={website} target="_blank" rel="noopener noreferrer" variant="primary" size="md">
							Open {name}
							<Icon name="arrow-up-right" className="size-4" aria-hidden="true" />
						</Button>
					) : null}
				</DialogFooter>
			) : null}
		</>
	)
}
