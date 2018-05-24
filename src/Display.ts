/* global fx */

export default class Display {
  ctx: CanvasRenderingContext2D;
  scale: number = 8;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d');

    if (!canvas.classList.contains('display--scaled')) {
      canvas.width *= this.scale;
      canvas.height *= this.scale;
      canvas.classList.add('display--scaled');
    }
  }

  dot(x: number, y: number, on = false) {
    this.ctx.fillStyle = on ? '#fff' : '#000';

    const scaledX = x * this.scale;
    const scaledY = y * this.scale;

    const [r, g, b] = this.ctx.getImageData(scaledX, scaledY, 1, 1).data;
    const isWhite = r === 255 && g === 255 && b === 255;
    const isBlack = !isWhite;

    // 0..255
    if (isWhite && !on) {
      this.ctx.fillRect(scaledX, scaledY, this.scale, this.scale);
    } else if (isBlack && on) {
      this.ctx.fillRect(scaledX, scaledY, this.scale, this.scale);
    }
  }
}
