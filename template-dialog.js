const DOWNLOAD_DELAY_SECONDS = 5;

const trigger = document.querySelector('.work-gallery__template-link');
const dialog = document.getElementById('template-dialog');

if (trigger && dialog && typeof dialog.showModal === 'function') {
	const form = dialog.querySelector('.template-dialog__form');
	const downloadLink = dialog.querySelector('[data-download-link]');
	const status = dialog.querySelector('[data-download-status]');
	let countdownTimer;

	const lockDownload = () => {
		downloadLink.setAttribute('aria-disabled', 'true');
		downloadLink.tabIndex = -1;
	};

	const unlockDownload = () => {
		downloadLink.removeAttribute('aria-disabled');
		downloadLink.removeAttribute('tabindex');
		status.textContent = 'Thanks! Your download is ready.';
	};

	const startCountdown = () => {
		let remaining = DOWNLOAD_DELAY_SECONDS;
		lockDownload();
		status.textContent = `Fill in the form — download unlocks in ${remaining}s`;
		countdownTimer = window.setInterval(() => {
			remaining -= 1;
			if (remaining <= 0) {
				window.clearInterval(countdownTimer);
				unlockDownload();
				return;
			}
			status.textContent = `Fill in the form — download unlocks in ${remaining}s`;
		}, 1000);
	};

	trigger.addEventListener('click', (event) => {
		event.preventDefault();
		if (!form.src) {
			form.src = form.dataset.src;
		}
		dialog.showModal();
		document.body.classList.add('has-open-dialog');
		startCountdown();
	});

	downloadLink.addEventListener('click', (event) => {
		if (downloadLink.getAttribute('aria-disabled') === 'true') {
			event.preventDefault();
		}
	});

	dialog.querySelector('[data-dialog-close]').addEventListener('click', () => dialog.close());

	dialog.addEventListener('click', (event) => {
		if (event.target === dialog) {
			dialog.close();
		}
	});

	dialog.addEventListener('close', () => {
		window.clearInterval(countdownTimer);
		document.body.classList.remove('has-open-dialog');
		trigger.focus();
	});
}
