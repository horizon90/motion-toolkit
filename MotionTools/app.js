import { CavalryPlayer } from '../CavalryPlayer.js'

async function initialise() {
	const container = document.getElementById('player')
	const controlsContainer = document.getElementById('control-center-controls')
	try {
		if (!container) {
			throw new Error('Missing div element with id "player"')
		}
		if (!controlsContainer) {
			throw new Error('Missing div element with id "control-center-controls"')
		}
		const player = new CavalryPlayer(container, {
			sceneInput: false,
			controlsContainer,
		})
		const response = await fetch('./WEBTOOL.cv')
		if (!response.ok) {
			throw new Error(`Failed to load scene "${response.statusText}"`)
		}
		const scene = new Uint8Array(await response.arrayBuffer())
		const sceneDefinition = JSON.parse(new TextDecoder().decode(scene))
		await player.loadScene(scene, 'WEBTOOL.cv')
		renderControlCentreInputs(
			sceneDefinition,
			player,
			controlsContainer,
		)

		document.getElementById('loading')?.remove()
	} catch (error) {
		console.error(error)
		const div = document.createElement('div')
		div.className = 'player-error'
		if (error.message) {
			div.innerText = `Error "${error.message}". See the console for details.`
		} else {
			div.innerText = `Something went wrong. See the console for details.`
		}
		document.getElementById('loading')?.remove()
		container?.appendChild(div)
	}
}

function renderControlCentreInputs(scene, player, container) {
	const items = scene.controlCenter?.items?.filter(
		(item) => item.kind === 'attr' && typeof item.path === 'string',
	)
	container.replaceChildren()
	if (!items?.length) {
		container.innerHTML = `
			<div class="no-controls-message">
				Control Centre is empty
			</div>
		`
		return
	}

	for (const [index, item] of items.entries()) {
		const [layerId, ...attributeParts] = item.path.split('.')
		const attributeId = attributeParts.join('.')
		const node = scene.nodes.find((entry) => entry.nodeId === layerId)
		const serializedValue = getSceneAttributeValue(node, attributeParts)
		const value =
			player.player.getAttribute(layerId, attributeId) ?? serializedValue ?? ''
		const attributeName = player.player.getAttributeName(layerId, attributeId)
		const fallbackName = node?.attributes?.niceName?.value || layerId
		const labelText =
			attributeName && attributeName !== attributeId
				? attributeName
				: `${fallbackName} ${attributeParts[attributeParts.length - 1]}`

		const group = document.createElement('div')
		group.className = 'control-group'

		const label = document.createElement('label')
		label.className = 'control-label'
		label.htmlFor = `control-center-input-${index}`
		label.textContent = labelText
		group.appendChild(label)

		const input =
			String(value).includes('\n')
				? document.createElement('textarea')
				: document.createElement('input')
		if (input instanceof HTMLInputElement) {
			input.type = 'text'
		} else {
			input.rows = 4
		}
		input.id = label.htmlFor
		input.className = 'control-input'
		input.value = String(value)
		input.addEventListener('input', ({ target }) => {
			player.player.setAttribute(layerId, attributeId, target.value)
			if (!player.player.isPlaying()) {
				player.render()
			}
		})
		group.appendChild(input)
		container.appendChild(group)
	}
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

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initialise)
} else {
	initialise()
}
