/**
 * 煤场存煤结构管理 · 计算模型与业务规则
 *
 * 承载四类规则：
 * 1. 分层几何派生：层体积 → 累计体积 → 标高 → 起始/结束俯仰角
 * 2. 盘煤比对：体积增加按周期内入厂批次做全煤场密度匹配；体积减少自上而下扣减
 * 3. 出入库：入库在顶层新增煤层（可多分区同时铺层）；出库按后进先出扣减
 * 4. 分层维护：拆分、合并上层/下层、删除表层、标记未识别煤层
 *
 * 参考资料：
 * - 用户提供的存煤结构管理业务描述
 * - /rules/development-standards.md
 */

import * as geo from './geometry';
import {
  COAL_TYPES,
  DENSITY_RANGE,
  type ArrivalBatch,
  type CoalLayer,
  type CoalZone,
  coalTypeName,
  findBatch,
  layerColor,
  nextLayerId,
} from './data';

/* ============================ 派生模型 ============================ */

export interface ComputedLayer {
  raw: CoalLayer;
  id: string;
  /** 自下而上层序，1 为贴地底层 */
  seq: number;
  volume: number;
  mass: number;
  color: string;
  /** 层厚 m */
  thickness: number;
  bound: geo.LayerBoundary;
}

export interface ComputedZone {
  raw: CoalZone;
  id: string;
  code: number;
  name: string;
  geometry: geo.ZoneGeometry;
  layers: ComputedLayer[];
  totalVolume: number;
  totalMass: number;
  /** 分区计算堆煤高度 m */
  stackHeight: number;
  /** 几何容量（堆至允许最大堆高）m³ */
  capacity: number;
  /** 相对盘煤体积上限的占用率 */
  fillRate: number;
  /** 本次盘煤相对上次的体积变动 m³ */
  delta: number;
  /** 盘煤体积尚未分配到煤层的余量 m³ */
  unallocated: number;
  unmarkedCount: number;
  unmarkedMass: number;
}

export const computeZone = (zone: CoalZone): ComputedZone => {
  const bounds = geo.resolveBoundaries(
    zone.geometry,
    zone.layers.map((l) => l.volume),
  );
  const layers: ComputedLayer[] = zone.layers.map((raw, i) => ({
    raw,
    id: raw.id,
    seq: i + 1,
    volume: raw.volume,
    mass: raw.volume * raw.density,
    color: layerColor(raw),
    thickness: bounds[i].heightTop - bounds[i].heightBottom,
    bound: bounds[i],
  }));
  const totalVolume = layers.reduce((s, l) => s + l.volume, 0);
  const totalMass = layers.reduce((s, l) => s + l.mass, 0);
  const unmarked = layers.filter((l) => l.raw.status === 'unmarked');
  return {
    raw: zone,
    id: zone.id,
    code: zone.code,
    name: zone.name,
    geometry: zone.geometry,
    layers,
    totalVolume,
    totalMass,
    stackHeight: geo.heightFromVolume(zone.geometry, totalVolume),
    capacity: geo.capacityVolume(zone.geometry),
    fillRate: zone.surveyVolume > 0 ? totalVolume / zone.surveyVolume : 0,
    delta: zone.surveyVolume - zone.lastSurveyVolume,
    unallocated: zone.surveyVolume - totalVolume,
    unmarkedCount: unmarked.length,
    unmarkedMass: unmarked.reduce((s, l) => s + l.mass, 0),
  };
};

/* ============================ 层序操作原语 ============================ */

export const makeLayer = (params: {
  regNo: string;
  volume: number;
  density: number;
  stackedAt: string;
  /** 入库时指定的库存煤种，优先于预报上的煤种 */
  coalType?: string;
}): CoalLayer => {
  const batch = findBatch(params.regNo);
  const coalType = params.coalType || batch?.coalType || '';
  if (!batch || !coalType) {
    return {
      id: nextLayerId(),
      regNo: batch?.regNo ?? '',
      shipName: batch?.shipName ?? '',
      voyage: batch?.voyage ?? '',
      coalType: '',
      quality: null,
      volume: params.volume,
      density: params.density,
      status: 'unmarked',
      stackedAt: params.stackedAt,
      tint: 0,
    };
  }
  return {
    id: nextLayerId(),
    regNo: batch.regNo,
    shipName: batch.shipName,
    voyage: batch.voyage,
    coalType,
    quality: COAL_TYPES[coalType]?.quality ?? null,
    volume: params.volume,
    density: params.density,
    status: 'marked',
    stackedAt: params.stackedAt,
    tint: batch.tint,
  };
};

/** 自上而下按体积扣减，返回新的层序列与逐层扣减明细 */
export const deductVolumeFromTop = (layers: CoalLayer[], volume: number) => {
  const next = layers.map((l) => ({ ...l }));
  const cuts: { layer: CoalLayer; volume: number; mass: number }[] = [];
  let remaining = volume;
  for (let i = next.length - 1; i >= 0 && remaining > 0.01; i -= 1) {
    const cut = Math.min(next[i].volume, remaining);
    cuts.push({ layer: next[i], volume: cut, mass: cut * next[i].density });
    next[i].volume -= cut;
    remaining -= cut;
  }
  return { layers: next.filter((l) => l.volume > 0.01), cuts, shortage: remaining };
};

/** 自上而下按煤量扣减（后进先出），逐层用各层自身密度折算体积 */
export const deductMassFromTop = (layers: CoalLayer[], mass: number) => {
  const next = layers.map((l) => ({ ...l }));
  const cuts: { layer: CoalLayer; volume: number; mass: number }[] = [];
  let remaining = mass;
  for (let i = next.length - 1; i >= 0 && remaining > 0.01; i -= 1) {
    const layerMass = next[i].volume * next[i].density;
    const cutMass = Math.min(layerMass, remaining);
    const cutVolume = next[i].density > 0 ? cutMass / next[i].density : 0;
    cuts.push({ layer: next[i], volume: cutVolume, mass: cutMass });
    next[i].volume = Math.max(0, next[i].volume - cutVolume);
    remaining -= cutMass;
  }
  return { layers: next.filter((l) => l.volume > 0.01), cuts, shortage: remaining };
};

/** 在顶层堆叠新煤层；顶层为同一入厂批次时并入，符合连续堆煤的实际形态 */
export const stackOnTop = (layers: CoalLayer[], layer: CoalLayer) => {
  const top = layers[layers.length - 1];
  if (top && layer.regNo && top.regNo === layer.regNo && top.status === 'marked') {
    return [
      ...layers.slice(0, -1),
      { ...top, volume: top.volume + layer.volume, stackedAt: layer.stackedAt },
    ];
  }
  return [...layers, layer];
};

/* ============================ 操作：入库 ============================ */

export interface InboundPlanItem {
  zoneId: string;
  zoneName: string;
  /** 分摊到该分区的煤量 t */
  mass: number;
  /** 折算体积 m³ */
  volume: number;
  heightFrom: number;
  heightTo: number;
  /** 新增煤层的起始（层底）俯仰角 ° */
  pitchFrom: number;
  /** 新增煤层的结束（层顶）俯仰角 ° */
  pitchTo: number;
  /** 入库后是否超出分区几何容量 */
  overCapacity: boolean;
  /** 该分区已有盘煤体积（决定是否需要二次提示） */
  hasSurveyVolume: boolean;
}

/**
 * 入库：总煤量在所选分区间平均分摊。圆形煤场由堆料机绕中心回转铺层，
 * 条形煤场由斗轮沿轨道走行铺层；各分区新增煤层的俯仰夹角由几何关系反算。
 */
export const buildInboundPlan = (
  zones: CoalZone[],
  zoneIds: string[],
  totalMass: number,
  density: number,
): InboundPlanItem[] => {
  if (zoneIds.length === 0 || totalMass <= 0 || density <= 0) return [];
  const perZoneMass = totalMass / zoneIds.length;
  return zoneIds
    .map((id) => zones.find((z) => z.id === id))
    .filter((z): z is CoalZone => Boolean(z))
    .sort((a, b) => a.code - b.code)
    .map((zone) => {
      const current = zone.layers.reduce((s, l) => s + l.volume, 0);
      const volume = perZoneMass / density;
      const heightFrom = geo.heightFromVolume(zone.geometry, current);
      const heightTo = geo.heightFromVolume(zone.geometry, current + volume);
      return {
        zoneId: zone.id,
        zoneName: zone.name,
        mass: perZoneMass,
        volume,
        heightFrom,
        heightTo,
        pitchFrom: geo.pitchFromHeight(zone.geometry, heightFrom),
        pitchTo: geo.pitchFromHeight(zone.geometry, heightTo),
        overCapacity: current + volume > geo.capacityVolume(zone.geometry) + 0.5,
        hasSurveyVolume: zone.surveyVolume > 0.5,
      };
    });
};

export const applyInbound = (
  zones: CoalZone[],
  plan: InboundPlanItem[],
  regNo: string,
  density: number,
  stackedAt: string,
  coalType = '',
): CoalZone[] =>
  zones.map((zone) => {
    const item = plan.find((p) => p.zoneId === zone.id);
    if (!item) return zone;
    const layers = stackOnTop(
      zone.layers,
      makeLayer({ regNo, volume: item.volume, density, stackedAt, coalType }),
    );
    const total = layers.reduce((s, l) => s + l.volume, 0);
    // 手动入库改变实际存煤，盘煤体积上限同步抬升
    return { ...zone, layers, surveyVolume: Math.max(zone.surveyVolume, total) };
  });

/* ============================ 操作：出库 ============================ */

export const applyOutbound = (
  zones: CoalZone[],
  zoneId: string,
  mass: number,
): {
  zones: CoalZone[];
  cuts: { layer: CoalLayer; volume: number; mass: number }[];
  shortage: number;
} => {
  let cuts: { layer: CoalLayer; volume: number; mass: number }[] = [];
  let shortage = 0;
  const next = zones.map((zone) => {
    if (zone.id !== zoneId) return zone;
    const result = deductMassFromTop(zone.layers, mass);
    cuts = result.cuts;
    shortage = result.shortage;
    const total = result.layers.reduce((s, l) => s + l.volume, 0);
    return { ...zone, layers: result.layers, surveyVolume: total };
  });
  return { zones: next, cuts, shortage };
};

/* ============================ 操作：分层拆分 ============================ */

export interface SplitRow {
  /** 入厂登记编号，留空表示该子层仍为待标记 */
  regNo: string;
  /** 起始（层底）俯仰角 ° */
  pitchStart: number;
  /** 结束（层顶）俯仰角 ° */
  pitchEnd: number;
}

export interface SplitPreviewRow extends SplitRow {
  volume: number;
  /** 占原煤层体积比例 */
  ratio: number;
  mass: number;
  heightStart: number;
  heightEnd: number;
  valid: boolean;
}

/**
 * 拆分预览。行序自上而下：首行的结束角度锁定为原层顶角，末行的起始角度锁定为原层底角，
 * 中间各行的结束角度自动取上一行的起始角度。
 */
export const buildSplitPreview = (
  g: geo.ZoneGeometry,
  layer: ComputedLayer,
  rows: SplitRow[],
): SplitPreviewRow[] =>
  rows.map((row) => {
    const heightStart = Math.max(0, geo.heightFromPitch(g, row.pitchStart));
    const heightEnd = Math.max(0, geo.heightFromPitch(g, row.pitchEnd));
    const volume = geo.stackVolume(g, heightEnd) - geo.stackVolume(g, heightStart);
    return {
      ...row,
      heightStart,
      heightEnd,
      volume,
      ratio: layer.volume > 0 ? volume / layer.volume : 0,
      mass: volume * layer.raw.density,
      valid: volume > 0.01,
    };
  });

/** 按行序自上而下的拆分结果写回煤层序列（存储顺序为自下而上） */
export const applySplit = (
  zones: CoalZone[],
  zoneId: string,
  layerId: string,
  preview: SplitPreviewRow[],
  density: number,
  stackedAt: string,
): CoalZone[] =>
  zones.map((zone) => {
    if (zone.id !== zoneId) return zone;
    const index = zone.layers.findIndex((l) => l.id === layerId);
    if (index < 0) return zone;
    const origin = zone.layers[index];
    const created = [...preview]
      .reverse()
      .filter((r) => r.volume > 0.01)
      .map((r) =>
        r.regNo
          ? makeLayer({ regNo: r.regNo, volume: r.volume, density, stackedAt })
          : {
              ...makeLayer({ regNo: '', volume: r.volume, density, stackedAt }),
              stackedAt: origin.stackedAt,
            },
      );
    const layers = [...zone.layers];
    layers.splice(index, 1, ...created);
    return { ...zone, layers };
  });

/* ============================ 操作：分层合并 ============================ */

export interface MergePair {
  /** 保留批次归属的基准层 */
  keep: ComputedLayer;
  /** 被合并（吸收）的煤层 */
  absorbed: ComputedLayer;
}

export const resolveMergePair = (
  zone: ComputedZone,
  layerId: string,
  direction: 'up' | 'down',
): MergePair | null => {
  const keep = zone.layers.find((l) => l.id === layerId);
  if (!keep) return null;
  const absorbed = zone.layers.find((l) => l.seq === keep.seq + (direction === 'up' ? 1 : -1));
  if (!absorbed) return null;
  return { keep, absorbed };
};

export const applyMerge = (
  zones: CoalZone[],
  zoneId: string,
  layerId: string,
  direction: 'up' | 'down',
): CoalZone[] =>
  zones.map((zone) => {
    if (zone.id !== zoneId) return zone;
    const index = zone.layers.findIndex((l) => l.id === layerId);
    const other = direction === 'up' ? index + 1 : index - 1;
    if (index < 0 || other < 0 || other >= zone.layers.length) return zone;
    const keep = zone.layers[index];
    const drop = zone.layers[other];
    const merged: CoalLayer = {
      ...keep,
      volume: keep.volume + drop.volume,
      density:
        (keep.volume * keep.density + drop.volume * drop.density) / (keep.volume + drop.volume),
      stackedAt: keep.stackedAt < drop.stackedAt ? keep.stackedAt : drop.stackedAt,
      adjusted: true,
    };
    const lower = Math.min(index, other);
    const layers = zone.layers.filter((_, i) => i !== index && i !== other);
    layers.splice(lower, 0, merged);
    return { ...zone, layers };
  });

/* ============================ 操作：删除与标记 ============================ */

/** 删除煤层。仅表层（顶层）可直接删除，不形成出入库记录 */
export const deleteLayer = (zones: CoalZone[], zoneId: string, layerId: string): CoalZone[] =>
  zones.map((zone) => {
    if (zone.id !== zoneId) return zone;
    const layers = zone.layers.filter((l) => l.id !== layerId);
    const total = layers.reduce((s, l) => s + l.volume, 0);
    return { ...zone, layers, surveyVolume: total };
  });

export const replaceLayer = (
  zones: CoalZone[],
  zoneId: string,
  layerId: string,
  patch: Partial<CoalLayer>,
): CoalZone[] =>
  zones.map((z) =>
    z.id === zoneId
      ? { ...z, layers: z.layers.map((l) => (l.id === layerId ? { ...l, ...patch } : l)) }
      : z,
  );

/* ============================ 盘煤比对 ============================ */

export interface SurveyInput {
  yardId: string;
  /** zoneId → 本次盘煤体积 m³ */
  volumes: Record<string, number>;
  /** 勾选的周期内入厂批次（入厂登记编号） */
  regNos: string[];
  defaultDensity: number;
}

export interface SurveyPlanDetail {
  regNo: string;
  coalTypeName: string;
  volume: number;
  mass: number;
}

export interface SurveyPlanItem {
  zoneId: string;
  zoneName: string;
  lastVolume: number;
  newVolume: number;
  delta: number;
  kind: 'in' | 'out' | 'none';
  pitchFrom: number | null;
  pitchTo: number | null;
  details: SurveyPlanDetail[];
}

export interface SurveyPlan {
  items: SurveyPlanItem[];
  increaseVolume: number;
  decreaseVolume: number;
  batchMass: number;
  matchDensity: number | null;
  autoMatched: boolean;
  inMass: number;
  outMass: number;
  newUnmarkedLayers: number;
}

/**
 * 依据盘煤体积变动构造处理方案。
 * 增加：以全煤场为口径计算 ρ = Σ批次煤量 / Σ新增体积；ρ 落在合理区间则各分区新增煤层
 *       按批次煤量比例自动识别为对应入厂批次，否则生成待标记煤层（估算煤量按默认密度）。
 * 减少：按煤层顺序自上而下扣减，逐批次形成出库明细。
 */
export const buildSurveyPlan = (zones: CoalZone[], input: SurveyInput): SurveyPlan => {
  const scoped = zones.filter((z) => z.yardId === input.yardId);
  const batches = input.regNos
    .map((no) => findBatch(no))
    .filter((b): b is ArrivalBatch => Boolean(b))
    .sort((a, b) => a.unloadedAt.localeCompare(b.unloadedAt));

  const deltas = scoped.map((z) => ({
    zone: z,
    newVolume: input.volumes[z.id] ?? z.surveyVolume,
    delta: (input.volumes[z.id] ?? z.surveyVolume) - z.surveyVolume,
  }));

  const increaseVolume = deltas.reduce((s, d) => s + Math.max(0, d.delta), 0);
  const decreaseVolume = deltas.reduce((s, d) => s + Math.max(0, -d.delta), 0);
  const batchMass = batches.reduce((s, b) => s + b.unloadedMass, 0);
  const matchDensity = increaseVolume > 0.01 && batchMass > 0 ? batchMass / increaseVolume : null;
  const autoMatched =
    matchDensity !== null &&
    matchDensity >= DENSITY_RANGE.min &&
    matchDensity <= DENSITY_RANGE.max;

  let inMass = 0;
  let outMass = 0;
  let newUnmarkedLayers = 0;

  const items: SurveyPlanItem[] = deltas.map(({ zone, newVolume, delta }) => {
    const base: SurveyPlanItem = {
      zoneId: zone.id,
      zoneName: zone.name,
      lastVolume: zone.surveyVolume,
      newVolume,
      delta,
      kind: 'none',
      pitchFrom: null,
      pitchTo: null,
      details: [],
    };

    if (delta > 0.01) {
      const currentVolume = zone.layers.reduce((s, l) => s + l.volume, 0);
      const hFrom = geo.heightFromVolume(zone.geometry, currentVolume);
      const hTo = geo.heightFromVolume(zone.geometry, currentVolume + delta);
      const details: SurveyPlanDetail[] = autoMatched
        ? batches.map((b) => {
            const volume = (delta * b.unloadedMass) / batchMass;
            return {
              regNo: b.regNo,
              coalTypeName: coalTypeName(b.coalType),
              volume,
              mass: volume * (matchDensity as number),
            };
          })
        : [
            {
              regNo: '',
              coalTypeName: '待标记',
              volume: delta,
              mass: delta * input.defaultDensity,
            },
          ];
      if (!autoMatched) newUnmarkedLayers += 1;
      inMass += details.reduce((s, d) => s + d.mass, 0);
      return {
        ...base,
        kind: 'in',
        pitchFrom: geo.pitchFromHeight(zone.geometry, hFrom),
        pitchTo: geo.pitchFromHeight(zone.geometry, hTo),
        details,
      };
    }

    if (delta < -0.01) {
      const { cuts } = deductVolumeFromTop(zone.layers, -delta);
      const details = cuts.map((c) => ({
        regNo: c.layer.regNo,
        coalTypeName: c.layer.regNo ? coalTypeName(c.layer.coalType) : '待标记',
        volume: c.volume,
        mass: c.mass,
      }));
      outMass += details.reduce((s, d) => s + d.mass, 0);
      return { ...base, kind: 'out', details };
    }

    return base;
  });

  return {
    items,
    increaseVolume,
    decreaseVolume,
    batchMass,
    matchDensity,
    autoMatched,
    inMass,
    outMass,
    newUnmarkedLayers,
  };
};

export const applySurveyPlan = (
  zones: CoalZone[],
  plan: SurveyPlan,
  input: SurveyInput,
  stackedAt: string,
): CoalZone[] =>
  zones.map((zone) => {
    const item = plan.items.find((i) => i.zoneId === zone.id);
    if (!item) return zone;
    if (item.kind === 'none') {
      return { ...zone, lastSurveyVolume: zone.surveyVolume, surveyVolume: item.newVolume };
    }

    let layers = zone.layers;
    if (item.kind === 'in') {
      item.details.forEach((d) => {
        const density = d.volume > 0 ? d.mass / d.volume : input.defaultDensity;
        layers = stackOnTop(
          layers,
          makeLayer({ regNo: d.regNo, volume: d.volume, density, stackedAt }),
        );
      });
    } else {
      layers = deductVolumeFromTop(layers, -item.delta).layers;
    }

    return {
      ...zone,
      layers,
      lastSurveyVolume: zone.surveyVolume,
      surveyVolume: item.newVolume,
    };
  });
