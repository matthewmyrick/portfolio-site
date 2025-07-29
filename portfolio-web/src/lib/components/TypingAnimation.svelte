<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	export let text = 'Hello, my name is Matthew!';
	export let typingSpeed = 120;
	export let deletingSpeed = 80;
	export let delayAfterTyping = 2500;

	let animatedText = '';
	let animationTimeout: number;

	function typeEffect() {
		let i = 0;
		const type = () => {
			if (i < text.length) {
				animatedText += text.charAt(i);
				i++;
				animationTimeout = setTimeout(type, typingSpeed);
			} else {
				animationTimeout = setTimeout(deleteEffect, delayAfterTyping);
			}
		};
		type();
	}

	function deleteEffect() {
		let i = text.length;
		const del = () => {
			if (i > 0) {
				animatedText = animatedText.slice(0, -1);
				i--;
				animationTimeout = setTimeout(del, deletingSpeed);
			} else {
				animationTimeout = setTimeout(typeEffect, 500);
			}
		};
		del();
	}

	onMount(() => {
		animationTimeout = setTimeout(typeEffect, 1000);
	});

	onDestroy(() => {
		clearTimeout(animationTimeout);
	});
</script>

<div class="absolute top-4 right-4 z-10 text-lg">
	{@html animatedText}<span class="blinking-cursor">|</span>
</div>

<style>
	.blinking-cursor {
		animation: header-blink 0.8s step-end infinite;
		color: #4ade80;
	}

	@keyframes header-blink {
		from,
		to {
			color: transparent;
		}
		50% {
			color: inherit;
		}
	}
</style>