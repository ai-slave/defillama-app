import * as Ariakit from '@ariakit/react'
import type { TurnstileInstance } from '@marsidev/react-turnstile'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { TokenLogo } from '~/components/TokenLogo'
import { Turnstile } from '~/containers/Subscription/Turnstile'
import { useStorageItem } from '~/contexts/localStorageStore'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { CopyHelper } from '~/ui/Copy'
import { DialogCloseButton, DialogHeading, dialogScrollableBodyStyles, dialogSurfaceStyles } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
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
			{/* The recipe's 40dvh drawer floor leaves a short invite form floating in empty space on phones. */}
			<Ariakit.Dialog
				className={`${dialogSurfaceStyles} [--dialog-width:440px]`}
				backdrop={<div className="fixed inset-0 z-50 bg-screen-dim" />}
				unmountOnHide
			>
				<InviteDialog
					protocol={protocol}
					name={name}
					website={website}
					onAssigned={() => {
						void queryClient.invalidateQueries({ queryKey: ['protocol-invites', protocol] })
					}}
				/>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}

function InviteDialog({ protocol, name, website, onAssigned }: InviteBannerProps & { onAssigned: () => void }) {
	const [token, setToken] = useState('')
	const [verificationError, setVerificationError] = useState(false)
	const [now, setNow] = useState(Date.now)
	const turnstile = useRef<TurnstileInstance>(undefined)
	const claim = useMutation({
		mutationFn: revealInvite,
		retry: false,
		onSuccess: (result) => {
			setToken('')
			setNow(Date.now())
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
	const minutesLeft = retryAt ? Math.max(0, Math.ceil((Date.parse(retryAt) - now) / 60_000)) : 0

	useEffect(() => {
		if (!retryAt) return
		const timer = setInterval(() => setNow(Date.now()), 1000)
		return () => clearInterval(timer)
	}, [retryAt])

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
			<div className="flex items-center justify-between gap-3 border-b border-subtle p-3">
				<DialogHeading>
					{result?.status === 'assigned'
						? `Your ${name} invite`
						: result?.status === 'cooldown' && minutesLeft > 0
							? `Try again in ${minutesLeft} min`
							: result?.status === 'unavailable'
								? 'No invite codes available'
								: `Get a ${name} invite code`}
				</DialogHeading>
				<DialogCloseButton />
			</div>
			<div className={`${dialogScrollableBodyStyles} flex flex-col gap-4 p-3`}>
				{result?.status === 'assigned' ? (
					<>
						<p className="body-md text-secondary">Copy your code, then enter it when joining {name}.</p>
						<div className="flex items-center justify-between gap-4 rounded-lg border border-medium bg-surface p-4">
							<output className="min-w-0 mono-xl tracking-widest break-all text-primary" aria-label="Invite code">
								{result.code}
							</output>
							<CopyHelper toCopy={result.code} size={20} aria-label="Copy invite code" />
						</div>
						{website ? (
							<Button as="a" href={website} target="_blank" rel="noopener noreferrer" variant="primary" size="md">
								Open {name}
								<Icon name="arrow-up-right" className="size-4" aria-hidden="true" />
							</Button>
						) : null}
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
				{claim.isError ? (
					<p role="alert" className="body-sm text-data-down">
						{claim.error.message}
					</p>
				) : null}
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
							<div className="flex items-center justify-between gap-3">
								<p role="alert" className="body-sm text-data-down">
									Verification could not load.
								</p>
								<Button
									type="button"
									size="md"
									variant="secondary"
									onClick={() => {
										setVerificationError(false)
										turnstile.current?.reset()
									}}
								>
									Try again
								</Button>
							</div>
						) : (
							<Button
								type="button"
								size="md"
								variant={result?.status === 'assigned' ? 'secondary' : 'primary'}
								disabled={!token || claim.isPending}
								onClick={submit}
							>
								{claim.isPending
									? 'Getting your code…'
									: result?.status === 'assigned'
										? 'Try another code'
										: claim.isError
											? 'Try again'
											: 'Reveal my code'}
							</Button>
						)}
					</>
				) : null}
			</div>
		</>
	)
}
