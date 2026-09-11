import type { List, Root } from 'mdast'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { expect, test } from 'vitest'
import { detachOrderedLists, nestIndentedLists } from './repairLists'

const parser = unified().use(remarkParse).use(remarkGfm, { singleTilde: false })
const parse = (source: string) => parser.parse(source) as Root
const detach = (source: string) => detachOrderedLists(source, parse(source))

test.each([
	// CommonMark lets only a `1.` item interrupt a paragraph; a header followed by `4.` is one paragraph.
	['**Product**\n4. a\n5. b', '**Product**\n\n4. a\n5. b'],
	['Text\n10. a', 'Text\n\n10. a'],
	['Text\n4) a', 'Text\n\n4) a'],
	// Only the first break needs a blank line; splitting every item would make the list loose.
	['**H**\n4. a\n5. b\n6. c', '**H**\n\n4. a\n5. b\n6. c'],
	// A `1.` item already interrupts the paragraph.
	['**Contagion**\n1. a\n2. b', null],
	// Already separated.
	['**H**\n\n4. a', null],
	// Items inside a list continue it; nothing to detach.
	['1. a\n4. b', null],
	// Not a paragraph: code is never rewritten.
	['```\nfoo\n4. bar\n```', null],
	// A number without a marker space is prose.
	['Text\n4.5 million', null]
])('detachOrderedLists(%j)', (source, expected) => {
	expect(detach(source)).toBe(expected)
})

test('the detached source parses as a header paragraph followed by a list starting at 4', () => {
	const fixed = detach('**Product**\n4. a\n5. b')!
	const tree = parse(fixed)
	expect(tree.children.map((c) => c.type)).toEqual(['paragraph', 'list'])
	expect((tree.children[1] as List).start).toBe(4)
	expect((tree.children[1] as List).spread).toBe(false)
})

const nest = (source: string) => nestIndentedLists(source, parse(source))

test.each([
	// A sub-list nests only at the item's content column (3 after `2. `); shallower indents split the list.
	['1. a\n2. b\n - x\n - y\n3. c', '1. a\n2. b\n   - x\n   - y\n3. c'],
	['1. a\n2. b\n  - x\n3. c', '1. a\n2. b\n   - x\n3. c'],
	['9. a\n10. b\n  - x\n11. c', '9. a\n10. b\n    - x\n11. c'],
	// Every line of the sub-list moves, including its own nested content.
	['1. a\n - x\n   more\n2. b', '1. a\n   - x\n     more\n2. b'],
	// Already nested.
	['1. a\n   - x\n2. b', null],
	// Flush-left bullets after a numbered list are a separate list on purpose.
	['1. a\n\n- x\n- y', null],
	['1. a\n- x', null],
	// Not lists: code is never rewritten.
	['```\n1. a\n - x\n```', null]
])('nestIndentedLists(%j)', (source, expected) => {
	expect(nest(source)).toBe(expected)
})

test('the nested source parses as one numbered list with the bullets inside item 2', () => {
	const tree = parse(nest('1. a\n2. b\n - x\n - y\n3. c')!)
	expect(tree.children.map((c) => c.type)).toEqual(['list'])
	const list = tree.children[0] as List
	expect(list.children).toHaveLength(3)
	expect(list.children[1].children.map((c) => c.type)).toEqual(['paragraph', 'list'])
})
