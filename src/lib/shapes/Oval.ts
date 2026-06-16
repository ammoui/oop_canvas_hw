import { RasterRenderer, hexToRGBA } from "../raster/RasterRenderer";
import { Bounds, Shape, ShapeInit } from "./Shape";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export class Oval extends Shape {
  rx: number;
  ry: number;

  constructor(rx: number, ry: number, init: ShapeInit = {}) {
    super(init);
    this.rx = rx;
    this.ry = ry;
  }

  clone() {
    return new Oval(this.rx, this.ry, {
      id: this.id,
      transform: { ...this.transform },
      fillStyle: this.fillStyle,
      fillOpacity: this.fillOpacity,
      strokeStyle: this.strokeStyle,
      strokeWidth: this.strokeWidth,
      strokeOpacity: this.strokeOpacity,
    });
  }

  private buildPoints(segments = 48) {
    const pts = [] as { x: number; y: number }[];
    for (let i = 0; i < segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      pts.push({ x: this.rx * Math.cos(t), y: this.ry * Math.sin(t) });
    }
    return pts;
  }

  drawRaster(r: RasterRenderer) {
    const points = this.buildPoints().map((p) =>
      this.transformPointToDevice(p.x, p.y, r.dpr),
    );
    if (this.fillOpacity > 0) {
      r.fillPolygon(
        points,
        hexToRGBA(this.fillStyle, Math.round(clamp01(this.fillOpacity) * 255)),
      );
    }
    if (this.strokeWidth > 0 && this.strokeOpacity > 0) {
      r.strokePolygon(
        points,
        hexToRGBA(
          this.strokeStyle,
          Math.round(clamp01(this.strokeOpacity) * 255),
        ),
        this.strokeWidth,
      );
    }
  }

  hitTest(px: number, py: number, dpr = 1) {
    const local = this.transformPointToLocal(px, py, dpr);
    if (this.rx === 0 || this.ry === 0) return false;
    const nx = local.x / this.rx;
    const ny = local.y / this.ry;
    return nx * nx + ny * ny <= 1;
  }

  getBounds(dpr = 1): Bounds {
    const pts = this.buildPoints(36).map((p) =>
      this.transformPointToDevice(p.x, p.y, dpr),
    );
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    return {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    };
  }

  getLocalBounds(): Bounds {
    return { minX: -this.rx, minY: -this.ry, maxX: this.rx, maxY: this.ry };
  }

  toJSON() {
    return {
      type: "Oval",
      rx: this.rx,
      ry: this.ry,
      transform: { ...this.transform },
      fillStyle: this.fillStyle,
      fillOpacity: this.fillOpacity,
      strokeStyle: this.strokeStyle,
      strokeWidth: this.strokeWidth,
      strokeOpacity: this.strokeOpacity,
    };
  }
}
