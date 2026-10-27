/**
 * 来煤预报查询 · 示例数据
 *
 * 首页前 19 条对齐来煤预报查询截图。其后补足到 81 条，便于分页（20 条/页）。
 * 库存煤种名称全局不重复，色值与库存煤种一一对应。
 */

export interface ForecastRow {
  id: string;
  regNo: string;
  vessel: string;
  voyage: string;
  variety: string;
  coalKind: string;
  waybillTons: number;
  planNo: string;
  supplier: string;
  /** 预报到港日期，同时作为列表「预报时间」 */
  forecastDate: string;
  stockCoalName: string | null;
}

export interface StockCoal {
  name: string;
  color: string;
}

/** 推荐色板。已被占用的色值不能再绑到其他库存煤种。 */
export const COLOR_PRESETS = [
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

const SEED_COLORS: Record<string, string> = {
  国信5000: '#3D6488',
  国信4500: '#C08F47',
  印尼褐煤: '#8A4C38',
  俄罗斯煤: '#2C7676',
};

const SUPPLIER = '江苏国信能源销售有限公司';

const SEED: ForecastRow[] = [
  row('gxsz-2026-050RCDJ2026072102', '太行188', '2615', '国信1-5000', '4500-5000kcal/kg', 47719, 'SZYB2026-0050', '2026-07-21', '国信5000'),
  row('gxsz-2026-049RCDJ2026071601', '新福', '331', '国信1-5000', '4500-5000kcal/kg', 49593, 'SZYB2026-0049', '2026-07-16', null),
  row('gxsz-2026-048RCDJ2026071001', '长泰门', '2615', '国信1-5000', '4500-5000kcal/kg', 51202, 'SZYB2026-0048', '2026-07-10', '国信5000'),
  row('gxsz-2026-046RCDJ2026070101', '太行128', '2612', '国信1-5000', '4500-5000kcal/kg', 47681, 'SZYB2026-0047', '2026-07-01', '国信5000'),
  row('gxsz-2026-047RCDJ2026070102', '中伟88', '2613', '国信1-5000', '4500-5000kcal/kg', 49910, 'SZYB2026-0046', '2026-07-01', null),
  row('gxsz-2026-045RCDJ2026062204', '辰达11', '2613', '褐煤', '3200kcal/kg 印尼煤', 47883, 'SZYB2026-0045', '2026-06-22', '印尼褐煤'),
  row('gxsz-2026-044RCDJ2026062203', '太行188', '2613', '国信1-5000', '4500-5000kcal/kg', 47743, 'SZYB2026-0044', '2026-06-22', '国信5000'),
  row('gxsz-2026-043RCDJ2026062202', '中兴69', '2613', '国信1-5000', '4500-5000kcal/kg', 47649, 'SZYB2026-0043', '2026-06-22', null),
  row('gxsz-2026-042RCDJ2026061501', '新海17', '2613', '国信1-4500', '4500-5000kcal/kg', 49936, 'SZYB2026-0042', '2026-06-15', '国信4500'),
  row('gxsz-2026-041RCDJ2026060802', '长泰门', '2613', '国信1-5000', '4500-5000kcal/kg', 51308, 'SZYB2026-0041', '2026-06-08', '国信5000'),
  row('gxsz-2026-040RCDJ2026060801', '新安', '287', '国信1-5000', '4500-5000kcal/kg', 58517, 'SZYB2026-0040', '2026-06-08', null),
  row('gxsz-2026-039RCDJ2026060204', '恒泰海', '214', '褐煤', '3200kcal/kg 印尼煤', 47518, 'SZYB2026-0039', '2026-06-02', '印尼褐煤'),
  row('gxsz-2026-038RCDJ2026060104', '长航煤海', '26019', '国信1-5000', '4500-5000kcal/kg', 14453, 'SZYB2026-0038', '2026-06-01', '国信5000'),
  row('gxsz-2026-038RCDJ2026060105', '长航盛海', '26019', '国信1-4500', '4000-4500kcal/kg', 30274, 'SZYB2026-0038', '2026-06-01', '国信4500'),
  row('gxsz-2026-036RCDJ2026060102', '新海通3', '2611', '褐煤', '3300-3700kcal/kg 空干基硫分≤1.0% St≤115℃', 51500, 'SZYB2026-0036', '2026-06-01', null),
  row('gxsz-2026-037RCDJ2026060103', 'GREAT WENSHENG', '2605', '进口煤', '4500-5000kcal/kg 俄罗斯煤', 79900, 'SZYB2026-0037', '2026-06-01', '俄罗斯煤'),
  row('gxsz-2026-035RCDJ2026051802', '太行128', '2610', '国信1-4500', '4500-5000kcal/kg', 47932, 'SZYB2026-0035', '2026-05-18', '国信4500'),
  row('gxsz-2026-034RCDJ2026051803', '利电8', '2610', '国信1-4500', '4500-5000kcal/kg', 47968, 'SZYB2026-0034', '2026-05-18', null),
  row('gxsz-2026-033RCDJ2026051801', '富红舟', '2611', '国信1-4500', '4500-5000kcal/kg', 46285, 'SZYB2026-0033', '2026-05-18', '国信4500'),
];

function row(
  regNo: string,
  vessel: string,
  voyage: string,
  variety: string,
  coalKind: string,
  waybillTons: number,
  planNo: string,
  forecastDate: string,
  stockCoalName: string | null,
  supplier = SUPPLIER,
): ForecastRow {
  return {
    id: regNo,
    regNo,
    vessel,
    voyage,
    variety,
    coalKind,
    waybillTons,
    planNo,
    supplier,
    forecastDate,
    stockCoalName,
  };
}

function shiftDate(iso: string, days: number) {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
  const nextDay = String(date.getDate()).padStart(2, '0');
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function buildExtraRows(): ForecastRow[] {
  const vessels = ['太行166', '国电15', '新海达', '长航88', '华能21', '浙能3', '宝钢海', '中远21', '神华88', '国能6', '富达', '利电12'];
  const patterns: Array<Pick<ForecastRow, 'variety' | 'coalKind' | 'stockCoalName'>> = [
    { variety: '国信1-5000', coalKind: '4500-5000kcal/kg', stockCoalName: '国信5000' },
    { variety: '国信1-4500', coalKind: '4000-4500kcal/kg', stockCoalName: '国信4500' },
    { variety: '褐煤', coalKind: '3200kcal/kg 印尼煤', stockCoalName: '印尼褐煤' },
    { variety: '进口煤', coalKind: '4500-5000kcal/kg 俄罗斯煤', stockCoalName: '俄罗斯煤' },
    { variety: '国信1-5000', coalKind: '4500-5000kcal/kg', stockCoalName: null },
  ];

  const extra: ForecastRow[] = [];
  let cursor = '2026-05-16';
  let planYear = 2026;
  let planSeq = 32;

  for (let index = 0; index < 62; index += 1) {
    cursor = shiftDate(cursor, index % 3 === 0 ? -2 : -1);
    if (planSeq < 1) {
      planYear -= 1;
      planSeq = 80;
    }
    const pattern = patterns[index % patterns.length];
    const compact = cursor.replace(/-/g, '');
    const mid = String(100 + index).padStart(3, '0');
    const stockCoalName = index % 7 === 0 ? null : pattern.stockCoalName;
    extra.push(row(
      `gxsz-${cursor.slice(0, 4)}-${mid}RCDJ${compact}01`,
      vessels[index % vessels.length],
      index % 5 === 0 ? String(200 + (index % 90)) : String(2500 + (index % 400)),
      pattern.variety,
      pattern.coalKind,
      18000 + ((index * 947) % 40000),
      `SZYB${planYear}-${String(planSeq).padStart(4, '0')}`,
      cursor,
      stockCoalName,
      index % 11 === 0 ? '国电燃料有限公司' : SUPPLIER,
    ));
    planSeq -= 1;
  }

  return extra;
}

export const INITIAL_FORECASTS: ForecastRow[] = [...SEED, ...buildExtraRows()];

export function buildCatalog(rows: ForecastRow[]): StockCoal[] {
  const seen = new Set<string>();
  const catalog: StockCoal[] = [];
  rows.forEach((item) => {
    const name = item.stockCoalName;
    if (!name || seen.has(name)) return;
    const color = SEED_COLORS[name];
    if (!color) return;
    seen.add(name);
    catalog.push({ name, color });
  });
  return catalog;
}

/** 给新库存煤种分配一个尚未占用的色值，优先用推荐色板。 */
export function pickDefaultColor(coals: StockCoal[], exceptName = '') {
  const used = new Set(
    coals.filter((item) => item.name !== exceptName).map((item) => item.color),
  );
  const preset = COLOR_PRESETS.find((item) => !used.has(item));
  if (preset) return preset;

  for (let index = 0; index < 360; index += 1) {
    const color = hslToHex((index * 47) % 360, 46, 46);
    if (!used.has(color)) return color;
  }
  return '#5B6B7A';
}

function hslToHex(hue: number, saturation: number, lightness: number) {
  const sat = saturation / 100;
  const lig = lightness / 100;
  const chroma = sat * Math.min(lig, 1 - lig);
  const channel = (offset: number) => {
    const position = (offset + hue / 30) % 12;
    const value = lig - chroma * Math.max(-1, Math.min(position - 3, Math.min(9 - position, 1)));
    return Math.round(255 * value).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`.toUpperCase();
}

export function normalizeColor(input: string) {
  const matched = input.trim().match(/^#?([0-9a-fA-F]{6})(?:[0-9a-fA-F]{2})?$/);
  return matched ? `#${matched[1].toUpperCase()}` : '';
}

export function validateStockAssignment(
  nameInput: string,
  colorInput: string,
  coals: StockCoal[],
): { ok: true; name: string; color: string } | { ok: false; message: string } {
  const name = nameInput.trim();
  if (!name) return { ok: false, message: '请选择或输入库存煤种' };
  if (name.length > 30) return { ok: false, message: '库存煤种不超过 30 个字' };
  const color = normalizeColor(colorInput);
  if (!color) return { ok: false, message: '请选择色值' };
  const owner = coals.find((item) => item.color === color && item.name !== name);
  if (owner) return { ok: false, message: `色值 ${color} 已用于库存煤种「${owner.name}」` };
  return { ok: true, name, color };
}

function pruneCoals(rows: ForecastRow[], coals: StockCoal[]) {
  const used = new Set(rows.map((item) => item.stockCoalName).filter((name): name is string => Boolean(name)));
  return coals.filter((item) => used.has(item.name));
}

/** 把预报绑到库存煤种。同名煤种改色时，所有引用该煤种的预报一起变色。 */
export function assignStockCoal(
  rows: ForecastRow[],
  coals: StockCoal[],
  rowId: string,
  name: string,
  color: string,
) {
  const nextRows = rows.map((item) => (item.id === rowId ? { ...item, stockCoalName: name } : item));
  const nextCoals = coals.some((item) => item.name === name)
    ? coals.map((item) => (item.name === name ? { ...item, color } : item))
    : [...coals, { name, color }];
  return { rows: nextRows, coals: pruneCoals(nextRows, nextCoals) };
}

export function clearStockCoal(rows: ForecastRow[], coals: StockCoal[], rowId: string) {
  const nextRows = rows.map((item) => (item.id === rowId ? { ...item, stockCoalName: null } : item));
  return { rows: nextRows, coals: pruneCoals(nextRows, coals) };
}
