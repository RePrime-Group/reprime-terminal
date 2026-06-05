'use client';

import { useRef, useEffect } from 'react';

interface SignaturePadProps {
  /** Emits the signature PNG as a data URL on each stroke end; '' when cleared. */
  onChange: (dataUrl: string) => void;
  clearLabel: string;
  height?: number;
}

export default function SignaturePad({ onChange, clearLabel, height = 130 }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const inked = useRef(false);

  // Size the canvas backing store to its CSS box × devicePixelRatio for crisp lines.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0E3470';
    }
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    last.current = point(e);
    canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    const p = point(e);
    if (ctx && last.current) {
      ctx.beginPath();
      ctx.moveTo(last.current.x, last.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      inked.current = true;
    }
    last.current = p;
  };

  const handleUp = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    const canvas = canvasRef.current;
    if (canvas && inked.current) onChange(canvas.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    inked.current = false;
    onChange('');
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height }}
        className="w-full rounded-lg border border-[#D1D5DB] bg-white touch-none cursor-crosshair"
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerLeave={handleUp}
      />
      <div className="flex justify-end mt-1.5">
        <button
          type="button"
          onClick={clear}
          className="text-[11px] text-[#6B7280] hover:text-[#0E3470] underline underline-offset-2"
        >
          {clearLabel}
        </button>
      </div>
    </div>
  );
}
