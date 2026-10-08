import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import toast from 'react-hot-toast'
import Layout from '~/layout'
import type { FormSubmitEvent } from '~/types/forms'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Field } from '~/ui/Field'
import { showFieldErrors } from '~/ui/focus'
import { Input, textareaStyles } from '~/ui/Input'
import { InlineStatus } from '~/ui/Status'
import { fetchJson } from '~/utils/async'

const EMPTY_REPORT = { protocol: '', message: '', correctSource: '', contact: '' }

type Report = typeof EMPTY_REPORT

async function sendReport(report: Report) {
	const data = await fetchJson<{ message?: string }>('https://api.llama.fi/reportError', {
		method: 'POST',
		body: JSON.stringify({ ...report, dataType: '' })
	})
	if (data?.message !== 'success') throw new Error('Report failed')
}

function ReportError() {
	const [report, setReport] = useState(EMPTY_REPORT)
	const [submitted, setSubmitted] = useState(false)
	// Kept while a retry runs: the mutation clears its own error when the retry starts.
	const [failed, setFailed] = useState(false)
	const mutation = useMutation({ mutationFn: sendReport })
	const errors = {
		protocol: report.protocol.trim() ? null : 'Enter the chain, protocol or institution.',
		message: report.message.trim() ? null : 'Enter what’s wrong with the data.'
	}
	const edit = (field: keyof Report) => (e: { target: { value: string } }) =>
		setReport((current) => ({ ...current, [field]: e.target.value }))

	const onSubmit = (e: FormSubmitEvent) => {
		e.preventDefault()
		if (mutation.isPending) return
		if (errors.protocol || errors.message) return showFieldErrors(e.currentTarget, () => setSubmitted(true))
		mutation.mutate(report, {
			onSuccess: () => {
				toast.success('Report submitted successfully', { position: 'bottom-right' })
				setReport(EMPTY_REPORT)
				setSubmitted(false)
				setFailed(false)
			},
			onError: () => setFailed(true)
		})
	}

	return (
		<Layout
			title="Report a Data Error or Issue - DefiLlama"
			description="Report a data error, missing protocol, or incorrect information on DefiLlama. Help us maintain accurate DeFi analytics."
			canonicalUrl="/report-error"
		>
			<div className="mx-auto flex w-full max-w-lg flex-col gap-4 lg:mt-4 xl:mt-11 xl:ml-[calc(228px-16px)]">
				<Card as="form" noValidate onSubmit={onSubmit} padding="sm" className="flex w-full flex-col gap-4">
					<h1 className="mb-3 text-center heading-sm">Report Error</h1>
					<Field label="Chain / Protocol / Institution" error={submitted ? errors.protocol : null}>
						{(control) => (
							<Input {...control} required value={report.protocol} onChange={edit('protocol')} className="w-full" />
						)}
					</Field>
					<Field label="What’s wrong about it?" error={submitted ? errors.message : null}>
						{(control) => (
							<textarea
								{...control}
								required
								value={report.message}
								onChange={edit('message')}
								className={`${textareaStyles} min-h-24 w-full`}
							/>
						)}
					</Field>
					<Field label="Where can we find correct information? (optional)">
						{(control) => (
							<textarea
								{...control}
								value={report.correctSource}
								onChange={edit('correctSource')}
								className={`${textareaStyles} min-h-24 w-full`}
							/>
						)}
					</Field>
					<Field label="How can we contact you? (optional)">
						{(control) => (
							<Input
								{...control}
								value={report.contact}
								onChange={edit('contact')}
								placeholder="Email address"
								className="w-full"
							/>
						)}
					</Field>
					{failed ? <InlineStatus variant="error">Couldn’t send the report. Try again.</InlineStatus> : null}
					<Button
						type="submit"
						variant="primary"
						size="md"
						pendingLabel={mutation.isPending ? 'Submitting…' : null}
						className="mt-3 w-full"
					>
						Report
					</Button>
				</Card>
				<Card padding="sm" className="flex w-full flex-col gap-4">
					<p className="text-center body-lg">Please submit a report if you notice any of the following:</p>
					<ul className="flex list-disc flex-col gap-1 pl-4">
						<li>
							Inconsistencies in our methodology (eg in protocol A we apply a different methodology for their metrics
							than in protocol B)
						</li>
						<li>Data errors (eg protocol A is missing fees for their new version, or the data just seems wrong)</li>
						<li>Missing data</li>
						<li>Bug on site</li>
					</ul>
					<p className="text-center">
						All submissions are completely anonymous and will be reviewed by a human manually
					</p>
				</Card>
			</div>
		</Layout>
	)
}

export default ReportError
