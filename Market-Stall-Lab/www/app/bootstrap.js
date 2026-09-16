export async function bootstrap({ document, platform }) {
  const root = document.getElementById('app');
  if (!root) throw new Error('Market Stall Lab requires #app');
  const controller = {
    platform,
    running: false,
    start() {
      this.running = true;
      root.textContent = 'Market Stall Lab';
    }
  };
  controller.start();
  return controller;
}
