import { useEffect, useRef } from "react";
import { crestFraction, planetRadius } from "../layout";

function ring(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  tilt: number,
  turn: number,
  alpha: number,
  bead: boolean,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tilt);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(243, 238, 230, ${alpha})`;
  ctx.lineWidth = 1;
  ctx.stroke();

  if (bead) {
    const angle = turn * 0.45;
    const x = Math.cos(angle) * rx;
    const y = Math.sin(angle) * ry;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 18);
    glow.addColorStop(0, "rgba(255, 250, 240, 0.95)");
    glow.addColorStop(0.35, "rgba(214, 190, 146, 0.45)");
    glow.addColorStop(1, "rgba(214, 190, 146, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fffaf3";
    ctx.beginPath();
    ctx.arc(x, y, 2.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function draw(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  now: number,
  born: number,
  px: number,
  py: number,
  still: boolean,
) {
  ctx.clearRect(0, 0, width, height);
  const cx = width / 2 + (px - 0.5) * width * 0.03;
  const crest = height * crestFraction(width, height) + (py - 0.5) * height * 0.02;
  const reach = Math.min(width, height) * 0.46;
  const glow = ctx.createRadialGradient(cx, crest, 0, cx, crest, reach);
  glow.addColorStop(0, "rgba(255, 236, 206, 0.14)");
  glow.addColorStop(0.45, "rgba(196, 154, 96, 0.04)");
  glow.addColorStop(1, "rgba(196, 154, 96, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  const radius = planetRadius(width, height);
  const pcx = width / 2;
  const pcy = height;
  const turn = still ? 0.8 : now / 1000;
  ring(ctx, pcx, pcy, radius * 1.08, radius * 0.92, -0.1, turn, 0.16, !still);
  ring(ctx, pcx, pcy, radius * 1.24, radius * 0.8, 0.16, -turn * 0.62, 0.08, false);

  if (still) return;
  const age = Math.max(0, (now - born) / 1000);
  if (age < 2.1) {
    const progress = age / 2.1;
    const eased = 1 - (1 - progress) ** 3;
    const pulse = eased * Math.min(width, height) * 0.3;
    if (pulse <= 0) return;
    ctx.beginPath();
    ctx.arc(pcx, crest, pulse, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 248, 236, ${0.7 * (1 - progress)})`;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
}

export function Field() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointer = useRef({ x: 0.5, y: 0.46 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let born = Number.POSITIVE_INFINITY;
    let frame = 0;

    const paint = (now: number) => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) return;
      born = Math.min(born, now);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const nextWidth = Math.round(width * dpr);
      const nextHeight = Math.round(height * dpr);
      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(
        ctx,
        width,
        height,
        now,
        born,
        pointer.current.x,
        pointer.current.y,
        motion.matches,
      );
    };

    const loop = (now: number) => {
      paint(now);
      if (!motion.matches) frame = requestAnimationFrame(loop);
    };

    const onMove = (event: PointerEvent) => {
      pointer.current = {
        x: event.clientX / window.innerWidth,
        y: event.clientY / window.innerHeight,
      };
    };

    const observer = new ResizeObserver(() => paint(performance.now()));
    observer.observe(canvas);
    window.addEventListener("pointermove", onMove);
    frame = requestAnimationFrame(loop);

    const onMotion = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(loop);
    };
    motion.addEventListener("change", onMotion);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("pointermove", onMove);
      motion.removeEventListener("change", onMotion);
    };
  }, []);

  return <canvas ref={canvasRef} className="field" aria-hidden="true" />;
}
