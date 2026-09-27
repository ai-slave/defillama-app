import * as Ariakit from '@ariakit/react'
import { lazy, Suspense, useCallback, useId, useState } from 'react'
import { useCreateTopup, TOPUP_CONFIG } from '~/containers/Subscription/useTopup'
import { Button } from '~/ui/Button'
import { DialogCloseButton, DialogHeading, dialogScrollableBodyStyles, dialogFullSheetSurfaceStyles } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
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
		<Ariakit.DialogProvider
			open={isOpen}
			setOpen={(open) => {
				if (!open) onClose()
			}}
		>
			<Ariakit.Dialog className={`${dialogFullSheetSurfaceStyles} [--dialog-width:420px]`} portal unmountOnHide>
				<TopupForm
					inDialog
					redirectUrl={`${origin}${currentPath}?topup=success`}
					cancelUrl={`${origin}${currentPath}`}
				/>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
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
	const [amount, setAmount] = useState('10')
	const [step, setStep] = useState<'select' | 'stripe'>('select')
	const [isRedirecting, setIsRedirecting] = useState(false)
	const topupMutation = useCreateTopup()

	const parsedAmount = parseFloat(amount)
	const isValidAmount =
		Number.isFinite(parsedAmount) && parsedAmount >= TOPUP_CONFIG.minAmount && parsedAmount <= TOPUP_CONFIG.maxAmount

	const hasAmountError = amount !== '' && !isValidAmount
	const amountErrorId = `${amountId}-error`
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
		setStep('stripe')
	}, [isValidAmount, isPaymentPending])

	const handleLlamaPay = useCallback(async () => {
		if (!isValidAmount || isPaymentPending) return
		setIsRedirecting(true)
		try {
			const result = await topupMutation.mutateAsync({
				amount: parsedAmount,
				provider: 'llamapay',
				redirectUrl,
				cancelUrl
			})
			if (result.provider === 'llamapay') {
				window.location.href = result.checkoutUrl
			}
		} catch {
			setIsRedirecting(false)
		}
	}, [isValidAmount, isPaymentPending, parsedAmount, topupMutation, redirectUrl, cancelUrl])

	const handleAmountInput = (value: string) => {
		const cleaned = value.replace(/[^0-9.]/g, '')
		const parts = cleaned.split('.')
		if (parts.length > 2) return
		if (parts[1] && parts[1].length > 2) return
		setAmount(cleaned)
	}

	const errorMessage = topupMutation.error?.message ?? null

	const Heading = inDialog ? DialogHeading : 'h3'
	const Description = inDialog ? Ariakit.DialogDescription : 'p'
	return (
		<>
			<header className={`flex flex-col gap-1 ${inDialog ? 'border-b border-subtle p-3' : ''}`}>
				<div className="flex items-center gap-2">
					{step === 'stripe' ? (
						<Button
							type="button"
							variant="ghost"
							size="md"
							square
							aria-label="Back to amount"
							onClick={() => {
								setStep('select')
								topupMutation.reset()
							}}
						>
							<Icon name="arrow-left" height={16} width={16} />
						</Button>
					) : null}
					<Heading className={`min-w-0 flex-1 ${inDialog ? 'heading-sm' : 'label-md text-primary'}`}>
						{step === 'stripe' ? 'Complete Payment' : inDialog ? 'Top Up Balance' : 'Top up'}
					</Heading>
					{inDialog ? <DialogCloseButton ariaLabel="Close balance dialog" /> : null}
				</div>
				{inDialog || step === 'stripe' ? (
					<Description className="body-md text-secondary">
						{step === 'stripe' ? (
							<>
								Top up{' '}
								<span className="font-medium text-primary">
									{formatUsd(parsedAmount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
								</span>{' '}
								to your External Data Balance
							</>
						) : (
							'Add credits for LlamaAI to access premium data'
						)}
					</Description>
				) : null}
			</header>
			<div className={`flex flex-col gap-4 ${inDialog ? `${dialogScrollableBodyStyles} p-3` : ''}`}>
				{step === 'select' ? (
					<>
						<div className="flex flex-col gap-2">
							<label htmlFor={amountId} className="label-md text-primary">
								Amount (USD)
							</label>
							<div className="relative">
								<span
									aria-hidden="true"
									className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 body-md text-secondary"
								>
									$
								</span>
								<input
									id={amountId}
									type="text"
									inputMode="decimal"
									value={amount}
									onChange={(e) => handleAmountInput(e.target.value)}
									placeholder="0.00"
									disabled={isPaymentPending}
									aria-invalid={hasAmountError || undefined}
									aria-describedby={hasAmountError ? amountErrorId : undefined}
									autoFocus={inDialog}
									className="h-10 w-full rounded-lg border border-medium bg-page pr-3 pl-7 text-base text-primary placeholder:text-tertiary focus:border-brand focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-error sm:body-md"
								/>
							</div>
							{hasAmountError ? (
								<p id={amountErrorId} role="alert" className="body-sm text-error">
									Enter an amount between ${TOPUP_CONFIG.minAmount} and ${TOPUP_CONFIG.maxAmount}
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
							<legend className="mb-2 label-md text-primary">Payment method</legend>
							<div className="grid grid-cols-2 gap-2">
								<Button type="button" size="md" onClick={handleStripe} disabled={!isValidAmount || isPaymentPending}>
									<Icon name="credit-card" height={14} width={14} />
									Pay with Card
								</Button>
								<Button
									type="button"
									size="md"
									onClick={() => void handleLlamaPay()}
									disabled={!isValidAmount || isPaymentPending}
									aria-busy={isRedirecting || undefined}
								>
									{isRedirecting ? <LoadingSpinner size={14} /> : <Icon name="wallet" height={14} width={14} />}
									<span role={isRedirecting ? 'status' : undefined}>
										{isRedirecting ? 'Redirecting…' : 'Pay with Crypto'}
									</span>
								</Button>
							</div>
						</fieldset>
					</>
				) : errorMessage ? null : (
					<Suspense fallback={<TopupCheckoutLoading />}>
						<TopupStripeCheckout fetchClientSecret={fetchClientSecret} isPending={topupMutation.isPending} />
					</Suspense>
				)}
				{errorMessage ? (
					<div
						role="alert"
						className="flex items-start gap-2 rounded-lg border border-error/30 bg-error/10 p-3 body-md text-error"
					>
						<Icon name="alert-warning" height={16} width={16} className="shrink-0" />
						<p>{errorMessage}</p>
					</div>
				) : null}
			</div>
		</>
	)
}
