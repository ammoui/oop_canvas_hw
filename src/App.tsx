import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Gallery from "./screens/Gallery";
import Editor from "./screens/Editor";

const Page = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.2 }}
  >
    {children}
  </motion.div>
);

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Page><Gallery /></Page>} />
        <Route path="/editor/:id" element={<Page><Editor /></Page>} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-950 text-white flex flex-col">
        <header className="h-14 border-b border-slate-800 px-6 flex items-center justify-between">
          <div className="font-semibold">VectorEngine</div>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/" className="hover:text-sky-300">Gallery</Link>
            <Link to="/editor/new" className="hover:text-sky-300">New</Link>
          </nav>
        </header>

        <main className="p-6 flex-1">
          <AnimatedRoutes />
        </main>
      </div>
    </BrowserRouter>
  );
}