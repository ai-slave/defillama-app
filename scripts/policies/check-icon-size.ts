import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { policyTargetFiles } from '../lib/sourceFiles'

/*
 * Icon size policy. Every `<Icon>` sizes with a `size-*` class: 14px (`size-3.5`) beside a label, 16px (`size-4`)
 * icon-only (design.md → Icons, src/ui/Icon.tsx). A `height` or `width` prop on `<Icon>` is refused, so the size sits in
 * the class list beside the icon's colour and a reader sees one scale. A component that lets callers pick the size
 * takes the class (`size?: \`size-${number}\``), as CopyHelper does. src/ui owns the parts and is not checked.
 */

const root = path.resolve(import.meta.dirname, '../..')
const sourceRoot = path.join(root, 'src')

export function scanSource(relative: string, source: string): Array<string> {
	if (relative.startsWith('src/ui/')) return []
	const sourceFile = ts.createSourceFile(relative, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
	const violations: Array<string> = []

	const visit = (node: ts.Node) => {
		const opening = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null
		if (opening && opening.tagName.getText(sourceFile) === 'Icon') {
			for (const property of opening.attributes.properties) {
				if (!ts.isJsxAttribute(property)) continue
				const name = property.name.getText(sourceFile)
				if (name !== 'height' && name !== 'width') continue
				const line = sourceFile.getLineAndCharacterOfPosition(property.getStart(sourceFile)).line + 1
				violations.push(
					`${relative}:${line} sizes an Icon with \`${name}\`; use a size-* class (size-3.5 beside a label, size-4 icon-only)`
				)
			}
		}
		ts.forEachChild(node, visit)
	}
	visit(sourceFile)
	return violations
}

if (process.argv.includes('--self-test')) {
	const cases: Array<{ name: string; relative?: string; source: string; violations: number }> = [
		{
			name: 'height and width',
			source: 'export const A = () => <Icon name="x" height={16} width={16} />',
			violations: 2
		},
		{
			name: 'height only',
			source: 'export const A = () => <Icon name="x" height={14} className="text-link" />',
			violations: 1
		},
		{
			name: 'size from a variable',
			source: 'export const A = ({ size }) => <Icon name="x" width={size} height={size} />',
			violations: 2
		},
		{
			name: 'element with children',
			source: 'export const A = () => <Icon name="x" width="16" height="16"><title>X</title></Icon>',
			violations: 2
		},
		{
			name: 'size class',
			source: 'export const A = () => <Icon name="x" className="size-4 text-secondary" />',
			violations: 0
		},
		{
			name: 'size class prop',
			source: 'export const A = ({ size }) => <Icon name="x" className={size} />',
			violations: 0
		},
		{ name: 'another element', source: 'export const A = () => <svg height={16} width={16} />', violations: 0 },
		{
			name: 'inside src/ui',
			relative: 'src/ui/PolicySelfTest.tsx',
			source: 'export const A = () => <Icon name="x" height={16} width={16} />',
			violations: 0
		}
	]
	const failures = cases.filter(
		({ name, relative, source, violations }) =>
			scanSource(relative ?? `src/policy-self-test/${name.replace(/\W+/g, '-')}.tsx`, source).length !== violations
	)
	if (failures.length > 0) {
		console.error(`Icon size policy self-test failed: ${failures.map(({ name }) => name).join(', ')}`)
		process.exit(1)
	}
	console.log(`Icon size policy self-test passed (${cases.length} cases).`)
	process.exit(0)
}

const violations = policyTargetFiles(root, sourceRoot).flatMap((file) => {
	const relative = path.relative(root, file).split(path.sep).join('/')
	return scanSource(relative, fs.readFileSync(file, 'utf8'))
})

if (violations.length > 0) {
	console.error(`Icon size policy violations:\n${violations.map((violation) => `- ${violation}`).join('\n')}`)
	process.exit(1)
}

console.log('Icon size policy passed.')
