import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { policyTargetFiles } from '../lib/sourceFiles'

/*
 * Form validation policy. A form validates when the reader submits it: the submit stays enabled, each error shows
 * under its field through Field (src/ui/Field.tsx), and focus moves to the first invalid field
 * (docs/focus-and-errors.md → "Validating a form"). The browser's own validation is refused in its three mechanical
 * shapes, because its bubble is unstyled, differs per browser and vanishes on the next click:
 *
 * 1. A `<form>` without `noValidate`: a `required`, `type="email"` or `min` inside it shows the browser bubble on
 *    submit instead of the form's own errors. Every form opts out, so a field added later cannot bring it back.
 * 2. `setCustomValidity`, `reportValidity` or `checkValidity`: they drive the same bubble from code. Derive the error
 *    from the values and pass it to Field.
 * 3. A `user-invalid` class (`user-invalid:`, `peer-user-invalid:`, `has-[…:user-invalid]`): it marks a field on blur,
 *    before the reader asked to submit. Field shows the error after the submit.
 *
 * A submit disabled until its fields are valid is the same mistake, but no syntax tells it from a legitimate gate
 * (a pending request, a security check, a cooldown); review catches it.
 */

const root = path.resolve(import.meta.dirname, '../..')
const sourceRoot = path.join(root, 'src')

const VALIDITY_CALLS = new Set(['setCustomValidity', 'reportValidity', 'checkValidity'])

export function scanSource(relative: string, source: string): Array<string> {
	if (relative.includes('/__tests__/') || relative.startsWith('src/dev/')) return []
	const sourceFile = ts.createSourceFile(relative, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
	const violations: Array<string> = []
	const at = (node: ts.Node) => `${relative}:${sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1}`

	const visit = (node: ts.Node) => {
		const opening = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null
		if (opening && opening.tagName.getText() === 'form') {
			const noValidate = opening.attributes.properties.some(
				(property) => ts.isJsxAttribute(property) && property.name.getText() === 'noValidate'
			)
			if (!noValidate) {
				violations.push(
					`${at(opening)} renders a form without noValidate; the browser's bubble would replace the form's own errors`
				)
			}
		}
		if (
			ts.isCallExpression(node) &&
			ts.isPropertyAccessExpression(node.expression) &&
			VALIDITY_CALLS.has(node.expression.name.text)
		) {
			violations.push(
				`${at(node)} calls ${node.expression.name.text}; derive the error from the values and pass it to Field`
			)
		}
		if (
			(ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node)) &&
			node.text.includes('user-invalid')
		) {
			violations.push(`${at(node)} styles user-invalid; Field shows the error after the reader submits`)
		}
		ts.forEachChild(node, visit)
	}
	visit(sourceFile)
	return violations
}

if (process.argv.includes('--self-test')) {
	const cases: Array<{ name: string; source: string; violation: boolean }> = [
		{
			name: 'form without noValidate',
			source: 'export const F = () => <form onSubmit={submit}><Input required /></form>',
			violation: true
		},
		{
			name: 'form with noValidate',
			source: 'export const F = () => <form noValidate onSubmit={submit}><Input required /></form>',
			violation: false
		},
		{
			name: 'custom validity bubble',
			source:
				'export function f(input: HTMLInputElement) { input.setCustomValidity("Too short"); input.reportValidity() }',
			violation: true
		},
		{
			name: 'user-invalid error text',
			source: 'export const F = () => <span className="hidden text-error peer-user-invalid:block">Enter a code.</span>',
			violation: true
		},
		{
			name: 'Field error',
			source:
				'export const F = () => <Field label="Email" error={errors.email}>{(control) => <Input {...control} />}</Field>',
			violation: false
		}
	]
	const failures = cases.filter(
		({ name, source, violation }) =>
			scanSource(`src/policy-self-test/${name.replace(/\W+/g, '-')}.tsx`, source).length > 0 !== violation
	)
	if (failures.length > 0) {
		console.error(`Form validation policy self-test failed: ${failures.map(({ name }) => name).join(', ')}`)
		process.exit(1)
	}
	console.log(`Form validation policy self-test passed (${cases.length} cases).`)
	process.exit(0)
}

const violations = policyTargetFiles(root, sourceRoot).flatMap((file) => {
	const relative = path.relative(root, file).split(path.sep).join('/')
	return scanSource(relative, fs.readFileSync(file, 'utf8'))
})

if (violations.length > 0) {
	console.error(`Form validation policy violations:\n${violations.map((violation) => `- ${violation}`).join('\n')}`)
	process.exit(1)
}

console.log('Form validation policy passed.')
