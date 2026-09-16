const MODES = new Set(['split', 'market', 'terminal']);

export function createLayoutController({ root, simulation, initialMode = 'split' }) {
  if (!MODES.has(initialMode)) throw new Error(`invalid mode ${initialMode}`);
  root.dataset.mode = initialMode;
  return {
    simulation,
    get mode() { return root.dataset.mode; },
    setMode(mode) {
      if (!MODES.has(mode)) throw new Error(`invalid mode ${mode}`);
      root.dataset.mode = mode;
      return mode;
    }
  };
}
