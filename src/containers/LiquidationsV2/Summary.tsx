import { TokenLogo, type LogoKind } from '~/components/TokenLogo'
import { Card } from '~/ui/Card'
import { EntityTitleStrip } from '~/ui/EntityTitleStrip'
import { formattedNum } from '~/utils'

export function LiquidationsPageHeader({
	title,
	rightText,
	logo
}: {
	title: string
	rightText?: string | null
	logo?: { name: string; kind: Exclude<LogoKind, 'equities'> } | null
}) {
	return (
		<EntityTitleStrip
			media={logo ? <TokenLogo name={logo.name} kind={logo.kind} size={28} alt={`Logo of ${logo.name}`} /> : null}
			title={title}
			actions={rightText ? <span className="body-sm text-tertiary">{rightText}</span> : null}
		/>
	)
}

export function LiquidationsSummaryStats({
	items
}: {
	items: Array<{ label: string; value: number; isUsd?: boolean }>
}) {
	return (
		<Card padding="sm" className="flex min-h-[42px] w-full flex-wrap items-center gap-x-5 gap-y-2">
			{items.map((item) => (
				<div key={item.label} className="flex items-baseline gap-1.5">
					<span className="body-md text-secondary">{item.label}</span>
					<span className="label-md">{item.isUsd ? formattedNum(item.value, true) : formattedNum(item.value)}</span>
				</div>
			))}
		</Card>
	)
}
