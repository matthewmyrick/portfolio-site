import { gameState, addToHistory, endGame } from '../stores/terminal.js';
import { get } from 'svelte/store';

export function processGameInput(input: string): boolean {
	const currentGame = get(gameState);
	
	if (!currentGame.isActive) {
		return false;
	}

	const trimmedInput = input.trim().toLowerCase();

	// Exit commands
	if (trimmedInput === 'quit' || trimmedInput === 'exit') {
		endGame();
		addToHistory([
			'',
			'🚪 <span class="text-yellow-400">Game ended.</span> Thanks for playing!',
			'Type <span class="text-green-400">game</span> to play again or <span class="text-green-400">help</span> for other commands.',
			''
		]);
		return true;
	}

	// Hint command
	if (trimmedInput === 'hint') {
		const target = currentGame.targetNumber;
		let hint = '';
		
		if (target <= 25) {
			hint = 'The number is quite low (1-25)';
		} else if (target <= 50) {
			hint = 'The number is in the lower middle range (26-50)';
		} else if (target <= 75) {
			hint = 'The number is in the upper middle range (51-75)';
		} else {
			hint = 'The number is quite high (76-100)';
		}

		addToHistory([
			'💡 <span class="text-cyan-400">Hint:</span> ' + hint
		]);
		return true;
	}

	// Number guess
	const guess = parseInt(trimmedInput);
	if (isNaN(guess) || guess < 1 || guess > 100) {
		addToHistory([
			'❌ Please enter a valid number between 1 and 100, or type "quit" to exit.'
		], 'error');
		return true;
	}

	// Process the guess
	const newAttempts = currentGame.attempts + 1;
	const target = currentGame.targetNumber;

	gameState.update(state => ({
		...state,
		attempts: newAttempts
	}));

	if (guess === target) {
		// Winner!
		endGame();
		const attemptsText = newAttempts === 1 ? '1 attempt' : `${newAttempts} attempts`;
		addToHistory([
			'',
			'🎉 <span class="text-green-400">Congratulations!</span> You guessed it!',
			`The number was <span class="text-cyan-400">${target}</span> and you got it in <span class="text-yellow-400">${attemptsText}</span>!`,
			'',
			'Type <span class="text-green-400">game</span> to play again or <span class="text-green-400">help</span> for other commands.',
			''
		]);
	} else if (newAttempts >= currentGame.maxAttempts) {
		// Game over
		endGame();
		addToHistory([
			'',
			'💥 <span class="text-red-400">Game Over!</span>',
			`You've used all ${currentGame.maxAttempts} attempts. The number was <span class="text-cyan-400">${target}</span>.`,
			'',
			'Type <span class="text-green-400">game</span> to play again or <span class="text-green-400">help</span> for other commands.',
			''
		]);
	} else {
		// Continue playing
		const remaining = currentGame.maxAttempts - newAttempts;
		const remainingText = remaining === 1 ? '1 attempt' : `${remaining} attempts`;
		
		if (guess < target) {
			addToHistory([
				`📈 <span class="text-yellow-400">Too low!</span> Try a higher number. (${remainingText} remaining)`
			]);
		} else {
			addToHistory([
				`📉 <span class="text-yellow-400">Too high!</span> Try a lower number. (${remainingText} remaining)`
			]);
		}
	}

	return true;
}