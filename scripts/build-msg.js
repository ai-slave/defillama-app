const axios = require('axios')
const fs = require('fs')

// read the build.log file into base64 string
const buildLog = fs.readFileSync('./build.log', 'utf8')
const buildLogBase64 = Buffer.from(buildLog).toString('base64')
const BUILD_LOG_CONTENT_TYPE = 'text/plain;charset=UTF-8'
const LOGGER_API_KEY = process.env.LOGGER_API_KEY
const LOGGER_API_URL = process.env.LOGGER_API_URL

// upload the build.log file to the logger service
const uploadBuildLog = async () => {
	const response = await axios.post(
		LOGGER_API_URL,
		{
			data: buildLogBase64,
			contentType: BUILD_LOG_CONTENT_TYPE
		},
		{
			headers: {
				apikey: LOGGER_API_KEY
			}
		}
	)
	// the logger service returns the id of the uploaded file as a string
	return response.data
}

// convert the bash script above to JS
const LLAMAS_LIST = process.env.LLAMAS_LIST || ''
const BUILD_LLAMAS = process.env.BUILD_LLAMAS || ''
const BUILD_STATUS_DASHBOARD = process.env.BUILD_STATUS_DASHBOARD
const BUILD_STATUS_WEBHOOK = process.env.BUILD_STATUS_WEBHOOK
const EMOJI_TIRESOME = '<:tiresome:1023676964319535286>'
const EMOJI_BINOCULARS = '<:binoculars:1012832136459456582>'
const EMOJI_CRINGE = '<:cringe:885396558588313620>'
const EMOJI_LLAMACHEER = '<:llamacheer:1012832279195832331>'
const EMOJI_BONG = '<:bong:970440561087631360>'
const EMOJI_BEEGLUBB = '<:beeglubb:1027125046281502740>'
const EMOJI_UPLLAMA = '<:upllama:996096214841950269>'
const EMOJI_EVIL = '<:evilllama:1011045461030879353>'
const EMOJI_PEPENOTES = '<a:pepenotes:1061068916140544052>'

const buildLlamas = BUILD_LLAMAS.split(',')
const llamas = LLAMAS_LIST.split(',').map((llama) => {
	const [name, id] = llama.split(':')
	return { name, id }
})

const formatMention = (name) => {
	const id = llamas.find((llama) => llama.name === name).id
	if (!id) {
		return ''
	} else {
		return `<@${id}>`
	}
}

// node ./scripts/build-msg.js $BUILD_STATUS "$BUILD_TIME_STR" "$START_TIME" "$BUILD_ID" "$COMMIT_COMMENT" "$COMMIT_AUTHOR" "$COMMIT_HASH"
const BUILD_STATUS = process.argv[2]
const BUILD_TIME_STR = process.argv[3]
const START_TIME = process.argv[4]
const BUILD_ID = process.argv[5]
const COMMIT_COMMENT = process.argv[6]
const COMMIT_AUTHOR = process.argv[7]
const COMMIT_HASH = process.argv[8]

let buildSummary = ''
if (BUILD_STATUS === '0') {
	buildSummary += `🎉 Build succeeded in ${BUILD_TIME_STR}`
} else {
	buildSummary += `🚨 Build failed in ${BUILD_TIME_STR}`
}
buildSummary += '\n' + `📅 Build started at ${START_TIME}`
if (BUILD_ID) {
	buildSummary += '\n' + `📦 Build ID: ${BUILD_ID}`
}

let commitSummary = ''
commitSummary += `💬 ${COMMIT_COMMENT}`
commitSummary += '\n' + `🦙 ${COMMIT_AUTHOR}`
commitSummary += '\n' + `📸 ${COMMIT_HASH}`

const sendMessages = async () => {
	const message = `\`\`\`\n===== COMMIT SUMMARY =====\n${commitSummary}\n\n===== BUILD SUMMARY =====\n${buildSummary}\n\`\`\``
	const body = { content: message }
	await axios.post(BUILD_STATUS_WEBHOOK, body)

	const buildLogId = await uploadBuildLog()
	const buildLogUrl = `${LOGGER_API_URL}/get/${buildLogId}`
	const buildLogMessage = `${EMOJI_PEPENOTES} ${buildLogUrl}`
	console.log(buildLogMessage)
	const buildLogBody = { content: buildLogMessage }
	await axios.post(BUILD_STATUS_WEBHOOK, buildLogBody)

	const authorMention = formatMention(COMMIT_AUTHOR)
	const buildLlamasMentions = buildLlamas.map((llama) => formatMention(llama)).join(' ')

	if (BUILD_STATUS !== '0') {
		if (LLAMAS_LIST) {
			const llamaMessage = `${EMOJI_CRINGE} ${authorMention}\n${EMOJI_TIRESOME} ${buildLlamasMentions}\n${EMOJI_BINOCULARS} ${BUILD_STATUS_DASHBOARD}`
			const llamaBody = { content: llamaMessage }
			await axios.post(BUILD_STATUS_WEBHOOK, llamaBody)
		}
	} else {
		const emojis = [EMOJI_LLAMACHEER, EMOJI_BONG, EMOJI_BEEGLUBB, EMOJI_UPLLAMA, EMOJI_EVIL]
		const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)]
		const llamaMessage = `${randomEmoji}`
		const llamaBody = { content: llamaMessage }
		await axios.post(BUILD_STATUS_WEBHOOK, llamaBody)
	}
}

sendMessages()
