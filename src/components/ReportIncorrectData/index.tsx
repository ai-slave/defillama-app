import * as Ariakit from '@ariakit/react'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import toast from 'react-hot-toast'
import type { FormSubmitEvent } from '~/types/forms'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogFooter, DialogHeader, useOpeningKey, DialogCancelButton } from '~/ui/Dialog'
import { Field } from '~/ui/Field'
import { showFieldErrors } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input, Textarea } from '~/ui/Input'
import { Select } from '~/ui/Select'
import { InlineStatus } from '~/ui/Status'
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
	const [open, setOpen] = useState(false)
	const opening = useOpeningKey(open)
	return (
		<>
			{dataType ? (
				<Tooltip
					content="Report incorrect data"
					render={
						<Button
							variant="ghost"
							size="sm"
							square
							className={className}
							aria-label={`Report incorrect ${dataType} data`}
							onClick={() => setOpen(true)}
						/>
					}
				>
					<Icon name="flag" className="size-4" />
				</Tooltip>
			) : (
				<Button type="button" size="sm" className="mt-auto mr-auto" onClick={() => setOpen(true)}>
					Report incorrect data
				</Button>
			)}
			<ReportSession key={opening} open={open} onClose={() => setOpen(false)} subject={subject} dataType={dataType} />
		</>
	)
}

/** One opening's report. The request lives here, above the dialog, so the dialog can lock while it runs and a
    reopened dialog starts with an empty form. */
function ReportSession({
	open,
	onClose,
	subject,
	dataType
}: {
	open: boolean
	onClose: () => void
	subject: ReportSubject
	dataType?: string
}) {
	const report = useMutation({
		mutationFn: async (body: Record<string, unknown>) => {
			const data = await fetchJson('https://api.llama.fi/reportError', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			})
			if (data?.message !== 'success') throw new Error('Report failed')
		}
	})
	const pending = report.isPending
	// Kept while a retry runs: the mutation clears its own error when the retry starts.
	const [failed, setFailed] = useState(false)
	const [message, setMessage] = useState('')
	const [submitted, setSubmitted] = useState(false)
	const messageError = message.trim() ? null : 'Enter what’s wrong with the data.'
	const subjectLabel = subject.type === 'exchange' ? 'Exchange' : 'Protocol'
	const dataTypes = subject.type === 'exchange' ? EXCHANGE_DATA_TYPES : PROTOCOL_DATA_TYPES
	const [selectedDataType, setSelectedDataType] = useState<string>(dataTypes[0])

	const onSubmit = (event: FormSubmitEvent) => {
		event.preventDefault()
		if (pending) return
		const form = event.currentTarget
		if (messageError) return showFieldErrors(form, () => setSubmitted(true))
		const values = new FormData(form)
		const subjectPayload = subject.type === 'exchange' ? { subject } : { protocol: subject.name }
		// The dialog locks while the report sends, but leaving the page still unmounts it. The promise settles either
		// way, so a form that is gone by then reports the outcome as a toast.
		report
			.mutateAsync({
				...subjectPayload,
				dataType: dataType ?? selectedDataType,
				message,
				correctSource: values.get('correctSource'),
				contact: values.get('contact')
			})
			.then(
				() => {
					if (!form.isConnected) toast.success('Report sent')
				},
				() => {
					if (form.isConnected) setFailed(true)
					else toast.error("Couldn't send the report")
				}
			)
	}

	return (
		<Dialog size="sm" open={open} onClose={onClose} pending={pending} unmountOnHide portal>
			{report.isSuccess ? (
				<>
					<DialogHeader title="Report sent" subtitle="Thanks for helping keep the data accurate." />
					<DialogFooter>
						{/* Send report left with the form; focus moves to the step's one action. */}
						<Ariakit.DialogDismiss autoFocus render={<Button type="button" variant="primary" size="md" />}>
							Done
						</Ariakit.DialogDismiss>
					</DialogFooter>
				</>
			) : (
				<form noValidate onSubmit={onSubmit} className="flex min-h-0 flex-auto flex-col">
					<DialogHeader
						title="Report incorrect data"
						subtitle={`${subjectLabel}: ${subject.name}${dataType ? ` · ${dataType}` : ''}`}
					/>
					<DialogBody>
						{subject.type === 'protocol' && subject.isLending ? (
							<InlineStatus variant="warning">
								For lending protocols, TVL doesn&rsquo;t include active loans by default.
							</InlineStatus>
						) : null}
						{dataType ? null : (
							<Field label="Data type">
								{(control) => (
									<Select
										allValues={dataTypes}
										selectedValues={selectedDataType}
										setSelectedValues={setSelectedDataType}
										label={selectedDataType}
										labelType="none"
										heading="Data type"
										variant="input"
										size="md"
										className="w-full"
										// Locked while the report sends; it keeps focus, so a reader who submitted from it stays there.
										triggerProps={{ ...control, disabled: pending, accessibleWhenDisabled: true }}
									/>
								)}
							</Field>
						)}
						<Field label="What’s wrong about it?" error={submitted ? messageError : null}>
							{(control) => (
								<Ariakit.Focusable
									autoFocus
									render={
										<Textarea
											{...control}
											readOnly={pending}
											name="message"
											required
											value={message}
											onChange={(event) => setMessage(event.target.value)}
											className="min-h-24 resize-y"
										/>
									}
								/>
							)}
						</Field>
						<Field label="Where can we find correct information? (optional)">
							{(control) => (
								<Textarea {...control} readOnly={pending} name="correctSource" className="min-h-24 resize-y" />
							)}
						</Field>
						<Field label="How can we contact you? (optional)">
							{(control) => <Input {...control} readOnly={pending} name="contact" placeholder="Email address" />}
						</Field>
						{failed ? <InlineStatus variant="error">Couldn&rsquo;t send the report. Try again.</InlineStatus> : null}
					</DialogBody>
					<DialogFooter dismiss={<DialogCancelButton />}>
						<Button
							type="submit"
							name="submit-btn"
							variant="primary"
							size="md"
							pendingLabel="Sending…"
							pending={pending}
						>
							Send report
						</Button>
					</DialogFooter>
				</form>
			)}
		</Dialog>
	)
}
