import { tallyGroups } from "./format";

const HEIGHT = 32;
const STROKE_WIDTH = 3;
const MARK_SPACING = 9;
const MARK_INSET = 4;
const GROUP_WIDTH = 36;
const GROUP_GAP = 14;
const STROKES_PER_GROUP = 5;
const STRIKE_START = { x: 0, y: 26 };
const STRIKE_END = { x: 35, y: 6 };
const DRAW_STAGGER_MS = 35;
const JITTER = [
  { lean: 0.8, top: 0.5, bottom: -0.4 },
  { lean: -0.6, top: -0.3, bottom: 0.6 },
  { lean: 0.4, top: 0.8, bottom: 0.2 },
  { lean: -1, top: 0, bottom: -0.6 },
  { lean: 0.6, top: -0.6, bottom: 0.4 },
  { lean: -0.3, top: 0.4, bottom: -0.2 },
  { lean: 1, top: -0.2, bottom: 0.5 },
];

type TallyMarksProps = { count: number; label: string };

type Point = { x: number; y: number };

function jitterFor(order: number) {
  return JITTER[order % JITTER.length];
}

function SketchLine({ from, to, order }: { from: Point; to: Point; order: number }) {
  return (
    <line
      x1={from.x}
      y1={from.y}
      x2={to.x}
      y2={to.y}
      pathLength={1}
      className="animate-draw"
      style={{ animationDelay: `${order * DRAW_STAGGER_MS}ms` }}
    />
  );
}

function Stroke({ x, order }: { x: number; order: number }) {
  const { lean, top, bottom } = jitterFor(order);
  return (
    <SketchLine
      from={{ x: x + lean, y: 4 + top }}
      to={{ x: x - lean, y: HEIGHT - 4 + bottom }}
      order={order}
    />
  );
}

function Strike({ left, order }: { left: number; order: number }) {
  const { lean, top } = jitterFor(order);
  return (
    <SketchLine
      from={{ x: left + STRIKE_START.x + top, y: STRIKE_START.y + lean }}
      to={{ x: left + STRIKE_END.x - top, y: STRIKE_END.y - lean }}
      order={order}
    />
  );
}

function Group({ index }: { index: number }) {
  const left = index * (GROUP_WIDTH + GROUP_GAP);
  const firstOrder = index * STROKES_PER_GROUP;
  return (
    <g>
      {[0, 1, 2, 3].map((mark) => (
        <Stroke key={mark} x={left + MARK_INSET + mark * MARK_SPACING} order={firstOrder + mark} />
      ))}
      <Strike left={left} order={firstOrder + 4} />
    </g>
  );
}

export function TallyMarks({ count, label }: TallyMarksProps) {
  const { groups, remainder, overflow } = tallyGroups(count);
  const remainderLeft = groups * (GROUP_WIDTH + GROUP_GAP);
  const width = remainderLeft + (remainder > 0 ? remainder * MARK_SPACING + MARK_INSET : 0);

  return (
    <span className="inline-flex items-end gap-3">
      <svg
        role="img"
        aria-label={label}
        width={Math.max(width, 1)}
        height={HEIGHT}
        viewBox={`0 0 ${Math.max(width, 1)} ${HEIGHT}`}
        className="overflow-visible text-reviewed"
        fill="none"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
      >
        {Array.from({ length: groups }, (_, index) => (
          <Group key={index} index={index} />
        ))}
        {Array.from({ length: remainder }, (_, mark) => (
          <Stroke
            key={mark}
            x={remainderLeft + MARK_INSET + mark * MARK_SPACING}
            order={groups * STROKES_PER_GROUP + mark}
          />
        ))}
      </svg>
      {overflow > 0 ? (
        <span aria-hidden="true" className="font-hand text-2xl">
          +{overflow}
        </span>
      ) : null}
    </span>
  );
}
