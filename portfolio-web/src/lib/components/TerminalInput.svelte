<script lang="ts">
	import { tick } from 'svelte';
	import { currentCommand, commandHistory, historyIndex, cursorPos, gameState } from '../stores/terminal.js';

	export let highlightedCommandHtml: string;
	export let onSubmit: () => void;
	export let onInput: () => void;

	let inputElement: HTMLInputElement;

	export function focus() {
		inputElement?.focus();
	}

	function handleInput() {
		cursorPos.set(inputElement.selectionStart ?? 0);
		onInput();
	}

	async function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			onSubmit();
			return;
		}

		if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
			e.preventDefault();
			
			// Get current values without subscribing
			let currentHistory: string[] = [];
			let currentIndex: number = 0;
			
			const unsubHistory = commandHistory.subscribe(h => { currentHistory = h; });
			const unsubIndex = historyIndex.subscribe(i => { currentIndex = i; });
			
			// Clean up subscriptions immediately
			unsubHistory();
			unsubIndex();
			
			if (e.key === 'ArrowUp') {
				if (currentIndex > 0) {
					const newIndex = currentIndex - 1;
					historyIndex.set(newIndex);
					currentCommand.set(currentHistory[newIndex]);
				}
			} else {
				if (currentIndex < currentHistory.length - 1) {
					const newIndex = currentIndex + 1;
					historyIndex.set(newIndex);
					currentCommand.set(currentHistory[newIndex]);
				} else {
					historyIndex.set(currentHistory.length);
					currentCommand.set('');
				}
			}
			
			await tick();
			
			// Position cursor at end of command
			let cmd: string = '';
			const unsubCmd = currentCommand.subscribe(c => { cmd = c; });
			unsubCmd();
			
			const len = cmd.length;
			inputElement.selectionStart = inputElement.selectionEnd = len;
		}

		setTimeout(() => {
			cursorPos.set(inputElement.selectionStart ?? 0);
		}, 0);
	}

	function handleContainerKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			focus();
		}
	}

	function handleClick() {
		cursorPos.set(inputElement.selectionStart ?? 0);
	}
</script>

<div class="flex items-center">
	<span class="text-green-400">{$gameState.isActive ? '>' : '$'}</span>
	<button
		class="relative ml-2 flex-grow bg-transparent border-none p-0 text-left cursor-text focus:outline-none"
		style="font-family: inherit; font-size: inherit; line-height: inherit; color: inherit;"
		onclick={focus}
		onkeydown={handleContainerKeyDown}
		aria-label="Command input area - click to focus"
	>
		<!-- Visible, highlighted "fake" input -->
		<div class="whitespace-pre">{@html highlightedCommandHtml}</div>
		<!-- Invisible, real input that captures typing -->
		<input
			bind:this={inputElement}
			bind:value={$currentCommand}
			oninput={handleInput}
			onkeydown={handleKeyDown}
			onclick={handleClick}
			type="text"
			class="absolute top-0 left-0 h-full w-full border-none bg-transparent text-transparent caret-transparent focus:ring-0 focus:outline-none"
			autocomplete="off"
			spellcheck="false"
		/>
	</button>
</div>