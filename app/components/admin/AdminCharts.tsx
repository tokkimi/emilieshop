'use client';

import { useState } from 'react';

type Point = { label: string; value: number; tip?: string };

/**
 * One series over time: thin bars with a rounded data end, a recessive grid,
 * a hover/focus tooltip per bar, and a table view for every value.
 */
export function BarSeries({ points, format, title }: { points: Point[]; format: (value: number) => string; title: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const width = 720;
  const height = 200;
  const left = 44;
  const bottom = 22;
  const plotW = width - left;
  const plotH = height - bottom - 6;
  const max = Math.max(1, ...points.map((point) => point.value));
  const step = plotW / Math.max(1, points.length);
  const barW = Math.max(2, Math.min(18, step - 2));
  const ticks = [0, 0.5, 1].map((ratio) => ratio * max);
  const labelEvery = Math.ceil(points.length / 8);

  return (
    <div className="at-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        {ticks.map((tick) => {
          const y = 6 + plotH - (tick / max) * plotH;
          return (
            <g key={tick}>
              <line className="grid" x1={left} x2={width} y1={y} y2={y} />
              <text className="axis" x={left - 6} y={y + 3} textAnchor="end">
                {format(tick)}
              </text>
            </g>
          );
        })}
        {points.map((point, index) => {
          const x = left + index * step + (step - barW) / 2;
          const h = (point.value / max) * plotH;
          const y = 6 + plotH - h;
          const r = Math.min(4, barW / 2, h);
          return (
            <g key={point.label}>
              <rect
                className="hit"
                x={left + index * step}
                y={6}
                width={step}
                height={plotH}
                tabIndex={0}
                aria-label={`${point.label} : ${format(point.value)}`}
                onPointerEnter={() => setHover(index)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(index)}
                onBlur={() => setHover(null)}
              />
              {h > 0 ? (
                <path
                  className="bar"
                  d={`M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${y + h} Z`}
                />
              ) : null}
              {index % labelEvery === 0 ? (
                <text className="axis" x={x + barW / 2} y={height - 6} textAnchor="middle">
                  {point.label.slice(5)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {hover !== null && points[hover] ? (
        <div className="at-tip" style={{ left: `${((left + hover * step + step / 2) / width) * 100}%`, top: `${((6 + plotH - (points[hover].value / max) * plotH) / height) * 100}%` }}>
          <strong>{format(points[hover].value)}</strong>
          {points[hover].tip || points[hover].label}
        </div>
      ) : null}
      <button type="button" className="at-table-toggle" onClick={() => setTable((value) => !value)}>
        {table ? 'Masquer le tableau' : 'Voir les valeurs en tableau'}
      </button>
      {table ? (
        <div className="at-scroll">
          <table className="at-table">
            <tbody>
              {points.map((point) => (
                <tr key={point.label}>
                  <td>{point.label}</td>
                  <td className="num">{format(point.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

/** A ranked breakdown: label, value, and a bar proportional to the top item. */
export function HBars({ items, format = String, empty = 'Aucune donnée pour cette période.' }: { items: Array<{ label: string; value: number }>; format?: (value: number) => string; empty?: string }) {
  if (!items.length) return <p className="at-empty">{empty}</p>;
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <ul className="at-hbars">
      {items.map((item) => (
        <li key={item.label}>
          <span title={item.label}>{item.label}</span>
          <b>{format(item.value)}</b>
          <i style={{ width: `${(item.value / max) * 100}%` }} />
        </li>
      ))}
    </ul>
  );
}
