import { describe, it, expect } from "vitest";
import { Rect } from "./Rect";
import { Line } from "./Line";
import { Oval } from "./Oval";

describe("Rect hitTest", () => {
  it("detects points inside and outside", () => {
    const rect = new Rect(80, 40);
    expect(rect.hitTest(10, -5)).toBe(true);
    expect(rect.hitTest(50, 0)).toBe(false);
  });

  it("computes device bounds from transform", () => {
    const rect = new Rect(80, 40);
    rect.transform.x = 100;
    rect.transform.y = 50;
    const b = rect.getBounds();
    expect(b.minX).toBe(60);
    expect(b.maxX).toBe(140);
    expect(b.minY).toBe(30);
    expect(b.maxY).toBe(70);
  });
});

describe("Line hitTest", () => {
  it("checks distance to segment", () => {
    const line = new Line(0, 0, 100, 0, { strokeWidth: 4 });
    expect(line.hitTest(50, 1)).toBe(true);
    expect(line.hitTest(50, 10)).toBe(false);
  });

  it("computes bounds for endpoints", () => {
    const line = new Line(-10, -5, 30, 15);
    line.transform.x = 5;
    line.transform.y = -5;
    const b = line.getBounds();
    expect(b.minX).toBe(-5);
    expect(b.maxX).toBe(35);
    expect(b.minY).toBe(-10);
    expect(b.maxY).toBe(10);
  });
});

describe("Oval hitTest", () => {
  it("uses ellipse equation", () => {
    const oval = new Oval(60, 30);
    expect(oval.hitTest(30, 15)).toBe(true);
    expect(oval.hitTest(120, 60)).toBe(false);
  });

  it("computes device bounds from transform", () => {
    const oval = new Oval(20, 10);
    oval.transform.x = 5;
    oval.transform.y = -5;
    const b = oval.getBounds();
    expect(b.minX).toBeCloseTo(-15, 5);
    expect(b.maxX).toBeCloseTo(25, 5);
    expect(b.minY).toBeCloseTo(-15, 5);
    expect(b.maxY).toBeCloseTo(5, 5);
  });
});
