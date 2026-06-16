import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { createDemoScene } from "../lib/demoScene";
import {
  buildProjectFile,
  loadProjectIndex,
  ProjectIndexEntry,
  saveProject,
} from "../lib/projectStorage";

export default function Gallery() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectIndexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const list = await loadProjectIndex();
    setProjects(list);
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const addProject = async () => {
    if (creating) return;
    setCreating(true);
    setError(null);

    const newId = String(Date.now());
    const now = new Date().toISOString();
    const projectName = `Проект ${newId.slice(-4)}`;
    const entry: ProjectIndexEntry = {
      id: newId,
      name: projectName,
      createdAt: now,
      updatedAt: now,
    };

    setProjects((prev) => [entry, ...prev]);

    try {
      const project = buildProjectFile({
        id: newId,
        name: projectName,
        shapes: createDemoScene(),
        lineAlg: "bresenham",
      });
      const result = await saveProject(project);
      if (!result.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== newId));
        setError("Не удалось создать проект.");
        return;
      }
      await refresh();
      if (!result.savedToDisk && result.error) {
        setError(`Проект создан локально. Диск: ${result.error}`);
      }
    } catch {
      setProjects((prev) => prev.filter((p) => p.id !== newId));
      setError("Не удалось создать проект.");
    } finally {
      setCreating(false);
    }
  };

  const openNewDraft = () => {
    navigate("/editor/new");
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Галерея</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={addProject}
            disabled={creating}
            className="px-3 py-1 bg-sky-600 hover:bg-sky-500 disabled:opacity-60 rounded text-sm font-medium"
          >
            {creating ? "Создание..." : "Создать проект"}
          </button>
          <button
            onClick={openNewDraft}
            className="text-sm text-sky-400 hover:underline"
          >
            Открыть новый
          </button>
        </div>
      </header>

      {error && (
        <div className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-slate-400">Загрузка проектов...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {projects.length === 0 ? (
            <div className="text-slate-400">
              Проектов пока нет — нажмите «Создать проект».
            </div>
          ) : (
            projects.map((proj) => (
              <Link to={`/editor/${proj.id}`} key={proj.id} className="block">
                <motion.div
                  whileHover={{ y: -6 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className="border border-slate-800 rounded-lg p-4 bg-slate-900 hover:shadow-lg"
                >
                  <div className="font-medium text-white">{proj.name}</div>
                  <div className="text-sm text-slate-400">ID: {proj.id}</div>
                  <div className="text-xs text-slate-500 mt-2">
                    Создан: {new Date(proj.createdAt).toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-500">
                    Изменён: {new Date(proj.updatedAt).toLocaleString()}
                  </div>
                </motion.div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
