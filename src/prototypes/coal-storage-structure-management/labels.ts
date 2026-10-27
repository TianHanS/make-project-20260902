/**
 * 煤层缩略展示信息的取值与格式化
 *
 * 同一个字段在不同视图里可用的空间差别很大：分层视图的格子有近百像素，
 * 实际堆煤视图的分区列只有三十余像素。因此同一字段提供两种形态：
 * 完整值（用于分层视图、明细表、悬停气泡）与紧凑值（用于实际堆煤视图的窄列）。
 */

import { coalTypeName, fmt } from './data';
import type { ComputedLayer } from './model';

/** 煤种在窄列中的短名 */
const SHORT_COAL_NAME: Record<string, string> = {
  shenhun1: '神混1',
  zhungeer: '准格尔',
  indoLignite: '印尼褐',
  russian: '俄煤',
  mongolian: '蒙煤',
};

export const fieldValue = (layer: ComputedLayer, key: string): string => {
  const r = layer.raw;
  const q = r.quality;
  switch (key) {
    case 'coalType':
      return r.coalType ? coalTypeName(r.coalType) : '待标记';
    case 'ship':
      return r.shipName || '待标记';
    case 'voyage':
      return r.voyage && r.voyage !== '—' ? r.voyage : '待标记';
    case 'heightStart':
      return `${layer.bound.heightBottom.toFixed(2)} m`;
    case 'shipVoyage':
      return r.shipName ? `${r.shipName} / ${r.voyage}` : '待标记';
    case 'cv':
      return q ? fmt(q.cv) : '待标记';
    case 'volume':
      return fmt(layer.volume);
    case 'pitchStart':
      return `${layer.bound.pitchBottom.toFixed(1)}°`;
    case 'regNo':
      return r.regNo || '待标记';
    default:
      return '';
  }
};

export const compactFieldValue = (layer: ComputedLayer, key: string): string => {
  const r = layer.raw;
  const q = r.quality;
  switch (key) {
    case 'coalType':
      return r.coalType ? SHORT_COAL_NAME[r.coalType] ?? coalTypeName(r.coalType) : '待标记';
    case 'ship':
      return r.shipName ? r.shipName.slice(0, 4) : '待标记';
    case 'voyage':
      return r.voyage && r.voyage !== '—' ? r.voyage : '—';
    case 'heightStart':
      return `${layer.bound.heightBottom.toFixed(1)}`;
    case 'shipVoyage':
      return r.voyage && r.voyage !== '—' ? r.voyage : r.shipName ? '汽运' : '待标记';
    case 'cv':
      return q ? String(q.cv) : '待标记';
    case 'volume':
      return layer.volume >= 1000
        ? `${(layer.volume / 1000).toFixed(1)}k`
        : String(Math.round(layer.volume));
    case 'pitchStart':
      return `${layer.bound.pitchBottom.toFixed(1)}°`;
    case 'regNo':
      // 入厂登记编号尾号足以在窄列中区分批次，完整编号在悬停气泡与检视面板中给出
      return r.regNo ? r.regNo.slice(-6) : '待标记';
    default:
      return '';
  }
};
