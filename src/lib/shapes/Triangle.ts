import { RasterRenderer, hexToRGBA } from "../raster/RasterRenderer";
import { Bounds, Shape, ShapeInit } from "./Shape";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export class Triangle extends Shape {
  pts: { x: number; y: number }[];

  constructor(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    init: ShapeInit = {},
  ) {
    const cx = (x1 + x2 + x3) / 3;
    const cy = (y1 + y2 + y3) / 3;
    super({ ...init, transform: { ...(init.transform ?? {}), x: cx, y: cy } });
    this.pts = [
      { x: x1 - cx, y: y1 - cy },
      { x: x2 - cx, y: y2 - cy },
      { x: x3 - cx, y: y3 - cy },
    ];
  }

  clone() {
    const p = this.pts;
    return new Triangle(
      p[0].x + this.transform.x,
      p[0].y + this.transform.y,
      p[1].x + this.transform.x,
      p[1].y + this.transform.y,
      p[2].x + this.transform.x,
      p[2].y + this.transform.y,
      {
        id: this.id,
        transform: { ...this.transform },
        fillStyle: this.fillStyle,
        fillOpacity: this.fillOpacity,
        strokeStyle: this.strokeStyle,
        strokeWidth: this.strokeWidth,
        strokeOpacity: this.strokeOpacity,
      },
    );
  }

  drawRaster(r: RasterRenderer) {
    const pts = this.pts.map((p) =>
      this.transformPointToDevice(p.x, p.y, r.dpr),
    );
    if (this.fillOpacity > 0) {
      r.fillPolygon(
        pts,
        hexToRGBA(this.fillStyle, Math.round(clamp01(this.fillOpacity) * 255)),
      );
    }
    if (this.strokeWidth > 0 && this.strokeOpacity > 0) {
      r.strokePolygon(
        pts,
        hexToRGBA(
          this.strokeStyle,
          Math.round(clamp01(this.strokeOpacity) * 255),
        ),
        this.strokeWidth,
      );
    }
  }

  hitTest(px: number, py: number, dpr = 1) {
    const p = this.transformPointToLocal(px, py, dpr);
    const [a, b, c] = this.pts;
    const sign = (
      p1: { x: number; y: number },
      p2: { x: number; y: number },
      p3: { x: number; y: number },
    ) => (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
    const d1 = sign(p, a, b);
    const d2 = sign(p, b, c);
    const d3 = sign(p, c, a);
    const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
    const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(hasNeg && hasPos);
  }

  getBounds(dpr = 1): Bounds {
    const pts = this.pts.map((p) => this.transformPointToDevice(p.x, p.y, dpr));
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
    const xs = this.pts.map((p) => p.x);
    const ys = this.pts.map((p) => p.y);
    return {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    };
  }

  toJSON() {
    return {
      type: "Triangle",
      pts: this.pts.map((p) => ({
        x: p.x + this.transform.x,
        y: p.y + this.transform.y,
      })),
      transform: { ...this.transform },
      fillStyle: this.fillStyle,
      fillOpacity: this.fillOpacity,
      strokeStyle: this.strokeStyle,
      strokeWidth: this.strokeWidth,
      strokeOpacity: this.strokeOpacity,
    };
  }
}