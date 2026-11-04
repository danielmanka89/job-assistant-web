"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { MAX_ZOOM_OVER_FILL, clampCrop, drawCrop, exportCrop, exportWhole, fillZoom, type Crop, type PreparedPhoto } from "@/lib/client/photo-crop";

const PREVIEW = 288; // px, the largest the circle is shown (smaller on narrow phones); also the drawing size
const WHOLE_PREVIEW_MAX = { width: 288, height: 320 };

type Mode = "whole" | "circle";

/**
 * Lets the candidate choose how their photo is saved. "Whole photo" (the default) keeps the entire
 * picture at its own shape; the portfolio shows it standing in front of the ring. "Crop to circle"
 * frames a square: drag to move, zoom with the slider (or the mouse wheel, or +/− and the arrows).
 */
export function PhotoCropDialog({
  photo,
  saving,
  error,
  onSave,
  onCancel,
  circleOnly = false,
  title = "Your photo",
  outputSize,
}: {
  photo: ImageBitmap;
  circleOnly?: boolean; // the menu photo: crop to a circle only, no "Whole photo"
  title?: string;
  outputSize?: number; // px square for the circle crop (default: sharp enough for the portfolio)
  saving: boolean;
  error: string | null;
  onSave: (photo: PreparedPhoto) => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wholeRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode>(circleOnly ? "circle" : "whole");
  // size: the circle's on-screen width when the drag started, so moves track the finger on small phones too.
  const drag = useRef<{ id: number; x: number; y: number; size: number; crop: Crop } | null>(null);
  // The circle crop starts filled (a whole photo has its own mode now).
  const [crop, setCrop] = useState<Crop>(() => ({ zoom: fillZoom(photo), x: 0, y: 0 }));
  const [exporting, setExporting] = useState(false);
  const fill = fillZoom(photo);
  const maxZoom = fill * MAX_ZOOM_OVER_FILL;
  const wholeScale = Math.min(WHOLE_PREVIEW_MAX.width / photo.width, WHOLE_PREVIEW_MAX.height / photo.height);
  const wholeSize = { width: Math.round(photo.width * wholeScale), height: Math.round(photo.height * wholeScale) };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  // Draw at the screen's pixel density so the preview is as sharp as the saved photo.
  useEffect(() => {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    if (mode === "circle" && canvasRef.current) drawCrop(canvasRef.current, photo, crop, Math.round(PREVIEW * dpr));
    const whole = wholeRef.current;
    if (mode === "whole" && whole) {
      whole.width = Math.round(wholeSize.width * dpr);
      whole.height = Math.round(wholeSize.height * dpr);
      whole.getContext("2d")?.drawImage(photo, 0, 0, whole.width, whole.height);
    }
  });

  const update = (next: Crop) => setCrop(clampCrop(photo, next));

  function onPointerDown(e: PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const size = e.currentTarget.getBoundingClientRect().width || PREVIEW;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, size, crop };
  }
  function onPointerMove(e: PointerEvent<HTMLCanvasElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    update({ ...d.crop, x: d.crop.x + (e.clientX - d.x) / d.size, y: d.crop.y + (e.clientY - d.y) / d.size });
  }
  function onKeyDown(e: KeyboardEvent<HTMLCanvasElement>) {
    const step = 0.02;
    const moves: Record<string, Partial<Crop>> = {
      ArrowLeft: { x: crop.x - step },
      ArrowRight: { x: crop.x + step },
      ArrowUp: { y: crop.y - step },
      ArrowDown: { y: crop.y + step },
      "+": { zoom: crop.zoom * 1.1 },
      "=": { zoom: crop.zoom * 1.1 },
      "-": { zoom: crop.zoom / 1.1 },
    };
    if (!moves[e.key]) return;
    e.preventDefault();
    update({ ...crop, ...moves[e.key] });
  }

  async function save() {
    setExporting(true);
    try {
      onSave(await (mode === "whole" ? exportWhole(photo) : exportCrop(photo, crop, outputSize)));
    } finally {
      setExporting(false);
    }
  }

  const busy = saving || exporting;
  const fitted = crop.zoom <= 1.001;
  const filled = Math.abs(crop.zoom - fill) < 0.001 && crop.x === 0 && crop.y === 0;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="crop-title"
      onCancel={(e) => {
        e.preventDefault(); // Escape: close through onCancel so state stays in step
        if (!busy) onCancel();
      }}
      // Solid colors (not bg-white), so the dashboard's frosted-glass styling leaves this dialog crisp.
      className="m-auto w-[calc(100%-2rem)] max-w-md overflow-hidden rounded-3xl border border-white/70 bg-[#fff] p-0 text-left shadow-2xl shadow-brand-900/20 backdrop:bg-neutral-950/50 backdrop:backdrop-blur-sm dark:border-white/10 dark:bg-[#171717]"
    >
      <div className="px-6 pt-6 pb-2 sm:px-8">
        <h2 id="crop-title" className="text-xl font-semibold text-neutral-900 dark:text-white">
          {title}
        </h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {mode === "whole"
            ? "The whole picture, nothing cut off. Your portfolio shows it full size; your menu shows a small round version."
            : "Drag to move it. Zoom out to show more, or in to fill the circle."}
        </p>
        <div role="radiogroup" aria-label="How to save the photo" hidden={circleOnly} className="mt-4 grid grid-cols-2 gap-1 rounded-full bg-neutral-100 p-1 dark:bg-neutral-800">
          {(
            [
              ["whole", "Whole photo"],
              ["circle", "Crop to circle"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => setMode(value)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${mode === value ? "bg-[#fff] text-brand-700 shadow-sm dark:bg-[#262626] dark:text-brand-300" : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center px-6 py-4 sm:px-8">
        {mode === "whole" ? (
          <canvas
            ref={wholeRef}
            role="img"
            aria-label="Preview of the whole photo"
            // Up to its preview size, but never wider than the dialog (same as the circle on small phones).
            style={{ width: "100%", maxWidth: wholeSize.width, aspectRatio: `${photo.width} / ${photo.height}` }}
            className="rounded-2xl shadow-lg ring-4 ring-brand-600/80"
          />
        ) : (
          <>
            {/* Up to 288px, but never wider than the dialog: on phones under ~380px a fixed 288px circle was cut off. */}
            <div className="relative aspect-square w-full" style={{ maxWidth: PREVIEW }}>
              <canvas
                ref={canvasRef}
                tabIndex={0}
                role="img"
                aria-label="Photo preview. Drag, or use the arrow keys to move and plus or minus to zoom."
                onKeyDown={onKeyDown}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={() => (drag.current = null)}
                onPointerCancel={() => (drag.current = null)}
                onWheel={(e) => update({ ...crop, zoom: crop.zoom * (e.deltaY < 0 ? 1.06 : 1 / 1.06) })}
                className="size-full cursor-grab touch-none rounded-full shadow-lg ring-4 ring-brand-600/80 outline-none focus-visible:ring-brand-400 active:cursor-grabbing"
              />
              {/* Where the square photo's corners fall: the sidebar and portfolio show the circle. */}
              <div className="pointer-events-none absolute -inset-3 rounded-full border border-dashed border-brand-600/40" aria-hidden="true" />
            </div>

            <label className="mt-6 flex w-full items-center gap-3 text-sm font-medium text-neutral-700 dark:text-neutral-200">
              <svg viewBox="0 0 20 20" fill="currentColor" className="size-4 shrink-0 text-neutral-400" aria-hidden="true">
                <path d="M4 10a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H4.75A.75.75 0 0 1 4 10Z" />
              </svg>
              <span className="sr-only">Zoom</span>
              <input
                type="range"
                // Read as "Zoom 150%" instead of the raw 0–1000 slider position.
                aria-valuetext={`${Math.round(crop.zoom * 100)}%`}
                min={0}
                max={1000}
                // A log scale, so zooming feels even from "whole photo" to close-up.
                value={Math.round((Math.log(crop.zoom) / Math.log(maxZoom)) * 1000)}
                onChange={(e) => update({ ...crop, zoom: Math.exp((Number(e.target.value) / 1000) * Math.log(maxZoom)) })}
                className="w-full accent-brand-600"
              />
              <svg viewBox="0 0 20 20" fill="currentColor" className="size-4 shrink-0 text-neutral-400" aria-hidden="true">
                <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
              </svg>
            </label>

            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => update({ zoom: 1, x: 0, y: 0 })}
                aria-pressed={fitted}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${fitted ? "border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300" : "border-neutral-300 text-neutral-700 hover:border-neutral-400 dark:border-neutral-700 dark:text-neutral-200"}`}
              >
                Fit in circle
              </button>
              <button
                type="button"
                onClick={() => update({ zoom: fill, x: 0, y: 0 })}
                aria-pressed={filled}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${filled ? "border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300" : "border-neutral-300 text-neutral-700 hover:border-neutral-400 dark:border-neutral-700 dark:text-neutral-200"}`}
              >
                Fill circle
              </button>
            </div>
          </>
        )}

        {error && (
          <p role="alert" className="mt-4 w-full rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-neutral-100 px-6 py-5 sm:flex-row sm:justify-end sm:px-8 dark:border-neutral-800">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="button" onClick={save} loading={busy}>
          {busy ? "Saving…" : "Save photo"}
        </Button>
      </div>
    </dialog>
  );
}
