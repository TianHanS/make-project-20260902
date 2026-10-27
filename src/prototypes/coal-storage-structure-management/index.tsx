/**
 * @name 煤场存煤结构管理
 * @mode axure
 *
 * 参考资料：
 * - rules/axure-export-workflow.md
 * - rules/prototype-development-guide.md
 * - rules/axure-api-guide.md
 * - .spec/spec.md
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  Checkbox,
  ConfigProvider,
  Form,
  Drawer,
  Input,
  InputNumber,
  Radio,
  Segmented,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
} from 'antd';
import {
  AppstoreOutlined,
  ExportOutlined,
  ImportOutlined,
  ProfileOutlined,
  SettingOutlined,
  TableOutlined,
} from '@ant-design/icons';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import {
  ARRIVAL_BATCHES,
  CAN_MAINTAIN_DEFAULT_DENSITY,
  COAL_TYPES,
  DEFAULT_LABEL_KEY,
  INITIAL_AUDIT,
  INITIAL_MOVES,
  LABEL_FIELDS,
  UNMARKED_COLOR,
  type AuditLog,
  type ArrivalBatch,
  type CoalZone,
  type StockCoal,
  type DensityConfig,
  type StockMove,
  coalTypeName,
  createZones,
  initialStockCoals,
  paintStockColor,
  upsertStockCoal,
  validateStockAssignment,
  DEFAULT_VOLUME_LIMIT,
  enabledYards,
  fmt,
  nextRecordId,
  readDensityConfig,
  readLastYardId,
  readYardAutoFlags,
  resolveCoalKey,
  shortRegNo,
  writeDensityConfig,
  writeLastYardId,
  writeYardAutoFlag,
} from './data';
import { compactFieldValue, fieldValue } from './labels';
import {
  applyInbound,
  applyMerge,
  applyOutbound,
  applySplit,
  computeZone,
  deleteLayer,
  replaceLayer,
  resolveMergePair,
  type ComputedLayer,
  type ComputedZone,
  type InboundPlanItem,
  type SplitPreviewRow,
} from './model';
import StackHeatmap from './components/StackHeatmap';
import LayerMatrix from './components/LayerMatrix';
import LayerInspector from './components/LayerInspector';
import InboundDrawer from './components/InboundDrawer';
import OutboundDrawer from './components/OutboundDrawer';
import SplitLayerDrawer from './components/SplitLayerDrawer';
import MergeLayerDrawer from './components/MergeLayerDrawer';
import BatchPickerModal from './components/BatchPickerModal';
import StockCoalField from './components/StockCoalField';
import LedgerPanel, { type LedgerPageId } from './pages/LedgerQueryPage';
import {
  actorsOf,
  createInitialLedger,
  layerAdjustLine,
  nextLedgerId,
  type AdjustAction,
  type AdjustLineDraft,
  type LedgerState,
} from './ledger';
import { useHashPage } from '../../common/useHashPage';
import './style.css';

const OPERATOR = '田略（燃料专责）';
const nowText = () => dayjs().format('YYYY-MM-DD HH:mm');

type ViewMode = 'stack' | 'matrix' | 'table';

interface FlatRow {
  key: string;
  zone: ComputedZone;
  layer: ComputedLayer;
}

interface MarkFormValues {
  regNo?: string;
  coalType?: string;
  density?: number;
  zoneIds?: string[];
  markAll?: boolean;
}

interface ConfirmRequest {
  title: string;
  content: React.ReactNode;
  okText: string;
  cancelText: string;
  danger?: boolean;
  onOk: () => void;
}

const ComponentInner: React.FC = () => {
  const { message } = App.useApp();
  const { page } = useHashPage('structure');
  const ledgerTabs = ['inbound', 'outbound', 'adjust', 'survey'] as const;
  const [ledgerTab, setLedgerTab] = useState<LedgerPageId>(
    ledgerTabs.includes(page as LedgerPageId) ? (page as LedgerPageId) : 'inbound',
  );

  const [zones, setZones] = useState<CoalZone[]>(() => createZones());
  const [yardId, setYardId] = useState(readLastYardId);
  const [densityConfig, setDensityConfig] = useState<DensityConfig>(readDensityConfig);
  const density = densityConfig.density;
  const [yardAuto, setYardAuto] = useState(readYardAutoFlags);
  const [ledger, setLedger] = useState<LedgerState>(createInitialLedger);
  const [batches, setBatches] = useState<ArrivalBatch[]>(() => ARRIVAL_BATCHES.map((item) => ({ ...item })));
  const [stockPalette, setStockPalette] = useState<StockCoal[]>(() => initialStockCoals());
  const readMarkStock = React.useRef<(() => { name: string; color: string }) | null>(null);
  const [markColor, setMarkColor] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('stack');
  const [tableQuery, setTableQuery] = useState('');
  const stageRef = React.useRef<HTMLDivElement>(null);
  const [stageHeight, setStageHeight] = useState(480);
  const [labelKey, setLabelKey] = useState(DEFAULT_LABEL_KEY);
  const [selected, setSelected] = useState<{ zoneId: string; layerId: string } | null>(null);

  const [moves, setMoves] = useState<StockMove[]>(INITIAL_MOVES);
  const [audits, setAudits] = useState<AuditLog[]>(INITIAL_AUDIT);

  const [densityOpen, setDensityOpen] = useState(false);
  const [densityDraft, setDensityDraft] = useState<DensityConfig>(readDensityConfig);
  const [densityForm] = Form.useForm();
  const [inboundOpen, setInboundOpen] = useState(false);
  const [outboundOpen, setOutboundOpen] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeDirection, setMergeDirection] = useState<'up' | 'down'>('up');
  const [batchPickerOpen, setBatchPickerOpen] = useState(false);
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);
  const [markOpen, setMarkOpen] = useState(false);
  const [markInitial, setMarkInitial] = useState<MarkFormValues>({});
  const [markForm] = Form.useForm();
  const watchedReg = Form.useWatch('regNo', markForm) as string | undefined;
  const watchedCoal = Form.useWatch('coalType', markForm) as string | undefined;
  const watchedDensity = Form.useWatch('density', markForm) as number | undefined;
  const watchedZoneIds = (Form.useWatch('zoneIds', markForm) as string[] | undefined) ?? [];
  const watchedMarkAll = Boolean(Form.useWatch('markAll', markForm));

  const yardBase = (enabledYards().find((y) => y.id === yardId) ?? enabledYards()[0])!;
  const yard = {
    ...yardBase,
    autoUpdateByVolume: yardBase.hasSurvey ? Boolean(yardAuto[yardBase.id]) : false,
  };

  useEffect(() => {
    if (!yard.hasSurvey && viewMode === 'stack') setViewMode('matrix');
    if (!yard.hasSurvey && (labelKey === 'pitchStart' || labelKey === 'heightStart')) {
      setLabelKey(DEFAULT_LABEL_KEY);
    }
  }, [yard.hasSurvey, viewMode, labelKey]);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return undefined;
    const measure = () => setStageHeight(node.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [viewMode, yardId, page]);

  const changeYard = (nextId: string) => {
    setYardId(nextId);
    writeLastYardId(nextId);
  };

  const openDensity = () => {
    const draft: DensityConfig = {
      density: Number(densityConfig.density.toFixed(3)),
      autoUpdateByVolume: yard.autoUpdateByVolume,
      volumeLimit: densityConfig.volumeLimit || DEFAULT_VOLUME_LIMIT,
    };
    setDensityDraft(draft);
    densityForm.setFieldsValue(draft);
    setDensityOpen(true);
  };

  const saveDensity = async () => {
    const values = await densityForm.validateFields();
    const next = writeDensityConfig({
      density: Number(values.density),
      autoUpdateByVolume: false,
      volumeLimit: Number(values.volumeLimit),
    });
    setDensityConfig(next);
    const autoOn = yard.hasSurvey && Boolean(values.autoUpdateByVolume);
    if (yard.hasSurvey) setYardAuto(writeYardAutoFlag(yard.id, autoOn));
    setDensityOpen(false);
    message.success(
      autoOn ? '配置信息已保存。当前煤场将按盘煤体积自动更新存煤结构' : '配置信息已保存',
    );
  };

  const appendAdjust = (
    action: AdjustAction,
    zoneName: string,
    note: string,
    lines: AdjustLineDraft[],
  ) => {
    const id = nextLedgerId('AD');
    const time = nowText();
    setLedger((prev) => ({
      ...prev,
      adjust: [{
        id,
        yardId,
        zoneName,
        target: `${yard.shortName} · ${zoneName}`,
        action,
        note,
        ...actorsOf('manual', OPERATOR, time),
      }, ...prev.adjust],
      adjustDetails: [
        ...lines.map((line, index) => ({
          ...line,
          id: `${id}-${index + 1}`,
          recordId: id,
        })),
        ...prev.adjustDetails,
      ],
    }));
  };

  const computedZones = useMemo(
    () =>
      zones
        .filter((z) => z.yardId === yardId)
        .sort((a, b) => a.code - b.code)
        .map(computeZone),
    [zones, yardId],
  );

  const selectedZone = selected ? computedZones.find((z) => z.id === selected.zoneId) ?? null : null;
  const selectedLayer =
    selectedZone && selected
      ? selectedZone.layers.find((l) => l.id === selected.layerId) ?? null
      : null;

  const unmarkedInZone = (zone: ComputedZone) =>
    zone.layers.filter((layer) => layer.raw.status === 'unmarked');
  const markTargets = (() => {
    if (selectedLayer?.raw.status !== 'unmarked') {
      return selectedZone && selectedLayer ? [{ zone: selectedZone, layer: selectedLayer }] : [];
    }
    if (watchedMarkAll) {
      return computedZones.flatMap((zone) =>
        unmarkedInZone(zone).map((layer) => ({ zone, layer })),
      );
    }
    if (watchedZoneIds.length > 0) {
      return computedZones
        .filter((zone) => watchedZoneIds.includes(zone.id))
        .flatMap((zone) => unmarkedInZone(zone).map((layer) => ({ zone, layer })));
    }
    return selectedZone && selectedLayer ? [{ zone: selectedZone, layer: selectedLayer }] : [];
  })();

  const totals = useMemo(
    () => ({
      surveyVolume: computedZones.reduce((s, z) => s + z.raw.surveyVolume, 0),
      totalMass: computedZones.reduce((s, z) => s + z.totalMass, 0),
      unmarkedLayers: computedZones.reduce((s, z) => s + z.unmarkedCount, 0),
    }),
    [computedZones],
  );

  const labelMap = useMemo(() => {
    const compact = new Map<string, string>();
    const full = new Map<string, string>();
    computedZones.forEach((z) =>
      z.layers.forEach((l) => {
        compact.set(l.id, compactFieldValue(l, labelKey));
        full.set(l.id, fieldValue(l, labelKey));
      }),
    );
    return { compact, full };
  }, [computedZones, labelKey]);

  const compactLabelOf = useCallback((id: string) => labelMap.compact.get(id) ?? '', [labelMap]);
  const fullLabelOf = useCallback((id: string) => labelMap.full.get(id) ?? '', [labelMap]);

  const legendTypes = useMemo(() => {
    const map = new Map<string, string>();
    computedZones.forEach((z) =>
      z.layers.forEach((l) => {
        if (l.raw.status !== 'marked' || !l.raw.coalType) return;
        const name = coalTypeName(l.raw.coalType);
        if (map.has(name)) return;
        const color = l.raw.color
          || stockPalette.find((item) => item.name === name)?.color
          || COAL_TYPES[l.raw.coalType]?.family[0]
          || UNMARKED_COLOR;
        map.set(name, color);
      }),
    );
    return [...map.entries()].map(([name, color]) => ({ key: name, name, color }));
  }, [computedZones, stockPalette]);

  useEffect(() => setSelected(null), [yardId]);

  /* ---------------------------- 记录写入 ---------------------------- */

  const pushAudit = useCallback(
    (target: string, action: string, before: string, after: string) =>
      setAudits((prev) => [
        {
          id: nextRecordId('A'),
          time: nowText(),
          operator: OPERATOR,
          target,
          action,
          before,
          after,
        },
        ...prev,
      ]),
    [],
  );

  const pushMove = useCallback(
    (move: Omit<StockMove, 'id' | 'time'>) =>
      setMoves((prev) => [{ ...move, id: nextRecordId('M'), time: nowText() }, ...prev]),
    [],
  );

  const locateUnmarked = () => {
    for (const z of computedZones) {
      const layer = z.layers.find((l) => l.raw.status === 'unmarked');
      if (layer) {
        setSelected({ zoneId: z.id, layerId: layer.id });
        return;
      }
    }
    message.info('当前煤场没有待人工标记的煤层');
  };

  /* ---------------------------- 操作：入库 ---------------------------- */

  const commitInbound = (params: {
    plan: InboundPlanItem[];
    regNo: string;
    stockCoalType: string;
    stockColor: string;
    density: number;
    totalMass: number;
    note: string;
  }) => {
    const stackedAt = dayjs().format('YYYY-MM-DD');
    const coalKey = resolveCoalKey(params.stockCoalType);
    const coalName = params.stockCoalType;
    setStockPalette((prev) => upsertStockCoal(prev, coalName, params.stockColor));
    setBatches((prev) =>
      prev.map((item) =>
        item.regNo === params.regNo ? { ...item, stockCoalType: coalName } : item,
      ),
    );
    setZones((prev) =>
      paintStockColor(
        applyInbound(prev, params.plan, params.regNo, params.density, stackedAt, coalKey),
        coalName,
        params.stockColor,
      ),
    );

    const time = nowText();
    const batch = batches.find((item) => item.regNo === params.regNo);
    const inboundId = nextLedgerId('IN');
    setLedger((prev) => ({
      ...prev,
      inbound: [
        {
          id: inboundId,
          yardId,
          ...actorsOf('manual', OPERATOR, time),
          regNo: params.regNo,
          shipName: batch?.shipName ?? '',
          voyage: batch?.voyage ?? '',
          coalTypeName: coalName,
          totalMass: params.totalMass,
          density: params.density,
          note: params.note || '人工入库',
          mode: 'manual',
        },
        ...prev.inbound,
      ],
      inboundDetails: [
        ...params.plan.map((item, index) => ({
          id: `${inboundId}-${index + 1}`,
          recordId: inboundId,
          zoneName: item.zoneName,
          volume: item.volume,
          mass: item.mass,
          pitchFrom: item.pitchFrom,
          pitchTo: item.pitchTo,
          heightFrom: item.heightFrom,
          heightTo: item.heightTo,
        })),
        ...prev.inboundDetails,
      ],
    }));
    setMoves((prev) => [
      ...params.plan.map((item) => ({
        id: nextRecordId('M'),
        time,
        type: 'in' as const,
        yardId,
        zoneName: item.zoneName,
        regNo: params.regNo,
        coalTypeName: coalName,
        volume: item.volume,
        mass: item.mass,
        source: 'manual' as const,
        note: params.note || '人工入库',
      })),
      ...prev,
    ]);

    setInboundOpen(false);
    setSelected(null);
    message.success(
      `已入库，合计 ${fmt(params.totalMass)} t`,
    );
  };

  const handleInboundSubmit = (params: {
    plan: InboundPlanItem[];
    regNo: string;
    stockCoalType: string;
    stockColor: string;
    density: number;
    totalMass: number;
    note: string;
    needSurveyWarning: boolean;
  }) => {
    if (params.needSurveyWarning) {
      setConfirmReq({
        title: '确认手动入库？',
        okText: '确认增加',
        cancelText: '返回修改',
        content: '此煤场库存数据通过盘煤仪获得并自动更新，确认进行手动维护增加？',
        onOk: () => commitInbound(params),
      });
      return;
    }
    commitInbound(params);
  };

  /* ---------------------------- 操作：出库 ---------------------------- */

  const handleOutboundSubmit = ({
    zoneId,
    mass,
    note,
  }: {
    zoneId: string;
    mass: number;
    note: string;
  }) => {
    const zone = computedZones.find((z) => z.id === zoneId);
    if (!zone) return;
    const result = applyOutbound(zones, zoneId, mass);
    if (result.shortage > 0.01) {
      message.error(`${zone.name} 现存煤量不足，尚缺 ${fmt(result.shortage)} t`);
      return;
    }
    const commit = () => {
    setZones(result.zones);

    const time = nowText();
    const seqOf = new Map(zone.layers.map((l) => [l.id, l.seq]));
    const outboundId = nextLedgerId('OUT');
    setLedger((prev) => ({
      ...prev,
      outbound: [
        {
          id: outboundId,
          yardId,
          ...actorsOf('manual', OPERATOR, time),
          zoneName: zone.name,
          mass,
          note: note || '人工出库',
          mode: 'manual',
        },
        ...prev.outbound,
      ],
      outboundDetails: [
        ...result.cuts.map((cut, index) => ({
          id: `${outboundId}-${index + 1}`,
          recordId: outboundId,
          seq: seqOf.get(cut.layer.id) ?? 0,
          regNo: cut.layer.regNo,
          coalTypeName: cut.layer.regNo ? coalTypeName(cut.layer.coalType) : '待标记',
          volume: cut.volume,
          mass: cut.mass,
          cut: (cut.volume >= cut.layer.volume - 0.01 ? 'all' : 'part') as 'all' | 'part',
        })),
        ...prev.outboundDetails,
      ],
    }));
    setMoves((prev) => [
      ...result.cuts.map((c) => ({
        id: nextRecordId('M'),
        time,
        type: 'out' as const,
        yardId,
        zoneName: zone.name,
        regNo: c.layer.regNo,
        coalTypeName: c.layer.regNo ? coalTypeName(c.layer.coalType) : '待标记',
        volume: c.volume,
        mass: c.mass,
        source: 'manual' as const,
        note: note || '人工出库',
      })),
      ...prev,
    ]);

    setOutboundOpen(false);
    setSelected(null);
    message.success(`已出库 ${fmt(mass)} t`);
    };
    if (yard.autoUpdateByVolume) {
      setConfirmReq({
        title: '确认手动出库？',
        okText: '确认增加',
        cancelText: '返回修改',
        content: '此煤场库存数据通过盘煤仪获得并自动更新，确认进行手动维护增加？',
        onOk: commit,
      });
      return;
    }
    commit();
  };

  /* ---------------------------- 操作：分层拆分 ---------------------------- */

  const handleSplitSubmit = (preview: SplitPreviewRow[]) => {
    if (!selected || !selectedZone || !selectedLayer) return;
    const stackedAt = dayjs().format('YYYY-MM-DD');
    setZones((prev) =>
      applySplit(
        prev,
        selected.zoneId,
        selected.layerId,
        preview,
        selectedLayer.raw.density,
        stackedAt,
      ),
    );
    const splitBefore = `1 层 · ${fmt(selectedLayer.volume)} m³`;
    const splitAfter = `${preview.length} 层 · ${preview.map((p) => fmt(p.volume)).join(' + ')} m³`;
    appendAdjust(
      '拆分',
      selectedZone.name,
      `第 ${selectedLayer.seq} 层 ${fmt(selectedLayer.volume)} m³ 拆为 ${preview.map((row) => fmt(row.volume)).join(' + ')} m³`,
      [
        layerAdjustLine(selectedLayer, selectedZone.name, 'before'),
        ...preview.map((row, index) => layerAdjustLine(selectedLayer, selectedZone.name, 'after', {
          layerId: `${selectedLayer.id}-s${index + 1}`,
          seq: selectedLayer.seq + (preview.length - 1 - index),
          regNo: row.regNo,
          volume: row.volume,
          mass: row.mass,
          volumeRatio: Number((row.ratio * 100).toFixed(2)),
          pitchStart: row.pitchStart,
          pitchEnd: row.pitchEnd,
          heightStart: row.heightStart,
          heightEnd: row.heightEnd,
        })),
      ],
    );
    pushAudit(
      `${yard.shortName} · ${selectedZone.name} · 第 ${selectedLayer.seq} 层`,
      '分层拆分',
      splitBefore,
      splitAfter,
    );
    pushMove({
      type: 'adjust',
      yardId,
      zoneName: selectedZone.name,
      regNo: selectedLayer.raw.regNo,
      coalTypeName: selectedLayer.raw.coalType ? coalTypeName(selectedLayer.raw.coalType) : '待标记',
      volume: selectedLayer.volume,
      mass: selectedLayer.mass,
      source: 'split',
      note: `第 ${selectedLayer.seq} 层拆分为 ${preview.length} 层`,
    });
    setSplitOpen(false);
    setSelected(null);
    message.success(`煤层已拆分为 ${preview.length} 层`);
  };

  /* ---------------------------- 操作：分层合并 ---------------------------- */

  const openMerge = (direction: 'up' | 'down') => {
    setMergeDirection(direction);
    setMergeOpen(true);
  };

  const handleMergeSubmit = () => {
    if (!selected || !selectedZone || !selectedLayer) return;
    const pair = resolveMergePair(selectedZone, selected.layerId, mergeDirection);
    if (!pair) return;
    setZones((prev) => applyMerge(prev, selected.zoneId, selected.layerId, mergeDirection));
    const mergedVolume = pair.keep.volume + pair.absorbed.volume;
    const mergedMass = pair.keep.mass + pair.absorbed.mass;
    const lower = pair.keep.seq < pair.absorbed.seq ? pair.keep : pair.absorbed;
    const upper = lower.id === pair.keep.id ? pair.absorbed : pair.keep;
    appendAdjust(
      mergeDirection === 'up' ? '合并上层' : '合并下层',
      selectedZone.name,
      `第 ${pair.absorbed.seq} 层并入第 ${pair.keep.seq} 层，保留第 ${pair.keep.seq} 层批次归属`,
      [
        layerAdjustLine(pair.keep, selectedZone.name, 'before'),
        layerAdjustLine(pair.absorbed, selectedZone.name, 'before'),
        layerAdjustLine(pair.keep, selectedZone.name, 'after', {
          seq: lower.seq,
          volume: mergedVolume,
          mass: mergedMass,
          density: mergedVolume ? mergedMass / mergedVolume : pair.keep.raw.density,
          pitchStart: lower.bound.pitchBottom,
          pitchEnd: upper.bound.pitchTop,
          heightStart: lower.bound.heightBottom,
          heightEnd: upper.bound.heightTop,
        }),
      ],
    );
    pushAudit(
      `${yard.shortName} · ${selectedZone.name} · 第 ${pair.keep.seq} 层`,
      mergeDirection === 'up' ? '分层合并 · 合并上层' : '分层合并 · 合并下层',
      `第 ${pair.keep.seq} 层 ${fmt(pair.keep.volume)} m³ + 第 ${pair.absorbed.seq} 层 ${fmt(
        pair.absorbed.volume,
      )} m³`,
      `合并为 1 层 ${fmt(pair.keep.volume + pair.absorbed.volume)} m³`,
    );
    pushMove({
      type: 'adjust',
      yardId,
      zoneName: selectedZone.name,
      regNo: pair.keep.raw.regNo,
      coalTypeName: pair.keep.raw.coalType ? coalTypeName(pair.keep.raw.coalType) : '待标记',
      volume: pair.absorbed.volume,
      mass: pair.absorbed.mass,
      source: 'merge',
      note: `第 ${pair.absorbed.seq} 层并入第 ${pair.keep.seq} 层，保留第 ${pair.keep.seq} 层批次归属`,
    });
    setMergeOpen(false);
    setSelected(null);
    message.success('煤层已合并');
  };

  /* ---------------------------- 操作：删除 ---------------------------- */

  const handleDelete = () => {
    if (!selected || !selectedZone || !selectedLayer) return;
    setConfirmReq({
      title: '确认清除煤层？',
      okText: '确认清除',
      cancelText: '取消',
      danger: true,
      content: (
        <div className="cssm-confirm-copy">
          清除表层煤层不会形成出入库记录。
          <div>
            {selectedZone.name} · 第 {selectedLayer.seq} 层（表层）· {fmt(selectedLayer.volume)} m³
            / {fmt(selectedLayer.mass)} t
          </div>
        </div>
      ),
      onOk: () => {
        setZones((prev) => deleteLayer(prev, selected.zoneId, selected.layerId));
        appendAdjust(
          '清除',
          selectedZone.name,
          '表层已清除，未形成出入库记录',
          [layerAdjustLine(selectedLayer, selectedZone.name, 'before')],
        );
        pushAudit(
          `${yard.shortName} · ${selectedZone.name} · 第 ${selectedLayer.seq} 层`,
          '直接删除煤层（不形成出入库记录）',
          `${fmt(selectedLayer.volume)} m³ / ${fmt(selectedLayer.mass)} t`,
          '已删除',
        );
        setSelected(null);
        message.success('表层煤层已清除，未形成出入库记录');
      },
    });
  };

  /* ---------------------------- 操作：标记入厂批次 ---------------------------- */

  const markValuesOf = (layer: ComputedLayer): MarkFormValues => ({
    regNo: layer.raw.regNo || undefined,
    coalType: layer.raw.coalType ? coalTypeName(layer.raw.coalType) : undefined,
    density: Number(layer.raw.density.toFixed(3)),
    zoneIds: [],
    markAll: false,
  });

  const openMark = () => {
    if (!selectedLayer) return;
    const next = markValuesOf(selectedLayer);
    setMarkInitial(next);
    markForm.setFieldsValue(next);
    setMarkOpen(true);
  };

  useEffect(() => {
    if (!markOpen || !selectedLayer) return;
    markForm.setFieldsValue(markValuesOf(selectedLayer));
  }, [markOpen, selected?.zoneId, selected?.layerId]);

  const submitMark = async () => {
    const values = await markForm.validateFields();
    if (markTargets.length === 0) {
      message.warning('没有可标记的未识别煤层');
      return;
    }
    const draft = readMarkStock.current?.() ?? {
      name: String(values.coalType ?? ''),
      color: markColor,
    };
    const assigned = validateStockAssignment(draft.name, draft.color, stockPalette);
    if (!assigned.ok) {
      message.error(assigned.message);
      return;
    }
    const batch = batches.find((item) => item.regNo === values.regNo);
    const coalKey = resolveCoalKey(assigned.name);
    setStockPalette((prev) => upsertStockCoal(prev, assigned.name, assigned.color));
    setBatches((prev) =>
      prev.map((item) =>
        item.regNo === values.regNo
          ? { ...item, coalType: coalKey, stockCoalType: assigned.name }
          : item,
      ),
    );
    const after = `${shortRegNo(values.regNo)} / ${coalTypeName(coalKey)}`;
    const patch = {
      regNo: values.regNo,
      shipName: batch?.shipName ?? '',
      voyage: batch?.voyage ?? '—',
      coalType: coalKey,
      color: assigned.color,
      quality: COAL_TYPES[coalKey]?.quality ?? null,
      density: values.density,
      status: 'marked' as const,
      tint: batch?.tint ?? 0,
      adjusted: true,
    };

    setZones((prev) =>
      paintStockColor(
        markTargets.reduce(
          (next, item) => replaceLayer(next, item.zone.id, item.layer.id, patch),
          prev,
        ),
        assigned.name,
        assigned.color,
      ),
    );

    const marking = markTargets.every((item) => item.layer.raw.status === 'unmarked');
    const zoneNames = [...new Set(markTargets.map((item) => item.zone.name))];
    const meta = COAL_TYPES[coalKey];
    appendAdjust(
      marking ? '标记入厂批次' : '更新煤层',
      zoneNames.join('、'),
      marking
        ? `一次标记 ${markTargets.length} 个煤层，统一关联 ${shortRegNo(values.regNo)}`
        : `第 ${markTargets[0].layer.seq} 层更新入厂批次与煤质`,
      markTargets.flatMap((item) => [
        layerAdjustLine(item.layer, item.zone.name, 'before'),
        layerAdjustLine(item.layer, item.zone.name, 'after', {
          regNo: values.regNo,
          density: values.density,
          ...(meta
            ? {
                coalKind: meta.name,
                cv: meta.quality.cv,
                sulfur: meta.quality.sulfur,
                ash: meta.quality.ash,
                volatile: meta.quality.volatile,
                moisture: meta.quality.moisture,
              }
            : { coalKind: coalTypeName(coalKey) }),
        }),
      ]),
    );
    markTargets.forEach((item) => {
      const before =
        item.layer.raw.status === 'unmarked'
          ? '待标记'
          : `${shortRegNo(item.layer.raw.regNo)} / ${coalTypeName(item.layer.raw.coalType)}`;
      const target = `${yard.shortName} · ${item.zone.name} · 第 ${item.layer.seq} 层`;
      pushMove({
        type: 'adjust',
        yardId,
        zoneName: item.zone.name,
        regNo: values.regNo,
        coalTypeName: coalTypeName(coalKey),
        volume: item.layer.volume,
        mass: item.layer.volume * values.density,
        source: 'mark',
        note: `第 ${item.layer.seq} 层标记入厂批次，煤量按 ${values.density} t/m³ 重算`,
      });
      pushAudit(target, '标记入厂批次', before, after);
    });
    setMarkOpen(false);
    message.success(
      markTargets.length > 1
        ? `已标记 ${markTargets.length} 个未识别煤层`
        : '煤层入厂批次已标记，煤质已按该批次化验值带入',
    );
  };

  /* ---------------------------- 视图数据 ---------------------------- */

  const flatRows: FlatRow[] = useMemo(() => {
    const rows: FlatRow[] = [];
    computedZones.forEach((z) =>
      [...z.layers]
        .reverse()
        .forEach((l) => rows.push({ key: `${z.id}-${l.id}`, zone: z, layer: l })),
    );
    return rows;
  }, [computedZones]);

  const visibleRows = useMemo(() => {
    const text = tableQuery.trim().toLowerCase();
    if (!text) return flatRows;
    return flatRows.filter((row) =>
      [
        row.zone.name,
        row.layer.raw.regNo,
        row.layer.raw.shipName,
        row.layer.raw.voyage,
        coalTypeName(row.layer.raw.coalType),
      ]
        .join(' ')
        .toLowerCase()
        .includes(text),
    );
  }, [flatRows, tableQuery]);

  const detailColumns: ColumnsType<FlatRow> = [
    { title: '分区', key: 'zone', width: 66, fixed: 'left', render: (_, r) => r.zone.name },
    {
      title: '层序',
      key: 'seq',
      width: 92,
      render: (_, r) => (
        <span className="cssm-num">
          第 {r.layer.seq} 层{r.layer.seq === r.zone.layers.length ? '（表层）' : ''}
        </span>
      ),
    },
    {
      title: '状态',
      key: 'status',
      width: 84,
      render: (_, r) =>
        r.layer.raw.status === 'unmarked' ? (
          <Tag color="red" style={{ marginInlineEnd: 0 }}>
            待标记
          </Tag>
        ) : (
          <Tag color="blue" style={{ marginInlineEnd: 0 }}>
            已标记
          </Tag>
        ),
    },
    {
      title: '入厂登记编号',
      key: 'reg',
      width: 246,
      render: (_, r) => r.layer.raw.regNo || '—',
    },
    { title: '船名', key: 'ship', width: 148, render: (_, r) => r.layer.raw.shipName || '—' },
    { title: '航次', key: 'voyage', width: 72, render: (_, r) => r.layer.raw.voyage || '—' },
    {
      title: '库存煤种',
      key: 'coalType',
      width: 100,
      render: (_, r) => (r.layer.raw.coalType ? coalTypeName(r.layer.raw.coalType) : '—'),
    },
    {
      title: '体积 m³',
      key: 'volume',
      width: 96,
      align: 'right',
      render: (_, r) => <span className="cssm-num">{fmt(r.layer.volume)}</span>,
    },
    {
      title: '煤量 t',
      key: 'mass',
      width: 96,
      align: 'right',
      render: (_, r) => <span className="cssm-num">{fmt(r.layer.mass)}</span>,
    },
    {
      title: '密度 t/m³',
      key: 'density',
      width: 92,
      align: 'right',
      render: (_, r) => <span className="cssm-num">{r.layer.raw.density.toFixed(3)}</span>,
    },
    {
      title: '层厚 m',
      key: 'thickness',
      width: 88,
      align: 'right',
      render: (_, r) => <span className="cssm-num">{r.layer.thickness.toFixed(2)}</span>,
    },
    {
      title: '标高区间 m',
      key: 'height',
      width: 128,
      align: 'right',
      render: (_, r) => (
        <span className="cssm-num">
          {r.layer.bound.heightBottom.toFixed(2)} ~ {r.layer.bound.heightTop.toFixed(2)}
        </span>
      ),
    },
    {
      title: '起始 / 结束角度',
      key: 'pitch',
      width: 142,
      align: 'right',
      render: (_, r) => (
        <span className="cssm-num">
          {r.layer.bound.pitchBottom.toFixed(2)}° ~ {r.layer.bound.pitchTop.toFixed(2)}°
        </span>
      ),
    },
    {
      title: '热值 kcal/kg',
      key: 'cv',
      width: 112,
      align: 'right',
      render: (_, r) => (
        <span className="cssm-num">{r.layer.raw.quality ? fmt(r.layer.raw.quality.cv) : '—'}</span>
      ),
    },
    {
      title: '硫分 %',
      key: 'sulfur',
      width: 82,
      align: 'right',
      render: (_, r) => (
        <span className="cssm-num">
          {r.layer.raw.quality ? r.layer.raw.quality.sulfur.toFixed(2) : '—'}
        </span>
      ),
    },
    {
      title: '灰分 %',
      key: 'ash',
      width: 82,
      align: 'right',
      render: (_, r) => (
        <span className="cssm-num">
          {r.layer.raw.quality ? r.layer.raw.quality.ash.toFixed(1) : '—'}
        </span>
      ),
    },
    {
      title: '挥发分 %',
      key: 'volatile',
      width: 92,
      align: 'right',
      render: (_, r) => (
        <span className="cssm-num">
          {r.layer.raw.quality ? r.layer.raw.quality.volatile.toFixed(1) : '—'}
        </span>
      ),
    },
    {
      title: '水分 %',
      key: 'moisture',
      width: 82,
      align: 'right',
      render: (_, r) => (
        <span className="cssm-num">
          {r.layer.raw.quality ? r.layer.raw.quality.moisture.toFixed(1) : '—'}
        </span>
      ),
    },
  ].filter((column) => yard.hasSurvey || !['thickness', 'height', 'pitch'].includes(String(column.key)));

  /* ---------------------------- 渲染 ---------------------------- */

  return (
    <div className="cssm-root is-bench">
      <header className="cssm-head">
        <div className="cssm-head-row">
          <span className="cssm-meta">煤场</span>
          <Select
            style={{ width: 220 }}
            value={yard.id}
            onChange={changeYard}
            options={enabledYards().map((item) => ({
              value: item.id,
              label: item.shortName,
            }))}
          />
        </div>
        <div className="cssm-stats">
          <div className="cssm-stat">
            <span className="cssm-stat-k">存煤量</span>
            <span className="cssm-stat-v cssm-num">
              {fmt(totals.totalMass)}
              <em>t</em>
            </span>
          </div>
          <button
            type="button"
            className="cssm-stat is-action"
            disabled={totals.unmarkedLayers === 0}
            onClick={locateUnmarked}
          >
            <span className="cssm-stat-k">待人工标记</span>
            <span className={`cssm-stat-v cssm-num${totals.unmarkedLayers > 0 ? ' is-flare' : ''}`}>
              {totals.unmarkedLayers}
              <em>层</em>
            </span>
          </button>
        </div>
        <div className="cssm-head-actions">
        <Space size={8}>
          {CAN_MAINTAIN_DEFAULT_DENSITY && (
            <Tooltip title="配置信息">
              <Button
                type="text"
                icon={<SettingOutlined />}
                aria-label="配置信息"
                onClick={openDensity}
              />
            </Tooltip>
          )}
          {yard.autoUpdateByVolume && <Tag color="cyan">按盘煤体积自动更新</Tag>}
        </Space>
        </div>
      </header>

      <div className="cssm-main">
        <section className="cssm-panel">
          <div className="cssm-panel-hd">
            <h2>
              <em>存煤结构</em>
              {yard.shortName}
            </h2>
            <Space size={8} wrap={false}>
              <Button type="primary" icon={<ImportOutlined />} onClick={() => setInboundOpen(true)}>
                入库
              </Button>
              <Button icon={<ExportOutlined />} onClick={() => setOutboundOpen(true)}>
                出库
              </Button>
              <Segmented
                size="small"
                value={viewMode}
                onChange={(v) => setViewMode(v as ViewMode)}
                options={[
                  ...(yard.hasSurvey
                    ? [{ label: '实际堆煤视图', value: 'stack', icon: <AppstoreOutlined /> }]
                    : []),
                  { label: '分层视图', value: 'matrix', icon: <ProfileOutlined /> },
                  { label: '分层数据', value: 'table', icon: <TableOutlined /> },
                ]}
              />
            </Space>
          </div>

          <div className="cssm-fieldbar">
            <span className="cssm-fieldbar-label">存煤视图展示信息</span>
            <Radio.Group
              size="small"
              optionType="button"
              buttonStyle="solid"
              value={labelKey}
              onChange={(e) => setLabelKey(e.target.value)}
              options={LABEL_FIELDS.filter(
                (field) => yard.hasSurvey || (field.key !== 'pitchStart' && field.key !== 'heightStart'),
              ).map((f) => ({ label: f.label, value: f.key }))}
            />
          </div>

          <div className="cssm-legend">
            <span className="cssm-fieldbar-label">颜色 = 库存煤种</span>
            {legendTypes.map((t) => (
              <span key={t.key} className="cssm-legend-group">
                <i className="cssm-legend-swatch" style={{ background: t.color }} />
                {t.name}
              </span>
            ))}
            <span className="cssm-legend-group">
              <i
                className="cssm-legend-swatch"
                style={{
                  background: UNMARKED_COLOR,
                  backgroundImage:
                    'repeating-linear-gradient(0deg, rgba(255,255,255,.45) 0 2px, transparent 2px 4px)',
                }}
              />
              待标记（异常）
            </span>
          </div>

          <div
            ref={stageRef}
            className={`cssm-stage${viewMode === 'table' ? ' is-table' : ''}`}
          >
          {viewMode === 'stack' && (
            <div className="cssm-stack-view">
              <StackHeatmap
                zones={computedZones}
                labelOf={compactLabelOf}
                tipOf={fullLabelOf}
                selectedLayerId={selected?.layerId ?? null}
                onSelect={(zoneId, layerId) => setSelected({ zoneId, layerId })}
              />
            </div>
          )}

          {viewMode === 'matrix' && (
            <LayerMatrix
              zones={computedZones}
              spatial={yard.hasSurvey}
              labelOf={fullLabelOf}
              tipOf={fullLabelOf}
              selectedLayerId={selected?.layerId ?? null}
              onSelect={(zoneId, layerId) => setSelected({ zoneId, layerId })}
            />
          )}

          {viewMode === 'table' && (
            <div className="cssm-table-view">
              <Input.Search
                allowClear
                placeholder="入厂登记编号、车船号、航次、库存煤种"
                style={{ width: 360, marginBottom: 10 }}
                onChange={(event) => setTableQuery(event.target.value)}
              />
              <Table<FlatRow>
                rowKey="key"
                size="small"
                columns={detailColumns}
                dataSource={visibleRows}
                pagination={{ pageSize: 15, showSizeChanger: false, showTotal: (t) => `共 ${t} 层` }}
                scroll={{ x: 2000, y: Math.max(160, stageHeight - 148) }}
                rowClassName={(r) =>
                  r.layer.id === selected?.layerId ? 'ant-table-row-selected' : ''
                }
                onRow={(r) => ({
                  style: { cursor: 'pointer' },
                  onClick: () => setSelected({ zoneId: r.zone.id, layerId: r.layer.id }),
                })}
              />
            </div>
          )}
          </div>
        </section>

        <LayerInspector
          yardName={yard.shortName}
          spatial={yard.hasSurvey}
          zone={selectedZone}
          layer={selectedLayer}
          unmarkedLayers={totals.unmarkedLayers}
          onMark={openMark}
          onSplit={() => setSplitOpen(true)}
          onMerge={openMerge}
          onDelete={handleDelete}
          onLocateUnmarked={locateUnmarked}
        />
      </div>

      <LedgerPanel
        ledger={ledger}
        yardId={yardId}
        tab={ledgerTab}
        onTabChange={setLedgerTab}
      />

      <Drawer
        title="配置信息"
        open={densityOpen}
        onClose={() => setDensityOpen(false)}
        size={480}
        destroyOnHidden
        footer={
          <div className="cssm-drawer-foot">
            <Button onClick={() => setDensityOpen(false)}>取消</Button>
            <Button type="primary" onClick={saveDensity}>
              保存
            </Button>
          </div>
        }
      >
        <Form
          className="cssm-config-form"
          form={densityForm}
          layout="vertical"
          requiredMark={false}
          initialValues={densityDraft}
          preserve={false}
        >
          <Form.Item
            label="密度"
            name="density"
            rules={[
              { required: true, message: '请输入密度' },
              {
                validator: (_, value: number | null) => {
                  if (value == null) return Promise.resolve();
                  if (value < 0.8 || value > 1.2) {
                    return Promise.reject(new Error('密度须在 0.8～1.2 之间'));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <InputNumber
              min={0.8}
              max={1.2}
              step={0.001}
              precision={3}
              suffix="t/m³"
              style={{ width: '100%' }}
            />
          </Form.Item>
          {yard.hasSurvey && (
            <Form.Item
              label="自动根据体积更新库存"
              name="autoUpdateByVolume"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          )}
          <Form.Item
            label="体积变动有效阈值"
            name="volumeLimit"
            extra="分区盘煤体积变动超出此阈值的，才认为分区存煤量发生了变动，用以规避盘煤精度不足导致的体积变动频繁更新库存煤量，生成过多的无效的出入库记录数据。"
            rules={[
              { required: true, message: '请输入体积变动有效阈值' },
              {
                validator: (_, value: number | null) => {
                  const numberValue = Number(value);
                  if (value == null || !Number.isInteger(numberValue) || numberValue < 1) {
                    return Promise.reject(new Error('请输入正整数'));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <InputNumber min={1} step={1} precision={0} suffix="m³" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Drawer>

      <InboundDrawer
        open={inboundOpen}
        yard={yard}
        zones={computedZones}
        rawZones={zones}
        batches={batches}
        stockCoals={stockPalette}
        defaultDensity={density}
        onClose={() => setInboundOpen(false)}
        onSubmit={handleInboundSubmit}
      />

      <OutboundDrawer
        open={outboundOpen}
        yard={yard}
        zones={computedZones}
        presetZoneId={selected?.zoneId ?? null}
        onClose={() => setOutboundOpen(false)}
        onSubmit={handleOutboundSubmit}
      />

      <SplitLayerDrawer
        open={splitOpen}
        spatial={yard.hasSurvey}
        zone={selectedZone}
        layer={selectedLayer}
        onClose={() => setSplitOpen(false)}
        onSubmit={handleSplitSubmit}
      />

      <MergeLayerDrawer
        open={mergeOpen}
        spatial={yard.hasSurvey}
        zone={selectedZone}
        layerId={selected?.layerId ?? null}
        direction={mergeDirection}
        onClose={() => setMergeOpen(false)}
        onSubmit={handleMergeSubmit}
      />

      <Drawer
        title={selectedLayer?.raw.status === 'unmarked' ? '标记入厂批次' : '更改入厂批次与煤质'}
        open={markOpen}
        onClose={() => {
          setMarkOpen(false);
          setBatchPickerOpen(false);
        }}
        size={520}
        destroyOnHidden
        footer={
          <div className="cssm-drawer-foot">
            <Button
              onClick={() => {
                setMarkOpen(false);
                setBatchPickerOpen(false);
              }}
            >
              取消
            </Button>
            <Button type="primary" onClick={submitMark}>
              保存
            </Button>
          </div>
        }
      >
        <Form
          form={markForm}
          layout="vertical"
          requiredMark={false}
          initialValues={{ zoneIds: [], markAll: false, ...markInitial }}
        >
          {selectedLayer?.raw.status === 'unmarked' && (
            <>
              <Form.Item label="按分区批量标记" name="zoneIds">
                <Select
                  mode="multiple"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  disabled={watchedMarkAll}
                  placeholder={watchedMarkAll ? '已包含本煤场全部未识别煤层' : '选择要同时标记的分区'}
                  options={computedZones
                    .filter((zone) => zone.unmarkedCount > 0)
                    .map((zone) => ({
                      value: zone.id,
                      label: `${zone.name}（${zone.unmarkedCount} 层）`,
                    }))}
                />
              </Form.Item>
              <Form.Item name="markAll" valuePropName="checked" style={{ marginBottom: 8 }}>
                <Checkbox
                  onChange={(event) => {
                    if (event.target.checked) markForm.setFieldValue('zoneIds', []);
                  }}
                >
                  全部
                </Checkbox>
              </Form.Item>
              <p className="cssm-hint" style={{ marginTop: 0 }}>
                {watchedMarkAll
                  ? `将一次性标记本煤场全部 ${markTargets.length} 个未识别煤层`
                  : watchedZoneIds.length > 0
                    ? `将同时标记所选分区中的 ${markTargets.length} 个未识别煤层`
                    : '未选择分区时，只标记当前煤层'}
              </p>
            </>
          )}
          <Form.Item name="regNo" hidden rules={[{ required: true, message: '请选择来煤预报' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="入厂登记编号" required style={{ maxWidth: 320 }}>
            <Input
              readOnly
              className="cssm-reg-input"
              value={watchedReg}
              placeholder="选择来煤预报"
              onClick={() => setBatchPickerOpen(true)}
            />
          </Form.Item>
          <Form.Item name="coalType" rules={[{ required: true, message: '请选择或输入库存煤种' }]}>
            <StockCoalField
              coals={stockPalette}
              resetKey={selectedLayer?.id ?? ''}
              color={markColor}
              onColorChange={setMarkColor}
              readerRef={readMarkStock}
            />
          </Form.Item>
          <Form.Item
            label="计算密度"
            name="density"
            rules={[{ required: true, message: '请输入计算密度' }]}
          >
            <InputNumber
              min={0.8}
              max={1.2}
              step={0.001}
              precision={3}
              suffix="t/m³"
              style={{ width: '100%' }}
            />
          </Form.Item>
          {selectedLayer && !watchedMarkAll && watchedZoneIds.length === 0 && (
            <div className="cssm-ins-grid">
              <div className="cssm-ins-cell">
                <div className="cssm-ins-k">体积</div>
                <div className="cssm-ins-v cssm-num">{fmt(selectedLayer.volume)} m³</div>
              </div>
              <div className="cssm-ins-cell">
                <div className="cssm-ins-k">煤量</div>
                <div className="cssm-ins-v cssm-num">
                  {fmt(selectedLayer.volume * Number(watchedDensity || selectedLayer.raw.density))} t
                </div>
              </div>
              <div className="cssm-ins-cell">
                <div className="cssm-ins-k">车船号</div>
                <div className="cssm-ins-v">{batches.find((item) => item.regNo === watchedReg)?.shipName || '—'}</div>
              </div>
              <div className="cssm-ins-cell">
                <div className="cssm-ins-k">航次</div>
                <div className="cssm-ins-v">{batches.find((item) => item.regNo === watchedReg)?.voyage || '—'}</div>
              </div>
              <div className="cssm-ins-cell">
                <div className="cssm-ins-k">热值</div>
                <div className="cssm-ins-v cssm-num">
                  {(() => {
                    const coal = Object.values(COAL_TYPES).find((meta) => meta.name === watchedCoal);
                    return coal ? `${fmt(coal.quality.cv)} kcal/kg` : '—';
                  })()}
                </div>
              </div>
              {yard.hasSurvey && (
                <>
                  <div className="cssm-ins-cell">
                    <div className="cssm-ins-k">起始角度</div>
                    <div className="cssm-ins-v cssm-num">{selectedLayer.bound.pitchBottom.toFixed(2)}°</div>
                  </div>
                  <div className="cssm-ins-cell">
                    <div className="cssm-ins-k">起始高度</div>
                    <div className="cssm-ins-v cssm-num">{selectedLayer.bound.heightBottom.toFixed(2)} m</div>
                  </div>
                </>
              )}
              <div className="cssm-ins-cell">
                <div className="cssm-ins-k">煤场</div>
                <div className="cssm-ins-v">{yard.shortName}</div>
              </div>
              <div className="cssm-ins-cell">
                <div className="cssm-ins-k">分区</div>
                <div className="cssm-ins-v">{selectedZone?.name ?? '—'}</div>
              </div>
              <div className="cssm-ins-cell">
                <div className="cssm-ins-k">层数</div>
                <div className="cssm-ins-v">第 {selectedLayer.seq} 层</div>
              </div>
            </div>
          )}
        </Form>
      </Drawer>
      <BatchPickerModal
        open={batchPickerOpen}
        batches={[...batches].sort((a, b) => b.unloadedAt.localeCompare(a.unloadedAt))}
        onClose={() => setBatchPickerOpen(false)}
        onPick={(batch) => {
          markForm.setFieldsValue({
            regNo: batch.regNo,
            coalType: coalTypeName(batch.coalType),
          });
          setBatchPickerOpen(false);
        }}
      />

      <Drawer
        title={confirmReq?.title}
        open={Boolean(confirmReq)}
        onClose={() => setConfirmReq(null)}
        size={420}
        zIndex={2300}
        push={false}
        destroyOnHidden
        footer={
          <div className="cssm-drawer-foot">
            <Button onClick={() => setConfirmReq(null)}>{confirmReq?.cancelText ?? '取消'}</Button>
            <Button
              type="primary"
              danger={confirmReq?.danger}
              onClick={() => {
                const action = confirmReq?.onOk;
                setConfirmReq(null);
                action?.();
              }}
            >
              {confirmReq?.okText ?? '确认'}
            </Button>
          </div>
        }
      >
        {typeof confirmReq?.content === 'string' ? (
          <p className="cssm-confirm-copy">{confirmReq.content}</p>
        ) : (
          confirmReq?.content
        )}
      </Drawer>

    </div>
  );
};

const Component: React.FC = () => (
  <ConfigProvider
    locale={zhCN}
    theme={{
      token: {
        colorPrimary: '#1677ff',
        borderRadius: 6,
        fontFamily: '"PingFang SC", "Microsoft YaHei", "Segoe UI", system-ui, sans-serif',
      },
    }}
  >
    <App>
      <ComponentInner />
    </App>
  </ConfigProvider>
);

export default Component;
