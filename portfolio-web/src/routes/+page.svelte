<script lang="ts">
	import { onMount, tick, onDestroy } from 'svelte';

	// --- Component State ---
	let history: { id: number; type: 'input' | 'output' | 'error'; text: string }[] = [];
	let command: string = '';
	let commandHistory: string[] = [];
	let historyIndex: number = -1;
	let terminalElement: HTMLElement;
	let inputElement: HTMLInputElement;
	let nextId = 0;
	
	// --- Highlighting & Cursor State ---
	let highlightedCommandHtml: string = '';
	let cursorPos: number = 0;

	// --- Typing Animation State ---
	let animatedText = '';
	const fullText = "Hello, my name is Matthew!";
	const typingSpeed = 120;
	const deletingSpeed = 80;
	const delayAfterTyping = 2500;
	let headerAnimationTimeout: number;

	const welcomeMessage = [
		'Welcome to my interactive portfolio!',
		'Type `help` to see available commands.'
	];

	// --- Command Structure & Loading ---
	interface SubCommand {
		output: string[];
		originalName: string;
	}
	interface CommandDef {
		output?: string[];
		subCommands?: Record<string, SubCommand>;
		execute?: (args: Record<string, string | boolean>) => void;
	}

	const commands: Record<string, CommandDef> = {};
	const mainCommandModules = import.meta.glob('/src/commands/*/content.txt', { query: '?raw', import: 'default', eager: true });
	for (const path in mainCommandModules) {
		const content = mainCommandModules[path] as string;
		const commandName = path.split('/')[3];
		if (commandName) {
			if (!commands[commandName]) commands[commandName] = {};
			commands[commandName].output = content.split('\n');
		}
	}

	const subCommandModules = import.meta.glob('/src/commands/*/*/content.txt', { query: '?raw', import: 'default', eager: true });
	for (const path in subCommandModules) {
		const content = subCommandModules[path] as string;
		const parts = path.split('/');
		const commandName = parts[3];
		const subCommandName = parts[4]; 
		const subCommandKey = subCommandName.toLowerCase().replace(/[^a-z0-9]/g, '');
		if (commandName && subCommandKey) {
			if (!commands[commandName]) commands[commandName] = {};
			if (!commands[commandName].subCommands) commands[commandName].subCommands = {};
			commands[commandName].subCommands[subCommandKey] = { output: content.split('\n'), originalName: subCommandName };
		}
	}

	commands['clear'] = {
		execute: () => {
			history = [];
			addOutput(welcomeMessage);
		}
	};
	
	// --- UPDATED PARSER ---
	function parseCommand(input: string): { command: string; args: Record<string, string | boolean>; parts: string[] } {
		const parts = input.match(/(".*?"|'.*?'|\s+|\S+)/g) || [];
		const firstPartIndex = parts.findIndex(p => p.trim() !== '');
		const command = firstPartIndex !== -1 ? parts[firstPartIndex].trim().toLowerCase() : '';
		const args: Record<string, string | boolean> = {};

		for (let i = 0; i < parts.length; i++) {
			const part = parts[i].trim();
			if (part.startsWith('--')) {
				const flag = part.substring(2);
				
				// Find the next non-space part to be the value
				let valueIndex = i + 1;
				while(valueIndex < parts.length && parts[valueIndex].trim() === '') {
					valueIndex++;
				}

				if (valueIndex < parts.length && !parts[valueIndex].trim().startsWith('--')) {
					// We found a value for the flag
					const value = parts[valueIndex].trim().replace(/^["']|["']$/g, '');
					args[flag] = value;
					i = valueIndex; // Skip the value part in the next iteration
				} else {
					// It's a boolean flag with no value
					args[flag] = true;
				}
			}
		}
		return { command, args, parts };
	}


	// --- Advanced Syntax Highlighting ---
	$: {
		const { command: mainCommand, parts } = parseCommand(command);
		const commandDef = commands[mainCommand];
		let html = '';
		let rawTextLength = 0;

		const buildHtml = (text: string, className: string) => {
			let result = '';
			for (let i = 0; i < text.length; i++) {
				const char = text[i];
				const renderedChar = char === ' ' ? '&nbsp;' : char;
				if (rawTextLength === cursorPos) {
					result += `<span class="cursor-on-char">${renderedChar}</span>`;
				} else {
					result += renderedChar;
				}
				rawTextLength++;
			}
			return `<span class="${className}">${result}</span>`;
		};
		
		let partIndex = 0;
		if (parts.length > 0) {
			while(partIndex < parts.length && parts[partIndex].trim() === '') {
				html += buildHtml(parts[partIndex], '');
				partIndex++;
			}

			if (partIndex < parts.length) {
				html += buildHtml(parts[partIndex], commandDef ? 'text-green-400' : 'text-red-500');
				partIndex++;
			}

			if (commandDef) {
				while (partIndex < parts.length) {
					const part = parts[partIndex];
					if (part.trim() === '') {
						html += buildHtml(part, '');
					} else if (part.startsWith('--')) {
						const flag = part.substring(2);
						if (mainCommand === 'experience' && ['company', 'help', 'list'].includes(flag)) {
							html += buildHtml(part, 'text-yellow-400');
							if (flag === 'company') {
								let valueIndex = partIndex + 1;
								while(valueIndex < parts.length && parts[valueIndex].trim() === '') {
									html += buildHtml(parts[valueIndex], '');
									valueIndex++;
								}
								if (valueIndex < parts.length) {
									const valuePart = parts[valueIndex];
									const value = valuePart.replace(/^["']|["']$/g, '');
									const companyKey = value.toLowerCase().replace(/[^a-z0-9]/g, '');
									const companyExists = commandDef.subCommands && commandDef.subCommands[companyKey];
									html += buildHtml(valuePart, companyExists ? 'text-cyan-400' : 'text-red-500');
									partIndex = valueIndex;
								}
							}
						} else {
							html += buildHtml(part, 'text-red-500');
						}
					} else {
						html += buildHtml(part, 'text-red-500');
					}
					partIndex++;
				}
			} else {
				while(partIndex < parts.length) {
					html += buildHtml(parts[partIndex], 'text-red-500');
					partIndex++;
				}
			}
		}

		if (cursorPos >= command.length) {
			html += '<span class="cursor-at-end"></span>';
		}

		highlightedCommandHtml = html;
	}


	// --- Lifecycle & Functions ---
	function typeEffect() {
		let i = 0;
		const type = () => {
			if (i < fullText.length) {
				animatedText += fullText.charAt(i);
				i++;
				headerAnimationTimeout = setTimeout(type, typingSpeed);
			} else {
				headerAnimationTimeout = setTimeout(deleteEffect, delayAfterTyping);
			}
		};
		type();
	}

	function deleteEffect() {
		let i = fullText.length;
		const del = () => {
			if (i > 0) {
				animatedText = animatedText.slice(0, -1);
				i--;
				headerAnimationTimeout = setTimeout(del, deletingSpeed);
			} else {
				headerAnimationTimeout = setTimeout(typeEffect, 500);
			}
		};
		del();
	}

	onMount(() => {
		inputElement?.focus();
		addOutput(welcomeMessage);
		headerAnimationTimeout = setTimeout(typeEffect, 1000);
	});

	onDestroy(() => {
		clearTimeout(headerAnimationTimeout);
	});

	async function scrollToBottom() {
		await tick();
		terminalElement?.scrollTo(0, terminalElement.scrollHeight);
	}

	function addOutput(lines: string[], type: 'output' | 'error' = 'output') {
		const newLines = lines.map(text => ({ id: nextId++, type, text }));
		history = [...history, ...newLines];
		scrollToBottom();
	}

	function addCommandToHistory() {
		const historyHtml = highlightedCommandHtml.replace(/<span class="cursor-on-char">(.+?)<\/span>/g, '$1').replace('<span class="cursor-at-end"></span>', '');
		history = [...history, { id: nextId++, type: 'input', text: historyHtml }];
		commandHistory = [...commandHistory, command];
		historyIndex = commandHistory.length;
		scrollToBottom();
	}

	function processCommand() {
		const trimmedInput = command.trim();
		if (!trimmedInput) return;

		addCommandToHistory(); 

		const { command: mainCommand, args } = parseCommand(trimmedInput);
		const commandDef = commands[mainCommand];
		
		if (!commandDef) {
			addOutput([`Command not found: ${mainCommand}`], 'error');
			command = '';
			return;
		}

		const hasArgs = Object.keys(args).length > 0;

		if (mainCommand === 'experience') {
			if (args.help) {
				const helpContent = commandDef.subCommands?.['help']?.output;
				if (helpContent) {
					addOutput(helpContent);
				} else {
					addOutput([`Usage: experience --company "COMPANY_NAME" or experience --list`], 'error');
				}
			} else if (args.list) {
				const companyList = Object.values(commandDef.subCommands || {})
					.filter(sub => sub.originalName.toLowerCase() !== 'help')
					.map(sub => `  - <span class="text-cyan-400">${sub.originalName}</span>`);
				
				if (companyList.length > 0) {
					addOutput(['Available companies:', ...companyList]);
				} else {
					addOutput(['No companies found.']);
				}
			} else if (args.company && typeof args.company === 'string') {
				const companyKey = args.company.toLowerCase().replace(/[^a-z0-9]/g, '');
				const subCommand = commandDef.subCommands?.[companyKey];
				if (subCommand) {
					addOutput(subCommand.output);
				} else {
					addOutput([`Experience for company "${args.company}" not found.`], 'error');
				}
			} else if (hasArgs) {
				addOutput([`Invalid flag for command '${mainCommand}'.`], 'error');
				addOutput([`Run 'experience --help' for available flags.`]);
			} else {
				if (commandDef.output) addOutput(commandDef.output);
			}
		} else {
			if (hasArgs) {
				addOutput([`Command '${mainCommand}' does not accept any flags.`], 'error');
			} else if (commandDef.execute) {
				commandDef.execute(args);
			} else if (commandDef.output) {
				addOutput(commandDef.output);
			}
		}

		command = '';
	}

	function handleSubmit() {
		processCommand();
	}

	function handleInput() {
		cursorPos = inputElement.selectionStart ?? 0;
	}

	async function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleSubmit();
			return;
		}

		if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
			e.preventDefault();
			if (e.key === 'ArrowUp') {
				if (historyIndex > 0) {
					historyIndex--;
					command = commandHistory[historyIndex];
				}
			} else { // ArrowDown
				if (historyIndex < commandHistory.length - 1) {
					historyIndex++;
					command = commandHistory[historyIndex];
				} else {
					historyIndex = commandHistory.length;
					command = '';
				}
			}
			await tick();
			const len = command.length;
			inputElement.selectionStart = inputElement.selectionEnd = len;
		}

        setTimeout(() => {
            cursorPos = inputElement.selectionStart ?? 0;
        }, 0);
	}

	function focusInput() {
		inputElement?.focus();
	}
</script>

<div class="relative w-full h-screen bg-black text-white font-mono">
	<!-- Typing Animation Text -->
	<div class="absolute top-4 right-4 text-lg z-10">
		{@html animatedText}<span class="blinking-cursor">|</span>
	</div>

	<!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_no_noninteractive_tabindex -->
	<div
		bind:this={terminalElement}
		class="w-full h-full p-4 overflow-y-auto focus:outline-none"
		onclick={focusInput}
		role="application"
		tabindex="0"
	>
		<!-- History of commands and outputs -->
		{#each history as item (item.id)}
			<div>
				{#if item.type === 'input'}
					<span class="text-green-400">$</span>
					<span class="ml-2">{@html item.text}</span>
				{:else if item.type === 'output'}
					<div class="whitespace-pre-wrap">{@html item.text}</div>
				{:else if item.type === 'error'}
					<span class="text-red-500 whitespace-pre-wrap">{item.text}</span>
				{/if}
			</div>
		{/each}

		<!-- Command input line -->
		<div class="flex items-center">
			<span class="text-green-400">$</span>
			<div class="relative flex-grow ml-2" onclick={focusInput}>
				<!-- Visible, highlighted "fake" input -->
				<div class="whitespace-pre">{@html highlightedCommandHtml}</div>
				<!-- Invisible, real input that captures typing -->
				<input
					bind:this={inputElement}
					bind:value={command}
					oninput={handleInput}
					onkeydown={handleKeyDown}
					onclick={() => cursorPos = inputElement.selectionStart ?? 0}
					type="text"
					class="absolute top-0 left-0 w-full h-full bg-transparent text-transparent caret-transparent border-none focus:outline-none focus:ring-0"
					autocomplete="off"
					spellcheck="false"
				/>
			</div>
		</div>
	</div>
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

	/* Style for the cursor when it's OVER a character */
	:global(.cursor-on-char) {
		background-color: white;
		color: black;
	}

	/* Style for the cursor when it's at the END of the line */
	:global(.cursor-at-end) {
		display: inline-block;
		width: 0.5rem; /* Adjust width as needed */
		height: 1.2rem; /* Adjust height as needed */
		background-color: white;
		position: relative;
		top: 0.2rem; /* Adjust vertical alignment */
	}
</style>
