export type RGBA = { r: number; g: number; b: number; a: number };

export type LineAlg = "bresenham" | "wu";

export function clampByte(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(255, Math.round(v)));
}

export function hexToRGBA(hex: string, alpha = 255): RGBA {
  let s = hex.trim();
  if (s.startsWith("#")) s = s.slice(1);

  if (s.length === 3) {
    const r = parseInt(s[0] + s[0], 16);
    const g = parseInt(s[1] + s[1], 16);
    const b = parseInt(s[2] + s[2], 16);
    return { r, g, b, a: clampByte(alpha) };
  }

  if (s.length === 6) {
    const r = parseInt(s.slice(0, 2), 16);
    const g = parseInt(s.slice(2, 4), 16);
    const b = parseInt(s.slice(4, 6), 16);
    return { r, g, b, a: clampByte(alpha) };
  }

  throw new Error(`Invalid HEX color: ${hex}`);
}

export class RasterRenderer {
  private ctx: CanvasRenderingContext2D;
  private imageData: ImageData | null = null;
  private buf!: Uint8ClampedArray;

  width = 0;
  height = 0;
  dpr = 1;

  private canvas: HTMLCanvasElement;
  private _onWindowResize: () => void;
  private lineAlg: LineAlg = "bresenham";

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) {
      throw new Error("No 2D context");
    }
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;

    this._onWindowResize = () => this.resize();
    window.addEventListener("resize", this._onWindowResize);
    this.resize();
  }

  dispose() {
    window.removeEventListener("resize", this._onWindowResize);
  }

  setLineAlgorithm(a: LineAlg) {
    this.lineAlg = a;
  }

  getLineAlgorithm(): LineAlg {
    return this.lineAlg;
  }

  drawLine(x0: number, y0: number, x1: number, y1: number, color: RGBA) {
    if (this.lineAlg === "wu") {
      this.drawLineWu(x0, y0, x1, y1, color);
    } else {
      this.drawLineBrassenham(x0, y0, x1, y1, color);
    }
  }

  private idx(x: number, y: number): number {
    return (y * this.width + x) * 4;
  }

  setPixel(x: number, y: number, color: RGBA) {
    x = x | 0;
    y = y | 0;
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;

    const a = clampByte(color.a);
    if (a <= 0) return;
    if (a < 255) {
      this.blendPixel(x, y, { ...color, a }, 1);
      return;
    }

    const i = this.idx(x, y);
    this.buf[i] = clampByte(color.r);
    this.buf[i + 1] = clampByte(color.g);
    this.buf[i + 2] = clampByte(color.b);
    this.buf[i + 3] = 255;
  }

  private blendPixel(x: number, y: number, color: RGBA, alphaFactor = 1) {
    x = x | 0;
    y = y | 0;
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = this.idx(x, y);

    const dstR = this.buf[i];
    const dstG = this.buf[i + 1];
    const dstB = this.buf[i + 2];
    const dstA = this.buf[i + 3] / 255;

    let srcA = (clampByte(color.a) / 255) * alphaFactor;
    if (srcA <= 0) return;
    if (srcA > 1) srcA = 1;

    const outA = srcA + dstA * (1 - srcA);
    if (outA <= 0) {
      this.buf[i] = 0;
      this.buf[i + 1] = 0;
      this.buf[i + 2] = 0;
      this.buf[i + 3] = 0;
      return;
    }

    const srcR = clampByte(color.r);
    const srcG = clampByte(color.g);
    const srcB = clampByte(color.b);

    const outR = (srcR * srcA + dstR * dstA * (1 - srcA)) / outA;
    const outG = (srcG * srcA + dstG * dstA * (1 - srcA)) / outA;
    const outB = (srcB * srcA + dstB * dstA * (1 - srcA)) / outA;

    this.buf[i] = clampByte(outR);
    this.buf[i + 1] = clampByte(outG);
    this.buf[i + 2] = clampByte(outB);
    this.buf[i + 3] = clampByte(outA * 255);
  }

  resize() {
    const nextDpr = window.devicePixelRatio || 1;
    const cssW = this.canvas.clientWidth || 0;
    const cssH = this.canvas.clientHeight || 0;
    const nextW = Math.max(1, Math.floor(cssW * nextDpr));
    const nextH = Math.max(1, Math.floor(cssH * nextDpr));

    if (
      nextW === this.width &&
      nextH === this.height &&
      nextDpr === this.dpr &&
      this.imageData
    ) {
      return;
    }

    this.dpr = nextDpr;
    this.width = nextW;
    this.height = nextH;

    this.canvas.width = nextW;
    this.canvas.height = nextH;

    this.ctx.imageSmoothingEnabled = false;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);

    this.imageData = this.ctx.createImageData(this.width, this.height);
    this.buf = this.imageData.data;
  }

  beginFrame(clear = true) {
    const expectedW = Math.max(
      1,
      Math.floor(
        (this.canvas.clientWidth || 0) * (window.devicePixelRatio || 1),
      ),
    );
    const expectedH = Math.max(
      1,
      Math.floor(
        (this.canvas.clientHeight || 0) * (window.devicePixelRatio || 1),
      ),
    );
    if (
      expectedW !== this.width ||
      expectedH !== this.height ||
      (window.devicePixelRatio || 1) !== this.dpr
    ) {
      this.resize();
    }

    if (!this.imageData) return;
    if (clear) this.buf.fill(0);
  }

  commit() {
    if (!this.imageData) return;
    this.ctx.putImageData(this.imageData, 0, 0);
  }

  drawLineBrassenham(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    color: RGBA,
  ) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);

    let dx = Math.abs(x1 - x0);
    let sx = x0 < x1 ? 1 : -1;
    let dy = -Math.abs(y1 - y0);
    let sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;

    while (true) {
      this.setPixel(x0, y0, color);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  drawLineWu(x0: number, y0: number, x1: number, y1: number, color: RGBA) {
    const ipart = (x: number) => Math.floor(x);
    const round = (x: number) => Math.round(x);
    const fpart = (x: number) => x - Math.floor(x);
    const rfpart = (x: number) => 1 - fpart(x);

    const plot = (x: number, y: number, a: number) => {
      this.blendPixel(x, y, color, a);
    };

    let steep = Math.abs(y1 - y0) > Math.abs(x1 - x0);
    if (steep) {
      [x0, y0] = [y0, x0];
      [x1, y1] = [y1, x1];
    }

    if (x0 > x1) {
      [x0, x1] = [x1, x0];
      [y0, y1] = [y1, y0];
    }

    const dx = x1 - x0;
    const dy = y1 - y0;
    const gradient = dx === 0 ? 0 : dy / dx;

    let xend = round(x0);
    let yend = y0 + gradient * (xend - x0);
    let xgap = rfpart(x0 + 0.5);
    let xpxl1 = xend;
    let ypxl1 = ipart(yend);

    if (steep) {
      plot(ypxl1, xpxl1, rfpart(yend) * xgap);
      plot(ypxl1 + 1, xpxl1, fpart(yend) * xgap);
    } else {
      plot(xpxl1, ypxl1, rfpart(yend) * xgap);
      plot(xpxl1, ypxl1 + 1, fpart(yend) * xgap);
    }

    let intery = yend + gradient;

    xend = round(x1);
    yend = y1 + gradient * (xend - x1);
    xgap = fpart(x1 + 0.5);
    let xpxl2 = xend;
    let ypxl2 = ipart(yend);

    if (steep) {
      plot(ypxl2, xpxl2, rfpart(yend) * xgap);
      plot(ypxl2 + 1, xpxl2, fpart(yend) * xgap);
    } else {
      plot(xpxl2, ypxl2, rfpart(yend) * xgap);
      plot(xpxl2, ypxl2 + 1, fpart(yend) * xgap);
    }

    for (let x = xpxl1 + 1; x <= xpxl2 - 1; x++) {
      const y = ipart(intery);
      if (steep) {
        plot(y, x, rfpart(intery));
        plot(y + 1, x, fpart(intery));
      } else {
        plot(x, y, rfpart(intery));
        plot(x, y + 1, fpart(intery));
      }
      intery += gradient;
    }
  }

  private drawHSpan(y: number, x0: number, x1: number, color: RGBA) {
    y = Math.round(y);
    if (y < 0 || y >= this.height) return;
    let start = Math.ceil(Math.min(x0, x1));
    let end = Math.floor(Math.max(x0, x1));
    if (end < 0 || start >= this.width) return;
    start = Math.max(0, start);
    end = Math.min(this.width - 1, end);
    for (let x = start; x <= end; x++) {
      this.setPixel(x, y, color);
    }
  }

  fillPolygon(points: { x: number; y: number }[], color: RGBA) {
    if (points.length < 3) return;

    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of points) {
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const yStart = Math.ceil(minY);
    const yEnd = Math.floor(maxY);

    for (let y = yStart; y <= yEnd; y++) {
      const scanY = y + 0.5;
      const xs: number[] = [];

      for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        const y1 = a.y;
        const y2 = b.y;
        const intersects =
          (y1 <= scanY && y2 > scanY) || (y2 <= scanY && y1 > scanY);
        if (!intersects) continue;

        const t = (scanY - y1) / (y2 - y1);
        const x = a.x + t * (b.x - a.x);
        xs.push(x);
      }

      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const x0 = xs[i];
        const x1 = xs[i + 1];
        this.drawHSpan(y, x0, x1, color);
      }
    }
  }

  fillCircle(cx: number, cy: number, radius: number, color: RGBA) {
    if (radius <= 0) return;
    const r = radius;
    const yStart = Math.ceil(cy - r);
    const yEnd = Math.floor(cy + r);
    const r2 = r * r;

    for (let y = yStart; y <= yEnd; y++) {
      const dy = y + 0.5 - cy;
      const inside = r2 - dy * dy;
      if (inside < 0) continue;
      const dx = Math.sqrt(inside);
      this.drawHSpan(y, cx - dx, cx + dx, color);
    }
  }

  strokeLine(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    color: RGBA,
    width = 1,
  ) {
    if (width <= 1) {
      this.drawLine(x0, y0, x1, y1, color);
      return;
    }

    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    const half = width / 2;

    if (len < 1e-6) {
      this.fillCircle(x0, y0, half, color);
      return;
    }

    const nx = -dy / len;
    const ny = dx / len;

    const p1 = { x: x0 + nx * half, y: y0 + ny * half };
    const p2 = { x: x0 - nx * half, y: y0 - ny * half };
    const p3 = { x: x1 - nx * half, y: y1 - ny * half };
    const p4 = { x: x1 + nx * half, y: y1 + ny * half };

    this.fillPolygon([p1, p2, p3, p4], color);
    this.fillCircle(x0, y0, half, color);
    this.fillCircle(x1, y1, half, color);
  }

  strokePolygon(points: { x: number; y: number }[], color: RGBA, width = 1) {
    if (points.length < 2) return;
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const a = points[i];
      const b = points[(i + 1) % n];
      this.strokeLine(a.x, a.y, b.x, b.y, color, width);
    }
    if (width > 1) {
      const half = width / 2;
      for (const p of points) {
        this.fillCircle(p.x, p.y, half, color);
      }
    }
  }
}
