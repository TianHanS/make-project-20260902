/**
 * 自动入厂监测 · 系统、入厂点、排队与日志 Mock
 *
 * 现场：A 系统（入厂点 1#、2#）、B 系统（入厂点 3#、4#）
 *
 * 参考资料：
 * - /src/prototypes/auto-entry-monitor/spec.md
 */

export type DeviceStatus = 'online' | 'offline';
export type LogLevel = 'normal' | 'exception';
export type LogKind =
  | 'recognize'
  | 'register-ok'
  | 'register-fail'
  | 'abnormal'
  | 'inspect'
  | 'cut-in'
  | 'service'
  | 'offline';

export type QueueStatus = 'waiting' | 'approaching' | 'overtime';

export interface SystemInfo {
  id: string;
  name: string;
  gateIds: string[];
}

export interface GatePoint {
  id: string;
  systemId: string;
  name: string;
  cameraName: string;
  recognizer: DeviceStatus;
  led: DeviceStatus;
  serviceEnabled: boolean;
  ledText: string;
  currentPlate: string;
}

export interface RunLog {
  id: string;
  gateId: string;
  time: string;
  level: LogLevel;
  kind: LogKind;
  message: string;
  plate?: string;
}

export interface EntryRecord {
  id: string;
  gateId: string;
  plate: string;
  enterAt: string;
  samplePos: string;
  weighPos: string;
}

export interface QueueVehicle {
  id: string;
  systemId: string;
  seq: number;
  plate: string;
  cargo: string;
  supplier: string;
  waitMin: number;
  status: QueueStatus;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function formatDateTime(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function formatClock(d: Date): string {
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return `${formatDateTime(d)} 星期${week}`;
}

function minutesAgo(base: Date, min: number, sec = 0): string {
  return formatDateTime(new Date(base.getTime() - min * 60_000 - sec * 1000));
}

export const LOG_KIND_LABEL: Record<LogKind, string> = {
  recognize: '识别车辆',
  'register-ok': '登记成功',
  'register-fail': '登记失败',
  abnormal: '车辆异常',
  inspect: '车辆抽检',
  'cut-in': '车辆插队',
  service: '服务启停',
  offline: '设备离线',
};

export const QUEUE_STATUS_LABEL: Record<QueueStatus, string> = {
  waiting: '排队中',
  approaching: '即将入厂',
  overtime: '等待超时',
};

export const SAMPLE_POS = ['1#机械采样', '2#机械采样', '3#人工采样', '4#机械采样'];
export const WEIGH_POS = ['1#汽车衡', '2#汽车衡', '3#汽车衡', '4#汽车衡'];

/** A 系统：入厂点 1#、2#；B 系统：入厂点 3#、4# */
export const SYSTEMS: SystemInfo[] = [
  { id: 'system-a', name: 'A 系统', gateIds: ['gate-1', 'gate-2'] },
  { id: 'system-b', name: 'B 系统', gateIds: ['gate-3', 'gate-4'] },
];

export function createInitialGates(): GatePoint[] {
  return [
    {
      id: 'gate-1',
      systemId: 'system-a',
      name: '入厂点 1#',
      cameraName: 'CAM-A1 车号识别',
      recognizer: 'online',
      led: 'online',
      serviceEnabled: true,
      ledText: '欢迎入厂  鲁B·8G267  请驶入 1#车道',
      currentPlate: '鲁B8G267',
    },
    {
      id: 'gate-2',
      systemId: 'system-a',
      name: '入厂点 2#',
      cameraName: 'CAM-A2 车号识别',
      recognizer: 'online',
      led: 'online',
      serviceEnabled: true,
      ledText: '请排队等候  下一位 豫C·19086',
      currentPlate: '豫C19086',
    },
    {
      id: 'gate-3',
      systemId: 'system-b',
      name: '入厂点 3#',
      cameraName: 'CAM-B3 车号识别',
      recognizer: 'online',
      led: 'online',
      serviceEnabled: true,
      ledText: '欢迎入厂  晋M·66521  请驶入采样',
      currentPlate: '晋M66521',
    },
    {
      id: 'gate-4',
      systemId: 'system-b',
      name: '入厂点 4#',
      cameraName: 'CAM-B4 车号识别',
      recognizer: 'offline',
      led: 'offline',
      serviceEnabled: true,
      ledText: '设备离线  暂停自动入厂',
      currentPlate: '',
    },
  ];
}

export function createInitialLogs(now: Date): RunLog[] {
  return [
    { id: 'ls1', gateId: 'gate-1', time: minutesAgo(now, 0, 18), level: 'normal', kind: 'register-ok', plate: '鲁B8G267', message: '登记成功 鲁B8G267，采样位 1#机械采样，过衡位 1#汽车衡' },
    { id: 'ls2', gateId: 'gate-1', time: minutesAgo(now, 0, 22), level: 'normal', kind: 'recognize', plate: '鲁B8G267', message: '识别车辆 鲁B8G267，置信度 98%' },
    { id: 'ls3', gateId: 'gate-1', time: minutesAgo(now, 4, 10), level: 'normal', kind: 'inspect', plate: '皖S22901', message: '车辆抽检 皖S22901，已引导至抽检区' },
    { id: 'ls4', gateId: 'gate-1', time: minutesAgo(now, 8, 40), level: 'exception', kind: 'abnormal', plate: '黑H77320', message: '车辆异常 黑H77320：预入厂状态为禁止入厂登记' },
    { id: 'ls5', gateId: 'gate-1', time: minutesAgo(now, 12, 5), level: 'normal', kind: 'register-ok', plate: '豫A66102', message: '登记成功 豫A66102，采样位 2#机械采样，过衡位 2#汽车衡' },
    { id: 'ls6', gateId: 'gate-1', time: minutesAgo(now, 12, 12), level: 'normal', kind: 'recognize', plate: '豫A66102', message: '识别车辆 豫A66102，置信度 97%' },
    { id: 'ls7', gateId: 'gate-1', time: minutesAgo(now, 18, 33), level: 'exception', kind: 'cut-in', plate: '鲁N44018', message: '车辆插队 鲁N44018：未按排队序号驶入识别区' },
    { id: 'ls8', gateId: 'gate-1', time: minutesAgo(now, 25, 2), level: 'normal', kind: 'register-ok', plate: '晋D90811', message: '登记成功 晋D90811，采样位 1#机械采样，过衡位 1#汽车衡' },

    { id: 'lt1', gateId: 'gate-2', time: minutesAgo(now, 1, 5), level: 'normal', kind: 'recognize', plate: '豫C19086', message: '识别车辆 豫C19086，正在核验计划' },
    { id: 'lt2', gateId: 'gate-2', time: minutesAgo(now, 3, 20), level: 'normal', kind: 'register-ok', plate: '鲁Q33560', message: '登记成功 鲁Q33560，采样位 3#人工采样，过衡位 2#汽车衡' },
    { id: 'lt3', gateId: 'gate-2', time: minutesAgo(now, 6, 48), level: 'exception', kind: 'register-fail', plate: '豫P21044', message: '登记失败 豫P21044：未匹配到来煤计划' },
    { id: 'lt4', gateId: 'gate-2', time: minutesAgo(now, 6, 52), level: 'normal', kind: 'recognize', plate: '豫P21044', message: '识别车辆 豫P21044，置信度 95%' },
    { id: 'lt5', gateId: 'gate-2', time: minutesAgo(now, 11, 16), level: 'normal', kind: 'register-ok', plate: '冀H88217', message: '登记成功 冀H88217，采样位 2#机械采样，过衡位 1#汽车衡' },
    { id: 'lt6', gateId: 'gate-2', time: minutesAgo(now, 16, 9), level: 'exception', kind: 'abnormal', plate: '苏E19002', message: '车辆异常 苏E19002：车号识别与运单车牌不一致' },
    { id: 'lt7', gateId: 'gate-2', time: minutesAgo(now, 22, 41), level: 'normal', kind: 'inspect', plate: '鲁A77831', message: '车辆抽检 鲁A77831，已下发 LED 抽检提示' },

    { id: 'ln1', gateId: 'gate-3', time: minutesAgo(now, 2, 8), level: 'normal', kind: 'register-ok', plate: '晋M66521', message: '登记成功 晋M66521，采样位 1#机械采样，过衡位 3#汽车衡' },
    { id: 'ln2', gateId: 'gate-3', time: minutesAgo(now, 2, 14), level: 'normal', kind: 'recognize', plate: '晋M66521', message: '识别车辆 晋M66521，置信度 99%' },
    { id: 'ln3', gateId: 'gate-3', time: minutesAgo(now, 9, 30), level: 'normal', kind: 'register-ok', plate: '蒙B44190', message: '登记成功 蒙B44190，采样位 2#机械采样，过衡位 3#汽车衡' },
    { id: 'ln4', gateId: 'gate-3', time: minutesAgo(now, 15, 11), level: 'exception', kind: 'cut-in', plate: '晋C22018', message: '车辆插队 晋C22018：绕行识别杆进入车道' },

    { id: 'lo1', gateId: 'gate-4', time: minutesAgo(now, 7, 0), level: 'exception', kind: 'offline', message: '车号识别器离线，自动入厂暂停' },
    { id: 'lo2', gateId: 'gate-4', time: minutesAgo(now, 7, 2), level: 'exception', kind: 'offline', message: 'LED 大屏通讯中断' },
    { id: 'lo3', gateId: 'gate-4', time: minutesAgo(now, 41, 20), level: 'normal', kind: 'register-ok', plate: '冀F10228', message: '登记成功 冀F10228，采样位 4#机械采样，过衡位 4#汽车衡' },
  ];
}

export function createInitialRecords(now: Date): EntryRecord[] {
  return [
    { id: 'rs1', gateId: 'gate-1', plate: '鲁B8G267', enterAt: minutesAgo(now, 0, 18), samplePos: '1#机械采样', weighPos: '1#汽车衡' },
    { id: 'rs2', gateId: 'gate-1', plate: '豫A66102', enterAt: minutesAgo(now, 12, 5), samplePos: '2#机械采样', weighPos: '2#汽车衡' },
    { id: 'rs3', gateId: 'gate-1', plate: '晋D90811', enterAt: minutesAgo(now, 25, 2), samplePos: '1#机械采样', weighPos: '1#汽车衡' },
    { id: 'rs4', gateId: 'gate-1', plate: '鲁H22019', enterAt: minutesAgo(now, 41, 30), samplePos: '2#机械采样', weighPos: '2#汽车衡' },
    { id: 'rs5', gateId: 'gate-1', plate: '豫N44100', enterAt: minutesAgo(now, 58, 12), samplePos: '1#机械采样', weighPos: '1#汽车衡' },

    { id: 'rt1', gateId: 'gate-2', plate: '鲁Q33560', enterAt: minutesAgo(now, 3, 20), samplePos: '3#人工采样', weighPos: '2#汽车衡' },
    { id: 'rt2', gateId: 'gate-2', plate: '冀H88217', enterAt: minutesAgo(now, 11, 16), samplePos: '2#机械采样', weighPos: '1#汽车衡' },
    { id: 'rt3', gateId: 'gate-2', plate: '皖B10933', enterAt: minutesAgo(now, 33, 8), samplePos: '1#机械采样', weighPos: '2#汽车衡' },
    { id: 'rt4', gateId: 'gate-2', plate: '豫S77218', enterAt: minutesAgo(now, 49, 41), samplePos: '4#机械采样', weighPos: '1#汽车衡' },

    { id: 'rn1', gateId: 'gate-3', plate: '晋M66521', enterAt: minutesAgo(now, 2, 8), samplePos: '1#机械采样', weighPos: '3#汽车衡' },
    { id: 'rn2', gateId: 'gate-3', plate: '蒙B44190', enterAt: minutesAgo(now, 9, 30), samplePos: '2#机械采样', weighPos: '3#汽车衡' },
    { id: 'rn3', gateId: 'gate-3', plate: '陕C11820', enterAt: minutesAgo(now, 27, 55), samplePos: '1#机械采样', weighPos: '4#汽车衡' },

    { id: 'ro1', gateId: 'gate-4', plate: '冀F10228', enterAt: minutesAgo(now, 41, 20), samplePos: '4#机械采样', weighPos: '4#汽车衡' },
  ];
}

export const QUEUE_VEHICLES: QueueVehicle[] = [
  { id: 'qs1', systemId: 'system-a', seq: 1, plate: '豫C19086', cargo: '烟煤', supplier: '兖矿物流', waitMin: 4, status: 'approaching' },
  { id: 'qs2', systemId: 'system-a', seq: 2, plate: '鲁L55201', cargo: '混煤', supplier: '枣庄矿业', waitMin: 11, status: 'waiting' },
  { id: 'qs3', systemId: 'system-a', seq: 3, plate: '晋E90822', cargo: '贫瘦煤', supplier: '同煤集团', waitMin: 18, status: 'waiting' },
  { id: 'qs4', systemId: 'system-a', seq: 4, plate: '冀D44119', cargo: '褐煤', supplier: '开滦股份', waitMin: 26, status: 'waiting' },
  { id: 'qs5', systemId: 'system-a', seq: 5, plate: '豫H22076', cargo: '烟煤', supplier: '永煤物流', waitMin: 34, status: 'overtime' },
  { id: 'qs6', systemId: 'system-a', seq: 6, plate: '皖S11804', cargo: '洗中煤', supplier: '淮北矿业', waitMin: 41, status: 'overtime' },

  { id: 'qn1', systemId: 'system-b', seq: 1, plate: '蒙C77210', cargo: '褐煤', supplier: '伊泰煤炭', waitMin: 7, status: 'approaching' },
  { id: 'qn2', systemId: 'system-b', seq: 2, plate: '晋K33045', cargo: '贫煤', supplier: '阳煤集团', waitMin: 16, status: 'waiting' },
  { id: 'qn3', systemId: 'system-b', seq: 3, plate: '陕F10928', cargo: '烟煤', supplier: '陕煤运销', waitMin: 22, status: 'waiting' },
  { id: 'qn4', systemId: 'system-b', seq: 4, plate: '宁A44103', cargo: '混煤', supplier: '神华宁煤', waitMin: 31, status: 'overtime' },
];

export const LIVE_PLATES = [
  '鲁K22817', '豫B44109', '晋A90833', '冀C77201', '蒙D33018',
  '陕H11920', '皖Q55264', '苏L20811', '辽M44107', '甘N99021',
];

export function gateDeviceStatus(gate: GatePoint): DeviceStatus {
  return gate.recognizer === 'online' ? 'online' : 'offline';
}

export function nextLogId(): string {
  return `lg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
