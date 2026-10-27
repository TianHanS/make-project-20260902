/**
 * 分层视图（存煤结构热力格图）
 *
 * 列为分区（分区编号增序自左向右），行为煤层层序（自下而上，底层在最下一行）。
 * 格内背景色按库存煤种取色，同一煤种同一颜色，
 * 并在缩略信息之下直接给出该层的层厚与标高区间数值。
 */

import React from 'react';
import { fmt, readableText } from '../data';
import type { ComputedZone } from '../model';

interface Props {
  zones: ComputedZone[];
  /** 未配备盘煤仪时，悬停不展示层厚和标高 */
  spatial: boolean;
  labelOf: (layerId: string) => string;
  tipOf: (layerId: string) => string;
  selectedLayerId: string | null;
  onSelect: (zoneId: string, layerId: string) => void;
}

const LayerMatrix: React.FC<Props> = ({ zones, spatial, labelOf, tipOf, selectedLayerId, onSelect }) => {
  const maxLayers = Math.max(1, ...zones.map((z) => z.layers.length));

  return (
    <div className="cssm-matrix-wrap">
      <div
        className="cssm-matrix"
        style={{
          gridTemplateColumns: `88px repeat(${zones.length}, minmax(${
            zones.length > 8 ? 92 : 160
          }px, 1fr))`,
        }}
      >
        <div className="cssm-mcell is-head">层序 / 分区</div>
        {zones.map((z) => (
          <div key={`h-${z.id}`} className="cssm-mcell is-head">
            {z.name}
          </div>
        ))}

        {Array.from({ length: maxLayers }, (_, row) => {
          const seq = maxLayers - row;
          return (
            <React.Fragment key={`r-${seq}`}>
              <div className="cssm-mcell is-rowhead">
                <span>第 {seq} 层</span>
                <span className="cssm-mcell-hint">{seq === 1 ? '贴地底层' : ''}</span>
              </div>
              {zones.map((z) => {
                const layer = z.layers.find((l) => l.seq === seq);
                if (!layer) {
                  return <div key={`${z.id}-${seq}`} className="cssm-mcell is-void" />;
                }
                const active = layer.id === selectedLayerId;
                const unmarked = layer.raw.status === 'unmarked';
                return (
                  <div
                    key={`${z.id}-${seq}`}
                    className={[
                      'cssm-mcell',
                      'is-layer',
                      active ? 'is-active' : '',
                      unmarked ? 'is-unmarked' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{ background: layer.color, color: readableText(layer.color) }}
                    role="button"
                    tabIndex={0}
                    aria-label={`${z.name} 第 ${seq} 层，${tipOf(layer.id)}`}
                    title={`${z.name} 第 ${seq} 层 · ${tipOf(layer.id)}${
                      spatial
                        ? `\n层厚 ${layer.thickness.toFixed(2)} m · 标高 ${layer.bound.heightBottom.toFixed(2)} ~ ${layer.bound.heightTop.toFixed(2)} m`
                        : ''
                    }\n体积 ${fmt(layer.volume)} m³ · 煤量 ${fmt(layer.mass)} t`}
                    onClick={() => onSelect(z.id, layer.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelect(z.id, layer.id);
                      }
                    }}
                  >
                    <span className="cssm-mcell-v">{labelOf(layer.id)}</span>
                    <span className="cssm-mcell-num cssm-num">煤量 {fmt(layer.mass)} t</span>
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}

        <div className="cssm-mcell is-total">存煤量 t</div>
        {zones.map((z) => (
          <div key={`m-${z.id}`} className="cssm-mcell is-total cssm-num">
            {fmt(z.totalMass)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default LayerMatrix;
