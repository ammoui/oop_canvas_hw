import {
  Line,
  Oval,
  Rect,
  Triangle,
  QuadraticBezier,
  CubicBezier,
  PathBezier,
  Shape,
} from "./shapes";

export function createDemoScene(): Shape[] {
  const rect = new Rect(320, 280, {
    fillStyle: "#1e40af",
    fillOpacity: 1,
    strokeStyle: "#111827",
    strokeWidth: 2,
    strokeOpacity: 1,
  });
  rect.transform.x = 300;
  rect.transform.y = 280;

  const oval = new Oval(110, 70, {
    fillStyle: "#ef4444",
    fillOpacity: 0.55,
  });
  oval.transform.x = 360;
  oval.transform.y = 320;

  const lineA = new Line(80, 80, 520, 260, {
    strokeStyle: "#ffffff",
    strokeWidth: 1,
    strokeOpacity: 1,
  });
  const lineB = new Line(80, 260, 520, 80, {
    strokeStyle: "#ffffff",
    strokeWidth: 1,
    strokeOpacity: 1,
  });

  const path = [
    { x: 120, y: 520 },
    { x: 220, y: 480 },
    { x: 320, y: 560 },
    { x: 440, y: 500 },
    { x: 560, y: 560 },
  ];
  const pathLines = path.slice(0, -1).map(
    (p, i) =>
      new Line(p.x, p.y, path[i + 1].x, path[i + 1].y, {
        strokeStyle: "#22c55e",
        strokeWidth: 10,
        strokeOpacity: 1,
      }),
  );

  const tri = new Triangle(600, 120, 700, 220, 520, 240, {
    fillStyle: "#f59e0b",
    fillOpacity: 1,
    strokeStyle: "#111827",
    strokeWidth: 2,
  });

  const quad = new QuadraticBezier(120, 120, 200, 30, 280, 120, {
    strokeStyle: "#111827",
    strokeWidth: 3,
  });

  const cubic = new CubicBezier(120, 200, 180, 60, 260, 340, 320, 200, {
    strokeStyle: "#111827",
    strokeWidth: 3,
  });

  const pathb = new PathBezier(
    [
      { x: 80, y: 420 },
      { x: 160, y: 360 },
      { x: 240, y: 480 },
      { x: 320, y: 420 },
    ],
    "catmull",
    false,
    { strokeStyle: "#111827", strokeWidth: 2 },
  );

  return [rect, oval, lineA, lineB, ...pathLines, tri, quad, cubic, pathb];
}
