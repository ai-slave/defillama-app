import * as Ariakit from '@ariakit/react'
import { lazy, Suspense, useCallback, useId, useState } from 'react'
import { useCreateTopup, TOPUP_CONFIG } from '~/containers/Subscription/useTopup'
import { Button } from '~/ui/Button'
import { Dialog, DialogBackButton, DialogBody, DialogHeader } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { InlineStatus } from '~/ui/Status'
import { formatUsd } from '~/utils/numberFormat'
import { TopupCheckoutLoading } from './TopupCheckoutLoading'

// Keep the amount form immediate; card payments alone need Stripe.
const TopupStripeCheckout = lazy(() => import('./TopupStripeCheckout'))

interface TopupModalProps {
	isOpen: boolean
	onClose: () => void
}

export function TopupModal({ isOpen, onClose }: TopupModalProps) {
	const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/account'
	const origin = typeof window !== 'undefined' ? window.location.origin : ''
	return (
		<Dialog size="sm" fullSheet open={isOpen} onClose={onClose} portal unmountOnHide>
			<TopupForm inDialog redirectUrl={`${origin}${currentPath}?topup=success`} cancelUrl={`${origin}${currentPath}`} />
		</Dialog>
	)
}

export function TopupForm({
	inDialog,
	redirectUrl,
	cancelUrl
}: {
	inDialog: boolean
	redirectUrl: string
	cancelUrl: string
}) {
	const amountId = useId()
	const dialog = Ariakit.useDialogContext()
	const [amount, setAmount] = useState('10')
	const [step, setStep] = useState<'select' | 'stripe'>('select')
	const [isRedirecting, setIsRedirecting] = useState(false)
	const topupMutation = useCreateTopup()

	const parsedAmount = parseFloat(amount)
	const isValidAmount =
		Number.isFinite(parsedAmount) && parsedAmount >= TOPUP_CONFIG.minAmount && parsedAmount <= TOPUP_CONFIG.maxAmount

	const hasAmountError = amount !== '' && !isValidAmount
	const amountMessageId = `${amountId}-message`
	const isPaymentPending = topupMutation.isPending || isRedirecting
	const fetchClientSecret = useCallback(async (): Promise<string> => {
		const result = await topupMutation.mutateAsync({
			amount: parsedAmount,
			provider: 'stripe',
			redirectUrl,
			cancelUrl
		})
		if (result.provider === 'stripe') return result.clientSecret
		throw new Error('Unexpected response from topup endpoint')
	}, [topupMutation, parsedAmount, redirectUrl, cancelUrl])

	const handleStripe = useCallback(() => {
		if (!isValidAmount || isPaymentPending) return
		// The card step hides itself while the mutation holds an error, so a failed crypto attempt must not carry over.
		topupMutation.reset()
		setStep('stripe')
	}, [isValidAmount, isPaymentPending, topupMutation])

	const handleLlamaPay = () => {
		if (!isValidAmount || isPaymentPending) return
		setIsRedirecting(true)
		topupMutation.mutate(
			{ amount: parsedAmount, provider: 'llamapay', redirectUrl, cancelUrl },
			{
				// Closing the dialog cancels the redirect: mutate() callbacks are dropped once the form unmounts,
				// and the open check covers the dialog's leave animation before that.
				onSuccess: (result) => {
					if (dialog && !dialog.getState().open) return
					if (result.provider === 'llamapay') window.location.href = result.checkoutUrl
				},
				onError: () => setIsRedirecting(false)
			}
		)
	}

	const handleAmountInput = (value: string) => {
		const cleaned = value.replace(/[^0-9.]/g, '')
		const parts = cleaned.split('.')
		if (parts.length > 2) return
		if (parts[1] && parts[1].length > 2) return
		setAmount(cleaned)
	}

	const goBack = () => {
		setStep('select')
		topupMutation.reset()
	}

	const errorMessage = topupMutation.error?.message ?? null
	const stripeDescription = (
		<>
			Top up{' '}
			<span className="font-medium text-primary">
				{formatUsd(parsedAmount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
			</span>{' '}
			to your External Data Balance
		</>
	)

	const content = (
		<>
			{step === 'select' ? (
				<>
					<div className="flex flex-col gap-2">
						<label htmlFor={amountId} className="label-sm text-secondary">
							Amount (USD)
						</label>
						<div className="relative">
							{/* The same size as the field's text, which stays 16px below sm so iOS does not zoom. */}
							<span
								aria-hidden="true"
								className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base text-secondary sm:body-sm"
							>
								$
							</span>
							{/* Ariakit's autoFocus, so the dialog starts on the field instead of the header ×. */}
							<Ariakit.Focusable
								autoFocus={inDialog}
								render={
									<Input
										id={amountId}
										type="text"
										inputMode="decimal"
										value={amount}
										onChange={(e) => handleAmountInput(e.target.value)}
										placeholder="0.00"
										disabled={isPaymentPending}
										aria-invalid={hasAmountError || undefined}
										aria-describedby={isValidAmount ? undefined : amountMessageId}
										className="w-full pl-7"
									/>
								}
							/>
						</div>
						{hasAmountError ? (
							<p id={amountMessageId} role="alert" className="body-sm text-error">
								Enter an amount between ${TOPUP_CONFIG.minAmount} and ${TOPUP_CONFIG.maxAmount}
							</p>
						) : amount === '' ? (
							// Both pay buttons are disabled without an amount; this says why.
							<p id={amountMessageId} className="body-sm text-secondary">
								Enter an amount
							</p>
						) : null}
					</div>
					<div role="group" aria-label="Suggested amounts" className="flex gap-2">
						{TOPUP_CONFIG.quickAmounts.map((qa) => (
							<Button
								type="button"
								key={qa}
								size="md"
								variant="toggle"
								data-active={parsedAmount === qa}
								aria-pressed={parsedAmount === qa}
								disabled={isPaymentPending}
								onClick={() => setAmount(String(qa))}
								className="flex-1"
							>
								${qa}
							</Button>
						))}
					</div>
					<fieldset className="flex flex-col gap-2">
						<legend className="mb-2 label-sm text-secondary">Payment method</legend>
						<div className="grid grid-cols-2 gap-2">
							<Button type="button" size="md" onClick={handleStripe} disabled={!isValidAmount || isPaymentPending}>
								<Icon name="credit-card" height={14} width={14} />
								Pay with card
							</Button>
							<Button
								type="button"
								size="md"
								onClick={handleLlamaPay}
								disabled={!isValidAmount}
								pendingLabel={isRedirecting ? 'Redirecting…' : null}
							>
								<Icon name="wallet" height={14} width={14} />
								Pay with crypto
							</Button>
						</div>
					</fieldset>
					<span role="status" className="sr-only">
						{isRedirecting ? 'Redirecting…' : ''}
					</span>
				</>
			) : errorMessage ? null : (
				<Suspense fallback={<TopupCheckoutLoading />}>
					<TopupStripeCheckout fetchClientSecret={fetchClientSecret} isPending={topupMutation.isPending} />
				</Suspense>
			)}
			{errorMessage ? <InlineStatus variant="error">{errorMessage}</InlineStatus> : null}
		</>
	)

	if (inDialog) {
		return (
			<>
				<DialogHeader
					leading={step === 'stripe' ? <DialogBackButton label="Back to amount" onClick={goBack} /> : null}
					title={step === 'stripe' ? 'Complete payment' : 'Top up balance'}
					subtitle={
						<Ariakit.DialogDescription render={<span />}>
							{step === 'stripe' ? stripeDescription : 'Add credits for LlamaAI to access premium data'}
						</Ariakit.DialogDescription>
					}
				/>
				<DialogBody>{content}</DialogBody>
			</>
		)
	}

	return (
		<>
			<header className="flex flex-col gap-1">
				<div className="flex items-center gap-2">
					{step === 'stripe' ? (
						<Button type="button" variant="ghost" size="md" square aria-label="Back to amount" onClick={goBack}>
							<Icon name="arrow-left" height={16} width={16} />
						</Button>
					) : null}
					<h3 className="min-w-0 flex-1 label-md text-primary">{step === 'stripe' ? 'Complete payment' : 'Top up'}</h3>
				</div>
				{step === 'stripe' ? <p className="body-md text-secondary">{stripeDescription}</p> : null}
			</header>
			<div className="flex flex-col gap-4">{content}</div>
		</>
	)
}
