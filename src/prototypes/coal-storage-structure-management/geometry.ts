/**
 * 煤场分区煤堆几何模型
 *
 * 圆形煤场：中心堆料塔悬臂绕中心回转堆煤。径向断面是等腰梯形（底宽 = 外半径 − 内半径，
 * 边坡由燃煤安息角决定），沿周向张开 Δα，按 Pappus 定理：
 *
 *   V(h) = Δα · r̄ · A(h)
 *
 * 条形煤场：斗轮堆取料机沿轨道走行堆煤。同一径向断面沿分区长度 L 拉伸为直棱柱：
 *
 *   V(h) = L · A(h)
 *
 * 两种形态共用径向断面积：
 *
 *   A(h) = h · (W − h/tanθ)        顶宽 = W − 2h/tanθ
 *
 * 俯仰夹角 φ 是堆煤斜面相对场坪的图形夹角，与挡煤墙高度 h 按正切换算：
 *   tan(φ) / tan(φmax) = h / H    （φmax = 45°，H = 20 m）
 *   故 h = 20 · tan(φ)，φ = arctan(h / 20)
 * 0° 对应场坪，45° 对应 20 m 挡煤墙顶。
 *
 * 参考资料：
 * - /rules/design-guide.md
 * - 用户提供的存煤结构管理业务描述（圆形 36 分区每区 10° / 条形 3 分区、20 m 堆高上限）
 * - 用户提供的扇形楔俯仰夹角示意图（0°～45° ↔ 0～20 m 挡煤墙）
 */

export type YardShape = 'circular' | 'strip';

export interface ZoneGeometry {
  shape: YardShape;
  /** 圆形分区张角 °；条形为 0 */
  sectorAngle: number;
  /** 圆形内半径（中心堆料塔基础）m；条形为 0 */
  innerRadius: number;
  /** 圆形外半径（挡煤墙）m；条形为 0 */
  outerRadius: number;
  /** 条形分区沿轨道方向的长度 m；圆形为 0 */
  zoneLength: number;
  /** 条形煤堆底宽 m；圆形等于 outerRadius − innerRadius */
  pileWidth: number;
  /** 燃煤自然安息角 ° */
  reposeAngle: number;
  /** 挡煤墙高度 m */
  wallHeight: number;
  /** 允许最大堆煤高度 m（同时作为俯仰夹角换算的挡煤墙作业高度） */
  maxStackHeight: number;
}

/** 圆形封闭煤场：Φ130 m，按分区数均分周向张角 */
export const circularZoneGeometry = (zoneCount: number): ZoneGeometry => ({
  shape: 'circular',
  sectorAngle: 360 / zoneCount,
  innerRadius: 8,
  outerRadius: 65,
  zoneLength: 0,
  pileWidth: 57,
  reposeAngle: 38,
  wallHeight: 22,
  maxStackHeight: 20,
});

/** 条形煤场：全场长 240 m，底宽 50 m，按分区数均分长度 */
export const stripZoneGeometry = (zoneCount: number): ZoneGeometry => ({
  shape: 'strip',
  sectorAngle: 0,
  innerRadius: 0,
  outerRadius: 0,
  zoneLength: 240 / zoneCount,
  pileWidth: 50,
  reposeAngle: 38,
  wallHeight: 18,
  maxStackHeight: 20,
});

/** 实际堆煤视图的分带高度 m（20 m 上限划分为 200 个 10 cm 方块） */
export const BAND_HEIGHT = 0.1;
/** 分带总数 */
export const BAND_COUNT = 200;
/** 图形最大俯仰夹角 °，对应挡煤墙作业高度 20 m */
export const MAX_PITCH_DEG = 45;

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** 安息角对应的边坡系数 tanθ */
export const slopeFactor = (g: ZoneGeometry) => Math.tan(toRad(g.reposeAngle));

/** 径向堆底宽度 m */
export const baseWidth = (g: ZoneGeometry) =>
  g.shape === 'strip' ? g.pileWidth : g.outerRadius - g.innerRadius;

/** 径向断面形心半径 m（仅圆形煤场使用） */
export const centroidRadius = (g: ZoneGeometry) => g.innerRadius + baseWidth(g) / 2;

/** 堆高 h 处的径向顶宽 m，堆成三角形后归零 */
export const crestWidth = (g: ZoneGeometry, h: number) =>
  Math.max(0, baseWidth(g) - (2 * h) / slopeFactor(g));

/** 径向断面积 m² */
export const sectionArea = (g: ZoneGeometry, h: number) => {
  if (h <= 0) return 0;
  const W = baseWidth(g);
  const k = slopeFactor(g);
  const triangleHeight = (W * k) / 2;
  // 超过临界高度后断面退化为三角形，面积不再增长
  if (h >= triangleHeight) return (W * triangleHeight) / 2;
  return h * (W - h / k);
};

/** 堆高 h 对应的分区煤堆体积 m³ */
export const stackVolume = (g: ZoneGeometry, h: number) => {
  if (h <= 0) return 0;
  const area = sectionArea(g, h);
  if (g.shape === 'strip') return g.zoneLength * area;
  return toRad(g.sectorAngle) * centroidRadius(g) * area;
};

/** 分区几何容量（堆至允许最大堆高）m³ */
export const capacityVolume = (g: ZoneGeometry) => stackVolume(g, g.maxStackHeight);

/** 由体积反解堆高 m（V(h) 在有效区间单调递增，二分求解） */
export const heightFromVolume = (g: ZoneGeometry, volume: number) => {
  if (volume <= 0) return 0;
  let lo = 0;
  let hi = g.maxStackHeight * 1.5;
  if (stackVolume(g, hi) < volume) return hi;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (stackVolume(g, mid) < volume) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
};

/**
 * 堆高 → 俯仰夹角 °。
 * 图形夹角与挡煤墙高度按正切比例换算：φ / 对应 tan 比 = h / H。
 */
export const pitchFromHeight = (g: ZoneGeometry, h: number) =>
  toDeg(Math.atan((Math.max(0, h) / g.maxStackHeight) * Math.tan(toRad(MAX_PITCH_DEG))));

/** 俯仰夹角 ° → 堆高 m */
export const heightFromPitch = (g: ZoneGeometry, pitch: number) =>
  g.maxStackHeight * Math.tan(toRad(pitch)) / Math.tan(toRad(MAX_PITCH_DEG));

/** 俯仰夹角 ° → 累计体积 m³（用于按角度配置煤层时反算煤量） */
export const volumeFromPitch = (g: ZoneGeometry, pitch: number) =>
  stackVolume(g, Math.max(0, heightFromPitch(g, pitch)));

/** 俯仰夹角可用区间 °：场坪 0° ～ 挡煤墙顶 45° */
export const pitchRange = (g: ZoneGeometry) => ({
  min: pitchFromHeight(g, 0),
  max: pitchFromHeight(g, g.maxStackHeight),
});

export interface LayerBoundary {
  /** 层底累计体积 m³ */
  volumeBottom: number;
  /** 层顶累计体积 m³ */
  volumeTop: number;
  /** 层底标高 m */
  heightBottom: number;
  /** 层顶标高 m */
  heightTop: number;
  /** 起始（层底）俯仰角 ° */
  pitchBottom: number;
  /** 结束（层顶）俯仰角 ° */
  pitchTop: number;
}

/**
 * 按堆煤顺序（自下而上）依次累计体积，反算每层的标高区间与俯仰角区间。
 * 这是「配置煤量 → 自动计算煤层分布」与「配置角度 → 自动计算煤量」的共同基础。
 */
export const resolveBoundaries = (g: ZoneGeometry, volumes: number[]): LayerBoundary[] => {
  let cum = 0;
  return volumes.map((v) => {
    const volumeBottom = cum;
    cum += Math.max(0, v);
    const volumeTop = cum;
    const heightBottom = heightFromVolume(g, volumeBottom);
    const heightTop = heightFromVolume(g, volumeTop);
    return {
      volumeBottom,
      volumeTop,
      heightBottom,
      heightTop,
      pitchBottom: pitchFromHeight(g, heightBottom),
      pitchTop: pitchFromHeight(g, heightTop),
    };
  });
};

/** 标高 → 10 cm 分带序号（0 为贴地第一带） */
export const bandIndexOf = (height: number) =>
  Math.min(BAND_COUNT - 1, Math.max(0, Math.floor(height / BAND_HEIGHT)));

/** 分带序号 → 该带中心标高 m */
export const bandCenterHeight = (index: number) => (index + 0.5) * BAND_HEIGHT;
