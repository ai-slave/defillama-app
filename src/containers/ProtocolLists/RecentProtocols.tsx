import * as Ariakit from '@ariakit/react'
import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { useMemo } from 'react'
import { useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { Button } from '~/ui/Button'
import { DialogCloseButton, DialogHeading, dialogSurfaceStyles } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { inputStyles } from '~/ui/Input'
import { parseNumberQueryParam, parseExcludeParam, getSelectedChainFilters } from '~/utils/routerQuery'
import { airdropsEligibilityCheck } from './airdrops'
import { RecentlyListedProtocolsTable } from './RecentProtocolsTable'
import type { IRecentProtocol, IRecentProtocolsPageData } from './types'
import { applyExtraTvl, scopeRecentProtocolToChains } from './utils'

export function RecentProtocols({
	protocols,
	chainList,
	categories,
	forkedList,
	claimableAirdrops
}: IRecentProtocolsPageData) {
	const router = useRouter()
	const {
		chain,
		excludeChain,
		category,
		excludeCategory,
		hideForks,
		minTvl: minTvlQuery,
		maxTvl: maxTvlQuery
	} = router.query

	const minTvl = parseNumberQueryParam(minTvlQuery)
	const maxTvl = parseNumberQueryParam(maxTvlQuery)

	const toHideForkedProtocols = hideForks === 'true'
	const hasCategoryParam = Object.hasOwn(router.query, 'category')

	const [extraTvlsEnabled] = useLocalStorageSettingsManager('tvl')

	const { selectedChains, selectedCategories, data } = useMemo(() => {
		const excludeChainSet = parseExcludeParam(excludeChain)
		let selectedChains = getSelectedChainFilters(chain, chainList)
		selectedChains = excludeChainSet.size > 0 ? selectedChains.filter((c) => !excludeChainSet.has(c)) : selectedChains

		const excludeCategorySet = parseExcludeParam(excludeCategory)
		let selectedCategories =
			categories.length > 0 && hasCategoryParam && category === ''
				? []
				: category
					? typeof category === 'string'
						? [category]
						: category
					: categories

		selectedCategories =
			excludeCategorySet.size > 0
				? selectedCategories.filter((selectedCategory) => !excludeCategorySet.has(selectedCategory))
				: selectedCategories

		const categoriesToFilterSet = new Set(
			selectedCategories
				.filter(
					(selectedCategory) => selectedCategory.toLowerCase() !== 'all' && selectedCategory.toLowerCase() !== 'none'
				)
				.map((selectedCategory) => selectedCategory.toLowerCase())
		)

		const chainsToSelectSet = new Set(selectedChains.map((t) => t.toLowerCase()))

		// TVL range should work with min-only, max-only, or both.
		const isValidTvlRange = minTvl != null || maxTvl != null

		const filteredProtocols: Array<IRecentProtocol> = []

		for (const protocol of protocols) {
			// filter out forked protocols
			if (toHideForkedProtocols && forkedList?.[protocol.name]) continue

			// filter out protocols by category
			if (categories.length > 0) {
				if (selectedCategories.length === 0) continue
				if (categoriesToFilterSet.size > 0) {
					const protocolCategory = protocol.category?.toLowerCase() ?? ''
					if (!categoriesToFilterSet.has(protocolCategory)) continue
				}
			}

			// filter if a protocol has at least one selected chain
			let includesChain = false
			for (const c of protocol.chains) {
				if (chainsToSelectSet.has(c.toLowerCase())) {
					includesChain = true
					break
				}
			}
			if (!includesChain) continue

			filteredProtocols.push(scopeRecentProtocolToChains({ protocol, selectedChains: chainsToSelectSet }))
		}

		// Apply extraTvl toggles (staking/pool2/borrowed)
		const withExtraTvl = applyExtraTvl(filteredProtocols, extraTvlsEnabled)

		if (isValidTvlRange) {
			const rangeFiltered = withExtraTvl.filter(
				(p) => p.tvl != null && (minTvl != null ? p.tvl >= minTvl : true) && (maxTvl != null ? p.tvl <= maxTvl : true)
			)
			return { data: rangeFiltered, selectedChains, selectedCategories }
		}

		return { data: withExtraTvl, selectedChains, selectedCategories }
	}, [
		protocols,
		chain,
		excludeChain,
		category,
		excludeCategory,
		hasCategoryParam,
		chainList,
		categories,
		forkedList,
		toHideForkedProtocols,
		minTvl,
		maxTvl,
		extraTvlsEnabled
	])

	const {
		data: eligibleAirdrops,
		mutate: checkEligibleAirdrops,
		isPending: fetchingEligibleAirdrops,
		error: errorFetchingEligibleAirdrops,
		reset: resetEligibilityCheck
	} = useMutation({ mutationFn: airdropsEligibilityCheck })

	const airdropCheckerDialog = Ariakit.useDialogStore()

	return (
		<>
			{claimableAirdrops ? (
				<span className="flex flex-wrap items-center gap-2">
					{claimableAirdrops.map((protocol) => (
						<a
							href={protocol.page}
							target="_blank"
							rel="noreferrer noopener"
							key={`claim-${protocol.name}`}
							color="#008000"
							className="flex items-center gap-1 rounded-md bg-data-up/10 px-2.5 py-1 text-sm font-medium whitespace-nowrap text-data-up"
						>
							<span>{protocol.name}</span>
							<Icon name="arrow-up-right" height={14} width={14} />
						</a>
					))}
					<button
						onClick={() => {
							resetEligibilityCheck()
							airdropCheckerDialog.toggle()
						}}
						className="hover-wash flex items-center gap-1 rounded-md bg-brand-muted px-2.5 py-1 text-sm font-medium whitespace-nowrap text-link"
					>
						Check airdrops for address
					</button>

					<Ariakit.Dialog
						store={airdropCheckerDialog}
						className={`${dialogSurfaceStyles} [--dialog-width:720px]`}
						unmountOnHide
						portal
					>
						<div className="flex items-center gap-2 border-b border-subtle px-4 py-3">
							<DialogHeading>Check airdrops</DialogHeading>
							<DialogCloseButton
								className="-mr-1 ml-auto"
								onClick={() => {
									resetEligibilityCheck()
								}}
							/>
						</div>
						<div className="min-h-0 flex-1 overflow-y-auto p-3">
							{eligibleAirdrops ? (
								eligibleAirdrops.length === 0 ? (
									<p role="status" aria-live="polite" className="text-center body-sm text-tertiary">
										No airdrops detected for this address
									</p>
								) : (
									<div className="relative isolate w-full overflow-auto">
										{eligibleAirdrops.map((address) => (
											<table
												key={`airdrop of ${address[0]}`}
												className="mt-4 w-full border-collapse text-sm first:mt-0"
											>
												<thead>
													<tr>
														<th
															colSpan={2}
															className="border border-subtle p-2 text-center font-medium whitespace-nowrap"
														>
															{address[0]}
														</th>
													</tr>
													<tr>
														<th className="border border-subtle p-2 text-center font-medium whitespace-nowrap">
															Protocol Name
														</th>
														<th className="border border-subtle p-2 text-center font-medium whitespace-nowrap">
															Token Amount
														</th>
													</tr>
												</thead>
												<tbody>
													{address[1].length === 0 ? (
														<tr>
															<td
																colSpan={2}
																className="border border-subtle p-2 text-center font-normal whitespace-nowrap"
															>
																<p className="text-center body-sm text-data-down">
																	No airdrops detected for this address
																</p>
															</td>
														</tr>
													) : (
														address[1].map((airdrop) => (
															<tr key={`${airdrop.name}:${airdrop.claimableAmount}`}>
																<th className="border border-subtle p-2 text-center font-normal whitespace-nowrap">
																	{airdrop.name}
																</th>
																<td className="border border-subtle p-2 text-center font-normal whitespace-nowrap">
																	{airdrop.isActive ? (
																		<span className="flex items-center justify-center gap-2">
																			<span>{`${airdrop.claimableAmount} ${airdrop.tokenSymbol ?? ''}`}</span>
																			{airdrop.page ? (
																				<a
																					href={airdrop.page}
																					target="_blank"
																					rel="noopener noreferrer"
																					key={`can-claim-${airdrop.name}`}
																					className="shrink-0 rounded-md bg-brand-muted px-1.5 py-0.5 hover:bg-(--interim-brand-tint-hover)"
																				>
																					<Icon name="arrow-up-right" height={14} width={14} />
																					<span className="sr-only">open in new tab</span>
																				</a>
																			) : null}
																		</span>
																	) : (
																		<span className="opacity-70">
																			{`${airdrop.claimableAmount} ${airdrop.tokenSymbol ?? ''}`} - Claim Ended
																		</span>
																	)}
																</td>
															</tr>
														))
													)}
												</tbody>
											</table>
										))}
									</div>
								)
							) : (
								<form
									onSubmit={(e) => {
										e.preventDefault()
										const formData = new FormData(e.currentTarget)
										const addressesInput = formData.get('address')
										if (typeof addressesInput !== 'string') return
										checkEligibleAirdrops({
											addresses: addressesInput
												.split('\n')
												.join(',')
												.split(',')
												.map((x) => x.trim())
												.filter((x) => x.length > 0)
										})
									}}
									className="flex flex-col gap-3"
								>
									<label className="flex flex-col gap-1 label-sm text-secondary">
										<span>Provide EVM / SOL address(s) to check airdrops for:</span>
										<textarea
											name="address"
											required
											disabled={fetchingEligibleAirdrops}
											placeholder="0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045, 0x71a15Ac12ee91BF7c83D08506f3a3588143898B5"
											className={`${inputStyles} min-h-24 resize-y disabled:opacity-50`}
										/>
									</label>
									<Button
										type="submit"
										name="submit-btn"
										disabled={fetchingEligibleAirdrops}
										variant="primary"
										size="md"
									>
										{fetchingEligibleAirdrops ? 'Checking...' : 'Check'}
									</Button>
									{errorFetchingEligibleAirdrops ? (
										<p role="alert" className="text-center body-sm text-data-down">
											{errorFetchingEligibleAirdrops instanceof Error
												? errorFetchingEligibleAirdrops.message
												: 'Failed to fetch'}
										</p>
									) : null}
								</form>
							)}
						</div>
					</Ariakit.Dialog>
				</span>
			) : null}

			<RecentlyListedProtocolsTable
				data={data}
				selectedChains={selectedChains}
				selectedCategories={selectedCategories}
				chainList={chainList}
				categories={categories}
				forkedList={forkedList}
			/>
		</>
	)
}
