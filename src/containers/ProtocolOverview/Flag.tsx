import * as Ariakit from '@ariakit/react'
import { useState } from 'react'
import { Icon } from '~/components/Icon'
import { LoadingSpinner } from '~/components/Loaders'
import { Tooltip } from '~/components/Tooltip'
import type { FormSubmitEvent } from '~/types/forms'
import { Button, buttonStyles } from '~/ui/Button'
import { DialogHeading, dialogSurfaceStyles } from '~/ui/Dialog'
import { inputStyles } from '~/ui/Input'
import { fetchJson } from '~/utils/async'

export function Flag({
	protocol,
	dataType,
	isLending,
	className
}: {
	protocol: string
	dataType?: string
	isLending?: boolean
	className?: string
}) {
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState(false)

	const dialogStore = Ariakit.useDialogStore()
	const successDialogStore = Ariakit.useDialogStore()

	const onSubmit = async (e: FormSubmitEvent) => {
		e.preventDefault()
		setError(false)
		setLoading(true)

		const form = e.currentTarget
		const dataTypeValue =
			(form.elements.namedItem('dataType') as HTMLInputElement | HTMLSelectElement | null)?.value ?? ''
		const messageValue = (form.elements.namedItem('message') as HTMLTextAreaElement | null)?.value ?? ''
		const correctSourceValue = (form.elements.namedItem('correctSource') as HTMLTextAreaElement | null)?.value ?? ''
		const contactValue = (form.elements.namedItem('contact') as HTMLInputElement | null)?.value ?? ''

		const data = await fetchJson('https://api.llama.fi/reportError', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				protocol,
				dataType: dataType ?? dataTypeValue,
				message: messageValue,
				correctSource: correctSourceValue,
				contact: contactValue
			})
		})
			.then((data) => {
				setLoading(false)

				if (data?.message === 'success') {
					form.reset()
					dialogStore.setOpen(false)
					successDialogStore.setOpen(true)
				} else {
					setError(true)
				}
			})
			.catch((err) => {
				console.log(err)
				setError(true)
			})
			.finally(() => {
				setLoading(false)
			})

		return data
	}

	return (
		<>
			{dataType ? (
				<Tooltip
					content="Report incorrect data"
					render={<button type="button" />}
					onClick={dialogStore.toggle}
					className={className}
				>
					<Icon name="flag" height={14} width={14} />
					<span className="sr-only">{`Report incorrect ${dataType} data`}</span>
				</Tooltip>
			) : (
				<Button type="button" size="md" className="mt-auto mr-auto" onClick={dialogStore.toggle}>
					Report incorrect data
				</Button>
			)}

			<Ariakit.Dialog className={`${dialogSurfaceStyles} [--dialog-width:520px]`} unmountOnHide store={dialogStore}>
				<form
					onSubmit={(e) => {
						void onSubmit(e)
					}}
					className="flex min-h-0 flex-1 flex-col"
				>
					<div className="flex items-center gap-2 border-b border-subtle p-3">
						<DialogHeading>Report incorrect data</DialogHeading>
						<Ariakit.DialogDismiss
							type="button"
							aria-label="Close report dialog"
							className={buttonStyles({ variant: 'ghost', size: 'md', square: true })}
						>
							<Icon name="x" height={16} width={16} />
						</Ariakit.DialogDismiss>
					</div>
					<div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
						{isLending ? (
							<p className="text-center body-sm text-warning">
								For lending protocols TVL doesn't include active loans by default
							</p>
						) : null}
						<label className="flex flex-col gap-1 label-sm text-secondary">
							<span>Protocol</span>
							<input name="protocol" value={protocol} disabled className={`${inputStyles} disabled:opacity-50`} />
						</label>
						<label className="flex flex-col gap-1 label-sm text-secondary">
							<span>Data Type</span>
							{dataType ? (
								<input name="dataType" value={dataType} disabled className={`${inputStyles} disabled:opacity-50`} />
							) : (
								<select name="dataType" className={`${inputStyles} disabled:opacity-50`}>
									<option value="TVL">TVL</option>
									<option value="Mcap">Mcap</option>
									<option value="Token Price">Token Price</option>
									<option value="Token Volume">Token Volume</option>
									<option value="Token Liquidity">Token Liquidity</option>
									<option value="FDV">FDV</option>
									<option value="Volume">Volume</option>
									<option value="Fees">Fees</option>
									<option value="Revenue">Revenue</option>
									<option value="Treasury">Treasury</option>
									<option value="Unlocks">Unlocks</option>
									<option value="Active Addresses">Active Addresses</option>
									<option value="New Addresses">New Addresses</option>
									<option value="Transactions">Transactions</option>
									<option value="Gas Used">Gas Used</option>
									<option value="Staking">Staking</option>
									<option value="Active Loans">Active Loans</option>
									<option value="Median APY">Median APY</option>
									<option value="USD Inflows">USD Inflows</option>
									<option value="Governance">Governance</option>
									<option value="Bridge Volume">Bridge Volume</option>
									<option value="Events">Events</option>
									<option value="Raises">Raises</option>
								</select>
							)}
						</label>
						<label className="flex flex-col gap-1 label-sm text-secondary">
							<span>What's wrong about it?</span>
							<textarea name="message" required className={`${inputStyles} min-h-24 resize-y disabled:opacity-50`} />
						</label>
						<label className="flex flex-col gap-1 label-sm text-secondary">
							<span>Where can we find correct information? (optional)</span>
							<textarea name="correctSource" className={`${inputStyles} min-h-24 resize-y disabled:opacity-50`} />
						</label>
						<label className="flex flex-col gap-1 label-sm text-secondary">
							<span>How can we contact you? (optional)</span>
							<input name="contact" placeholder="Email address" className={`${inputStyles} disabled:opacity-50`} />
						</label>
						{error ? (
							<p className="text-center body-sm text-data-down" role="alert">
								Something went wrong, couldn't submit report
							</p>
						) : null}
					</div>
					<div className="border-t border-subtle p-3">
						<Button type="submit" name="submit-btn" disabled={loading} variant="primary" size="md" className="w-full">
							{loading ? (
								<>
									<LoadingSpinner size={16} />
									<span>Submitting...</span>
								</>
							) : (
								'Report'
							)}
						</Button>
					</div>
				</form>
			</Ariakit.Dialog>

			<Ariakit.Dialog
				className={`${dialogSurfaceStyles} [--dialog-width:360px]`}
				unmountOnHide
				store={successDialogStore}
			>
				<div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
					<Icon name="check-circle" height={64} width={64} strokeWidth={0.75} className="text-data-up" />
					<DialogHeading>Reported Successfully</DialogHeading>
					<Ariakit.DialogDismiss render={<Button type="button" size="md" />}>Close</Ariakit.DialogDismiss>
				</div>
			</Ariakit.Dialog>
		</>
	)
}
