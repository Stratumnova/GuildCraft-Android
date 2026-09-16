export function createMarketRenderer({ canvas, camera }) {
  const context = canvas.getContext('2d');
  function render(view) {
    const { width, height } = canvas;
    const cam = camera.snapshot();
    const scale = Math.min(width, height) / 72 * cam.zoom;
    const point = position => ({ x: width / 2 + (position.x - cam.x) * scale, y: height / 2 + (position.y - cam.y) * scale });
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#171913'; context.fillRect(0, 0, width, height);
    context.strokeStyle = '#30382d'; context.lineWidth = 1;
    for (let cell = 0; cell <= 64; cell += 8) {
      const a = point({ x: cell, y: 0 }), b = point({ x: cell, y: 64 });
      context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.stroke();
      const c = point({ x: 0, y: cell }), d = point({ x: 64, y: cell });
      context.beginPath(); context.moveTo(c.x, c.y); context.lineTo(d.x, d.y); context.stroke();
    }
    for (const stall of view.stalls) {
      const p = point(stall.position);
      context.fillStyle = stall.open ? '#ba8f35' : '#66563b';
      context.fillRect(p.x - 11, p.y - 8, 22, 16);
      context.fillStyle = '#f4e7bd'; context.fillText(`${stall.id} ${stall.display}/${stall.storage}`, p.x - 20, p.y - 12);
    }
    for (const actor of view.actors) {
      const p = point(actor.position);
      context.beginPath(); context.arc(p.x, p.y, 5, 0, Math.PI * 2);
      context.fillStyle = actor.traveling ? '#71c8c0' : '#d9e4d3'; context.fill();
      context.fillStyle = '#fff'; context.fillText(actor.id, p.x + 7, p.y + 4);
    }
  }
  return { render };
}
