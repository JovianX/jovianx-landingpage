import { useEffect, useRef } from "react";

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
  const cy = height * 0.48 + (py - 0.5) * height * 0.03;
  const reach = Math.min(width, height) * 0.55;
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach);
  glow.addColorStop(0, "rgba(255, 236, 206, 0.22)");
  glow.addColorStop(0.28, "rgba(196, 154, 96, 0.08)");
  glow.addColorStop(1, "rgba(196, 154, 96, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  const unit = Math.min(width, height);
  const turn = still ? 0.8 : now / 1000;
  ring(ctx, width / 2, height * 0.48, unit * 0.46, unit * 0.17, -0.42, turn, 0.2, !still);
  ring(ctx, width / 2, height * 0.48, unit * 0.56, unit * 0.22, 0.55, -turn * 0.65, 0.1, false);

  if (still) return;
  const age = (now - born) / 1000;
  if (age < 2.1) {
    const progress = age / 2.1;
    const eased = 1 - (1 - progress) ** 3;
    ctx.beginPath();
    ctx.arc(width / 2, height * 0.48, eased * unit * 0.48, 0, Math.PI * 2);
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
    const born = performance.now();
    let frame = 0;

    const paint = (now: number) => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) return;
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
