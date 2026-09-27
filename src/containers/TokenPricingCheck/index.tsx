import { useQuery } from '@tanstack/react-query'
import { useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { TokenLogo } from '~/components/TokenLogo'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { formatDateTime } from '~/utils/dateFormat'
import { formatUsd } from '~/utils/numberFormat'
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
					name={currentPrice ? 'check-circle' : 'circle-help'}
					height={18}
					width={18}
					className={currentPrice ? 'shrink-0 text-success' : 'shrink-0 text-warning'}
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
	const chainId = useId()
	const addressId = useId()
	const moveHintId = useId()
	const requestId = useRef(0)
	const [chain, setChain] = useState('')
	const [address, setAddress] = useState('')
	const [result, setResult] = useState<CheckResult>({ status: 'idle' })
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

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		const currentRequest = ++requestId.current
		let key: string
		try {
			key = tokenPriceKey(chain, address)
		} catch (error) {
			setResult({ status: 'error', message: error instanceof Error ? error.message : 'Invalid token.' })
			return
		}

		setResult({ status: 'loading' })
		try {
			const details = await checkTokenPricingDetails(key)
			if (currentRequest !== requestId.current) return
			setResult({ status: 'done', key, details })
		} catch {
			if (currentRequest !== requestId.current) return
			setResult({ status: 'error', message: 'Could not check pricing right now. Please try again.' })
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
				<form onSubmit={handleSubmit} className="flex flex-col gap-4">
					<div className="grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]">
						<div className="flex flex-col gap-1">
							<label htmlFor={chainId} className="label-sm text-secondary">
								Chain
							</label>
							<div className="relative">
								<SelectWithCombobox
									allValues={chainOptions}
									selectedValues={chain ? [chain] : []}
									setSelectedValues={(values) => {
										setChain(values[0] ?? '')
										resetResult()
									}}
									label={selectedChain?.name ?? (chainsQuery.isPending ? 'Loading chains...' : 'Select a chain')}
									variant="input"
									size="md"
									singleSelect
									searchPlaceholder="Search chains..."
									popoverClassName="sm:w-(--popover-anchor-width) sm:min-w-0"
									className={`w-full justify-between ${selectedChain ? 'pl-9' : ''}`}
									triggerProps={{
										id: chainId,
										'aria-label': 'Chain',
										disabled: chainsQuery.isPending || chainsQuery.isError
									}}
								/>
								{selectedChain ? (
									<span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
										<TokenLogo name={selectedChain.name} kind="chain" size={18} />
									</span>
								) : null}
							</div>
						</div>
						<div className="flex flex-col gap-1">
							<label htmlFor={addressId} className="label-sm text-secondary">
								Token address or ID
							</label>
							<Input
								id={addressId}
								aria-describedby={moveTokenExample ? moveHintId : undefined}
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
						</div>
						<Button
							type="submit"
							size="md"
							variant="primary"
							disabled={!chain || result.status === 'loading'}
							className="w-full md:w-auto"
						>
							{result.status === 'loading' ? 'Checking...' : 'Check pricing'}
						</Button>
					</div>
					{moveTokenExample ? (
						<p id={moveHintId} className="body-sm text-secondary">
							For Move tokens, enter a coin type such as {moveTokenExample}.
						</p>
					) : null}
					{chainsQuery.isError ? (
						<div className="flex items-center gap-2" role="alert">
							<p className="body-md text-error">Could not load the supported chains.</p>
							<Button type="button" size="sm" onClick={() => void chainsQuery.refetch()}>
								Retry
							</Button>
						</div>
					) : null}
				</form>
			</Card>
			{result.status === 'done' ? (
				<PricingResult tokenKey={result.key} details={result.details} />
			) : result.status === 'error' ? (
				<Card padding="md" className="flex items-center gap-3" role="alert">
					<Icon name="alert-triangle" height={18} width={18} className="shrink-0 text-error" />
					<p className="body-md text-primary">{result.message}</p>
				</Card>
			) : null}
		</div>
	)
}
