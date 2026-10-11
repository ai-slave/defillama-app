/**
 * Run babel-plugin-react-compiler over source files with Next's production client options and report,
 * per file, which React functions the compiler optimized and every bailout with its reason.
 *
 * Compiling is not the same as caching: a component can compile while a particular computation is left
 * uncached (the compiler prunes the scope, e.g. when a dependency's mutable range extends past it). Pass
 * `--cached fn1,fn2` to also assert that every call to those functions in the generated code sits inside
 * a memo cache guard (`if ($[n] !== dep)`).
 *
 * Usage:
 *   node scripts/reactCompilerCheck.cjs <repo-root> <file>...
 *   node scripts/reactCompilerCheck.cjs . src/containers/RWA/index.tsx --cached buildRwaTimeSeriesCharts
 *
 * An `eslint-disable` comment for any React rule makes the compiler skip the whole component; an
 * `oxlint-disable-next-line` comment does not. `'use no memo'` clears lowering bailouts only, never refs or
 * incompatible-library diagnostics; put it at function level so the baseline records it.
 *
 * The repo root comes first: passing only a file checks nothing and exits 0. Expect a `compiled` line for
 * every file.
 *
 * Exits non-zero on any bailout or uncached required call.
 *
 * scripts/compilerBaseline.ts parses the `compiled`, `BAILOUT`, `SKIPPED` and `BABEL FAILED` lines this
 * prints. Change their format only together with that parser.
 */
const path = require('node:path')
const fs = require('node:fs')

const argv = process.argv.slice(2)
const cachedIndex = argv.indexOf('--cached')
const requiredCached = cachedIndex === -1 ? [] : (argv[cachedIndex + 1] ?? '').split(',').filter(Boolean)
const positional = cachedIndex === -1 ? argv : [...argv.slice(0, cachedIndex), ...argv.slice(cachedIndex + 2)]
const root = path.resolve(positional[0] ?? '.')
const files = positional.slice(1)

const { reactCompilerBabel, insideCacheGuard } = require('./reactCompilerBabel.cjs')

const { babel, syntaxPlugins, plugins } = reactCompilerBabel(root)

let problems = 0
for (const relativePath of files) {
	const file = path.resolve(root, relativePath)
	const events = []
	let output
	try {
		output = babel.transformSync(fs.readFileSync(file, 'utf8'), {
			filename: file,
			babelrc: false,
			configFile: false,
			compact: false,
			plugins: plugins({ logger: { logEvent: (_filename, event) => events.push(event) } })
		})
	} catch (error) {
		console.log(`${relativePath}: BABEL FAILED ${error.message.split('\n')[0]}`)
		problems++
		continue
	}

	const compiled = events
		.filter((event) => event.kind === 'CompileSuccess')
		.map((event) => event.fnName ?? '(anonymous)')
	console.log(`${relativePath}: compiled ${compiled.length} [${compiled.join(', ')}]`)

	for (const event of events.filter((e) => e.kind === 'CompileError')) {
		problems++
		const detail = event.detail ?? {}
		const options = detail.options ?? detail
		const reason = options.reason ?? options.description ?? JSON.stringify(detail).slice(0, 200)
		// fnLoc points at the enclosing function, which is useless on a 1000-line component. Refs and a few
		// other categories carry the offending expression in `details` instead of `options.loc`, so read
		// that first and only fall back to the function.
		const at =
			options.details?.find((entry) => entry.loc?.start?.line)?.loc?.start?.line ??
			options.loc?.start?.line ??
			event.fnLoc?.start?.line ??
			'?'
		console.log(`  BAILOUT ${relativePath}:${at}: ${reason}`)
	}
	// Printed in the BAILOUT shape so the baseline records deliberate opt-outs too: removing a directive
	// makes the recorded entry stale, which fails the check instead of silently compiling the component.
	for (const event of events.filter((e) => e.kind === 'CompileSkip')) {
		const at = event.fnLoc?.start?.line ?? '?'
		// The compiler's own message interpolates the directive node, so normalise it to something a
		// baseline diff can be read against.
		const reason = /directive/.test(event.reason ?? '') ? 'Skipped by directive' : (event.reason ?? 'Skipped')
		console.log(`  SKIPPED ${relativePath}:${at}: ${reason}`)
	}

	if (requiredCached.length === 0) continue
	const seen = new Map(requiredCached.map((name) => [name, { cached: 0, uncached: 0 }]))
	const countCalls = () => ({
		visitor: {
			CallExpression(nodePath) {
				const callee = nodePath.node.callee
				if (callee.type !== 'Identifier' || !seen.has(callee.name)) return
				seen.get(callee.name)[insideCacheGuard(nodePath) ? 'cached' : 'uncached']++
			}
		}
	})
	babel.transformSync(output.code, {
		filename: `${file}.compiled.tsx`,
		babelrc: false,
		configFile: false,
		plugins: [...syntaxPlugins, countCalls]
	})
	for (const [name, counts] of seen) {
		if (counts.cached === 0 && counts.uncached === 0) continue
		if (counts.uncached > 0) {
			problems++
			console.log(`  UNCACHED ${name}: ${counts.uncached} call(s) outside a memo cache guard`)
		} else {
			console.log(`  cached ${name}: ${counts.cached} call(s) inside a memo cache guard`)
		}
	}
}

process.exit(problems ? 1 : 0)
