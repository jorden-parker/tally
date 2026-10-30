import { tallyGroups } from "./format";

const HEIGHT = 32;
const STROKE_WIDTH = 3;
const MARK_SPACING = 9;
const MARK_INSET = 4;
const GROUP_WIDTH = 36;
const GROUP_GAP = 14;
const STRIKE_START = { x: 0, y: 26 };
const STRIKE_END = { x: 35, y: 6 };

type TallyMarksProps = { count: number; label: string };

function Stroke({ x }: { x: number }) {
  return <line x1={x} y1={4} x2={x} y2={HEIGHT - 4} />;
}

function Group({ index }: { index: number }) {
  const left = index * (GROUP_WIDTH + GROUP_GAP);
  return (
    <g>
      {[0, 1, 2, 3].map((mark) => (
        <Stroke key={mark} x={left + MARK_INSET + mark * MARK_SPACING} />
      ))}
      <line
        x1={left + STRIKE_START.x}
        y1={STRIKE_START.y}
        x2={left + STRIKE_END.x}
        y2={STRIKE_END.y}
      />
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
        className="text-reviewed"
        fill="none"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
      >
        {Array.from({ length: groups }, (_, index) => (
          <Group key={index} index={index} />
        ))}
        {Array.from({ length: remainder }, (_, mark) => (
          <Stroke key={mark} x={remainderLeft + MARK_INSET + mark * MARK_SPACING} />
        ))}
      </svg>
      {overflow > 0 ? <span aria-hidden="true">+{overflow}</span> : null}
    </span>
  );
}
