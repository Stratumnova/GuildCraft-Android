export function createTerminalView({ root }) {
  function render(view) {
    root.replaceChildren();
    const summary = document.createElement('pre');
    summary.className = 'terminal-summary';
    summary.textContent = `SESSION ${view.sessionId}\nMINUTE ${view.gameMinute}\nACTORS ${view.actors.length}\nSTALLS ${view.stalls.length}\nTRANSACTIONS ${view.ledger.length}\nWARNINGS ${view.warnings.length}`;
    const log = document.createElement('pre');
    log.className = 'terminal-log';
    log.textContent = view.events.slice(-250).map(event => JSON.stringify(event)).join('\n');
    root.append(summary, log);
  }
  return { render };
}
