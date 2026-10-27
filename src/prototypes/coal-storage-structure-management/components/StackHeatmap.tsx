/**
 * 实际堆煤视图
 *
 * 把 20 m 堆煤高度上限划分为 200 个 10 cm 分带，以热力图方块呈现各分区的实际堆煤情况：
 * 纵轴是真实标高，因此煤层厚度直接表现为方块的连续段数，分区堆高差异一眼可比。
 * 三轴：左侧堆煤高度（m）、底部分区编号（增序，不附各区堆高）、右侧对应的俯仰夹角（0°～45° 对应 0～20 m 挡煤墙）。
 * 左右纵轴在横向滚动时保持固定，中间分区列与底轴随滚动条移动。
 */

import React, { useMemo } from 'react';
import * as geo from '../geometry';
import { fmt, readableText } from '../data';
import type { ComputedLayer, ComputedZone } from '../model';

const AXIS = {
  plot: '#fafafa',
  plotStroke: '#d9d9d9',
  grid: '#f0f0f0',
  tick: '#bfbfbf',
  label: '#8c8c8c',
  muted: '#bfbfbf',
  baseline: '#d9d9d9',
};
const BAND_PX = 2.4;
const PAD_T = 16;
const PLOT_H = geo.BAND_COUNT * BAND_PX;
const HEIGHT_TICKS = Array.from({ length: 11 }, (_, i) => i * 2);

/** 圆形 36 列用窄列横向滚动；条形 3 列用宽列撑满主区 */
const layoutOf = (zoneCount: number) =>
  zoneCount > 8
    ? { compact: true, colW: 34, axisL: 52, axisR: 58, axisB: 22, labelSize: 8.5, axisSize: 9.5 }
    : { compact: false, colW: 196, axisL: 56, axisR: 62, axisB: 28, labelSize: 11, axisSize: 12 };

interface Props {
  zones: ComputedZone[];
  labelOf: (layerId: string) => string;
  tipOf: (layerId: string) => string;
  selectedLayerId: string | null;
  onSelect: (zoneId: string, layerId: string) => void;
}

interface BandRun {
  layer: ComputedLayer;
  /** 起始分带序号（含） */
  from: number;
  /** 结束分带序号（不含） */
  to: number;
}

/** 把每个分区的煤层切成 10 cm 分带段，供逐块渲染与整层交互 */
const buildRuns = (zone: ComputedZone): BandRun[] => {
  const runs: BandRun[] = [];
  zone.layers.forEach((layer) => {
    const from = Math.round(layer.bound.heightBottom / geo.BAND_HEIGHT);
    const to = Math.min(geo.BAND_COUNT, Math.round(layer.bound.heightTop / geo.BAND_HEIGHT));
    if (to > from) runs.push({ layer, from, to });
  });
  return runs;
};

const StackHeatmap: React.FC<Props> = ({
  zones,
  labelOf,
  tipOf,
  selectedLayerId,
  onSelect,
}) => {
  const g = zones[0]?.geometry;
  const layout = layoutOf(zones.length);
  const { colW, axisL, axisR, axisB, compact, labelSize, axisSize } = layout;
  const plotW = zones.length * colW;
  const height = PAD_T + PLOT_H + axisB;
  const plotBottom = PAD_T + PLOT_H;

  const yOfHeight = (h: number) => plotBottom - (h / geo.BAND_HEIGHT) * BAND_PX;
  const runsByZone = useMemo(() => zones.map((z) => buildRuns(z)), [zones]);

  if (!g) return null;

  return (
    <div className={`cssm-heatmap-wrap${compact ? ' is-compact' : ' is-wide'}`}>
      <div className="cssm-heatmap-inner">
        <div className="cssm-heatmap-axis is-left" aria-hidden="false">
          <svg
            width={axisL}
            height={height}
            viewBox={`0 0 ${axisL} ${height}`}
            style={{ height }}
            role="img"
            aria-label="堆煤高度坐标，0 至 20 米，每 2 米一刻度"
          >
            <rect width={axisL} height={height} fill="#ffffff" />
            {HEIGHT_TICKS.map((m) => (
              <g key={`l-${m}`}>
                <line
                  x1={axisL - 5}
                  y1={yOfHeight(m)}
                  x2={axisL}
                  y2={yOfHeight(m)}
                  stroke={AXIS.tick}
                />
                <text
                  x={axisL - 8}
                  y={yOfHeight(m) + 3.4}
                  textAnchor="end"
                  fontSize={axisSize}
                  fill={AXIS.label}
                >
                  {m}
                </text>
              </g>
            ))}
            <text x={axisL - 8} y={PAD_T - 5} textAnchor="end" fontSize={9} fill={AXIS.muted}>
              堆煤高度 m
            </text>
            <text
              x={axisL - 8}
              y={plotBottom + (compact ? 13 : 16)}
              textAnchor="end"
              fontSize={compact ? 9 : 10}
              fill={AXIS.muted}
            >
              分区
            </text>
          </svg>
        </div>

        <div className="cssm-heatmap-plot">
          <svg
            width={plotW}
            height={height}
            viewBox={`0 0 ${plotW} ${height}`}
            preserveAspectRatio={compact ? 'xMidYMin meet' : 'none'}
            style={{ width: compact ? plotW : '100%', height }}
            role="img"
            aria-label={`实际堆煤视图，${zones.length} 个分区，纵轴为 0 至 ${g.maxStackHeight} 米堆煤高度，按 10 厘米分带`}
          >
            <rect
              x={0}
              y={PAD_T}
              width={plotW}
              height={PLOT_H}
              fill={AXIS.plot}
              stroke={AXIS.plotStroke}
            />

            {Array.from({ length: g.maxStackHeight }, (_, i) => i + 1).map((m) => (
              <line
                key={`grid-${m}`}
                x1={0}
                y1={yOfHeight(m)}
                x2={plotW}
                y2={yOfHeight(m)}
                stroke={AXIS.grid}
              />
            ))}

            {zones.map((zone, ci) => {
              const x = ci * colW;
              const runs = runsByZone[ci];
              return (
                <g key={zone.id}>
                  {ci > 0 && (
                    <line x1={x} y1={PAD_T} x2={x} y2={plotBottom} stroke={AXIS.grid} />
                  )}

                  {runs.map((run) => {
                    const isUnmarked = run.layer.raw.status === 'unmarked';
                    const isActive = run.layer.id === selectedLayerId;
                    const yTop = plotBottom - run.to * BAND_PX;
                    const runHeight = (run.to - run.from) * BAND_PX;
                    const label = labelOf(run.layer.id);

                    return (
                      <g
                        key={run.layer.id}
                        className="cssm-hm-layer"
                        tabIndex={0}
                        role="button"
                        aria-label={`${zone.name} 第 ${run.layer.seq} 层，${tipOf(run.layer.id)}`}
                        onClick={() => onSelect(zone.id, run.layer.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSelect(zone.id, run.layer.id);
                          }
                        }}
                      >
                        <title>
                          {`${zone.name} 第 ${run.layer.seq} 层 · ${tipOf(run.layer.id)}
标高 ${run.layer.bound.heightBottom.toFixed(2)} ~ ${run.layer.bound.heightTop.toFixed(
                            2,
                          )} m（层厚 ${run.layer.thickness.toFixed(2)} m · ${run.to - run.from} 个 10 cm 分带）
体积 ${fmt(run.layer.volume)} m³ · 煤量 ${fmt(run.layer.mass)} t
俯仰角 ${run.layer.bound.pitchBottom.toFixed(1)}° ~ ${run.layer.bound.pitchTop.toFixed(1)}°`}
                        </title>

                        {Array.from({ length: run.to - run.from }, (_, k) => {
                          const band = run.from + k;
                          return (
                            <rect
                              key={band}
                              x={x + 1.5}
                              y={plotBottom - (band + 1) * BAND_PX}
                              width={colW - 3}
                              height={BAND_PX - 0.45}
                              fill={run.layer.color}
                              opacity={isUnmarked && band % 2 === 1 ? 0.6 : 1}
                            />
                          );
                        })}

                        <line
                          x1={x + 1.5}
                          y1={yTop}
                          x2={x + colW - 1.5}
                          y2={yTop}
                          stroke={AXIS.tick}
                          strokeWidth={0.9}
                        />

                        {runHeight >= (compact ? 15 : 18) && label && (
                          <text
                            x={x + colW / 2}
                            y={yTop + runHeight / 2 + (compact ? 3 : 4)}
                            textAnchor="middle"
                            fontSize={labelSize}
                            fontWeight={600}
                            fill={readableText(run.layer.color)}
                          >
                            {label}
                          </text>
                        )}

                        {isActive && (
                          <rect
                            x={x + 1.5}
                            y={yTop}
                            width={colW - 3}
                            height={runHeight}
                            fill="none"
                            stroke="#1677ff"
                            strokeWidth={2}
                          />
                        )}
                      </g>
                    );
                  })}

                  <text
                    x={x + colW / 2}
                    y={plotBottom + (compact ? 13 : 16)}
                    textAnchor="middle"
                    fontSize={compact ? 9.5 : axisSize}
                    fontWeight={compact ? (zone.code % 5 === 0 ? 600 : 400) : 600}
                    fill={compact && zone.code % 5 !== 0 ? AXIS.muted : '#434343'}
                  >
                    {compact ? zone.code : zone.name}
                  </text>
                </g>
              );
            })}

            <line
              x1={0}
              y1={plotBottom}
              x2={plotW}
              y2={plotBottom}
              stroke={AXIS.baseline}
              strokeWidth={1.2}
            />
          </svg>
        </div>

        <div className="cssm-heatmap-axis is-right">
          <svg
            width={axisR}
            height={height}
            viewBox={`0 0 ${axisR} ${height}`}
            style={{ height }}
            role="img"
            aria-label="俯仰夹角坐标，0 度至 45 度，与左侧堆煤高度对齐"
          >
            <rect width={axisR} height={height} fill="#ffffff" />
            {HEIGHT_TICKS.map((m) => (
              <g key={`r-${m}`}>
                <line x1={0} y1={yOfHeight(m)} x2={5} y2={yOfHeight(m)} stroke={AXIS.tick} />
                <text x={8} y={yOfHeight(m) + 3.4} fontSize={axisSize} fill={AXIS.label}>
                  {geo.pitchFromHeight(g, m).toFixed(1)}°
                </text>
              </g>
            ))}
            <text x={8} y={PAD_T - 5} fontSize={9} fill={AXIS.muted}>
              俯仰夹角 °
            </text>
          </svg>
        </div>
      </div>
    </div>
  );
};

export default StackHeatmap;
