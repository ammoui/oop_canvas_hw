import { Shape, ShapeInit } from "./Shape";
import { Rect } from "./Rect";
import { Line } from "./Line";
import { Oval } from "./Oval";
import { Triangle } from "./Triangle";
import { QuadraticBezier } from "./QuadraticBezier";
import { CubicBezier } from "./CubicBezier";
import { PathBezier } from "./PathBezier";

type ShapeJson = Record<string, unknown> & { type: string };

const styleFromJson = (data: ShapeJson): ShapeInit => ({
  id: data.id as string | undefined,
  transform: data.transform as ShapeInit["transform"],
  fillStyle: data.fillStyle as string | undefined,
  fillOpacity: data.fillOpacity as number | undefined,
  strokeStyle: data.strokeStyle as string | undefined,
  strokeWidth: data.strokeWidth as number | undefined,
  strokeOpacity: data.strokeOpacity as number | undefined,
});

function normalizeType(type: string): string {
  const map: Record<string, string> = {
    rect: "Rect",
    line: "Line",
    oval: "Oval",
    triangle: "Triangle",
    quad: "QuadraticBezier",
    cubic: "CubicBezier",
    path: "PathBezier",
    Rect: "Rect",
    Line: "Line",
    Oval: "Oval",
    Triangle: "Triangle",
    QuadraticBezier: "QuadraticBezier",
    CubicBezier: "CubicBezier",
    PathBezier: "PathBezier",
  };
  return map[type] ?? type;
}

export function shapeFromJSON(data: ShapeJson): Shape | null {
  const init = styleFromJson(data);
  const type = normalizeType(data.type);

  switch (type) {
    case "Rect":
      return new Rect(data.w as number, data.h as number, init);
    case "Line":
      return new Line(
        data.ax as number,
        data.ay as number,
        data.bx as number,
        data.by as number,
        init,
      );
    case "Oval":
      return new Oval(data.rx as number, data.ry as number, init);
    case "Triangle": {
      const pts = data.pts as { x: number; y: number }[];
      return new Triangle(
        pts[0].x,
        pts[0].y,
        pts[1].x,
        pts[1].y,
        pts[2].x,
        pts[2].y,
        init,
      );
    }
    case "QuadraticBezier":
      return new QuadraticBezier(
        (data.p0 as { x: number; y: number }).x,
        (data.p0 as { x: number; y: number }).y,
        (data.p1 as { x: number; y: number }).x,
        (data.p1 as { x: number; y: number }).y,
        (data.p2 as { x: number; y: number }).x,
        (data.p2 as { x: number; y: number }).y,
        init,
      );
    case "CubicBezier":
      return new CubicBezier(
        (data.p0 as { x: number; y: number }).x,
        (data.p0 as { x: number; y: number }).y,
        (data.p1 as { x: number; y: number }).x,
        (data.p1 as { x: number; y: number }).y,
        (data.p2 as { x: number; y: number }).x,
        (data.p2 as { x: number; y: number }).y,
        (data.p3 as { x: number; y: number }).x,
        (data.p3 as { x: number; y: number }).y,
        init,
      );
    case "PathBezier":
      return new PathBezier(
        data.points as { x: number; y: number }[],
        data.mode as "polyline" | "bezier" | "catmull",
        data.closed as boolean,
        init,
      );
    default:
      return null;
  }
}

export function shapesFromJSON(items: ShapeJson[]): Shape[] {
  const result: Shape[] = [];
  for (const item of items) {
    const shape = shapeFromJSON(item);
    if (shape) result.push(shape);
  }
  return result;
}

export function shapesToJSON(shapes: Shape[]): unknown[] {
  return shapes.map((s) => s.toJSON());
}
