export function createCamera({ x = 32, y = 32, zoom = 1, minZoom = 0.5, maxZoom = 2 } = {}) {
  const homeState = { x, y, zoom };
  let state = { ...homeState, followId: null, selectedId: null };
  const snapshot = () => ({ ...state });
  return {
    snapshot,
    select(id) { state.selectedId = id ?? null; return snapshot(); },
    follow(id) { state.followId = id ?? null; state.selectedId = id ?? state.selectedId; return snapshot(); },
    updateFollow(position) {
      if (state.followId && position) { state.x = position.x; state.y = position.y; }
      return snapshot();
    },
    pan(dx, dy) { state.followId = null; state.x += dx; state.y += dy; return snapshot(); },
    zoomBy(delta) { state.zoom = Math.max(minZoom, Math.min(maxZoom, state.zoom + delta)); return snapshot(); },
    home() { state = { ...homeState, followId: null, selectedId: null }; return snapshot(); }
  };
}
