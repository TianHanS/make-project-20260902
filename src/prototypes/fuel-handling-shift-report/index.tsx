/**
 * @name 燃运值班报表
 *
 * 原型说明：
 * 四维数字化煤场后台「燃运班值报表」统计查询页。
 * 浅色 Ant Design 中后台风格：筛选查询、多级表头汇总、
 * 设备测点明细下钻、CSV 导出下载。
 */

import React, { useState, useMemo } from 'react';
import { 
  ConfigProvider, 
  theme, 
  Table, 
  Select, 
  DatePicker, 
  Button, 
  Tooltip, 
  Drawer, 
  Modal, 
  Tag, 
  Badge, 
  Empty,
  message
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  InfoCircleOutlined,
  QuestionCircleOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  AlertOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import './style.css';

// ----------------------------------------------------
// Mock Data Engine (高保真模拟数据生成)
// ----------------------------------------------------

// 班值列表
const SHIFT_VALUES = ['发电一值', '发电二值', '发电三值', '发电四值'];
// 班次列表
const SHIFT_NAMES = ['白班', '夜班'];

interface DeviceDetail {
  id: string;
  name: string;
  code: string;
  type: 'In_Belt_Sample' | 'Load_Belt_sample' | 'Iron_Remove' | 'Dust_Remove';
  typeName: string;
  runTime: number;       // 运行时长 min
  loadTime: number;      // 有载时长 min
  shouldTime: number;    // 应投用时长 min
  faultTime: number;     // 故障时长 min
  useRate: number;       // 投用率 %
}

type DeviceTypeKey = DeviceDetail['type'];

interface TripAlarmRecord {
  id: string;
  alarmTime: string;       // YYYY-MM-DD HH:mm:ss
  deviceName: string;
  pointCode: string;
  alarmType: string;       // 电流跳机 / 过流保护 等
  section: '卸煤段' | '上煤段';
  content: string;
  recoverTime: string;     // 复归时间，未复归为 '-'
}

type BeltSection = '卸煤段' | '上煤段';

interface ReportRow {
  key: string;
  date: string;          // YYYY-MM-DD
  shiftName: string;     // 白班 / 夜班
  shiftValue: string;    // 发电一值 / ...
  // 接卸统计
  unloadWeight: number;  // 卸煤量 t
  // 加仓统计
  loadTotalWeight: number; // 总加仓量 t
  loadUnit1Weight: number; // #1机组加仓量 t
  loadUnit2Weight: number; // #2机组加仓量 t
  // 输煤系统 - 卸煤段
  unloadEnergy: number;       // 电度 kWh
  unloadUnitEnergy: number;   // 输煤单耗 t/kWh
  unloadRunTime: number;      // 运行时长 min
  unloadIdleTime: number;     // 空载时长 min
  unloadTrips: number;        // 跳机次数
  // 输煤系统 - 上煤段
  loadEnergy: number;         // 电度 kWh
  loadUnitEnergy: number;     // 输煤单耗 t/kWh
  loadRunTime: number;        // 运行时长 min
  loadIdleTime: number;     // 空载时长 min
  loadTrips: number;          // 跳机次数
  // 设备类型班次综合投运率 %
  sampleInRate: number;      // 入厂采样投运率
  sampleOutRate: number;     // 入炉采样投运率
  ironRemoveRate: number;    // 除铁投运率
  dustRemoveRate: number;    // 除尘投运率
  // 明细设备数据
  deviceDetails: DeviceDetail[];
  // 跳机报警明细（按段）
  unloadTripAlarms: TripAlarmRecord[];
  loadTripAlarms: TripAlarmRecord[];
}

const DEVICE_TYPE_LABEL: Record<DeviceTypeKey, string> = {
  In_Belt_Sample: '入厂采样',
  Load_Belt_sample: '入炉采样',
  Iron_Remove: '除铁装置',
  Dust_Remove: '除尘装置'
};

/** 班次应投用时长：固定为班次时长 8 小时 */
const SHIFT_SHOULD_MINUTES = 8 * 60;

const UNLOAD_TRIP_DEVICES = [
  { name: 'C31皮带', code: 'GXSZ:CTDCS-1:C31_OverCurrent_Trip' },
  { name: 'C32皮带', code: 'GXSZ:CTDCS-1:C32_OverCurrent_Trip' },
  { name: 'C33皮带', code: 'GXSZ:CTDCS-1:C33_OverCurrent_Trip' },
  { name: 'C34皮带', code: 'GXSZ:CTDCS-1:C34_OverCurrent_Trip' }
];

const LOAD_TRIP_DEVICES = [
  { name: 'C35皮带', code: 'GXSZ:CTDCS-1:C35_OverCurrent_Trip' },
  { name: 'C36皮带', code: 'GXSZ:CTDCS-1:C36_OverCurrent_Trip' },
  { name: 'C37皮带', code: 'GXSZ:CTDCS-1:C37_OverCurrent_Trip' },
  { name: 'C38皮带', code: 'GXSZ:CTDCS-1:C38_OverCurrent_Trip' },
  { name: '碎煤机', code: 'GXSZ:CTDCS-1:Crusher_OverCurrent_Trip' }
];

const TRIP_ALARM_TYPES = ['电流跳机', '过流保护跳机', '电机过载跳机'];

/** 获取班次时间范围文案与起止 dayjs */
const getShiftTimeRange = (date: string, shiftName: string) => {
  if (shiftName === '白班') {
    const start = dayjs(`${date} 08:00:00`);
    const end = dayjs(`${date} 20:00:00`);
    return {
      start,
      end,
      label: `${date} 08:00:00 ~ ${date} 20:00:00`
    };
  }
  const nextDay = dayjs(date).add(1, 'day').format('YYYY-MM-DD');
  const start = dayjs(`${date} 20:00:00`);
  const end = dayjs(`${nextDay} 08:00:00`);
  return {
    start,
    end,
    label: `${date} 20:00:00 ~ ${nextDay} 08:00:00`
  };
};

const generateTripAlarms = (
  count: number,
  date: string,
  shiftName: string,
  section: BeltSection,
  rowKey: string
): TripAlarmRecord[] => {
  if (count <= 0) return [];
  const { start } = getShiftTimeRange(date, shiftName);
  const devices = section === '卸煤段' ? UNLOAD_TRIP_DEVICES : LOAD_TRIP_DEVICES;
  const alarms: TripAlarmRecord[] = [];
  for (let i = 0; i < count; i++) {
    const device = devices[Math.floor(Math.random() * devices.length)];
    const offsetMin = Math.floor(30 + Math.random() * 400); // 班次内随机时刻
    const alarmAt = start.add(offsetMin, 'minute');
    const recovered = Math.random() > 0.25;
    const recoverAt = recovered ? alarmAt.add(3 + Math.floor(Math.random() * 25), 'minute') : null;
    const alarmType = TRIP_ALARM_TYPES[Math.floor(Math.random() * TRIP_ALARM_TYPES.length)];
    alarms.push({
      id: `${rowKey}-${section}-${i}`,
      alarmTime: alarmAt.format('YYYY-MM-DD HH:mm:ss'),
      deviceName: device.name,
      pointCode: device.code,
      alarmType,
      section,
      content: `${device.name}${alarmType}，程控DCS过流保护动作停机`,
      recoverTime: recoverAt ? recoverAt.format('YYYY-MM-DD HH:mm:ss') : '-'
    });
  }
  return alarms.sort((a, b) => a.alarmTime.localeCompare(b.alarmTime));
};

// 模拟生成班值数据（含默认演示月 2025-07，以及竞赛跳转用的 2026-06 / 2026-07）
const generateMockData = (): ReportRow[] => {
  const data: ReportRow[] = [];
  const periods = [
    { start: '2025-07-01', days: 13 },
    { start: '2026-06-01', days: 30 },
    { start: '2026-07-01', days: 31 },
  ];

  // 安排固定的班值轮流规则
  const valRotation = ['发电一值', '发电二值', '发电三值', '发电四值'];
  let rotationIndex = 0;

  periods.forEach(({ start, days }) => {
    const startDate = dayjs(start);

    for (let i = 0; i < days; i++) {
      const currentDate = startDate.add(i, 'day').format('YYYY-MM-DD');

      SHIFT_NAMES.forEach((shiftName) => {
        const shiftValue = valRotation[rotationIndex % 4];
        rotationIndex++;

        // 根据班次特性生成随机但符合逻辑的数值
        const isDay = shiftName === '白班';

        // 1. 接卸统计 (白班接卸多，夜班少点)
        const unloadWeight = isDay
          ? Math.round(3500 + Math.random() * 2500)
          : Math.round(1500 + Math.random() * 2000);

        // 2. 加仓总量统计
        const loadTotalWeight = isDay
          ? Math.round(2200 + Math.random() * 1000)
          : Math.round(1200 + Math.random() * 1200);

        // 分仓加仓 (机组1和机组2)
        const loadUnit1Weight = Math.round(loadTotalWeight * (0.45 + Math.random() * 0.1));
        const loadUnit2Weight = loadTotalWeight - loadUnit1Weight;

        // 3. 卸煤段
        const unloadEnergy = Math.round(unloadWeight / (2.2 + Math.random() * 0.6));
        const unloadUnitEnergy = Number((unloadWeight / unloadEnergy).toFixed(2));
        const unloadRunTime = Math.round(unloadWeight / (12 + Math.random() * 3)); // 吨数除以给料速度
        const unloadIdleTime = Math.round(20 + Math.random() * 45); // 空载 20~65分钟
        // 偶发跳机，便于演示下钻（约 35% 班次有卸煤段跳机）
        const unloadTrips = Math.random() > 0.65 ? (Math.random() > 0.6 ? 2 : 1) : 0;

        // 4. 上煤段
        const loadEnergy = Math.round(loadTotalWeight / (1.8 + Math.random() * 0.4));
        const loadUnitEnergy = Number((loadTotalWeight / loadEnergy).toFixed(2));
        const loadRunTime = Math.round(loadTotalWeight / (10 + Math.random() * 2));
        const loadIdleTime = Math.round(15 + Math.random() * 30);
        const loadTrips = Math.random() > 0.75 ? (Math.random() > 0.7 ? 2 : 1) : 0;

        const rowKey = `${currentDate}-${shiftName}`;
        const unloadTripAlarms = generateTripAlarms(unloadTrips, currentDate, shiftName, '卸煤段', rowKey);
        const loadTripAlarms = generateTripAlarms(loadTrips, currentDate, shiftName, '上煤段', rowKey);

        // 5. 设备明细投运模拟
        // 1# 2#入厂采样，1# 2#入炉采样，1# 2# 3#除铁器，1# 2# 3# 4#除尘器
        const rawInSample = [
          { id: 'dev-1', name: '1#入厂皮带采样机', code: 'GXSZ:BS:1#In_Belt_Sample', type: 'In_Belt_Sample' as const, typeName: '入厂采样' },
          { id: 'dev-2', name: '2#入厂皮带采样机', code: 'GXSZ:BS:2#In_Belt_Sample', type: 'In_Belt_Sample' as const, typeName: '入厂采样' }
        ];
        const rawOutSample = [
          { id: 'dev-3', name: '1#入炉皮带采样机', code: 'GXSZ:MS:1#Load_Belt_sample', type: 'Load_Belt_sample' as const, typeName: '入炉采样' },
          { id: 'dev-4', name: '2#入炉皮带采样机', code: 'GXSZ:MS:2#Load_Belt_sample', type: 'Load_Belt_sample' as const, typeName: '入炉采样' }
        ];
        const rawIron = [
          { id: 'dev-5', name: '1#电磁除铁器', code: 'GXSZ:IR:1#Iron_Remove', type: 'Iron_Remove' as const, typeName: '除铁装置' },
          { id: 'dev-6', name: '2#自卸式除铁器', code: 'GXSZ:IR:2#Iron_Remove', type: 'Iron_Remove' as const, typeName: '除铁装置' },
          { id: 'dev-7', name: '3#高梯度除铁器', code: 'GXSZ:IR:3#Iron_Remove', type: 'Iron_Remove' as const, typeName: '除铁装置' }
        ];
        const rawDust = [
          { id: 'dev-8', name: '1#煤仓间布袋除尘器', code: 'GXSZ:DR:1#Dust_Remove', type: 'Dust_Remove' as const, typeName: '除尘装置' },
          { id: 'dev-9', name: '2#转运站除尘器', code: 'GXSZ:DR:2#Dust_Remove', type: 'Dust_Remove' as const, typeName: '除尘装置' },
          { id: 'dev-10', name: '3#碎煤机室除尘器', code: 'GXSZ:DR:3#Dust_Remove', type: 'Dust_Remove' as const, typeName: '除尘装置' },
          { id: 'dev-11', name: '4#皮带间高压静电除尘', code: 'GXSZ:DR:4#Dust_Remove', type: 'Dust_Remove' as const, typeName: '除尘装置' }
        ];

        const generateDetails = (
          rawList: { id: string; name: string; code: string; type: any; typeName: string }[]
        ): DeviceDetail[] => {
          return rawList.map(item => {
            // 应投用时长固定为班次时长 8 小时（480 min）
            const shouldTime = SHIFT_SHOULD_MINUTES;
            const faultTime = Math.random() > 0.85 ? Math.round(5 + Math.random() * 35) : 0;
            const runTime = Math.max(0, shouldTime - faultTime);
            const loadTime = Math.round(runTime * (0.8 + Math.random() * 0.15));
            const useRate = Number(((shouldTime - faultTime) / shouldTime * 100).toFixed(1));
            return {
              id: item.id,
              name: item.name,
              code: item.code,
              type: item.type,
              typeName: item.typeName,
              runTime,
              loadTime,
              shouldTime,
              faultTime,
              useRate: Math.max(0, Math.min(100, useRate))
            };
          });
        };

        const inSampleDetails = generateDetails(rawInSample);
        const outSampleDetails = generateDetails(rawOutSample);
        const ironDetails = generateDetails(rawIron);
        const dustDetails = generateDetails(rawDust);

        const deviceDetails = [...inSampleDetails, ...outSampleDetails, ...ironDetails, ...dustDetails];

        // 计算均值作为班次综合投运率
        const getAvgRate = (details: DeviceDetail[]) => {
          const sum = details.reduce((acc, cur) => acc + cur.useRate, 0);
          return Number((sum / details.length).toFixed(1));
        };

        data.push({
          key: rowKey,
          date: currentDate,
          shiftName,
          shiftValue,
          unloadWeight,
          loadTotalWeight,
          loadUnit1Weight,
          loadUnit2Weight,
          unloadEnergy,
          unloadUnitEnergy,
          unloadRunTime,
          unloadIdleTime,
          unloadTrips,
          loadEnergy,
          loadUnitEnergy,
          loadRunTime,
          loadIdleTime,
          loadTrips,
          sampleInRate: getAvgRate(inSampleDetails),
          sampleOutRate: getAvgRate(outSampleDetails),
          ironRemoveRate: getAvgRate(ironDetails),
          dustRemoveRate: getAvgRate(dustDetails),
          deviceDetails,
          unloadTripAlarms,
          loadTripAlarms
        });
      });
    }
  });

  return data;
};

// ----------------------------------------------------
// 主原型组件
// ----------------------------------------------------

/** 解析竞赛页等外部跳转带入的查询条件 */
function getQueryBootstrap() {
  if (typeof window === 'undefined') {
    return {
      shiftValue: '全部',
      dateRange: [dayjs('2025-07-01'), dayjs('2025-07-13')] as [dayjs.Dayjs, dayjs.Dayjs],
      fromCompetition: false,
    };
  }
  const params = new URLSearchParams(window.location.search);
  const shiftValue = params.get('shiftValue') || params.get('teamDutyName') || '全部';
  const startDate = params.get('startDate');
  const endDate = params.get('endDate');
  const validShift = ['全部', ...SHIFT_VALUES].includes(shiftValue) ? shiftValue : '全部';
  if (startDate && endDate && dayjs(startDate).isValid() && dayjs(endDate).isValid()) {
    return {
      shiftValue: validShift,
      dateRange: [dayjs(startDate), dayjs(endDate)] as [dayjs.Dayjs, dayjs.Dayjs],
      fromCompetition: true,
    };
  }
  return {
    shiftValue: validShift === '全部' ? '全部' : validShift,
    dateRange: [dayjs('2025-07-01'), dayjs('2025-07-13')] as [dayjs.Dayjs, dayjs.Dayjs],
    fromCompetition: validShift !== '全部',
  };
}

const Component: React.FC = () => {
  const bootstrap = useMemo(() => getQueryBootstrap(), []);

  // 全量模拟数据
  const [allData] = useState<ReportRow[]>(() => generateMockData());

  // 筛选状态
  const [selectedShiftValue, setSelectedShiftValue] = useState<string>(bootstrap.shiftValue);
  const [selectedShiftName, setSelectedShiftName] = useState<string>('全部');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>(bootstrap.dateRange);

  // 下钻与对话框/抽屉状态
  const [selectedRecord, setSelectedRecord] = useState<ReportRow | null>(null);
  const [selectedDeviceType, setSelectedDeviceType] = useState<DeviceTypeKey | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [selectedTripSection, setSelectedTripSection] = useState<BeltSection | null>(null);
  const [isTripDrawerOpen, setIsTripDrawerOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  /** 全量筛选结果上的排序（非当前分页内排序） */
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'ascend' | 'descend' | null>(null);

  const openDeviceTypeDetail = (record: ReportRow, deviceType: DeviceTypeKey) => {
    setIsTripDrawerOpen(false);
    setSelectedTripSection(null);
    setSelectedRecord(record);
    setSelectedDeviceType(deviceType);
    setIsDrawerOpen(true);
  };

  const closeDeviceDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedDeviceType(null);
  };

  const openTripAlarmDetail = (record: ReportRow, section: BeltSection) => {
    setIsDrawerOpen(false);
    setSelectedDeviceType(null);
    setSelectedRecord(record);
    setSelectedTripSection(section);
    setIsTripDrawerOpen(true);
  };

  const closeTripDrawer = () => {
    setIsTripDrawerOpen(false);
    setSelectedTripSection(null);
  };

  const typeDeviceList = useMemo(() => {
    if (!selectedRecord || !selectedDeviceType) return [];
    return selectedRecord.deviceDetails.filter((d) => d.type === selectedDeviceType);
  }, [selectedRecord, selectedDeviceType]);

  const typeAvgRate = useMemo(() => {
    if (!selectedRecord || !selectedDeviceType) return 0;
    if (selectedDeviceType === 'In_Belt_Sample') return selectedRecord.sampleInRate;
    if (selectedDeviceType === 'Load_Belt_sample') return selectedRecord.sampleOutRate;
    if (selectedDeviceType === 'Iron_Remove') return selectedRecord.ironRemoveRate;
    return selectedRecord.dustRemoveRate;
  }, [selectedRecord, selectedDeviceType]);

  const tripAlarmList = useMemo(() => {
    if (!selectedRecord || !selectedTripSection) return [];
    return selectedTripSection === '卸煤段'
      ? selectedRecord.unloadTripAlarms
      : selectedRecord.loadTripAlarms;
  }, [selectedRecord, selectedTripSection]);

  const tripShiftRangeLabel = useMemo(() => {
    if (!selectedRecord) return '';
    return getShiftTimeRange(selectedRecord.date, selectedRecord.shiftName).label;
  }, [selectedRecord]);

  // 重置筛选
  const handleReset = () => {
    setSelectedShiftValue('全部');
    setSelectedShiftName('全部');
    setDateRange([dayjs('2025-07-01'), dayjs('2025-07-13')]);
    setSortField(null);
    setSortOrder(null);
    message.success('查询条件已重置');
  };

  // 根据当前筛选过滤数据（不含用户表头排序）
  const filteredData = useMemo(() => {
    return allData.filter((row: ReportRow) => {
      const matchValue = selectedShiftValue === '全部' || row.shiftValue === selectedShiftValue;
      const matchName = selectedShiftName === '全部' || row.shiftName === selectedShiftName;
      const rowDate = dayjs(row.date);
      const matchDate = (!dateRange[0] || rowDate.isAfter(dateRange[0].subtract(1, 'day'), 'day')) &&
                        (!dateRange[1] || rowDate.isBefore(dateRange[1].add(1, 'day'), 'day'));
      return matchValue && matchName && matchDate;
    });
  }, [allData, selectedShiftValue, selectedShiftName, dateRange]);

  // 在筛选结果全集上排序，再交给表格分页（避免仅排当前页）
  const displayData = useMemo(() => {
    const data = [...filteredData];
    if (!sortField || !sortOrder) {
      return data.sort((a: ReportRow, b: ReportRow) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return b.shiftName.localeCompare(a.shiftName);
      });
    }
    const dir = sortOrder === 'ascend' ? 1 : -1;
    return data.sort((a: ReportRow, b: ReportRow) => {
      const av = (a as any)[sortField];
      const bv = (b as any)[sortField];
      if (typeof av === 'number' && typeof bv === 'number') {
        return (av - bv) * dir;
      }
      return String(av ?? '').localeCompare(String(bv ?? ''), 'zh-CN') * dir;
    });
  }, [filteredData, sortField, sortOrder]);

  // 处理客户端真实的 CSV 文件下载
  const handleExportCSV = () => {
    setIsExporting(true);
    
    setTimeout(() => {
      try {
        const startStr = dateRange[0].format('YYYYMMDD');
        const endStr = dateRange[1].format('YYYYMMDD');
        const filename = `${startStr}至${endStr}燃运班值报表.csv`;
        const exportRows = displayData;

        // 构造 CSV 头部与多级数据
        let csvContent = '\uFEFF'; // UTF-8 BOM
        csvContent += '班值,日期,班次,卸煤量(t),加仓总量(t),机组1加仓量(t),机组2加仓量(t),卸煤段电度(kWh),卸煤段输煤单耗(t/kWh),卸煤段运行时长(min),卸煤段空载时长(min),卸煤段跳机次数,上煤段电度(kWh),上煤段输煤单耗(t/kWh),上煤段运行时长(min),上煤段空载时长(min),上煤段跳机次数,入厂采样综合投运率(%),入炉采样综合投运率(%),除铁装置综合投运率(%),除尘装置综合投运率(%)\n';

        exportRows.forEach((row: ReportRow) => {
          csvContent += [
            row.shiftValue,
            row.date,
            row.shiftName,
            row.unloadWeight,
            row.loadTotalWeight,
            row.loadUnit1Weight,
            row.loadUnit2Weight,
            row.unloadEnergy,
            row.unloadUnitEnergy,
            row.unloadRunTime,
            row.unloadIdleTime,
            row.unloadTrips,
            row.loadEnergy,
            row.loadUnitEnergy,
            row.loadRunTime,
            row.loadIdleTime,
            row.loadTrips,
            row.sampleInRate,
            row.sampleOutRate,
            row.ironRemoveRate,
            row.dustRemoveRate
          ].join(',') + '\n';
        });

        // 写入合计行
        const totalUnload = exportRows.reduce((acc: number, cur: ReportRow) => acc + cur.unloadWeight, 0);
        const totalLoad = exportRows.reduce((acc: number, cur: ReportRow) => acc + cur.loadTotalWeight, 0);
        const totalUnit1 = exportRows.reduce((acc: number, cur: ReportRow) => acc + cur.loadUnit1Weight, 0);
        const totalUnit2 = exportRows.reduce((acc: number, cur: ReportRow) => acc + cur.loadUnit2Weight, 0);
        const totalUnloadEnergy = exportRows.reduce((acc: number, cur: ReportRow) => acc + cur.unloadEnergy, 0);
        const totalLoadEnergy = exportRows.reduce((acc: number, cur: ReportRow) => acc + cur.loadEnergy, 0);
        const totalUnloadTime = exportRows.reduce((acc: number, cur: ReportRow) => acc + cur.unloadRunTime, 0);
        const totalUnloadIdle = exportRows.reduce((acc: number, cur: ReportRow) => acc + cur.unloadIdleTime, 0);
        const totalUnloadTrips = exportRows.reduce((acc: number, cur: ReportRow) => acc + cur.unloadTrips, 0);
        const totalLoadTime = exportRows.reduce((acc: number, cur: ReportRow) => acc + cur.loadRunTime, 0);
        const totalLoadIdle = exportRows.reduce((acc: number, cur: ReportRow) => acc + cur.loadIdleTime, 0);
        const totalLoadTrips = exportRows.reduce((acc: number, cur: ReportRow) => acc + cur.loadTrips, 0);
        
        const avgUnloadSingle = totalUnloadEnergy > 0 ? (totalUnload / totalUnloadEnergy).toFixed(2) : '0';
        const avgLoadSingle = totalLoadEnergy > 0 ? (totalLoad / totalLoadEnergy).toFixed(2) : '0';
        const rowCount = exportRows.length || 1;
        
        const avgSampleIn = (exportRows.reduce((acc: number, cur: ReportRow) => acc + cur.sampleInRate, 0) / rowCount).toFixed(1);
        const avgSampleOut = (exportRows.reduce((acc: number, cur: ReportRow) => acc + cur.sampleOutRate, 0) / rowCount).toFixed(1);
        const avgIron = (exportRows.reduce((acc: number, cur: ReportRow) => acc + cur.ironRemoveRate, 0) / rowCount).toFixed(1);
        const avgDust = (exportRows.reduce((acc: number, cur: ReportRow) => acc + cur.dustRemoveRate, 0) / rowCount).toFixed(1);

        csvContent += [
          '合计', '-', '-',
          totalUnload,
          totalLoad,
          totalUnit1,
          totalUnit2,
          totalUnloadEnergy,
          avgUnloadSingle,
          totalUnloadTime,
          totalUnloadIdle,
          totalUnloadTrips,
          totalLoadEnergy,
          avgLoadSingle,
          totalLoadTime,
          totalLoadIdle,
          totalLoadTrips,
          avgSampleIn,
          avgSampleOut,
          avgIron,
          avgDust
        ].join(',') + '\n';

        // 真实下载动作
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        message.success(`成功导出 ${filename}`);
        setIsExportModalOpen(false);
      } catch (err) {
        message.error('导出过程中发生错误');
      } finally {
        setIsExporting(false);
      }
    }, 1200);
  };

  // Ant Design 表格多级列定义（组末列加粗竖线，强化分区）
  const groupEnd = {
    onHeaderCell: () => ({ className: 'report-col-group-end' }),
    onCell: () => ({ className: 'report-col-group-end' })
  };

  /** 远程/全量排序：由 displayData 排序，非当前页内排序 */
  const colSort = (field: string) => ({
    sorter: true as const,
    sortOrder: (sortField === field ? sortOrder : null) as 'ascend' | 'descend' | null
  });

  const columns = [
    {
      title: '值班基本信息',
      fixed: 'left' as const,
      children: [
        {
          title: '班值',
          dataIndex: 'shiftValue',
          key: 'shiftValue',
          width: 100,
          align: 'center' as const,
          ...colSort('shiftValue'),
          render: (text: string) => (
            <span className="font-medium text-[#1677ff]">{text}</span>
          )
        },
        {
          title: '日期',
          dataIndex: 'date',
          key: 'date',
          width: 110,
          align: 'center' as const,
          ...colSort('date'),
          render: (text: string) => <span className="font-mono-num text-gray-700">{text}</span>
        },
        {
          title: '班次',
          dataIndex: 'shiftName',
          key: 'shiftName',
          width: 80,
          align: 'center' as const,
          ...groupEnd,
          ...colSort('shiftName'),
          render: (text: string) => (
            <Tag color={text === '白班' ? 'orange' : 'blue'} className="m-0">
              {text}
            </Tag>
          )
        }
      ]
    },
    {
      title: '接卸统计',
      children: [
        {
          title: '卸煤量 t',
          dataIndex: 'unloadWeight',
          key: 'unloadWeight',
          width: 110,
          align: 'right' as const,
          ...groupEnd,
          ...colSort('unloadWeight'),
          render: (val: number) => <span className="font-mono-num text-gray-800 font-medium">{val.toLocaleString()}</span>
        }
      ]
    },
    {
      title: '加仓统计',
      children: [
        {
          title: '总量 t',
          dataIndex: 'loadTotalWeight',
          key: 'loadTotalWeight',
          width: 100,
          align: 'right' as const,
          ...colSort('loadTotalWeight'),
          render: (val: number) => <span className="font-mono-num text-gray-800 font-medium">{val.toLocaleString()}</span>
        },
        {
          title: '机组1加仓量 t',
          dataIndex: 'loadUnit1Weight',
          key: 'loadUnit1Weight',
          width: 130,
          align: 'right' as const,
          ...colSort('loadUnit1Weight'),
          render: (val: number) => <span className="font-mono-num text-gray-600">{val.toLocaleString()}</span>
        },
        {
          title: '机组2加仓量 t',
          dataIndex: 'loadUnit2Weight',
          key: 'loadUnit2Weight',
          width: 130,
          align: 'right' as const,
          ...groupEnd,
          ...colSort('loadUnit2Weight'),
          render: (val: number) => <span className="font-mono-num text-gray-600">{val.toLocaleString()}</span>
        }
      ]
    },
    {
      title: '输煤系统 - 卸煤段',
      children: [
        {
          title: '电度 kWh',
          dataIndex: 'unloadEnergy',
          key: 'unloadEnergy',
          width: 100,
          align: 'right' as const,
          ...colSort('unloadEnergy'),
          render: (val: number) => <span className="font-mono-num text-gray-700">{val.toLocaleString()}</span>
        },
        {
          title: '输煤单耗 t/kWh',
          dataIndex: 'unloadUnitEnergy',
          key: 'unloadUnitEnergy',
          width: 140,
          align: 'right' as const,
          ...colSort('unloadUnitEnergy'),
          render: (val: number) => <span className="font-mono-num font-medium text-[#1677ff]">{val.toFixed(2)}</span>
        },
        {
          title: '运行时长 min',
          dataIndex: 'unloadRunTime',
          key: 'unloadRunTime',
          width: 110,
          align: 'right' as const,
          ...colSort('unloadRunTime'),
          render: (val: number) => <span className="font-mono-num text-gray-700">{val}</span>
        },
        {
          title: '空载时长 min',
          dataIndex: 'unloadIdleTime',
          key: 'unloadIdleTime',
          width: 110,
          align: 'right' as const,
          ...colSort('unloadIdleTime'),
          render: (val: number) => (
            <Tooltip title="设备处于运行，但带煤量小于10t">
              <span className={`font-mono-num ${val > 45 ? 'text-orange-500 font-medium' : 'text-gray-500'}`}>
                {val}
              </span>
            </Tooltip>
          )
        },
        {
          title: (
            <Tooltip title="点击次数可查看该班次时间范围内卸煤段跳机报警记录">
              <span>跳机次数</span>
            </Tooltip>
          ),
          dataIndex: 'unloadTrips',
          key: 'unloadTrips',
          width: 90,
          align: 'right' as const,
          ...groupEnd,
          ...colSort('unloadTrips'),
          render: (val: number, record: ReportRow) => (
            <button
              type="button"
              className="report-rate-link font-mono-num"
              onClick={() => openTripAlarmDetail(record, '卸煤段')}
              title="查看卸煤段跳机报警记录"
            >
              {val > 0
                ? <Badge count={val} style={{ backgroundColor: '#ff4d4f' }} />
                : <span className="text-gray-400">0</span>}
            </button>
          )
        }
      ]
    },
    {
      title: '输煤系统 - 上煤段',
      children: [
        {
          title: '电度 kWh',
          dataIndex: 'loadEnergy',
          key: 'loadEnergy',
          width: 100,
          align: 'right' as const,
          ...colSort('loadEnergy'),
          render: (val: number) => <span className="font-mono-num text-gray-700">{val.toLocaleString()}</span>
        },
        {
          title: '输煤单耗 t/kWh',
          dataIndex: 'loadUnitEnergy',
          key: 'loadUnitEnergy',
          width: 140,
          align: 'right' as const,
          ...colSort('loadUnitEnergy'),
          render: (val: number) => <span className="font-mono-num font-medium text-[#1677ff]">{val.toFixed(2)}</span>
        },
        {
          title: '运行时长 min',
          dataIndex: 'loadRunTime',
          key: 'loadRunTime',
          width: 110,
          align: 'right' as const,
          ...colSort('loadRunTime'),
          render: (val: number) => <span className="font-mono-num text-gray-700">{val}</span>
        },
        {
          title: '空载时长 min',
          dataIndex: 'loadIdleTime',
          key: 'loadIdleTime',
          width: 110,
          align: 'right' as const,
          ...colSort('loadIdleTime'),
          render: (val: number) => (
            <Tooltip title="设备处于运行，但带煤量小于10t">
              <span className={`font-mono-num ${val > 25 ? 'text-orange-500 font-medium' : 'text-gray-500'}`}>
                {val}
              </span>
            </Tooltip>
          )
        },
        {
          title: (
            <Tooltip title="点击次数可查看该班次时间范围内上煤段跳机报警记录">
              <span>跳机次数</span>
            </Tooltip>
          ),
          dataIndex: 'loadTrips',
          key: 'loadTrips',
          width: 90,
          align: 'right' as const,
          ...groupEnd,
          ...colSort('loadTrips'),
          render: (val: number, record: ReportRow) => (
            <button
              type="button"
              className="report-rate-link font-mono-num"
              onClick={() => openTripAlarmDetail(record, '上煤段')}
              title="查看上煤段跳机报警记录"
            >
              {val > 0
                ? <Badge count={val} style={{ backgroundColor: '#ff4d4f' }} />
                : <span className="text-gray-400">0</span>}
            </button>
          )
        }
      ]
    },
    {
      title: (
        <span className="inline-flex items-center gap-1">
          设备综合投运率
          <Tooltip title="点击投运率数值，可查看该类型下各具体设备的投运明细">
            <QuestionCircleOutlined className="text-gray-400 text-xs cursor-help" />
          </Tooltip>
        </span>
      ),
      children: [
        {
          title: '入厂采样 %',
          dataIndex: 'sampleInRate',
          key: 'sampleInRate',
          width: 110,
          align: 'right' as const,
          ...colSort('sampleInRate'),
          render: (val: number, record: ReportRow) => (
            <button
              type="button"
              className={`report-rate-link font-mono-num font-medium ${val >= 95 ? 'text-green-600' : 'text-orange-500'}`}
              onClick={() => openDeviceTypeDetail(record, 'In_Belt_Sample')}
              title="查看入厂采样设备明细"
            >
              {val}%
            </button>
          )
        },
        {
          title: '入炉采样 %',
          dataIndex: 'sampleOutRate',
          key: 'sampleOutRate',
          width: 110,
          align: 'right' as const,
          ...colSort('sampleOutRate'),
          render: (val: number, record: ReportRow) => (
            <button
              type="button"
              className={`report-rate-link font-mono-num font-medium ${val >= 95 ? 'text-green-600' : 'text-orange-500'}`}
              onClick={() => openDeviceTypeDetail(record, 'Load_Belt_sample')}
              title="查看入炉采样设备明细"
            >
              {val}%
            </button>
          )
        },
        {
          title: '除铁装置 %',
          dataIndex: 'ironRemoveRate',
          key: 'ironRemoveRate',
          width: 110,
          align: 'right' as const,
          ...colSort('ironRemoveRate'),
          render: (val: number, record: ReportRow) => (
            <button
              type="button"
              className={`report-rate-link font-mono-num font-medium ${val >= 98 ? 'text-green-600' : 'text-orange-500'}`}
              onClick={() => openDeviceTypeDetail(record, 'Iron_Remove')}
              title="查看除铁装置设备明细"
            >
              {val}%
            </button>
          )
        },
        {
          title: '除尘装置 %',
          dataIndex: 'dustRemoveRate',
          key: 'dustRemoveRate',
          width: 110,
          align: 'right' as const,
          ...groupEnd,
          ...colSort('dustRemoveRate'),
          render: (val: number, record: ReportRow) => (
            <button
              type="button"
              className={`report-rate-link font-mono-num font-medium ${val >= 95 ? 'text-green-600' : 'text-orange-500'}`}
              onClick={() => openDeviceTypeDetail(record, 'Dust_Remove')}
              title="查看除尘装置设备明细"
            >
              {val}%
            </button>
          )
        }
      ]
    }
  ];

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6,
          fontFamily: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif`
        }
      }}
    >
      <div className="report-theme-root p-6 overflow-y-auto">
        {/* 页头 */}
        <div className="mb-4">
          <h1 className="text-xl font-semibold text-gray-900 m-0">燃运值班报表</h1>
          <p className="text-sm text-gray-500 mt-1 mb-0">
            按班值统计接卸量、加仓量、输煤系统运行指标及采样/除铁/除尘设备投运率，支持筛选查询与导出
            {bootstrap.fromCompetition && (
              <span className="text-blue-600">
                {' '}
                · 已按竞赛页跳转条件自动筛选（班值：{selectedShiftValue}，
                {dateRange[0].format('YYYY-MM-DD')} ~ {dateRange[1].format('YYYY-MM-DD')}）
              </span>
            )}
          </p>
        </div>

        {/* 筛选区 */}
        <div className="report-card p-4 mb-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="flex items-center gap-2">
              <span className="text-gray-600 text-sm whitespace-nowrap">班值名称</span>
              <Select
                value={selectedShiftValue}
                onChange={setSelectedShiftValue}
                style={{ width: 130 }}
                options={[
                  { value: '全部', label: '全部班值' },
                  ...SHIFT_VALUES.map((v: string) => ({ value: v, label: v }))
                ]}
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-gray-600 text-sm whitespace-nowrap">日期</span>
              <DatePicker.RangePicker
                value={dateRange}
                onChange={(dates) => {
                  if (dates && dates[0] && dates[1]) {
                    const diff = dates[1].diff(dates[0], 'day');
                    if (diff > 180) {
                      message.warning('查询跨度最大限制为 180 天，请重新选择');
                      return;
                    }
                    setDateRange([dates[0], dates[1]]);
                  }
                }}
                style={{ width: 260 }}
                allowClear={false}
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-gray-600 text-sm whitespace-nowrap">班次</span>
              <Select
                value={selectedShiftName}
                onChange={setSelectedShiftName}
                style={{ width: 110 }}
                options={[
                  { value: '全部', label: '全部班次' },
                  ...SHIFT_NAMES.map((n: string) => ({ value: n, label: n }))
                ]}
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={() => {
                  message.info(`已按当前筛选加载 ${filteredData.length} 条班值记录`);
                }}
              >
                查询
              </Button>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>
                重置
              </Button>
              <Button
                icon={<DownloadOutlined />}
                onClick={() => setIsExportModalOpen(true)}
                disabled={filteredData.length === 0}
              >
                导出
              </Button>
            </div>
          </div>
        </div>

        {/* 报表表格 */}
        <div className="report-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="text-base font-medium text-gray-900">
              班值明细汇总
              <span className="ml-2 text-sm font-normal text-gray-400">
                共 {filteredData.length} 条；点击二级表头可对筛选结果全量排序；点击投运率/跳机次数可查看明细
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>白班 08:00–20:00</span>
              <span>夜班 20:00–08:00</span>
            </div>
          </div>

          <Table
            columns={columns}
            dataSource={displayData}
            className="report-table"
            size="middle"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50'],
              showTotal: (total: number) => `共 ${total} 条`
            }}
            scroll={{ x: 1900 }}
            onChange={(_pagination, _filters, sorter) => {
              const s = Array.isArray(sorter) ? sorter[0] : sorter;
              if (s && s.order) {
                setSortField((s.field as string) || (s.columnKey as string) || null);
                setSortOrder(s.order);
              } else {
                setSortField(null);
                setSortOrder(null);
              }
            }}
          />
        </div>

        {/* 按设备类型下钻：具体设备投运率明细 */}
        <Drawer
          title={
            <div className="flex flex-wrap items-center gap-2">
              <SafetyCertificateOutlined className="text-[#1677ff]" />
              <span>
                {selectedDeviceType ? `${DEVICE_TYPE_LABEL[selectedDeviceType]}设备投运率明细` : '设备投运率明细'}
              </span>
              {selectedRecord && (
                <Tag className="m-0 font-mono-num">
                  {selectedRecord.date} · {selectedRecord.shiftValue} · {selectedRecord.shiftName}
                </Tag>
              )}
            </div>
          }
          placement="right"
          width={720}
          onClose={closeDeviceDrawer}
          open={isDrawerOpen}
        >
          {selectedRecord && selectedDeviceType && (
            <div>
              <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 mb-4 flex flex-wrap gap-6">
                <div>
                  <div className="text-xs text-gray-500">设备类型</div>
                  <div className="mt-1">
                    <Tag color={
                      selectedDeviceType === 'In_Belt_Sample' ? 'blue'
                        : selectedDeviceType === 'Load_Belt_sample' ? 'cyan'
                          : selectedDeviceType === 'Iron_Remove' ? 'orange' : 'green'
                    }>
                      {DEVICE_TYPE_LABEL[selectedDeviceType]}
                    </Tag>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">类型综合投运率</div>
                  <div className="text-xl font-semibold font-mono-num text-[#1677ff] mt-0.5">{typeAvgRate}%</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">具体设备数</div>
                  <div className="text-xl font-semibold font-mono-num text-gray-800 mt-0.5">{typeDeviceList.length}</div>
                </div>
              </div>

              <div className="text-sm font-medium text-gray-800 mb-3 flex items-center gap-1.5">
                <SettingOutlined className="text-[#1677ff]" />
                {DEVICE_TYPE_LABEL[selectedDeviceType]} · 具体设备投运明细
              </div>

              <Table
                dataSource={typeDeviceList}
                rowKey="id"
                pagination={false}
                className="report-table"
                size="small"
                columns={[
                  {
                    title: '设备名称',
                    dataIndex: 'name',
                    key: 'name',
                    render: (text: string, item: DeviceDetail) => (
                      <div>
                        <div className="font-medium text-gray-800">{text}</div>
                        <div className="text-xs text-gray-400 font-mono-num">{item.code}</div>
                      </div>
                    )
                  },
                  {
                    title: '运行 min',
                    dataIndex: 'runTime',
                    key: 'runTime',
                    width: 110,
                    align: 'right' as const,
                    render: (val: number) => <span className="font-mono-num text-gray-700">{val}</span>
                  },
                  {
                    title: '故障 min',
                    dataIndex: 'faultTime',
                    key: 'faultTime',
                    width: 110,
                    align: 'right' as const,
                    render: (val: number) => (
                      <span className={`font-mono-num ${val > 0 ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                        {val}
                      </span>
                    )
                  },
                  {
                    title: '投用率',
                    dataIndex: 'useRate',
                    key: 'useRate',
                    width: 110,
                    align: 'right' as const,
                    render: (val: number) => (
                      <span className={`font-mono-num font-medium ${val >= 98 ? 'text-green-600' : val >= 90 ? 'text-orange-500' : 'text-red-500'}`}>
                        {val}%
                      </span>
                    )
                  }
                ]}
              />

              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mt-4">
                <div className="text-xs font-medium text-[#1677ff] flex items-center gap-1 mb-1">
                  <InfoCircleOutlined />
                  说明
                </div>
                <p className="text-xs text-gray-600 m-0 leading-relaxed">
                  应投用时长固定为班次时长 8 小时（{SHIFT_SHOULD_MINUTES} min）。投用率 =（应投用时长 − 故障时长）÷ 应投用时长。主表类型综合投运率为该类型下各具体设备投用率的均值。
                </p>
              </div>
            </div>
          )}
        </Drawer>

        {/* 跳机报警记录下钻 */}
        <Drawer
          title={
            <div className="flex flex-wrap items-center gap-2">
              <AlertOutlined className="text-red-500" />
              <span>
                {selectedTripSection ? `${selectedTripSection}跳机报警记录` : '跳机报警记录'}
              </span>
              {selectedRecord && (
                <Tag className="m-0 font-mono-num">
                  {selectedRecord.date} · {selectedRecord.shiftValue} · {selectedRecord.shiftName}
                </Tag>
              )}
            </div>
          }
          placement="right"
          width={780}
          onClose={closeTripDrawer}
          open={isTripDrawerOpen}
        >
          {selectedRecord && selectedTripSection && (
            <div>
              <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 mb-4 space-y-2 text-sm">
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  <div>
                    <span className="text-gray-500">输煤段别：</span>
                    <Tag color={selectedTripSection === '卸煤段' ? 'orange' : 'blue'} className="m-0 ml-1">
                      {selectedTripSection}
                    </Tag>
                  </div>
                  <div>
                    <span className="text-gray-500">跳机次数：</span>
                    <span className="font-mono-num font-semibold text-red-500 ml-1">
                      {selectedTripSection === '卸煤段' ? selectedRecord.unloadTrips : selectedRecord.loadTrips}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-gray-500">班次时间范围：</span>
                  <span className="font-mono-num text-gray-800 ml-1">{tripShiftRangeLabel}</span>
                </div>
              </div>

              <div className="text-sm font-medium text-gray-800 mb-3">
                电流跳机报警明细
              </div>

              {tripAlarmList.length === 0 ? (
                <Empty description="该班次时间范围内暂无跳机报警记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <Table
                  dataSource={tripAlarmList}
                  rowKey="id"
                  pagination={false}
                  className="report-table"
                  size="small"
                  columns={[
                    {
                      title: '序号',
                      key: 'index',
                      width: 70,
                      align: 'center' as const,
                      render: (_: unknown, __: TripAlarmRecord, index: number) => (
                        <span className="font-mono-num text-gray-600">{index + 1}</span>
                      )
                    },
                    {
                      title: '测点名称',
                      dataIndex: 'deviceName',
                      key: 'deviceName',
                      render: (text: string) => (
                        <span className="font-medium text-gray-800">{text}</span>
                      )
                    },
                    {
                      title: '报警时间',
                      dataIndex: 'alarmTime',
                      key: 'alarmTime',
                      width: 180,
                      render: (val: string) => <span className="font-mono-num text-gray-700">{val}</span>
                    },
                    {
                      title: '恢复时间',
                      dataIndex: 'recoverTime',
                      key: 'recoverTime',
                      width: 180,
                      render: (val: string) => (
                        <span className={`font-mono-num ${val === '-' ? 'text-orange-500' : 'text-gray-600'}`}>
                          {val}
                        </span>
                      )
                    }
                  ]}
                />
              )}

              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mt-4">
                <div className="text-xs font-medium text-[#1677ff] flex items-center gap-1 mb-1">
                  <InfoCircleOutlined />
                  说明
                </div>
                <p className="text-xs text-gray-600 m-0 leading-relaxed">
                  记录取自 CTDCS-1 程控系统在该班次起止时间内的电流/过流跳机保护报警。主表跳机次数为该时间范围内对应输煤段报警条数合计。
                </p>
              </div>
            </div>
          )}
        </Drawer>

        {/* 导出二次确认 */}
        <Modal
          title={
            <div className="flex items-center gap-2">
              <FileExcelOutlined className="text-green-600" />
              <span>导出确认</span>
            </div>
          }
          open={isExportModalOpen}
          onCancel={() => setIsExportModalOpen(false)}
          footer={[
            <Button key="back" onClick={() => setIsExportModalOpen(false)}>
              取消
            </Button>,
            <Button
              key="submit"
              type="primary"
              icon={<DownloadOutlined />}
              loading={isExporting}
              onClick={handleExportCSV}
            >
              确认导出
            </Button>
          ]}
        >
          <div className="text-sm space-y-3 py-2">
            <p className="text-gray-600 m-0">将按当前筛选条件导出燃运班值报表到本地。</p>
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-xs space-y-2 font-mono-num">
              <div className="flex justify-between">
                <span className="text-gray-500">日期范围</span>
                <span className="text-gray-800">
                  {dateRange[0].format('YYYY-MM-DD')} 至 {dateRange[1].format('YYYY-MM-DD')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">班值</span>
                <span className="text-gray-800">{selectedShiftValue}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">班次</span>
                <span className="text-gray-800">{selectedShiftName}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2">
                <span className="text-gray-500">导出条数</span>
                <span className="text-[#1677ff] font-semibold">{filteredData.length} 行</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 m-0 flex items-center gap-1">
              <InfoCircleOutlined />
              文件名格式：YYYYMMDD至YYYYMMDD燃运班值报表.csv
            </p>
          </div>
        </Modal>
      </div>
    </ConfigProvider>
  );
};

export default Component;
