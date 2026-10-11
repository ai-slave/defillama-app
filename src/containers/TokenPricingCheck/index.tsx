import { useQuery } from '@tanstack/react-query'
import { useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { TokenLogo } from '~/components/TokenLogo'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Field } from '~/ui/Field'
import { showFieldErrors } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { SelectWithCombobox } from '~/ui/SelectWithCombobox'
import { InlineStatus } from '~/ui/Status'
import { formatDateTime } from '~/utils/dateFormat'
import { formatUsd } from '~/utils/numberFormat'
import { queryReadFailed } from '~/utils/query'
import { checkTokenPricingDetails, fetchPricingChains, tokenPriceKey } from './api'
import { pricingChainName } from './chains'

type PricingDetails = Awaited<ReturnType<typeof checkTokenPricingDetails>>
type CheckResult =
	| { status: 'idle' | 'loading' }
	| { status: 'done'; key: string; details: PricingDetails }
	| { status: 'error'; message: string }

const ADDRESS_PLACEHOLDERS: Record<string, string> = {
	solana: 'Token mint address',
	tron: 'Base58 or hex contract address',
	ton: 'Jetton master address'
}

/** What stops this address from forming a price key: an empty field, or a value the key format refuses. */
function addressError(chain: string, address: string): string | null {
	if (!address.trim()) return 'Enter a token address or ID.'
	if (!chain) return null
	try {
		tokenPriceKey(chain, address)
		return null
	} catch (error) {
		return (error as Error).message
	}
}

function PricingResult({ tokenKey, details }: { tokenKey: string; details: PricingDetails }) {
	const { currentPrice, firstPrice } = details
	const firstRecorded =
		firstPrice.status === 'available'
			? (formatDateTime(firstPrice.value, { input: 'seconds', timeZone: 'UTC' }) ?? 'Unknown')
			: firstPrice.status === 'missing'
				? 'No record returned'
				: 'Lookup unavailable'
	return (
		<Card padding="strip" className="flex flex-col gap-3" role="status" aria-live="polite">
			<div className="flex flex-wrap items-center gap-2">
				<Icon
					name={currentPrice ? 'check-circle' : 'help-circle'}
					className={currentPrice ? 'size-4.5 shrink-0 text-success' : 'size-4.5 shrink-0 text-warning'}
				/>
				<h2 className="label-lg text-primary">{currentPrice ? 'Pricing available' : 'No price returned'}</h2>
				{currentPrice?.symbol ? (
					<span className="max-w-full rounded-md bg-surface-elevated-1 px-2 py-0.5 label-sm break-all text-secondary">
						{currentPrice.symbol}
					</span>
				) : null}
			</div>

			<dl className={`grid gap-3 border-t border-subtle pt-3 ${currentPrice ? 'sm:grid-cols-2 xl:grid-cols-3' : ''}`}>
				{currentPrice ? (
					<div>
						<dt className="label-sm text-secondary">Current price</dt>
						<dd className="mono-xl break-all text-primary">
							{formatUsd(currentPrice.price, { maximumSignificantDigits: 6 })}
						</dd>
					</div>
				) : null}
				{currentPrice ? (
					<div>
						<dt className="label-sm text-secondary">Last updated</dt>
						<dd className="body-md text-primary">
							{formatDateTime(currentPrice.timestamp, { input: 'seconds', timeZone: 'UTC' }) ?? 'Unknown'}
						</dd>
					</div>
				) : null}
				<div>
					<dt className="label-sm text-secondary">Earliest API price</dt>
					<dd className="body-md text-primary">{firstRecorded}</dd>
				</div>
			</dl>

			<p className="border-t border-subtle pt-2 mono-sm break-all text-secondary">{tokenKey}</p>
		</Card>
	)
}

export function TokenPricingCheck({ chainDisplayNames }: { chainDisplayNames: Record<string, string> }) {
	const moveHintId = useId()
	const requestId = useRef(0)
	const [chain, setChain] = useState('')
	const [address, setAddress] = useState('')
	const [result, setResult] = useState<CheckResult>({ status: 'idle' })
	const [submitted, setSubmitted] = useState(false)
	const chainsQuery = useQuery({
		queryKey: ['price-check', 'chains'],
		queryFn: fetchPricingChains,
		staleTime: 60 * 60 * 1000,
		retry: false
	})
	const chainOptions = useMemo(
		() =>
			(chainsQuery.data ?? [])
				.map((key) => {
					const name = pricingChainName(key, chainDisplayNames)
					return {
						key,
						name,
						icon: (
							<span className="order-first flex size-4.5 shrink-0 items-center justify-center">
								<TokenLogo name={name} kind="chain" size={18} />
							</span>
						)
					}
				})
				.sort((a, b) => a.name.localeCompare(b.name)),
		[chainsQuery.data, chainDisplayNames]
	)
	const selectedChain = chainOptions.find((option) => option.key === chain)
	const moveTokenExample = chain === 'sui' ? '0x2::sui::SUI' : chain === 'aptos' ? '0x1::aptos_coin::AptosCoin' : null

	function resetResult() {
		requestId.current += 1
		setResult({ status: 'idle' })
	}

	const chainError = chain ? null : 'Choose a chain.'
	const tokenError = addressError(chain, address)

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (chainError || tokenError) return showFieldErrors(event.currentTarget, () => setSubmitted(true))
		const currentRequest = ++requestId.current
		const key = tokenPriceKey(chain, address)
		setResult({ status: 'loading' })
		try {
			const details = await checkTokenPricingDetails(key)
			if (currentRequest !== requestId.current) return
			setResult({ status: 'done', key, details })
		} catch {
			if (currentRequest !== requestId.current) return
			setResult({ status: 'error', message: "Couldn't check pricing right now. Try again." })
		}
	}

	return (
		<div className="flex w-full flex-col gap-3">
			<Card padding="md" className="flex flex-col gap-4">
				<div className="flex flex-col gap-1">
					<h1 className="heading-sm">Token pricing coverage</h1>
					<p className="body-md text-secondary">
						Check the current price and earliest price timestamp returned by DefiLlama.
					</p>
				</div>
				<form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
					{/* From md the fields share subgrid rows (label, control, error), so an error under one field never moves the
					    controls beside it. */}
					<div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] md:grid-rows-[auto_auto_auto] md:gap-y-1">
						<Field
							label="Chain"
							error={submitted ? chainError : null}
							className="md:row-span-3 md:grid md:grid-rows-subgrid"
						>
							{(control) => (
								<div className="relative">
									<SelectWithCombobox
										allValues={chainOptions}
										selectedValues={chain ? [chain] : []}
										setSelectedValues={(values) => {
											setChain(values[0] ?? '')
											resetResult()
										}}
										label={selectedChain?.name ?? (chainsQuery.isPending ? 'Loading chains…' : 'Select a chain')}
										variant="input"
										size="md"
										singleSelect
										searchPlaceholder="Search chains…"
										popoverWidth="trigger"
										className={`w-full justify-between ${selectedChain ? 'pl-9' : ''}`}
										triggerProps={{
											...control,
											'aria-label': 'Chain',
											disabled: chainsQuery.isPending || chainsQuery.isError
										}}
									/>
									{selectedChain ? (
										<span
											aria-hidden="true"
											className="pointer-events-none absolute inset-y-0 left-3 flex items-center"
										>
											<TokenLogo name={selectedChain.name} kind="chain" size={18} />
										</span>
									) : null}
								</div>
							)}
						</Field>
						<Field
							label="Token address or ID"
							error={submitted ? tokenError : null}
							className="md:row-span-3 md:grid md:grid-rows-subgrid"
						>
							{(control) => (
								<Input
									{...control}
									// The Move hint sits under the whole form row, outside the Field.
									aria-describedby={
										[control['aria-describedby'], moveTokenExample ? moveHintId : null].filter(Boolean).join(' ') ||
										undefined
									}
									autoCapitalize="off"
									autoComplete="off"
									spellCheck={false}
									value={address}
									onChange={(event) => {
										setAddress(event.currentTarget.value)
										resetResult()
									}}
									placeholder={moveTokenExample ?? ADDRESS_PLACEHOLDERS[chain] ?? 'Token address or identifier'}
									className="w-full"
									required
								/>
							)}
						</Field>
						<Button
							type="submit"
							size="md"
							variant="primary"
							// The chain list gates the form: the submit waits while it loads, and stays off beside the failure and its Retry.
							// Two short labels of near-equal width, so the button barely moves when the chain list arrives.
							pendingLabel={chainsQuery.isPending ? 'Loading…' : 'Checking…'}
							pending={result.status === 'loading' || chainsQuery.isPending}
							disabled={chainsQuery.isError}
							className="w-full md:col-start-3 md:row-start-2 md:w-auto"
						>
							Check pricing
						</Button>
					</div>
					{moveTokenExample ? (
						<p id={moveHintId} className="body-sm text-secondary">
							For Move tokens, enter a coin type such as {moveTokenExample}.
						</p>
					) : null}
					{queryReadFailed(chainsQuery) ? (
						<InlineStatus variant="error" retry={chainsQuery}>
							Couldn&rsquo;t load the supported chains.
						</InlineStatus>
					) : null}
				</form>
			</Card>
			{result.status === 'done' ? (
				<PricingResult tokenKey={result.key} details={result.details} />
			) : result.status === 'error' ? (
				<InlineStatus variant="error">{result.message}</InlineStatus>
			) : null}
		</div>
	)
}
