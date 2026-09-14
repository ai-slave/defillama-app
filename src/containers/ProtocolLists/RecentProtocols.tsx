import * as Ariakit from '@ariakit/react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '~/ui/Button'
import { DialogCloseButton, DialogHeading, dialogSurfaceStyles } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { inputStyles } from '~/ui/Input'
import { airdropsEligibilityCheck } from './airdrops'
import { RecentlyListedProtocolsTable } from './RecentProtocolsTable'
import type { ProtocolListInitialProps } from './tableQuery'

export function RecentProtocols({ claimableAirdrops, ...props }: ProtocolListInitialProps) {
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
						type="button"
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
						<div className="min-h-0 flex-auto overflow-y-auto p-3">
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

			<RecentlyListedProtocolsTable {...props} />
		</>
	)
}
