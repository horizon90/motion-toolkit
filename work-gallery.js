const videos = document.querySelectorAll('.work-gallery__item video');
const supportsHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

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
		video.controls = true;
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
