/**
 * @name 燃运班值小指标竞赛统计
 * @mode axure
 *
 * 原型说明：
 * 四维数字化煤场后台「燃运班值小指标竞赛统计」功能页面。
 * 浅色 Ant Design 中后台风格。将四个班组在当月的卸煤、加仓、单耗、效率、投用率、空载率等指标
 * 进行标准化处理、打分排序，展示综合排行榜（荣誉领奖台）、雷达多维对比图、
 * 单项指标细分对比以及多指标全量排序表。支持竞赛打分规则查阅、班值诊断报告查看和竞赛报表导出。
 *
 * 参考资料：
 * - /rules/development-standards.md
 * - /skills/axure-export-workflow/SKILL.md
 */

import React, { useState, useMemo } from 'react';
import { 
  ConfigProvider, 
  theme, 
  Table, 
  Select, 
  Button, 
  Tooltip, 
  Drawer, 
  Modal, 
  Tag, 
  Badge, 
  Row, 
  Col, 
  Progress,
  List,
  Alert,
  Divider,
  message
} from 'antd';
import {
  TrophyOutlined,
  CalendarOutlined,
  InfoCircleOutlined,
  QuestionCircleOutlined,
  DownloadOutlined,
  HeartOutlined,
  StarOutlined,
  LineChartOutlined,
  CompassOutlined,
  FireOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  SmileOutlined,
  CaretUpOutlined,
  CaretDownOutlined,
  ArrowRightOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import './style.css';

// ----------------------------------------------------
// Mock Data (与燃运班次报表数据源严格对应)
// ----------------------------------------------------

interface ShiftMonthlyData {
  shiftValue: string;        // 班组名称：发电一值 ~ 发电四值
  unloadWeight: number;      // 卸煤量 t
  loadWeight: number;        // 加仓量 t
  unloadRunTime: number;     // 卸煤运行时间 min
  loadRunTime: number;       // 上煤运行时间 min
  unloadIdleTime: number;    // 卸煤空载时间 min
  loadIdleTime: number;      // 上煤空载时间 min
  unloadEnergy: number;      // 卸煤耗电量 kWh
  loadEnergy: number;        // 上煤耗电量 kWh
  sampleInRate: number;      // 入厂采样投运率
  sampleOutRate: number;     // 入炉采样投运率
  ironRemoveRate: number;    // 除铁装置投运率
  dustRemoveRate: number;    // 除尘装置投运率
}

// 2025年7月份的各班值真实汇总数据（与报表26个班次的时序分布一致并聚合）
const SHIFT_VALUES = ['发电一值', '发电二值', '发电三值', '发电四值'];

const RAW_MONTHLY_DATA: ShiftMonthlyData[] = [
  {
    shiftValue: '发电一值',
    unloadWeight: 32450,
    loadWeight: 22180,
    unloadRunTime: 2320,
    loadRunTime: 2110,
    unloadIdleTime: 210,
    loadIdleTime: 180,
    unloadEnergy: 13520,
    loadEnergy: 11090,
    sampleInRate: 98.2,
    sampleOutRate: 97.5,
    ironRemoveRate: 99.1,
    dustRemoveRate: 96.8
  },
  {
    shiftValue: '发电二值',
    unloadWeight: 36800,
    loadWeight: 24500,
    unloadRunTime: 2480,
    loadRunTime: 2250,
    unloadIdleTime: 380,
    loadIdleTime: 240,
    unloadEnergy: 16720,
    loadEnergy: 12900,
    sampleInRate: 95.4,
    sampleOutRate: 96.1,
    ironRemoveRate: 97.2,
    dustRemoveRate: 94.5
  },
  {
    shiftValue: '发电三值',
    unloadWeight: 29800,
    loadWeight: 19800,
    unloadRunTime: 2150,
    loadRunTime: 1890,
    unloadIdleTime: 120,
    loadIdleTime: 110,
    unloadEnergy: 11460,
    loadEnergy: 9430,
    sampleInRate: 99.4,
    sampleOutRate: 98.8,
    ironRemoveRate: 99.5,
    dustRemoveRate: 98.2
  },
  {
    shiftValue: '发电四值',
    unloadWeight: 34100,
    loadWeight: 23100,
    unloadRunTime: 2540,
    loadRunTime: 2180,
    unloadIdleTime: 450,
    loadIdleTime: 310,
    unloadEnergy: 15500,
    loadEnergy: 12160,
    sampleInRate: 94.2,
    sampleOutRate: 95.0,
    ironRemoveRate: 96.0,
    dustRemoveRate: 93.8
  }
];

// 历史数据模拟（近三个月趋势）
const HISTORY_TREND_DATA: Record<string, number[]> = {
  '发电一值': [86.5, 87.2, 90.4], // 5月, 6月, 7月
  '发电二值': [89.2, 85.8, 87.6],
  '发电三值': [91.0, 93.4, 95.8],
  '发电四值': [83.4, 84.1, 80.2]
};

// 指标定义
interface IndicatorMeta {
  key: string;
  name: string;
  unit: string;
  weight: number;
  isPositive: boolean; // 是否正向指标
  desc: string;
}

const INDICATORS: IndicatorMeta[] = [
  { key: 'unloadWeight', name: '卸煤总量', unit: 't', weight: 0.15, isPositive: true, desc: '当月该班组累计接卸的燃煤总量' },
  { key: 'loadWeight', name: '加仓总量', unit: 't', weight: 0.15, isPositive: true, desc: '当月该班组累计加仓的燃煤总量' },
  { key: 'unloadEff', name: '卸煤效率', unit: 't/h', weight: 0.15, isPositive: true, desc: '累计卸煤量 ÷ (累计卸煤运行时长 ÷ 60)' },
  { key: 'loadEff', name: '加仓效率', unit: 't/h', weight: 0.15, isPositive: true, desc: '累计加仓量 ÷ (累计上煤运行时长 ÷ 60)' },
  { key: 'deviceRate', name: '设备投用率', unit: '%', weight: 0.15, isPositive: true, desc: '四类关键设备（采样、除铁、除尘）月度综合均值' },
  { key: 'unitEnergyEff', name: '输煤综合单耗', unit: 't/kWh', weight: 0.15, isPositive: true, desc: '(累计卸煤量 + 累计加仓量) ÷ 累计耗电总量' },
  { key: 'idleRate', name: '皮带空载率', unit: '%', weight: 0.10, isPositive: false, desc: '累计空载时间 ÷ 累计皮带运行时间 × 100%' }
];

interface ShiftCalculatedRow extends ShiftMonthlyData {
  unloadEff: number;       // 卸煤效率 t/h
  loadEff: number;         // 加仓效率 t/h
  deviceRate: number;      // 综合设备投用率 %
  unitEnergyEff: number;   // 输煤单耗效率 t/kWh
  idleRate: number;        // 空载率 %
  
  // 各项指标得分 (0 - 100)
  scores: Record<string, number>;
  // 综合得分
  totalScore: number;
  // 排名
  rank: number;
}

const Component: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>('2025-07');
  const [isRuleModalOpen, setIsRuleModalOpen] = useState<boolean>(false);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState<boolean>(false);
  const [selectedShift, setSelectedShift] = useState<ShiftCalculatedRow | null>(null);
  const [hoveredShift, setHoveredShift] = useState<string | null>(null);
  
  // 排序状态
  const [sortField, setSortField] = useState<string>('totalScore');
  const [sortOrder, setSortOrder] = useState<'ascend' | 'descend'>('descend');

  // ----------------------------------------------------
  // 计算竞赛结果核心逻辑
  // ----------------------------------------------------
  const calculatedData = useMemo(() => {
    // 1. 基础计算
    const baseRows = RAW_MONTHLY_DATA.map(row => {
      const unloadEff = Number((row.unloadWeight / (row.unloadRunTime / 60)).toFixed(1));
      const loadEff = Number((row.loadWeight / (row.loadRunTime / 60)).toFixed(1));
      const deviceRate = Number(((row.sampleInRate + row.sampleOutRate + row.ironRemoveRate + row.dustRemoveRate) / 4).toFixed(1));
      
      const totalEnergy = row.unloadEnergy + row.loadEnergy;
      const totalWeight = row.unloadWeight + row.loadWeight;
      const unitEnergyEff = Number((totalWeight / totalEnergy).toFixed(3));
      
      const totalRunTime = row.unloadRunTime + row.loadRunTime;
      const totalIdleTime = row.unloadIdleTime + row.loadIdleTime;
      const idleRate = Number((totalIdleTime / totalRunTime * 100).toFixed(1));

      return {
        ...row,
        unloadEff,
        loadEff,
        deviceRate,
        unitEnergyEff,
        idleRate,
        scores: {} as Record<string, number>,
        totalScore: 0,
        rank: 0
      };
    });

    // 2. 极差标准化计算单项得分 (Min-Max 打分)
    // 首先获取各指标的极大值与极小值
    const minMaxMap: Record<string, { min: number; max: number }> = {};
    INDICATORS.forEach(ind => {
      const vals = baseRows.map(r => r[ind.key as keyof typeof r] as number);
      minMaxMap[ind.key] = {
        min: Math.min(...vals),
        max: Math.max(...vals)
      };
    });

    // 为每个班次打分并求综合分
    const scoredRows = baseRows.map(row => {
      let weightedSum = 0;
      INDICATORS.forEach(ind => {
        const val = row[ind.key as keyof typeof row] as number;
        const { min, max } = minMaxMap[ind.key];
        let score = 60; // 默认基准分
        
        if (max !== min) {
          if (ind.isPositive) {
            score = ((val - min) / (max - min)) * 40 + 60;
          } else {
            // 逆向指标越小得分越高
            score = ((max - val) / (max - min)) * 40 + 60;
          }
        } else {
          score = 100; // 如果都相等，给满分
        }
        
        score = Number(score.toFixed(1));
        row.scores[ind.key] = score;
        weightedSum += score * ind.weight;
      });
      
      row.totalScore = Number(weightedSum.toFixed(1));
      return row;
    });

    // 3. 计算排名 (按综合得分降序)
    const sortedByScore = [...scoredRows].sort((a, b) => b.totalScore - a.totalScore);
    sortedByScore.forEach((row, idx) => {
      row.rank = idx + 1;
    });

    // 4. 应用用户的表格字段排序
    if (sortField) {
      sortedByScore.sort((a, b) => {
        let valA = a[sortField as keyof ShiftCalculatedRow];
        let valB = b[sortField as keyof ShiftCalculatedRow];
        
        if (typeof valA === 'object') {
          // 处理嵌套 scores 的情况
          valA = a.scores[sortField.replace('score_', '')];
          valB = b.scores[sortField.replace('score_', '')];
        }

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortOrder === 'descend' ? valB - valA : valA - valB;
        } else {
          return sortOrder === 'descend' 
            ? String(valB).localeCompare(String(valA))
            : String(valA).localeCompare(String(valB));
        }
      });
    }

    return sortedByScore;
  }, [sortField, sortOrder]);

  // 领奖台班组排序：[第2名, 第1名, 第3名]
  const podiumShifts = useMemo(() => {
    // 先获取前三名
    const sorted = [...calculatedData].sort((a, b) => b.totalScore - a.totalScore);
    const gold = sorted.find(s => s.rank === 1);
    const silver = sorted.find(s => s.rank === 2);
    const bronze = sorted.find(s => s.rank === 3);
    return [silver, gold, bronze].filter(Boolean) as ShiftCalculatedRow[];
  }, [calculatedData]);

  // 获取各指标的第一名
  const championMap = useMemo(() => {
    const chMap: Record<string, { shiftValue: string; value: number; unit: string }> = {};
    INDICATORS.forEach(ind => {
      let bestRow = calculatedData[0];
      calculatedData.forEach(r => {
        if (ind.isPositive) {
          if ((r[ind.key as keyof ShiftCalculatedRow] as number) > (bestRow[ind.key as keyof ShiftCalculatedRow] as number)) {
            bestRow = r;
          }
        } else {
          if ((r[ind.key as keyof ShiftCalculatedRow] as number) < (bestRow[ind.key as keyof ShiftCalculatedRow] as number)) {
            bestRow = r;
          }
        }
      });
      chMap[ind.key] = {
        shiftValue: bestRow.shiftValue,
        value: bestRow[ind.key as keyof ShiftCalculatedRow] as number,
        unit: ind.unit
      };
    });
    return chMap;
  }, [calculatedData]);

  // 导出 CSV 报表
  const handleExportCSV = () => {
    Modal.confirm({
      title: '导出小指标竞赛报表确认',
      icon: <DownloadOutlined style={{ color: '#1677ff' }} />,
      content: `系统将根据当前计算模型导出 2025年7月份 的竞赛评分明细及班组排名。格式为 CSV。`,
      okText: '确认导出',
      cancelText: '取消',
      onOk() {
        const headers = [
          '排名', '班值名称', '综合得分', 
          '卸煤总量 t', '卸煤量单项得分', 
          '加仓总量 t', '加仓量单项得分', 
          '卸煤效率 t/h', '卸煤效率单项得分', 
          '加仓效率 t/h', '加仓效率单项得分', 
          '设备综合投用率 %', '设备投用率单项得分', 
          '输煤综合单耗 t/kWh', '输煤单耗单项得分', 
          '皮带空载率 %', '皮带空载率单项得分'
        ];
        
        const rows = calculatedData.map(r => [
          r.rank, r.shiftValue, r.totalScore,
          r.unloadWeight, r.scores.unloadWeight,
          r.loadWeight, r.scores.loadWeight,
          r.unloadEff, r.scores.unloadEff,
          r.loadEff, r.scores.loadEff,
          r.deviceRate, r.scores.deviceRate,
          r.unitEnergyEff, r.scores.unitEnergyEff,
          r.idleRate, r.scores.idleRate
        ]);

        const csvContent = "\uFEFF" + [
          headers.join(','),
          ...rows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `202507燃运班组小指标竞赛考核表.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        message.success('竞赛报表已成功导出');
      }
    });
  };

  // 打开诊断分析抽屉
  const handleOpenDiagnosis = (row: ShiftCalculatedRow) => {
    setSelectedShift(row);
    setIsDetailDrawerOpen(true);
  };

  // ----------------------------------------------------
  // SVG 高保真交互雷达图组件 (无需任何第三方图表库，纯SVG实现高保真交互)
  // ----------------------------------------------------
  const renderInteractiveRadar = () => {
    const width = 450;
    const height = 300;
    const centerX = width / 2;
    const centerY = height / 2;
    const rMax = 100; // 最大半径
    const levels = 4; // 圆形网格层数

    // 7项指标的雷达顶点角度分布
    const angleStep = (Math.PI * 2) / INDICATORS.length;

    // 获取每个顶点相对于中心的坐标
    const getVertexCoords = (index: number, radius: number) => {
      const angle = angleStep * index - Math.PI / 2; // 从正上方开始
      return {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius
      };
    };

    // 雷达多边形颜色映射
    const shiftColors: Record<string, string> = {
      '发电一值': '#1677ff', // 经典蓝
      '发电二值': '#52c41a', // 成功绿
      '发电三值': '#fa8c16', // 温暖橙
      '发电四值': '#722ed1'  // 优雅紫
    };

    return (
      <div className="radar-chart-container" style={{ width, height }}>
        <svg width={width} height={height}>
          {/* 1. 绘制网格圈层 */}
          {Array.from({ length: levels }).map((_, i) => {
            const radius = (rMax / levels) * (i + 1);
            return (
              <circle
                key={`grid-${i}`}
                cx={centerX}
                cy={centerY}
                r={radius}
                className={i === levels - 1 ? "radar-grid-line-bold" : "radar-grid-line"}
              />
            );
          })}

          {/* 2. 绘制轴线与标签 */}
          {INDICATORS.map((ind, idx) => {
            const outerCoord = getVertexCoords(idx, rMax);
            const labelRadius = rMax + 20;
            const labelCoord = getVertexCoords(idx, labelRadius);
            
            // 调整微调文本对齐
            let textAnchor = 'middle';
            let dy = '0.35em';
            if (labelCoord.x < centerX - 10) textAnchor = 'end';
            else if (labelCoord.x > centerX + 10) textAnchor = 'start';
            if (labelCoord.y < centerY - rMax + 5) dy = '-0.2em';
            else if (labelCoord.y > centerY + rMax - 5) dy = '1em';

            return (
              <g key={`axis-${idx}`}>
                <line
                  x1={centerX}
                  y1={centerY}
                  x2={outerCoord.x}
                  y2={outerCoord.y}
                  className="radar-axis"
                />
                <text
                  x={labelCoord.x}
                  y={labelCoord.y}
                  textAnchor={textAnchor}
                  dy={dy}
                  className="radar-label"
                >
                  {ind.name}
                </text>
              </g>
            );
          })}

          {/* 3. 绘制各班值得分多边形 (含悬停交互) */}
          {calculatedData.map(row => {
            const color = shiftColors[row.shiftValue];
            const isHovered = hoveredShift === row.shiftValue;
            const isAnyHovered = hoveredShift !== null;
            
            // 拼接多边形点串
            const pointsStr = INDICATORS.map((ind, idx) => {
              const score = row.scores[ind.key] || 60; // 60-100分
              // 标准化到极半径: 60分对应半径rMax*0.35, 100分对应rMax
              const ratio = 0.3 + ((score - 60) / 40) * 0.7;
              const radius = rMax * ratio;
              const coord = getVertexCoords(idx, radius);
              return `${coord.x},${coord.y}`;
            }).join(' ');

            return (
              <g key={`poly-${row.shiftValue}`}>
                <polygon
                  points={pointsStr}
                  stroke={color}
                  fill={color}
                  className={`radar-polygon ${isHovered ? 'highlighted' : isAnyHovered ? 'dimmed' : ''}`}
                  onMouseEnter={() => setHoveredShift(row.shiftValue)}
                  onMouseLeave={() => setHoveredShift(null)}
                />
                {/* 绘制顶点数据圆点 */}
                {INDICATORS.map((ind, idx) => {
                  const score = row.scores[ind.key] || 60;
                  const ratio = 0.3 + ((score - 60) / 40) * 0.7;
                  const radius = rMax * ratio;
                  const coord = getVertexCoords(idx, radius);

                  return (
                    <circle
                      key={`point-${row.shiftValue}-${idx}`}
                      cx={coord.x}
                      cy={coord.y}
                      r={isHovered ? 4.5 : isAnyHovered ? 1 : 3}
                      fill={color}
                      stroke="#ffffff"
                      strokeWidth={1}
                      className="radar-point"
                      style={{ opacity: isHovered ? 1 : isAnyHovered ? 0.2 : 0.8 }}
                    >
                      <title>{`${row.shiftValue} · ${ind.name}: ${row[ind.key as keyof ShiftCalculatedRow]}${ind.unit} (${score}分)`}</title>
                    </circle>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  // ----------------------------------------------------
  // 主渲染流程
  // ----------------------------------------------------
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6,
        },
      }}
    >
      <div className="competition-theme-root p-6">
        
        {/* 顶部控制与标题栏 */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-white p-4 rounded-lg border border-gray-100 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="bg-[#fff7e6] p-2 rounded-lg border border-[#ffd591]">
              <TrophyOutlined className="text-xl text-[#fa8c16]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800 m-0">燃运班值小指标竞赛统计</h1>
              <p className="text-xs text-gray-400 mt-1 mb-0">各班值月度核心运行数据极差标准化打分对比、雷达诊断以及综合竞赛荣誉榜</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <CalendarOutlined /> 统计月份:
              </span>
              <Select
                value={selectedMonth}
                onChange={setSelectedMonth}
                style={{ width: 120 }}
                options={[
                  { value: '2025-07', label: '2025年7月' },
                  { value: '2025-06', label: '2025年6月' },
                  { value: '2025-05', label: '2025年5月' },
                ]}
              />
            </div>
            <Button 
              icon={<QuestionCircleOutlined />} 
              onClick={() => setIsRuleModalOpen(true)}
            >
              打分规则
            </Button>
            <Button 
              type="primary" 
              icon={<DownloadOutlined />} 
              onClick={handleExportCSV}
            >
              导出竞赛报表
            </Button>
          </div>
        </div>

        {/* 荣誉领奖台与雷达图对比 */}
        <Row gutter={[24, 24]} className="mb-6">
          
          {/* 领奖台 (Podium) */}
          <Col xs={24} lg={12}>
            <div className="competition-card p-6 h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="font-bold text-sm text-gray-700 flex items-center gap-2">
                    <TrophyOutlined className="text-[#fa8c16]" />
                    月度综合竞赛领奖台
                  </span>
                  <Tag color="orange" className="m-0">2025年7月榜单</Tag>
                </div>
                <p className="text-xs text-gray-400 mb-6">
                  标准分60，满分100。本月共有4个班组参评，基于接卸、加仓、单耗及空载等7项小指标标准化权重计算。
                </p>
              </div>

              {/* 领奖台梯形展现 */}
              <div className="podium-container">
                {podiumShifts.map((row) => {
                  let badgeClass = "gold";
                  let blockClass = "gold";
                  let title = "月度全能王";
                  let crown = "👑";

                  if (row.rank === 2) {
                    badgeClass = "silver";
                    blockClass = "silver";
                    title = "高效作业先锋";
                    crown = "🥈";
                  } else if (row.rank === 3) {
                    badgeClass = "bronze";
                    blockClass = "bronze";
                    title = "安全节能标兵";
                    crown = "🥉";
                  }

                  return (
                    <div key={row.shiftValue} className="podium-step mx-2">
                      <div className="podium-avatar-container">
                        <span className="podium-crown">{crown}</span>
                        <div className={`podium-badge ${badgeClass}`}>{row.rank}</div>
                        <span className="text-xs font-bold text-gray-700 mt-2">{row.shiftValue}</span>
                      </div>
                      <div className={`podium-block ${blockClass}`}>
                        <span className="text-[11px] text-gray-400 mb-1">{title}</span>
                        <span className="text-lg font-bold text-[#1677ff] font-mono-num">{row.totalScore}</span>
                        <span className="text-[10px] text-gray-400 mt-1">综合总分</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Col>

          {/* 雷达多维分析 */}
          <Col xs={24} lg={12}>
            <div className="competition-card p-6 h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-gray-700 flex items-center gap-2">
                    <LineChartOutlined className="text-[#1677ff]" />
                    班组小指标多维对比图
                  </span>
                  <Tooltip title="悬停或点击图例可高亮各班组的雷达分布图">
                    <InfoCircleOutlined className="text-gray-400 cursor-help" />
                  </Tooltip>
                </div>
                <div className="flex flex-wrap gap-2 justify-center mt-3 mb-1">
                  {calculatedData.map(r => {
                    const shiftColors: Record<string, string> = {
                      '发电一值': '#1677ff', '发电二值': '#52c41a', '发电三值': '#fa8c16', '发电四值': '#722ed1'
                    };
                    const color = shiftColors[r.shiftValue];
                    const isActive = hoveredShift === r.shiftValue;
                    return (
                      <div 
                        key={r.shiftValue}
                        className={`radar-legend-item ${isActive ? 'active' : ''}`}
                        onMouseEnter={() => setHoveredShift(r.shiftValue)}
                        onMouseLeave={() => setHoveredShift(null)}
                      >
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></span>
                        <span>{r.shiftValue}</span>
                        <span className="font-mono-num text-gray-400 text-[11px]">({r.totalScore}分)</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 渲染SVG交互雷达 */}
              <div className="flex justify-center items-center">
                {renderInteractiveRadar()}
              </div>
            </div>
          </Col>
        </Row>

        {/* 7个单项指标细分微排行榜 */}
        <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
          <StarOutlined className="text-[#1677ff]" />
          单项核心指标及单项冠军
        </h2>
        
        <Row gutter={[16, 16]} className="mb-6">
          {INDICATORS.map(ind => {
            const champ = championMap[ind.key];
            
            // 按该指标的值排序获取当前指标下的各组情况（为了渲染进度条）
            const indSorted = [...calculatedData].sort((a, b) => {
              const valA = a[ind.key as keyof ShiftCalculatedRow] as number;
              const valB = b[ind.key as keyof ShiftCalculatedRow] as number;
              return ind.isPositive ? valB - valA : valA - valB;
            });

            // 最高值作为分母比例
            const maxVal = Math.max(...calculatedData.map(r => r[ind.key as keyof ShiftCalculatedRow] as number));
            const minVal = Math.min(...calculatedData.map(r => r[ind.key as keyof ShiftCalculatedRow] as number));

            return (
              <Col xs={24} sm={12} md={8} lg={6} key={ind.key}>
                <div className="competition-card indicator-card">
                  <div className="indicator-header">
                    <div className="flex flex-col">
                      <span className="indicator-title">{ind.name}</span>
                      <span className="text-xs text-gray-300 font-mono-num">权重: {ind.weight * 100}%</span>
                    </div>
                    <Tooltip title={`冠军：${champ.shiftValue}`}>
                      <div className="indicator-champion">
                        <TrophyOutlined />
                        <span>{champ.shiftValue}</span>
                      </div>
                    </Tooltip>
                  </div>

                  <div>
                    {indSorted.map((row, index) => {
                      const val = row[ind.key as keyof ShiftCalculatedRow] as number;
                      const score = row.scores[ind.key];
                      
                      // 计算条宽占比
                      let pct = 0;
                      if (maxVal !== 0) {
                        pct = ind.isPositive 
                          ? (val / maxVal) * 100
                          : (minVal / val) * 100; // 逆向指标越小条子越长
                      }

                      // 第一名高亮，其余灰色
                      const isFirst = index === 0;
                      const barColor = isFirst 
                        ? 'linear-gradient(90deg, #1890ff 0%, #36cfc9 100%)' 
                        : '#bfbfbf';

                      return (
                        <div key={row.shiftValue} className="indicator-row">
                          <span className="w-16 text-[11px] text-gray-500 truncate">{row.shiftValue}</span>
                          <div className="indicator-bar-container">
                            <div 
                              className="indicator-bar" 
                              style={{ 
                                width: `${Math.max(15, pct)}%`,
                                background: barColor
                              }}
                            />
                          </div>
                          <Tooltip title={`得分: ${score}分`}>
                            <span className="w-18 text-right font-mono-num font-semibold text-xs text-gray-700 cursor-help">
                              {val.toLocaleString()}
                              <span className="text-[10px] text-gray-400 ml-0.5">{ind.unit}</span>
                            </span>
                          </Tooltip>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Col>
            );
          })}
        </Row>

        {/* 竞赛排行榜明细表 */}
        <div className="competition-card p-6 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <span className="font-bold text-sm text-gray-700 flex items-center gap-2">
                <CompassOutlined className="text-[#13c2c2]" />
                竞赛评分明细总表
              </span>
              <p className="text-xs text-gray-400 mt-1 mb-0">支持表头点击对单项指标值或得分进行全量排序；点击班组名称查看专属诊断与调优改进方案。</p>
            </div>
          </div>

          <Table
            className="leaderboard-table"
            dataSource={calculatedData}
            rowKey="shiftValue"
            pagination={false}
            onChange={(_p, _f, sorter) => {
              const s = Array.isArray(sorter) ? sorter[0] : sorter;
              if (s && s.order) {
                setSortField((s.field as string) || (s.columnKey as string));
                setSortOrder(s.order);
              } else {
                setSortField('totalScore');
                setSortOrder('descend');
              }
            }}
            rowClassName={(record) => {
              const base = record.rank === 1 ? 'row-rank-1' : '';
              return hoveredShift === record.shiftValue ? `${base} row-hovered` : base;
            }}
            onRow={(record) => ({
              onMouseEnter: () => setHoveredShift(record.shiftValue),
              onMouseLeave: () => setHoveredShift(null)
            })}
            columns={[
              {
                title: '排名',
                dataIndex: 'rank',
                key: 'rank',
                width: 70,
                align: 'center',
                render: (rank) => {
                  let cls = "rank-4";
                  if (rank === 1) cls = "rank-1";
                  else if (rank === 2) cls = "rank-2";
                  else if (rank === 3) cls = "rank-3";
                  return <div className={`rank-badge ${cls}`}>{rank}</div>;
                }
              },
              {
                title: '班组名称',
                dataIndex: 'shiftValue',
                key: 'shiftValue',
                width: 120,
                render: (text, record) => (
                  <Button 
                    type="link" 
                    className="p-0 font-semibold text-[#1677ff] hover:underline"
                    onClick={() => handleOpenDiagnosis(record)}
                  >
                    {text}
                  </Button>
                )
              },
              {
                title: '综合得分',
                dataIndex: 'totalScore',
                key: 'totalScore',
                width: 110,
                align: 'right',
                sorter: true,
                defaultSortOrder: 'descend',
                render: (score) => (
                  <span className="font-mono-num font-bold text-sm text-[#1677ff]">{score}</span>
                )
              },
              {
                title: '卸煤量 t',
                dataIndex: 'unloadWeight',
                key: 'unloadWeight',
                align: 'right',
                sorter: true,
                render: (val, record) => (
                  <div className="flex flex-col align-end">
                    <span className="font-mono-num text-gray-700 font-medium">{val.toLocaleString()}</span>
                    <span className="text-[10px] text-gray-400 font-mono-num">得分: {record.scores.unloadWeight}</span>
                  </div>
                )
              },
              {
                title: '加仓量 t',
                dataIndex: 'loadWeight',
                key: 'loadWeight',
                align: 'right',
                sorter: true,
                render: (val, record) => (
                  <div className="flex flex-col align-end">
                    <span className="font-mono-num text-gray-700 font-medium">{val.toLocaleString()}</span>
                    <span className="text-[10px] text-gray-400 font-mono-num">得分: {record.scores.loadWeight}</span>
                  </div>
                )
              },
              {
                title: '卸煤效率 t/h',
                dataIndex: 'unloadEff',
                key: 'unloadEff',
                align: 'right',
                sorter: true,
                render: (val, record) => (
                  <div className="flex flex-col align-end">
                    <span className="font-mono-num text-gray-700">{val}</span>
                    <span className="text-[10px] text-gray-400 font-mono-num">得分: {record.scores.unloadEff}</span>
                  </div>
                )
              },
              {
                title: '加仓效率 t/h',
                dataIndex: 'loadEff',
                key: 'loadEff',
                align: 'right',
                sorter: true,
                render: (val, record) => (
                  <div className="flex flex-col align-end">
                    <span className="font-mono-num text-gray-700">{val}</span>
                    <span className="text-[10px] text-gray-400 font-mono-num">得分: {record.scores.loadEff}</span>
                  </div>
                )
              },
              {
                title: '设备投用率 %',
                dataIndex: 'deviceRate',
                key: 'deviceRate',
                align: 'right',
                sorter: true,
                render: (val, record) => (
                  <div className="flex flex-col align-end">
                    <span className="font-mono-num text-gray-700">{val}%</span>
                    <span className="text-[10px] text-gray-400 font-mono-num">得分: {record.scores.deviceRate}</span>
                  </div>
                )
              },
              {
                title: '输煤单耗 t/kWh',
                dataIndex: 'unitEnergyEff',
                key: 'unitEnergyEff',
                align: 'right',
                sorter: true,
                render: (val, record) => (
                  <div className="flex flex-col align-end">
                    <span className="font-mono-num text-gray-700">{val}</span>
                    <span className="text-[10px] text-gray-400 font-mono-num">得分: {record.scores.unitEnergyEff}</span>
                  </div>
                )
              },
              {
                title: '皮带空载率 %',
                dataIndex: 'idleRate',
                key: 'idleRate',
                align: 'right',
                sorter: true,
                render: (val, record) => (
                  <div className="flex flex-col align-end">
                    <span className="font-mono-num text-gray-700 text-amber-600">{val}%</span>
                    <span className="text-[10px] text-gray-400 font-mono-num">得分: {record.scores.idleRate}</span>
                  </div>
                )
              }
            ]}
          />
        </div>

        {/* 打分评分规则 Modal */}
        <Modal
          title={
            <div className="flex items-center gap-2 text-[#1677ff]">
              <TrophyOutlined />
              <span>小指标竞赛评分与计算方法</span>
            </div>
          }
          open={isRuleModalOpen}
          onCancel={() => setIsRuleModalOpen(false)}
          footer={[
            <Button key="close" type="primary" onClick={() => setIsRuleModalOpen(false)}>知道了</Button>
          ]}
          width={650}
        >
          <div className="text-gray-600 text-xs leading-relaxed">
            <h3 className="text-sm font-bold text-gray-800 mb-2">1. 极差标准化算法 (Min-Max Scoring)</h3>
            <p className="mb-2">为了在不同单位、不同数量级的指标之间进行公平对比，系统使用**极差标准化打分法**将每项小指标物理量映射到 0~100 的区间内。基础起步分为 60 分，最优秀的班值获得 100 分：</p>
            
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 font-mono mb-4 text-gray-700">
              <div className="mb-1 font-semibold">● 正向指标（越多越好，如接卸、加仓总量与效率）：</div>
              <div>得分 = (当前值 - 极小值) ÷ (极大值 - 极小值) × 40 + 60</div>
              <div className="mt-2 mb-1 font-semibold">● 逆向指标（越少越好，如皮带空载率）：</div>
              <div>得分 = (极大值 - 当前值) ÷ (极大值 - 极小值) × 40 + 60</div>
            </div>

            <h3 className="text-sm font-bold text-gray-800 mb-2">2. 指标权重分配</h3>
            <p className="mb-3">系统基于电厂节能降耗及重载考核标准，对7项核心指标进行加权求和，得到最终的<b>“综合竞赛得分”</b>：</p>
            
            <Row gutter={[16, 8]} className="mb-4">
              <Col span={12}>
                <div className="flex justify-between border-b border-gray-100 py-1">
                  <span>卸煤总量 (t):</span><span className="font-bold text-[#1677ff]">15%</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 py-1">
                  <span>加仓总量 (t):</span><span className="font-bold text-[#1677ff]">15%</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 py-1">
                  <span>卸煤效率 (t/h):</span><span className="font-bold text-[#1677ff]">15%</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 py-1">
                  <span>加仓效率 (t/h):</span><span className="font-bold text-[#1677ff]">15%</span>
                </div>
              </Col>
              <Col span={12}>
                <div className="flex justify-between border-b border-gray-100 py-1">
                  <span>设备综合投用率 (%):</span><span className="font-bold text-[#1677ff]">15%</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 py-1">
                  <span>输煤综合单耗 (t/kWh):</span><span className="font-bold text-[#1677ff]">15%</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 py-1">
                  <span>皮带空载率 (%):</span><span className="font-bold text-[#fa8c16]">10%</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 py-1 font-semibold">
                  <span>合计总权重:</span><span className="text-green-600">100%</span>
                </div>
              </Col>
            </Row>

            <Alert 
              message="温和考核提示" 
              description="该计算模型不仅保证了高效率班次的荣誉感（满分），同时也保留了表现相对靠后班组的基础得分（不低于60分），起到鼓励先进、鞭策后进的温和促进目的。" 
              type="info" 
              showIcon 
            />
          </div>
        </Modal>

        {/* 专属诊断与调优建议 Drawer */}
        <Drawer
          title={
            <div className="flex items-center gap-2">
              <TrophyOutlined className="text-[#fa8c16]" />
              <span>{selectedShift ? `${selectedShift.shiftValue}竞赛绩效诊断报告` : '班组诊断'}</span>
            </div>
          }
          placement="right"
          width={580}
          onClose={() => setIsDetailDrawerOpen(false)}
          open={isDetailDrawerOpen}
        >
          {selectedShift && (
            <div className="text-gray-700 text-xs">
              
              {/* 总分大字报 */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-lg p-5 mb-6 text-center">
                <div className="text-xs text-blue-500 uppercase tracking-wider font-semibold">月度竞赛排名</div>
                <div className="text-3xl font-extrabold text-[#1677ff] mt-2 mb-1">
                  第 {selectedShift.rank} 名
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  综合竞赛总得分: <span className="font-bold text-gray-800 text-sm font-mono-num">{selectedShift.totalScore}</span> 分
                </div>
              </div>

              {/* 历史趋势图 (简易高保真SVG线图) */}
              <div className="mb-6">
                <div className="font-bold text-sm text-gray-800 mb-3 flex items-center gap-1">
                  <LineChartOutlined /> 近三个月综合得分趋势
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 flex flex-col items-center">
                  <div className="flex items-center justify-between w-full text-gray-400 text-[10px] mb-2 px-4">
                    <span>5月</span>
                    <span>6月</span>
                    <span>7月(本月)</span>
                  </div>
                  {(() => {
                    const trend = HISTORY_TREND_DATA[selectedShift.shiftValue] || [80, 80, 80];
                    return (
                      <div className="relative w-full h-[80px]">
                        <svg className="w-full h-full">
                          {/* 轴线 */}
                          <line x1="10%" y1="70" x2="90%" y2="70" stroke="#f0f0f0" strokeWidth="1" />
                          <line x1="10%" y1="10" x2="10%" y2="70" stroke="#f0f0f0" strokeWidth="1" />
                          
                          {/* 趋势折线 */}
                          {(() => {
                            const p1_x = "15%", p1_y = 80 - (trend[0] - 60) * 1.5;
                            const p2_x = "50%", p2_y = 80 - (trend[1] - 60) * 1.5;
                            const p3_x = "85%", p3_y = 80 - (trend[2] - 60) * 1.5;
                            const isUp = trend[2] >= trend[1];
                            
                            return (
                              <g>
                                <path 
                                  d={`M 15%,${p1_y} L 50%,${p2_y} L 85%,${p3_y}`} 
                                  fill="none" 
                                  stroke={isUp ? "#52c41a" : "#ff4d4f"} 
                                  strokeWidth="2.5" 
                                  strokeLinecap="round"
                                />
                                <circle cx="15%" cy={p1_y} r="4" fill="#ffffff" stroke={isUp ? "#52c41a" : "#ff4d4f"} strokeWidth="2" />
                                <circle cx="50%" cy={p2_y} r="4" fill="#ffffff" stroke={isUp ? "#52c41a" : "#ff4d4f"} strokeWidth="2" />
                                <circle cx="85%" cy={p3_y} r="4" fill="#ffffff" stroke={isUp ? "#52c41a" : "#ff4d4f"} strokeWidth="2" />
                                
                                <text x="15%" y={p1_y - 8} textAnchor="middle" fontSize="10" fontWeight="bold" fill="rgba(0,0,0,0.65)">{trend[0]}</text>
                                <text x="50%" y={p2_y - 8} textAnchor="middle" fontSize="10" fontWeight="bold" fill="rgba(0,0,0,0.65)">{trend[1]}</text>
                                <text x="85%" y={p3_y - 8} textAnchor="middle" fontSize="10" fontWeight="bold" fill="rgba(0,0,0,0.65)">{trend[2]}</text>
                              </g>
                            );
                          })()}
                        </svg>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* 优势小指标 (得分 >= 85) */}
              <div className="mb-6">
                <div className="font-bold text-sm text-gray-800 mb-3 flex items-center gap-1">
                  <CheckCircleOutlined className="text-green-500" /> 优势亮点指标
                </div>
                <List
                  dataSource={INDICATORS.filter(ind => (selectedShift.scores[ind.key] || 0) >= 85)}
                  renderItem={ind => (
                    <div className="flex items-center justify-between border border-green-100 bg-green-50/30 p-2.5 rounded-lg mb-2">
                      <div className="flex items-center gap-2">
                        <HeartOutlined className="text-green-500" />
                        <div>
                          <div className="font-bold text-gray-700">{ind.name}</div>
                          <div className="text-[10px] text-gray-400">{ind.desc}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono-num font-bold text-green-600">{selectedShift[ind.key as keyof ShiftCalculatedRow]} {ind.unit}</div>
                        <span className="text-[10px] text-green-500 font-mono-num">得分: {selectedShift.scores[ind.key]}</span>
                      </div>
                    </div>
                  )}
                  locale={{ emptyText: <div className="text-gray-400 py-2 text-center">当前月份无 85 分以上的高分优势指标。</div> }}
                />
              </div>

              {/* 薄弱小指标 (得分 < 75) */}
              <div className="mb-6">
                <div className="font-bold text-sm text-gray-800 mb-3 flex items-center gap-1">
                  <WarningOutlined className="text-[#fa8c16]" /> 薄弱待提升指标
                </div>
                <List
                  dataSource={INDICATORS.filter(ind => (selectedShift.scores[ind.key] || 0) < 75)}
                  renderItem={ind => {
                    // 自定义改进建议
                    let advice = "建议加强班次内运行管控，防止设备运行效能低下。";
                    if (ind.key === 'idleRate') advice = "皮带空载时间过长（空载电耗增加），建议集控员密切注意给料流程，在非给料时段及时停机。";
                    else if (ind.key === 'unitEnergyEff') advice = "输煤综合单耗偏高。建议在保证接卸量的前提下，优化皮带调速，并提高电机无载/轻载控制。";
                    else if (ind.key === 'deviceRate') advice = "关键投运率稍低。应强化白夜班采样头和除铁除尘设备的巡检，发现小故障需及时反馈维护组。";
                    else if (ind.key === 'unloadEff' || ind.key === 'loadEff') advice = "作业效率偏低。需检查班次期间皮带加煤、给料阀门的开度，建议保持均匀给料以提效。";

                    return (
                      <div className="border border-amber-100 bg-amber-50/20 p-2.5 rounded-lg mb-2">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <CloseCircleOutlined className="text-amber-500" />
                            <span className="font-bold text-gray-700">{ind.name}</span>
                          </div>
                          <div className="text-right font-mono-num text-xs">
                            <span className="font-semibold text-amber-600">{selectedShift[ind.key as keyof ShiftCalculatedRow]} {ind.unit}</span>
                            <span className="text-[10px] text-gray-400 ml-2">(得分: {selectedShift.scores[ind.key]})</span>
                          </div>
                        </div>
                        <div className="text-[10px] text-gray-400 bg-white p-2 rounded border border-amber-50/50 mt-1 flex gap-1.5">
                          <ArrowRightOutlined className="text-amber-500 mt-0.5" />
                          <span><b>优化建议：</b>{advice}</span>
                        </div>
                      </div>
                    );
                  }}
                  locale={{ emptyText: <div className="text-green-600 py-2 text-center font-semibold">👏 太棒了！当前班值无 75 分以下的薄弱指标。</div> }}
                />
              </div>

              <Divider className="my-4" />
              
              <div className="text-center text-gray-400 text-[10px]">
                诊断建议基于 7 项生产小指标数据结合极差分布深度诊断，仅供班组绩效促进参考。
              </div>
            </div>
          )}
        </Drawer>

      </div>
    </ConfigProvider>
  );
};

export default Component;
