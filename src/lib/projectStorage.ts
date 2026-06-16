import {
  mkdir,
  readTextFile,
  writeTextFile,
  exists,
  BaseDirectory,
} from "@tauri-apps/plugin-fs";
import { documentDir, join } from "@tauri-apps/api/path";
import { LineAlg } from "./raster/RasterRenderer";
import { Shape } from "./shapes/Shape";
import { shapesFromJSON, shapesToJSON } from "./shapes/serialization";

const PROJECTS_REL = "VectorEngine/projects";
const INDEX_REL = "VectorEngine/index.json";
const INDEX_KEY = "vectorengine:index";
const projectKey = (id: string) => `vectorengine:project:${id}`;

const FS_OPTS = { baseDir: BaseDirectory.Document };

export type ProjectIndexEntry = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectFile = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  lineAlg: LineAlg;
  shapes: unknown[];
};

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function getProjectsFolderPath(): Promise<string> {
  const doc = await documentDir();
  return join(doc, "VectorEngine");
}

function projectRelPath(id: string): string {
  return `${PROJECTS_REL}/${id}.json`;
}

async function ensureProjectsDirFs(): Promise<void> {
  await mkdir(PROJECTS_REL, { ...FS_OPTS, recursive: true });
}

function loadIndexLocal(): ProjectIndexEntry[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? (JSON.parse(raw) as ProjectIndexEntry[]) : [];
  } catch {
    return [];
  }
}

function saveProjectLocal(project: ProjectFile) {
  localStorage.setItem(projectKey(project.id), JSON.stringify(project));
  const index = loadIndexLocal();
  const entry: ProjectIndexEntry = {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
  const idx = index.findIndex((p) => p.id === project.id);
  if (idx >= 0) index[idx] = entry;
  else index.unshift(entry);
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

function loadProjectLocal(id: string): ProjectFile | null {
  try {
    const raw = localStorage.getItem(projectKey(id));
    return raw ? (JSON.parse(raw) as ProjectFile) : null;
  } catch {
    return null;
  }
}

function pickNewerProject(
  a: ProjectFile | null,
  b: ProjectFile | null,
): ProjectFile | null {
  if (!a) return b;
  if (!b) return a;
  return new Date(a.updatedAt) >= new Date(b.updatedAt) ? a : b;
}

function mergeIndexEntries(
  ...lists: ProjectIndexEntry[][]
): ProjectIndexEntry[] {
  const map = new Map<string, ProjectIndexEntry>();
  for (const list of lists) {
    for (const entry of list) {
      const prev = map.get(entry.id);
      if (
        !prev ||
        new Date(entry.updatedAt).getTime() > new Date(prev.updatedAt).getTime()
      ) {
        map.set(entry.id, entry);
      }
    }
  }
  return Array.from(map.values()).sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

async function loadProjectFromFs(id: string): Promise<ProjectFile | null> {
  const rel = projectRelPath(id);
  if (!(await exists(rel, FS_OPTS))) return null;
  const raw = await readTextFile(rel, FS_OPTS);
  return JSON.parse(raw) as ProjectFile;
}

async function loadIndexFromFs(): Promise<ProjectIndexEntry[]> {
  if (!(await exists(INDEX_REL, FS_OPTS))) return [];
  const raw = await readTextFile(INDEX_REL, FS_OPTS);
  return JSON.parse(raw) as ProjectIndexEntry[];
}

export async function loadProjectIndex(): Promise<ProjectIndexEntry[]> {
  const local = loadIndexLocal();
  if (!isTauri()) return local;

  try {
    const fsIndex = await loadIndexFromFs();
    return mergeIndexEntries(local, fsIndex);
  } catch (err) {
    console.error("loadProjectIndex fs:", err);
    return local;
  }
}

async function writeProjectIndexFs(entries: ProjectIndexEntry[]): Promise<void> {
  await ensureProjectsDirFs();
  await writeTextFile(INDEX_REL, JSON.stringify(entries, null, 2), FS_OPTS);
}

export async function loadProject(id: string): Promise<ProjectFile | null> {
  const local = loadProjectLocal(id);
  if (!isTauri()) return local;

  try {
    const fsProject = await loadProjectFromFs(id);
    return pickNewerProject(fsProject, local);
  } catch (err) {
    console.error("loadProject fs:", err);
    return local;
  }
}

export type SaveResult = {
  ok: boolean;
  savedToDisk: boolean;
  error?: string;
};

export async function saveProject(project: ProjectFile): Promise<SaveResult> {
  saveProjectLocal(project);

  if (!isTauri()) {
    return { ok: true, savedToDisk: false };
  }

  try {
    await ensureProjectsDirFs();
    const rel = projectRelPath(project.id);
    await writeTextFile(rel, JSON.stringify(project, null, 2), FS_OPTS);

    const index = mergeIndexEntries(loadIndexLocal(), [
      {
        id: project.id,
        name: project.name,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    ]);
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
    await writeProjectIndexFs(index);

    return { ok: true, savedToDisk: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("saveProject fs:", err);
    return { ok: true, savedToDisk: false, error: message };
  }
}

export function buildProjectFile(params: {
  id: string;
  name: string;
  shapes: Shape[];
  lineAlg: LineAlg;
  createdAt?: string;
}): ProjectFile {
  const now = new Date().toISOString();
  return {
    id: params.id,
    name: params.name,
    createdAt: params.createdAt ?? now,
    updatedAt: now,
    lineAlg: params.lineAlg,
    shapes: shapesToJSON(params.shapes),
  };
}

export function restoreShapes(project: ProjectFile | null): Shape[] {
  if (!project?.shapes?.length) return [];
  return shapesFromJSON(project.shapes as Parameters<typeof shapesFromJSON>[0]);
}
