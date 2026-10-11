/**
 * The babel setup Next applies for `reactCompiler: true`, in one place.
 *
 * The baseline checker, the table data identity policy and the compiled-output test config build on
 * this, so none keeps its own copy of the compiler options: a drift between them would make a check
 * pass against settings the app never runs.
 */
const path = require('node:path')

function reactCompilerBabel(root = path.resolve('.')) {
	const resolveFrom = (id) => require.resolve(id, { paths: [root] })
	const syntaxPlugins = [
		[resolveFrom('next/dist/compiled/babel/plugin-syntax-typescript'), { isTSX: true }],
		resolveFrom('next/dist/compiled/babel/plugin-syntax-jsx')
	]
	return {
		babel: require(resolveFrom('next/dist/compiled/babel/core')),
		/** Parses TSX without transforming it, for reading the compiled output back */
		syntaxPlugins,
		/** @param {Record<string, unknown>} [compilerOptions] extra plugin options, e.g. a logger */
		plugins: (compilerOptions = {}) => [
			...syntaxPlugins,
			[
				resolveFrom('babel-plugin-react-compiler'),
				{ environment: { enableNameAnonymousFunctions: false }, ...compilerOptions }
			]
		]
	}
}

/** True when the node is inside `if ($[n] !== dep)`, the guard the compiler emits around a memo scope. */
function insideCacheGuard(nodePath) {
	for (let current = nodePath; current; current = current.parentPath) {
		if (!current.isIfStatement()) continue
		let guarded = false
		current.get('test').traverse({
			MemberExpression(member) {
				if (member.node.object.type === 'Identifier' && member.node.object.name === '$') guarded = true
			}
		})
		if (guarded) return true
	}
	return false
}

module.exports = { reactCompilerBabel, insideCacheGuard }
