import { RasterRenderer, hexToRGBA } from "../raster/RasterRenderer";
import { Bounds, Shape, ShapeInit } from "./Shape";
import { CubicBezier } from "./CubicBezier";

type Mode = "polyline" | "bezier" | "catmull";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export class PathBezier extends Shape {
  points: { x: number; y: number }[];
  mode: Mode;
  closed: boolean;

  constructor(
    points: { x: number; y: number }[] = [],
    mode: Mode = "polyline",
    closed = false,
    init: ShapeInit = {},
  ) {
    super(init);
    this.points = points.slice();
    this.mode = mode;
    this.closed = closed;
  }

  clone() {
    return new PathBezier(this.points.slice(), this.mode, this.closed, {
      id: this.id,
      transform: { ...this.transform },
      strokeStyle: this.strokeStyle,
      strokeWidth: this.strokeWidth,
      strokeOpacity: this.strokeOpacity,
    });
  }

  addPointLocal(pt: { x: number; y: number }, idx?: number) {
    if (idx == null) this.points.push(pt);
    else this.points.splice(idx, 0, pt);
  }

  removePoint(idx: number) {
    if (idx < 0 || idx >= this.points.length) return;
    this.points.splice(idx, 1);
  }

  catmullToBeziers(): { x: number; y: number }[][] {
    const pts = this.points;
    const n = pts.length;
    const beziers: { x: number; y: number }[][] = [];
    if (n < 2) return beziers;

    for (let i = 0; i < (this.closed ? n : n - 1); i++) {
      const p0 = pts[(i - 1 + n) % n];
      const p1 = pts[i % n];
      const p2 = pts[(i + 1) % n];
      const p3 = pts[(i + 2) % n];

      const b0 = { x: p1.x, y: p1.y };
      const b1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
      const b2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
      const b3 = { x: p2.x, y: p2.y };
      beziers.push([b0, b1, b2, b3]);
    }
    return beziers;
  }

  flattenDevicePoints(dpr = 1) {
    if (this.mode === "polyline") {
      return this.points.map((p) => this.transformPointToDevice(p.x, p.y, dpr));
    }

    const out: { x: number; y: number }[] = [];

    if (this.mode === "bezier") {
      for (let i = 0; i + 3 < this.points.length; i += 3) {
        const p0 = this.points[i];
        const p1 = this.points[i + 1];
        const p2 = this.points[i + 2];
        const p3 = this.points[i + 3];
        const cb = new CubicBezier(
          p0.x, p0.y,
          p1.x, p1.y,
          p2.x, p2.y,
          p3.x, p3.y,
          { transform: { ...this.transform } },
        );
        const seg = cb.flattenDevicePoints(40, dpr);
        for (const s of seg) out.push(s);
      }
      return out;
    }

    const beziers = this.catmullToBeziers();
    for (const b of beziers) {
      const cb = new CubicBezier(
        b[0].x, b[0].y,
        b[1].x, b[1].y,
        b[2].x, b[2].y,
        b[3].x, b[3].y,
        { transform: { ...this.transform } },
      );
      const seg = cb.flattenDevicePoints(30, dpr);
      for (const s of seg) out.push(s);
    }
    return out;
  }

  drawRaster(r: RasterRenderer) {
    const pts = this.flattenDevicePoints(r.dpr);
    if (pts.length === 0) return;
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
    const pts = this.flattenDevicePoints(dpr);
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
    const pts = this.flattenDevicePoints(dpr);
    if (pts.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
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
    if (this.points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    const xs = this.points.map((p) => p.x);
    const ys = this.points.map((p) => p.y);
    return {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    };
  }

  getControlPoints() {
    return this.points;
  }

  setControlPoint(idx: number, pt: { x: number; y: number }) {
    if (idx < 0 || idx >= this.points.length) return;
    this.points[idx] = pt;
  }

  toJSON() {
    return {
      type: "PathBezier",
      points: this.points,
      mode: this.mode,
      closed: this.closed,
      transform: { ...this.transform },
      strokeStyle: this.strokeStyle,
      strokeWidth: this.strokeWidth,
      strokeOpacity: this.strokeOpacity,
    };
  }
}