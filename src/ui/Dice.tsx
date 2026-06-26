import { useEffect, useRef, useState } from "react";

/** Pip layout per face: which cells of a 3×3 grid (0–8) carry a dot. */
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const prefersReducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function Die({ value, rolling, outcome, index }: {
  value: number; rolling: boolean; outcome: "hit" | "miss" | "low" | null; index: number;
}) {
  const pips = PIPS[value] ?? [];
  const cls = ["die", rolling && "die--rolling", outcome && `die--${outcome}`].filter(Boolean).join(" ");
  return (
    <span className={cls} data-value={value} style={{ animationDelay: `${index * 80}ms` }} aria-hidden="true">
      {Array.from({ length: 9 }, (_, cell) => (
        <span key={cell} className={pips.includes(cell) ? "pip pip--on" : "pip"} />
      ))}
    </span>
  );
}

/**
 * Animated dice. Tumbles + flashes random faces for ~0.7s whenever `roll` changes,
 * then settles on the rolled values, tinted by outcome (4-6 hit, 3 miss, 1-2 low).
 */
export function Dice({ roll }: { roll: number[] }) {
  const seen = useRef(JSON.stringify(roll));
  const [rolling, setRolling] = useState(false);
  const [flash, setFlash] = useState<number[] | null>(null);

  useEffect(() => {
    const key = JSON.stringify(roll);
    if (roll.length === 0 || key === seen.current) return;
    seen.current = key;
    if (prefersReducedMotion()) return;
    setRolling(true);
    const n = roll.length;
    const flashId = setInterval(
      () => setFlash(Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 6))),
      70,
    );
    const stopId = setTimeout(() => {
      clearInterval(flashId);
      setFlash(null);
      setRolling(false);
    }, 700);
    return () => { clearInterval(flashId); clearTimeout(stopId); };
  }, [roll]);

  if (roll.length === 0) return null;
  const faces = rolling && flash ? flash : roll;
  const landed = roll.filter((v) => v >= 4).length;

  return (
    <div className="dice" role="status" aria-label="Dice roll">
      <span className="dice-faces">
        {faces.map((v, i) => {
          const outcome = rolling ? null : v >= 4 ? "hit" : v === 3 ? "miss" : "low";
          return <Die key={i} index={i} value={v} rolling={rolling} outcome={outcome} />;
        })}
      </span>
      {!rolling && (
        <span className="dice-readout">{landed} landed</span>
      )}
    </div>
  );
}
