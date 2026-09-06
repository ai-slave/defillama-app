import fs from 'node:fs'
import path from 'node:path'

/**
 * Every file under `directory`, recursively, whose name ends with one of `extensions`.
 * Skips nothing on purpose: each policy states its own exclusions next to its rule.
 */
export function collectSourceFiles(directory: string, extensions: ReadonlyArray<string>): Array<string> {
	const files: Array<string> = []
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const fullPath = path.join(directory, entry.name)
		if (entry.isDirectory()) files.push(...collectSourceFiles(fullPath, extensions))
		else if (extensions.some((extension) => entry.name.endsWith(extension))) files.push(fullPath)
	}
	return files
}

/**
 * Files a policy script should check: the paths given on the command line (the
 * pre-commit hook passes staged files), or every TypeScript file under `sourceRoot`.
 */
export function policyTargetFiles(root: string, sourceRoot: string): Array<string> {
	const requested = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
	if (requested.length === 0) return collectSourceFiles(sourceRoot, ['.ts', '.tsx'])
	return requested.map((file) => path.resolve(root, file))
}
