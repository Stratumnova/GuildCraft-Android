export function projectTerminal(state, journal = [], filters = {}) {
  const events = journal.filter(event => {
    if (filters.actorId && event.actorId !== filters.actorId && event.buyerId !== filters.actorId && event.sellerId !== filters.actorId) return false;
    if (filters.stallId && event.stallId !== filters.stallId) return false;
    if (filters.type && event.type !== filters.type) return false;
    if (filters.warningOnly && !['INVARIANT_FAILURE', 'PURCHASE_FAILED'].includes(event.type)) return false;
    if (filters.fromMinute != null && event.gameMinute < filters.fromMinute) return false;
    if (filters.toMinute != null && event.gameMinute > filters.toMinute) return false;
    return true;
  });
  return {
    sessionId: state.sessionId,
    gameMinute: state.gameMinute,
    paused: state.paused,
    actors: Object.values(state.actors).map(actor => structuredClone(actor)),
    stalls: Object.values(state.stalls).map(stall => structuredClone(stall)),
    ledger: structuredClone(state.ledger),
    warnings: structuredClone(state.warnings),
    events
  };
}
