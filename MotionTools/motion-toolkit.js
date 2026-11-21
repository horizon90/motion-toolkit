const sceneUrl = './WEBTOOL.cv'

async function initialise() {
	const previewStage = document.querySelector('.preview-stage')
	const playerMount = document.getElementById('player')
	const controlsContainer = document.getElementById('control-center-controls')
	const sceneStatus = document.getElementById('scene-status')
	const playButton = document.querySelector('.playback__play')
	const replayButton = document.querySelector('.playback__replay')
	const timeline = document.querySelector('.playback__timeline')
	const progress = document.querySelector('.playback__progress')
	const playhead = document.querySelector('.playback__head')
	const currentTime = document.querySelector('.playback__time')
	const durationTime = document.querySelector('.playback__duration')
	const exportButton = document.getElementById('export-animation')
	const exportNote = document.getElementById('export-note')

	if (
		!previewStage ||
		!playerMount ||
		!controlsContainer ||
		!sceneStatus ||
		!playButton ||
		!replayButton ||
		!timeline ||
		!progress ||
		!playhead ||
		!currentTime ||
		!durationTime ||
		!exportButton ||
		!exportNote
	) {
		throw new Error('The motion toolkit page is missing required UI elements.')
	}

	let player
	let uiFrameId = null
	let isSeeking = false

	const syncPlaybackUi = () => {
		if (!player?.player) return

		const scene = player.player
		const startFrame = scene.getStartFrame()
		const endFrame = scene.getEndFrame()
		const frame = scene.getFrame()
		const fps = scene.getFPS()
		const frameCount = Math.max(1, endFrame - startFrame)
		const elapsed = fps > 0 ? Math.max(0, (frame - startFrame) / fps) : 0
		const duration = fps > 0 ? frameCount / fps : 0
		const percent = Math.max(0, Math.min(100, ((frame - startFrame) / frameCount) * 100))

		currentTime.textContent = formatTime(elapsed)
		durationTime.textContent = formatTime(duration)
		progress.style.width = `${percent}%`
		playhead.style.left = `${percent}%`
		timeline.setAttribute('aria-valuemin', String(startFrame))
		timeline.setAttribute('aria-valuemax', String(endFrame))
		timeline.setAttribute('aria-valuenow', String(frame))

		const playing = scene.isPlaying()
		playButton.setAttribute('aria-label', playing ? 'Pause animation' : 'Play animation')
		playButton.setAttribute('aria-pressed', String(playing))
		playButton.querySelector('span').textContent = playing ? 'Ⅱ' : '▶'

		if (playing && !isSeeking) {
			uiFrameId = requestAnimationFrame(syncPlaybackUi)
		} else {
			uiFrameId = null
		}
	}

	try {
		const { CavalryPlayer } = await import('../CavalryPlayer.js')
		player = new CavalryPlayer(playerMount, {
			sceneInput: false,
			controlsContainer,
		})

		const response = await fetch(sceneUrl)
		if (!response.ok) {
			throw new Error(`Failed to load scene (${response.status} ${response.statusText}).`)
		}

		const contents = new Uint8Array(await response.arrayBuffer())
		const sceneDefinition = JSON.parse(new TextDecoder().decode(contents))
		await player.loadScene(contents, 'WEBTOOL.cv')

		if (!player.player) {
			throw new Error('The Cavalry scene could not be initialized.')
		}

		renderControlCentreInputs(sceneDefinition, player, controlsContainer)
		sceneStatus.textContent = 'Cavalry scene loaded.'
		const resolution = player.player.getSceneResolution()
		exportNote.textContent = `MP4 · ${resolution.width} × ${resolution.height}`
		syncPlaybackUi()

		playButton.addEventListener('click', () => {
			player.togglePlayback()
			if (uiFrameId === null) syncPlaybackUi()
		})

		replayButton.addEventListener('click', () => {
			const scene = player.player
			const wasPlaying = scene.isPlaying()
			player.stop()
			scene.setFrame(scene.getStartFrame())
			player.render()
			if (wasPlaying) player.play()
			syncPlaybackUi()
		})

		timeline.addEventListener('click', (event) => {
			const bounds = timeline.getBoundingClientRect()
			const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width))
			seekToRatio(ratio)
		})

		timeline.addEventListener('keydown', (event) => {
			const scene = player.player
			const startFrame = scene.getStartFrame()
			const endFrame = scene.getEndFrame()
			const frame = scene.getFrame()
			let nextFrame

			if (event.key === 'ArrowLeft') nextFrame = frame - 1
			else if (event.key === 'ArrowRight') nextFrame = frame + 1
			else if (event.key === 'Home') nextFrame = startFrame
			else if (event.key === 'End') nextFrame = endFrame
			else return

			event.preventDefault()
			seekToFrame(Math.max(startFrame, Math.min(endFrame, nextFrame)))
		})

		exportButton.addEventListener('click', () => {
			const downloadButton = playerMount.querySelector('#downloadMp4Button')
			if (!downloadButton || downloadButton.disabled) {
				exportNote.textContent = 'The animation is not ready to export.'
				return
			}
			downloadButton.click()
		})

		const downloadStatus = playerMount.querySelector('#downloadStatus')
		if (downloadStatus) {
			new MutationObserver(() => {
				exportNote.textContent = downloadStatus.textContent || 'MP4 · 1080 × 1080'
			}).observe(downloadStatus, { childList: true, characterData: true, subtree: true })
		}

		function seekToRatio(ratio) {
			const scene = player.player
			const startFrame = scene.getStartFrame()
			const endFrame = scene.getEndFrame()
			seekToFrame(Math.round(startFrame + ratio * (endFrame - startFrame)))
		}

		function seekToFrame(frame) {
			const scene = player.player
			const wasPlaying = scene.isPlaying()
			isSeeking = true
			if (wasPlaying) player.stop()
			scene.setFrame(frame)
			player.render()
			if (wasPlaying) player.play()
			isSeeking = false
			if (uiFrameId !== null) cancelAnimationFrame(uiFrameId)
			uiFrameId = null
			syncPlaybackUi()
		}
	} catch (error) {
		console.error(error)
		const message = error instanceof Error ? error.message : 'Unable to load the animation.'
		sceneStatus.textContent = `Unable to load the Cavalry scene: ${message}`
		exportNote.textContent = message
		showPlayerError(playerMount, error)
	}
}

function renderControlCentreInputs(scene, player, container) {
	const items = scene.controlCenter?.items?.filter(
		(item) => item.kind === 'attr' && typeof item.path === 'string',
	)
	container.replaceChildren()

	if (!items?.length) {
		const message = document.createElement('p')
		message.className = 'export-note'
		message.textContent = 'Control Centre is empty.'
		container.appendChild(message)
		return
	}

	for (const [index, item] of items.entries()) {
		const [layerId, ...attributeParts] = item.path.split('.')
		const attributeId = attributeParts.join('.')
		const node = scene.nodes.find((entry) => entry.nodeId === layerId)
		const serializedValue = getSceneAttributeValue(node, attributeParts)
		const value =
			player.player.getAttribute(layerId, attributeId) ?? serializedValue ?? ''
		const definition = player.player.getAttributeDefinition(layerId, attributeId)
		const controlPath = item.path
		const labels = {
			'stringArray#1.array.1': 'Title',
			'stringArray#1.array.0': 'Announcement',
			'transitionString#1.transitionFromEnd': 'Transition from the end',
			'colorArray#7.arrayIndex': 'Text Color',
		}
		const labelText =
			labels[controlPath] ||
			player.player.getAttributeName(layerId, attributeId) ||
			`${node?.attributes?.niceName?.value || layerId} ${attributeId}`

		if (controlPath === 'colorArray#7.arrayIndex') {
			container.appendChild(
				createColorControl(labelText, Number(value), (selectedIndex) => {
					setSceneAttribute(layerId, attributeId, selectedIndex)
				}),
			)
			continue
		}

		if (definition.type === 'bool') {
			container.appendChild(
				createToggleControl(labelText, Boolean(value), (checked) => {
					setSceneAttribute(layerId, attributeId, checked)
				}),
			)
			continue
		}

		const group = document.createElement('div')
		group.className = 'field'
		const label = document.createElement('label')
		label.htmlFor = `control-center-input-${index}`
		label.textContent = labelText
		group.appendChild(label)

		const input = String(value).includes('\n')
			? document.createElement('textarea')
			: document.createElement('input')
		if (input instanceof HTMLInputElement) input.type = 'text'
		else input.rows = 2
		input.id = label.htmlFor
		input.value = String(value)
		input.addEventListener('input', () => {
			setSceneAttribute(layerId, attributeId, input.value)
		})
		group.appendChild(input)
		container.appendChild(group)
	}

	function setSceneAttribute(layerId, attributeId, newValue) {
		player.player.setAttribute(layerId, attributeId, newValue)
		if (!player.player.isPlaying()) player.render()
	}
}

function createToggleControl(labelText, checked, onChange) {
	const group = document.createElement('div')
	group.className = 'field toggle-field'
	const labelId = 'transition-from-end-label'
	const text = document.createElement('span')
	text.id = labelId
	text.textContent = labelText

	const label = document.createElement('label')
	label.className = 'toggle-switch'
	const input = document.createElement('input')
	input.type = 'checkbox'
	input.checked = checked
	input.setAttribute('aria-labelledby', labelId)
	input.addEventListener('change', () => onChange(input.checked))
	const track = document.createElement('span')
	track.className = 'toggle-switch__track'
	track.setAttribute('aria-hidden', 'true')

	label.append(input, track)
	group.append(text, label)
	return group
}

function createColorControl(labelText, selectedIndex, onChange) {
	const group = document.createElement('fieldset')
	group.className = 'field color-field'
	const legend = document.createElement('legend')
	legend.textContent = labelText
	group.appendChild(legend)

	const presets = document.createElement('div')
	presets.className = 'color-presets'
	const options = [
		{ index: 0, name: 'Red', hex: '#ff0013', className: 'color-preset--red' },
		{ index: 1, name: 'Black', hex: '#000000', className: 'color-preset--black' },
		{ index: 2, name: 'White', hex: '#ffffff', className: 'color-preset--white' },
	]
	for (const option of options) {
		const label = document.createElement('label')
		label.className = `color-preset ${option.className}`
		const input = document.createElement('input')
		input.type = 'radio'
		input.name = 'scene-text-color'
		input.value = String(option.index)
		input.checked = selectedIndex === option.index
		input.addEventListener('change', () => {
			if (input.checked) onChange(option.index)
		})
		const accessibleName = document.createElement('span')
		accessibleName.className = 'visually-hidden'
		accessibleName.textContent = `${option.name} ${option.hex}`
		label.append(input, accessibleName)
		presets.appendChild(label)
	}
	group.appendChild(presets)
	return group
}

function getSceneAttributeValue(node, attributeParts) {
	let attribute = node?.attributes
	for (const part of attributeParts) {
		if (attribute?.list && /^\d+$/.test(part)) {
			attribute = attribute.list[Number(part)]
		} else {
			attribute = attribute?.[part]
		}
	}
	return attribute && typeof attribute === 'object' && 'value' in attribute
		? attribute.value
		: attribute
}

function formatTime(seconds) {
	const totalSeconds = Math.floor(seconds)
	const minutes = Math.floor(totalSeconds / 60)
	const remainder = totalSeconds % 60
	return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

function showPlayerError(mount, error) {
	const message = document.createElement('div')
	message.className = 'player-error'
	message.setAttribute('role', 'alert')
	message.textContent =
		error instanceof Error ? `Unable to load animation: ${error.message}` : 'Unable to load animation.'
	mount.appendChild(message)
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initialise, { once: true })
} else {
	initialise()
}
