"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  Trash2,
  Calculator as CalcIcon,
  X,
  MoveHorizontal,
  MoveVertical,
  Send,
} from "lucide-react";
import dynamic from "next/dynamic";

// Lazy load existing WindLoadingCalculator (keeps bundle smaller)
const WindLoadingCalculator = dynamic(
  () =>
    import("@/components/calculators/WindLoadingCalculator").then(
      (m) => m.WindLoadingCalculator
    ),
  { ssr: false }
);

type WidgetType = "wind";

type WidgetInstance = {
  id: string;
  type: WidgetType;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
};

const WIDGET_MIN_W = 320;
const WIDGET_MIN_H = 240;
const WIDGET_CHROME_H = 56; // titlebar + body padding (tweak if needed)

// Big "desk" size for scrollable workspace
const DESK_W = 2600;
const DESK_H = 1800;

export function Workspace() {
  // ---------- Canvas state ----------
  const [widgets, setWidgets] = useState<WidgetInstance[]>([]);
  const [zCounter, setZCounter] = useState(1);
  const [pickerOpen, setPickerOpen] = useState(false);

  const canvasRef = useRef<HTMLDivElement | null>(null);       // outer scroll container
  const canvasInnerRef = useRef<HTMLDivElement | null>(null);  // big desk area

  // ---------- AI panel (scaffold only) ----------
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; text: string }[]
  >([]);
  const [pending, setPending] = useState("");
  const onSend = () => {
    if (!pending.trim()) return;
    setMessages((m) => [...m, { role: "user", text: pending.trim() }]);
    setPending("");
    // TODO: wire to your AI route later
  };

  // ---------- Spawn widgets ----------
  const spawnWidget = useCallback(
    (type: WidgetType) => {
      const id = `w_${crypto.randomUUID()}`;

      // Try to spawn near the top-left of the current view inside the scrollable canvas
      const scrollLeft = canvasRef.current?.scrollLeft ?? 0;
      const scrollTop = canvasRef.current?.scrollTop ?? 0;

      // Ensure the widget spawns within the desk bounds
      const baseX = Math.min(DESK_W - 600, scrollLeft + 120 + Math.random() * 200);
      const baseY = Math.min(DESK_H - 480, scrollTop + 100 + Math.random() * 160);

      setWidgets((prev) => [
        ...prev,
        { id, type, x: baseX, y: baseY, w: 520, h: 420, z: zCounter + 1 },
      ]);
      setZCounter((z) => z + 1);
      setPickerOpen(false);
    },
    [zCounter]
  );

  const clearAll = useCallback(() => setWidgets([]), []);

  // ---------- Drag & resize logic ----------
  const bringToFront = (id: string) => {
    setWidgets((ws) =>
      ws.map((w) => (w.id === id ? { ...w, z: zCounter + 1 } : w))
    );
    setZCounter((z) => z + 1);
  };

  const clampToDesk = (x: number, y: number, w: number, h: number) => {
    // keep widget within the big desk
    const nx = Math.max(0, Math.min(DESK_W - w, x));
    const ny = Math.max(0, Math.min(DESK_H - h, y));
    return { nx, ny };
  };

  const startDrag = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    bringToFront(id);

    const startX = e.clientX;
    const startY = e.clientY;

    const current = widgets.find((w) => w.id === id);
    if (!current) return;
    const baseX = current.x;
    const baseY = current.y;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      setWidgets((curr) =>
        curr.map((it) => {
          if (it.id !== id) return it;
          const { nx, ny } = clampToDesk(baseX + dx, baseY + dy, it.w, it.h);
          return { ...it, x: nx, y: ny };
        })
      );
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const startResize = (
    id: string,
    dir: "se" | "e" | "s",
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();
    bringToFront(id);

    const startX = e.clientX;
    const startY = e.clientY;

    const node = widgets.find((w) => w.id === id);
    if (!node) return;
    const baseW = node.w,
      baseH = node.h,
      baseX = node.x,
      baseY = node.y;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      setWidgets((curr) =>
        curr.map((it) => {
          if (it.id !== id) return it;

          let w = it.w,
            h = it.h,
            x = it.x,
            y = it.y;

          if (dir === "e" || dir === "se") w = Math.max(WIDGET_MIN_W, baseW + dx);
          if (dir === "s" || dir === "se") h = Math.max(WIDGET_MIN_H, baseH + dy);

          // Clamp size to desk edges
          w = Math.min(w, DESK_W - baseX);
          h = Math.min(h, DESK_H - baseY);

          // re-clamp position too (shouldn't change here, but keep consistent)
          const clamped = clampToDesk(x, y, w, h);
          return { ...it, w, h, x: clamped.nx, y: clamped.ny };
        })
      );
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // helper to set widget height from inner content
  const autoResize = useCallback((id: string, contentHeight: number) => {
    setWidgets((curr) =>
      curr.map((w) =>
        w.id === id
          ? {
              ...w,
              h: Math.max(WIDGET_MIN_H, Math.min(contentHeight + WIDGET_CHROME_H, DESK_H - w.y)),
            }
          : w
      )
    );
  }, []);

  const removeWidget = (id: string) => {
    setWidgets((ws) => ws.filter((w) => w.id !== id));
  };

  // ---------- Renderers ----------
  const renderWidgetBody = useCallback(
    (w: WidgetInstance) => {
      switch (w.type) {
        case "wind":
          return <WindLoadingCalculator onAutoSize={(h) => autoResize(w.id, h)} />;
        default:
          return <div>Unknown widget</div>;
      }
    },
    [autoResize]
  );

  const calculatorList = useMemo(
    () => [
      {
        key: "wind" as const,
        title: "Wind Loading Calculator",
        description: "AS/NZS 1170.2 site wind speed",
      },
      // Add more later (beam deflection, load combos, etc.)
    ],
    []
  );

  return (
    <div className="ws-root">
      {/* LEFT: canvas area */}
      <section className="ws-left">
        <header className="ws-toolbar">
          <div className="ws-brand">Calqura | v1.2</div>

          <div className="ws-btn-group">
            <button className="ws-btn danger" onClick={clearAll} title="Clear all">
              <Trash2 size={18} />
              <span>Clear</span>
            </button>

            <button
              className="ws-btn"
              onClick={() => setPickerOpen(v => !v)}
              title="Add calculator"
            >
              <CalcIcon size={18} />
              <span>Calculators</span>
            </button>
          </div>
        </header>


        {pickerOpen && (
          <div className="ws-picker">
            <div className="ws-picker-head">
              <strong>Choose a calculator</strong>
              <button
                className="icon-btn"
                onClick={() => setPickerOpen(false)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <ul className="ws-picker-list">
              {calculatorList.map((c) => (
                <li key={c.key}>
                  <div className="ws-picker-item">
                    <div className="ws-picker-meta">
                      <div className="title">{c.title}</div>
                      <div className="desc">{c.description}</div>
                    </div>
                    <button className="ws-btn" onClick={() => spawnWidget(c.key)}>
                      Add
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* SCROLLABLE CANVAS */}
        <div className="ws-canvas" ref={canvasRef}>
          <div
            className="ws-canvas-inner"
            ref={canvasInnerRef}
            style={{ width: DESK_W, height: DESK_H }}
          >
            {widgets.map((w) => (
              <div
                key={w.id}
                className="ws-widget"
                style={{
                  left: w.x,
                  top: w.y,
                  width: w.w,
                  height: w.h,
                  zIndex: w.z,
                }}
                onMouseDown={() => bringToFront(w.id)}
              >
                <div
                  className="ws-widget-titlebar"
                  onMouseDown={(e) => startDrag(w.id, e)}
                >
                  <div className="left">
                    <MoveHorizontal size={14} />
                    <MoveVertical size={14} />
                    <span className="title">
                      {w.type === "wind" ? "Wind Loading Calculator" : w.type}
                    </span>
                  </div>
                  <button
                    className="icon-btn"
                    onClick={() => removeWidget(w.id)}
                    aria-label="Close"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="ws-widget-body">{renderWidgetBody(w)}</div>

                {/* resizers */}
                <div
                  className="ws-resizer e"
                  onMouseDown={(e) => startResize(w.id, "e", e)}
                />
                <div
                  className="ws-resizer s"
                  onMouseDown={(e) => startResize(w.id, "s", e)}
                />
                <div
                  className="ws-resizer se"
                  onMouseDown={(e) => startResize(w.id, "se", e)}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RIGHT: AI assistant (scaffold only) */}
      <aside className="ws-right">
        <header className="ws-ai-head">
          <div>
            <div className="h1">AI Assistant</div>
            <div className="muted">
              StructuraCalc AU • Fine-tuned for AU structural standards (placeholder)
            </div>
          </div>
        </header>

        <div className="ws-ai-body">
          {messages.length === 0 ? (
            <div className="ws-ai-empty">
              Ask a question about wind regions, terrain categories, load combinations, etc.
            </div>
          ) : (
            <div className="ws-ai-messages">
              {messages.map((m, i) => (
                <div key={i} className={`msg ${m.role}`}>
                  {m.text}
                </div>
              ))}
            </div>
          )}
        </div>

        <footer className="ws-ai-input">
          <input
            value={pending}
            onChange={(e) => setPending(e.target.value)}
            placeholder="Type a prompt..."
          />
          <button onClick={onSend} aria-label="Send">
            <Send size={18} />
          </button>
        </footer>
      </aside>

    </div>
  );
}

export default Workspace;