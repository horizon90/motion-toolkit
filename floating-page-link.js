class FloatingPageLink extends HTMLElement {
	static get observedAttributes() {
		return ['href', 'label', 'accessible-label'];
	}

	constructor() {
		super();

		const shadow = this.attachShadow({ mode: 'open' });
		shadow.innerHTML = `
			<style>
				:host {
					position: fixed;
					bottom: var(--floating-link-bottom, 16px);
					right: 16px;
					z-index: 1000;
					display: block;
				}

				a {
					display: inline-flex;
					min-height: var(--floating-link-height, 38px);
					align-items: center;
					justify-content: center;
					gap: 8px;
					padding: 0 14px;
					border: 1px solid #505054;
					border-radius: 7px;
					background: #0b0c0d;
					color: #f5f3ee;
					font: 500 12px/1.45 'Inter', 'Segoe UI', sans-serif;
					text-decoration: none;
					-webkit-tap-highlight-color: transparent;
				}

				a:hover {
					border-color: #85848b;
					background: #141518;
				}

				a:focus-visible {
					outline: 2px solid #d9b8ff;
					outline-offset: 3px;
				}

				@media (max-width: 720px) {
					a {
						min-height: var(--floating-link-height, 34px);
						gap: 6px;
						padding: 0 8px;
						font-size: 10px;
					}
				}
			</style>
			<a><span class="label"></span> <span aria-hidden="true">↗</span></a>
		`;

		this.link = shadow.querySelector('a');
		this.label = shadow.querySelector('.label');
	}

	connectedCallback() {
		this.updateLink();
	}

	attributeChangedCallback() {
		this.updateLink();
	}

	updateLink() {
		if (!this.link) {
			return;
		}

		this.link.href = this.getAttribute('href') || '';
		this.label.textContent = this.getAttribute('label') || '';
		this.link.setAttribute(
			'aria-label',
			this.getAttribute('accessible-label') || this.getAttribute('label') || '',
		);
	}
}

customElements.define('floating-page-link', FloatingPageLink);
