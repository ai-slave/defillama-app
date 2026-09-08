/**
 * The babel setup Next applies for `reactCompiler: true`, in one place.
 *
 * Both the baseline checker and the compiled-output test config build on this, so neither keeps its
 * own copy of the compiler options: a drift between them would make a check pass against settings
 * the app never runs.
 */
const path = require('node:path')

function reactCompilerBabel(root = path.resolve('.')) {
	const resolveFrom = (id) => require.resolve(id, { paths: [root] })
	return {
		babel: require(resolveFrom('next/dist/compiled/babel/core')),
		/** @param {Record<string, unknown>} [compilerOptions] extra plugin options, e.g. a logger */
		plugins: (compilerOptions = {}) => [
			[resolveFrom('next/dist/compiled/babel/plugin-syntax-typescript'), { isTSX: true }],
			resolveFrom('next/dist/compiled/babel/plugin-syntax-jsx'),
			[
				resolveFrom('babel-plugin-react-compiler'),
				{ environment: { enableNameAnonymousFunctions: false }, ...compilerOptions }
			]
		]
	}
}

module.exports = { reactCompilerBabel }
