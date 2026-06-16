import { describe, it, expect } from "vitest";
import { Triangle } from "./Triangle";
import { QuadraticBezier } from "./QuadraticBezier";
import { CubicBezier } from "./CubicBezier";
import { PathBezier } from "./PathBezier";

describe("Triangle", () => {
  it("hitTest inside/outside", () => {
    const t = new Triangle(0, 0, 100, 0, 50, 80);
    expect(t.hitTest(50, 20)).toBe(true);
    expect(t.hitTest(200, 200)).toBe(false);
  });
});

describe("QuadraticBezier", () => {
  it("eval and flatten", () => {
    const q = new QuadraticBezier(0, 0, 50, 100, 100, 0);
    const pts = q.flattenDevicePoints(1);
    expect(pts.length).toBe(81);
  });
});

describe("CubicBezier", () => {
  it("flatten and hitTest", () => {
    const c = new CubicBezier(0, 0, 30, 100, 70, -100, 100, 0);
    const pts = c.flattenDevicePoints(30);
    expect(pts.length).toBe(31);
    // point near middle should be close to curve
    const mid = pts[Math.floor(pts.length / 2)];
    expect(c.hitTest(mid.x, mid.y)).toBe(true);
  });
});

describe("PathBezier catmull", () => {
  it("converts and flattens", () => {
    const pts = [
      { x: 50, y: 50 },
      { x: 150, y: 10 },
      { x: 250, y: 50 },
      { x: 350, y: 10 },
    ];
    const p = new PathBezier(pts, "catmull", false);
    const flat = p.flattenDevicePoints();
    expect(flat.length).toBeGreaterThan(0);
  });
});
