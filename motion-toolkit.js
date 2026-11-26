const sceneUrl = './WebTool v3.cv'

async function initialise() {
	const previewStage = document.querySelector('.preview-stage')
	const playerMount = document.getElementById('player')
	const controlsContainer = document.getElementById('control-center-controls')
	const resolutionControls = document.getElementById('resolution-controls')
	const sceneStatus = document.getElementById('scene-status')
	const playButton = document.querySelector('.playback__play')
	const playbackDownloadButton = document.querySelector('.playback__download')
	const timeline = document.querySelector('.playback__timeline')
	const progress = document.querySelector('.playback__progress')
	const playhead = document.querySelector('.playback__head')
	const currentTime = document.querySelector('.playback__time')
	const durationTime = document.querySelector('.playback__duration')
	const exportNote = document.getElementById('export-note')

	if (
		!previewStage ||
		!playerMount ||
		!controlsContainer ||
		!resolutionControls ||
		!sceneStatus ||
		!playButton ||
		!playbackDownloadButton ||
		!timeline ||
		!progress ||
		!playhead ||
		!currentTime ||
		!durationTime ||
		!exportNote
	) {
		throw new Error('The motion toolkit page is missing required UI elements.')
	}

	let player
	let uiFrameId = null
	let isSeeking = false
	let scrubPointerId = null
	let wasPlayingBeforeScrub = false
	const fitPreview = (resolution) => {
		const playerContainer = playerMount.querySelector('.player-container')
		if (!playerContainer || resolution.width <= 0 || resolution.height <= 0) return

		const availableWidth = Math.max(1, previewStage.clientWidth - 56)
		const availableHeight = Math.max(1, previewStage.clientHeight - 56)
		const scale = Math.min(
			availableWidth / resolution.width,
			availableHeight / resolution.height,
			458 / resolution.width,
		)
		playerContainer.style.width = `${Math.round(resolution.width * scale)}px`
		playerContainer.style.height = `${Math.round(resolution.height * scale)}px`
	}

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
		const { CavalryPlayer } = await import('./CavalryPlayer.js')
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
		const playerScene = prepareSceneForPlayer(sceneDefinition)
		await player.loadScene(playerScene, 'WebTool v3.cv', './')

		if (!player.player) {
			throw new Error('The Cavalry scene could not be initialized.')
		}

		renderControlCentreInputs(
			sceneDefinition,
			player,
			controlsContainer,
			resolutionControls,
			previewStage,
			playerMount,
			exportNote,
		)
		sceneStatus.textContent = 'Cavalry scene loaded.'
		const resolution = player.player.getSceneResolution()
		fitPreview(resolution)
		player.resize()
		exportNote.textContent = `MP4 · ${resolution.width} × ${resolution.height}`
		syncPlaybackUi()
		window.addEventListener('resize', () => {
			fitPreview(player.player.getSceneResolution())
			player.resize()
		})

		const togglePlayback = () => {
			player.togglePlayback()
			if (uiFrameId !== null) cancelAnimationFrame(uiFrameId)
			uiFrameId = null
			syncPlaybackUi()
		}

		playButton.addEventListener('click', togglePlayback)
		player.canvas.addEventListener('click', togglePlayback)

		timeline.addEventListener('click', (event) => {
			if (event.detail !== 0) return
			const bounds = timeline.getBoundingClientRect()
			const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width))
			seekToRatio(ratio)
		})

		timeline.addEventListener('pointerdown', (event) => {
			if (!event.isPrimary || event.button !== 0) return

			event.preventDefault()
			scrubPointerId = event.pointerId
			wasPlayingBeforeScrub = player.player.isPlaying()
			isSeeking = true
			if (uiFrameId !== null) cancelAnimationFrame(uiFrameId)
			uiFrameId = null
			if (wasPlayingBeforeScrub) player.stop()
			timeline.setPointerCapture(event.pointerId)
			scrubToPosition(event.clientX)
		})

		timeline.addEventListener('pointermove', (event) => {
			if (event.pointerId === scrubPointerId) scrubToPosition(event.clientX)
		})

		const finishScrubbing = (event) => {
			if (event.pointerId !== scrubPointerId) return

			scrubPointerId = null
			isSeeking = false
			if (wasPlayingBeforeScrub) player.play()
			wasPlayingBeforeScrub = false
			syncPlaybackUi()
		}

		timeline.addEventListener('pointerup', finishScrubbing)
		timeline.addEventListener('pointercancel', finishScrubbing)

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

		const downloadAnimation = () => {
			const downloadButton = playerMount.querySelector('#downloadMp4Button')
			if (!downloadButton || downloadButton.disabled) {
				exportNote.textContent = 'The animation is not ready to export.'
				return
			}
			downloadButton.click()
		}

		playbackDownloadButton.addEventListener('click', downloadAnimation)

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

		function scrubToPosition(clientX) {
			const bounds = timeline.getBoundingClientRect()
			if (bounds.width <= 0) return
			const ratio = Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width))
			const scene = player.player
			const startFrame = scene.getStartFrame()
			const endFrame = scene.getEndFrame()
			scene.setFrame(Math.round(startFrame + ratio * (endFrame - startFrame)))
			player.render()
			syncPlaybackUi()
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

function prepareSceneForPlayer(scene) {
	for (const asset of scene.assets || []) {
		const filePath = asset.data?.filePath
		if (typeof filePath !== 'string') continue

		const filename = filePath.replace(/\\/g, '/').split('/').filter(Boolean).pop()
		if (!filename) {
			throw new Error(`The scene asset ${asset.nodeId} has an invalid file path.`)
		}
		asset.data.filePath = `@project/${filename}`
	}

	const svgInput = scene.controlCenter?.items
		?.flatMap((item) => {
			if (item.kind === 'group') return item.attrs || []
			return item.kind === 'attr' && typeof item.path === 'string'
				? [item.path]
				: []
		})
		.find((path) => {
			const [nodeId, attributeId] = path.split('.')
			const node = scene.nodes.find((entry) => entry.nodeId === nodeId)
			return attributeId === 'input' && node?.nodeType === 'svgShape'
		})

	if (svgInput) {
		const svgNodeId = svgInput.split('.')[0]
		const svgNode = scene.nodes.find((node) => node.nodeId === svgNodeId)
		if (svgNode?.attributes?.hidden?.varType === 'bool') {
			svgNode.attributes.hidden.value = false
		}
		const materialId = scene.connections
			?.find((connection) => connection.to === `${svgNodeId}.material`)
			?.from.split('.')[0]
		const materialNode = scene.nodes.find((node) => node.nodeId === materialId)
		const materialColor = materialNode?.attributes?.materialColor?.value
		if (materialColor && materialColor.a === 0) {
			materialColor.a = 255
		}
	}

	return new TextEncoder().encode(JSON.stringify(scene))
}

function renderControlCentreInputs(
	scene,
	player,
	container,
	resolutionControls,
	previewStage,
	playerMount,
	exportNote,
) {
	const paths =
		scene.controlCenter?.items?.flatMap((item) => {
			if (item.kind === 'group') return item.attrs || []
			return item.kind === 'attr' && typeof item.path === 'string'
				? [item.path]
				: []
		}) || []
	const actionsContainer = exportNote.parentElement
	if (!actionsContainer) {
		throw new Error('The export status is missing its action container.')
	}
	container.replaceChildren()

	let renderedControls = 0
	let svgUploadControl = null
	let svgColourControls = null
	let anchorControls = null
	let lineControls = null

	const getSvgColourControls = () => {
		if (!svgColourControls) {
			svgColourControls = document.createElement('div')
			svgColourControls.className = 'svg-colour-controls'
			svgColourControls.setAttribute('role', 'group')
			svgColourControls.setAttribute('aria-label', 'SVG stroke and fill colours')
			container.appendChild(svgColourControls)
		}
		return svgColourControls
	}

	const getAnchorControls = () => {
		if (!anchorControls) {
			anchorControls = document.createElement('div')
			anchorControls.className = 'control-group anchor-controls'
			anchorControls.setAttribute('role', 'group')
			anchorControls.setAttribute('aria-label', 'Anchor point controls')
			container.appendChild(anchorControls)
		}
		return anchorControls
	}

	const getLineControls = () => {
		if (!lineControls) {
			lineControls = document.createElement('div')
			lineControls.className = 'control-group line-controls'
			lineControls.setAttribute('role', 'group')
			lineControls.setAttribute('aria-label', 'Line controls')
			container.appendChild(lineControls)
		}
		return lineControls
	}

	for (const path of paths) {
		const [layerId, ...attributeParts] = path.split('.')
		const attributeId = attributeParts.join('.')
		const node = scene.nodes.find((entry) => entry.nodeId === layerId)
		const serializedValue = getSceneAttributeValue(node, attributeParts)
		const value =
			player.player.getAttribute(layerId, attributeId) ?? serializedValue ?? ''
		const setValue = (newValue) => setSceneAttribute(path, newValue)

		switch (path) {
			case 'svgShape#4.input':
				svgUploadControl = createSvgUploadControl(
					scene,
					player,
					path,
					actionsContainer,
				)
				renderedControls += 1
				break
			case 'strokeMaterial#126.strokeColor':
				getSvgColourControls().appendChild(
					createColorControl('Strokes fill', value, setValue),
				)
				renderedControls += 1
				break
			case 'compNode#7.resolution':
				createResolutionControl(
					resolutionControls,
					value,
					(resolution) => setSceneAttribute(path, resolution, true),
				)
				renderedControls += 1
				break
			case 'colorMaterial#114.materialColor':
				container.appendChild(
					createColorControl('Canvas colour', value, setValue),
				)
				renderedControls += 1
				break
			case 'rectangleShape#20.cornerRadius':
				getAnchorControls().appendChild(
					createAnchorShapeControl(Number(value), setValue),
				)
				renderedControls += 1
				break
			case 'colorMaterial#128.materialColor':
				getAnchorControls().appendChild(
					createColorControl('Anchor Point Color', value, setValue),
				)
				renderedControls += 1
				break
			case 'colorMaterial#119.materialColor':
				getSvgColourControls().appendChild(
					createColorControl('SVG fill colour', value, setValue),
				)
				renderedControls += 1
				break
			case 'strokeMaterial#132.strokeColor':
				getLineControls().appendChild(
					createColorControl('Line fill', value, setValue),
				)
				renderedControls += 1
				break
			case 'strokeMaterial#132.width':
				getLineControls().appendChild(
					createRangeControl('Line Width', Number(value), setValue, 0, 10, 0.1, 1),
				)
				renderedControls += 1
				break
		}
	}

	if (svgUploadControl) {
		container.appendChild(svgUploadControl)
	}

	if (renderedControls === 0) {
		const message = document.createElement('p')
		message.className = 'control-message'
		message.textContent = 'No supported Control Centre attributes were found.'
		container.appendChild(message)
	}

	function setSceneAttribute(path, newValue, updateResolution = false) {
		const [layerId, ...attributeParts] = path.split('.')
		const attributeId = attributeParts.join('.')
		player.player.setAttribute(layerId, attributeId, newValue)

		if (updateResolution) {
			const resolution = player.player.getSceneResolution()
			const playerContainer = playerMount.querySelector('.player-container')
			if (playerContainer) {
				fitPreviewToResolution(playerContainer, resolution, previewStage)
			}
			player.resize()
			exportNote.textContent = `MP4 · ${resolution.width} × ${resolution.height}`
		} else if (!player.player.isPlaying()) {
			player.render()
		}
	}

	function fitPreviewToResolution(playerContainer, resolution, stage) {
		const availableWidth = Math.max(1, stage.clientWidth - 56)
		const availableHeight = Math.max(1, stage.clientHeight - 56)
		const scale = Math.min(
			availableWidth / resolution.width,
			availableHeight / resolution.height,
			458 / resolution.width,
		)
		playerContainer.style.width = `${Math.round(resolution.width * scale)}px`
		playerContainer.style.height = `${Math.round(resolution.height * scale)}px`
	}
}

function createSvgUploadControl(scene, player, path, statusContainer) {
	const group = document.createElement('div')
	group.className = 'field svg-upload-control'
	let originalSvgText = null
	let pendingSvgWidth = null
	let svgUpdatePromise = null
	const assetId = getAssetIdForAttribute(scene, path)
	const uploadLabel = document.createElement('label')
	uploadLabel.className = 'svg-upload-button'
	const input = document.createElement('input')
	input.className = 'svg-upload-input'
	input.type = 'file'
	input.accept = '.svg,image/svg+xml'
	input.setAttribute('aria-label', 'Upload SVG')
	const buttonText = document.createElement('span')
	buttonText.textContent = 'Upload SVG'
	uploadLabel.append(input, createControlIcon('upload'), buttonText)

	const status = document.createElement('p')
	status.className = 'control-message svg-upload-status'
	status.setAttribute('role', 'status')
	status.textContent = ''
	const sizeControl = createRangeControl(
		'SVG Size',
		800,
		(width) => {
			if (!originalSvgText) return
			applySvgWidth(width).then(
				() => {
					status.removeAttribute('aria-invalid')
					status.textContent = 'Updated'
				},
				reportSvgUpdateError,
			)
		},
		400,
		1200,
		1,
		0,
		false,
	)
	const svgSizeInput = sizeControl.querySelector('input')
	group.append(uploadLabel, sizeControl)
	statusContainer.prepend(status)

	function applySvgWidth(width) {
		pendingSvgWidth = width
		if (!svgUpdatePromise) {
			svgUpdatePromise = Promise.resolve().then(async () => {
				try {
					while (pendingSvgWidth !== null) {
						const nextWidth = pendingSvgWidth
						pendingSvgWidth = null
						const scaledSvg = scaleSvgToWidth(originalSvgText, nextWidth)
						const filename = `uploaded-artwork-${Date.now()}-${nextWidth}.svg`
						const contents = new TextEncoder().encode(scaledSvg)
						player.module.FS.writeFile(filename, contents)
						await player.loadAsset({ assetId, filename, type: 'svg' })
						if (!player.player.isPlaying()) player.render()
					}
				} finally {
					svgUpdatePromise = null
				}
			})
		}
		return svgUpdatePromise
	}

	function reportSvgUpdateError(error) {
		console.error('[Motion Toolkit] SVG resize failed:', error)
		status.setAttribute('aria-invalid', 'true')
		status.textContent =
			error instanceof Error ? error.message : 'Unable to resize this SVG.'
	}

	input.addEventListener('change', async () => {
		const file = input.files?.[0]
		if (!file) return

		try {
			if (!file.name.toLowerCase().endsWith('.svg')) {
				throw new Error('Choose an SVG file.')
			}
			const svgText = await file.text()

			if (!assetId) {
				throw new Error('The scene does not expose a replaceable SVG asset.')
			}

			scaleSvgToWidth(svgText, Number(svgSizeInput.value))
			originalSvgText = svgText
			await applySvgWidth(Number(svgSizeInput.value))
			status.removeAttribute('aria-invalid')
			status.textContent = 'Updated'
			input.value = ''
		} catch (error) {
			reportSvgUpdateError(error)
			input.value = ''
		}
	})

	return group
}

function scaleSvgToWidth(svgText, targetWidth) {
	const svgDocument = new DOMParser().parseFromString(svgText, 'image/svg+xml')
	const svg = svgDocument.documentElement
	if (svg.localName !== 'svg' || svgDocument.querySelector('parsererror')) {
		throw new Error('The selected file is not a valid SVG.')
	}

	const parsePixelDimension = (value) => {
		if (!value) return null
		const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*(?:px)?$/i)
		if (!match) {
			throw new Error('The SVG dimensions must be declared in pixels.')
		}
		const dimension = Number(match[1])
		if (!Number.isFinite(dimension) || dimension <= 0) {
			throw new Error('The SVG dimensions must be greater than zero.')
		}
		return dimension
	}

	const viewBox = svg
		.getAttribute('viewBox')
		?.trim()
		.split(/[\s,]+/)
		.map(Number)
	const hasValidViewBox =
		viewBox?.length === 4 &&
		viewBox.every(Number.isFinite) &&
		viewBox[2] > 0 &&
		viewBox[3] > 0
	let sourceWidth = parsePixelDimension(svg.getAttribute('width'))
	let sourceHeight = parsePixelDimension(svg.getAttribute('height'))
	if (hasValidViewBox) {
		if (sourceWidth === null) {
			sourceWidth =
				sourceHeight === null
					? viewBox[2]
					: (sourceHeight * viewBox[2]) / viewBox[3]
		}
		if (sourceHeight === null) {
			sourceHeight =
				sourceWidth === null
					? viewBox[3]
					: (sourceWidth * viewBox[3]) / viewBox[2]
		}
	}

	if (sourceWidth === null || sourceHeight === null) {
		throw new Error('The SVG needs pixel dimensions or a valid viewBox to preserve its proportions.')
	}

	svg.setAttribute('width', `${targetWidth}px`)
	svg.setAttribute('height', `${(sourceHeight * targetWidth) / sourceWidth}px`)
	return new XMLSerializer().serializeToString(svgDocument)
}

function getAssetIdForAttribute(scene, path) {
	const connection = scene.connections?.find((entry) => entry.to === path)
	return connection?.from?.split('.')[0] || ''
}

function createColorControl(labelText, value, onChange) {
	let color = normalizeColor(value)
	const group = document.createElement('div')
	group.className = 'field color-control'
	group.setAttribute('role', 'group')
	group.setAttribute('aria-label', labelText)
	const label = document.createElement('div')
	label.className = 'field__control-label'
	label.append(
		createControlIcon(getControlIconName(labelText)),
		document.createTextNode(labelText),
	)

	const row = document.createElement('div')
	row.className = 'color-control__row'
	const picker = document.createElement('input')
	picker.type = 'color'
	picker.value = colorToHex(color)
	picker.setAttribute('aria-label', `${labelText} colour picker`)
	const hex = document.createElement('input')
	hex.className = 'hex-input'
	hex.type = 'text'
	hex.value = colorToHex(color)
	hex.maxLength = 7
	hex.pattern = '^#?[0-9a-fA-F]{6}$'
	hex.title = 'Enter a 6-digit hex colour, for example #ffffff.'
	hex.setAttribute('aria-label', `${labelText} hex colour`)

	const updateFromHex = (hexValue) => {
		const match = hexValue.trim().match(/^#?([0-9a-f]{6})$/i)
		if (!match) {
			hex.setAttribute('aria-invalid', 'true')
			return
		}
		hex.removeAttribute('aria-invalid')
		const hexDigits = match[1]
		const updated = {
			r: Number.parseInt(hexDigits.slice(0, 2), 16),
			g: Number.parseInt(hexDigits.slice(2, 4), 16),
			b: Number.parseInt(hexDigits.slice(4, 6), 16),
			a: 255,
		}
		color = updated
		picker.value = `#${hexDigits}`
		hex.value = `#${hexDigits}`
		onChange(updated)
	}

	picker.addEventListener('input', () => updateFromHex(picker.value))
	hex.addEventListener('change', () => updateFromHex(hex.value))
	row.append(picker, hex)

	group.append(label, row)
	return group
}

function normalizeColor(value) {
	const channel = (name, fallback) => {
		const number = Number(value?.[name])
		return Number.isFinite(number)
			? Math.max(0, Math.min(255, Math.round(number)))
			: fallback
	}
	return {
		r: channel('r', 255),
		g: channel('g', 255),
		b: channel('b', 255),
		a: channel('a', 255),
	}
}

function colorToHex(color) {
	return `#${[color.r, color.g, color.b]
		.map((channel) => channel.toString(16).padStart(2, '0'))
		.join('')}`
}

function getControlIconName(labelText) {
	if (/canvas/i.test(labelText)) return 'canvas'
	if (/anchor/i.test(labelText)) return 'anchor'
	if (/line width/i.test(labelText)) return 'line-width'
	if (/stroke|line/i.test(labelText)) return 'stroke'
	if (/fill/i.test(labelText)) return 'fill'
	return 'control'
}

function createControlIcon(name) {
	const iconShapes = {
		upload: [['path', { d: 'M12 15V3m0 0 4 4m-4-4L8 7M5 14v5h14v-5' }]],
		stroke: [['path', { d: 'M4 17 20 7' }]],
		fill: [['path', { d: 'M12 3 19 14a7 7 0 1 1-14 0L12 3Z' }]],
		canvas: [
			['rect', { x: 3, y: 4, width: 18, height: 16, rx: 2 }],
			['path', { d: 'M8 4v16M3 9h5' }],
		],
		anchor: [
			['circle', { cx: 12, cy: 12, r: 7 }],
			['path', { d: 'M12 2v4m0 12v4M2 12h4m12 0h4' }],
		],
		square: [['rect', { x: 5, y: 5, width: 14, height: 14, rx: 1 }]],
		circle: [['circle', { cx: 12, cy: 12, r: 7 }]],
		'line-width': [['path', { d: 'M4 12h16M7 9l-3 3 3 3m10-6 3 3-3 3' }]],
		landscape: [['rect', { x: 3, y: 6, width: 18, height: 12, rx: 1 }]],
		squareRatio: [['rect', { x: 5, y: 5, width: 14, height: 14, rx: 1 }]],
		portrait: [['rect', { x: 6, y: 3, width: 12, height: 18, rx: 1 }]],
		control: [['circle', { cx: 12, cy: 12, r: 7 }]],
	}
	const namespace = 'http://www.w3.org/2000/svg'
	const icon = document.createElementNS(namespace, 'svg')
	icon.classList.add('control-icon')
	icon.setAttribute('viewBox', '0 0 24 24')
	icon.setAttribute('aria-hidden', 'true')
	icon.setAttribute('focusable', 'false')

	for (const [tagName, attributes] of iconShapes[name] || iconShapes.control) {
		const shape = document.createElementNS(namespace, tagName)
		for (const [attribute, value] of Object.entries(attributes)) {
			shape.setAttribute(attribute, String(value))
		}
		icon.appendChild(shape)
	}

	return icon
}

function createResolutionControl(container, value, onChange) {
	const options = [
		{ label: '16:9', name: 'Landscape', icon: 'landscape', width: 1920, height: 1080 },
		{ label: '1:1', name: 'Square', icon: 'squareRatio', width: 1080, height: 1080 },
		{ label: '4:5', name: 'Portrait', icon: 'portrait', width: 1080, height: 1350 },
	]
	const current = normalizeResolution(value)
	const buttons = []

	for (const option of options) {
		const button = document.createElement('button')
		button.type = 'button'
		button.className = 'resolution-button'
		button.append(createControlIcon(option.icon), document.createTextNode(option.label))
		button.setAttribute('aria-label', `${option.name}, ${option.label}`)
		button.setAttribute(
			'aria-pressed',
			String(option.width === current.width && option.height === current.height),
		)
		button.addEventListener('click', () => {
			for (const candidate of buttons) {
				candidate.setAttribute('aria-pressed', String(candidate === button))
			}
			onChange([option.width, option.height])
		})
		buttons.push(button)
		container.appendChild(button)
	}
}

function normalizeResolution(value) {
	const width = Number(Array.isArray(value) ? value[0] : value?.x)
	const height = Number(Array.isArray(value) ? value[1] : value?.y)
	return {
		width: Number.isFinite(width) && width > 0 ? Math.round(width) : 1920,
		height: Number.isFinite(height) && height > 0 ? Math.round(height) : 1080,
	}
}

function createAnchorShapeControl(radius, onChange) {
	const group = document.createElement('div')
	group.className = 'field anchor-shape-control'
	group.setAttribute('role', 'group')
	group.setAttribute('aria-label', 'Anchor point shape')
	const label = document.createElement('div')
	label.className = 'field__control-label'
	label.append(
		createControlIcon('anchor'),
		document.createTextNode('Anchor point shape'),
	)
	const choices = document.createElement('div')
	choices.className = 'field__choices'

	for (const option of [
		{ label: 'Square', icon: 'square', radius: 0 },
		{ label: 'Circle', icon: 'circle', radius: 10 },
	]) {
		const button = document.createElement('button')
		button.className = 'control-button'
		button.type = 'button'
		button.append(createControlIcon(option.icon), document.createTextNode(option.label))
		button.setAttribute('aria-pressed', String(radius === option.radius))
		button.addEventListener('click', () => {
			for (const choice of choices.querySelectorAll('button')) {
				choice.setAttribute('aria-pressed', String(choice === button))
			}
			onChange(option.radius)
		})
		choices.appendChild(button)
	}

	group.append(label, choices)
	return group
}

function createRangeControl(
	labelText,
	value,
	onChange,
	min,
	max,
	step,
	decimals,
	showValue = true,
) {
	const group = document.createElement('div')
	group.className = 'field range-control'
	if (!showValue) group.classList.add('range-control--no-value')
	const label = document.createElement('label')
	label.append(
		createControlIcon(getControlIconName(labelText)),
		document.createTextNode(labelText),
	)
	const input = document.createElement('input')
	input.type = 'range'
	input.min = String(min)
	input.max = String(max)
	input.step = String(step)
	input.value = String(Math.max(min, Math.min(max, value)))
	input.setAttribute('aria-label', labelText)
	const output = showValue ? document.createElement('output') : null
	if (output) {
		output.className = 'field__value'
		output.textContent = Number(input.value).toFixed(decimals)
	}
	input.addEventListener('input', () => {
		const numericValue = Number(input.value)
		if (output) output.textContent = numericValue.toFixed(decimals)
		onChange(numericValue)
	})
	group.append(label, input)
	if (output) group.appendChild(output)
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
