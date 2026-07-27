import { describe, expect, it } from 'vitest'
import type { SocialMention } from '~/containers/Articles/types'
import { chunkMentions } from '../utils'

const mention = (id: string): SocialMention => ({
	id,
	quote: `q-${id}`,
	username: `u-${id}`,
	socialMediaName: 'X',
	socialMediaLink: 'https://x.com/x',
	xPostId: '1',
	sortOrder: 0,
	enabled: true,
	createdAt: '',
	updatedAt: ''
})

describe('chunkMentions', () => {
	it('splits six mentions into two blocks of three', () => {
		const blocks = chunkMentions([1, 2, 3, 4, 5, 6].map((n) => mention(String(n))))
		expect(blocks).toHaveLength(2)
		expect(blocks[0].map((m) => m.id)).toEqual(['1', '2', '3'])
		expect(blocks[1].map((m) => m.id)).toEqual(['4', '5', '6'])
	})

	it('keeps a trailing partial block', () => {
		const blocks = chunkMentions([1, 2, 3, 4].map((n) => mention(String(n))))
		expect(blocks).toHaveLength(2)
		expect(blocks[1]).toHaveLength(1)
	})

	it('returns empty array for empty input', () => {
		expect(chunkMentions([])).toEqual([])
	})
})
