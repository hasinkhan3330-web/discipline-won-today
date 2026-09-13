import { useEffect, useRef, useState } from "react";
import zenMeditation from "@/assets/zen-golden-meditation.jpg.asset.json";

const MANDALA_NODES = Array.from({ length: 20 }, (_, index) => index);
const CHAKRA_NODES = [
  { x: 50, y: 39 },
  { x: 50, y: 48 },
  { x: 50, y: 57 },
  { x: 50, y: 66 },
];

function rotationFromTransform(transform: string) {
  if (transform === "none") return 0;
  const values = transform.match(/matrix\(([^)]+)\)/)?.[1].split(",").map(Number);
  if (!values || values.length < 2) return 0;
  return Math.atan2(values[1], values[0]) * (180 / Math.PI);
}

export function ZenMandalaScene({
  running,
  secondsLeft,
  totalSeconds,
}: {
  running: boolean;
  secondsLeft: number;
  totalSeconds: number;
}) {
  const ringRef = useRef<HTMLDivElement | null>(null);
  const spinRef = useRef<Animation | null>(null);
  const previousRunningRef = useRef(false);
  const startAngleRef = useRef(0);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    const ring = ringRef.current;
    if (!ring) return;

    const createSpin = (startAngle: number) => {
      const animation = ring.animate(
        [
          { transform: `translateZ(0) rotate(${startAngle}deg)` },
          { transform: `translateZ(0) rotate(${startAngle + 360}deg)` },
        ],
        { duration: 90000, iterations: Infinity, easing: "linear" },
      );
      animation.pause();
      spinRef.current = animation;
      return animation;
    };

    createSpin(startAngleRef.current);
    return () => {
      spinRef.current?.cancel();
      spinRef.current = null;
    };
  }, []);

  useEffect(() => {
    const ring = ringRef.current;
    const spin = spinRef.current;
    if (!ring || !spin) return;

    if (running) {
      setStopping(false);
      spin.play();
      previousRunningRef.current = true;
      return;
    }

    const sessionEnded = previousRunningRef.current && secondsLeft >= totalSeconds;
    previousRunningRef.current = false;
    if (!sessionEnded) {
      spin.pause();
      return;
    }

    const currentAngle = rotationFromTransform(getComputedStyle(ring).transform);
    spin.cancel();
    setStopping(true);
    const coast = ring.animate(
      [
        { transform: `translateZ(0) rotate(${currentAngle}deg)` },
        { transform: `translateZ(0) rotate(${currentAngle + 14}deg)` },
      ],
      { duration: 1400, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "forwards" },
    );
    coast.onfinish = () => {
      startAngleRef.current = currentAngle + 14;
      coast.cancel();
      const nextSpin = ring.animate(
        [
          { transform: `translateZ(0) rotate(${startAngleRef.current}deg)` },
          { transform: `translateZ(0) rotate(${startAngleRef.current + 360}deg)` },
        ],
        { duration: 90000, iterations: Infinity, easing: "linear" },
      );
      nextSpin.pause();
      spinRef.current = nextSpin;
      setStopping(false);
    };

    return () => {
      coast.onfinish = null;
      coast.cancel();
    };
  }, [running, secondsLeft, totalSeconds]);

  return (
    <div className={`zen-scene${running ? " zen-scene--active" : ""}${stopping ? " zen-scene--stopping" : ""}`}>
      <img
        className="zen-scene__art"
        src={zenMeditation.url}
        alt="Golden meditation figure seated among lotus flowers in a tranquil forest"
        draggable={false}
      />
      <div ref={ringRef} className="zen-mandala" aria-hidden="true">
        <svg viewBox="0 0 300 300">
          <circle className="zen-mandala__fine" cx="150" cy="150" r="139" />
          <circle className="zen-mandala__dash" cx="150" cy="150" r="132" />
          <circle className="zen-mandala__fine" cx="150" cy="150" r="118" />
          <path className="zen-mandala__geometry" d="M150 18 264 216 36 216ZM150 282 36 84 264 84Z" />
          <circle className="zen-mandala__dash zen-mandala__dash--inner" cx="150" cy="150" r="101" />
          <circle className="zen-mandala__fine" cx="150" cy="150" r="84" />
          {MANDALA_NODES.map((index) => {
            const angle = (index / MANDALA_NODES.length) * Math.PI * 2;
            return <circle key={index} className="zen-mandala__node" cx={150 + Math.cos(angle) * 139} cy={150 + Math.sin(angle) * 139} r="2.2" />;
          })}
        </svg>
      </div>
      <div className="zen-chakras" aria-hidden="true">
        {CHAKRA_NODES.map((node, index) => (
          <i key={`${node.x}-${node.y}`} style={{ left: `${node.x}%`, top: `${node.y}%`, "--chakra-delay": `${index * 0.42}s` } as React.CSSProperties} />
        ))}
      </div>
    </div>
  );
}