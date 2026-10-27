/**
 * 存煤结构四类台账。
 * 入库 / 出库用处理方式区分人工与盘煤自动；调整记录只记人工改煤层。
 */

import {
  COAL_TYPES,
  INITIAL_MOVES,
  YARDS,
  coalTypeName,
  createZones,
  findBatch,
  forecastView,
  type CoalQuality,
  type CoalZone,
} from './data';
import { computeZone, type ComputedLayer, type ComputedZone } from './model';

export type ProcessMode = 'manual' | 'auto';

/** 自动记录的操作人 */
export const AUTO_OPERATOR = '系统';
/** 非人工记录的创建人、创建时间 */
export const AUTO_CREATED_TEXT = '系统生成';

export interface RecordActors {
  /** 人工为当前登录用户，自动为「系统」 */
  operator: string;
  /** 确认操作或自动生成记录的时间 */
  time: string;
  /** 人工为当前登录用户，自动为「系统生成」 */
  creator: string;
  /** 人工为创建当时的时间，自动为「系统生成」 */
  createdAt: string;
}

export const actorsOf = (
  mode: ProcessMode,
  operator: string,
  time: string,
): RecordActors =>
  mode === 'auto'
    ? {
        operator: AUTO_OPERATOR,
        time,
        creator: AUTO_CREATED_TEXT,
        createdAt: AUTO_CREATED_TEXT,
      }
    : {
        operator,
        time,
        creator: operator,
        createdAt: time,
      };

export interface InboundRecord extends RecordActors {
  id: string;
  yardId: string;
  regNo: string;
  shipName: string;
  voyage: string;
  coalTypeName: string;
  totalMass: number;
  density: number;
  note: string;
  mode: ProcessMode;
}

export interface InboundZoneDetail {
  id: string;
  recordId: string;
  zoneName: string;
  volume: number;
  mass: number;
  pitchFrom: number;
  pitchTo: number;
  heightFrom: number;
  heightTo: number;
}

export interface OutboundRecord extends RecordActors {
  id: string;
  yardId: string;
  zoneName: string;
  mass: number;
  note: string;
  mode: ProcessMode;
}

export interface OutboundLayerDetail {
  id: string;
  recordId: string;
  seq: number;
  regNo: string;
  coalTypeName: string;
  volume: number;
  mass: number;
  /** 全部扣减的煤层会从存煤结构中删除 */
  cut: 'all' | 'part';
}

export type AdjustAction = '更新煤层' | '标记入厂批次' | '拆分' | '合并上层' | '合并下层' | '清除';

export const ADJUST_ACTIONS: AdjustAction[] = [
  '更新煤层',
  '标记入厂批次',
  '拆分',
  '合并上层',
  '合并下层',
  '清除',
];

/** 对象文案格式：煤场 · 分区 · 第 N 层 */
export const zoneNameOf = (target: string) => {
  const parts = target.split('·').map((part) => part.trim()).filter(Boolean);
  return parts[1] ?? '';
};

export interface AdjustRecord extends RecordActors {
  id: string;
  yardId: string;
  /** 单个分区，或一次标记多个分区时用顿号连接 */
  zoneName: string;
  target: string;
  action: AdjustAction;
  /** 关键变动说明，可空 */
  note: string;
}

export type AdjustPhase = 'before' | 'after';

/** 调整明细：调整前、调整后各煤层的完整快照 */
export interface AdjustLine {
  id: string;
  recordId: string;
  phase: AdjustPhase;
  zoneName: string;
  layerId: string;
  seq: number;
  regNo: string;
  batchNo: string;
  shipName: string;
  voyage: string;
  coalVariety: string;
  coalKind: string;
  stockCoal: string;
  density: number | null;
  volume: number | null;
  mass: number | null;
  /** 百分比。仅拆分的调整后行有值 */
  volumeRatio: number | null;
  pitchStart: number | null;
  pitchEnd: number | null;
  heightStart: number | null;
  heightEnd: number | null;
  cv: number | null;
  sulfur: number | null;
  ash: number | null;
  volatile: number | null;
  moisture: number | null;
}

export type AdjustLineDraft = Omit<AdjustLine, 'id' | 'recordId'>;

export interface SurveyRecord {
  id: string;
  time: string;
  yardId: string;
  yardCode: string;
  yardName: string;
}

export interface SurveyZoneDetail {
  id: string;
  recordId: string;
  zoneCode: string;
  zoneName: string;
  volume: number;
  lastVolume: number;
  delta: number;
  /** 是否超出变动并已据此更新该分区存煤 */
  applied: boolean;
}

export interface LedgerState {
  inbound: InboundRecord[];
  inboundDetails: InboundZoneDetail[];
  outbound: OutboundRecord[];
  outboundDetails: OutboundLayerDetail[];
  adjust: AdjustRecord[];
  adjustDetails: AdjustLine[];
  survey: SurveyRecord[];
  surveyDetails: SurveyZoneDetail[];
}

let seq = 2000;
export const nextLedgerId = (prefix: string) => {
  seq += 1;
  return `${prefix}${seq}`;
};

const seedSurvey = (zones: CoalZone[]): Pick<LedgerState, 'survey' | 'surveyDetails'> => {
  const survey: SurveyRecord[] = [];
  const surveyDetails: SurveyZoneDetail[] = [];
  YARDS.filter((yard) => yard.hasSurvey).forEach((yard) => {
    const id = `SV-${yard.id}`;
    survey.push({
      id,
      time: yard.surveyAt,
      yardId: yard.id,
      yardCode: yard.id,
      yardName: yard.shortName,
    });
    zones
      .filter((zone) => zone.yardId === yard.id)
      .forEach((zone) => {
        const delta = zone.surveyVolume - zone.lastSurveyVolume;
        surveyDetails.push({
          id: `${id}-${zone.code}`,
          recordId: id,
          zoneCode: String(zone.code),
          zoneName: zone.name,
          volume: zone.surveyVolume,
          lastVolume: zone.lastSurveyVolume,
          delta,
          applied: Math.abs(delta) > 0.5,
        });
      });
  });
  return { survey, surveyDetails };
};

const byTimeDesc = <T extends { time: string }>(rows: T[]) =>
  [...rows].sort((a, b) => (a.time < b.time ? 1 : a.time > b.time ? -1 : 0));

const textOrEmpty = (value: string | undefined | null) => {
  const text = (value ?? '').trim();
  return !text || text === '—' ? '' : text;
};

/** 调整前全部在前，调整后在后；同一侧先分区、再煤层序号升序 */
export const sortAdjustLines = (lines: AdjustLine[]) =>
  [...lines].sort((a, b) => {
    if (a.phase !== b.phase) return a.phase === 'before' ? -1 : 1;
    const zone = a.zoneName.localeCompare(b.zoneName, 'zh-CN');
    if (zone !== 0) return zone;
    return a.seq - b.seq;
  });

/** 从当前煤层生成一条调整明细；patch 覆盖拆分、合并、标记后的几何与批次 */
export const layerAdjustLine = (
  layer: ComputedLayer,
  zoneName: string,
  phase: AdjustPhase,
  patch: Partial<AdjustLineDraft> = {},
): AdjustLineDraft => {
  const regNo = patch.regNo !== undefined ? patch.regNo : layer.raw.regNo;
  const batch = regNo ? findBatch(regNo) : undefined;
  const view = batch ? forecastView(batch) : null;
  const named = Boolean(regNo);
  const coalKind = named
    ? view?.coalKind || (layer.raw.coalType ? coalTypeName(layer.raw.coalType) : '')
    : '';
  const catalog = batch ? COAL_TYPES[batch.coalType]?.quality ?? null : null;
  const quality = patch.cv !== undefined
    ? {
        cv: patch.cv,
        sulfur: patch.sulfur ?? null,
        ash: patch.ash ?? null,
        volatile: patch.volatile ?? null,
        moisture: patch.moisture ?? null,
      }
    : named
      ? catalog ?? layer.raw.quality
      : null;
  const density = patch.density !== undefined ? patch.density : layer.raw.density;
  const volume = patch.volume !== undefined ? patch.volume : layer.volume;
  const mass = patch.mass !== undefined ? patch.mass : volume * density;
  return {
    phase,
    zoneName: patch.zoneName ?? zoneName,
    layerId: patch.layerId ?? layer.id,
    seq: patch.seq ?? layer.seq,
    regNo,
    batchNo: patch.batchNo ?? (named ? view?.batchNo ?? '' : ''),
    shipName: patch.shipName ?? (named ? textOrEmpty(view?.shipName || layer.raw.shipName) : ''),
    voyage: patch.voyage ?? (named ? textOrEmpty(view?.voyage || layer.raw.voyage) : ''),
    coalVariety: patch.coalVariety ?? (named ? view?.coalVariety ?? '' : ''),
    coalKind: patch.coalKind ?? coalKind,
    stockCoal: patch.stockCoal ?? (named ? (view ? view.stockCoalType : coalKind) : ''),
    density,
    volume,
    mass,
    volumeRatio: patch.volumeRatio ?? null,
    pitchStart: patch.pitchStart ?? layer.bound.pitchBottom,
    pitchEnd: patch.pitchEnd ?? layer.bound.pitchTop,
    heightStart: patch.heightStart ?? layer.bound.heightBottom,
    heightEnd: patch.heightEnd ?? layer.bound.heightTop,
    cv: quality?.cv ?? null,
    sulfur: quality?.sulfur ?? null,
    ash: quality?.ash ?? null,
    volatile: quality?.volatile ?? null,
    moisture: quality?.moisture ?? null,
  };
};

interface SeedGeom {
  zoneName: string;
  layerId: string;
  seq: number;
  volume: number;
  density: number;
  pitchStart: number;
  pitchEnd: number;
  heightStart: number;
  heightEnd: number;
  regNo?: string;
  quality?: CoalQuality | null;
  volumeRatio?: number | null;
  mass?: number;
}

const seedLine = (phase: AdjustPhase, row: SeedGeom): AdjustLineDraft => {
  const regNo = row.regNo ?? '';
  const batch = regNo ? findBatch(regNo) : undefined;
  const view = batch ? forecastView(batch) : null;
  const quality = row.quality === undefined
    ? (batch ? COAL_TYPES[batch.coalType]?.quality ?? null : null)
    : row.quality;
  return {
    phase,
    zoneName: row.zoneName,
    layerId: row.layerId,
    seq: row.seq,
    regNo,
    batchNo: view?.batchNo ?? '',
    shipName: textOrEmpty(view?.shipName),
    voyage: textOrEmpty(view?.voyage),
    coalVariety: view?.coalVariety ?? '',
    coalKind: view?.coalKind ?? '',
    stockCoal: view?.stockCoalType ?? '',
    density: row.density,
    volume: row.volume,
    mass: row.mass ?? row.volume * row.density,
    volumeRatio: row.volumeRatio ?? null,
    pitchStart: row.pitchStart,
    pitchEnd: row.pitchEnd,
    heightStart: row.heightStart,
    heightEnd: row.heightEnd,
    cv: quality?.cv ?? null,
    sulfur: quality?.sulfur ?? null,
    ash: quality?.ash ?? null,
    volatile: quality?.volatile ?? null,
    moisture: quality?.moisture ?? null,
  };
};

const bindLines = (recordId: string, drafts: AdjustLineDraft[]): AdjustLine[] =>
  drafts.map((draft, index) => ({
    ...draft,
    id: `${recordId}-${index + 1}`,
    recordId,
  }));

const SHENHUN = 'gxsz-2026-054RCDJ2026081802';
const SHENHUN_Y2 = 'gxsz-2026-054RCDJ2026070501';
const MONGOLIAN = 'gxsz-2026-042RCDJ2026080501';
const RUSSIAN = 'gxsz-2026-054RCDJ2026072401';

const seedAdjust = (): { adjust: AdjustRecord[]; adjustDetails: AdjustLine[] } => {
  const tian = actorsOf('manual', '田略（燃料专责）', '');
  const wang = actorsOf('manual', '王值长（集控值长）', '');
  const records: AdjustRecord[] = [
    {
      id: 'AD-A0001',
      yardId: 'Y1',
      zoneName: '5 区、6 区、7 区',
      target: '#1 圆形煤场 · 5 区、6 区、7 区 · 共 3 层',
      action: '标记入厂批次',
      note: '一次标记 5 区、6 区、7 区共 3 个未识别煤层，统一关联神混 1 号',
      ...tian,
      time: '2026-08-24 08:12',
      createdAt: '2026-08-24 08:12',
    },
    {
      id: 'AD-A0002',
      yardId: 'Y2',
      zoneName: '18 区',
      target: '#2 圆形煤场 · 18 区 · 第 2 层',
      action: '拆分',
      note: '第 2 层 1,620 m³ 拆为 980 m³ + 640 m³',
      ...wang,
      time: '2026-08-23 15:48',
      createdAt: '2026-08-23 15:48',
    },
    {
      id: 'AD-A0003',
      yardId: 'Y1',
      zoneName: '8 区',
      target: '#1 圆形煤场 · 8 区 · 第 2 层',
      action: '更新煤层',
      note: '热值 5,200 → 5,450 kcal/kg，密度 0.850 → 0.880 t/m³',
      ...tian,
      time: '2026-08-22 16:40',
      createdAt: '2026-08-22 16:40',
    },
    {
      id: 'AD-A0004',
      yardId: 'Y1',
      zoneName: '28 区',
      target: '#1 圆形煤场 · 28 区 · 第 2 层',
      action: '拆分',
      note: '第 2 层 2,400 m³ 拆为 1,500 m³ + 900 m³，上层改挂神混 1 号',
      ...tian,
      time: '2026-08-21 10:18',
      createdAt: '2026-08-21 10:18',
    },
    {
      id: 'AD-A0005',
      yardId: 'Y1',
      zoneName: '10 区',
      target: '#1 圆形煤场 · 10 区 · 第 2 层',
      action: '合并上层',
      note: '第 3 层并入第 2 层，保留第 2 层批次归属',
      ...wang,
      time: '2026-08-20 09:26',
      createdAt: '2026-08-20 09:26',
    },
    {
      id: 'AD-A0006',
      yardId: 'Y1',
      zoneName: '5 区',
      target: '#1 圆形煤场 · 5 区 · 第 2 层',
      action: '合并下层',
      note: '第 2 层并入第 1 层，保留第 1 层批次归属',
      ...wang,
      time: '2026-08-19 15:02',
      createdAt: '2026-08-19 15:02',
    },
    {
      id: 'AD-A0007',
      yardId: 'Y1',
      zoneName: '22 区',
      target: '#1 圆形煤场 · 22 区 · 第 3 层',
      action: '清除',
      note: '表层已清除，未形成出入库记录',
      ...tian,
      time: '2026-08-18 11:36',
      createdAt: '2026-08-18 11:36',
    },
  ];
  const details: AdjustLine[] = [
    ...bindLines('AD-A0001', [
      seedLine('before', { zoneName: '5 区', layerId: 'L-Y1-05-3', seq: 3, volume: 860, density: 0.85, pitchStart: 8.6, pitchEnd: 10.4, heightStart: 12.2, heightEnd: 14.6 }),
      seedLine('after', { zoneName: '5 区', layerId: 'L-Y1-05-3', seq: 3, volume: 860, density: 0.85, pitchStart: 8.6, pitchEnd: 10.4, heightStart: 12.2, heightEnd: 14.6, regNo: SHENHUN }),
      seedLine('before', { zoneName: '6 区', layerId: 'L-Y1-06-3', seq: 3, volume: 860, density: 0.85, pitchStart: 8.6, pitchEnd: 10.4, heightStart: 12.2, heightEnd: 14.6 }),
      seedLine('after', { zoneName: '6 区', layerId: 'L-Y1-06-3', seq: 3, volume: 860, density: 0.85, pitchStart: 8.6, pitchEnd: 10.4, heightStart: 12.2, heightEnd: 14.6, regNo: SHENHUN }),
      seedLine('before', { zoneName: '7 区', layerId: 'L-Y1-07-2', seq: 2, volume: 640, density: 0.85, pitchStart: 6.2, pitchEnd: 8.6, heightStart: 9.4, heightEnd: 12.2 }),
      seedLine('after', { zoneName: '7 区', layerId: 'L-Y1-07-2', seq: 2, volume: 640, density: 0.85, pitchStart: 6.2, pitchEnd: 8.6, heightStart: 9.4, heightEnd: 12.2, regNo: SHENHUN }),
    ]),
    ...bindLines('AD-A0002', [
      seedLine('before', { zoneName: '18 区', layerId: 'L-Y2-18-2', seq: 2, volume: 1620, density: 0.85, pitchStart: 5.4, pitchEnd: 8.2, heightStart: 8.0, heightEnd: 11.6, regNo: SHENHUN_Y2 }),
      seedLine('after', { zoneName: '18 区', layerId: 'L-Y2-18-2', seq: 2, volume: 980, density: 0.85, pitchStart: 5.4, pitchEnd: 6.96, heightStart: 8.0, heightEnd: 10.1, regNo: SHENHUN_Y2, volumeRatio: 60.49 }),
      seedLine('after', { zoneName: '18 区', layerId: 'L-Y2-18-3', seq: 3, volume: 640, density: 0.85, pitchStart: 6.96, pitchEnd: 8.2, heightStart: 10.1, heightEnd: 11.6, regNo: SHENHUN_Y2, volumeRatio: 39.51 }),
    ]),
    ...bindLines('AD-A0003', [
      seedLine('before', {
        zoneName: '8 区', layerId: 'L-Y1-08-2', seq: 2, volume: 1280, density: 0.85,
        pitchStart: 4.8, pitchEnd: 7.1, heightStart: 7.2, heightEnd: 10.4, regNo: SHENHUN,
        quality: { cv: 5200, sulfur: 0.48, ash: 13.6, volatile: 29.1, moisture: 14.2 },
      }),
      seedLine('after', {
        zoneName: '8 区', layerId: 'L-Y1-08-2', seq: 2, volume: 1280, density: 0.88,
        pitchStart: 4.8, pitchEnd: 7.1, heightStart: 7.2, heightEnd: 10.4, regNo: SHENHUN,
        quality: { cv: 5450, sulfur: 0.4, ash: 11.8, volatile: 29.4, moisture: 12.6 },
      }),
    ]),
    ...bindLines('AD-A0004', [
      seedLine('before', { zoneName: '28 区', layerId: 'L-Y1-28-2', seq: 2, volume: 2400, density: 0.85, pitchStart: 6.0, pitchEnd: 9.4, heightStart: 8.8, heightEnd: 13.2, regNo: MONGOLIAN }),
      seedLine('after', { zoneName: '28 区', layerId: 'L-Y1-28-2', seq: 2, volume: 1500, density: 0.85, pitchStart: 6.0, pitchEnd: 8.1, heightStart: 8.8, heightEnd: 11.5, regNo: MONGOLIAN, volumeRatio: 62.5 }),
      seedLine('after', { zoneName: '28 区', layerId: 'L-Y1-28-3', seq: 3, volume: 900, density: 0.85, pitchStart: 8.1, pitchEnd: 9.4, heightStart: 11.5, heightEnd: 13.2, regNo: SHENHUN, volumeRatio: 37.5 }),
    ]),
    ...bindLines('AD-A0005', [
      seedLine('before', { zoneName: '10 区', layerId: 'L-Y1-10-2', seq: 2, volume: 1100, density: 0.85, pitchStart: 5.2, pitchEnd: 7.4, heightStart: 7.8, heightEnd: 10.6, regNo: SHENHUN }),
      seedLine('before', { zoneName: '10 区', layerId: 'L-Y1-10-3', seq: 3, volume: 640, density: 0.82, pitchStart: 7.4, pitchEnd: 8.8, heightStart: 10.6, heightEnd: 12.4, regNo: MONGOLIAN }),
      seedLine('after', { zoneName: '10 区', layerId: 'L-Y1-10-2', seq: 2, volume: 1740, density: 0.839, mass: 1459.8, pitchStart: 5.2, pitchEnd: 8.8, heightStart: 7.8, heightEnd: 12.4, regNo: SHENHUN }),
    ]),
    ...bindLines('AD-A0006', [
      seedLine('before', { zoneName: '5 区', layerId: 'L-Y1-05-1', seq: 1, volume: 3200, density: 0.86, pitchStart: 0, pitchEnd: 6.2, heightStart: 0, heightEnd: 9.4, regNo: RUSSIAN }),
      seedLine('before', { zoneName: '5 区', layerId: 'L-Y1-05-2', seq: 2, volume: 800, density: 0.85, pitchStart: 6.2, pitchEnd: 7.6, heightStart: 9.4, heightEnd: 11.2, regNo: SHENHUN }),
      seedLine('after', { zoneName: '5 区', layerId: 'L-Y1-05-1', seq: 1, volume: 4000, density: 0.858, mass: 3432, pitchStart: 0, pitchEnd: 7.6, heightStart: 0, heightEnd: 11.2, regNo: RUSSIAN }),
    ]),
    ...bindLines('AD-A0007', [
      seedLine('before', { zoneName: '22 区', layerId: 'L-Y1-22-3', seq: 3, volume: 420, density: 0.85, pitchStart: 9.1, pitchEnd: 10.6, heightStart: 13.0, heightEnd: 14.8 }),
    ]),
  ];
  return { adjust: records, adjustDetails: details };
};

const layerName = (layer: ComputedLayer) =>
  layer.raw.coalType ? coalTypeName(layer.raw.coalType) : '待标记';

export const createInitialLedger = (): LedgerState => {
  const zones = createZones();
  const computed = zones.map((zone) => computeZone(zone));
  const zoneOf = (yardId: string, zoneName: string) =>
    computed.find((zone) => zone.raw.yardId === yardId && zone.name === zoneName);

  const inbound: InboundRecord[] = [];
  const inboundDetails: InboundZoneDetail[] = [];
  const outbound: OutboundRecord[] = [];
  const outboundDetails: OutboundLayerDetail[] = [];

  const boundOf = (zone: ComputedZone | undefined) => {
    const top = zone?.layers[zone.layers.length - 1];
    return {
      pitchFrom: top?.bound.pitchBottom ?? 0,
      pitchTo: top?.bound.pitchTop ?? 0,
      heightFrom: top?.bound.heightBottom ?? 0,
      heightTo: top?.bound.heightTop ?? 0,
    };
  };

  INITIAL_MOVES.forEach((move) => {
    const batch = findBatch(move.regNo);
    if (move.type === 'in') {
      const id = `IN-${move.id}`;
      const mode: ProcessMode = move.source === 'survey-auto' ? 'auto' : 'manual';
      inbound.push({
        id,
        yardId: move.yardId,
        ...actorsOf(mode, move.id === 'M0008' ? '王值长（集控值长）' : '田略（燃料专责）', move.time),
        regNo: move.regNo,
        shipName: batch?.shipName ?? '',
        voyage: batch?.voyage ?? '',
        coalTypeName: move.coalTypeName,
        totalMass: move.mass,
        density: move.volume > 0 ? Number((move.mass / move.volume).toFixed(3)) : 0.85,
        note: move.note,
        mode: move.source === 'survey-auto' ? 'auto' : 'manual',
      });
      inboundDetails.push({
        id: `${id}-1`,
        recordId: id,
        zoneName: move.zoneName,
        volume: move.volume,
        mass: move.mass,
        ...boundOf(zoneOf(move.yardId, move.zoneName)),
      });
    }
    if (move.type === 'out') {
      const id = `OUT-${move.id}`;
      const mode: ProcessMode = move.source === 'survey-auto' ? 'auto' : 'manual';
      const zone = zoneOf(move.yardId, move.zoneName);
      const top = zone?.layers[zone.layers.length - 1];
      outbound.push({
        id,
        yardId: move.yardId,
        ...actorsOf(mode, '田略（燃料专责）', move.time),
        zoneName: move.zoneName,
        mass: move.mass,
        note: move.note,
        mode: move.source === 'survey-auto' ? 'auto' : 'manual',
      });
      outboundDetails.push({
        id: `${id}-1`,
        recordId: id,
        seq: top?.seq ?? 0,
        regNo: move.regNo || top?.raw.regNo || '',
        coalTypeName: move.coalTypeName,
        volume: move.volume,
        mass: move.mass,
        cut: move.id === 'M0007' ? 'all' : 'part',
      });
      if (move.id === 'M0007' && zone && zone.layers.length > 1) {
        const lower = zone.layers[zone.layers.length - 2];
        const partMass = Math.min(320, Number(lower.mass.toFixed(3)));
        outboundDetails.push({
          id: `${id}-2`,
          recordId: id,
          seq: lower.seq,
          regNo: lower.raw.regNo,
          coalTypeName: layerName(lower),
          volume: lower.raw.density > 0 ? partMass / lower.raw.density : 0,
          mass: partMass,
          cut: 'part',
        });
        outbound[outbound.length - 1].mass += partMass;
      }
    }
  });

  const manualInbound = inbound.find((row) => row.id === 'IN-M0005');
  const secondZone = zoneOf('Y1', '9 区');
  if (manualInbound && secondZone) {
    const extraMass = 417;
    const extraVolume = 490;
    manualInbound.totalMass += extraMass;
    inboundDetails.push({
      id: 'IN-M0005-2',
      recordId: manualInbound.id,
      zoneName: secondZone.name,
      volume: extraVolume,
      mass: extraMass,
      ...boundOf(secondZone),
    });
  }

  const { adjust, adjustDetails } = seedAdjust();

  const surveyed = seedSurvey(zones);
  const historyId = 'SV-Y1-0817';
  surveyed.survey.push({
    id: historyId,
    time: '2026-08-17 06:20',
    yardId: 'Y1',
    yardCode: 'Y1',
    yardName: '#1 圆形煤场',
  });
  [
    { code: '3', name: '3 区', last: 4200, delta: 620 },
    { code: '7', name: '7 区', last: 3800, delta: 480 },
    { code: '14', name: '14 区', last: 5100, delta: -520 },
    { code: '21', name: '21 区', last: 2900, delta: 700 },
    { code: '28', name: '28 区', last: 4600, delta: -340 },
    { code: '1', name: '1 区', last: 6100, delta: 0 },
  ].forEach((zone) => {
    surveyed.surveyDetails.push({
      id: `${historyId}-${zone.code}`,
      recordId: historyId,
      zoneCode: zone.code,
      zoneName: zone.name,
      volume: zone.last + zone.delta,
      lastVolume: zone.last,
      delta: zone.delta,
      applied: Math.abs(zone.delta) > 0.5,
    });
  });

  return {
    inbound: byTimeDesc(inbound),
    inboundDetails,
    outbound: byTimeDesc(outbound),
    outboundDetails,
    adjust: byTimeDesc(adjust),
    adjustDetails,
    survey: byTimeDesc(surveyed.survey),
    surveyDetails: surveyed.surveyDetails,
  };
};
