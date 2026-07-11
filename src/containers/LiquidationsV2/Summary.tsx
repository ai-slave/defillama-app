import { TokenLogo, type LogoKind } from '~/components/TokenLogo'
import { EntityTitleStrip } from '~/ui/EntityTitleStrip'
import { InlineStatStrip } from '~/ui/SummaryStats'
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
		<InlineStatStrip
			items={items.map((item) => ({
				label: item.label,
				value: item.isUsd ? formattedNum(item.value, true) : formattedNum(item.value)
			}))}
		/>
	)
}
