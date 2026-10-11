import { useState } from 'react'
import { ExternalLinkButton } from '~/components/ExternalLinkButton'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Menu } from '~/ui/Menu'
import type { RWALinkGroup, RWAPanelRow } from './panelData'

/* The pieces the six panels share: the card, prose with a clamp, rows, pills, badges, link pills, tally bars. */

/** Prose longer than this gets a Show more toggle. Character-based on purpose: measuring rendered overflow
    needs a layout effect per paragraph. */
const PROSE_CLAMP_THRESHOLD = 320

export function PanelCard({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<Card as="section" padding="sm" className="col-span-1 flex flex-col gap-3 body-md">
			<h2 className="heading-xs">{title}</h2>
			{children}
		</Card>
	)
}

export function Prose({ children }: { children: string }) {
	const [expanded, setExpanded] = useState(false)
	const needsToggle = children.length > PROSE_CLAMP_THRESHOLD
	return (
		<div className="flex max-w-[70ch] flex-col items-start gap-1">
			<p className={`${expanded || !needsToggle ? '' : 'line-clamp-4 '}body-md text-secondary`}>{children}</p>
			{needsToggle ? (
				<div className="label-sm">
					<Button variant="link" onClick={() => setExpanded((previous) => !previous)} aria-expanded={expanded}>
						{expanded ? 'Show less' : 'Show more'}
					</Button>
				</div>
			) : null}
		</div>
	)
}

export function LabeledProse({ label, text }: { label: string; text: string | null }) {
	if (!text) return null
	return (
		<div className="flex flex-col gap-1">
			<h3 className="label-md text-secondary">{label}</h3>
			<Prose>{text}</Prose>
		</div>
	)
}

export function PanelRows({ rows }: { rows: Array<RWAPanelRow> }) {
	if (rows.length === 0) return null
	return (
		<div className="flex flex-col">
			{rows.map((row) => (
				<PanelRow key={row.label} label={row.label} mono={row.mono}>
					{row.value}
				</PanelRow>
			))}
		</div>
	)
}

export function PanelRow({
	label,
	mono = false,
	children
}: {
	label: string
	mono?: boolean
	children: React.ReactNode
}) {
	return (
		<p className="flex min-h-6 flex-wrap items-baseline justify-start gap-1 border-b border-dashed border-subtle py-1 last:border-none">
			<span className="body-md text-secondary">{label}</span>
			<span className={`ml-auto ${mono ? 'mono-md' : 'label-md'}`}>{children}</span>
		</p>
	)
}

export function Pill({ children, tone = 'text-secondary' }: { children: React.ReactNode; tone?: string }) {
	return <span className={`rounded-full bg-surface-elevated-2 px-2 py-0.5 label-sm ${tone}`}>{children}</span>
}

export function Pills({ items }: { items: Array<string> }) {
	if (items.length === 0) return null
	return (
		<div className="flex flex-wrap gap-1.5">
			{items.map((item) => (
				<Pill key={item}>{item}</Pill>
			))}
		</div>
	)
}

/** External document pills, grouped by kind; several links of one kind collapse into a menu. */
export function LinkPills({ groups }: { groups: Array<RWALinkGroup> }) {
	if (groups.length === 0) return null
	return (
		<div className="flex flex-wrap gap-1.5">
			{groups.map((group) =>
				group.urls.length > 1 ? (
					<Menu key={group.label} name={group.label} options={group.urls} isExternal />
				) : (
					<ExternalLinkButton key={group.label} href={group.urls[0]!} icon="file-text">
						{group.label}
					</ExternalLinkButton>
				)
			)}
		</div>
	)
}

/** A count over a known total as a short bar; unknown when nothing answered. */
export function TallyRow({
	label,
	yes,
	known,
	tone = 'bg-brand'
}: {
	label: string
	yes: number
	known: number
	tone?: string
}) {
	return (
		<p className="flex min-h-6 flex-wrap items-center justify-start gap-2 border-b border-dashed border-subtle py-1 last:border-none">
			<span className="body-md text-secondary">{label}</span>
			{known === 0 ? (
				<span className="ml-auto label-md text-tertiary">unknown</span>
			) : (
				<span className="ml-auto flex items-center gap-2">
					<span className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-elevated-1">
						<span className={`block h-full rounded-full ${tone}`} style={{ width: `${(yes / known) * 100}%` }} />
					</span>
					<span className="mono-md">
						{yes} of {known}
					</span>
				</span>
			)}
		</p>
	)
}
