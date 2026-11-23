const videos = document.querySelectorAll('.work-gallery__item video');
const supportsHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

const templateLinks = document.querySelectorAll('.work-gallery__template-link');
for (const templateLink of templateLinks) {
	templateLink.addEventListener('click', (event) => {
		event.preventDefault();
		if (templateLink.dataset.downloadPending === 'true') return;

		templateLink.dataset.downloadPending = 'true';
		templateLink.setAttribute('aria-disabled', 'true');

		const apolloForm = templateLink.dataset.apolloForm;
		if (apolloForm) {
			window.open(apolloForm, '_blank', 'noopener,noreferrer');
		}

		const label = templateLink.querySelector('strong');
		const originalLabel = label?.innerHTML;
		let remainingSeconds = 5;
		if (label) label.textContent = `Continuing in ${remainingSeconds}s...`;

		const countdown = window.setInterval(() => {
			remainingSeconds -= 1;
			if (remainingSeconds > 0) {
				if (label) label.textContent = `Continuing in ${remainingSeconds}s...`;
				return;
			}

			window.clearInterval(countdown);
			if (label && originalLabel) label.innerHTML = originalLabel;
			templateLink.removeAttribute('aria-disabled');
			templateLink.dataset.downloadPending = 'false';
			window.location.assign(templateLink.href);
		}, 1000);
	});
}

for (const video of videos) {
	const figure = video.closest('.work-gallery__item');
	const fullscreenButton = figure.querySelector('.work-gallery__fullscreen');

	video.addEventListener('loadedmetadata', () => {
		video.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
	});

	const playVideo = () => {
		const playback = video.play();
		if (playback) {
			playback.catch((error) => {
				if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') {
					console.error('Unable to play gallery video.', error);
				}
			});
		}
	};

	const pauseVideo = () => {
		video.pause();
		video.currentTime = 0;
	};

	if (supportsHover) {
		figure.addEventListener('mouseenter', playVideo);
		figure.addEventListener('mouseleave', pauseVideo);
	} else {
		video.addEventListener('click', () => {
			if (video.paused) {
				playVideo();
			} else {
				pauseVideo();
			}
		});
		video.addEventListener('keydown', (event) => {
			if (event.code === 'Space' || event.code === 'Enter') {
				event.preventDefault();
				if (video.paused) {
					playVideo();
				} else {
					pauseVideo();
				}
			}
		});
	}

	fullscreenButton.addEventListener('click', () => {
		if (video.requestFullscreen) {
			video.requestFullscreen().catch((error) => {
				console.error('Unable to open gallery video in full screen.', error);
			});
		} else if (video.webkitEnterFullscreen) {
			video.webkitEnterFullscreen();
		}
	});
}

const images = document.querySelectorAll('.work-gallery__item img');

for (const image of images) {
	const fullscreenButton = image
		.closest('.work-gallery__item')
		.querySelector('.work-gallery__fullscreen');

	if (fullscreenButton) {
		fullscreenButton.addEventListener('click', () => {
			if (image.requestFullscreen) {
				image.requestFullscreen().catch((error) => {
					console.error('Unable to open gallery image in full screen.', error);
				});
			}
		});
	}
}
