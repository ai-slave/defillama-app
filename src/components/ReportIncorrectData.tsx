import * as Ariakit from '@ariakit/react'
import { useState } from 'react'
import { Icon } from '~/components/Icon'
import type { FormSubmitEvent } from '~/types/forms'
import { Button } from '~/ui/Button'
import { DialogCloseButton, DialogHeading, dialogSurfaceStyles } from '~/ui/Dialog'
import { inputStyles } from '~/ui/Input'
import { LoadingSpinner } from '~/ui/Loaders'
import { Tooltip } from '~/ui/Tooltip'
import { fetchJson } from '~/utils/async'

export type ReportSubject =
	| { type: 'protocol'; name: string; isLending: boolean }
	| { type: 'exchange'; name: string; slug: string }

const PROTOCOL_DATA_TYPES = [
	'TVL',
	'Mcap',
	'Token Price',
	'Token Volume',
	'Token Liquidity',
	'FDV',
	'Volume',
	'Fees',
	'Revenue',
	'Treasury',
	'Unlocks',
	'Active Addresses',
	'New Addresses',
	'Transactions',
	'Gas Used',
	'Staking',
	'Active Loans',
	'Median APY',
	'USD Inflows',
	'Governance',
	'Bridge Volume',
	'Events',
	'Raises'
] as const

const EXCHANGE_DATA_TYPES = [
	'Profile Information',
	'Markets',
	'Volume',
	'Normalized Volume',
	'Open Interest',
	'Depth',
	'Fees',
	'Reserves',
	'Compliance / Licensing',
	'Fiat On/Off-Ramp',
	'Other'
] as const

export function ReportIncorrectData({
	subject,
	dataType,
	className
}: {
	subject: ReportSubject
	dataType?: string
	className?: string
}) {
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState(false)

	const dialogStore = Ariakit.useDialogStore()
	const successDialogStore = Ariakit.useDialogStore()
	const subjectLabel = subject.type === 'exchange' ? 'Exchange' : 'Protocol'
	const dataTypes = subject.type === 'exchange' ? EXCHANGE_DATA_TYPES : PROTOCOL_DATA_TYPES

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

		const subjectPayload = subject.type === 'exchange' ? { subject } : { protocol: subject.name }

		const data = await fetchJson('https://api.llama.fi/reportError', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				...subjectPayload,
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

			<Ariakit.Dialog
				className={`${dialogSurfaceStyles} [--dialog-width:520px]`}
				unmountOnHide
				store={dialogStore}
				portal
			>
				<form
					onSubmit={(e) => {
						void onSubmit(e)
					}}
					className="flex min-h-0 flex-1 flex-col"
				>
					<div className="flex items-center gap-2 border-b border-subtle p-3">
						<DialogHeading>Report incorrect data</DialogHeading>
						<DialogCloseButton className="-mr-1 ml-auto" ariaLabel="Close report dialog" />
					</div>
					<div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
						{subject.type === 'protocol' && subject.isLending ? (
							<p className="text-center body-sm text-warning">
								For lending protocols TVL doesn't include active loans by default
							</p>
						) : null}
						<label className="flex flex-col gap-1 label-sm text-secondary">
							<span>{subjectLabel}</span>
							<input name="subject" value={subject.name} disabled className={`${inputStyles} disabled:opacity-50`} />
						</label>
						<label className="flex flex-col gap-1 label-sm text-secondary">
							<span>Data Type</span>
							{dataType ? (
								<input name="dataType" value={dataType} disabled className={`${inputStyles} disabled:opacity-50`} />
							) : (
								<select name="dataType" className={`${inputStyles} disabled:opacity-50`}>
									{dataTypes.map((option) => (
										<option key={option} value={option}>
											{option}
										</option>
									))}
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
				portal
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
