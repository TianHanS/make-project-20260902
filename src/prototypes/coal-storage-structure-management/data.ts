/**
 * 煤场存煤结构管理 · 领域数据与配色体系
 *
 * 示例存煤按作业带铺层：同一入厂批次在连续分区上取相同层厚，色带左右连贯。
 *
 * 配色规则：同一库存煤种使用同一颜色，不再按入厂登记编号区分色阶。
 * 未识别批次的煤层使用固定异常红 + 斜纹，兼顾色盲可辨识。
 *
 * 参考资料：
 * - /rules/design-guide.md
 * - /src/themes/antd-new/DESIGN-SPEC.md
 * - /src/prototypes/coal-unloading-management（入厂登记编号格式）
 * - 用户提供的存煤结构管理业务描述
 */

import * as geo from './geometry';
import type { YardShape, ZoneGeometry } from './geometry';

/* ============================ 煤种与煤质 ============================ */

export interface CoalQuality {
  /** 收到基低位发热量 kcal/kg */
  cv: number;
  /** 全硫 St,d % */
  sulfur: number;
  /** 灰分 Ad % */
  ash: number;
  /** 挥发分 Vdaf % */
  volatile: number;
  /** 全水分 Mt % */
  moisture: number;
}

export interface CoalTypeMeta {
  name: string;
  /** 色族：由深到浅的四阶工业色 */
  family: string[];
  quality: CoalQuality;
}

export const COAL_TYPES: Record<string, CoalTypeMeta> = {
  shenhun1: {
    name: '神混 1 号',
    family: ['#2f4f6f', '#3d6488', '#5580a6', '#7ba0bf'],
    quality: { cv: 5100, sulfur: 0.42, ash: 12.5, volatile: 30.2, moisture: 13.8 },
  },
  zhungeer: {
    name: '准格尔煤',
    family: ['#8a5a20', '#a8722e', '#c08f47', '#d4ac72'],
    quality: { cv: 4980, sulfur: 0.55, ash: 18.4, volatile: 27.6, moisture: 12.3 },
  },
  indoLignite: {
    name: '印尼褐煤',
    family: ['#6d3a2b', '#8a4c38', '#a76350', '#c1836f'],
    quality: { cv: 3980, sulfur: 0.18, ash: 6.2, volatile: 42.5, moisture: 28.6 },
  },
  russian: {
    name: '俄罗斯煤',
    family: ['#1f5a5a', '#2c7676', '#43918f', '#68aca9'],
    quality: { cv: 5480, sulfur: 0.35, ash: 10.8, volatile: 32.1, moisture: 10.2 },
  },
  mongolian: {
    name: '蒙煤',
    family: ['#4a4266', '#5f5583', '#7a6f9d', '#9a90b6'],
    quality: { cv: 5250, sulfur: 0.68, ash: 14.2, volatile: 25.8, moisture: 9.5 },
  },
};

/** 未识别煤层的固定异常红 */
export const UNMARKED_COLOR = '#cf1322';

/** 库存煤种与色值一一对应，名称和色值都全局唯一 */
export interface StockCoal {
  name: string;
  color: string;
}

/** 新库存煤种的推荐色板，已被占用的色值不能再绑到其他煤种 */
export const STOCK_COLOR_PRESETS = [
  '#3D6488',
  '#C08F47',
  '#8A4C38',
  '#2C7676',
  '#5F5583',
  '#3D7A4A',
  '#A33B4A',
  '#3A6EA5',
  '#8A6A2F',
  '#6B4C7A',
  '#2F6F6A',
  '#B85C38',
  '#4D6B8A',
  '#7A4E3A',
  '#3E7D8C',
  '#9A4D6A',
] as const;

export const normalizeColor = (input: string) => {
  const matched = input.trim().match(/^#?([0-9a-fA-F]{6})(?:[0-9a-fA-F]{2})?$/);
  return matched ? `#${matched[1].toUpperCase()}` : '';
};

const hslToHex = (hue: number, saturation: number, lightness: number) => {
  const sat = saturation / 100;
  const lig = lightness / 100;
  const chroma = sat * Math.min(lig, 1 - lig);
  const channel = (offset: number) => {
    const position = (offset + hue / 30) % 12;
    const value = lig - chroma * Math.max(-1, Math.min(position - 3, Math.min(9 - position, 1)));
    return Math.round(255 * value).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`.toUpperCase();
};

/** 给新库存煤种分配一个尚未占用的色值，优先用推荐色板 */
export const pickDefaultColor = (coals: StockCoal[], exceptName = '') => {
  const used = new Set(
    coals.filter((item) => item.name !== exceptName).map((item) => normalizeColor(item.color)),
  );
  const preset = STOCK_COLOR_PRESETS.find((item) => !used.has(item));
  if (preset) return preset;
  for (let index = 0; index < 360; index += 1) {
    const color = hslToHex((index * 47) % 360, 46, 46);
    if (!used.has(color)) return color;
  }
  return '#5B6B7A';
};

/**
 * 选择已有煤种且未手动改色时带出其颜色；
 * 新煤种或当前色已被其他煤种占用时，自动分配未占用色值。
 */
export const colorForStockName = (
  nameInput: string,
  colorInput: string,
  coals: StockCoal[],
  colorTouched: boolean,
) => {
  const trimmed = nameInput.trim();
  if (!trimmed) return '';
  const current = normalizeColor(colorInput);
  const hit = coals.find((item) => item.name === trimmed);
  const takenByOther = Boolean(current) && coals.some(
    (item) => normalizeColor(item.color) === current && item.name !== trimmed,
  );
  if (hit && !colorTouched) return normalizeColor(hit.color);
  if (!current || (!colorTouched && takenByOther)) return pickDefaultColor(coals, trimmed);
  return current;
};

export const validateStockAssignment = (
  nameInput: string,
  colorInput: string,
  coals: StockCoal[],
): { ok: true; name: string; color: string } | { ok: false; message: string } => {
  const name = nameInput.trim();
  if (!name) return { ok: false, message: '请选择或输入库存煤种' };
  if (name.length > 30) return { ok: false, message: '库存煤种不超过 30 个字' };
  const color = normalizeColor(colorInput);
  if (!color) return { ok: false, message: '请选择色值' };
  const owner = coals.find((item) => normalizeColor(item.color) === color && item.name !== name);
  if (owner) return { ok: false, message: `色值 ${color} 已用于库存煤种「${owner.name}」` };
  return { ok: true, name, color };
};

export const initialStockCoals = (): StockCoal[] =>
  Object.values(COAL_TYPES).map((meta) => ({
    name: meta.name,
    color: normalizeColor(meta.family[0]),
  }));

export const upsertStockCoal = (coals: StockCoal[], name: string, color: string): StockCoal[] => {
  const next = normalizeColor(color);
  return coals.some((item) => item.name === name)
    ? coals.map((item) => (item.name === name ? { ...item, color: next } : item))
    : [...coals, { name, color: next }];
};

/* ============================ 入厂批次台账 ============================ */

export interface ArrivalBatch {
  /** 入厂登记编号（唯一标识） */
  regNo: string;
  shipName: string;
  voyage: string;
  coalType: string;
  /** 卸煤煤量 t */
  unloadedMass: number;
  /** 卸煤完成日期 */
  unloadedAt: string;
  /** 卸入煤场 */
  yardId: string;
  /** 色阶序号（同煤种内区分入厂批次） */
  tint: number;
  /**
   * 计划上的库存煤种。未写该字段时视为已填，取煤种名称；
   * 空字符串表示计划未填，入库时要补选或手填。
   */
  stockCoalType?: string;
}

export const ARRIVAL_BATCHES: ArrivalBatch[] = [
  {
    regNo: 'gxsz-2026-054RCDJ2026061201',
    shipName: '神华壹号',
    voyage: 'V2606',
    coalType: 'shenhun1',
    unloadedMass: 28900,
    unloadedAt: '2026-06-14',
    yardId: 'Y1',
    tint: 0,
  },
  {
    regNo: 'gxsz-2026-054RCDJ2026062801',
    shipName: 'SAMUDRA JAYA',
    voyage: 'V115',
    coalType: 'indoLignite',
    unloadedMass: 30600,
    unloadedAt: '2026-06-30',
    yardId: 'Y1',
    tint: 0,
  },
  {
    regNo: 'gxsz-2026-054RCDJ2026070902',
    shipName: '准能海运',
    voyage: 'V0703',
    coalType: 'zhungeer',
    unloadedMass: 39100,
    unloadedAt: '2026-07-11',
    yardId: 'Y1',
    tint: 0,
  },
  {
    regNo: 'gxsz-2026-054RCDJ2026072401',
    shipName: 'KAPITAN NAZAROV',
    voyage: 'V208',
    coalType: 'russian',
    unloadedMass: 26800,
    unloadedAt: '2026-07-26',
    yardId: 'Y1',
    tint: 0,
  },
  {
    regNo: 'gxsz-2026-042RCDJ2026080501',
    shipName: '蒙运陆运（汽运）',
    voyage: '—',
    coalType: 'mongolian',
    unloadedMass: 29700,
    unloadedAt: '2026-08-06',
    yardId: 'Y1',
    tint: 0,
  },
  {
    regNo: 'gxsz-2026-054RCDJ2026081802',
    shipName: '神华叁号',
    voyage: 'V2619',
    coalType: 'shenhun1',
    unloadedMass: 21400,
    unloadedAt: '2026-08-19',
    yardId: 'Y1',
    tint: 1,
    stockCoalType: '',
  },
  {
    regNo: 'gxsz-2026-054RCDJ2026070501',
    shipName: '国信海运',
    voyage: 'V0705',
    coalType: 'shenhun1',
    unloadedMass: 24600,
    unloadedAt: '2026-07-07',
    yardId: 'Y2',
    tint: 2,
  },
  {
    regNo: 'gxsz-2026-054RCDJ2026072202',
    shipName: 'SAMUDRA BARU',
    voyage: 'V121',
    coalType: 'indoLignite',
    unloadedMass: 18900,
    unloadedAt: '2026-07-24',
    yardId: 'Y2',
    tint: 1,
  },
  {
    regNo: 'gxsz-2026-054RCDJ2026080901',
    shipName: '准能海运',
    voyage: 'V0809',
    coalType: 'zhungeer',
    unloadedMass: 22300,
    unloadedAt: '2026-08-11',
    yardId: 'Y2',
    tint: 1,
  },
  {
    regNo: 'gxsz-2026-054RCDJ2026082001',
    shipName: 'KAPITAN VOLKOV',
    voyage: 'V214',
    coalType: 'russian',
    unloadedMass: 9800,
    unloadedAt: '2026-08-21',
    yardId: 'Y2',
    tint: 1,
    stockCoalType: '',
  },
  {
    regNo: 'gxsz-2026-042RCDJ2026071801',
    shipName: '蒙运陆运（汽运）',
    voyage: '—',
    coalType: 'mongolian',
    unloadedMass: 12600,
    unloadedAt: '2026-07-19',
    yardId: 'Y3',
    tint: 1,
  },
  {
    regNo: 'gxsz-2026-042RCDJ2026080301',
    shipName: '准能海运',
    voyage: 'V0803',
    coalType: 'zhungeer',
    unloadedMass: 8400,
    unloadedAt: '2026-08-04',
    yardId: 'Y3',
    tint: 2,
  },
];

/** 本次盘煤周期（周期内入厂批次参与新增煤层的批次匹配） */
export const SURVEY_PERIOD = { from: '2026-08-17', to: '2026-08-24' };

/** 自动识别批次时允许的堆积密度区间 t/m³ */
export const DENSITY_RANGE = { min: 0.78, max: 0.95 };

/** 平台配置的默认燃煤计算密度 t/m³ */
export const DEFAULT_DENSITY = 0.85;

export const findBatch = (regNo: string) => ARRIVAL_BATCHES.find((b) => b.regNo === regNo);

const COAL_VARIETY: Record<string, string> = {
  shenhun1: '烟煤',
  zhungeer: '烟煤',
  indoLignite: '褐煤',
  russian: '烟煤',
  mongolian: '烟煤',
};

/** 把填写值收成煤种键；手填的新名称原样保留 */
export const resolveCoalKey = (value: string) => {
  const hit = Object.entries(COAL_TYPES).find(([key, meta]) => key === value || meta.name === value);
  return hit?.[0] ?? value;
};

/** 来煤预报回显：批次号、车船号、航次、煤品种、煤种、库存煤种 */
export const forecastView = (batch: ArrivalBatch) => {
  const coalKind = COAL_TYPES[batch.coalType]?.name ?? batch.coalType;
  const stockCoalType = batch.stockCoalType === undefined ? coalKind : batch.stockCoalType;
  return {
    batchNo: `PC${batch.unloadedAt.replace(/-/g, '')}`,
    shipName: batch.shipName,
    voyage: batch.voyage,
    coalVariety: COAL_VARIETY[batch.coalType] ?? '烟煤',
    coalKind,
    stockCoalType,
    stockFilled: stockCoalType.trim().length > 0,
  };
};

/** 计划表里已经出现过的库存煤种，供未填写时下拉 */
export const stockCoalOptions = (batches: ArrivalBatch[]) =>
  [...new Set(batches.map((batch) => forecastView(batch).stockCoalType.trim()).filter(Boolean))];

/** 入厂登记编号的短标签，用于色块等窄空间 */
export const shortRegNo = (regNo: string) => (regNo ? regNo.slice(-12) : '');

/* ============================ 煤场 / 分区 / 煤层 ============================ */

export type LayerStatus = 'marked' | 'unmarked';

export interface CoalLayer {
  id: string;
  /** 入厂登记编号，未识别时为空 */
  regNo: string;
  shipName: string;
  voyage: string;
  /** 库存煤种 key，未识别时为空 */
  coalType: string;
  quality: CoalQuality | null;
  /** 层体积 m³ */
  volume: number;
  /** 堆积密度 t/m³ */
  density: number;
  status: LayerStatus;
  /** 堆煤日期 */
  stackedAt: string;
  /** 色阶序号 */
  tint: number;
  /** 是否人工调整过 */
  adjusted?: boolean;
  /** 库存煤种色值。未写时回退到煤种色族的基准色 */
  color?: string;
}

export interface CoalZone {
  id: string;
  yardId: string;
  /** 分区序号 1~N，界面按此增序自左向右排列 */
  code: number;
  name: string;
  geometry: ZoneGeometry;
  /** 上次盘煤体积 m³ */
  lastSurveyVolume: number;
  /** 本次盘煤体积 m³（作为存煤煤量上限） */
  surveyVolume: number;
  /** 自下而上的煤层序列 */
  layers: CoalLayer[];
}

export interface CoalYard {
  id: string;
  name: string;
  shortName: string;
  /** 圆形 / 条形 */
  shape: YardShape;
  /** 分区数量：圆形 36，条形 3 */
  zoneCount: number;
  /** 是否具备激光盘煤数据源 */
  hasSurvey: boolean;
  /** 已启用的煤场才进入下拉 */
  enabled: boolean;
  /** 本煤场是否按盘煤体积自动更新存煤结构。未配备盘煤仪时无效 */
  autoUpdateByVolume: boolean;
  /** 本次盘煤时间 */
  surveyAt: string;
  /** 上次盘煤时间 */
  lastSurveyAt: string;
  density: number;
}

export const YARDS: CoalYard[] = [
  {
    id: 'Y1',
    name: '#1 圆形煤场（Φ130 m · 36 分区 · 每区 10°）',
    shortName: '#1 圆形煤场',
    shape: 'circular',
    zoneCount: 36,
    hasSurvey: true,
    enabled: true,
    autoUpdateByVolume: false,
    surveyAt: '2026-08-24 06:30',
    lastSurveyAt: '2026-08-17 06:30',
    density: DEFAULT_DENSITY,
  },
  {
    id: 'Y2',
    name: '#2 圆形煤场（Φ130 m · 36 分区 · 每区 10°）',
    shortName: '#2 圆形煤场',
    shape: 'circular',
    zoneCount: 36,
    hasSurvey: true,
    enabled: true,
    autoUpdateByVolume: false,
    surveyAt: '2026-08-24 07:10',
    lastSurveyAt: '2026-08-17 07:10',
    density: DEFAULT_DENSITY,
  },
  {
    id: 'Y3',
    name: '厂外中转煤场（条形 · 3 分区 · 无盘煤数据源）',
    shortName: '厂外中转煤场',
    shape: 'strip',
    zoneCount: 3,
    hasSurvey: false,
    enabled: true,
    autoUpdateByVolume: false,
    surveyAt: '—',
    lastSurveyAt: '—',
    density: 0.82,
  },
];

/** 已启用煤场，下拉只加载这些 */
export const enabledYards = () => YARDS.filter((yard) => yard.enabled);

/**
 * 系统 PUBLIC 分组：是否配置盘煤仪。
 * 为否时，配置信息抽屉不展示「自动根据体积更新库存」。
 */
export const SURVEY_INSTRUMENT_CONFIGURED = true;

/** 默认密度维护入口的按钮权限。无权限时不展示按钮 */
export const CAN_MAINTAIN_DEFAULT_DENSITY = true;

/** 系统参数：PUBLIC / DEFAUT_DENSITY、PUBLIC / VOLUME_LIMIT */
export const DENSITY_PARAM_GROUP = 'PUBLIC';
export const DENSITY_PARAM_KEY = 'DEFAUT_DENSITY';
export const VOLUME_LIMIT_PARAM_KEY = 'VOLUME_LIMIT';
/** 分区盘煤体积变动达到该值（m³）才视为存煤量变动 */
export const DEFAULT_VOLUME_LIMIT = 10;

export interface DensityConfig {
  /** 密度 t/m³，0.8～1.2，三位小数 */
  density: number;
  /** 启用后按各分区盘煤体积自动更新存煤结构 */
  autoUpdateByVolume: boolean;
  /** 体积变动有效阈值 m³，正整数。PUBLIC / VOLUME_LIMIT */
  volumeLimit: number;
}

const YARD_STORAGE_KEY = 'cssm-last-yard-id';
const DENSITY_STORAGE_KEY = 'cssm-public-defaut-density';
const YARD_AUTO_STORAGE_KEY = 'cssm-yard-auto-update';

const clampVolumeLimit = (value: number) => {
  const rounded = Math.round(value);
  if (!Number.isFinite(rounded) || rounded < 1) return DEFAULT_VOLUME_LIMIT;
  return rounded;
};

const clampDensity = (value: number) => {
  const rounded = Math.round(value * 1000) / 1000;
  if (!Number.isFinite(rounded) || rounded < 0.8 || rounded > 1.2) return DEFAULT_DENSITY;
  return rounded;
};

export const readLastYardId = () => {
  try {
    const id = localStorage.getItem(YARD_STORAGE_KEY);
    if (id && enabledYards().some((yard) => yard.id === id)) return id;
  } catch {
    /* 读取失败时回退到第一个已启用煤场 */
  }
  return enabledYards()[0]?.id ?? YARDS[0].id;
};

export const readYardAutoFlags = (): Record<string, boolean> => {
  const base = Object.fromEntries(YARDS.map((yard) => [yard.id, yard.autoUpdateByVolume]));
  try {
    const raw = localStorage.getItem(YARD_AUTO_STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    YARDS.forEach((yard) => {
      if (!yard.hasSurvey) base[yard.id] = false;
      else if (typeof parsed[yard.id] === 'boolean') base[yard.id] = parsed[yard.id];
    });
  } catch {
    /* 回退煤场默认值 */
  }
  return base;
};

export const writeYardAutoFlag = (yardId: string, enabled: boolean) => {
  const next = { ...readYardAutoFlags(), [yardId]: enabled };
  try {
    localStorage.setItem(YARD_AUTO_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* 原型环境可能禁用本地存储 */
  }
  return next;
};

export const writeLastYardId = (yardId: string) => {
  try {
    localStorage.setItem(YARD_STORAGE_KEY, yardId);
  } catch {
    /* 原型环境可能禁用本地存储 */
  }
};

export const readDensityConfig = (): DensityConfig => {
  const fallback: DensityConfig = {
    density: DEFAULT_DENSITY,
    autoUpdateByVolume: false,
    volumeLimit: DEFAULT_VOLUME_LIMIT,
  };
  try {
    const raw = localStorage.getItem(DENSITY_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as {
      density?: number | { value?: number };
      volumeLimit?: number | { value?: number };
      autoUpdateByVolume?: boolean;
    };
    const densityValue = typeof parsed.density === 'number' ? parsed.density : parsed.density?.value;
    const limitValue = typeof parsed.volumeLimit === 'number' ? parsed.volumeLimit : parsed.volumeLimit?.value;
    return {
      density: clampDensity(Number(densityValue)),
      autoUpdateByVolume: SURVEY_INSTRUMENT_CONFIGURED ? Boolean(parsed.autoUpdateByVolume) : false,
      volumeLimit: clampVolumeLimit(Number(limitValue)),
    };
  } catch {
    return fallback;
  }
};

export const writeDensityConfig = (config: DensityConfig) => {
  const next: DensityConfig = {
    density: clampDensity(config.density),
    autoUpdateByVolume: SURVEY_INSTRUMENT_CONFIGURED ? config.autoUpdateByVolume : false,
    volumeLimit: clampVolumeLimit(config.volumeLimit),
  };
  try {
    localStorage.setItem(
      DENSITY_STORAGE_KEY,
      JSON.stringify({
        group: DENSITY_PARAM_GROUP,
        density: { key: DENSITY_PARAM_KEY, value: next.density },
        volumeLimit: { key: VOLUME_LIMIT_PARAM_KEY, value: next.volumeLimit },
        autoUpdateByVolume: next.autoUpdateByVolume,
      }),
    );
  } catch {
    /* 原型环境可能禁用本地存储 */
  }
  return next;
};

export interface SurveyRecord {
  id: string;
  surveyedAt: string;
  /** 各分区盘煤体积合计 m³ */
  volume: number;
  /** 相对上一次盘煤的体积差；最早一条没有对照 */
  delta: number | null;
  /** current 取本次盘煤体积，previous 取上次 */
  snapshot: 'current' | 'previous';
}

/** 当前煤场的盘煤记录。未配置盘煤数据源时为空 */
export const buildSurveyRecords = (yard: CoalYard, zones: CoalZone[]): SurveyRecord[] => {
  if (!yard.hasSurvey) return [];
  const mine = zones.filter((zone) => zone.yardId === yard.id);
  const current = mine.reduce((sum, zone) => sum + zone.surveyVolume, 0);
  const previous = mine.reduce((sum, zone) => sum + zone.lastSurveyVolume, 0);
  return [
    {
      id: `${yard.id}-current`,
      surveyedAt: yard.surveyAt,
      volume: current,
      delta: current - previous,
      snapshot: 'current',
    },
    {
      id: `${yard.id}-previous`,
      surveyedAt: yard.lastSurveyAt,
      volume: previous,
      delta: null,
      snapshot: 'previous',
    },
  ];
};

export const yardGeometry = (yard: CoalYard): ZoneGeometry =>
  yard.shape === 'strip'
    ? geo.stripZoneGeometry(yard.zoneCount)
    : geo.circularZoneGeometry(yard.zoneCount);

export const shapeLabel = (shape: YardShape) => (shape === 'strip' ? '条形' : '圆形');

let layerSeq = 0;
export const nextLayerId = () => {
  layerSeq += 1;
  return `L${String(layerSeq).padStart(4, '0')}`;
};

let recordSeq = 1000;
export const nextRecordId = (prefix: string) => {
  recordSeq += 1;
  return `${prefix}${recordSeq}`;
};

/**
 * 堆煤作业带：同一入厂批次在连续分区上铺同一层厚。
 * 相邻分区的同批煤层高度近似、色带连贯，符合回转 / 走行连续作业。
 */
interface StackCampaign {
  /** 入厂登记编号，空字符串表示待标记 */
  regNo: string;
  from: number;
  to: number;
  /** 该作业带在各分区上的层厚 m，同批取同一值 */
  thickness: number;
}

const YARD_CAMPAIGNS: Record<string, StackCampaign[]> = {
  Y1: [
    { regNo: 'gxsz-2026-054RCDJ2026061201', from: 1, to: 16, thickness: 5.4 },
    { regNo: 'gxsz-2026-054RCDJ2026062801', from: 8, to: 22, thickness: 3.6 },
    { regNo: 'gxsz-2026-054RCDJ2026070902', from: 17, to: 30, thickness: 4.2 },
    { regNo: 'gxsz-2026-054RCDJ2026072401', from: 24, to: 34, thickness: 3.0 },
    { regNo: 'gxsz-2026-042RCDJ2026080501', from: 28, to: 36, thickness: 3.6 },
    { regNo: 'gxsz-2026-054RCDJ2026081802', from: 1, to: 10, thickness: 3.2 },
    { regNo: '', from: 5, to: 7, thickness: 1.6 },
    { regNo: '', from: 22, to: 22, thickness: 1.6 },
  ],
  Y2: [
    { regNo: 'gxsz-2026-054RCDJ2026070501', from: 1, to: 18, thickness: 5.0 },
    { regNo: 'gxsz-2026-054RCDJ2026072202', from: 12, to: 26, thickness: 3.8 },
    { regNo: 'gxsz-2026-054RCDJ2026080901', from: 22, to: 34, thickness: 4.0 },
    { regNo: 'gxsz-2026-054RCDJ2026082001', from: 30, to: 36, thickness: 2.6 },
    { regNo: '', from: 12, to: 12, thickness: 1.4 },
  ],
  Y3: [
    { regNo: 'gxsz-2026-042RCDJ2026071801', from: 1, to: 2, thickness: 6.5 },
    { regNo: 'gxsz-2026-042RCDJ2026080301', from: 1, to: 2, thickness: 4.0 },
    { regNo: '', from: 2, to: 2, thickness: 2.0 },
  ],
};

const makeLayerFrom = (
  regNo: string,
  volume: number,
  density: number,
  stackedAt: string,
): CoalLayer => {
  const batch = findBatch(regNo);
  if (!batch) {
    return {
      id: nextLayerId(),
      regNo: '',
      shipName: '',
      voyage: '',
      coalType: '',
      quality: null,
      volume,
      density,
      status: 'unmarked',
      stackedAt,
      tint: 0,
    };
  }
  return {
    id: nextLayerId(),
    regNo: batch.regNo,
    shipName: batch.shipName,
    voyage: batch.voyage,
    coalType: batch.coalType,
    quality: COAL_TYPES[batch.coalType].quality,
    volume,
    density,
    status: 'marked',
    stackedAt,
    tint: batch.tint,
  };
};

export const createZones = (): CoalZone[] => {
  const zones: CoalZone[] = [];
  YARDS.forEach((yard) => {
    const geometry = yardGeometry(yard);
    const campaigns = YARD_CAMPAIGNS[yard.id] ?? [];

    for (let code = 1; code <= yard.zoneCount; code += 1) {
      const layers: CoalLayer[] = [];
      let height = 0;

      campaigns.forEach((campaign) => {
        if (code < campaign.from || code > campaign.to) return;
        const heightBottom = height;
        const heightTop = Math.min(geometry.maxStackHeight, height + campaign.thickness);
        const thickness = heightTop - heightBottom;
        if (thickness < 0.05) return;
        const volume =
          geo.stackVolume(geometry, heightTop) - geo.stackVolume(geometry, heightBottom);
        const batch = campaign.regNo ? findBatch(campaign.regNo) : undefined;
        layers.push(
          makeLayerFrom(
            campaign.regNo,
            volume,
            yard.density,
            campaign.regNo ? (batch?.unloadedAt ?? SURVEY_PERIOD.to) : SURVEY_PERIOD.to,
          ),
        );
        height = heightTop;
      });

      const total = layers.reduce((s, l) => s + l.volume, 0);
      zones.push({
        id: `${yard.id}-${code}`,
        yardId: yard.id,
        code,
        name: `${code} 区`,
        geometry,
        lastSurveyVolume: total,
        surveyVolume: total,
        layers,
      });
    }
  });
  return zones;
};

/**
 * 盘煤比对向导的体积变动预填：圆形煤场按扇区连续作业，
 * 一个盘煤周期内通常只有少数几个扇区发生堆取。条形场无盘煤数据源。
 */
export const SURVEY_DELTA_PLAN: Record<string, Record<number, number>> = {
  Y1: { 3: 620, 7: 480, 14: -520, 21: 700, 28: -340, 33: 410 },
  Y2: { 5: 540, 11: -460, 18: 390, 24: 280, 31: -300 },
  Y3: {},
};

/* ============================ 台账记录 ============================ */

export type MoveType = 'in' | 'out' | 'adjust';
export type MoveSource = 'survey-auto' | 'manual' | 'mark' | 'split' | 'merge' | 'delete';

export interface StockMove {
  id: string;
  time: string;
  type: MoveType;
  yardId: string;
  zoneName: string;
  regNo: string;
  coalTypeName: string;
  volume: number;
  mass: number;
  source: MoveSource;
  note: string;
}

export interface AuditLog {
  id: string;
  time: string;
  operator: string;
  target: string;
  action: string;
  before: string;
  after: string;
}

export const INITIAL_MOVES: StockMove[] = [
  {
    id: 'M0001',
    time: '2026-08-19 21:40',
    type: 'in',
    yardId: 'Y1',
    zoneName: '31 区',
    regNo: 'gxsz-2026-054RCDJ2026081802',
    coalTypeName: '神混 1 号',
    volume: 2620,
    mass: 2227,
    source: 'survey-auto',
    note: '盘煤体积增加，按周期内入厂批次自动识别',
  },
  {
    id: 'M0002',
    time: '2026-08-22 09:15',
    type: 'out',
    yardId: 'Y1',
    zoneName: '14 区',
    regNo: 'gxsz-2026-054RCDJ2026070902',
    coalTypeName: '准格尔煤',
    volume: 860,
    mass: 731,
    source: 'manual',
    note: '上煤取料，按后进先出扣减顶层煤量',
  },
  {
    id: 'M0003',
    time: '2026-08-24 06:35',
    type: 'in',
    yardId: 'Y1',
    zoneName: '19 区',
    regNo: '',
    coalTypeName: '待标记',
    volume: 1180,
    mass: 1003,
    source: 'survey-auto',
    note: '匹配密度超出合理区间，生成待标记煤层',
  },
  {
    id: 'M0004',
    time: '2026-08-24 07:15',
    type: 'in',
    yardId: 'Y2',
    zoneName: '12 区',
    regNo: '',
    coalTypeName: '待标记',
    volume: 640,
    mass: 544,
    source: 'survey-auto',
    note: '周期内无可匹配入厂批次，生成待标记煤层',
  },
  {
    id: 'M0005',
    time: '2026-08-21 14:20',
    type: 'in',
    yardId: 'Y1',
    zoneName: '8 区',
    regNo: 'gxsz-2026-054RCDJ2026070902',
    coalTypeName: '准格尔煤',
    volume: 980,
    mass: 833,
    source: 'manual',
    note: '人工入库，来煤预报已选择',
  },
  {
    id: 'M0006',
    time: '2026-08-24 06:42',
    type: 'out',
    yardId: 'Y1',
    zoneName: '14 区',
    regNo: 'gxsz-2026-054RCDJ2026062801',
    coalTypeName: '印尼褐煤',
    volume: 520,
    mass: 442,
    source: 'survey-auto',
    note: '盘煤体积减少，按后进先出自动扣减',
  },
  {
    id: 'M0007',
    time: '2026-08-23 11:05',
    type: 'out',
    yardId: 'Y1',
    zoneName: '17 区',
    regNo: 'gxsz-2026-054RCDJ2026070902',
    coalTypeName: '准格尔煤',
    volume: 1460,
    mass: 1241,
    source: 'manual',
    note: '上煤取料，表层全部扣减，下一层部分扣减',
  },
  {
    id: 'M0008',
    time: '2026-08-22 10:08',
    type: 'in',
    yardId: 'Y2',
    zoneName: '6 区',
    regNo: 'gxsz-2026-054RCDJ2026070501',
    coalTypeName: '神混 1 号',
    volume: 760,
    mass: 646,
    source: 'manual',
    note: '人工入库',
  },
  {
    id: 'M0009',
    time: '2026-08-24 07:18',
    type: 'out',
    yardId: 'Y2',
    zoneName: '18 区',
    regNo: 'gxsz-2026-054RCDJ2026072202',
    coalTypeName: '印尼褐煤',
    volume: 460,
    mass: 391,
    source: 'survey-auto',
    note: '盘煤体积减少，按后进先出自动扣减',
  },
];

export const INITIAL_AUDIT: AuditLog[] = [
  {
    id: 'A0001',
    time: '2026-08-24 08:12',
    operator: '田略（燃料专责）',
    target: '#1 圆形煤场 · 31 区 · 第 3 层',
    action: '标记存煤批次',
    before: '待标记',
    after: 'gxsz-2026-054RCDJ2026081802 / 神混 1 号',
  },
  {
    id: 'A0002',
    time: '2026-08-23 15:48',
    operator: '王值长（集控值长）',
    target: '#2 圆形煤场 · 18 区 · 第 2 层',
    action: '分层拆分',
    before: '1 层 · 1 620 m³',
    after: '2 层 · 980 m³ + 640 m³',
  },
  {
    id: 'A0003',
    time: '2026-08-22 16:40',
    operator: '田略（燃料专责）',
    target: '#1 圆形煤场 · 8 区 · 第 2 层',
    action: '更新煤层',
    before: '热值 5 200 kcal/kg · 密度 0.850 t/m³',
    after: '热值 5 450 kcal/kg · 密度 0.880 t/m³',
  },
  {
    id: 'A0004',
    time: '2026-08-21 10:18',
    operator: '田略（燃料专责）',
    target: '#1 圆形煤场 · 28 区 · 第 2 层',
    action: '拆分',
    before: '1 层 · 2 400 m³',
    after: '2 层 · 1 500 m³ + 900 m³',
  },
  {
    id: 'A0005',
    time: '2026-08-20 09:26',
    operator: '王值长（集控值长）',
    target: '#1 圆形煤场 · 10 区 · 第 2 层',
    action: '合并上层',
    before: '第 2 层 1 100 m³ + 第 3 层 640 m³',
    after: '第 2 层 1 740 m³，保留第 2 层批次',
  },
  {
    id: 'A0006',
    time: '2026-08-19 15:02',
    operator: '王值长（集控值长）',
    target: '#1 圆形煤场 · 5 区 · 第 2 层',
    action: '合并下层',
    before: '第 1 层 3 200 m³ + 第 2 层 800 m³',
    after: '第 1 层 4 000 m³，保留第 1 层批次',
  },
  {
    id: 'A0007',
    time: '2026-08-18 11:36',
    operator: '田略（燃料专责）',
    target: '#1 圆形煤场 · 22 区 · 第 3 层',
    action: '清除',
    before: '待标记 · 420 m³',
    after: '表层已清除，未形成出入库记录',
  },
];

/* ============================ 展示字段与配色 ============================ */

export interface LabelField {
  key: string;
  label: string;
  unit?: string;
}

/** 存煤视图中各煤层的缩略展示信息，默认库存煤种 */
export const LABEL_FIELDS: LabelField[] = [
  { key: 'coalType', label: '库存煤种' },
  { key: 'ship', label: '车船号' },
  { key: 'voyage', label: '航次' },
  { key: 'cv', label: '热值', unit: 'kcal/kg' },
  { key: 'volume', label: '体积', unit: 'm³' },
  { key: 'pitchStart', label: '起始角度', unit: '°' },
  { key: 'heightStart', label: '起始高度', unit: 'm' },
  { key: 'regNo', label: '入厂登记编号' },
];

export const DEFAULT_LABEL_KEY = 'coalType';

/** 煤层取色：同一库存煤种固定一种颜色，优先用配置过的色值 */
export const layerColor = (layer: CoalLayer) => {
  if (layer.status === 'unmarked' || !layer.coalType) return UNMARKED_COLOR;
  if (layer.color) return layer.color;
  const family = COAL_TYPES[layer.coalType]?.family;
  if (!family?.length) return UNMARKED_COLOR;
  return family[0];
};

/** 同一库存煤种改色后，所有使用该煤种的煤层一起变色 */
export const paintStockColor = (zones: CoalZone[], name: string, color: string): CoalZone[] =>
  zones.map((zone) => ({
    ...zone,
    layers: zone.layers.map((layer) =>
      layer.coalType && coalTypeName(layer.coalType) === name ? { ...layer, color } : layer,
    ),
  }));

/** 依据背景亮度选择前景色，保证 WCAG AA 对比度 */
export const readableText = (hex: string) => {
  const v = hex.replace('#', '');
  const rgb = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
  const lin = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  return lum > 0.42 ? 'rgba(0, 0, 0, 0.88)' : '#ffffff';
};

export const coalTypeName = (key: string) => {
  if (!key) return '待标记';
  return COAL_TYPES[key]?.name ?? key;
};

/** 千分位 + 固定小数，数字统一等宽显示 */
export const fmt = (value: number, digits = 0) =>
  value.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
