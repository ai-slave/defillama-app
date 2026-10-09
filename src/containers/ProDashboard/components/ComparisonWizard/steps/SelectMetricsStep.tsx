import { useId, useMemo, useState } from 'react'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { InlineStatus, LoadingIndicator } from '~/ui/Status'
import { useAppMetadata } from '../../../AppMetadataContext'
import { useComparisonWizardContext } from '../ComparisonWizardContext'
import { MetricCard } from '../components/MetricCard'

export function SelectMetricsStep() {
	const { state, actions, derived, availableMetrics } = useComparisonWizardContext()
	const id = useId()
	const error = derived.shownStepError
	// Availability comes from app metadata: until it loads every metric reads as unavailable.
	const { loading: metadataLoading, error: metadataError, retry: retryMetadata, retrying } = useAppMetadata()
	const [showInvalid, setShowInvalid] = useState(false)

	const validMetrics = useMemo(() => availableMetrics.filter((m) => m.isValid), [availableMetrics])
	const invalidMetrics = useMemo(() => availableMetrics.filter((m) => !m.isValid), [availableMetrics])

	const displayedMetrics = showInvalid ? availableMetrics : validMetrics

	const typeLabel = state.comparisonType === 'chains' ? 'chains' : 'protocols'

	return (
		<div className="flex flex-col gap-4">
			<div className="text-center">
				<h3 id={`${id}-heading`} className="label-md text-primary">
					Select metrics to compare
				</h3>
				<p className="mt-1 body-sm text-secondary">
					Choose the metrics you want to compare across your selected {typeLabel}.
				</p>
			</div>

			{metadataLoading ? (
				<div role="status" aria-live="polite" className="flex justify-center py-6">
					<LoadingIndicator label="Checking metric availability" />
				</div>
			) : metadataError ? (
				<InlineStatus
					variant="error"
					action={
						<Button type="button" size="sm" pendingLabel={retrying ? 'Retrying…' : null} onClick={retryMetadata}>
							Try again
						</Button>
					}
				>
					Could not check which metrics the selected {typeLabel} have.
				</InlineStatus>
			) : (
				<>
					<div className="flex items-center gap-3 rounded-lg border border-subtle px-4 py-2.5">
						<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-muted text-link">
							<Icon name="bar-chart-2" height={18} width={18} />
						</div>
						<div className="flex min-w-0 flex-col items-start label-sm">
							<p className="label-sm text-primary">
								{validMetrics.length} metric{validMetrics.length === 1 ? '' : 's'} available
							</p>
							<p className="body-sm text-tertiary">Based on data availability for your selected {typeLabel}.</p>
							{invalidMetrics.length > 0 ? (
								<Button variant="link" onClick={() => setShowInvalid(!showInvalid)}>
									{showInvalid ? 'Hide' : 'Show'} unavailable ({invalidMetrics.length})
								</Button>
							) : null}
						</div>
					</div>

					<div className="flex items-center justify-between">
						<span className="label-sm text-secondary">
							{state.selectedMetrics.length} metric{state.selectedMetrics.length !== 1 ? 's' : ''} selected
						</span>
						<div className="flex items-center gap-3 label-sm">
							{/* Both stay rendered, disabled when they have nothing to do, so the pressed one keeps focus. */}
							<Button
								variant="link"
								disabled={state.selectedMetrics.length >= validMetrics.length}
								accessibleWhenDisabled
								onClick={() => actions.selectAllMetrics(validMetrics.map((m) => m.metric))}
							>
								Select all
							</Button>
							<Button
								variant="link"
								disabled={state.selectedMetrics.length === 0}
								accessibleWhenDisabled
								onClick={() => actions.clearMetrics()}
							>
								Clear
							</Button>
						</div>
					</div>

					<div
						role="group"
						aria-labelledby={`${id}-heading`}
						aria-describedby={error ? `${id}-error` : undefined}
						data-invalid={error ? '' : undefined}
						className="flex flex-col gap-1"
					>
						<div className="max-h-[340px] overflow-y-auto rounded-lg">
							<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
								{displayedMetrics.map((metric) => (
									<MetricCard
										key={metric.metric}
										metric={metric}
										isSelected={state.selectedMetrics.includes(metric.metric)}
										onToggle={() => actions.toggleMetric(metric.metric)}
										itemLabel={typeLabel}
									/>
								))}
							</div>
						</div>
						{error ? (
							<p id={`${id}-error`} className="body-sm text-error">
								{error}
							</p>
						) : null}
					</div>
					{displayedMetrics.length === 0 ? (
						<InlineStatus variant="empty">
							The selected {typeLabel} don't have enough common metrics to compare. Try selecting different {typeLabel}.
						</InlineStatus>
					) : null}
				</>
			)}
		</div>
	)
}
