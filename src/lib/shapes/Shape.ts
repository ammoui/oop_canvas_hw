import { mat3, Point2D } from "../math/mat3";

export type Transform = {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
};

export type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type ShapeInit = {
  id?: string;
  transform?: Partial<Transform>;
  fillStyle?: string;
  fillOpacity?: number;
  strokeStyle?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
};

let nextId = 1;

export abstract class Shape {
  id: string;
  transform: Transform;
  fillStyle: string;
  fillOpacity: number;
  strokeStyle: string;
  strokeWidth: number;
  strokeOpacity: number;

  constructor(init: ShapeInit = {}) {
    this.id = init.id ?? String(nextId++);
    this.transform = {
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      ...init.transform,
    };
    this.fillStyle = init.fillStyle ?? "#6d87ff";
    this.fillOpacity = init.fillOpacity ?? 1;
    this.strokeStyle = init.strokeStyle ?? "#111827";
    this.strokeWidth = init.strokeWidth ?? 1;
    this.strokeOpacity = init.strokeOpacity ?? 1;
  }

  // DPR-aware transforms: pass `dpr` when converting between local and device coordinates
  getLocalToDeviceMatrix(dpr = 1) {
    const t = this.transform;
    return mat3.fromTransform(
      t.x * dpr,
      t.y * dpr,
      t.rotation,
      t.scaleX * dpr,
      t.scaleY * dpr,
    );
  }

  getDeviceToLocalMatrix(dpr = 1) {
    return mat3.invert(this.getLocalToDeviceMatrix(dpr)) ?? mat3.identity();
  }

  transformPointToDevice(px: number, py: number, dpr = 1): Point2D {
    return mat3.transformPoint(this.getLocalToDeviceMatrix(dpr), px, py);
  }

  transformPointToLocal(px: number, py: number, dpr = 1): Point2D {
    return mat3.transformPoint(this.getDeviceToLocalMatrix(dpr), px, py);
  }

  getCenter(dpr = 1): Point2D {
    const b = this.getBounds(dpr);
    return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  }

  resizeFromDeviceAABB(minX: number, minY: number, maxX: number, maxY: number) {
    const local = this.getLocalBounds();
    const localW = local.maxX - local.minX;
    const localH = local.maxY - local.minY;
    const nextW = maxX - minX;
    const nextH = maxY - minY;

    const nextX = (minX + maxX) / 2;
    const nextY = (minY + maxY) / 2;

    const scaleX = localW !== 0 ? nextW / localW : this.transform.scaleX;
    const scaleY = localH !== 0 ? nextH / localH : this.transform.scaleY;

    this.transform = { ...this.transform, x: nextX, y: nextY, scaleX, scaleY };
  }

  setBounds(minX: number, minY: number, maxX: number, maxY: number) {
    this.resizeFromDeviceAABB(minX, minY, maxX, maxY);
  }

  abstract clone(): Shape;
  abstract drawRaster(r: {
    fillPolygon: Function;
    strokePolygon: Function;
    strokeLine: Function;
  }): void;
  abstract hitTest(px: number, py: number, dpr?: number): boolean;
  abstract getBounds(dpr?: number): Bounds;
  abstract getLocalBounds(): Bounds;
  abstract toJSON(): unknown;
}
