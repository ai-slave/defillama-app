import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { policyTargetFiles } from '../lib/sourceFiles'

/*
 * Image size policy. An `<img>` reserves its box before the file loads, so nothing moves when it arrives. The box is
 * reserved when the markup fixes both sides, or one side and the aspect ratio:
 *
 * - a side is fixed by a `w-*`/`h-*`/`size-*` class other than `auto`, a `style` width or height, or the `width` or
 *   `height` attribute;
 * - the ratio is fixed by an `aspect-*` class, a `style` aspectRatio, or the `width` and `height` attributes together.
 *
 * `w-auto` cancels the `width` attribute. The browser still sizes such a logo from the attribute ratio, but Chrome's
 * layout-shift root causes and Lighthouse's unsized-images audit call it unsized and blame it for shifts nearby. A
 * logo with a fixed height takes the matching width as a class or attribute instead (389×133 at `h-5` is 58 px).
 *
 * A `className` or `style` the file cannot read (a prop, a variable, a spread) is the caller's to size and is skipped.
 * The files listed below are exempt, each with its reason.
 */

const root = path.resolve(import.meta.dirname, '../..')
const sourceRoot = path.join(root, 'src')

/** Files whose unsized images move nothing a reader sees or have no dimensions to give, with the reason. */
const allowedFiles = new Map<string, string>([
	[
		'src/containers/Articles/landing/ResearchTrustedByCarousel.tsx',
		'each logo is centred in a fixed-size link tile, so its natural size moves nothing outside the tile'
	],
	[
		'src/containers/Subscription/sections/SubscriptionTrustedBlock.tsx',
		'each logo is centred in a fixed-height frame, so its natural size moves nothing outside the frame'
	],
	[
		'src/containers/MarketMakers/DocsFigures.tsx',
		'each screenshot sits in a frame with a fixed aspect ratio that clips it'
	],
	[
		'src/containers/LlamaAI/components/messages/MessageBubble.tsx',
		'the frame around a generated image takes its aspect ratio and shows a skeleton until it loads'
	],
	['src/containers/LlamaAI/components/ImagePreviewModal.tsx', 'the lightbox shows the image at its natural size'],
	[
		'src/containers/LlamaAI/components/AlertsModal.tsx',
		'alert run charts carry no dimensions and render inside a modal the reader opened'
	],
	[
		'src/containers/Articles/renderer/ArticleImageBanner.tsx',
		'banner records carry no dimensions, and the banner mounts after a client query'
	],
	[
		'src/containers/Articles/renderer/ArticleImageBannerHorizontal.tsx',
		'banner records carry no dimensions, and the banner mounts after a client query'
	],
	[
		'src/containers/Articles/renderer/ArticlePromoBanner.tsx',
		'banner records carry no dimensions, and the banner mounts after a client query'
	],
	[
		'src/containers/Articles/landing/ResearchPromoBanner.tsx',
		'banner records carry no dimensions, and the banner mounts after a client query'
	],
	['src/containers/Articles/admin/BannerForm.tsx', 'an admin preview of an uploaded image at its natural size'],
	['src/containers/Articles/admin/EditorialTagsView.tsx', 'an admin preview of an uploaded image at its natural size'],
	['src/containers/Articles/admin/TrustedByAdminView.tsx', 'an admin preview of an uploaded image at its natural size']
])

const SIDE_CLASS = /(?:^|:)(w|h|size)-(\S+)$/
const ASPECT_CLASS = /(?:^|:)aspect-\S+$/

/** The class names a className expression can produce, or null when part of it is a value this file cannot read. */
function classTokens(expression: ts.Expression): Array<string> | null {
	const tokens: Array<string> = []
	let known = true
	const visit = (node: ts.Node) => {
		if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) tokens.push(...node.text.split(/\s+/))
		else if (ts.isTemplateExpression(node)) {
			tokens.push(...node.head.text.split(/\s+/))
			for (const span of node.templateSpans) {
				visit(span.expression)
				tokens.push(...span.literal.text.split(/\s+/))
			}
		} else if (ts.isConditionalExpression(node)) {
			visit(node.whenTrue)
			visit(node.whenFalse)
		} else if (ts.isParenthesizedExpression(node)) visit(node.expression)
		else known = false
	}
	visit(expression)
	return known ? tokens : null
}

export function scanSource(relative: string, source: string): Array<string> {
	if (allowedFiles.has(relative) || relative.includes('/__tests__/')) return []
	const sourceFile = ts.createSourceFile(relative, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
	const violations: Array<string> = []

	const visit = (node: ts.Node) => {
		const opening = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null
		if (opening && opening.tagName.getText() === 'img') {
			const message = checkImage(opening)
			if (message) {
				const line = sourceFile.getLineAndCharacterOfPosition(opening.getStart()).line + 1
				violations.push(`${relative}:${line} ${message}`)
			}
		}
		ts.forEachChild(node, visit)
	}
	visit(sourceFile)
	return violations
}

function checkImage(opening: ts.JsxOpeningLikeElement): string | null {
	let attrWidth = false
	let attrHeight = false
	let classes: Array<string> = []
	let styleKeys: Array<string> = []
	for (const property of opening.attributes.properties) {
		if (ts.isJsxSpreadAttribute(property)) return null
		const name = property.name.getText()
		const initializer = property.initializer
		if (name === 'width') attrWidth = true
		if (name === 'height') attrHeight = true
		if (name === 'className' && initializer) {
			const expression = ts.isStringLiteral(initializer)
				? initializer
				: ts.isJsxExpression(initializer)
					? initializer.expression
					: undefined
			if (!expression) return null
			const read = classTokens(expression)
			if (!read) return null
			classes = read
		}
		if (name === 'style' && initializer && ts.isJsxExpression(initializer)) {
			const expression = initializer.expression
			if (!expression || !ts.isObjectLiteralExpression(expression)) return null
			styleKeys = expression.properties.flatMap((entry) => (entry.name ? [entry.name.getText()] : []))
		}
	}

	let classWidth = false
	let classHeight = false
	let widthAuto = false
	let aspect = false
	for (const token of classes) {
		if (ASPECT_CLASS.test(token)) aspect = true
		const match = SIDE_CLASS.exec(token)
		if (!match) continue
		const [, side, value] = match
		if (value === 'auto') {
			if (side === 'w') widthAuto = true
			continue
		}
		if (side !== 'h') classWidth = true
		if (side !== 'w') classHeight = true
	}

	const width = classWidth || styleKeys.includes('width') || (attrWidth && !widthAuto)
	const height = classHeight || styleKeys.includes('height') || attrHeight
	const ratio = aspect || styleKeys.includes('aspectRatio') || (attrWidth && attrHeight && !widthAuto)
	if ((width && height) || (ratio && (width || height))) return null
	if (widthAuto) {
		return 'sizes its width with w-auto, which reads as unsized; set the width that matches its height as a class or attribute'
	}
	return 'leaves its box to the image file; fix both sides, or one side and the aspect ratio, before it loads'
}

if (process.argv.includes('--self-test')) {
	const cases: Array<{ name: string; source: string; violation: boolean }> = [
		{ name: 'no size', source: 'export const L = () => <img src="/a.webp" alt="" />', violation: true },
		{
			name: 'height only',
			source: 'export const L = () => <img src="/a.webp" alt="" className="h-7" />',
			violation: true
		},
		{
			name: 'w-auto over attributes',
			source: 'export const L = () => <img src="/a.webp" alt="" width={58} height={20} className="h-5 w-auto" />',
			violation: true
		},
		{
			name: 'max sizes only',
			source: 'export const L = () => <img src={src} alt="" className="max-h-[28px] max-w-[150px] object-contain" />',
			violation: true
		},
		{
			name: 'attributes and a fixed height',
			source: 'export const L = () => <img src="/a.webp" alt="" width={58} height={20} className="h-5" />',
			violation: false
		},
		{
			name: 'responsive width and height classes',
			source: 'export const L = () => <img src="/a.webp" alt="" className="h-14 w-[164px] md:h-10 md:w-[117px]" />',
			violation: false
		},
		{
			name: 'size class',
			source: 'export const L = () => <img src={src} alt="" className="size-6 rounded-full" />',
			violation: false
		},
		{
			name: 'full width with attributes',
			source:
				'export const L = () => <img src={src} alt="" width={1200} height={630} className="block h-auto w-full" />',
			violation: false
		},
		{
			name: 'style aspect ratio',
			source: 'export const L = () => <img src={src} alt="" className="h-5 w-auto" style={{ aspectRatio: ratio }} />',
			violation: false
		},
		{
			name: 'conditional classes',
			source: 'export const L = () => <img src={src} alt="" className={grid ? "h-28 w-full" : "size-12"} />',
			violation: false
		},
		{
			name: 'caller-sized class',
			source: 'export const L = ({ className }) => <img src={src} alt="" className={`${className} rounded-full`} />',
			violation: false
		},
		{ name: 'spread props', source: 'export const L = (props) => <img alt="" {...props} />', violation: false }
	]
	const failures = cases.filter(
		({ name, source, violation }) =>
			scanSource(`src/policy-self-test/${name.replace(/\W+/g, '-')}.tsx`, source).length > 0 !== violation
	)
	if (failures.length > 0) {
		console.error(`Image size policy self-test failed: ${failures.map(({ name }) => name).join(', ')}`)
		process.exit(1)
	}
	console.log(`Image size policy self-test passed (${cases.length} cases).`)
	process.exit(0)
}

const violations = policyTargetFiles(root, sourceRoot).flatMap((file) => {
	const relative = path.relative(root, file).split(path.sep).join('/')
	return scanSource(relative, fs.readFileSync(file, 'utf8'))
})

if (violations.length > 0) {
	console.error(`Image size policy violations:\n${violations.map((violation) => `- ${violation}`).join('\n')}`)
	process.exit(1)
}

console.log('Image size policy passed.')
