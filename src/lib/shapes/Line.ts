import { RasterRenderer, hexToRGBA } from "../raster/RasterRenderer";
import { Bounds, Shape, ShapeInit } from "./Shape";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const distancePointToSegment = (
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) => {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
};

export class Line extends Shape {
  ax: number;
  ay: number;
  bx: number;
  by: number;

  constructor(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    init: ShapeInit = {},
  ) {
    super(init);
    this.ax = ax;
    this.ay = ay;
    this.bx = bx;
    this.by = by;
  }

  clone() {
    return new Line(this.ax, this.ay, this.bx, this.by, {
      id: this.id,
      transform: { ...this.transform },
      fillStyle: this.fillStyle,
      fillOpacity: this.fillOpacity,
      strokeStyle: this.strokeStyle,
      strokeWidth: this.strokeWidth,
      strokeOpacity: this.strokeOpacity,
    });
  }

  drawRaster(r: RasterRenderer) {
    if (this.strokeWidth <= 0 || this.strokeOpacity <= 0) return;
    const a = this.transformPointToDevice(this.ax, this.ay, r.dpr);
    const b = this.transformPointToDevice(this.bx, this.by, r.dpr);
    r.strokeLine(
      a.x,
      a.y,
      b.x,
      b.y,
      hexToRGBA(
        this.strokeStyle,
        Math.round(clamp01(this.strokeOpacity) * 255),
      ),
      this.strokeWidth,
    );
  }

  hitTest(px: number, py: number, dpr = 1) {
    const local = this.transformPointToLocal(px, py, dpr);
    const dist = distancePointToSegment(
      local.x,
      local.y,
      this.ax,
      this.ay,
      this.bx,
      this.by,
    );
    const threshold = Math.max(this.strokeWidth / 2, 2);
    return dist <= threshold;
  }

  getBounds(dpr = 1): Bounds {
    const a = this.transformPointToDevice(this.ax, this.ay, dpr);
    const b = this.transformPointToDevice(this.bx, this.by, dpr);
    return {
      minX: Math.min(a.x, b.x),
      minY: Math.min(a.y, b.y),
      maxX: Math.max(a.x, b.x),
      maxY: Math.max(a.y, b.y),
    };
  }

  getLocalBounds(): Bounds {
    return {
      minX: Math.min(this.ax, this.bx),
      minY: Math.min(this.ay, this.by),
      maxX: Math.max(this.ax, this.bx),
      maxY: Math.max(this.ay, this.by),
    };
  }

  toJSON() {
    return {
      type: "Line",
      ax: this.ax,
      ay: this.ay,
      bx: this.bx,
      by: this.by,
      transform: { ...this.transform },
      strokeStyle: this.strokeStyle,
      strokeWidth: this.strokeWidth,
      strokeOpacity: this.strokeOpacity,
    };
  }
}