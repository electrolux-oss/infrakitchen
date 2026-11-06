import { useEffect, useRef } from "react";

import { useColorScheme } from "@/index";

const CELL = 20; // keep in sync with the grid size in themes/snake.css
const TICK_MS = 260;
const MIN_TICK_MS = 100;
const SPEEDUP_MS = 12; // faster after every pellet
const START_LENGTH = 5;
const MAX_LENGTH = 40; // shrinks back to the start length beyond this
const OPACITY = 0.07;
const FOOD_OPACITY = 0.2;
const FOOD_COUNT = 5;

type Point = { x: number; y: number };

const DIRECTIONS: Point[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

const randomInt = (max: number) => Math.floor(Math.random() * max);

/**
 * A faint snake that wanders over the grid of the "snake" theme and eats
 * pellets. It draws over the page, header and sidebar, but below
 * dialogs, and stays off for users who prefer reduced motion.
 */
function SnakeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cols = 0;
    let rows = 0;
    let snake: Point[] = [];
    let direction = DIRECTIONS[0];
    let foods: Point[] = [];
    let tickMs = TICK_MS;

    const isSnake = (p: Point) => snake.some((s) => s.x === p.x && s.y === p.y);

    const foodIndexAt = (p: Point) =>
      foods.findIndex((f) => f.x === p.x && f.y === p.y);

    const addFood = () => {
      for (let i = 0; i < 50; i++) {
        const p = { x: randomInt(cols), y: randomInt(rows) };
        if (!isSnake(p) && foodIndexAt(p) < 0) {
          foods.push(p);
          return;
        }
      }
    };

    const reset = () => {
      const y = randomInt(rows);
      snake = Array.from({ length: START_LENGTH }, (_, i) => ({
        x: START_LENGTH - i,
        y,
      }));
      direction = DIRECTIONS[0];
      tickMs = TICK_MS;
      foods = [];
      while (foods.length < FOOD_COUNT) {
        const before = foods.length;
        addFood();
        if (foods.length === before) break;
      }
    };

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.max(Math.ceil(window.innerWidth / CELL), START_LENGTH + 2);
      rows = Math.max(Math.ceil(window.innerHeight / CELL), 3);
      reset();
    };

    const wrap = (p: Point): Point => ({
      x: (p.x + cols) % cols,
      y: (p.y + rows) % rows,
    });

    const step = () => {
      const head = snake[0];
      // Head towards the nearest pellet most of the time, otherwise wander.
      const dist = (from: Point, to: Point) =>
        Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
      const target = foods.reduce<Point | undefined>(
        (best, f) => (!best || dist(head, f) < dist(head, best) ? f : best),
        undefined,
      );
      const options = DIRECTIONS.filter(
        (d) => !(d.x === -direction.x && d.y === -direction.y),
      )
        .filter((d) => !isSnake(wrap({ x: head.x + d.x, y: head.y + d.y })))
        .sort((a, b) => {
          if (!target) return 0;
          const to = (d: Point) =>
            dist({ x: head.x + d.x, y: head.y + d.y }, target);
          return to(a) - to(b);
        });
      if (options.length === 0) {
        reset();
        return;
      }
      direction =
        Math.random() < 0.8 ? options[0] : options[randomInt(options.length)];
      const next = wrap({ x: head.x + direction.x, y: head.y + direction.y });
      snake.unshift(next);
      const eaten = foodIndexAt(next);
      if (eaten >= 0) {
        foods.splice(eaten, 1);
        if (snake.length > MAX_LENGTH) {
          snake.length = START_LENGTH;
          tickMs = TICK_MS;
        } else {
          tickMs = Math.max(MIN_TICK_MS, tickMs - SPEEDUP_MS);
        }
        addFood();
      } else {
        snake.pop();
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.fillStyle = getComputedStyle(document.documentElement)
        .getPropertyValue("--ik-accent")
        .trim();
      ctx.globalAlpha = OPACITY;
      for (const p of snake) {
        ctx.fillRect(p.x * CELL + 2, p.y * CELL + 2, CELL - 4, CELL - 4);
      }
      ctx.globalAlpha = FOOD_OPACITY;
      for (const f of foods) {
        const cx = f.x * CELL + CELL / 2;
        const cy = f.y * CELL + CELL / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 6);
        ctx.lineTo(cx + 6, cy);
        ctx.lineTo(cx, cy + 6);
        ctx.lineTo(cx - 6, cy);
        ctx.closePath();
        ctx.fill();
      }
    };

    resize();
    draw();
    let timer = 0;
    const tick = () => {
      if (!document.hidden) {
        step();
        draw();
      }
      timer = window.setTimeout(tick, tickMs);
    };
    timer = window.setTimeout(tick, tickMs);
    window.addEventListener("resize", resize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[1250] h-full w-full print:hidden"
    />
  );
}

export function SnakeBackground() {
  const { theme } = useColorScheme();
  return theme === "snake" ? <SnakeCanvas /> : null;
}
