import { Example, type Foundation } from '../shared'

// Roles as design.md's Typography table states them.
const TYPE_STYLES = [
	['heading-lg', 'Page and section headings'],
	['heading-sm', 'Page and section headings'],
	['heading-xs', 'Page and section headings'],
	['title-lg', 'The lead of a block: a card name, a total'],
	['title-md', 'The lead of a block: a card name, a total'],
	['title-sm', 'The lead of a block: a card name, a total'],
	['table-header', 'Table headers'],
	['label-xl', 'Single-line text: controls, nav, labels'],
	['label-lg', 'Single-line text: controls, nav, labels'],
	['label-md', 'Single-line text: controls, nav, labels'],
	['label-sm', 'Single-line text: controls, nav, labels'],
	['label-xs', 'Non-interactive metadata only'],
	['body-xl', 'Multi-line copy'],
	['body-lg', 'Multi-line copy'],
	['body-md', 'Multi-line copy'],
	['body-sm', 'Multi-line copy'],
	['body-xs', 'Non-interactive metadata only'],
	['mono-xl', 'Headline values'],
	['mono-lg', 'Headline values'],
	['mono-md-bold', 'The number a block exists to show'],
	['mono-sm-bold', 'The number a block exists to show'],
	['mono-md', 'Summary values, code, addresses'],
	['mono-sm', 'Summary values, code, addresses']
] as const

/** The style's size / line height / weight as the browser resolves it at this width. */
function TypeMetrics() {
	return (
		<span
			ref={(node) => {
				const sample = node?.parentElement?.querySelector('[data-sample]')
				if (!node || !sample) return
				const style = getComputedStyle(sample)
				node.textContent = `${style.fontSize} / ${style.lineHeight} · ${style.fontWeight}`
			}}
			className="mono-sm text-tertiary"
		/>
	)
}

function TypeOverview() {
	return (
		<Example
			wide
			name="Type styles"
			note="Named styles from src/styles/typography.css; never a raw text size. Sizes shown are at this width (some step down on phones)."
		>
			<div className="grid grid-cols-[9rem_minmax(0,1fr)_12rem] items-baseline gap-x-6 gap-y-4">
				{TYPE_STYLES.map(([style, use]) => (
					<div key={style} className="contents">
						<span className="flex flex-col">
							<span className="mono-sm text-primary">{style}</span>
							<span className="body-xs text-tertiary">{use}</span>
						</span>
						<span data-sample className={`truncate text-primary ${style}`}>
							Total value locked $12,345.67
						</span>
						<TypeMetrics />
					</div>
				))}
			</div>
		</Example>
	)
}

export const typography: Foundation = {
	id: 'type',
	name: 'Type',
	source: 'src/styles/typography.css',
	overview: TypeOverview
}
