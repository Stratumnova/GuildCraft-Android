export function createMarketRenderer({ canvas, camera }) {
  const context = canvas.getContext('2d');
  function render(view, district = null) {
    const { width, height } = canvas;
    const cam = camera.snapshot();
    const worldSize = district?.size?.width ?? 64;
    const scale = Math.min(width, height) / (worldSize + 8) * cam.zoom;
    const centerX = district && !cam.followId ? district.size.width / 2 : cam.x;
    const centerY = district && !cam.followId ? district.size.height / 2 : cam.y;
    const point = position => ({ x: width / 2 + (position.x - centerX) * scale, y: height / 2 + (position.y - centerY) * scale });
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#171913'; context.fillRect(0, 0, width, height);
    if (district) {
      const zoneColors = { upper: '#283229', middle: '#302f25', lower: '#382c24' };
      for (const sector of district.sectors) {
        const topLeft = point({ x: sector.bounds.x, y: sector.bounds.y });
        const bottomRight = point({ x: sector.bounds.x + sector.bounds.width, y: sector.bounds.y + sector.bounds.height });
        context.fillStyle = zoneColors[sector.zone] ?? '#171913';
        context.fillRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
      }
    }
    context.strokeStyle = '#30382d'; context.lineWidth = 1;
    for (let cell = 0; cell <= worldSize; cell += 8) {
      const a = point({ x: cell, y: 0 }), b = point({ x: cell, y: worldSize });
      context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.stroke();
      const c = point({ x: 0, y: cell }), d = point({ x: worldSize, y: cell });
      context.beginPath(); context.moveTo(c.x, c.y); context.lineTo(d.x, d.y); context.stroke();
    }
    for (const stall of view.stalls) {
      const p = point(stall.position);
      context.fillStyle = stall.open ? '#ba8f35' : '#66563b';
      context.fillRect(p.x - 11, p.y - 8, 22, 16);
      context.fillStyle = '#f4e7bd'; context.fillText(`${stall.id} ${stall.display}/${stall.storage}`, p.x - 20, p.y - 12);
    }
    if (district) {
      for (const prop of district.props) {
        const p = point(prop.position);
        context.fillStyle = prop.condition === 'sturdy' ? '#a87e43' : '#795936';
        context.fillRect(p.x - 6, p.y - 5, 12, 10);
        context.fillStyle = '#f4e7bd'; context.fillText(prop.type.replaceAll('_', ' '), p.x - 20, p.y - 8);
      }
      for (const npc of district.npcs) {
        const p = point(npc.position);
        context.beginPath(); context.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        context.fillStyle = npc.takeoverEligible ? '#71c8c0' : '#d9e4d3'; context.fill();
        context.fillStyle = '#dce6d8'; context.fillText(npc.id, p.x + 5, p.y + 3);
      }
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
