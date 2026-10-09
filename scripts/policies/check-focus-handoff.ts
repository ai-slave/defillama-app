import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { policyTargetFiles } from '../lib/sourceFiles'

/*
 * Focus handoff policy. A control that the browser disables while it has focus drops focus to the page, so a
 * keyboard reader starts over from the top (docs/focus-and-errors.md → "Where focus goes when a control leaves").
 * Three mechanical shapes cause it and are refused here:
 *
 * 1. A submit button inside a `<fieldset disabled>`: the lock disables the pending button that should hold focus.
 *    Wrap only the fields; the submit sits outside and the submit handler focuses `event.nativeEvent.submitter`.
 * 2. A text `input`, `textarea` or `Input` disabled by a pending flag: the field being typed in loses focus. Use
 *    `readOnly` while the request runs. Checkboxes, radios and file inputs cannot be read-only; their form focuses
 *    the pending submit when the request starts, so they are not checked.
 * 3. A submit `Button` or `button` disabled by a pending flag without `pendingLabel`: the button that started the
 *    request loses focus. Use `pendingLabel`, which keeps it focusable and says what is running. Other buttons
 *    (Cancel, Back) may disable while a request runs: they do not hold focus when it starts.
 *
 * 4. A focus anchor (`tabIndex={-1}`) with `outline-hidden`: focus moved there on purpose, so the keyboard reader
 *    should see where it landed. Keep the global focus ring.
 * 5. `Ariakit.Button` rendering `Button` or `ProButton`: both are Ariakit's Button already, so the wrapper only
 *    duplicates it. Pass `disabled` and `accessibleWhenDisabled` to the button itself.
 * 6. A `Tooltip` without `render` whose child is a control (a button, link or Ariakit disclosure; CONTROL_TAGS): the
 *    tooltip's span becomes the anchor, so `aria-describedby` misses the focusable control and a tap both opens the
 *    tooltip and runs the control. Pass the control as `render`.
 * 7. A button disabled by its position (a pager at its first or last page, move up or down at an edge, undo with no
 *    history; STEP_LIMIT): pressing it is what moves it to that limit, so it disables itself while it has focus. Pass
 *    `accessibleWhenDisabled` (Button, ProButton or `Ariakit.Button`; a raw `button` cannot keep focus while disabled).
 * 8. A `Tooltip` without `render` whose `className` sets the anchor's own display, shrink or overflow (ANCHOR_BOX): the
 *    default span is `flex shrink-0`, so `min-w-0`, `flex-1` or `truncate` there never shrink it or draw an ellipsis,
 *    and a display class only wins by CSS order. Pass the anchor as `render` with the classes it needs.
 * 9. A native `title=` on a control (CONTROL_TAGS, any `Ariakit.*`): touch and keyboard readers never see it. Name the
 *    control with `aria-label` and show the text in a `Tooltip` (design.md → Icons).
 * 10. An icon-only `Button`/`ProButton` (`square`) that no Tooltip, Hovercard or menu renders as its anchor (it is not a
 *    `render` value): sighted mouse readers get no name. Exceptions named in design.md: a disclosure chevron
 *    (`aria-expanded`), a composer's send arrow (`type="submit"`) and a field's clear ✕ (`aria-label` starting "Clear").
 * 11. A retry rendered as a link (`variant="link"` labelled Retry or Try again): a retry is a small secondary Button
 *    beside the error (docs/focus-and-errors.md).
 *
 * "Pending flag" means the `disabled` expression names something pending or saving (isPending, pending, isSaving,
 * saving, submitting). Other reasons to disable are outside this check.
 */

const root = path.resolve(import.meta.dirname, '../..')
const sourceRoot = path.join(root, 'src')

const PENDING_NAME = /\b(?:is)?(?:pending|saving|submitting)\b|\.isPending\b|Pending\b/i
const ANCHOR_BOX =
	/(?:^|[\s`'"{:])(?:min-w-0|flex-1|grow|shrink|truncate|block!?|inline(?:-block|-flex)?|line-clamp-\d+|overflow-[a-z-]+)(?=[\s`'"}$]|$)/
const FIELD_TAGS = new Set(['input', 'textarea', 'Input'])
const BUTTON_TAGS = new Set(['button', 'Button'])
const NON_TEXT_TYPES = new Set(['checkbox', 'radio', 'file'])
const STEP_LIMIT =
	/\bcan(?:(?:Next|Prev(?:ious)?)(?:Page)?|Move(?:Up|Down)|Undo|Redo)\b|getCan(?:Next|Previous)Page\b|\bhas(?:Next|Prev(?:ious)?)(?:Page)?\b|\bis(?:First|Last)(?:Page)?\b|\b\w*page(?:Index)?\s*(?:[<>]=?|===?)|(?:[<>]=?|===?)\s*\w*page/i
const STEP_TAGS = new Set(['button', 'Button', 'ProButton', 'Ariakit.Button'])
const CONTROL_TAGS = new Set([
	'button',
	'Button',
	'ProButton',
	'a',
	'BasicLink',
	'ButtonLink',
	'ExternalLinkButton',
	'Ariakit.MenuButton',
	'Ariakit.PopoverDisclosure',
	'Ariakit.DialogDisclosure'
])

function tagName(node: ts.JsxOpeningLikeElement): string {
	return node.tagName.getText()
}

function attribute(node: ts.JsxOpeningLikeElement, name: string): ts.JsxAttribute | undefined {
	for (const property of node.attributes.properties) {
		if (ts.isJsxAttribute(property) && property.name.getText() === name) return property
	}
	return undefined
}

function expressionText(attr: ts.JsxAttribute): string {
	const initializer = attr.initializer
	if (!initializer) return 'true'
	if (ts.isStringLiteral(initializer)) return initializer.text
	return ts.isJsxExpression(initializer) && initializer.expression ? initializer.expression.getText() : ''
}

function inputType(node: ts.JsxOpeningLikeElement): string {
	const type = attribute(node, 'type')
	return type ? expressionText(type).replace(/['"]/g, '') : ''
}

function isSubmit(node: ts.JsxOpeningLikeElement): boolean {
	return inputType(node) === 'submit'
}

export function scanSource(relative: string, source: string): Array<string> {
	if (relative.includes('/__tests__/') || relative.startsWith('src/dev/')) return []
	const sourceFile = ts.createSourceFile(relative, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
	const violations: Array<string> = []
	const at = (node: ts.Node) => `${relative}:${sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1}`

	const visit = (node: ts.Node, insideLockedFieldset: boolean, isRenderValue: boolean) => {
		let locked = insideLockedFieldset
		const opening = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null
		if (opening) {
			const tag = tagName(opening)
			const disabled = attribute(opening, 'disabled')
			if (tag === 'fieldset' && disabled) locked = true
			if (insideLockedFieldset && isSubmit(opening)) {
				violations.push(
					`${at(opening)} puts a submit inside a disabled fieldset; lock only the fields and focus event.nativeEvent.submitter on submit`
				)
			}
			const render = attribute(opening, 'render')
			if (tag === 'Ariakit.Button' && render && /^<(?:Button|ProButton)\b/.test(expressionText(render))) {
				violations.push(
					`${at(opening)} wraps a Button in Ariakit.Button; Button is Ariakit's Button already, so pass its props to it`
				)
			}
			const tooltipClassName = tag === 'Tooltip' && !render ? attribute(opening, 'className') : undefined
			if (tooltipClassName && ANCHOR_BOX.test(tooltipClassName.getText())) {
				violations.push(
					`${at(opening)} sizes Tooltip's default span with className; pass the anchor as render with those classes`
				)
			}
			if (tag === 'Tooltip' && !render && ts.isJsxElement(node)) {
				for (const child of node.children) {
					const childOpening = ts.isJsxElement(child)
						? child.openingElement
						: ts.isJsxSelfClosingElement(child)
							? child
							: null
					if (childOpening && CONTROL_TAGS.has(tagName(childOpening))) {
						violations.push(`${at(opening)} wraps a control in Tooltip's span; pass the control as render`)
					}
				}
			}
			if (attribute(opening, 'title') && (CONTROL_TAGS.has(tag) || tag.startsWith('Ariakit.'))) {
				violations.push(`${at(opening)} names a control with a native title=; use aria-label and a Tooltip`)
			}
			const ariaLabel = attribute(opening, 'aria-label')
			if (
				(tag === 'Button' || tag === 'ProButton') &&
				attribute(opening, 'square') &&
				!isRenderValue &&
				!attribute(opening, 'aria-expanded') &&
				!isSubmit(opening) &&
				!(ariaLabel && /^[`'"]?Clear\b/.test(expressionText(ariaLabel)))
			) {
				violations.push(`${at(opening)} is an icon-only control without a Tooltip; pass it as a Tooltip's render`)
			}
			const variant = attribute(opening, 'variant')
			if (
				variant &&
				expressionText(variant) === 'link' &&
				ts.isJsxElement(node) &&
				/\b(?:Retry|Try again)\b/i.test(node.children.map((child) => child.getText()).join(' '))
			) {
				violations.push(`${at(opening)} renders a retry as a link; use a secondary sm Button labelled Try again`)
			}
			const tabIndex = attribute(opening, 'tabIndex')
			const className = attribute(opening, 'className')
			if (
				tabIndex &&
				expressionText(tabIndex) === '-1' &&
				className &&
				/(?:^|[\s"'`])outline-hidden(?:[\s"'`]|$)/.test(expressionText(className))
			) {
				violations.push(`${at(opening)} hides the focus ring on a focus anchor; keep the ring so focus is visible`)
			}
			if (disabled && STEP_TAGS.has(tag) && STEP_LIMIT.test(expressionText(disabled))) {
				const keepsFocus = attribute(opening, 'accessibleWhenDisabled')
				if (tag === 'button') {
					violations.push(
						`${at(opening)} disables itself at a limit it moves to, and a raw button cannot keep focus while disabled; use Ariakit.Button or Button with accessibleWhenDisabled`
					)
				} else if (!keepsFocus || expressionText(keepsFocus) === 'false') {
					violations.push(
						`${at(opening)} disables itself at a limit it moves to, which drops its focus; pass accessibleWhenDisabled`
					)
				}
			}
			if (disabled && PENDING_NAME.test(expressionText(disabled))) {
				if (FIELD_TAGS.has(tag) && !NON_TEXT_TYPES.has(inputType(opening))) {
					violations.push(`${at(opening)} disables a field while pending, which drops its focus; use readOnly`)
				} else if (BUTTON_TAGS.has(tag) && isSubmit(opening) && !attribute(opening, 'pendingLabel')) {
					violations.push(
						`${at(opening)} disables a button while pending, which drops its focus; show the request with pendingLabel`
					)
				}
			}
		}
		// An element passed as `render` is the anchor of the Tooltip, Hovercard or menu that renders it.
		const rendersChildren = ts.isJsxAttribute(node) && node.name.getText() === 'render'
		ts.forEachChild(node, (child) => visit(child, locked, rendersChildren || (isRenderValue && !opening)))
	}
	visit(sourceFile, false, false)
	return violations
}

if (process.argv.includes('--self-test')) {
	const cases: Array<{ name: string; source: string; violation: boolean }> = [
		{
			name: 'submit inside a locked fieldset',
			source:
				'export const F = () => <form><fieldset disabled={isPending}><Input /><Button type="submit" size="md">Save</Button></fieldset></form>',
			violation: true
		},
		{
			name: 'submit outside the locked fieldset',
			source:
				'export const F = () => <form><fieldset disabled={isPending}><Input /></fieldset><Button type="submit" size="md" pendingLabel="Saving…" pending={isPending}>Save</Button></form>',
			violation: false
		},
		{
			name: 'field disabled while pending',
			source: 'export const F = () => <input name="code" disabled={verify.isPending} />',
			violation: true
		},
		{
			name: 'checkbox disabled while pending',
			source: 'export const F = () => <input type="checkbox" disabled={isSaving} />',
			violation: false
		},
		{
			name: 'field read-only while pending',
			source: 'export const F = () => <input name="code" readOnly={verify.isPending} />',
			violation: false
		},
		{
			name: 'submit disabled while saving without a pending label',
			source: 'export const F = () => <Button type="submit" size="md" disabled={isSaving}>Save</Button>',
			violation: true
		},
		{
			name: 'button with a pending label',
			source:
				'export const F = () => <Button size="md" disabled={isSaving} pendingLabel="Saving…" pending={isSaving}>Save</Button>',
			violation: false
		},
		{
			name: 'cancel disabled while another button saves',
			source: 'export const F = () => <Button type="button" size="md" disabled={isSaving}>Cancel</Button>',
			violation: false
		},
		{
			name: 'focus anchor without a ring',
			source: 'export const F = () => <div tabIndex={-1} className="flex outline-hidden" />',
			violation: true
		},
		{
			name: 'focus anchor with a ring',
			source: 'export const F = () => <div tabIndex={-1} className="flex" />',
			violation: false
		},
		{
			name: 'a ring hidden only on plain focus',
			source: 'export const F = () => <span tabIndex={-1} className="focus:outline-hidden" />',
			violation: false
		},
		{
			name: 'Ariakit.Button wrapping Button',
			source:
				'export const F = () => <Ariakit.Button disabled={atFloor} accessibleWhenDisabled render={<Button size="md" />}>−</Ariakit.Button>',
			violation: true
		},
		{
			name: 'Ariakit.Button with its own styles',
			source:
				'export const F = () => <Ariakit.Button disabled={busy} accessibleWhenDisabled className="px-2">Save</Ariakit.Button>',
			violation: false
		},
		{
			name: 'Ariakit host rendering Button',
			source:
				'export const F = () => <Ariakit.DialogDismiss render={<Button size="md" />}>Cancel</Ariakit.DialogDismiss>',
			violation: false
		},
		{
			name: 'Tooltip wrapping a Button',
			source:
				'export const F = () => <Tooltip content="Open site"><Button size="md" square aria-label="Open site" /></Tooltip>',
			violation: true
		},
		{
			name: 'Tooltip wrapping a link',
			source: 'export const F = () => <Tooltip content="Pools"><BasicLink href="/pools">Pools</BasicLink></Tooltip>',
			violation: true
		},
		{
			name: 'Tooltip wrapping a menu button',
			source:
				'export const F = () => <Tooltip content="Export"><Ariakit.MenuButton store={menu}>Export</Ariakit.MenuButton></Tooltip>',
			violation: true
		},
		{
			name: 'Tooltip rendering as the control',
			source:
				'export const F = () => <Tooltip content="Open site" render={<Button size="md" square aria-label="Open site" />}><Icon name="globe" /></Tooltip>',
			violation: false
		},
		{
			name: 'Tooltip around text',
			source:
				'export const F = () => <Tooltip content="Total value locked"><span className="underline">TVL</span></Tooltip>',
			violation: false
		},
		{
			name: 'native title on a button',
			source: 'export const F = () => <button type="button" title="Delete">x</button>',
			violation: true
		},
		{
			name: 'icon-only Button without a Tooltip',
			source: 'export const F = () => <Button size="sm" square aria-label="Delete"><Icon name="trash" /></Button>',
			violation: true
		},
		{
			name: 'icon-only Button as a Tooltip render',
			source:
				'export const F = () => <Tooltip content="Delete" render={<Button size="sm" square aria-label="Delete" />}><Icon name="trash" /></Tooltip>',
			violation: false
		},
		{
			name: 'icon-only disclosure chevron',
			source:
				'export const F = () => <Button size="sm" square aria-label="Expand row" aria-expanded={open}><Icon name="chevron-down" /></Button>',
			violation: false
		},
		{
			name: 'field clear',
			source: 'export const F = () => <Button size="sm" square aria-label="Clear search"><Icon name="x" /></Button>',
			violation: false
		},
		{
			name: 'retry as a link',
			source: 'export const F = () => <Button variant="link" onClick={retry}>Try again</Button>',
			violation: true
		},
		{
			name: 'back as a link',
			source: 'export const F = () => <Button variant="link" onClick={back}>Back to history</Button>',
			violation: false
		},
		{
			name: 'Tooltip shrinking its default span',
			source:
				'export const F = () => <Tooltip content="Weight" className="min-w-0"><span className="truncate">Execution</span></Tooltip>',
			violation: true
		},
		{
			name: 'Tooltip truncating its default span',
			source: 'export const F = () => <Tooltip content={v} className={`inline truncate ${tone}`}>{v}</Tooltip>',
			violation: true
		},
		{
			name: 'Tooltip placing its default span',
			source: 'export const F = () => <Tooltip content={v} className="ms-auto w-fit sm:shrink-0">{v}</Tooltip>',
			violation: false
		},
		{
			name: 'Tooltip truncating its render anchor',
			source:
				'export const F = () => <Tooltip content={v} render={<span className="min-w-0 truncate" />}>{v}</Tooltip>',
			violation: false
		},
		{
			name: 'pager button disabled at its last page',
			source:
				'export const F = () => <button type="button" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Next</button>',
			violation: true
		},
		{
			name: 'previous button disabled at page zero',
			source:
				'export const F = () => <Button size="sm" onClick={previous} disabled={pageIndex === 0}>Previous</Button>',
			violation: true
		},
		{
			name: 'pager button that keeps focus at its limit',
			source:
				'export const F = () => <Ariakit.Button onClick={next} disabled={!canNextPage} accessibleWhenDisabled>Next</Ariakit.Button>',
			violation: false
		},
		{
			name: 'pager button that opts out of keeping focus',
			source:
				'export const F = () => <Button size="sm" onClick={next} disabled={!canNextPage} accessibleWhenDisabled={false}>Next</Button>',
			violation: true
		},
		{
			name: 'raw pager button with an inert accessibleWhenDisabled',
			source:
				'export const F = () => <button type="button" onClick={next} disabled={!canNextPage} accessibleWhenDisabled>Next</button>',
			violation: true
		},
		{
			name: 'pager button that keeps focus only for its own press',
			source:
				'export const F = () => <Button size="sm" onClick={next} disabled={!canNextPage} accessibleWhenDisabled={!isLoading}>Next</Button>',
			violation: false
		},
		{
			name: 'move up disabled at the top',
			source: 'export const F = () => <Button size="sm" square onClick={up} disabled={!canMoveUp}>Up</Button>',
			violation: true
		},
		{
			name: 'button disabled for another reason',
			source: 'export const F = () => <Button size="md" disabled={!canSave}>Save</Button>',
			violation: false
		}
	]
	const failures = cases.filter(
		({ name, source, violation }) =>
			scanSource(`src/policy-self-test/${name.replace(/\W+/g, '-')}.tsx`, source).length > 0 !== violation
	)
	if (failures.length > 0) {
		console.error(`Focus handoff policy self-test failed: ${failures.map(({ name }) => name).join(', ')}`)
		process.exit(1)
	}
	console.log(`Focus handoff policy self-test passed (${cases.length} cases).`)
	process.exit(0)
}

const violations = policyTargetFiles(root, sourceRoot).flatMap((file) => {
	const relative = path.relative(root, file).split(path.sep).join('/')
	return scanSource(relative, fs.readFileSync(file, 'utf8'))
})

if (violations.length > 0) {
	console.error(`Focus handoff policy violations:\n${violations.map((violation) => `- ${violation}`).join('\n')}`)
	process.exit(1)
}

console.log('Focus handoff policy passed.')
