import Head from 'next/head'

export const LLAMA_AI_ANIMATION_SRC = '/assets/llamaai/llamaai_animation.webp'
export const LLAMA_AI_HACKER_ANIMATION_SRC = '/assets/llamaai/hackerllama.webp'

export function LlamaAIAnimationPreloads() {
	return (
		<Head>
			<link rel="preload" as="image" type="image/webp" href={LLAMA_AI_ANIMATION_SRC} />
			<link rel="preload" as="image" type="image/webp" href={LLAMA_AI_HACKER_ANIMATION_SRC} />
		</Head>
	)
}
