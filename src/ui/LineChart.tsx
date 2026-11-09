export interface ChartPoint {
  x: number;
  y: number;
}

export interface ChartBand {
  min: number;
  max: number;
}

const WIDTH = 300;
const PAD = 8;
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Pure layout: points (any units) → viewBox coordinates. A band widens the vertical scale. */
export function chartGeometry(points: readonly ChartPoint[], height: number, band?: ChartBand) {
  const xs = points.map((p) => p.x);
  const ys = [...points.map((p) => p.y), ...(band ? [band.min, band.max] : [])];
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  let y0 = Math.min(...ys);
  let y1 = Math.max(...ys);
  if (y0 === y1) {
    y0 -= 1;
    y1 += 1;
  }
  const sx = (x: number) => (x1 === x0 ? WIDTH / 2 : PAD + ((x - x0) / (x1 - x0)) * (WIDTH - 2 * PAD));
  const sy = (y: number) => height - PAD - ((y - y0) / (y1 - y0)) * (height - 2 * PAD);
  return {
    coords: points.map((p) => ({ x: round1(sx(p.x)), y: round1(sy(p.y)) })),
    band: band ? { y: round1(sy(band.max)), height: round1(sy(band.min) - sy(band.max)) } : undefined,
  };
}

interface LineChartProps {
  points: readonly ChartPoint[];
  label: string;
  height?: number;
  band?: ChartBand;
  emptyText?: string;
}

/** Spec §3: a small hand-rolled SVG chart (weight line chart, habitat sparkline). */
export function LineChart({ points, label, height = 120, band, emptyText = 'No data yet' }: LineChartProps) {
  if (points.length === 0) return <div className="chart-empty muted">{emptyText}</div>;
  const g = chartGeometry(points, height, band);
  return (
    <svg className="chart" viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label={label}>
      {g.band && <rect className="chart-band" x={0} y={g.band.y} width={WIDTH} height={g.band.height} rx={4} />}
      {g.coords.length > 1 && (
        <polyline className="chart-line" points={g.coords.map((c) => `${c.x},${c.y}`).join(' ')} />
      )}
      {g.coords.map((c, i) => (
        <circle key={i} className="chart-dot" cx={c.x} cy={c.y} r={3.5} />
      ))}
    </svg>
  );
}
