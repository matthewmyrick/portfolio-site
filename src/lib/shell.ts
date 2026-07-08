// Tiny bit of shared shell state, in its own module so both the executor and
// the command registry can touch it without an import cycle.
//
// `lastExit` follows the usual convention: 0 = success, 1 = generic error,
// 127 = command not found, 130 = interrupted (Ctrl+C). Any command that
// prints an error is considered failed.
export const shell = {
  lastExit: 0
};
