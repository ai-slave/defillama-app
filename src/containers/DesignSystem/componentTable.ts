/* design.md's "Which component for which job" table, parsed from the markdown. The design system page reads it in
   getStaticProps to show each family's rows, and the coverage test checks the page's parts against it, so neither
   restates the table. */

/** `names`: every component the Use cell's code spans name (componentsNamedIn). */
export type ComponentRow = { job: string; use: string; files: string; names: Array<string> }

/** Every body row of the table. A `\|` inside a cell is a literal pipe. */
export function parseComponentTable(design: string): Array<ComponentRow> {
	const start = design.indexOf('## Which component for which job')
	const table = design.slice(start, design.indexOf('\n## ', start + 1))
	const rows: Array<ComponentRow> = []
	for (const line of table.split('\n')) {
		if (!line.startsWith('| ')) continue
		const [job, use, files] = line
			.split(/(?<!\\)\|/)
			.slice(1, -1)
			.map((cell) => cell.trim().replaceAll('\\|', '|'))
		const names: Array<string> = []
		for (const [index, span] of use.split('`').entries()) {
			if (index % 2 === 1) names.push(...componentsNamedIn(span))
		}
		rows.push({ job, use, files, names })
	}
	// The header row and the divider.
	return rows.slice(2)
}

/** The components one code span of a Use cell names: the one it starts with and any it renders
    (`Ariakit.Checkbox render={<Button …/>}` names Button; the `Checkbox` after a dot is Ariakit's, not ours). */
export function componentsNamedIn(code: string): Array<string> {
	return Array.from(code.matchAll(/(?:^|<)([A-Z]\w*)/g), (match) => match[1])
}
