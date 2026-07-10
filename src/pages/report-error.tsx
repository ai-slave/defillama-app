import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import Layout from '~/layout'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Input, inputStyles } from '~/ui/Input'
import { LoadingSpinner } from '~/ui/Loaders'
import { fetchJson } from '~/utils/async'

async function reportError(report: any) {
	try {
		const data = await fetchJson<{ message?: string }>('https://api.llama.fi/reportError', {
			method: 'POST',
			body: JSON.stringify(report)
		})
		return data
	} catch (error) {
		throw new Error(error instanceof Error ? error.message : 'Failed to report')
	}
}

function ReportError() {
	const { mutateAsync, isPending, error } = useMutation({ mutationFn: reportError })
	const onSubmit = (e) => {
		e.preventDefault()

		const form = e.target as HTMLFormElement

		mutateAsync({
			protocol: form.protocol?.value ?? '',
			dataType: form.dataType?.value ?? '',
			message: form.message?.value ?? '',
			correctSource: form.correctSource?.value ?? '',
			contact: form.contact?.value ?? ''
		})
			.then((data) => {
				if (data?.message === 'success') {
					toast.success('Report submitted successfully', { position: 'bottom-right' })
					form.reset()
				} else {
					toast.error('Failed to report', { position: 'bottom-right' })
				}
			})
			.catch(() => {
				toast.error('Failed to report', { position: 'bottom-right' })
			})
	}

	return (
		<Layout
			title="Report a Data Error or Issue - DefiLlama"
			description="Report a data error, missing protocol, or incorrect information on DefiLlama. Help us maintain accurate DeFi analytics."
			canonicalUrl={`/report-error`}
		>
			<div className="mx-auto flex w-full max-w-lg flex-col gap-4 lg:mt-4 xl:mt-11 xl:ml-[calc(228px-16px)]">
				<Card as="form" onSubmit={onSubmit} padding="sm" className="flex w-full flex-col gap-4">
					<h1 className="mb-3 text-center heading-sm">Report Error</h1>
					<label className="flex flex-col gap-1">
						<span>Chain / Protocol / Institution</span>
						<Input name="protocol" required className="w-full" />
					</label>
					<label className="flex flex-col gap-1">
						<span>What's wrong about it?</span>
						<textarea name="message" required className={`${inputStyles} min-h-24 w-full`} />
					</label>
					<label className="flex flex-col gap-1">
						<span>Where can we find correct information? (optional)</span>
						<textarea name="correctSource" className={`${inputStyles} min-h-24 w-full`} />
					</label>
					<label className="flex flex-col gap-1">
						<span>How can we contact you? (optional)</span>
						<Input name="contact" placeholder="Email address" className="w-full" />
					</label>
					<Button name="submit-btn" variant="primary" size="md" disabled={isPending} className="mt-3 w-full">
						{isPending ? (
							<>
								<LoadingSpinner size={16} />
								<span>Submitting...</span>
							</>
						) : (
							'Report'
						)}
					</Button>
					{error ? <small className="text-center text-red-500">{error.message}</small> : null}
				</Card>
				<Card padding="sm" className="flex w-full flex-col gap-4">
					<p className="text-center text-base font-medium">
						Please submit a report if you notice any of the following:
					</p>
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
