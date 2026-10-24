import * as THREE from 'three';

/** One local timer texture shared by desks; only the current user's screen is shown. */
export function createDeskTimer(canvas: HTMLCanvasElement) {
  canvas.width = 512; canvas.height = 320;
  const context = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  const geometry = new THREE.PlaneGeometry(1.08, .68);
  let previous = '', disposed = false;
  return {
    createScreen() {
      const screen = new THREE.Mesh(geometry, material);
      screen.name = 'personal-desk-timer';
      screen.position.set(0, 1.65, 1.31);
      screen.rotation.y = Math.PI;
      screen.visible = false;
      return screen;
    },
    update(value: string | undefined, running: boolean) {
      if (disposed || !context) return;
      const time = value && /^\d{1,3}:[0-5]\d(?::[0-5]\d)?$/.test(value) ? value : '--:--';
      const key = `${time}:${running}`;
      if (key === previous) return;
      previous = key;
      context.fillStyle = '#102520'; context.fillRect(0, 0, 512, 320);
      context.fillStyle = '#a2c9b9'; context.textAlign = 'center';
      context.font = '24px sans-serif'; context.fillText('ZONEFLOW', 256, 70);
      context.fillStyle = '#f6f2dd'; context.font = `600 ${time.length > 6 ? 66 : 88}px monospace`;
      context.fillText(time, 256, 200);
      context.fillStyle = running ? '#91d9ac' : '#d5bd85';
      if (running) {
        context.beginPath(); context.moveTo(248, 249); context.lineTo(248, 271); context.lineTo(266, 260); context.closePath(); context.fill();
      } else { context.fillRect(247, 249, 6, 22); context.fillRect(259, 249, 6, 22); }
      texture.needsUpdate = true;
    },
    dispose() { if (disposed) return; disposed = true; texture.dispose(); material.dispose(); geometry.dispose(); },
  };
}
