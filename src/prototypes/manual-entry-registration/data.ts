/**
 * 燃煤入厂登记 · 入厂点、模块配置、表单字段/操作权限与 Mock 数据
 */

export type ModuleCode = 'coal-entry' | 'non-coal' | 'transfer-coal' | 'vehicle-card' | 'exit';
export type RecordStatus = 'registered' | 'exited';

export interface FieldConfig {
  visible: boolean;
  editable: boolean;
}

export interface SiteConfig {
  id: string;
  name: string;
  /** 模块编码 MEOR，用于请求字段/操作配置 */
  moduleCode: string;
  /**
   * 云驿自动模式登记类型：enter=入厂登记，preEnter=预入厂登记
   * 对应配置项 GOABLE_AotoYunYiRegister
   */
  GOABLE_AotoYunYiRegister: 'enter' | 'preEnter';
}

export interface CoalPlan {
  id: string;
  serialNo: string;
  taskNo: string;
  plate: string;
  supplier: string;
  mine: string;
  coalType: string;
  transporter: string;
  unloadArea: string;
  productName: string;
  shipTime: string;
  station: string;
  gross: number;
  tare: number;
  net: number;
  samplePos: string;
  weighPos: string;
}

export interface PreEntryVehicle {
  plate: string;
  planId: string;
  vehicleCard: string;
  entryCard: string;
  preEntryAt: string;
}

export interface EntryRecord {
  id: string;
  serialNo: string;
  plate: string;
  supplier: string;
  mine: string;
  coalType: string;
  sampleMethod: string;
  net: number;
  weighPos: string;
  samplePos: string;
  enterAt: string;
  status: RecordStatus;
  entryCard: string;
  siteId: string;
  taskNo?: string;
}

export interface ModuleMenu {
  code: ModuleCode;
  label: string;
  /** 模拟登录人菜单权限 */
  permitted: boolean;
}

export const SITE_STORAGE_KEY = 'mer_last_site_id';

/** 允许入厂状态（云驿同步 / 人工放行） */
export type EntryPermit = 'allowed' | 'forbidden';

/** 登记点选择页展示文案 */
export const SITE_PRESENTATION: Record<string, { abbr: string; hint: string }> = {
  south: { abbr: '南门', hint: '主入厂通道 · 云驿入厂登记' },
  north: { abbr: '北门', hint: '北侧通道 · 预入厂登记' },
  east: { abbr: '东门', hint: '东侧入厂通道' },
  west: { abbr: '西门', hint: '西侧通道 · 预入厂登记' },
};

export const SITES: SiteConfig[] = [
  { id: 'south', name: '南门入厂点', moduleCode: 'MEOR-SOUTH', GOABLE_AotoYunYiRegister: 'enter' },
  { id: 'north', name: '北门入厂点', moduleCode: 'MEOR-NORTH', GOABLE_AotoYunYiRegister: 'preEnter' },
  { id: 'east', name: '东门入厂点', moduleCode: 'MEOR-EAST', GOABLE_AotoYunYiRegister: 'enter' },
  { id: 'west', name: '西门入厂点', moduleCode: 'MEOR-WEST', GOABLE_AotoYunYiRegister: 'preEnter' },
];

/** 二级功能菜单定义（顺序与业务菜单一致） */
export const MODULE_MENUS: ModuleMenu[] = [
  { code: 'coal-entry', label: '来煤登记', permitted: true },
  { code: 'non-coal', label: '非煤物资登记', permitted: true },
  { code: 'transfer-coal', label: '转场煤登记', permitted: true },
  { code: 'vehicle-card', label: '车辆办卡', permitted: true },
  { code: 'exit', label: '出厂登记', permitted: true },
];

export const MODULE_LABELS: Record<ModuleCode, string> = {
  'coal-entry': '来煤登记',
  'non-coal': '非煤物资登记',
  'transfer-coal': '转场煤登记',
  'vehicle-card': '车辆办卡',
  exit: '出厂登记',
};

export const TRANSPORTERS = ['蒙东物流', '鄂尔多斯汽运', '湘赣联运', '桂海运输', '神华物流'];
export const SAMPLE_METHODS = ['机械采样', '人工采样'] as const;
export const SAMPLE_POSITIONS = ['1#机械采样机', '2#机械采样机', '人工采样棚'];
export const WEIGH_POSITIONS = ['1#汽车衡', '2#汽车衡', '3#汽车衡'];

/** 字段配置项：未出现在配置中的非配置字段默认直接加载 */
export type FieldKey =
  | 'FIELD_vehicleNo'
  | 'FIELD_cardNo'
  | 'FIELD_mineHairGrossWeight'
  | 'FIELD_mineHairTare'
  | 'FIELD_ticketHeight'
  | 'FIELD_fromDate'
  | 'FIELD_simplingName'
  | 'FIELD_poundName'
  | 'FIELD_simplingSource'
  | 'FIELD_cardNo1';

export type OperationKey =
  | 'OPERATION_manualSelectPlan'
  | 'OPERATION_yunYiCode'
  | 'OPERATION_yunYiCodeAuto'
  | 'OPERATION_planCode'
  | 'OPERATION_cardNo1Search'
  | 'OPERATION_enterComfire'
  | 'OPERATION_preEnterComfire'
  | 'OPERATION_cardNo1WriteAndenterComfire'
  | 'OPERATION_cardNo1Write';

/** 按入厂点模块编码返回字段与操作配置（原型 Mock） */
export const getModuleFieldConfig = (_moduleCode: string): Partial<Record<FieldKey, FieldConfig>> => ({
  FIELD_vehicleNo: { visible: true, editable: true },
  FIELD_cardNo: { visible: true, editable: false },
  FIELD_mineHairGrossWeight: { visible: true, editable: true },
  FIELD_mineHairTare: { visible: true, editable: true },
  FIELD_ticketHeight: { visible: true, editable: true },
  FIELD_fromDate: { visible: true, editable: false },
  FIELD_simplingName: { visible: true, editable: true },
  FIELD_poundName: { visible: true, editable: true },
  FIELD_simplingSource: { visible: true, editable: true },
  FIELD_cardNo1: { visible: true, editable: false },
});

export const getModuleOperationConfig = (
  moduleCode: string,
): Partial<Record<OperationKey, boolean>> => {
  const base: Partial<Record<OperationKey, boolean>> = {
    OPERATION_manualSelectPlan: true,
    OPERATION_yunYiCode: true,
    OPERATION_yunYiCodeAuto: true,
    OPERATION_planCode: true,
    OPERATION_cardNo1Search: true,
    OPERATION_enterComfire: true,
    OPERATION_preEnterComfire: true,
    OPERATION_cardNo1WriteAndenterComfire: true,
    OPERATION_cardNo1Write: true,
  };
  if (moduleCode === 'MEOR-NORTH') {
    return {
      ...base,
      OPERATION_planCode: false,
      OPERATION_yunYiCodeAuto: false,
      OPERATION_preEnterComfire: false,
    };
  }
  if (moduleCode === 'MEOR-WEST') {
    return {
      ...base,
      OPERATION_manualSelectPlan: false,
      OPERATION_yunYiCodeAuto: true,
    };
  }
  return base;
};

export const isFieldVisible = (
  key: FieldKey | null,
  cfg: Partial<Record<FieldKey, FieldConfig>>,
) => {
  if (!key) return true;
  const item = cfg[key];
  return item ? item.visible : true;
};

export const isFieldEditable = (
  key: FieldKey | null,
  cfg: Partial<Record<FieldKey, FieldConfig>>,
) => {
  if (!key) return false;
  const item = cfg[key];
  return item ? item.editable : false;
};

export const isOperationEnabled = (
  key: OperationKey,
  cfg: Partial<Record<OperationKey, boolean>>,
) => cfg[key] !== false;

export const readCachedSiteId = (): string | null => {
  try {
    return localStorage.getItem(SITE_STORAGE_KEY);
  } catch {
    return null;
  }
};

export const writeCachedSiteId = (siteId: string) => {
  try {
    localStorage.setItem(SITE_STORAGE_KEY, siteId);
  } catch {
    /* ignore */
  }
};

export const PLANS: CoalPlan[] = [
  {
    id: '831103931018260480',
    serialNo: 'JH20260825001',
    taskNo: 'YS20260825088',
    plate: '蒙A90005',
    supplier: '神华销售集团',
    mine: '补连塔矿',
    coalType: '神混1',
    transporter: '蒙东物流',
    unloadArea: '#1 圆形煤场',
    productName: '动力煤',
    shipTime: '2026-08-25 07:40:00',
    station: '东胜站',
    gross: 105,
    tare: 13,
    net: 92,
    samplePos: '1#机械采样机',
    weighPos: '1#汽车衡',
  },
  {
    id: '831103931018260481',
    serialNo: 'JH20260825002',
    taskNo: 'YS20260825091',
    plate: '湘C92223',
    supplier: '伊泰煤炭股份',
    mine: '酸刺沟矿',
    coalType: '准格尔',
    transporter: '湘赣联运',
    unloadArea: '#2 圆形煤场',
    productName: '动力煤',
    shipTime: '2026-08-25 08:05:00',
    station: '准格尔站',
    gross: 98.6,
    tare: 14.2,
    net: 84.4,
    samplePos: '2#机械采样机',
    weighPos: '2#汽车衡',
  },
  {
    id: '831103931018260482',
    serialNo: 'JH20260825003',
    taskNo: 'YS20260825102',
    plate: '桂A8T216',
    supplier: '大唐燃料有限公司',
    mine: '红沙泉矿',
    coalType: '蒙煤',
    transporter: '桂海运输',
    unloadArea: '厂外中转煤场',
    productName: '动力煤',
    shipTime: '2026-08-25 06:50:00',
    station: '乌海西',
    gross: 87,
    tare: 12.5,
    net: 74.5,
    samplePos: '1#机械采样机',
    weighPos: '2#汽车衡',
  },
  {
    id: '831103931018260483',
    serialNo: 'JH20260825004',
    taskNo: 'YS20260825102',
    plate: '鲁B12876',
    supplier: '国家能源销售',
    mine: '哈尔乌素矿',
    coalType: '神混1',
    transporter: '神华物流',
    unloadArea: '#1 圆形煤场',
    productName: '动力煤',
    shipTime: '2026-08-25 09:12:00',
    station: '薛家湾',
    gross: 110,
    tare: 15,
    net: 95,
    samplePos: '2#机械采样机',
    weighPos: '1#汽车衡',
  },
];

export const PRE_ENTRIES: PreEntryVehicle[] = [
  {
    plate: '蒙A90005',
    planId: '831103931018260480',
    vehicleCard: 'VC-90005',
    entryCard: '',
    preEntryAt: '2026-08-25 09:02:18',
  },
  {
    plate: '湘C92223',
    planId: '831103931018260481',
    vehicleCard: 'VC-92223',
    entryCard: 'YC-TMP-8821',
    preEntryAt: '2026-08-25 09:18:41',
  },
  {
    plate: '桂A8T216',
    planId: '831103931018260482',
    vehicleCard: 'VC-8T216',
    entryCard: 'YC-FIX-1107',
    preEntryAt: '2026-08-25 08:40:05',
  },
];

export const INITIAL_RECORDS: EntryRecord[] = [
  {
    id: 'R1001',
    serialNo: 'RCJ202608250018',
    plate: '桂A8T216',
    supplier: '大唐燃料有限公司',
    mine: '红沙泉矿',
    coalType: '蒙煤',
    sampleMethod: '机械采样',
    net: 74.5,
    weighPos: '2#汽车衡',
    samplePos: '1#机械采样机',
    enterAt: '2026-08-25 08:46:22',
    status: 'registered',
    entryCard: 'YC-FIX-1107',
    siteId: 'south',
  },
  {
    id: 'R1000',
    serialNo: 'RCJ202608250012',
    plate: '鲁B12876',
    supplier: '国家能源销售',
    mine: '哈尔乌素矿',
    coalType: '神混1',
    sampleMethod: '机械采样',
    net: 95,
    weighPos: '1#汽车衡',
    samplePos: '2#机械采样机',
    enterAt: '2026-08-25 07:21:09',
    status: 'exited',
    entryCard: 'YC-FIX-1094',
    siteId: 'south',
  },
];

export const findPlan = (id: string) => PLANS.find((p) => p.id === id);
export const findPlanByPlate = (plate: string) =>
  PLANS.find((p) => p.plate.replace(/\s/g, '') === plate.replace(/\s/g, ''));

export const findPreEntry = (plate: string) =>
  PRE_ENTRIES.find((p) => p.plate.replace(/\s/g, '') === plate.replace(/\s/g, ''));

export const lookupVehicleByPlate = (plate: string) => {
  const key = plate.trim().replace(/\s/g, '');
  if (!key) return null;
  const pre = findPreEntry(plate);
  const plan = pre ? findPlan(pre.planId) : findPlanByPlate(plate);
  if (!plan) return null;
  return { plan, pre: pre ?? null };
};

export const searchPlates = (query: string) => {
  const key = query.trim().replace(/\s/g, '').toUpperCase();
  if (key.length < 3) return [];
  const hits = new Set<string>();
  for (const plan of PLANS) {
    const plate = plan.plate.replace(/\s/g, '').toUpperCase();
    if (plate.includes(key)) hits.add(plan.plate);
  }
  return Array.from(hits);
};

/** 中国大陆车牌简易校验 */
export const isValidPlate = (plate: string) => {
  const p = plate.trim().replace(/\s/g, '');
  if (p.length < 7) return false;
  return /^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领][A-HJ-NP-Z][A-HJ-NP-Z0-9]{4,5}[A-HJ-NP-Z0-9挂学警港澳]?$/.test(
    p,
  );
};

export const nextSerial = (records: EntryRecord[]) => {
  const seq = records.length + 19;
  return `RCJ20260825${String(seq).padStart(4, '0')}`;
};

export const yunyiSample = (now = new Date()) => {
  const plan = PLANS[0];
  const stamp = formatStamp(now);
  return [
    plan.serialNo,
    plan.taskNo,
    plan.plate,
    plan.shipTime.slice(0, 16),
    plan.gross,
    plan.tare,
    plan.net,
    plan.id,
    stamp,
    plan.shipTime,
  ].join('|');
};

export const yunyiExpiredSample = () => {
  const plan = PLANS[1];
  const expired = new Date(Date.now() - 20 * 60 * 1000);
  return [
    plan.serialNo,
    plan.taskNo,
    plan.plate,
    plan.shipTime.slice(0, 16),
    plan.gross,
    plan.tare,
    plan.net,
    plan.id,
    formatStamp(expired),
    plan.shipTime,
  ].join('|');
};

export const formatStamp = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes(),
  )}:${p(d.getSeconds())}`;
};

export const uniqueSuppliers = () => Array.from(new Set(PLANS.map((p) => p.supplier)));
export const uniqueMines = () => Array.from(new Set(PLANS.map((p) => p.mine)));
export const uniqueCoalTypes = () => Array.from(new Set(PLANS.map((p) => p.coalType)));
