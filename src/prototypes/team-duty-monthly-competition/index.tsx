/**
 * @name 班值月度竞赛统计
 * @mode axure
 *
 * 参考资料：
 * - /rules/development-standards.md
 * - /skills/axure-export-workflow/SKILL.md
 * - /rules/design-guide.md
 * - /assets/templates/spec-template.md
 * - 需求 4.6.5 AD6.3 班值月度竞赛统计（燃运小指标竞赛）
 *
 * 说明：独立新页面，不改动既有「燃运班值小指标竞赛统计」原型。
 */
import React, { useMemo, useState } from 'react';
import {
  Button,
  Col,
  ConfigProvider,
  DatePicker,
  Form,
  InputNumber,
  Modal,
  Row,
  Table,
  Tag,
  Tooltip,
  message,
} from 'antd';
import {
  CalendarOutlined,
  CompassOutlined,
  CrownFilled,
  CrownOutlined,
  DownloadOutlined,
  InfoCircleOutlined,
  LineChartOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
  TrophyFilled,
  TrophyOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import zhCN from 'antd/locale/zh_CN';
import dayjs, { type Dayjs } from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import './style.css';

const DEFAULT_UPDATER = '燃运专工-刘焱';

type IndicatorKey =
  | 'unloadCoalTotal'
  | 'loadCoalTotal'
  | 'unloadCoalEfficiency'
  | 'loadCoalEfficiency'
  | 'deviceOperationRate'
  | 'unloadCoalRate'
  | 'uploadCoalConsumptionRate'
  | 'unloadNoLoadRate'
  | 'uploadNoLoadRate';

interface IndicatorDef {
  key: IndicatorKey;
  code: string;
  name: string;
  unit: string;
  positive: boolean;
  weightField: string;
  scoreField: string;
}

const INDICATORS: IndicatorDef[] = [
  { key: 'unloadCoalTotal', code: 'unload_coal_total', name: '卸煤量', unit: 't/班', positive: true, weightField: 'unloadCoalTotalWeight', scoreField: 'unloadCoalTotalScore' },
  { key: 'loadCoalTotal', code: 'load_coal_total', name: '加仓量', unit: 't/班', positive: true, weightField: 'loadCoalTotalWeight', scoreField: 'loadCoalTotalScore' },
  { key: 'unloadCoalEfficiency', code: 'unload_coal_efficiency', name: '卸煤效率', unit: 't/h', positive: true, weightField: 'unloadCoalEfficiencyWeight', scoreField: 'unloadCoalEfficiencyScore' },
  { key: 'loadCoalEfficiency', code: 'load_coal_efficiency', name: '上煤效率', unit: 't/h', positive: true, weightField: 'loadCoalEfficiencyWeight', scoreField: 'loadCoalEfficiencyScore' },
  { key: 'deviceOperationRate', code: 'device_operation_rate', name: '设备综合投用率', unit: '%', positive: true, weightField: 'deviceOperationRateWeight', scoreField: 'deviceOperationRateScore' },
  { key: 'unloadCoalRate', code: 'unload_coal_rate', name: '卸煤段输煤单耗', unit: 't/kWh', positive: true, weightField: 'unloadCoalRateWeight', scoreField: 'unloadCoalRateScore' },
  { key: 'uploadCoalConsumptionRate', code: 'upload_coal_consumption_rate', name: '上煤段输煤单耗', unit: 't/kWh', positive: true, weightField: 'uploadCoalConsumptionRateWeight', scoreField: 'uploadCoalConsumptionRateScore' },
  { key: 'unloadNoLoadRate', code: 'unload_no_load_rate', name: '卸煤段空载率', unit: '%', positive: false, weightField: 'unloadNoLoadRateWeight', scoreField: 'unloadNoLoadRateScore' },
  { key: 'uploadNoLoadRate', code: 'upload_no_load_rate', name: '上煤段空载率', unit: '%', positive: false, weightField: 'uploadNoLoadRateWeight', scoreField: 'uploadNoLoadRateScore' },
];

/** 雷达图短标签（9 轴可读） */
const RADAR_SHORT_LABEL: Record<IndicatorKey, string> = {
  unloadCoalTotal: '卸煤量',
  loadCoalTotal: '加仓量',
  unloadCoalEfficiency: '卸煤效率',
  loadCoalEfficiency: '上煤效率',
  deviceOperationRate: '投用率',
  unloadCoalRate: '卸煤单耗',
  uploadCoalConsumptionRate: '上煤单耗',
  unloadNoLoadRate: '卸煤空载',
  uploadNoLoadRate: '上煤空载',
};

const SHIFT_COLORS: Record<string, string> = {
  发电一值: '#1677ff',
  发电二值: '#52c41a',
  发电三值: '#fa8c16',
  发电四值: '#722ed1',
};

/** 权重字典（整数 %），默认合计 100 */
type WeightPercentMap = Record<IndicatorKey, number>;

const DEFAULT_WEIGHT_PERCENT: WeightPercentMap = {
  unloadCoalTotal: 12,
  loadCoalTotal: 12,
  unloadCoalEfficiency: 12,
  loadCoalEfficiency: 12,
  deviceOperationRate: 12,
  unloadCoalRate: 10,
  uploadCoalConsumptionRate: 10,
  unloadNoLoadRate: 10,
  uploadNoLoadRate: 10,
};

interface TeamRawMetrics {
  teamDutyCode: string;
  teamDutyName: string;
  dutyShiftCount: number;
  unloadCoalTotal: number;
  loadCoalTotal: number;
  unloadCoalEfficiency: number;
  loadCoalEfficiency: number;
  deviceOperationRate: number;
  unloadCoalRate: number;
  uploadCoalConsumptionRate: number;
  unloadNoLoadRate: number;
  uploadNoLoadRate: number;
}

interface CompetitionRow extends TeamRawMetrics {
  id: string;
  reportDate: string;
  ranking: number;
  totalScore: number;
  unloadCoalTotalScore: number;
  loadCoalTotalScore: number;
  unloadCoalEfficiencyScore: number;
  loadCoalEfficiencyScore: number;
  deviceOperationRateScore: number;
  unloadCoalRateScore: number;
  uploadCoalConsumptionRateScore: number;
  unloadNoLoadRateScore: number;
  uploadNoLoadRateScore: number;
  unloadCoalTotalWeight: number;
  loadCoalTotalWeight: number;
  unloadCoalEfficiencyWeight: number;
  loadCoalEfficiencyWeight: number;
  deviceOperationRateWeight: number;
  unloadCoalRateWeight: number;
  uploadCoalConsumptionRateWeight: number;
  unloadNoLoadRateWeight: number;
  uploadNoLoadRateWeight: number;
  updatePerson: string;
  updateTime: string;
  frozen: boolean;
}

/** 基于燃运班值报表口径的月度示例指标（当前月可重算） */
const RAW_BY_MONTH: Record<string, TeamRawMetrics[]> = {
  '2026-07': [
    {
      teamDutyCode: 'DUTY01',
      teamDutyName: '发电一值',
      dutyShiftCount: 15,
      unloadCoalTotal: 32450,
      loadCoalTotal: 22180,
      unloadCoalEfficiency: 839.2,
      loadCoalEfficiency: 630.5,
      deviceOperationRate: 97.9,
      unloadCoalRate: 2.40,
      uploadCoalConsumptionRate: 2.00,
      unloadNoLoadRate: 9.05,
      uploadNoLoadRate: 8.53,
    },
    {
      teamDutyCode: 'DUTY02',
      teamDutyName: '发电二值',
      dutyShiftCount: 16,
      unloadCoalTotal: 36800,
      loadCoalTotal: 24500,
      unloadCoalEfficiency: 890.3,
      loadCoalEfficiency: 653.3,
      deviceOperationRate: 95.8,
      unloadCoalRate: 2.20,
      uploadCoalConsumptionRate: 1.90,
      unloadNoLoadRate: 15.32,
      uploadNoLoadRate: 10.67,
    },
    {
      teamDutyCode: 'DUTY03',
      teamDutyName: '发电三值',
      dutyShiftCount: 15,
      unloadCoalTotal: 29800,
      loadCoalTotal: 19800,
      unloadCoalEfficiency: 831.6,
      loadCoalEfficiency: 628.6,
      deviceOperationRate: 99.0,
      unloadCoalRate: 2.60,
      uploadCoalConsumptionRate: 2.10,
      unloadNoLoadRate: 5.58,
      uploadNoLoadRate: 5.82,
    },
    {
      teamDutyCode: 'DUTY04',
      teamDutyName: '发电四值',
      dutyShiftCount: 14,
      unloadCoalTotal: 34100,
      loadCoalTotal: 23100,
      unloadCoalEfficiency: 805.5,
      loadCoalEfficiency: 635.8,
      deviceOperationRate: 94.8,
      unloadCoalRate: 2.20,
      uploadCoalConsumptionRate: 1.90,
      unloadNoLoadRate: 17.72,
      uploadNoLoadRate: 14.22,
    },
  ],
  '2026-06': [
    {
      teamDutyCode: 'DUTY01',
      teamDutyName: '发电一值',
      dutyShiftCount: 15,
      unloadCoalTotal: 30120,
      loadCoalTotal: 21050,
      unloadCoalEfficiency: 812.0,
      loadCoalEfficiency: 610.2,
      deviceOperationRate: 96.5,
      unloadCoalRate: 2.35,
      uploadCoalConsumptionRate: 1.98,
      unloadNoLoadRate: 10.20,
      uploadNoLoadRate: 9.10,
    },
    {
      teamDutyCode: 'DUTY02',
      teamDutyName: '发电二值',
      dutyShiftCount: 15,
      unloadCoalTotal: 35200,
      loadCoalTotal: 23800,
      unloadCoalEfficiency: 870.0,
      loadCoalEfficiency: 640.0,
      deviceOperationRate: 95.0,
      unloadCoalRate: 2.28,
      uploadCoalConsumptionRate: 1.92,
      unloadNoLoadRate: 14.50,
      uploadNoLoadRate: 11.20,
    },
    {
      teamDutyCode: 'DUTY03',
      teamDutyName: '发电三值',
      dutyShiftCount: 16,
      unloadCoalTotal: 28900,
      loadCoalTotal: 19200,
      unloadCoalEfficiency: 820.0,
      loadCoalEfficiency: 615.0,
      deviceOperationRate: 98.2,
      unloadCoalRate: 2.55,
      uploadCoalConsumptionRate: 2.05,
      unloadNoLoadRate: 6.40,
      uploadNoLoadRate: 6.10,
    },
    {
      teamDutyCode: 'DUTY04',
      teamDutyName: '发电四值',
      dutyShiftCount: 14,
      unloadCoalTotal: 33000,
      loadCoalTotal: 22500,
      unloadCoalEfficiency: 790.0,
      loadCoalEfficiency: 620.0,
      deviceOperationRate: 93.5,
      unloadCoalRate: 2.25,
      uploadCoalConsumptionRate: 1.95,
      unloadNoLoadRate: 16.80,
      uploadNoLoadRate: 13.50,
    },
  ],
};

const CURRENT_MONTH = '2026-07';

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function percentToDecimal(p: number) {
  return round2(p / 100);
}

function scoreOne(value: number, min: number, max: number, positive: boolean) {
  if (max === min) return 100;
  const raw = positive ? ((value - min) / (max - min)) * 100 : ((max - value) / (max - min)) * 100;
  return round2(raw);
}

function buildCompetitionRows(
  reportDate: string,
  rawList: TeamRawMetrics[],
  weightPercent: WeightPercentMap,
  updatePerson: string,
  frozen: boolean,
): CompetitionRow[] {
  const weightDecimal = Object.fromEntries(
    INDICATORS.map((ind) => [ind.key, percentToDecimal(weightPercent[ind.key])]),
  ) as Record<IndicatorKey, number>;

  const mins: Partial<Record<IndicatorKey, number>> = {};
  const maxs: Partial<Record<IndicatorKey, number>> = {};
  INDICATORS.forEach((ind) => {
    const vals = rawList.map((r) => r[ind.key]);
    mins[ind.key] = Math.min(...vals);
    maxs[ind.key] = Math.max(...vals);
  });

  const scored = rawList.map((raw) => {
    const scores: Partial<Record<IndicatorKey, number>> = {};
    let total = 0;
    INDICATORS.forEach((ind) => {
      const s = scoreOne(raw[ind.key], mins[ind.key]!, maxs[ind.key]!, ind.positive);
      scores[ind.key] = s;
      total += s * weightDecimal[ind.key];
    });

    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    return {
      ...raw,
      id: `${reportDate}-${raw.teamDutyCode}`,
      reportDate,
      ranking: 0,
      totalScore: round2(total),
      unloadCoalTotalScore: scores.unloadCoalTotal!,
      loadCoalTotalScore: scores.loadCoalTotal!,
      unloadCoalEfficiencyScore: scores.unloadCoalEfficiency!,
      loadCoalEfficiencyScore: scores.loadCoalEfficiency!,
      deviceOperationRateScore: scores.deviceOperationRate!,
      unloadCoalRateScore: scores.unloadCoalRate!,
      uploadCoalConsumptionRateScore: scores.uploadCoalConsumptionRate!,
      unloadNoLoadRateScore: scores.unloadNoLoadRate!,
      uploadNoLoadRateScore: scores.uploadNoLoadRate!,
      unloadCoalTotalWeight: weightDecimal.unloadCoalTotal,
      loadCoalTotalWeight: weightDecimal.loadCoalTotal,
      unloadCoalEfficiencyWeight: weightDecimal.unloadCoalEfficiency,
      loadCoalEfficiencyWeight: weightDecimal.loadCoalEfficiency,
      deviceOperationRateWeight: weightDecimal.deviceOperationRate,
      unloadCoalRateWeight: weightDecimal.unloadCoalRate,
      uploadCoalConsumptionRateWeight: weightDecimal.uploadCoalConsumptionRate,
      unloadNoLoadRateWeight: weightDecimal.unloadNoLoadRate,
      uploadNoLoadRateWeight: weightDecimal.uploadNoLoadRate,
      updatePerson,
      updateTime: now,
      frozen,
    } satisfies CompetitionRow;
  });

  scored.sort((a, b) => b.totalScore - a.totalScore);
  scored.forEach((row, i) => {
    row.ranking = i + 1;
  });
  return scored;
}

const RANK_META: Record<number, { label: string; className: string; icon: React.ReactNode }> = {
  1: {
    label: '第一名',
    className: 'tdmc-rank-badge is-gold',
    icon: <CrownFilled />,
  },
  2: {
    label: '第二名',
    className: 'tdmc-rank-badge is-silver',
    icon: <TrophyFilled />,
  },
  3: {
    label: '第三名',
    className: 'tdmc-rank-badge is-bronze',
    icon: <TrophyFilled />,
  },
};

function RankBadge({ rank }: { rank: number }) {
  const meta = RANK_META[rank];
  if (!meta) {
    return <span className="tdmc-num tdmc-rank-plain">第{rank}名</span>;
  }
  return (
    <span className={meta.className} title={meta.label}>
      <span className="tdmc-rank-icon">{meta.icon}</span>
      <span className="tdmc-rank-label">{meta.label}</span>
    </span>
  );
}

function getScore(row: CompetitionRow, ind: IndicatorDef) {
  return (row as unknown as Record<string, number>)[ind.scoreField];
}

function InteractiveRadar({
  rows,
  hoveredShift,
  onHover,
}: {
  rows: CompetitionRow[];
  hoveredShift: string | null;
  onHover: (name: string | null) => void;
}) {
  const width = 420;
  const height = 360;
  const centerX = width / 2;
  const centerY = height / 2;
  const rMax = 118;
  const levels = 4;
  const angleStep = (Math.PI * 2) / INDICATORS.length;

  const getVertexCoords = (index: number, radius: number) => {
    const angle = angleStep * index - Math.PI / 2;
    return {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
    };
  };

  return (
    <div className="radar-chart-container" style={{ width, height }}>
      <svg width={width} height={height}>
        {Array.from({ length: levels }).map((_, i) => {
          const radius = (rMax / levels) * (i + 1);
          return (
            <circle
              key={`grid-${i}`}
              cx={centerX}
              cy={centerY}
              r={radius}
              className={i === levels - 1 ? 'radar-grid-line-bold' : 'radar-grid-line'}
            />
          );
        })}

        {INDICATORS.map((ind, idx) => {
          const outerCoord = getVertexCoords(idx, rMax);
          const labelCoord = getVertexCoords(idx, rMax + 22);
          let textAnchor: 'middle' | 'start' | 'end' = 'middle';
          let dy = '0.35em';
          if (labelCoord.x < centerX - 10) textAnchor = 'end';
          else if (labelCoord.x > centerX + 10) textAnchor = 'start';
          if (labelCoord.y < centerY - rMax + 5) dy = '-0.2em';
          else if (labelCoord.y > centerY + rMax - 5) dy = '1em';

          return (
            <g key={`axis-${ind.key}`}>
              <line x1={centerX} y1={centerY} x2={outerCoord.x} y2={outerCoord.y} className="radar-axis" />
              <text x={labelCoord.x} y={labelCoord.y} textAnchor={textAnchor} dy={dy} className="radar-label">
                {RADAR_SHORT_LABEL[ind.key]}
              </text>
            </g>
          );
        })}

        {rows.map((row) => {
          const color = SHIFT_COLORS[row.teamDutyName] || '#1677ff';
          const isHovered = hoveredShift === row.teamDutyName;
          const isAnyHovered = hoveredShift !== null;
          const pointsStr = INDICATORS.map((ind, idx) => {
            const score = getScore(row, ind);
            const radius = rMax * Math.max(0.08, score / 100);
            const coord = getVertexCoords(idx, radius);
            return `${coord.x},${coord.y}`;
          }).join(' ');

          return (
            <g key={`poly-${row.teamDutyCode}`}>
              <polygon
                points={pointsStr}
                stroke={color}
                fill={color}
                className={`radar-polygon ${isHovered ? 'highlighted' : isAnyHovered ? 'dimmed' : ''}`}
                onMouseEnter={() => onHover(row.teamDutyName)}
                onMouseLeave={() => onHover(null)}
              />
              {INDICATORS.map((ind, idx) => {
                const score = getScore(row, ind);
                const radius = rMax * Math.max(0.08, score / 100);
                const coord = getVertexCoords(idx, radius);
                return (
                  <circle
                    key={`point-${row.teamDutyCode}-${ind.key}`}
                    cx={coord.x}
                    cy={coord.y}
                    r={isHovered ? 4.5 : isAnyHovered ? 1 : 3}
                    fill={color}
                    stroke="#ffffff"
                    strokeWidth={1}
                    className="radar-point"
                    style={{ opacity: isHovered ? 1 : isAnyHovered ? 0.2 : 0.8 }}
                  >
                    <title>
                      {`${row.teamDutyName} · ${ind.name}: ${row[ind.key]}${ind.unit}（${score.toFixed(2)}分）`}
                    </title>
                  </circle>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function exportCsv(rows: CompetitionRow[], month: string) {
  const headers = [
    '排名',
    '班值名称',
    '班值编码',
    '当值排班次数',
    '综合得分',
    ...INDICATORS.flatMap((ind) => [`${ind.name}(${ind.unit})`, `${ind.name}得分`, `${ind.name}权重`]),
    '更新人',
    '更新时间',
  ];

  const lines = rows.map((r) => {
    const cells = [
      r.ranking,
      r.teamDutyName,
      r.teamDutyCode,
      r.dutyShiftCount,
      r.totalScore.toFixed(2),
      ...INDICATORS.flatMap((ind) => {
        const val = r[ind.key];
        const score = (r as any)[ind.scoreField] as number;
        const weight = (r as any)[ind.weightField] as number;
        return [val, score.toFixed(2), weight.toFixed(2)];
      }),
      r.updatePerson,
      r.updateTime,
    ];
    return cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',');
  });

  const bom = '\uFEFF';
  const csv = bom + [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `班值月度竞赛统计_${month.replace('-', '')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const Component: React.FC = () => {
  const [queryMonth, setQueryMonth] = useState<Dayjs>(dayjs(CURRENT_MONTH));
  const [appliedMonth, setAppliedMonth] = useState(CURRENT_MONTH);
  const [weightPercent, setWeightPercent] = useState<WeightPercentMap>({ ...DEFAULT_WEIGHT_PERCENT });
  const [weightUpdater, setWeightUpdater] = useState(DEFAULT_UPDATER);
  const [weightUpdatedAt, setWeightUpdatedAt] = useState(dayjs().format('YYYY-MM-DD HH:mm:ss'));
  const [weightOpen, setWeightOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [hoveredShift, setHoveredShift] = useState<string | null>(null);
  const [form] = Form.useForm();

  /** 历史月固化快照（权重变更不重算） */
  const frozenReports = useMemo(() => {
    const map: Record<string, CompetitionRow[]> = {};
    Object.keys(RAW_BY_MONTH).forEach((m) => {
      if (m === CURRENT_MONTH) return;
      map[m] = buildCompetitionRows(m, RAW_BY_MONTH[m], DEFAULT_WEIGHT_PERCENT, '系统定时任务', true);
    });
    return map;
  }, []);

  const rows = useMemo(() => {
    const raw = RAW_BY_MONTH[appliedMonth];
    if (!raw) return [];
    if (appliedMonth !== CURRENT_MONTH && frozenReports[appliedMonth]) {
      return frozenReports[appliedMonth];
    }
    return buildCompetitionRows(appliedMonth, raw, weightPercent, weightUpdater, false);
  }, [appliedMonth, weightPercent, weightUpdater, frozenReports]);

  const podiumShifts = useMemo(() => {
    const r1 = rows.find((r) => r.ranking === 1);
    const r2 = rows.find((r) => r.ranking === 2);
    const r3 = rows.find((r) => r.ranking === 3);
    return [r2, r1, r3].filter(Boolean) as CompetitionRow[];
  }, [rows]);

  const monthLabel = dayjs(appliedMonth).format('YYYY年M月');

  const openShiftDetail = (row: CompetitionRow) => {
    const start = dayjs(appliedMonth).startOf('month').format('YYYY-MM-DD');
    const end = dayjs(appliedMonth).endOf('month').format('YYYY-MM-DD');
    const qs = new URLSearchParams({
      shiftValue: row.teamDutyName,
      startDate: start,
      endDate: end,
    });
    window.location.href = `/prototypes/fuel-handling-shift-report/?${qs.toString()}`;
  };

  const onSearch = () => {
    const m = queryMonth.format('YYYY-MM');
    if (!RAW_BY_MONTH[m]) {
      message.warning('该月份暂无竞赛数据');
      return;
    }
    setAppliedMonth(m);
    message.success(`已查询 ${m} 竞赛统计`);
  };

  const onReset = () => {
    setQueryMonth(dayjs(CURRENT_MONTH));
    setAppliedMonth(CURRENT_MONTH);
    message.info('已重置为默认月份');
  };

  const openWeight = () => {
    form.setFieldsValue({ ...weightPercent });
    setWeightOpen(true);
  };

  const saveWeight = async () => {
    try {
      const values = await form.validateFields();
      const next = { ...weightPercent };
      let sum = 0;
      INDICATORS.forEach((ind) => {
        const v = Number(values[ind.key]);
        next[ind.key] = v;
        sum += v;
      });
      if (sum !== 100) {
        message.error(`权重累加须为 100%，当前为 ${sum}%`);
        return;
      }
      setWeightPercent(next);
      setWeightUpdater(DEFAULT_UPDATER);
      setWeightUpdatedAt(dayjs().format('YYYY-MM-DD HH:mm:ss'));
      setWeightOpen(false);
      message.success('权重已保存');
    } catch {
      /* form validate */
    }
  };

  const columns: ColumnsType<CompetitionRow> = [
    {
      title: '排名',
      dataIndex: 'ranking',
      width: 110,
      fixed: 'left',
      sorter: (a, b) => a.ranking - b.ranking,
      render: (v: number) => <RankBadge rank={v} />,
    },
    {
      title: '班值名称',
      dataIndex: 'teamDutyName',
      width: 110,
      fixed: 'left',
      render: (text: string) => <span className="font-semibold" style={{ color: '#1677ff' }}>{text}</span>,
    },
    {
      title: '排班次数',
      dataIndex: 'dutyShiftCount',
      width: 90,
      align: 'right',
      className: 'tdmc-num',
    },
    {
      title: '综合得分',
      dataIndex: 'totalScore',
      width: 100,
      align: 'right',
      sorter: (a, b) => a.totalScore - b.totalScore,
      defaultSortOrder: 'descend',
      render: (v: number) => (
        <strong className="tdmc-num" style={{ color: '#1677ff', fontSize: 14 }}>
          {v.toFixed(2)}
        </strong>
      ),
    },
    ...INDICATORS.map((ind) => ({
      title: `${ind.name} ${ind.unit}`,
      dataIndex: ind.key,
      width: 120,
      align: 'right' as const,
      sorter: (a: CompetitionRow, b: CompetitionRow) => a[ind.key] - b[ind.key],
      render: (v: number, record: CompetitionRow) => (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.35 }}>
          <span className="tdmc-num" style={{ fontWeight: 500 }}>
            {Number.isInteger(v) ? v.toLocaleString() : v.toFixed(2)}
          </span>
          <span className="tdmc-num" style={{ fontSize: 11, color: 'rgba(0,0,0,0.45)' }}>
            得分 {getScore(record, ind).toFixed(2)}
          </span>
        </div>
      ),
    })),
    {
      title: '操作',
      key: 'action',
      width: 110,
      fixed: 'right' as const,
      render: (_: unknown, row: CompetitionRow) => (
        <Button type="link" size="small" icon={<UnorderedListOutlined />} onClick={() => openShiftDetail(row)}>
          明细查询
        </Button>
      ),
    },
  ];

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6,
        },
      }}
    >
      <div className="tdmc-root">
        <div className="tdmc-card tdmc-header-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                background: '#fff7e6',
                border: '1px solid #ffd591',
                borderRadius: 8,
                padding: 8,
              }}
            >
              <TrophyOutlined style={{ fontSize: 20, color: '#fa8c16' }} />
            </div>
            <div>
              <h1>班值月度竞赛统计</h1>
              <p>基于燃运班值报表对各班值月度小指标进行得分排名，支持查询、权重配置与导出</p>
            </div>
          </div>
          <div className="tdmc-filter">
            <span className="tdmc-section-desc" style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <CalendarOutlined /> 统计月份
            </span>
            <DatePicker
              picker="month"
              value={queryMonth}
              onChange={(v) => v && setQueryMonth(v)}
              allowClear={false}
            />
            <Button type="primary" icon={<SearchOutlined />} onClick={onSearch}>
              查询
            </Button>
            <Button icon={<ReloadOutlined />} onClick={onReset}>
              重置
            </Button>
            <Button icon={<SettingOutlined />} onClick={openWeight}>
              权重设置
            </Button>
            <Tooltip
              title={
                <div style={{ maxWidth: 380, lineHeight: 1.6 }}>
                  <div>计分说明（正逆向仅用于计算）：</div>
                  <div>· 正向：[(值-极小)/(极大-极小)]×100</div>
                  <div>· 逆向：[(极大-值)/(极大-极小)]×100</div>
                  <div>· 综合得分 = Σ(单项得分×权重)；权重合计须为 100%</div>
                </div>
              }
            >
              <Button icon={<InfoCircleOutlined />}>计分规则</Button>
            </Tooltip>
            <Button
              type="primary"
              ghost
              icon={<DownloadOutlined />}
              onClick={() => setExportOpen(true)}
              disabled={!rows.length}
            >
              导出竞赛报表
            </Button>
          </div>
        </div>

        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} lg={12}>
            <div className="tdmc-card" style={{ padding: 20, height: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <h3 className="tdmc-section-title">
                  <TrophyOutlined style={{ color: '#fa8c16' }} />
                  月度综合竞赛领奖台
                </h3>
                <Tag color="orange" style={{ margin: 0 }}>
                  {monthLabel}榜单
                </Tag>
              </div>
              <p className="tdmc-section-desc" style={{ marginBottom: 8 }}>
                按 9 项小指标极差标准化加权计算综合得分；本月共 {rows.length} 个班值参评。
              </p>
              <div className="podium-container">
                {podiumShifts.map((row) => {
                  const isGold = row.ranking === 1;
                  const isSilver = row.ranking === 2;
                  const blockClass = isGold ? 'gold' : isSilver ? 'silver' : 'bronze';
                  const title = isGold ? '第一名' : isSilver ? '第二名' : '第三名';
                  return (
                    <div
                      key={row.id}
                      className="podium-step"
                      onMouseEnter={() => setHoveredShift(row.teamDutyName)}
                      onMouseLeave={() => setHoveredShift(null)}
                    >
                      <div className="podium-avatar-container">
                        {isGold && <CrownOutlined className="podium-crown" />}
                        <div className={`podium-badge ${blockClass}`}>
                          {isGold ? <CrownFilled /> : <TrophyFilled />}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(0,0,0,0.75)', marginTop: 8 }}>
                          {row.teamDutyName}
                        </span>
                      </div>
                      <div className={`podium-block ${blockClass}`}>
                        <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.45)', marginBottom: 4 }}>{title}</span>
                        <span className="tdmc-num" style={{ fontSize: 18, fontWeight: 700, color: '#1677ff' }}>
                          {row.totalScore.toFixed(2)}
                        </span>
                        <span style={{ fontSize: 10, color: 'rgba(0,0,0,0.45)', marginTop: 4 }}>综合总分</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Col>

          <Col xs={24} lg={12}>
            <div
              className="tdmc-card"
              style={{ padding: 20, height: '100%', display: 'flex', flexDirection: 'column' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 className="tdmc-section-title">
                  <LineChartOutlined style={{ color: '#1677ff' }} />
                  班组小指标多维对比图
                </h3>
                <Tooltip title="悬停图例可高亮对应班值雷达分布">
                  <InfoCircleOutlined style={{ color: 'rgba(0,0,0,0.35)' }} />
                </Tooltip>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', margin: '12px 0 4px' }}>
                {rows.map((r) => {
                  const color = SHIFT_COLORS[r.teamDutyName] || '#1677ff';
                  const active = hoveredShift === r.teamDutyName;
                  return (
                    <div
                      key={r.id}
                      className={`radar-legend-item ${active ? 'active' : ''}`}
                      onMouseEnter={() => setHoveredShift(r.teamDutyName)}
                      onMouseLeave={() => setHoveredShift(null)}
                    >
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                      <span>{r.teamDutyName}</span>
                      <span className="tdmc-num" style={{ color: 'rgba(0,0,0,0.45)', fontSize: 11 }}>
                        ({r.totalScore.toFixed(2)}分)
                      </span>
                    </div>
                  );
                })}
              </div>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <InteractiveRadar rows={rows} hoveredShift={hoveredShift} onHover={setHoveredShift} />
              </div>
            </div>
          </Col>
        </Row>

        <div className="tdmc-card" style={{ padding: 20 }}>
          <div style={{ marginBottom: 12 }}>
            <h3 className="tdmc-section-title">
              <CompassOutlined style={{ color: '#13c2c2' }} />
              竞赛评分明细总表
            </h3>
            <p className="tdmc-section-desc">
              支持表头排序；点击「明细查询」可跳转燃运值班报表查看该班值当月明细。
            </p>
          </div>
          <Table<CompetitionRow>
            className="leaderboard-table"
            rowKey="id"
            size="small"
            bordered
            scroll={{ x: 1600 }}
            pagination={false}
            dataSource={rows}
            columns={columns}
            locale={{ emptyText: '暂无该月竞赛数据' }}
            rowClassName={(record) => {
              const base = record.ranking === 1 ? 'row-rank-1' : '';
              return hoveredShift === record.teamDutyName ? `${base} row-hovered` : base;
            }}
            onRow={(record) => ({
              onMouseEnter: () => setHoveredShift(record.teamDutyName),
              onMouseLeave: () => setHoveredShift(null),
            })}
          />
        </div>

        <Modal
          title="权重设置"
          open={weightOpen}
          onCancel={() => setWeightOpen(false)}
          onOk={saveWeight}
          okText="保存"
          width={560}
          destroyOnClose
        >
          <p style={{ fontSize: 13, color: 'rgba(0,0,0,0.65)', marginBottom: 12 }}>
            更新人：<strong>{weightUpdater}</strong>
            <span style={{ margin: '0 8px', color: 'rgba(0,0,0,0.25)' }}>|</span>
            更新时间：<strong>{weightUpdatedAt}</strong>
          </p>
          <Form form={form} layout="vertical" initialValues={weightPercent}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              {INDICATORS.map((ind) => (
                <Form.Item
                  key={ind.key}
                  name={ind.key}
                  label={`${ind.name}（%）`}
                  rules={[
                    { required: true, message: '必填' },
                    { type: 'number', min: 0, max: 100, message: '0～100 整数' },
                  ]}
                >
                  <InputNumber style={{ width: '100%' }} min={0} max={100} precision={0} addonAfter="%" />
                </Form.Item>
              ))}
            </div>
            <Form.Item shouldUpdate>
              {() => {
                const vals = form.getFieldsValue();
                const sum = INDICATORS.reduce((s, i) => s + (Number(vals[i.key]) || 0), 0);
                return (
                  <div className={`tdmc-weight-sum ${sum === 100 ? 'ok' : 'bad'}`}>
                    当前合计：<strong>{sum}</strong>%（须为 100%）
                  </div>
                );
              }}
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title="导出竞赛报表"
          open={exportOpen}
          onCancel={() => setExportOpen(false)}
          onOk={() => {
            exportCsv(rows, appliedMonth);
            setExportOpen(false);
            message.success('已导出 CSV');
          }}
          okText="确认导出"
        >
          <p>
            将导出 <strong>{appliedMonth}</strong> 共 <strong>{rows.length}</strong>{' '}
            条班值竞赛记录（含指标值、单项得分、权重与综合得分）。
          </p>
        </Modal>
      </div>
    </ConfigProvider>
  );
};

export default Component;
