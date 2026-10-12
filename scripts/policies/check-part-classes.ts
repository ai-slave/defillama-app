import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { policyTargetFiles } from '../lib/sourceFiles'

/*
 * Part classes policy. A src/ui part draws its own look; a caller's `className` only places it (design.md → Class
 * composition). Each part that takes a className has a kind below, which says what else a caller may pass:
 *
 *   placement  where the part sits and whether it shows: margin, flex and grid placement, width, position, display,
 *              overflow and wrapping, cursor and pointer behavior, `group`/`peer` markers, transition timing, and
 *              opacity-0/opacity-100 to reveal it (a partial opacity is a look).
 *   box        placement, plus height and the layout and text style of the content it holds (it draws no text).
 *   region     box, plus padding: a part that draws no surface at all (TabPanel), so its padding is the content inset.
 *   text       placement, plus the named type style and text tier of text that draws none of its own.
 *   shell      placement, plus height: loading, empty and skeleton shells whose height the slot sets.
 *   icon       placement, plus size, color, opacity and motion.
 *
 * Fill, border, radius, shadow, padding, type and partial opacity never go in a part's className unless the part's
 * `allow` names them; each allowance repeats a rule from that part's header. A class that only works through a
 * variant (hover:, md:, group-hover:) is judged by its base class.
 *
 * Every part a caller passes a className to must be listed, so a new part declares its kind before it is used. The
 * check reads string literals, template literals, conditional branches, clsx() arguments and same-file consts; a
 * className forwarded from a wrapper's own prop is checked where that wrapper's caller writes it only when the wrapper
 * is itself a part.
 *
 * EXCEPTIONS names a file and part where a class is deliberate, with its reason. An exception that no longer matches
 * fails, so the list never outlives the code it excuses.
 */

const root = path.resolve(import.meta.dirname, '../..')
const sourceRoot = path.join(root, 'src')

type Family =
	| 'placement'
	| 'height'
	| 'size'
	| 'content-layout'
	| 'content-text'
	| 'padding'
	| 'radius'
	| 'motion'
	| 'look'
type Kind = 'placement' | 'box' | 'region' | 'text' | 'shell' | 'icon'
type Allowance = { classes: RegExp; reason: string; variant?: RegExp }
type Part = { kind: Kind; allow?: ReadonlyArray<Allowance>; deny?: { classes: RegExp; reason: string } }

const KINDS: Record<Kind, ReadonlyArray<Family>> = {
	placement: ['placement'],
	box: ['placement', 'height', 'content-layout', 'content-text'],
	region: ['placement', 'height', 'content-layout', 'content-text', 'padding'],
	text: ['placement', 'content-text'],
	shell: ['placement', 'height'],
	icon: ['placement', 'size', 'content-text', 'motion']
}

// First match wins.
const FAMILIES: ReadonlyArray<[Family, RegExp]> = [
	[
		'placement',
		/^(m[xytblrse]?-|self-|justify-self-|place-self-|order-|col-|row-|basis-|flex-(1|auto|none|initial)$|shrink|grow|grid-(rows|cols)-subgrid$|w-|min-w-|max-w-|h-full$|size-full$|static$|relative$|absolute$|fixed$|sticky$|isolate$|z-|inset(-[xyse])?-(?!shadow|ring)|top-|bottom-|left-|right-|start-|end-|translate-|hidden$|block$|inline$|inline-block$|flex$|inline-flex$|grid$|inline-grid$|contents$|sr-only$|not-sr-only$|visible$|invisible$|opacity-(0|100)$|overflow|overscroll|truncate$|text-ellipsis$|line-clamp|break-|whitespace-|text-(wrap|nowrap|balance|pretty)$|scroll-m|snap-|pointer-events|touch-|select-|cursor-|group$|group\/|peer$|peer\/|@container|tabular-nums$|align-|list-none$|transition|duration-|ease-|delay-)/
	],
	['height', /^(h-|min-h-|max-h-)/],
	['size', /^size-/],
	[
		'content-layout',
		/^(flex-(row|col|wrap|nowrap)|gap-|space-[xy]-|items-|justify-|content-|place-(items|content)-|grid-(cols|rows|flow)|auto-(cols|rows)|text-(left|right|center|start|end|justify)$|divide-)/
	],
	[
		'content-text',
		/^((label|body|title|heading|mono)-[a-z]+(-bold)?|text-(primary|secondary|tertiary|link|disabled|error|warning|success|data-up|data-down|on-brand)$|prose)/
	],
	['padding', /^p[xytblrse]?-/],
	['radius', /^rounded/],
	['motion', /^(animate-|rotate-|scale-|origin-)/],
	['look', /./]
]

const LINK_TYPE: Allowance = {
	classes: /^(label|body|title|heading|mono)-[a-z]+$/,
	reason: 'a named type style for a link alone in its row'
}
const TRIGGER_ALIGN: Allowance = {
	classes: /^(justify-|items-|gap-)/,
	reason: 'alignment inside the trigger box'
}

const SURFACE_SIZE = {
	classes: /^(w-|min-w-|max-w-|h-|min-h-|max-h-|overflow)/,
	reason: "the surface's `width` and `maxHeight` props own its size"
}
// A box that draws its own text: callers lay out what it holds but never restyle its text.
const OWN_TEXT = {
	classes:
		/^((label|body|title|heading|mono)-|text-(primary|secondary|tertiary|link|disabled|error|warning|success|data-up|data-down|on-brand)$)/,
	reason: 'the part draws its own type and text tier'
}

const PARTS: Record<string, Part> = {
	// Controls and parts that draw their own text: placement only.
	Button: { kind: 'placement', allow: [{ ...LINK_TYPE, variant: /^(link|inlineLink)$/ }] },
	ButtonGroup: { kind: 'placement' },
	Checkbox: { kind: 'placement' },
	ChartPanelToolbar: { kind: 'placement' },
	ComboboxSelectTrigger: { kind: 'placement' },
	ConfirmActionDialog: { kind: 'placement' },
	ConfirmDialog: { kind: 'placement' },
	CopyHelper: { kind: 'placement' },
	DataFreshness: { kind: 'placement' },
	Dialog: { kind: 'placement' },
	DialogCloseButton: { kind: 'placement' },
	DisclosureChevron: { kind: 'placement' },
	DividedGrid: { kind: 'placement' },
	EntityTitleStrip: { kind: 'placement' },
	Field: { kind: 'placement' },
	FieldGroup: { kind: 'placement' },
	FileButton: { kind: 'placement' },
	Hovercard: { kind: 'placement', allow: [TRIGGER_ALIGN] },
	InlineRenameInput: { kind: 'placement' },
	InlineTextField: { kind: 'placement' },
	Input: {
		kind: 'placement',
		allow: [{ classes: /^p[lr]-/, reason: 'padding that clears an icon or button laid over the field' }]
	},
	Menu: { kind: 'placement' },
	MetaLine: { kind: 'placement' },
	MetricOptionChip: { kind: 'placement' },
	MetricRow: { kind: 'placement' },
	MetricSeriesToggle: { kind: 'placement' },
	MultiSelectCombobox: { kind: 'placement' },
	NestedMenu: { kind: 'placement' },
	OptionTile: { kind: 'placement' },
	PanelHeader: { kind: 'placement' },
	PanelTitle: { kind: 'placement' },
	PopoverSelectTrigger: { kind: 'placement' },
	PromoBadge: { kind: 'placement' },
	RailItem: { kind: 'placement' },
	RowExpandButton: { kind: 'placement' },
	SearchField: { kind: 'placement' },
	SegmentedControl: {
		kind: 'placement',
		allow: [{ classes: /^grid-flow-col$/, reason: 'lays mode segments side by side', variant: /^mode$/ }]
	},
	Select: { kind: 'placement' },
	SelectWithCombobox: { kind: 'placement' },
	SideSheet: { kind: 'placement' },
	StatusBadge: { kind: 'placement' },
	SubMetricRow: { kind: 'placement' },
	SummaryCardGrid: { kind: 'placement' },
	Switch: { kind: 'placement' },
	Tab: { kind: 'placement' },
	TabLink: { kind: 'placement' },
	TabNav: { kind: 'placement' },
	TableToolbar: {
		kind: 'placement',
		allow: [{ classes: /^min-h-/, reason: 'a min height shared with a neighboring row' }]
	},
	TableToolbarControlGroup: { kind: 'placement' },
	Tag: { kind: 'placement' },
	TagButton: { kind: 'placement' },
	TagLink: { kind: 'placement' },
	TextLink: { kind: 'placement', allow: [LINK_TYPE] },
	Tooltip: { kind: 'placement', allow: [TRIGGER_ALIGN] },
	UnderlineTabList: { kind: 'placement' },
	VirtualizedMultiSelect: { kind: 'placement' },
	VirtualizedSelect: { kind: 'placement' },
	Watermark: { kind: 'placement' },
	// Floating surfaces: `width` and `maxHeight` own their size and the variant owns the chrome.
	ComboboxSurface: { kind: 'placement', deny: SURFACE_SIZE },
	MenuSurface: { kind: 'placement', deny: SURFACE_SIZE },
	PopoverSurface: { kind: 'placement', deny: SURFACE_SIZE },
	PopoverFooterAction: { kind: 'placement' },
	PopoverList: { kind: 'placement' },
	PopoverRow: { kind: 'placement' },
	// Boxes hold any content and draw no text.
	Card: {
		kind: 'box',
		allow: [{ classes: /^hover-wash-card$/, reason: 'the card wash on a card that is a link or button' }]
	},
	ListRow: { kind: 'box', deny: OWN_TEXT },
	Panel: { kind: 'box' },
	StatItem: {
		kind: 'box',
		deny: OWN_TEXT,
		allow: [
			{ classes: /^p[xytblrse]?-/, reason: "a cell's own inset inside DividedGrid, whose cells keep their padding" }
		]
	},
	TabPanel: { kind: 'region' },
	// Text with no type or color of its own.
	Definition: { kind: 'text', allow: [TRIGGER_ALIGN] },
	RelativeTime: { kind: 'text' },
	StaleText: { kind: 'text' },
	// Shells the slot sizes.
	ChartPanelBody: { kind: 'shell' },
	ChartPanelExportShellLoading: { kind: 'shell' },
	DashedTile: { kind: 'shell' },
	EmptyState: { kind: 'shell' },
	ImageReplaceTile: { kind: 'shell' },
	PanelLoadingStatus: { kind: 'shell' },
	PanelStatus: { kind: 'shell' },
	Skeleton: {
		kind: 'shell',
		allow: [
			{ classes: /^rounded/, reason: "the placeholder's radius, an initial: default" },
			{ classes: /^size-/, reason: "the placeholder's size" }
		]
	},
	SmolStatCard: { kind: 'shell' },
	SummaryStatsCard: { kind: 'shell' },
	SurfaceBodyLoadingStatus: { kind: 'shell' },
	SurfaceBodyStatus: { kind: 'shell' },
	Textarea: {
		kind: 'shell',
		allow: [{ classes: /^(resize|field-sizing-content$)/, reason: 'how the field grows' }]
	},
	UploadTile: { kind: 'shell' },
	Icon: {
		kind: 'icon',
		allow: [{ classes: /^(text-|fill-current$|opacity-)/, reason: "the icon's color and dimming" }]
	},
	QuestionHelper: {
		kind: 'icon',
		allow: [{ classes: /^(text-|opacity-)/, reason: 'the color of the icon the className lands on' }]
	}
}

const EXCEPTIONS: Record<string, { classes: RegExp; reason: string }> = {
	'src/containers/Articles/renderer/ArticleRenderer.tsx TextLink': {
		classes: /^(uppercase|tracking-\[0\.08em\])$/,
		reason:
			"the client eyebrow above a public article's title, in the uppercase tracking the public research pages keep (design.md → research)"
	},
	'src/containers/Downloads/sql/QueryTabBar.tsx Tab': {
		classes: /^(items-center|gap-1\.5|rounded-tl-md|px-2\.5|text-left|font-medium)$/,
		reason:
			"the SQL editor's closable, renamable query tabs, drawn like browser tabs, a look neither the underline nor the segmented tabs fit; the Tab fills each one as its click area"
	},
	'src/containers/Investors/dashboards/spark/Financials.tsx TextLink': {
		classes: /^py-3$/,
		reason: 'the link fills its table row, so the whole row opens the report rather than only its text'
	},
	'src/containers/LlamaAI/components/sidebar/AgenticSidebar.tsx Card': {
		classes: /^motion-safe:animate-\[slideInRight_0\.15s_ease-out\]$/,
		reason: 'the agent sidebar slides in from the right when it opens'
	},
	'src/containers/LlamaAI/index.tsx Card': {
		classes: /^(llamaai-chat-panel|motion-safe:lg:animate-\[shrinkToRight_0\.1s_ease-out\])$/,
		reason:
			'the chat panel: llamaai-chat-panel makes it the container the chat width queries read, and it shrinks in from the right when the dashboard panel opens'
	},
	'src/containers/ProDashboard/components/ChartGrid.tsx Card': {
		classes: /^data-\[dragging=true\]:(border-dashed|border-brand-strong|bg-page|shadow-none)$/,
		reason:
			'a card being dragged becomes a dashed brand drop slot in place; the sortable item cannot swap to DashedTile mid-drag'
	},
	'src/containers/ProDashboard/components/DashboardTabs.tsx TabPanel': {
		classes: /^animate-pro-fade-in$/,
		reason: 'a dashboard section fades in as its tab opens'
	},
	'src/containers/ProDashboard/components/DragPreviewCard.tsx Card': {
		classes: /^shadow-dialog$/,
		reason: 'the drag ghost floats over the grid while a card moves, so it takes an elevation no resting card has'
	},
	'src/containers/ProDashboard/components/Rating.tsx Card': {
		classes: /^animate-pro-glow$/,
		reason: "the AI rating card's brand glow, the Pro mark of a live AI score"
	},
	'src/containers/Subscription/Layout.tsx MenuSurface': {
		classes: /^theme-dark$/,
		reason: 'a menu portaled out of the always-dark page, so it carries the theme-dark scope itself'
	},
	'src/pages/sheets/index.tsx MenuSurface': {
		classes: /^theme-dark$/,
		reason: 'a menu portaled out of the always-dark page, so it carries the theme-dark scope itself'
	},
	'src/containers/TokenPricingCheck/index.tsx SelectWithCombobox': {
		classes: /^pl-9$/,
		reason: "padding that clears the chain logo laid over the trigger, the job Input's overlay padding does on a field"
	},
	'src/containers/Yields/VaultRisk/components/MarketOracleTable.tsx Card': {
		classes: /^smooth-disclosure$/,
		reason: 'a Card that is a details element and animates open and closed (smooth-disclosure)'
	},
	'src/containers/Yields/poolDetail/PoolHeader.tsx PanelHeader': {
		classes: /^min-h-14$/,
		reason:
			'a header with no controls, held at the height a header with a 32px control has, level with the panels beside it'
	},
	'src/containers/ProDashboard/components/CreateDashboardPicker.tsx Card': {
		classes: /^aria-disabled:opacity-60$/,
		reason:
			'option cards whose brand icon tiles carry their own color, dimmed as one while a dashboard is created (the same reason as its disabled-opacity exception)'
	},
	'src/components/Table/TableFrame.tsx Tooltip': {
		classes: /^(underline|decoration-dotted)$/,
		reason:
			"a sortable column header with a definition: the sort button carries Definition's dotted mark, which a Definition cannot, since it is never a button"
	},
	'src/components/Table/PaginatedTable.tsx Tooltip': {
		classes: /^(underline|decoration-dotted)$/,
		reason:
			"a sortable column header with a definition: the sort button carries Definition's dotted mark, which a Definition cannot, since it is never a button"
	}
}

type Violation = { file: string; line: number; part: string; cls: string; message: string }

const parse = (relative: string, source: string) =>
	ts.createSourceFile(relative, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

/** The class strings an expression can produce. Literals compared against a prop or passed to a non-clsx call are
    values, not classes, and are skipped. */
function classStrings(
	expression: ts.Expression,
	consts: Map<string, ts.Expression>,
	seen = new Set<string>()
): Array<string> {
	if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return [expression.text]
	if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression))
		return classStrings(expression.expression, consts, seen)
	if (ts.isArrayLiteralExpression(expression))
		return expression.elements.flatMap((element) => classStrings(element, consts, seen))
	if (ts.isTemplateExpression(expression)) {
		const strings = [expression.head.text]
		for (const span of expression.templateSpans) {
			strings.push(...classStrings(span.expression, consts, seen), span.literal.text)
		}
		return strings
	}
	if (ts.isConditionalExpression(expression))
		return [...classStrings(expression.whenTrue, consts, seen), ...classStrings(expression.whenFalse, consts, seen)]
	if (ts.isBinaryExpression(expression)) {
		const operator = expression.operatorToken.kind
		if (operator === ts.SyntaxKind.AmpersandAmpersandToken) return classStrings(expression.right, consts, seen)
		if (
			operator === ts.SyntaxKind.BarBarToken ||
			operator === ts.SyntaxKind.QuestionQuestionToken ||
			operator === ts.SyntaxKind.PlusToken
		)
			return [...classStrings(expression.left, consts, seen), ...classStrings(expression.right, consts, seen)]
		return []
	}
	if (
		ts.isCallExpression(expression) &&
		ts.isIdentifier(expression.expression) &&
		expression.expression.text === 'clsx'
	)
		return expression.arguments.flatMap((argument) => classStrings(argument, consts, seen))
	// `…`.trim() and [a, b].join(' ') keep their classes.
	if (
		ts.isCallExpression(expression) &&
		ts.isPropertyAccessExpression(expression.expression) &&
		['trim', 'join'].includes(expression.expression.name.text)
	)
		return classStrings(expression.expression.expression, consts, seen)
	// LOOKS.primary or LOOKS['primary'] on a same-file object.
	const key = ts.isPropertyAccessExpression(expression)
		? expression.name.text
		: ts.isElementAccessExpression(expression) && ts.isStringLiteral(expression.argumentExpression)
			? expression.argumentExpression.text
			: null
	if (key !== null && (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression))) {
		const target = expression.expression
		let object: ts.Expression | undefined = ts.isIdentifier(target) ? consts.get(target.text) : undefined
		while (
			object &&
			(ts.isAsExpression(object) || ts.isSatisfiesExpression(object) || ts.isParenthesizedExpression(object))
		)
			object = object.expression
		if (object && ts.isObjectLiteralExpression(object)) {
			const property = object.properties.find(
				(entry): entry is ts.PropertyAssignment =>
					ts.isPropertyAssignment(entry) && entry.name.getText().replace(/['"]/g, '') === key
			)
			return property ? classStrings(property.initializer, consts, seen) : []
		}
		return []
	}
	if (ts.isIdentifier(expression) && consts.has(expression.text) && !seen.has(expression.text)) {
		seen.add(expression.text)
		return classStrings(consts.get(expression.text)!, consts, seen)
	}
	return []
}

function familyOf(base: string): Family {
	return FAMILIES.find(([, pattern]) => pattern.test(base))![0]
}

/** The class with its variants, important mark and negative sign removed: `md:hover:!-mt-1` → `mt-1`. */
function baseOf(cls: string) {
	const parts = cls.split(/:(?![^[]*\])/)
	return parts[parts.length - 1].replace(/^!/, '').replace(/^-/, '')
}

// An arbitrary property ([grid-area:1/1]) places the part only when the CSS property it sets is a placement one.
const PLACEMENT_PROPERTY =
	/^(grid-area|grid-column|grid-row|order|z-index|flex|flex-basis|flex-grow|flex-shrink|align-self|justify-self|place-self|width|min-width|max-width|margin(-[a-z]+)?|inset(-[a-z]+)?|top|right|bottom|left|text-transform|scroll-margin(-[a-z]+)?)$/

/** `variant`: the part's variant when it is a string, `*` when an expression decides it (any allowance may apply), and
    null when the part takes its default. */
function refused(name: string, part: Part, cls: string, variant: string | null): string | null {
	const base = baseOf(cls)
	if (!base) return null
	if (part.deny?.classes.test(base)) return `${cls}: ${part.deny.reason}`
	const property = /^\[([a-z-]+):/.exec(base)?.[1]
	const family: Family = property ? (PLACEMENT_PROPERTY.test(property) ? 'placement' : 'look') : familyOf(base)
	if (KINDS[part.kind].includes(family)) return null
	for (const allowance of part.allow ?? []) {
		if (
			allowance.classes.test(base) &&
			(!allowance.variant || variant === '*' || (variant !== null && allowance.variant.test(variant)))
		)
			return null
	}
	return `${cls} (${family}): ${name} is a ${part.kind} part and takes ${KINDS[part.kind].join(', ')}`
}

function scanSource(relative: string, sourceFile: ts.SourceFile): Array<Violation> {
	const parts = new Map<string, string>()
	for (const statement of sourceFile.statements) {
		if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue
		if (!/^~\/ui\/(?!internal\/)/.test(statement.moduleSpecifier.text)) continue
		const bindings = statement.importClause?.namedBindings
		if (!bindings || !ts.isNamedImports(bindings)) continue
		for (const element of bindings.elements) parts.set(element.name.text, (element.propertyName ?? element.name).text)
	}
	if (parts.size === 0) return []
	const consts = new Map<string, ts.Expression>()
	const collect = (node: ts.Node) => {
		if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer)
			consts.set(node.name.text, node.initializer)
		ts.forEachChild(node, collect)
	}
	collect(sourceFile)
	const violations: Array<Violation> = []
	const visit = (node: ts.Node) => {
		if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
			const tag = node.tagName.getText(sourceFile)
			const name = parts.get(tag)
			const attribute = node.attributes.properties.find(
				(property): property is ts.JsxAttribute =>
					ts.isJsxAttribute(property) && property.name.getText(sourceFile) === 'className'
			)
			const sources: Array<ts.Expression> = []
			if (attribute?.initializer)
				sources.push(
					ts.isJsxExpression(attribute.initializer) ? attribute.initializer.expression! : attribute.initializer
				)
			// {...(high ? { className: tone } : {})} reaches the part the same way.
			for (const property of node.attributes.properties) {
				if (!ts.isJsxSpreadAttribute(property)) continue
				const find = (inner: ts.Node) => {
					if (ts.isPropertyAssignment(inner) && inner.name.getText(sourceFile) === 'className')
						sources.push(inner.initializer)
					ts.forEachChild(inner, find)
				}
				find(property.expression)
			}
			if (name && sources.length > 0) {
				const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
				const part = PARTS[name]
				if (!part) {
					violations.push({
						file: relative,
						line,
						part: name,
						cls: '',
						message: `${name} takes a className but has no kind in PARTS`
					})
				} else {
					const variantAttribute = node.attributes.properties.find(
						(property): property is ts.JsxAttribute =>
							ts.isJsxAttribute(property) && property.name.getText(sourceFile) === 'variant'
					)
					const initializer = variantAttribute?.initializer
					const literal =
						initializer &&
						ts.isJsxExpression(initializer) &&
						initializer.expression &&
						ts.isStringLiteral(initializer.expression)
							? initializer.expression
							: initializer
					const variant = !initializer ? null : literal && ts.isStringLiteral(literal) ? literal.text : '*'
					const classes = sources
						.flatMap((source) => classStrings(source, consts))
						.join(' ')
						.split(/\s+/)
						.filter(Boolean)
					for (const cls of new Set(classes)) {
						const message = refused(name, part, cls, variant)
						if (message) violations.push({ file: relative, line, part: name, cls, message })
					}
				}
			}
		}
		ts.forEachChild(node, visit)
	}
	visit(sourceFile)
	return violations
}

if (process.argv.includes('--self-test')) {
	const cases: Array<{ name: string; source: string; expect: number }> = [
		{
			name: 'placement on a control',
			source: `import { Button } from '~/ui/Button'\nexport const A = () => <Button className="ml-auto w-full shrink-0 md:hidden" />`,
			expect: 0
		},
		{
			name: 'look on a control',
			source: `import { Button } from '~/ui/Button'\nexport const A = () => <Button className="rounded-full px-4 bg-brand" />`,
			expect: 3
		},
		{
			name: 'named type on a link button',
			source: `import { Button } from '~/ui/Button'\nexport const A = () => <Button variant="link" className="label-md" />`,
			expect: 0
		},
		{
			name: 'named type on a plain button',
			source: `import { Button } from '~/ui/Button'\nexport const A = () => <Button className="label-md" />`,
			expect: 1
		},
		{
			name: 'look behind a const',
			source: `import { Tooltip } from '~/ui/Tooltip'\nconst LOOK = 'size-6 rounded-sm bg-brand-tint'\nexport const A = () => <Tooltip content="x" className={LOOK} />`,
			expect: 3
		},
		{
			name: 'content layout and text on a box',
			source: `import { Card } from '~/ui/Card'\nexport const A = () => <Card padding="sm" className="col-span-2 flex flex-col gap-3 body-sm text-tertiary" />`,
			expect: 0
		},
		{
			name: 'padding on a box',
			source: `import { Card } from '~/ui/Card'\nexport const A = () => <Card padding="sm" className="p-6 shadow-dialog" />`,
			expect: 2
		},
		{
			name: 'reveal versus dim',
			source: `import { Button } from '~/ui/Button'\nexport const A = () => <Button className="opacity-0 group-hover:opacity-100 opacity-50" />`,
			expect: 1
		},
		{
			name: 'values compared or passed to a call are not classes',
			source: `import { Card } from '~/ui/Card'\nexport const A = ({ size }) => <Card padding="sm" className={clsx(size === 'sm' && 'gap-2', pick('rounded-full'))} />`,
			expect: 0
		},
		{
			name: 'unlisted part',
			source: `import { Mystery } from '~/ui/Mystery'\nexport const A = () => <Mystery className="ml-2" />`,
			expect: 1
		},
		{
			name: 'look behind trim, join, an object property and a spread',
			source: `import { Card } from '~/ui/Card'\nimport { Tooltip } from '~/ui/Tooltip'\nconst LOOKS = { a: 'bg-brand' } as const\nexport const A = ({ high }) => <><Card padding="sm" className={\`rounded-full \${LOOKS.a}\`.trim()} /><Card padding="sm" className={['shadow-dialog', 'mt-2'].join(' ')} /><Tooltip content="x" {...(high ? { className: 'text-error' } : {})} /></>`,
			expect: 4
		},
		{
			name: 'inset looks and arbitrary properties',
			source: `import { Card } from '~/ui/Card'\nexport const A = () => <Card padding="sm" className="inset-x-0 inset-shadow-sm [background:red] [grid-area:1/1]" />`,
			expect: 2
		},
		{
			name: 'a variant an expression decides',
			source: `import { SegmentedControl } from '~/ui/SegmentedControl'\nexport const A = ({ v }) => <SegmentedControl variant={v} className="grid-flow-col" />`,
			expect: 0
		},
		{
			name: 'text on a box that draws its own',
			source: `import { ListRow } from '~/ui/ListRow'\nimport { StatItem } from '~/ui/SummaryStats'\nexport const A = () => <><ListRow className="gap-3 body-md" /><StatItem className="p-3" /></>`,
			expect: 1
		},
		{
			name: 'size on a surface',
			source: `import { MenuSurface } from '~/ui/PopoverSurface'\nexport const A = () => <MenuSurface className="max-w-sm" />`,
			expect: 1
		}
	]
	const failures = cases.filter(({ name, source, expect }) => {
		const found = scanSource(
			`src/policy-self-test/${name.replace(/\W+/g, '-')}.tsx`,
			parse('self-test.tsx', source)
		).length
		if (found !== expect) console.error(`  ${name}: expected ${expect}, found ${found}`)
		return found !== expect
	})
	if (failures.length > 0) {
		console.error(`Part classes policy self-test failed: ${failures.map(({ name }) => name).join(', ')}`)
		process.exit(1)
	}
	console.log(`Part classes policy self-test passed (${cases.length} cases).`)
	process.exit(0)
}

const relativeOf = (file: string) => path.relative(root, file).split(path.sep).join('/')
const scanned = policyTargetFiles(root, sourceRoot)
	.map(relativeOf)
	.filter(
		(file) => file.endsWith('.tsx') && !file.startsWith('src/ui/') && !/(^|\/)__tests__\/|\.test\.tsx$/.test(file)
	)
const failures: Array<string> = []
const excused = new Set<string>()
for (const relative of scanned) {
	const sourceFile = parse(relative, fs.readFileSync(path.join(root, relative), 'utf8'))
	for (const { file, line, part, cls, message } of scanSource(relative, sourceFile)) {
		const key = `${file} ${part}`
		if (EXCEPTIONS[key]?.classes.test(cls)) excused.add(key)
		else failures.push(`${file}:${line} <${part}> ${message}`)
	}
}
for (const key of Object.keys(EXCEPTIONS)) {
	if (scanned.includes(key.split(' ')[0]) && !excused.has(key))
		failures.push(`${key} no longer matches; remove it from EXCEPTIONS`)
}

if (failures.length > 0) {
	console.error(
		`Part classes policy violations (${failures.length}):\n${failures.map((failure) => `- ${failure}`).join('\n')}`
	)
	process.exit(1)
}

console.log('Part classes policy passed.')
