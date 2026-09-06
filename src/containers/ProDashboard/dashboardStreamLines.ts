export function createDashboardStreamLineParser(onLine: (line: string) => void) {
	let fragments: Array<string> = []

	return {
		push(chunk: string): void {
			let lineStart = 0
			let newlineIndex = chunk.indexOf('\n')
			while (newlineIndex !== -1) {
				const fragment = chunk.slice(lineStart, newlineIndex)
				if (fragments.length > 0) {
					fragments.push(fragment)
					onLine(fragments.join(''))
					fragments = []
				} else {
					onLine(fragment)
				}
				lineStart = newlineIndex + 1
				newlineIndex = chunk.indexOf('\n', lineStart)
			}

			if (lineStart < chunk.length) fragments.push(chunk.slice(lineStart))
		},
		finish(): void {
			if (fragments.length === 0) return
			onLine(fragments.join(''))
			fragments = []
		}
	}
}
