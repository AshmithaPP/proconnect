'use client';

import React, { useState } from 'react';
import { FiTable } from 'react-icons/fi';

/*
 * Small, dependency-free charts for the consultant dashboard.
 * Spec: single-series = one hue (--viz-series); sequential = one blue ramp light→dark;
 * marks ≤ 24px thick with a 4px rounded data-end, square at the baseline; hairline solid
 * grid; text in ink tokens (never the data colour); every mark has a hover + focus tooltip;
 * every chart has a table view, so tooltips never gate a value.
 */

const SEQUENTIAL_RAMP = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];

/** 0 / 999 / 1.2K / 12K / 1.2L(akh) style compact ticks, INR-friendly */
export function compactNumber(value) {
  if (value >= 10000000) return `${(value / 10000000).toFixed(value % 10000000 ? 1 : 0)}Cr`;
  if (value >= 100000) return `${(value / 100000).toFixed(value % 100000 ? 1 : 0)}L`;
  if (value >= 1000) return `${(value / 1000).toFixed(value % 1000 ? 1 : 0)}K`;
  return String(Math.round(value));
}

/** Axis tick formats (named, because server components cannot pass functions to client charts) */
const TICK_FORMATS = {
  number: compactNumber,
  'inr-paise': (paise) => `₹${compactNumber(Math.round(paise / 100))}`,
};

/** Clean axis maximum + 4 tick steps */
function niceScale(maxValue) {
  if (maxValue <= 0) return { max: 4, ticks: [0, 1, 2, 3, 4] };
  const rough = maxValue / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough);
  return { max: step * 4, ticks: [0, 1, 2, 3, 4].map((i) => i * step) };
}

/** Column with a 3px rounded top and a square base */
function columnPath(x, y, width, height) {
  const r = Math.min(3, width / 2, height);
  if (height <= 0) return '';
  return `M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z`;
}

function Tooltip({ tip }) {
  if (!tip) return null;
  const topStyle = tip.topPercent !== undefined ? `${tip.topPercent}%` : tip.top;
  return (
    <div className="viz-tooltip" role="status" style={{ left: `${tip.x}%`, top: topStyle }}>
      <strong>{tip.value}</strong>
      <span>{tip.label}</span>
    </div>
  );
}

function TableView({ caption, columns, rows }) {
  return (
    <details className="viz-table-toggle">
      <summary>
        <FiTable className="icon-inline" style={{ verticalAlign: '-2px', marginRight: '6px' }} /> View as table
      </summary>
      <div className="admin-table-scroll">
        <table className="admin-data-table viz-table">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/**
 * Vertical columns over time (one series).
 * Wide viewBox + restrained proportions ensure clean fonts and modern dashboard aesthetics.
 *
 * @param {{ data: Array<{ key: string, label: string, value: number, valueLabel: string, detail?: string }>,
 *   caption: string, valueHeading: string, tickFormat?: 'number' | 'inr-paise' }} props
 */
export function ColumnChart({ data, caption, valueHeading, tickFormat = 'number' }) {
  const formatTick = TICK_FORMATS[tickFormat] || compactNumber;
  const [tip, setTip] = useState(null);
  const width = 1200;
  const height = 190;
  const margin = { top: 16, right: 20, bottom: 26, left: 52 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const { max, ticks } = niceScale(Math.max(...data.map((d) => d.value), 0));
  const band = plotWidth / Math.max(data.length, 1);
  const barWidth = Math.max(4, Math.min(16, band - 14));
  const labelEvery = Math.ceil(data.length / 8);

  const show = (d, index) => {
    const barHeight = (d.value / max) * plotHeight;
    const barY = d.value > 0 ? margin.top + plotHeight - barHeight : margin.top + plotHeight;
    const topPercent = Math.max(14, ((barY - 8) / height) * 100);

    setTip({
      key: d.key,
      x: ((margin.left + band * index + band / 2) / width) * 100,
      topPercent,
      value: d.valueLabel,
      label: d.detail ? `${d.label} · ${d.detail}` : d.label,
    });
  };

  return (
    <div className="viz-root">
      <div className="viz-plot" onMouseLeave={() => setTip(null)}>
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={caption} className="viz-svg">
          {ticks.map((tick) => {
            const y = margin.top + plotHeight - (tick / max) * plotHeight;
            return (
              <g key={tick}>
                <line x1={margin.left} x2={width - margin.right} y1={y} y2={y} className="viz-grid" />
                <text x={margin.left - 12} y={y} className="viz-axis-text viz-axis-y" textAnchor="end" dominantBaseline="middle">
                  {formatTick(tick)}
                </text>
              </g>
            );
          })}
          {data.map((d, index) => {
            const barHeight = (d.value / max) * plotHeight;
            const x = margin.left + band * index + (band - barWidth) / 2;
            const isHovered = tip?.key === d.key;
            return (
              <g key={d.key}>
                {isHovered && (
                  <rect
                    x={margin.left + band * index + 2}
                    y={margin.top}
                    width={band - 4}
                    height={plotHeight}
                    fill="rgba(37, 99, 235, 0.04)"
                    rx={3}
                  />
                )}
                <rect
                  x={margin.left + band * index}
                  y={margin.top}
                  width={band}
                  height={plotHeight}
                  className="viz-hit"
                  tabIndex={0}
                  aria-label={`${d.label}: ${d.valueLabel}`}
                  onMouseEnter={() => show(d, index)}
                  onFocus={() => show(d, index)}
                  onBlur={() => setTip(null)}
                />
                {d.value > 0 && (
                  <path
                    d={columnPath(x, margin.top + plotHeight - barHeight, barWidth, barHeight)}
                    className={`viz-mark${isHovered ? ' is-active' : ''}`}
                  />
                )}
                {index % labelEvery === 0 && (
                  <text x={margin.left + band * index + band / 2} y={height - 6} className="viz-axis-text viz-axis-x" textAnchor="middle">
                    {d.label}
                  </text>
                )}
              </g>
            );
          })}
          <line x1={margin.left} x2={width - margin.right} y1={margin.top + plotHeight} y2={margin.top + plotHeight} className="viz-baseline" />
        </svg>
        <Tooltip tip={tip} />
      </div>
      <TableView
        caption={caption}
        columns={['Date', valueHeading, 'Bookings']}
        rows={data.filter((d) => d.value > 0).map((d) => [d.label, d.valueLabel, d.detail || '—'])}
      />
    </div>
  );
}

/**
 * Horizontal bars, biggest first (one series). Value at the bar tip.
 * @param {{ items: Array<{ label: string, count: number }>, caption: string, unit?: string }} props
 */
export function BarList({ items, caption, unit = 'bookings' }) {
  const max = Math.max(...items.map((i) => i.count), 1);
  const total = items.reduce((sum, i) => sum + i.count, 0);
  if (!items.length) return <p className="viz-empty">No bookings in this period yet.</p>;

  return (
    <div className="viz-root">
      <ul className="viz-barlist" aria-label={caption}>
        {items.map((item) => {
          const share = total ? Math.round((item.count / total) * 100) : 0;
          return (
            <li key={item.label} className="viz-barlist-row" tabIndex={0} title={`${item.label}: ${item.count} ${unit} (${share}%)`}>
              <span className="viz-barlist-label">{item.label}</span>
              <span className="viz-barlist-track">
                <span className="viz-barlist-bar" style={{ width: `${(item.count / max) * 100}%` }} />
                <span className="viz-barlist-value">
                  {item.count} <span className="viz-muted">· {share}%</span>
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <TableView caption={caption} columns={['Answer', 'Bookings', 'Share']} rows={items.map((i) => [i.label, i.count, `${total ? Math.round((i.count / total) * 100) : 0}%`])} />
    </div>
  );
}

/**
 * Weekday × hour heatmap (sequential blue ramp: more bookings = darker).
 * @param {{ heatmap: { hours: number[], rows: Array<{ weekday: number, cells: Array<{ hour: number, count: number }> }> }, caption: string }} props
 */
export function Heatmap({ heatmap, caption }) {
  const [tip, setTip] = useState(null);
  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const max = Math.max(...heatmap.rows.flatMap((r) => r.cells.map((c) => c.count)), 0);
  const hourLabel = (hour) => `${hour % 12 === 0 ? 12 : hour % 12}${hour < 12 ? 'a' : 'p'}`;
  const colorFor = (count) => (count === 0 ? null : SEQUENTIAL_RAMP[Math.min(SEQUENTIAL_RAMP.length - 1, Math.ceil((count / max) * (SEQUENTIAL_RAMP.length - 1)))]);

  if (!heatmap.hours.length) return <p className="viz-empty">Set your weekly hours to see this chart.</p>;

  return (
    <div className="viz-root">
      <div className="viz-plot" onMouseLeave={() => setTip(null)}>
        <div className="viz-heatmap" style={{ gridTemplateColumns: `40px repeat(${heatmap.hours.length}, minmax(22px, 1fr))` }} role="grid" aria-label={caption}>
          <span />
          {heatmap.hours.map((hour) => (
            <span key={hour} className="viz-axis-text viz-heatmap-col">
              {hourLabel(hour)}
            </span>
          ))}
          {heatmap.rows.map((row) => (
            <React.Fragment key={row.weekday}>
              <span className="viz-axis-text viz-heatmap-row">{weekdayNames[row.weekday]}</span>
              {row.cells.map((cell) => {
                const label = `${weekdayNames[row.weekday]} ${hourLabel(cell.hour)}–${hourLabel(cell.hour + 1)}`;
                const showTip = (event) => {
                  const plot = event.currentTarget.closest('.viz-plot').getBoundingClientRect();
                  const rect = event.currentTarget.getBoundingClientRect();
                  setTip({ x: ((rect.left + rect.width / 2 - plot.left) / plot.width) * 100, top: rect.top - plot.top - 4, value: `${cell.count} booking${cell.count === 1 ? '' : 's'}`, label });
                };
                return (
                  <span
                    key={cell.hour}
                    className={`viz-heatmap-cell${cell.count ? '' : ' is-empty'}`}
                    style={cell.count ? { background: colorFor(cell.count) } : undefined}
                    tabIndex={0}
                    role="gridcell"
                    aria-label={`${label}: ${cell.count} bookings`}
                    onMouseEnter={showTip}
                    onFocus={showTip}
                    onBlur={() => setTip(null)}
                  />
                );
              })}
            </React.Fragment>
          ))}
        </div>
        <Tooltip tip={tip} />
      </div>
      <div className="viz-scale" aria-hidden="true">
        <span className="viz-muted">Fewer</span>
        {SEQUENTIAL_RAMP.map((color) => (
          <span key={color} className="viz-scale-step" style={{ background: color }} />
        ))}
        <span className="viz-muted">More</span>
      </div>
      <TableView
        caption={caption}
        columns={['Day', 'Hour', 'Bookings']}
        rows={heatmap.rows.flatMap((row) =>
          row.cells.filter((c) => c.count).map((c) => [weekdayNames[row.weekday], `${hourLabel(c.hour)}–${hourLabel(c.hour + 1)}`, c.count])
        )}
      />
    </div>
  );
}

/**
 * Booking funnel: each stage as a bar relative to the first, with step conversion.
 * @param {{ stages: Array<{ stage: string, count: number }>, caption: string }} props
 */
export function Funnel({ stages, caption }) {
  const first = stages[0]?.count || 0;
  if (!first) return <p className="viz-empty">No booking forms submitted in this period.</p>;

  return (
    <div className="viz-root">
      <ol className="viz-funnel" aria-label={caption}>
        {stages.map((stage, index) => {
          const ofFirst = Math.round((stage.count / first) * 100);
          const previous = index > 0 ? stages[index - 1].count : null;
          const step = previous ? Math.round((stage.count / previous) * 100) : null;
          return (
            <li key={stage.stage} className="viz-funnel-row" tabIndex={0} title={`${stage.stage}: ${stage.count} (${ofFirst}% of submitted)`}>
              <div className="viz-funnel-head">
                <span className="viz-funnel-stage">{stage.stage}</span>
                <span>
                  <strong>{stage.count}</strong>
                  {step !== null && <span className="viz-muted"> · {step}% of previous step</span>}
                </span>
              </div>
              <span className="viz-barlist-track">
                <span className="viz-barlist-bar" style={{ width: `${Math.max(ofFirst, stage.count ? 1 : 0)}%` }} />
              </span>
            </li>
          );
        })}
      </ol>
      <TableView caption={caption} columns={['Stage', 'Bookings', '% of submitted']} rows={stages.map((s) => [s.stage, s.count, `${Math.round((s.count / first) * 100)}%`])} />
    </div>
  );
}
