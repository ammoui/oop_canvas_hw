import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  ChevronsDown,
  ChevronsUp,
  Circle,
  MousePointer2,
  Plus,
  Square,
  Trash2,
  Minus,
  Save,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LineAlg, RasterRenderer } from "../lib/raster/RasterRenderer";
import { Oval, PathBezier, Rect, Shape } from "../lib/shapes";
import {
  buildProjectFile,
  getProjectsFolderPath,
  loadProject,
  restoreShapes,
  saveProject,
} from "../lib/projectStorage";
import { createDemoScene } from "../lib/demoScene";

type Tool = "select" | "rect" | "oval";

type InteractionMode =
  | "idle"
  | "select"
  | "move"
  | "resize"
  | "rotate"
  | "editPoints";

type HoverTarget =
  | { kind: "rotate" }
  | { kind: "corner"; idx: number }
  | { kind: "controlPoint"; idx: number }
  | null;

const MODE_LABELS: Record<InteractionMode, string> = {
  idle: "Ожидание",
  select: "Выделение",
  move: "Перемещение",
  resize: "Изменение размеров",
  rotate: "Поворот",
  editPoints: "Редактирование точек",
};

function shapeLabel(s: Shape): string {
  const type = (s.toJSON() as { type: string }).type;
  return `${type} #${s.id}`;
}

export default function Editor() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [lineAlg, setLineAlg] = useState<LineAlg>("bresenham");
  const [tool, setTool] = useState<Tool>("select");
  const [mode, setMode] = useState<InteractionMode>("idle");
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedCpIdx, setSelectedCpIdx] = useState<number | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<RasterRenderer | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const toolRef = useRef(tool);
  const shapesRef = useRef(shapes);
  const selectedRef = useRef(selected);
  const modeRef = useRef(mode);
  const hoverRef = useRef<HoverTarget>(null);

  useEffect(() => {
    shapesRef.current = shapes;
  }, [shapes]);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        if (!id || id === "new") {
          setName("");
          setShapes(createDemoScene());
          setLineAlg("bresenham");
          setCreatedAt(null);
          setSelected(null);
          setSelectedCpIdx(null);
          return;
        }

        const project = await loadProject(id);
        if (cancelled) return;

        if (project) {
          setName(project.name);
          setLineAlg(project.lineAlg ?? "bresenham");
          setCreatedAt(project.createdAt);
          setShapes(restoreShapes(project));
        } else {
          setName(`Проект ${id.slice(-4)}`);
          setShapes([]);
          setLineAlg("bresenham");
          setCreatedAt(null);
        }
        setSelected(null);
        setSelectedCpIdx(null);
      } catch {
        if (!cancelled) {
          setShapes([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setLineAlgorithm(lineAlg);
    }
  }, [lineAlg]);

  const save = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const projectId = !id || id === "new" ? String(Date.now()) : id;
      const project = buildProjectFile({
        id: projectId,
        name: name.trim() || `Проект ${projectId.slice(-4)}`,
        shapes: shapesRef.current,
        lineAlg,
        createdAt: createdAt ?? undefined,
      });
      const result = await saveProject(project);
      setCreatedAt(project.createdAt);
      setName(project.name);

      if (result.savedToDisk) {
        try {
          const folder = await getProjectsFolderPath();
          setSaveMessage(`Сохранено на диск: ${folder}`);
        } catch {
          setSaveMessage("Проект сохранён на диск");
        }
      } else if (result.error) {
        setSaveMessage(`Сохранено локально (диск: ${result.error})`);
      } else {
        setSaveMessage("Проект сохранён (браузерный режим)");
      }

      if (!id || id === "new") {
        navigate(`/editor/${projectId}`, { replace: true });
      }
    } catch {
      setSaveMessage("Ошибка сохранения. Попробуйте ещё раз.");
    } finally {
      setSaving(false);
    }
  };

  const selectedShape = shapes.find((s) => s.id === selected) ?? null;
  const selectedIndex = selected
    ? shapes.findIndex((s) => s.id === selected)
    : -1;

  const moveLayer = (shapeId: string, delta: number) => {
    setShapes((prev) => {
      const idx = prev.findIndex((s) => s.id === shapeId);
      if (idx < 0) return prev;
      const nextIdx = idx + delta;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const next = prev.slice();
      const [item] = next.splice(idx, 1);
      next.splice(nextIdx, 0, item);
      return next;
    });
  };

  const moveLayerToEdge = (shapeId: string, toTop: boolean) => {
    setShapes((prev) => {
      const idx = prev.findIndex((s) => s.id === shapeId);
      if (idx < 0) return prev;
      const next = prev.slice();
      const [item] = next.splice(idx, 1);
      if (toTop) next.push(item);
      else next.unshift(item);
      return next;
    });
  };

  const deleteSelected = () => {
    if (!selected) return;
    setShapes((prev) => prev.filter((s) => s.id !== selected));
    setSelected(null);
    setSelectedCpIdx(null);
    setMode("idle");
  };

  const addPathPoint = () => {
    if (!selectedShape || !(selectedShape instanceof PathBezier)) return;
    const pts = selectedShape.points;
    if (pts.length === 0) {
      selectedShape.addPointLocal({ x: 0, y: 0 });
    } else if (pts.length === 1) {
      selectedShape.addPointLocal({ x: pts[0].x + 40, y: pts[0].y });
    } else {
      const a = pts[pts.length - 2];
      const b = pts[pts.length - 1];
      selectedShape.addPointLocal({
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
      });
    }
    setShapes([...shapesRef.current]);
  };

  const removePathPoint = () => {
    if (!selectedShape || !(selectedShape instanceof PathBezier)) return;
    if (selectedShape.points.length <= 2) return;
    const idx = selectedCpIdx ?? selectedShape.points.length - 1;
    selectedShape.removePoint(idx);
    setSelectedCpIdx(null);
    setShapes([...shapesRef.current]);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new RasterRenderer(canvas);
    renderer.setLineAlgorithm(lineAlg);
    rendererRef.current = renderer;

    const ro = new ResizeObserver(() => renderer.resize());
    if (containerRef.current) ro.observe(containerRef.current);
    else ro.observe(canvas);

    const pointerState = {
      dragging: false,
      dragShape: null as Shape | null,
      startX: 0,
      startY: 0,
      origX: 0,
      origY: 0,
      editingPoint: null as { shape: Shape; idx: number } | null,
      resizing: false,
      rotating: false,
      resizeCenter: null as { x: number; y: number } | null,
      origScaleX: 1,
      origScaleY: 1,
      origRotation: 0,
      rotateStartAngle: 0,
      startDist: 1,
    };

    const setInteractionMode = (m: InteractionMode) => {
      modeRef.current = m;
      setMode(m);
    };

    const getCanvasPoint = (ev: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = rendererRef.current?.dpr || window.devicePixelRatio || 1;
      return {
        x: (ev.clientX - rect.left) * dpr,
        y: (ev.clientY - rect.top) * dpr,
      };
    };

    const hitTestControlPoints = (
      sel: Shape,
      p: { x: number; y: number },
      dpr: number,
    ) => {
      const getControlPoints = (
        sel as Shape & { getControlPoints?: () => { x: number; y: number }[] }
      ).getControlPoints;
      if (!getControlPoints) return null;
      const cps = getControlPoints.call(sel);
      for (let idx = 0; idx < cps.length; idx++) {
        const dp = sel.transformPointToDevice(cps[idx].x, cps[idx].y, dpr);
        if (Math.hypot(p.x - dp.x, p.y - dp.y) <= 25 * dpr) {
          return { shape: sel, idx };
        }
      }
      return null;
    };

    const hitTestShapes = (x: number, y: number) => {
      const dpr = rendererRef.current?.dpr || 1;
      for (let i = shapesRef.current.length - 1; i >= 0; i--) {
        const s = shapesRef.current[i];
        if (s.hitTest(x, y, dpr)) return { shape: s, index: i };
      }
      return null;
    };

    const getHandles = (sel: Shape, dpr: number) => {
      const bounds = sel.getBounds(dpr);
      const center = sel.getCenter(dpr);
      const corners = [
        { x: bounds.minX, y: bounds.minY },
        { x: bounds.maxX, y: bounds.minY },
        { x: bounds.maxX, y: bounds.maxY },
        { x: bounds.minX, y: bounds.maxY },
      ];
      const rotateHandle = { x: center.x, y: bounds.minY - 20 * dpr };
      return { corners, rotateHandle };
    };

    const hitTestHandles = (sel: Shape, p: { x: number; y: number }, dpr: number) => {
      const cp = hitTestControlPoints(sel, p, dpr);
      if (cp) return { kind: "controlPoint" as const, idx: cp.idx };

      const { corners, rotateHandle } = getHandles(sel, dpr);
      if (Math.hypot(p.x - rotateHandle.x, p.y - rotateHandle.y) <= 25 * dpr) {
        return { kind: "rotate" as const };
      }
      for (let idx = 0; idx < corners.length; idx++) {
        const c = corners[idx];
        if (Math.hypot(p.x - c.x, p.y - c.y) <= 25 * dpr) {
          return { kind: "corner" as const, idx };
        }
      }
      return null;
    };

    const tryHandleRotate = (
      sel: Shape,
      p: { x: number; y: number },
      dpr: number,
      ev: PointerEvent,
    ) => {
      const { rotateHandle } = getHandles(sel, dpr);
      if (Math.hypot(p.x - rotateHandle.x, p.y - rotateHandle.y) > 25 * dpr) {
        return false;
      }
      const center = sel.getCenter(dpr);
      pointerState.rotating = true;
      pointerState.origRotation = sel.transform.rotation || 0;
      pointerState.resizeCenter = { x: center.x, y: center.y };
      pointerState.rotateStartAngle = Math.atan2(p.y - center.y, p.x - center.x);
      pointerState.dragShape = sel;
      setInteractionMode("rotate");
      (ev.target as Element)?.setPointerCapture(ev.pointerId);
      return true;
    };

    const tryHandleResize = (
      sel: Shape,
      p: { x: number; y: number },
      dpr: number,
      ev: PointerEvent,
    ) => {
      const { corners } = getHandles(sel, dpr);
      const center = sel.getCenter(dpr);
      for (const c of corners) {
        if (Math.hypot(p.x - c.x, p.y - c.y) <= 25 * dpr) {
          pointerState.resizing = true;
          pointerState.resizeCenter = { x: center.x, y: center.y };
          pointerState.origScaleX = sel.transform.scaleX || 1;
          pointerState.origScaleY = sel.transform.scaleY || 1;
          pointerState.startDist = Math.hypot(p.x - center.x, p.y - center.y);
          pointerState.dragShape = sel;
          setInteractionMode("resize");
          (ev.target as Element)?.setPointerCapture(ev.pointerId);
          return true;
        }
      }
      return false;
    };

    const addShapeAt = (p: { x: number; y: number }) => {
      const dpr = rendererRef.current?.dpr || 1;
      const x = p.x / dpr;
      const y = p.y / dpr;
      let shape: Shape;
      if (toolRef.current === "rect") {
        shape = new Rect(120, 80, {
          fillStyle: "#6d87ff",
          strokeStyle: "#111827",
          strokeWidth: 2,
        });
      } else if (toolRef.current === "oval") {
        shape = new Oval(60, 45, {
          fillStyle: "#ef4444",
          fillOpacity: 0.8,
          strokeStyle: "#111827",
          strokeWidth: 2,
        });
      } else {
        return;
      }
      shape.transform.x = x;
      shape.transform.y = y;
      setShapes((prev) => [...prev, shape]);
      setSelected(shape.id);
      setInteractionMode("select");
    };

    const onPointerDown = (ev: PointerEvent) => {
      const p = getCanvasPoint(ev);
      const dpr = rendererRef.current?.dpr || 1;

      if (selectedRef.current) {
        const sel = shapesRef.current.find((s) => s.id === selectedRef.current);
        if (sel) {
          const cpHit = hitTestControlPoints(sel, p, dpr);
          if (cpHit) {
            pointerState.editingPoint = cpHit;
            setSelectedCpIdx(cpHit.idx);
            setInteractionMode("editPoints");
            (ev.target as Element)?.setPointerCapture(ev.pointerId);
            return;
          }
          if (tryHandleRotate(sel, p, dpr, ev)) return;
          if (tryHandleResize(sel, p, dpr, ev)) return;
        }
      }

      const hit = hitTestShapes(p.x, p.y);
      if (!hit) {
        if (toolRef.current !== "select") {
          addShapeAt(p);
          return;
        }
        setSelected(null);
        setSelectedCpIdx(null);
        setInteractionMode("idle");
        return;
      }

      setSelected(hit.shape.id);
      setInteractionMode("select");

      const cpHit = hitTestControlPoints(hit.shape, p, dpr);
      if (cpHit) {
        pointerState.editingPoint = cpHit;
        setSelectedCpIdx(cpHit.idx);
        setInteractionMode("editPoints");
        (ev.target as Element)?.setPointerCapture(ev.pointerId);
        return;
      }
      if (tryHandleRotate(hit.shape, p, dpr, ev)) return;
      if (tryHandleResize(hit.shape, p, dpr, ev)) return;

      pointerState.dragging = true;
      pointerState.dragShape = hit.shape;
      pointerState.startX = p.x;
      pointerState.startY = p.y;
      pointerState.origX = hit.shape.transform.x;
      pointerState.origY = hit.shape.transform.y;
      setInteractionMode("move");
      (ev.target as Element)?.setPointerCapture(ev.pointerId);
    };

    const onPointerMove = (ev: PointerEvent) => {
      const p = getCanvasPoint(ev);
      const dpr = rendererRef.current?.dpr || 1;

      const busy =
        pointerState.dragging ||
        pointerState.resizing ||
        pointerState.rotating ||
        pointerState.editingPoint;

      if (!busy && selectedRef.current) {
        const sel = shapesRef.current.find((s) => s.id === selectedRef.current);
        hoverRef.current = sel ? hitTestHandles(sel, p, dpr) : null;
        canvas.style.cursor = hoverRef.current ? "pointer" : "default";
      } else if (!busy) {
        hoverRef.current = null;
        canvas.style.cursor = toolRef.current === "select" ? "default" : "crosshair";
      }

      if (pointerState.editingPoint) {
        const shp = pointerState.editingPoint.shape;
        const local = shp.transformPointToLocal(p.x, p.y, dpr);
        const setControlPoint = (
          shp as Shape & {
            setControlPoint?: (idx: number, pt: { x: number; y: number }) => void;
          }
        ).setControlPoint;
        setControlPoint?.call(shp, pointerState.editingPoint.idx, local);
        return;
      }

      if (
        pointerState.resizing &&
        pointerState.resizeCenter &&
        pointerState.dragShape
      ) {
        const center = pointerState.resizeCenter;
        const curDist = Math.hypot(p.x - center.x, p.y - center.y);
        const scale = curDist / (pointerState.startDist || 1e-6);
        pointerState.dragShape.transform.scaleX = Math.max(
          0.1,
          pointerState.origScaleX * scale,
        );
        pointerState.dragShape.transform.scaleY = Math.max(
          0.1,
          pointerState.origScaleY * scale,
        );
        return;
      }

      if (
        pointerState.rotating &&
        pointerState.resizeCenter &&
        pointerState.dragShape
      ) {
        const center = pointerState.resizeCenter;
        const angleNow = Math.atan2(p.y - center.y, p.x - center.x);
        pointerState.dragShape.transform.rotation =
          pointerState.origRotation + (angleNow - pointerState.rotateStartAngle);
        return;
      }

      if (pointerState.dragging && pointerState.dragShape) {
        const dx = p.x - pointerState.startX;
        const dy = p.y - pointerState.startY;
        pointerState.dragShape.transform.x = pointerState.origX + dx / dpr;
        pointerState.dragShape.transform.y = pointerState.origY + dy / dpr;
      }
    };

    const onPointerUp = (ev: PointerEvent) => {
      const hadTransform =
        pointerState.dragging ||
        pointerState.resizing ||
        pointerState.rotating ||
        pointerState.editingPoint;

      if (hadTransform) {
        setShapes([...shapesRef.current]);
      }

      pointerState.dragging = false;
      pointerState.dragShape = null;
      pointerState.editingPoint = null;
      pointerState.resizing = false;
      pointerState.rotating = false;
      if (selectedRef.current) {
        setInteractionMode("select");
      } else {
        setInteractionMode("idle");
      }
      try {
        (ev.target as Element)?.releasePointerCapture(ev.pointerId);
      } catch {}
    };

    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Delete" || ev.key === "Backspace") {
        if (!selectedRef.current) return;
        const idx = shapesRef.current.findIndex(
          (s) => s.id === selectedRef.current,
        );
        if (idx >= 0) {
          const next = shapesRef.current.slice();
          next.splice(idx, 1);
          setShapes(next);
          setSelected(null);
          setSelectedCpIdx(null);
          setInteractionMode("idle");
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    const drawHandle = (
      r: RasterRenderer,
      x: number,
      y: number,
      dpr: number,
      hovered: boolean,
    ) => {
      const outer = hovered
        ? { r: 255, g: 180, b: 0, a: 255 }
        : { r: 0, g: 120, b: 255, a: 255 };
      r.fillCircle(x, y, 10 * dpr, outer);
      r.fillCircle(x, y, 6 * dpr, { r: 255, g: 255, b: 255, a: 255 });
      r.strokeLine(x - 6 * dpr, y, x + 6 * dpr, y, { r: 0, g: 0, b: 0, a: 255 }, 1);
      r.strokeLine(x, y - 6 * dpr, x, y + 6 * dpr, { r: 0, g: 0, b: 0, a: 255 }, 1);
    };

    let raf = 0;
    const frame = () => {
      const r = rendererRef.current;
      if (r) {
        r.beginFrame(true);
        const dpr = r.dpr;
        const hover = hoverRef.current;

        for (const shape of shapesRef.current) {
          shape.drawRaster(r);
        }

        if (selectedRef.current) {
          const sel = shapesRef.current.find(
            (sh) => sh.id === selectedRef.current,
          );
          if (sel) {
            const bounds = sel.getBounds(dpr);
            const rect = [
              { x: bounds.minX, y: bounds.minY },
              { x: bounds.maxX, y: bounds.minY },
              { x: bounds.maxX, y: bounds.maxY },
              { x: bounds.minX, y: bounds.maxY },
            ];

            r.strokePolygon(rect, { r: 0, g: 120, b: 255, a: 255 }, 2);

            const getControlPoints = (
              sel as Shape & { getControlPoints?: () => { x: number; y: number }[] }
            ).getControlPoints;
            if (getControlPoints) {
              const cps = getControlPoints.call(sel);
              for (let i = 0; i < cps.length; i++) {
                const dp = sel.transformPointToDevice(cps[i].x, cps[i].y, dpr);
                const h =
                  hover?.kind === "controlPoint" && hover.idx === i;
                drawHandle(r, dp.x, dp.y, dpr, h);
              }
            }

            const { corners, rotateHandle } = getHandles(sel, dpr);
            for (let i = 0; i < corners.length; i++) {
              const h = hover?.kind === "corner" && hover.idx === i;
              drawHandle(r, corners[i].x, corners[i].y, dpr, h);
            }

            const hRot = hover?.kind === "rotate";
            drawHandle(r, rotateHandle.x, rotateHandle.y, dpr, hRot);
            r.strokeLine(
              rotateHandle.x,
              bounds.minY,
              rotateHandle.x,
              rotateHandle.y,
              { r: 0, g: 120, b: 255, a: 180 },
              1,
            );
          }
        }
        r.commit();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      rendererRef.current = null;
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [lineAlg]);

  const tools: { id: Tool; Icon: typeof MousePointer2; title: string }[] = [
    { id: "select", Icon: MousePointer2, title: "Выбор" },
    { id: "rect", Icon: Square, title: "Прямоугольник" },
    { id: "oval", Icon: Circle, title: "Эллипс" },
  ];

  const layerItems = [...shapes].reverse();

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col gap-4">
      <header className="h-12 border border-slate-800 rounded-lg px-4 flex items-center justify-between bg-slate-900">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="p-2 rounded hover:bg-slate-800 transition"
            title="Назад в галерею"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="font-semibold">
            {id && id !== "new"
              ? `Редактирование проекта №${id}`
              : "Редактирование проекта new"}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {saveMessage && (
            <div
              className={`text-sm ${saveMessage.includes("Ошибка") ? "text-red-400" : "text-green-400"}`}
            >
              {saveMessage}
            </div>
          )}
          <div className="text-sm text-sky-300">
            Режим: <span className="font-medium">{MODE_LABELS[mode]}</span>
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-3 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-60 rounded text-sm font-medium"
          >
            <Save size={16} />
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </header>

      <div className="flex flex-1 gap-4 min-h-0">
        <aside className="w-16 border border-slate-800 rounded-lg bg-slate-900 flex flex-col items-center py-3 gap-3 shrink-0">
          {tools.map(({ id: toolId, Icon, title }) => (
            <button
              key={toolId}
              onClick={() => {
                setTool(toolId);
                if (toolId !== "select") setMode("idle");
              }}
              className={`p-2 rounded transition ${
                tool === toolId ? "bg-sky-600 text-white" : "hover:bg-slate-800"
              }`}
              title={title}
            >
              <Icon size={18} />
            </button>
          ))}
        </aside>

        <main className="flex-1 bg-slate-100 rounded-lg shadow-inner border border-slate-300 p-6 text-slate-900 min-w-0">
          {loading ? (
            <div>Загрузка...</div>
          ) : (
            <div className="flex flex-col gap-4 h-full">
              <label className="flex flex-col text-sm">
                Название проекта
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 p-2 rounded border"
                />
              </label>
              <div className="flex items-center gap-3">
                <div className="text-sm text-slate-600">Алгоритм линии:</div>
                <select
                  value={lineAlg}
                  onChange={(e) => setLineAlg(e.target.value as LineAlg)}
                  className="text-sm border rounded px-2 py-1 bg-white"
                >
                  <option value="bresenham">Bresenham</option>
                  <option value="wu">Xiaolin Wu</option>
                </select>
              </div>
              <div
                ref={containerRef}
                className="flex-1 min-h-[520px] border border-slate-300 rounded bg-white overflow-hidden"
              >
                <canvas ref={canvasRef} className="w-full h-full block" />
              </div>
            </div>
          )}
        </main>

        <aside className="w-72 border border-slate-800 rounded-lg bg-slate-900 p-4 overflow-y-auto shrink-0 flex flex-col gap-4">
          <div>
            <div className="font-semibold mb-2">Слои</div>
            <p className="text-xs text-slate-500 mb-2">
              Вверху списка — верхний слой (рисуется поверх)
            </p>
            <ul className="flex flex-col gap-1 max-h-64 overflow-y-auto">
              {layerItems.map((shape, listIdx) => {
                const layerNum = shapes.length - listIdx;
                const isSelected = shape.id === selected;
                return (
                  <li key={shape.id}>
                    <button
                      onClick={() => {
                        setSelected(shape.id);
                        setSelectedCpIdx(null);
                        setMode("select");
                      }}
                      className={`w-full text-left px-2 py-1.5 rounded text-sm transition ${
                        isSelected
                          ? "bg-sky-700 text-white"
                          : "hover:bg-slate-800 text-slate-300"
                      }`}
                    >
                      <span className="text-slate-500 mr-1">{layerNum}.</span>
                      {shapeLabel(shape)}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {selected && (
            <div className="flex flex-col gap-2 border-t border-slate-800 pt-3">
              <div className="text-sm font-medium">Порядок слоя</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => moveLayer(selected, 1)}
                  disabled={selectedIndex >= shapes.length - 1}
                  className="flex items-center justify-center gap-1 px-2 py-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-sm"
                  title="На слой выше"
                >
                  <ArrowUp size={14} /> Выше
                </button>
                <button
                  onClick={() => moveLayer(selected, -1)}
                  disabled={selectedIndex <= 0}
                  className="flex items-center justify-center gap-1 px-2 py-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-sm"
                  title="На слой ниже"
                >
                  <ArrowDown size={14} /> Ниже
                </button>
                <button
                  onClick={() => moveLayerToEdge(selected, true)}
                  disabled={selectedIndex >= shapes.length - 1}
                  className="flex items-center justify-center gap-1 px-2 py-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-sm"
                  title="На самый верх"
                >
                  <ChevronsUp size={14} /> Вверх
                </button>
                <button
                  onClick={() => moveLayerToEdge(selected, false)}
                  disabled={selectedIndex <= 0}
                  className="flex items-center justify-center gap-1 px-2 py-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-sm"
                  title="На самый низ"
                >
                  <ChevronsDown size={14} /> Вниз
                </button>
              </div>

              <button
                onClick={deleteSelected}
                className="flex items-center justify-center gap-2 px-2 py-1.5 rounded bg-red-900/60 hover:bg-red-800 text-sm"
              >
                <Trash2 size={14} />
                Удалить объект
              </button>

              {selectedShape instanceof PathBezier && (
                <div className="flex flex-col gap-2 mt-1">
                  <div className="text-sm font-medium">Точки PathBezier</div>
                  <div className="flex gap-2">
                    <button
                      onClick={addPathPoint}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-sm"
                    >
                      <Plus size={14} /> Добавить
                    </button>
                    <button
                      onClick={removePathPoint}
                      disabled={selectedShape.points.length <= 2}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-sm"
                    >
                      <Minus size={14} /> Удалить
                    </button>
                  </div>
                  {selectedCpIdx != null && (
                    <div className="text-xs text-slate-400">
                      Выбрана точка #{selectedCpIdx + 1}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="border-t border-slate-800 pt-3">
            <div className="font-semibold mb-2">Свойства</div>
            <div className="text-slate-400 text-sm">Настройки появятся позже</div>
          </div>
        </aside>
      </div>
    </div>
  );
}
