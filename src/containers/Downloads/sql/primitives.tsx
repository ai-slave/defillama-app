import type { ReactNode } from 'react'
import { Tag } from '~/ui/Tag'
import type { FineKind } from './columnKind'

export function SectionLabel({ label, count, action }: { label: string; count?: string | number; action?: ReactNode }) {
	return (
		<div className="flex items-baseline justify-between gap-2">
			<div className="flex items-baseline gap-2">
				<h3 className="title-sm tracking-tight text-primary">{label}</h3>
				{count !== undefined ? <span className="body-sm text-tertiary tabular-nums">{count}</span> : null}
			</div>
			{action ? <div className="shrink-0">{action}</div> : null}
		</div>
	)
}

const KIND_LABEL: Record<FineKind, string> = {
	date: 'date',
	int: 'int',
	float: 'num',
	text: 'text',
	bool: 'bool',
	list: 'list',
	other: '—'
}

export function TypeBadge({ kind }: { kind: FineKind }) {
	return (
		<Tag aria-label={`${kind} column`} className="shrink-0">
			{KIND_LABEL[kind]}
		</Tag>
	)
}
