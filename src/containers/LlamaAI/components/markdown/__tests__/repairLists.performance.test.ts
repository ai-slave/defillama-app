import type { Root } from 'mdast'
import type { Processor } from 'unified'
import { expect, test, vi } from 'vitest'
import { createSegmentProcessors, createSegmentRenderer } from '../markdownSegments'

// Counts the characters the real Markdown parser reads, under every cache layer above it. Work done,
// not wall time, is what the cache bounds, and it does not vary with the machine.
const cost = vi.hoisted(() => ({ parsedChars: 0 }))
vi.mock('remark-parse', async (importOriginal) => {
	const remarkParse = (await importOriginal<typeof import('remark-parse')>()).default
	return {
		default(this: Processor<Root>) {
			remarkParse.call(this)
			const parse = this.parser!
			this.parser = (source, file) => {
				cost.parsedChars += String(source).length
				return parse(source, file)
			}
		}
	}
})

test.each([
	'Intro:\n2. two\n3. three\n\n',
	'1. one\n - nested\n2. two\n\n',
	'Intro:\n2. two\n3. three\n - nested\n4. four\n\n'
])('early repaired lists retain suffix parsing: %s', (head) => {
	cost.parsedChars = 0
	const renderer = createSegmentRenderer({})
	const processors = createSegmentProcessors([], [])
	const source = head + 'A trailing paragraph with **emphasis** and more text.\n\n'.repeat(40)
	let fullChars = 0
	for (let end = 1; end <= source.length; end += 10) {
		fullChars += end
		renderer.render(source.slice(0, end), processors, true)
	}
	// Bound actual parser work, allowing call counts and machine speed to vary. Sharing one cache
	// between raw and repaired text parsed the whole document twice per render, 4 to 6 times this bound.
	expect(cost.parsedChars).toBeLessThan(fullChars / 2)
})
