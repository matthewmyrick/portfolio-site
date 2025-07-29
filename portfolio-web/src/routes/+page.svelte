<script lang="ts">
	import { onMount, tick } from 'svelte';
	import {
		history,
		currentCommand,
		cursorPos,
		addToHistory,
		addCommandToHistory,
		gameState
	} from '../lib/stores/terminal.js';
	import { loadCommands } from '../lib/utils/commandManager.js';
	import { generateHighlightedCommand } from '../lib/utils/commandHighlighter.js';
	import { processCommand } from '../lib/utils/commandProcessor.js';
	import TypingAnimation from '../lib/components/TypingAnimation.svelte';
	import TerminalHistory from '../lib/components/TerminalHistory.svelte';
	import TerminalInput from '../lib/components/TerminalInput.svelte';

	let terminalElement: HTMLElement;
	let terminalInput: TerminalInput;
	let highlightedCommandHtml = '';

	const commands = loadCommands();
	const welcomeMessage = [
		'Welcome to my interactive portfolio terminal website hosted from my apartment 🏡!',
		'Type `help` to see available commands.'
	];

	$: highlightedCommandHtml = generateHighlightedCommand(
		$currentCommand,
		commands,
		$cursorPos,
		$gameState.isActive
	);

	async function scrollToBottom() {
		await tick();
		terminalElement?.scrollTo(0, terminalElement.scrollHeight);
	}

	function handleSubmit() {
		const trimmedInput = $currentCommand.trim();
		if (!trimmedInput) return;

		// Only add to command history if not in game mode
		if (!$gameState.isActive) {
			addCommandToHistory(highlightedCommandHtml, $currentCommand);
		} else {
			// For game mode, just add to display history without command history
			const historyHtml = highlightedCommandHtml
				.replace(/<span class="cursor-on-char">(.+?)<\/span>/g, '$1')
				.replace('<span class="cursor-at-end"></span>', '');
			addToHistory([`<span class="text-green-400">></span> ${historyHtml}`]);
		}

		processCommand(trimmedInput, commands);
		currentCommand.set('');
		scrollToBottom();
	}

	function handleInput() {
		// Input handling is managed by the TerminalInput component
	}

	function focusInput() {
		terminalInput?.focus();
	}

	function handleContainerKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			focusInput();
		}
	}

	onMount(() => {
		terminalInput?.focus();
		addToHistory(welcomeMessage);
	});

	// Subscribe to history changes for auto-scrolling
	$: if ($history) {
		scrollToBottom();
	}
</script>

<div class="relative h-screen w-full bg-black font-mono text-white">
	<!-- Typing Animation Text -->
	<TypingAnimation />

	<button
		bind:this={terminalElement}
		class="block h-full w-full cursor-text overflow-y-auto border-none bg-transparent p-4 text-left align-top focus:outline-none"
		style="font-family: inherit; font-size: inherit; line-height: inherit; color: inherit; margin: 0; display: flex; flex-direction: column; justify-content: flex-start; align-items: flex-start; text-align: left;"
		onclick={focusInput}
		onkeydown={handleContainerKeyDown}
		aria-label="Terminal interface - click to focus input"
	>
		<!-- History of commands and outputs -->
		<TerminalHistory history={$history} />

		<!-- Command input line -->
		<TerminalInput
			bind:this={terminalInput}
			{highlightedCommandHtml}
			onSubmit={handleSubmit}
			onInput={handleInput}
		/>
	</button>
</div>

<style>
	:global(.cursor-on-char) {
		background-color: white;
		color: black;
	}

	:global(.cursor-at-end) {
		display: inline-block;
		width: 0.5rem;
		height: 1.2rem;
		background-color: white;
		position: relative;
		top: 0.2rem;
	}
</style>

