import { RasterRenderer, hexToRGBA } from "../raster/RasterRenderer";
import { Bounds, Shape, ShapeInit } from "./Shape";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export class Rect extends Shape {
  w: number;
  h: number;

  constructor(w: number, h: number, init: ShapeInit = {}) {
    super(init);
    this.w = w;
    this.h = h;
  }

  clone() {
    return new Rect(this.w, this.h, {
      id: this.id,
      transform: { ...this.transform },
      fillStyle: this.fillStyle,
      fillOpacity: this.fillOpacity,
      strokeStyle: this.strokeStyle,
      strokeWidth: this.strokeWidth,
      strokeOpacity: this.strokeOpacity,
    });
  }

  private cornersLocal() {
    const hw = this.w / 2;
    const hh = this.h / 2;
    return [
      { x: -hw, y: -hh },
      { x:  hw, y: -hh },
      { x:  hw, y:  hh },
      { x: -hw, y:  hh },
    ];
  }

  drawRaster(r: RasterRenderer) {
    const points = this.cornersLocal().map((p) =>
      this.transformPointToDevice(p.x, p.y, r.dpr)
    );
    if (this.fillOpacity > 0) {
      r.fillPolygon(
        points,
        hexToRGBA(this.fillStyle, Math.round(clamp01(this.fillOpacity) * 255))
      );
    }
    if (this.strokeWidth > 0 && this.strokeOpacity > 0) {
      r.strokePolygon(
        points,
        hexToRGBA(
          this.strokeStyle,
          Math.round(clamp01(this.strokeOpacity) * 255)
        ),
        this.strokeWidth
      );
    }
  }

  hitTest(px: number, py: number, dpr = 1) {
    const local = this.transformPointToLocal(px, py, dpr);
    const hw = this.w / 2;
    const hh = this.h / 2;
    return local.x >= -hw && local.x <= hw && local.y >= -hh && local.y <= hh;
  }

  getBounds(dpr = 1): Bounds {
    const pts = this.cornersLocal().map((p) =>
      this.transformPointToDevice(p.x, p.y, dpr)
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
    const hw = this.w / 2;
    const hh = this.h / 2;
    return { minX: -hw, minY: -hh, maxX: hw, maxY: hh };
  }

  toJSON() {
    return {
      type: "Rect",
      w: this.w,
      h: this.h,
      transform: { ...this.transform },
      fillStyle: this.fillStyle,
      fillOpacity: this.fillOpacity,
      strokeStyle: this.strokeStyle,
      strokeWidth: this.strokeWidth,
      strokeOpacity: this.strokeOpacity,
    };
  }
}