import * as Ariakit from '@ariakit/react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import type { FormSubmitEvent } from '~/types/forms'
import { Button } from '~/ui/Button'
import { DialogCloseButton, DialogHeading, dialogSurfaceStyles } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
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
	const [status, setStatus] = useState<'idle' | 'pending' | 'error'>('idle')
	const dialogStore = Ariakit.useDialogStore({
		setOpen: () => {
			// Closing must not release a pending request and allow duplicate submissions.
			setStatus((current) => (current === 'pending' ? current : 'idle'))
		}
	})
	const successDialogStore = Ariakit.useDialogStore()
	const subjectLabel = subject.type === 'exchange' ? 'Exchange' : 'Protocol'
	const dataTypes = subject.type === 'exchange' ? EXCHANGE_DATA_TYPES : PROTOCOL_DATA_TYPES

	const onSubmit = (event: FormSubmitEvent) => {
		event.preventDefault()
		if (status === 'pending') return
		const form = event.currentTarget
		const values = new FormData(form)
		// A select cannot stay read-only; preserve focus before disabling it.
		if (document.activeElement === form.elements.namedItem('dataType')) {
			form.querySelector<HTMLButtonElement>('button[type="submit"]')!.focus()
		}
		setStatus('pending')
		const finish = (success: boolean) => {
			// Dialog contents unmount on close; the submitted form identifies its opening.
			setStatus(success || !form.isConnected ? 'idle' : 'error')
			if (!form.isConnected) {
				if (success) toast.success('Report sent successfully')
				else toast.error("Something went wrong, couldn't submit report")
				return
			}
			if (success) {
				form.reset()
				dialogStore.hide()
				successDialogStore.show()
			}
		}
		const subjectPayload = subject.type === 'exchange' ? { subject } : { protocol: subject.name }
		void fetchJson('https://api.llama.fi/reportError', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				...subjectPayload,
				dataType: dataType ?? values.get('dataType'),
				message: values.get('message'),
				correctSource: values.get('correctSource'),
				contact: values.get('contact')
			})
		}).then(
			(data) => finish(data?.message === 'success'),
			() => finish(false)
		)
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
				<form onSubmit={onSubmit} className="flex min-h-0 flex-auto flex-col">
					<div className="flex items-center gap-2 border-b border-subtle p-3">
						<DialogHeading>Report incorrect data</DialogHeading>
						<DialogCloseButton className="-mr-1 ml-auto" ariaLabel="Close report dialog" />
					</div>
					<div className="flex min-h-0 flex-auto flex-col gap-2 overflow-y-auto p-3">
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
								<select
									disabled={status === 'pending'}
									name="dataType"
									className={`${inputStyles} disabled:opacity-50`}
								>
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
							<textarea
								readOnly={status === 'pending'}
								name="message"
								required
								className={`${inputStyles} min-h-24 resize-y read-only:opacity-50`}
							/>
						</label>
						<label className="flex flex-col gap-1 label-sm text-secondary">
							<span>Where can we find correct information? (optional)</span>
							<textarea
								readOnly={status === 'pending'}
								name="correctSource"
								className={`${inputStyles} min-h-24 resize-y read-only:opacity-50`}
							/>
						</label>
						<label className="flex flex-col gap-1 label-sm text-secondary">
							<span>How can we contact you? (optional)</span>
							<input
								readOnly={status === 'pending'}
								name="contact"
								placeholder="Email address"
								className={`${inputStyles} read-only:opacity-50`}
							/>
						</label>
						{status === 'error' ? (
							<p className="text-center body-sm text-data-down" role="alert">
								Something went wrong, couldn't submit report
							</p>
						) : null}
					</div>
					<div className="border-t border-subtle p-3">
						<Ariakit.Button
							type="submit"
							name="submit-btn"
							accessibleWhenDisabled
							disabled={status === 'pending'}
							render={<Button variant="primary" size="md" className="w-full aria-disabled:opacity-50" />}
						>
							{status === 'pending' ? (
								<>
									<LoadingSpinner size={16} />
									<span>Submitting...</span>
								</>
							) : (
								'Report'
							)}
						</Ariakit.Button>
						<span role="status" className="sr-only">
							{status === 'pending' ? 'Submitting report' : ''}
						</span>
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
