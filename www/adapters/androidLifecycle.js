export function createAndroidLifecycle({
  app,
  getCheckpoint,
  saveCheckpoint,
  loadCheckpoint,
  applyCheckpoint,
  ui,
  exitApp,
  now = () => Date.now(),
  backWindowMs = 1_500
}) {
  let backgrounded = false;
  let lastBackAt = Number.NEGATIVE_INFINITY;
  const listeners = [];

  async function onAppStateChange({ isActive }) {
    if (!isActive && !backgrounded) {
      backgrounded = true;
      await saveCheckpoint(getCheckpoint());
      return;
    }
    if (isActive && backgrounded) {
      backgrounded = false;
      const loaded = await loadCheckpoint();
      if (loaded.ok) applyCheckpoint(loaded.checkpoint);
    }
  }

  async function onBackButton() {
    if (ui.closeDialog()) return { handled: 'dialog' };
    if (ui.closeTerminal()) return { handled: 'terminal' };
    const pressedAt = now();
    if (pressedAt - lastBackAt <= backWindowMs) {
      await exitApp();
      lastBackAt = Number.NEGATIVE_INFINITY;
      return { handled: 'exit' };
    }
    lastBackAt = pressedAt;
    return { handled: 'armed-exit' };
  }

  return {
    async start() {
      listeners.push(await app.addListener('appStateChange', onAppStateChange));
      listeners.push(await app.addListener('backButton', onBackButton));
    },
    async stop() {
      for (const listener of listeners.splice(0)) await listener?.remove?.();
    },
    onAppStateChange,
    onBackButton
  };
}
