import type { CommandDef } from './commandManager.js';
import { parseCommand } from './commandParser.js';
import { addToHistory, gameState } from '../stores/terminal.js';
import { processGameInput } from './gameProcessor.js';
import { get } from 'svelte/store';

export function processCommand(
	input: string,
	commands: Record<string, CommandDef>
): void {
	const trimmedInput = input.trim();
	if (!trimmedInput) return;

	// Check if we're in a game and handle game input
	const currentGame = get(gameState);
	if (currentGame.isActive) {
		const gameHandled = processGameInput(trimmedInput);
		if (gameHandled) {
			return;
		}
	}

	const { command: mainCommand, args } = parseCommand(trimmedInput);
	const commandDef = commands[mainCommand];

	if (!commandDef) {
		addToHistory([`Command not found: ${mainCommand}`], 'error');
		return;
	}

	const hasArgs = Object.keys(args).length > 0;

	if (mainCommand === 'experience') {
		if (args.help) {
			const helpContent = commandDef.subCommands?.['help']?.output;
			if (helpContent) {
				addToHistory(helpContent);
			} else {
				addToHistory([`Usage: experience --company "COMPANY_NAME" or experience --list`], 'error');
			}
		} else if (args.list) {
			const companyList = Object.values(commandDef.subCommands || {})
				.filter((sub) => sub.originalName.toLowerCase() !== 'help')
				.map((sub) => `  - <span class="text-cyan-400">${sub.originalName}</span>`);

			if (companyList.length > 0) {
				addToHistory(['Available companies:', ...companyList]);
			} else {
				addToHistory(['No companies found.']);
			}
		} else if (args.company && typeof args.company === 'string') {
			const companyKey = args.company.toLowerCase().replace(/[^a-z0-9]/g, '');
			const subCommand = commandDef.subCommands?.[companyKey];
			if (subCommand) {
				addToHistory(subCommand.output);
			} else {
				addToHistory([`Experience for company "${args.company}" not found.`], 'error');
			}
		} else if (hasArgs) {
			addToHistory([`Invalid flag for command '${mainCommand}'.`], 'error');
			addToHistory([`Run 'experience --help' for available flags.`]);
		} else {
			if (commandDef.output) addToHistory(commandDef.output);
		}
	} else {
		if (hasArgs) {
			addToHistory([`Command '${mainCommand}' does not accept any flags.`], 'error');
		} else if (commandDef.execute) {
			commandDef.execute(args);
		} else if (commandDef.output) {
			addToHistory(commandDef.output);
		}
	}
}