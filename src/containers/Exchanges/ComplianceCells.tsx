import * as Ariakit from '@ariakit/react'
import type { ComponentProps } from 'react'
import { Icon } from '~/ui/Icon'
import { popoverHovercardSurfaceStyles } from '~/ui/Popover'
import { Tooltip } from '~/ui/Tooltip'
import {
	EXCHANGE_SEGMENT_LABELS,
	type ExchangeEeaOrderbookOwnership,
	type ExchangeEuStatus,
	type ExchangeMicaStatus
} from './models'

type ComplianceTone = 'positive' | 'caution' | 'negative' | 'neutral'

interface StatusPresentation {
	label: string
	tone: ComplianceTone
	icon: ComponentProps<typeof Icon>['name']
}

const TONE_CLASS: Record<ComplianceTone, string> = {
	positive: 'border-data-up bg-data-up/10 text-data-up',
	caution: 'border-warning bg-warning/10 text-warning',
	negative: 'border-data-down bg-data-down/10 text-data-down',
	neutral: 'border-subtle bg-surface text-secondary'
}

const EU_STATUS_PRESENTATION: Record<ExchangeEuStatus, StatusPresentation & { description: string }> = {
	available: {
		label: 'Available',
		tone: 'positive',
		icon: 'check-circle',
		description: 'Currently available to EU users.'
	},
	leaving: {
		label: 'Leaving',
		tone: 'caution',
		icon: 'clock',
		description: 'Currently leaving the EU market.'
	},
	restricted: {
		label: 'Restricted',
		tone: 'caution',
		icon: 'alert-triangle',
		description: 'Use is restricted for EU users.'
	},
	unavailable: {
		label: 'Unavailable',
		tone: 'negative',
		icon: 'circle-x',
		description: 'Not currently available to EU users.'
	}
}

const MICA_STATUS_LABEL: Record<ExchangeMicaStatus, string> = {
	active: 'Active',
	'in-progress': 'In progress'
}

export interface MicaLicenseValueModel {
	status: ExchangeMicaStatus
	licensed: boolean | null
	memberState: string | null
	regulator: string | null
}

type KycValueModel = {
	required: boolean
	short: string | null
	summary: string | null
}

type KycRequirementKey = 'id' | 'selfie' | 'poa' | 'profile' | 'quiz'

export type KycRequirementIndicator = {
	key: KycRequirementKey
	label: string
	icon: ComponentProps<typeof Icon>['name']
	className: string
}

const KYC_REQUIREMENT_BY_TOKEN: Record<string, KycRequirementIndicator> = {
	id: {
		key: 'id',
		label: 'Government ID',
		icon: 'id-card',
		className: 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400'
	},
	selfie: {
		key: 'selfie',
		label: 'Liveness / selfie check',
		icon: 'scan-face',
		className: 'border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400'
	},
	poa: {
		key: 'poa',
		label: 'Proof of address',
		icon: 'house-plug',
		className: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
	},
	'source-of-income': {
		key: 'profile',
		label: 'Income / economic profile',
		icon: 'briefcase-business',
		className: 'border-teal-500/30 bg-teal-500/10 text-teal-600 dark:text-teal-400'
	},
	profile: {
		key: 'profile',
		label: 'Income / economic profile',
		icon: 'briefcase-business',
		className: 'border-teal-500/30 bg-teal-500/10 text-teal-600 dark:text-teal-400'
	},
	'mifid quiz': {
		key: 'quiz',
		label: 'Trading knowledge quiz',
		icon: 'clipboard-check',
		className: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
	},
	quiz: {
		key: 'quiz',
		label: 'Trading knowledge quiz',
		icon: 'clipboard-check',
		className: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
	}
}

export function getEuStatusPresentation(status: ExchangeEuStatus) {
	return EU_STATUS_PRESENTATION[status]
}

export function getMicaLicensePresentation(mica: MicaLicenseValueModel): StatusPresentation | null {
	if (mica.licensed === null) return null
	if (mica.licensed) return { label: 'Licensed', tone: 'positive', icon: 'check-circle' }
	if (mica.status === 'in-progress') return { label: 'In progress', tone: 'caution', icon: 'clock' }
	return { label: 'Not licensed', tone: 'negative', icon: 'circle-x' }
}

export function getKycRequirementIndicators(kycShort: string): Array<KycRequirementIndicator> {
	const indicators: Array<KycRequirementIndicator> = []
	const seen = new Set<KycRequirementKey>()
	for (const token of kycShort.split('+')) {
		const indicator = KYC_REQUIREMENT_BY_TOKEN[token.trim().toLowerCase()]
		if (!indicator || seen.has(indicator.key)) continue
		seen.add(indicator.key)
		indicators.push(indicator)
	}
	return indicators
}

function eeaOrderbookTooltip(ownership: ExchangeEeaOrderbookOwnership | null): string | null {
	if (ownership === null) return null
	if (ownership.mode === 'own') return 'Uses dedicated regional orderbooks.'
	if (ownership.mode === 'shared') return 'Shares the global orderbook.'
	return [
		`Shared: ${ownership.sharedSegments.map((segment) => EXCHANGE_SEGMENT_LABELS[segment]).join(', ')}.`,
		`Dedicated: ${ownership.dedicatedSegments.map((segment) => EXCHANGE_SEGMENT_LABELS[segment]).join(', ')}.`
	].join(' ')
}

function StatusBadge({ presentation }: { presentation: StatusPresentation }) {
	return (
		<span
			className={`inline-flex h-[18px] items-center gap-1 rounded-sm border px-1.5 label-sm ${TONE_CLASS[presentation.tone]}`}
		>
			<Icon name={presentation.icon} height={13} width={13} aria-hidden="true" />
			{presentation.label}
		</span>
	)
}

export function EuAvailabilityValue({
	status,
	eeaOrderbookOwnership
}: {
	status: ExchangeEuStatus | null
	eeaOrderbookOwnership: ExchangeEeaOrderbookOwnership | null
}) {
	if (status === null) return <span className="text-tertiary">–</span>
	const presentation = getEuStatusPresentation(status)
	const orderbook = eeaOrderbookTooltip(eeaOrderbookOwnership)
	const detail = [presentation.description, orderbook].filter(Boolean).join('\n')
	return (
		<Tooltip content={detail}>
			<StatusBadge presentation={presentation} />
		</Tooltip>
	)
}

export function MicaLicenseValue({
	name,
	mica,
	licenseCount
}: {
	name: string
	mica: MicaLicenseValueModel | null
	licenseCount: number | null
}) {
	if (mica === null) return <span className="text-tertiary">–</span>
	const presentation = getMicaLicensePresentation(mica)
	if (presentation === null) return <span className="text-tertiary">–</span>

	return (
		<Ariakit.HovercardProvider placement="left-start" showTimeout={0} hideTimeout={80}>
			<Ariakit.HovercardAnchor
				render={<button type="button" />}
				type="button"
				className="inline-flex rounded-sm focus-visible:focus-ring"
				aria-label={`${presentation.label} MiCA details for ${name}`}
			>
				<StatusBadge presentation={presentation} />
			</Ariakit.HovercardAnchor>
			<Ariakit.Hovercard
				unmountOnHide
				gutter={6}
				overflowPadding={16}
				className={`${popoverHovercardSurfaceStyles} w-72 p-3 text-primary`}
				portal
			>
				<dl className="flex flex-col gap-1.5 body-sm">
					<div className="flex justify-between gap-3">
						<dt className="text-secondary">License status</dt>
						<dd>{MICA_STATUS_LABEL[mica.status]}</dd>
					</div>
					{mica.memberState ? (
						<div className="flex justify-between gap-3">
							<dt className="text-secondary">Member state</dt>
							<dd className="text-right">{mica.memberState}</dd>
						</div>
					) : null}
					{mica.regulator ? (
						<div className="flex justify-between gap-3">
							<dt className="text-secondary">Regulator</dt>
							<dd className="text-right">{mica.regulator}</dd>
						</div>
					) : null}
					{licenseCount !== null ? (
						<div className="flex justify-between gap-3">
							<dt className="text-secondary">All regulatory licenses</dt>
							<dd>{licenseCount}</dd>
						</div>
					) : null}
				</dl>
			</Ariakit.Hovercard>
		</Ariakit.HovercardProvider>
	)
}

function KycSummaryHovercard({ summary, name }: { summary: string; name: string }) {
	return (
		<Ariakit.HovercardProvider placement="left-start" showTimeout={0} hideTimeout={80}>
			<Ariakit.HovercardAnchor
				render={<button type="button" />}
				type="button"
				className="inline-flex size-7 items-center justify-center rounded-lg border border-subtle text-tertiary hover:border-strong hover:bg-hover-row hover:text-primary focus-visible:border-strong focus-visible:bg-hover-row focus-visible:text-primary"
				aria-label={`Full KYC requirements for ${name}`}
			>
				<Icon name="file-text" height={14} width={14} />
			</Ariakit.HovercardAnchor>
			<Ariakit.Hovercard
				unmountOnHide
				gutter={6}
				overflowPadding={16}
				className={`${popoverHovercardSurfaceStyles} w-96 p-3 leading-snug text-primary`}
				portal
			>
				<span className="block break-words whitespace-pre-wrap">{summary}</span>
			</Ariakit.Hovercard>
		</Ariakit.HovercardProvider>
	)
}

export function KycRequirementValue({ name, kyc }: { name: string; kyc: KycValueModel | null }) {
	if (kyc === null) return <span className="text-tertiary">–</span>
	if (!kyc.required) return <span className="text-data-up">No KYC</span>
	const shortSummary = kyc.short ?? 'Required'
	const summary = kyc.summary ?? shortSummary
	const requirements = getKycRequirementIndicators(shortSummary)

	if (requirements.length === 0) {
		return (
			<Tooltip content={summary}>
				<span className="block truncate body-sm">{shortSummary}</span>
			</Tooltip>
		)
	}

	return (
		<span className="inline-flex items-center gap-1.5" aria-label={summary}>
			{requirements.map((requirement) => (
				<Tooltip key={requirement.key} content={requirement.label}>
					<span
						className={`inline-flex size-7 items-center justify-center rounded-md border ${requirement.className}`}
						aria-label={requirement.label}
					>
						<Icon name={requirement.icon} height={15} width={15} />
					</span>
				</Tooltip>
			))}
			{summary !== shortSummary ? <KycSummaryHovercard summary={summary} name={name} /> : null}
		</span>
	)
}
