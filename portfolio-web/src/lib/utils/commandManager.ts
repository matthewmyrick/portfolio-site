import { addToHistory, clearHistory, startGame } from '../stores/terminal.js';

export interface SubCommand {
	output: string[];
	originalName: string;
}

export interface CommandDef {
	output?: string[];
	subCommands?: Record<string, SubCommand>;
	execute?: (args: Record<string, string | boolean>) => void;
}

export function loadCommands(): Record<string, CommandDef> {
	const commands: Record<string, CommandDef> = {};

	// Load main commands
	const mainCommandModules = import.meta.glob('/src/commands/*/content.txt', {
		query: '?raw',
		import: 'default',
		eager: true
	});

	for (const path in mainCommandModules) {
		const content = mainCommandModules[path] as string;
		const commandName = path.split('/')[3];
		if (commandName) {
			if (!commands[commandName]) commands[commandName] = {};
			commands[commandName].output = content.split('\n');
		}
	}

	// Load sub-commands
	const subCommandModules = import.meta.glob('/src/commands/*/*/content.txt', {
		query: '?raw',
		import: 'default',
		eager: true
	});

	for (const path in subCommandModules) {
		const content = subCommandModules[path] as string;
		const parts = path.split('/');
		const commandName = parts[3];
		const subCommandName = parts[4];
		const subCommandKey = subCommandName.toLowerCase().replace(/[^a-z0-9]/g, '');
		if (commandName && subCommandKey) {
			if (!commands[commandName]) commands[commandName] = {};
			if (!commands[commandName].subCommands) commands[commandName].subCommands = {};
			commands[commandName].subCommands[subCommandKey] = {
				output: content.split('\n'),
				originalName: subCommandName
			};
		}
	}

	// Add built-in clear command
	commands['clear'] = {
		execute: () => {
			clearHistory();
			addToHistory([
				'Welcome to my interactive portfolio hosted from my apartment 🏡!',
				'Type `help` to see available commands.'
			]);
		}
	};

	// Add built-in game command with proper content loading
	commands['game'] = {
		...commands['game'], // Preserve any loaded content from the file
		execute: () => {
			startGame();
			// Show the game content from the file
			if (commands['game'].output) {
				addToHistory(commands['game'].output);
			}
		}
	};

	return commands;
}