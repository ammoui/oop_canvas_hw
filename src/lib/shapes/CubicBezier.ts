import { RasterRenderer, hexToRGBA } from "../raster/RasterRenderer";
import { Bounds, Shape, ShapeInit } from "./Shape";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export class CubicBezier extends Shape {
  p0: { x: number; y: number };
  p1: { x: number; y: number };
  p2: { x: number; y: number };
  p3: { x: number; y: number };

  constructor(
    p0x: number,
    p0y: number,
    p1x: number,
    p1y: number,
    p2x: number,
    p2y: number,
    p3x: number,
    p3y: number,
    init: ShapeInit = {},
  ) {
    super(init);
    this.p0 = { x: p0x, y: p0y };
    this.p1 = { x: p1x, y: p1y };
    this.p2 = { x: p2x, y: p2y };
    this.p3 = { x: p3x, y: p3y };
  }

  clone() {
    return new CubicBezier(
      this.p0.x,
      this.p0.y,
      this.p1.x,
      this.p1.y,
      this.p2.x,
      this.p2.y,
      this.p3.x,
      this.p3.y,
      {
        id: this.id,
        transform: { ...this.transform },
        strokeStyle: this.strokeStyle,
        strokeWidth: this.strokeWidth,
        strokeOpacity: this.strokeOpacity,
      },
    );
  }

  evalLocal(t: number) {
    const u = 1 - t;
    const b0 = u * u * u;
    const b1 = 3 * u * u * t;
    const b2 = 3 * u * t * t;
    const b3 = t * t * t;
    const x = b0 * this.p0.x + b1 * this.p1.x + b2 * this.p2.x + b3 * this.p3.x;
    const y = b0 * this.p0.y + b1 * this.p1.y + b2 * this.p2.y + b3 * this.p3.y;
    return { x, y };
  }

  flattenDevicePoints(segments = 80, dpr = 1) {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const p = this.evalLocal(t);
      pts.push(this.transformPointToDevice(p.x, p.y, dpr));
    }
    return pts;
  }

  drawRaster(r: RasterRenderer) {
    const pts = this.flattenDevicePoints(120, r.dpr);
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
    const pts = this.flattenDevicePoints(140, dpr);
    let min = Infinity;
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      let t = 0;
      if (len2 > 1e-9) t = ((px - a.x) * dx + (py - a.y) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      const cx = a.x + t * dx;
      const cy = a.y + t * dy;
      const dist = Math.hypot(px - cx, py - cy);
      if (dist < min) min = dist;
    }
    const threshold = Math.max(this.strokeWidth / 2, 3);
    return min <= threshold;
  }

  getBounds(dpr = 1): Bounds {
    const pts = this.flattenDevicePoints(120, dpr);
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
    const xs = [this.p0.x, this.p1.x, this.p2.x, this.p3.x];
    const ys = [this.p0.y, this.p1.y, this.p2.y, this.p3.y];
    return {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    };
  }

  getControlPoints() {
    return [this.p0, this.p1, this.p2, this.p3];
  }

  setControlPoint(idx: number, pt: { x: number; y: number }) {
    if (idx < 0 || idx > 3) return;
    if (idx === 0) this.p0 = pt;
    if (idx === 1) this.p1 = pt;
    if (idx === 2) this.p2 = pt;
    if (idx === 3) this.p3 = pt;
  }

  toJSON() {
    return {
      type: "CubicBezier",
      p0: this.p0,
      p1: this.p1,
      p2: this.p2,
      p3: this.p3,
      transform: { ...this.transform },
      strokeStyle: this.strokeStyle,
      strokeWidth: this.strokeWidth,
      strokeOpacity: this.strokeOpacity,
    };
  }
}