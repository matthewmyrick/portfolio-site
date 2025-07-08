<script lang="ts">
	import { onMount, tick } from 'svelte';

	// --- Component State ---
	let history: { id: number; type: 'input' | 'output' | 'error'; text: string }[] = [];
	let command: string = '';
	let commandHistory: string[] = [];
	let historyIndex: number = -1;
	let terminalElement: HTMLElement;
	let inputElement: HTMLInputElement;
	let nextId = 0;
	let commandColorClass = 'text-white'; // State for the input text color

	// --- Command Definitions ---
	// This is where you define the output for each command.
	const commands: Record<string, string[] | (() => void)> = {
		help: [
			'Available commands:',
			'  help         - Shows this help message.',
			'  about        - Displays information about me.',
			'  projects     - Lists my recent projects.',
			'  contact      - Shows how to get in touch.',
			'  dance-battle - Challenges you to a dance-off.',
			'  clear        - Clears the terminal screen.'
		],
		about: [
			'About Me:',
			'I am a creative developer with a passion for building beautiful and functional web experiences.',
			'I specialize in frontend technologies and love exploring new frameworks like Svelte.'
		],
		projects: [
			'My Projects:',
			'  Project One   - A brief description of the project goes here.',
			'  Project Two   - Explain the tech stack and your role.',
			'  Project Three - Another cool project worth mentioning.'
		],
		contact: [
			'Get in Touch:',
			'  Email: your-email@example.com',
			'  GitHub: github.com/your-username',
			'  LinkedIn: linkedin.com/in/your-profile'
		],
		'dance-battle': [
			'You have been challenged to a dance battle!',
			// This img tag will be rendered as HTML
			`<img src="https://i.pinimg.com/originals/d4/7a/4f/d47a4fef0e7426f33138ee8660f19931.gif" alt="dance battle gif" class="w-48 h-auto mt-2 rounded">`
		],
		clear: () => {
			history = [];
		}
	};

	// --- Reactive Syntax Highlighting ---
	// This block runs whenever the 'command' variable changes.
	$: {
		const trimmedCommand = command.trim().toLowerCase();
		if (trimmedCommand === '') {
			commandColorClass = 'text-white'; // Default color for empty input
		} else if (commands[trimmedCommand]) {
			commandColorClass = 'text-green-400'; // Valid command
		} else {
			commandColorClass = 'text-red-500'; // Invalid command
		}
	}

	// --- Lifecycle & Functions ---

	// Focus the input when the component mounts.
	onMount(() => {
		inputElement?.focus();
		addOutput(['Welcome to my interactive portfolio!', 'Type `help` to see available commands.']);
	});

	// Function to scroll the terminal to the bottom.
	async function scrollToBottom() {
		await tick(); // Wait for the DOM to update
		terminalElement?.scrollTo(0, terminalElement.scrollHeight);
	}

	// Add a line of output to the history.
	function addOutput(lines: string[], type: 'output' | 'error' = 'output') {
		const newLines = lines.map(text => ({ id: nextId++, type, text }));
		history = [...history, ...newLines];
		scrollToBottom();
	}

	// Add the user's command to the history.
	function addCommandToHistory(cmd: string) {
		// Use the color class from when the command was submitted
		const coloredCmd = `<span class="${commandColorClass}">${cmd}</span>`;
		history = [...history, { id: nextId++, type: 'input', text: coloredCmd }];
		commandHistory = [...commandHistory, cmd];
		historyIndex = commandHistory.length;
		scrollToBottom();
	}

	// Process the command entered by the user.
	function processCommand() {
		const trimmedCommand = command.trim().toLowerCase();
		if (!trimmedCommand) return;

		addCommandToHistory(command);

		const result = commands[trimmedCommand];

		if (result) {
			if (typeof result === 'function') {
				result();
			} else {
				addOutput(result);
			}
		} else {
			addOutput([`Command not found: ${command}`, 'Type `help` for a list of commands.'], 'error');
		}

		command = ''; // Clear the input field
	}

	// Wrapper function to handle form submission and prevent page reload.
	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		processCommand();
	}

	// Handle key presses for command history (up/down arrows).
	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			if (historyIndex > 0) {
				historyIndex--;
				command = commandHistory[historyIndex];
			}
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			if (historyIndex < commandHistory.length - 1) {
				historyIndex++;
				command = commandHistory[historyIndex];
			} else {
				historyIndex = commandHistory.length;
				command = '';
			}
		}
	}

	// Focuses the input field.
	function focusInput() {
		inputElement?.focus();
	}

	// Handles keydown on the terminal container to allow focusing the input.
	function handleTerminalKey(event: KeyboardEvent) {
		// If the user presses Enter or Space while the container is focused, focus the input.
		if (event.key === 'Enter' || event.key === ' ') {
			focusInput();
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_no_noninteractive_tabindex -->
<div
	bind:this={terminalElement}
	class="w-full h-screen bg-black text-white font-mono p-4 overflow-y-auto focus:outline-none"
	onclick={focusInput}
	onkeydown={handleTerminalKey}
	role="application"
	tabindex="0"
>
	<!-- History of commands and outputs -->
	{#each history as item (item.id)}
		<div>
			{#if item.type === 'input'}
				<span class="text-green-400">$</span>
				<!-- Use @html to render the colored span for past commands -->
				<span class="ml-2">{@html item.text}</span>
			{:else if item.type === 'output'}
				<!-- Use @html to render output that might contain HTML, like the GIF -->
				<div class="whitespace-pre-wrap">{@html item.text}</div>
			{:else if item.type === 'error'}
				<span class="text-red-500 whitespace-pre-wrap">{item.text}</span>
			{/if}
		</div>
	{/each}

	<!-- Command input line -->
	<div class="flex items-center">
		<span class="text-green-400">$</span>
		<form onsubmit={handleSubmit} class="flex-grow">
			<input
				bind:this={inputElement}
				bind:value={command}
				onkeydown={handleKeyDown}
				type="text"
				class="bg-transparent border-none w-full ml-2 focus:outline-none focus:ring-0 {commandColorClass}"
				autocomplete="off"
			/>
		</form>
	</div>
</div>

<style>
	/* You can add any additional custom styles here if needed */
</style>
