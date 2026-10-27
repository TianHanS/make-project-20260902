/**
 * @name 上煤单管理
 *
 * 参考资料：
 * - /rules/design-guide.md
 * - /rules/development-standards.md
 * - /assets/templates/spec-template.md
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  ConfigProvider,
  DatePicker,
  Drawer,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
} from 'antd';
import { CheckOutlined, EyeOutlined, FilterOutlined, SearchOutlined } from '@ant-design/icons';
import zhCN from 'antd/locale/zh_CN';
import dayjs, { Dayjs } from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import './style.css';

const { RangePicker } = DatePicker;

type BillStatus = 'unconfirmed' | 'confirmed';
type DrawerMode = 'view' | 'confirm';

interface LoadingDetail {
  id: string;
  yard: string;
  zone: string;
  unit: string;
  bunker: string;
  amount: number;
}

interface InboundBatch {
  regNo: string;
  vehicleNo: string;
  stockCoal: string;
  variety: string;
  coalKind: string;
}

interface BatchAllocation {
  regNo: string;
  amount: number;
}

interface YardUnrecognized {
  yard: string;
  amount: number;
}

interface LoadingBill {
  id: string;
  feedDate: string;
  loadingTime: string;
  shiftName: string;
  shiftCode: string;
  batchNo: string;
  totalAmount: number;
  status: BillStatus;
  confirmer: string;
  confirmTime: string;
  shiftEndTime: string;
  shiftEnded: boolean;
  aggregatedAt: string;
  manualAdjusted: boolean;
  details: LoadingDetail[];
  allocations: BatchAllocation[];
  baselineAllocations: BatchAllocation[];
  unrecognizedByYard: YardUnrecognized[];
}

const SHIFT_META: Record<string, { name: string; code: string }> = {
  A: { name: '早班', code: 'A' },
  B: { name: '中班', code: 'B' },
  C: { name: '夜班', code: 'C' },
};

const round2 = (value: number) => Math.round(value * 100) / 100;

const getBatchNo = (dateStr: string, shift: string) =>
  `${dayjs(dateStr).format('YYYYMMDD')}-${shift}`;

const sortDetails = (list: LoadingDetail[]) =>
  [...list].sort(
    (a, b) =>
      a.yard.localeCompare(b.yard, 'zh-CN') ||
      a.zone.localeCompare(b.zone, 'zh-CN') ||
      a.unit.localeCompare(b.unit, 'zh-CN') ||
      a.bunker.localeCompare(b.bunker, 'zh-CN'),
  );

const MOCK_UNITS = ['1号机组', '2号机组'];
const MOCK_BUNKERS = ['A仓', 'B仓', 'C仓', 'D仓', 'E仓', 'F仓'];

const INBOUND_BATCHES: InboundBatch[] = [
  {
    regNo: 'gxsz-2026-054RCDJ2026061201',
    vehicleNo: '华江18',
    stockCoal: '神混1号',
    variety: '烟煤',
    coalKind: '神混1号',
  },
  {
    regNo: 'gxsz-2026-054RCDJ2026062801',
    vehicleNo: '宝和09',
    stockCoal: '印尼褐煤',
    variety: '褐煤',
    coalKind: '印尼褐煤',
  },
  {
    regNo: 'gxsz-2026-054RCDJ2026070902',
    vehicleNo: '7041次',
    stockCoal: '准格尔煤',
    variety: '烟煤',
    coalKind: '准格尔煤',
  },
  {
    regNo: 'gxsz-2026-054RCDJ2026071503',
    vehicleNo: '海丰06',
    stockCoal: '神混2号',
    variety: '烟煤',
    coalKind: '神混2号',
  },
  {
    regNo: 'gxsz-2026-054RCDJ2026072201',
    vehicleNo: '华江21',
    stockCoal: '澳洲动力煤',
    variety: '烟煤',
    coalKind: '澳洲动力煤',
  },
  {
    regNo: 'gxsz-2026-054RCDJ2026080104',
    vehicleNo: '宝和12',
    stockCoal: '印尼煤',
    variety: '褐煤',
    coalKind: '印尼煤',
  },
  {
    regNo: 'gxsz-2026-054RCDJ2026081802',
    vehicleNo: '7058次',
    stockCoal: '大同优混',
    variety: '烟煤',
    coalKind: '大同优混',
  },
];

const SHIFT_STAT_BATCHES = INBOUND_BATCHES.slice(0, 3);

const batchOf = (regNo: string) => INBOUND_BATCHES.find((item) => item.regNo === regNo);

const ZONE_PRESETS: { yard: string; zone: string }[] = [
  { yard: '1号煤场', zone: '东一区' },
  { yard: '1号煤场', zone: '东二区' },
  { yard: '1号煤场', zone: '南一区' },
  { yard: '2号煤场', zone: '西一区' },
  { yard: '2号煤场', zone: '西二区' },
  { yard: '3号煤场', zone: '北一区' },
];

const normalizeAllocations = (list: BatchAllocation[]): BatchAllocation[] => {
  const grouped = new Map<string, number>();
  list.forEach((item) => {
    const key = item.regNo || '';
    grouped.set(key, round2((grouped.get(key) || 0) + item.amount));
  });
  const rows: BatchAllocation[] = [];
  grouped.forEach((amount, regNo) => {
    if (!regNo) return;
    if (amount <= 0.009) return;
    rows.push({ regNo, amount: round2(amount) });
  });
  rows.sort((a, b) => b.amount - a.amount || a.regNo.localeCompare(b.regNo));
  const unmarked = round2(grouped.get('') || 0);
  rows.push({ regNo: '', amount: unmarked > 0.009 ? unmarked : 0 });
  return rows;
};

const allocationSignature = (list: BatchAllocation[]) =>
  normalizeAllocations(list)
    .map((item) => `${item.regNo}:${item.amount.toFixed(2)}`)
    .join('|');

const sumAmount = (list: BatchAllocation[]) => round2(list.reduce((sum, item) => sum + item.amount, 0));

const foldUnmarked = (list: BatchAllocation[]): BatchAllocation[] => {
  const normalized = normalizeAllocations(list);
  const unmarked = normalized.find((item) => !item.regNo)?.amount ?? 0;
  const marked = normalized.filter((item) => item.regNo);
  if (unmarked <= 0.009) return normalizeAllocations(marked);
  if (marked.length === 0) {
    return normalizeAllocations([{ regNo: INBOUND_BATCHES[0].regNo, amount: unmarked }]);
  }
  const base = marked.reduce((sum, item) => sum + item.amount, 0);
  let used = 0;
  const next = marked.map((item, index) => {
    if (index === marked.length - 1) {
      return { regNo: item.regNo, amount: round2(item.amount + (unmarked - used)) };
    }
    const share = round2((unmarked * item.amount) / base);
    used = round2(used + share);
    return { regNo: item.regNo, amount: round2(item.amount + share) };
  });
  return normalizeAllocations(next);
};

const buildMockPack = (prefix: string, zones: { yard: string; zone: string }[], amountOffset = 0) => {
  const details: LoadingDetail[] = [];
  const allocations: BatchAllocation[] = [];
  const yardUnmarked = new Map<string, number>();
  let idx = 0;
  for (const { yard, zone } of zones) {
    for (const unit of MOCK_UNITS) {
      for (const bunker of MOCK_BUNKERS) {
        const seed = idx * 13 + bunker.charCodeAt(0) + amountOffset;
        const amount = 72 + (seed % 108);
        const id = `${prefix}-${String(idx).padStart(3, '0')}`;
        const markedShare = bunker === 'A仓' || bunker === 'B仓' ? 1 : idx % 4 === 0 ? 0 : idx % 3 === 0 ? 0.55 : 0.84;
        const marked = round2(amount * markedShare);
        const unmarked = round2(amount - marked);
        const batch = SHIFT_STAT_BATCHES[idx % SHIFT_STAT_BATCHES.length];
        details.push({ id, yard, zone, unit, bunker, amount });
        if (marked > 0) allocations.push({ regNo: batch.regNo, amount: marked });
        if (unmarked > 0) {
          allocations.push({ regNo: '', amount: unmarked });
          yardUnmarked.set(yard, round2((yardUnmarked.get(yard) || 0) + unmarked));
        }
        idx += 1;
      }
    }
  }
  const unrecognizedByYard = [...yardUnmarked.entries()]
    .map(([yard, amount]) => ({ yard, amount: round2(amount) }))
    .filter((item) => item.amount > 0.009)
    .sort((a, b) => a.yard.localeCompare(b.yard, 'zh-CN'));
  return { details: sortDetails(details), allocations: normalizeAllocations(allocations), unrecognizedByYard };
};

const calcTotal = (details: LoadingDetail[]) => round2(details.reduce((sum, item) => sum + item.amount, 0));

const today = dayjs().format('YYYY-MM-DD');
const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
const twoDaysAgo = dayjs().subtract(2, 'day').format('YYYY-MM-DD');

const lb1Pack = buildMockPack('LB1', ZONE_PRESETS.slice(0, 5), 0);
const lb2Pack = buildMockPack('LB2', ZONE_PRESETS.slice(1, 6), 7);
const lb3Pack = buildMockPack('LB3', ZONE_PRESETS.slice(0, 4), 14);
const lb4Pack = buildMockPack('LB4', ZONE_PRESETS, 21);

const initialBills: LoadingBill[] = [
  {
    id: 'LB1',
    feedDate: today,
    loadingTime: `${today} 08:00:00`,
    shiftName: SHIFT_META.A.name,
    shiftCode: 'A',
    batchNo: getBatchNo(today, 'A'),
    totalAmount: calcTotal(lb1Pack.details),
    status: 'confirmed',
    confirmer: '张工',
    confirmTime: dayjs().subtract(2, 'hour').format('YYYY-MM-DD HH:mm:ss'),
    shiftEndTime: `${today} 15:59:59`,
    shiftEnded: true,
    aggregatedAt: `${today} 15:50:00`,
    manualAdjusted: true,
    details: lb1Pack.details,
    allocations: foldUnmarked(lb1Pack.allocations),
    baselineAllocations: foldUnmarked(lb1Pack.allocations),
    unrecognizedByYard: [],
  },
  {
    id: 'LB2',
    feedDate: today,
    loadingTime: `${today} 16:00:00`,
    shiftName: SHIFT_META.B.name,
    shiftCode: 'B',
    batchNo: getBatchNo(today, 'B'),
    totalAmount: calcTotal(lb2Pack.details),
    status: 'unconfirmed',
    confirmer: '',
    confirmTime: '',
    shiftEndTime: `${today} 23:59:59`,
    shiftEnded: false,
    aggregatedAt: dayjs().subtract(8, 'minute').format('YYYY-MM-DD HH:mm:ss'),
    manualAdjusted: false,
    details: lb2Pack.details,
    allocations: lb2Pack.allocations,
    baselineAllocations: lb2Pack.allocations,
    unrecognizedByYard: lb2Pack.unrecognizedByYard,
  },
  {
    id: 'LB3',
    feedDate: yesterday,
    loadingTime: `${yesterday} 00:00:00`,
    shiftName: SHIFT_META.C.name,
    shiftCode: 'C',
    batchNo: getBatchNo(yesterday, 'C'),
    totalAmount: calcTotal(lb3Pack.details),
    status: 'unconfirmed',
    confirmer: '',
    confirmTime: '',
    shiftEndTime: `${today} 07:59:59`,
    shiftEnded: true,
    aggregatedAt: `${today} 07:50:00`,
    manualAdjusted: false,
    details: lb3Pack.details,
    allocations: lb3Pack.allocations,
    baselineAllocations: lb3Pack.allocations,
    unrecognizedByYard: lb3Pack.unrecognizedByYard,
  },
  {
    id: 'LB4',
    feedDate: twoDaysAgo,
    loadingTime: `${twoDaysAgo} 16:00:00`,
    shiftName: SHIFT_META.B.name,
    shiftCode: 'B',
    batchNo: getBatchNo(twoDaysAgo, 'B'),
    totalAmount: calcTotal(lb4Pack.details),
    status: 'confirmed',
    confirmer: '李工',
    confirmTime: `${twoDaysAgo} 23:50:00`,
    shiftEndTime: `${twoDaysAgo} 23:59:59`,
    shiftEnded: true,
    aggregatedAt: `${twoDaysAgo} 23:40:00`,
    manualAdjusted: true,
    details: lb4Pack.details,
    allocations: foldUnmarked(lb4Pack.allocations),
    baselineAllocations: foldUnmarked(lb4Pack.allocations),
    unrecognizedByYard: [],
  },
];

const CONFIRM_HINT = '是否确认，确认后，上煤单将自动上传 MIS，对应班次上煤明细将禁止再次维护！';
const RESTORE_HINT = '根据出库明细重新统计数据，还原后，现有人工调整结果会被清除，确认还原？';
const UNRECOGNIZED_BLOCK_NOTE = '存在未分配的煤量，请先分配至对应入厂批次';

const unmarkedAmount = (list: BatchAllocation[]) =>
  normalizeAllocations(list).find((item) => !item.regNo)?.amount ?? 0;

interface BatchRow {
  key: string;
  regNo: string;
  vehicleNo: string;
  stockCoal: string;
  variety: string;
  coalKind: string;
  amount: number;
  ratio: number;
  unmarked: boolean;
}

const toBatchRows = (allocations: BatchAllocation[], total: number): BatchRow[] =>
  normalizeAllocations(allocations).map((item) => {
    const batch = item.regNo ? batchOf(item.regNo) : undefined;
    return {
      key: item.regNo || 'unmarked',
      regNo: item.regNo,
      vehicleNo: batch?.vehicleNo || '',
      stockCoal: batch?.stockCoal || '',
      variety: batch?.variety || '',
      coalKind: batch?.coalKind || '',
      amount: item.amount,
      ratio: total > 0 ? (item.amount / total) * 100 : 0,
      unmarked: !item.regNo,
    };
  });

const detailColumns: ColumnsType<LoadingDetail> = [
  {
    title: '序号',
    width: 64,
    align: 'center',
    render: (_v, _r, index) => index + 1,
  },
  { title: '机组', dataIndex: 'unit', width: 110 },
  { title: '煤仓', dataIndex: 'bunker', width: 90 },
  { title: '煤场', dataIndex: 'yard', width: 120 },
  { title: '分区', dataIndex: 'zone', width: 110 },
  { title: '煤种', width: 100, render: () => '' },
  { title: 'SAP煤种', width: 110, render: () => '' },
  {
    title: '实际上煤量(t)',
    dataIndex: 'amount',
    width: 130,
    align: 'right',
    render: (value: number) => value.toFixed(2),
  },
];

const batchOptionLabel = (batch: InboundBatch) => `${batch.regNo} / ${batch.vehicleNo} / ${batch.stockCoal}`;

const FieldLabel = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <div className="clbm-field-label">
    {required && <span className="clbm-req">*</span>}
    {children}
  </div>
);

const MoreBatchDrawer = ({
  open,
  value,
  excludeRegNos,
  onClose,
  onConfirm,
}: {
  open: boolean;
  value?: string;
  excludeRegNos: string[];
  onClose: () => void;
  onConfirm: (regNo: string) => void;
}) => {
  const { message } = App.useApp();
  const [keyword, setKeyword] = useState('');
  const [pending, setPending] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setPending(value);
    setKeyword('');
  }, [open, value]);

  const catalog = INBOUND_BATCHES.filter((item) => !excludeRegNos.includes(item.regNo)).filter((item) => {
    const text = `${item.regNo}${item.vehicleNo}${item.stockCoal}`.toLowerCase();
    return text.includes(keyword.trim().toLowerCase());
  });

  const confirmMore = () => {
    if (!pending) {
      message.warning('请选择入厂登记编号');
      return;
    }
    onConfirm(pending);
  };

  return (
    <Drawer
      title="更多批次"
      open={open}
      width={760}
      zIndex={1600}
      onClose={onClose}
      destroyOnHidden
      extra={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" onClick={confirmMore}>
            确定
          </Button>
        </Space>
      }
    >
      <div className="clbm-more-panel">
        <Input
          allowClear
          value={keyword}
          placeholder="入厂登记编号 / 车船号 / 库存煤种"
          onChange={(event) => setKeyword(event.target.value)}
        />
        <Table<InboundBatch>
          className="clbm-detail-table"
          size="small"
          rowKey="regNo"
          pagination={false}
          scroll={{ y: 420 }}
          dataSource={catalog}
          rowSelection={{
            type: 'radio',
            selectedRowKeys: pending ? [pending] : [],
            onChange: (keys) => setPending(keys[0] ? String(keys[0]) : undefined),
          }}
          onRow={(record) => ({ onClick: () => setPending(record.regNo) })}
          columns={[
            { title: '入厂登记编号', dataIndex: 'regNo', width: 250 },
            { title: '车船号', dataIndex: 'vehicleNo', width: 100 },
            { title: '库存煤种', dataIndex: 'stockCoal', width: 120 },
            { title: '煤品种', dataIndex: 'variety', width: 90 },
            { title: '煤种', dataIndex: 'coalKind', width: 120 },
          ]}
        />
      </div>
    </Drawer>
  );
};

const TargetBatchField = ({
  value,
  onChange,
  currentBatches,
  excludeRegNos,
}: {
  value?: string;
  onChange: (regNo: string) => void;
  currentBatches: InboundBatch[];
  excludeRegNos: string[];
}) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const selected = value ? batchOf(value) : undefined;
  const options = [...currentBatches];
  if (selected && !options.some((item) => item.regNo === selected.regNo)) options.unshift(selected);

  return (
    <div className="clbm-field">
      <FieldLabel required>目标批次</FieldLabel>
      <div className="clbm-target-row">
        <Select
          value={value}
          placeholder="批次编码 / 车船号 / 库存煤种"
          options={options.map((item) => ({ value: item.regNo, label: batchOptionLabel(item) }))}
          onChange={onChange}
        />
        <Button className="clbm-more-batch" onClick={() => setMoreOpen(true)}>
          更多批次
        </Button>
      </div>
      <MoreBatchDrawer
        open={moreOpen}
        value={value}
        excludeRegNos={excludeRegNos}
        onClose={() => setMoreOpen(false)}
        onConfirm={(regNo) => {
          onChange(regNo);
          setMoreOpen(false);
        }}
      />
    </div>
  );
};

interface AssignLine {
  key: string;
  regNo?: string;
  amount: number | null;
}

let assignLineSeq = 1;
const createAssignLine = (): AssignLine => ({ key: `assign-${assignLineSeq++}`, amount: null });

const BillDrawerContent = ({
  bill,
  editable,
  canRestore,
  onRestore,
  onSave,
  onUnmarkedChange,
}: {
  bill: LoadingBill;
  editable: boolean;
  canRestore: boolean;
  onRestore: () => void;
  onSave: (allocations: BatchAllocation[]) => void;
  onUnmarkedChange: (amount: number) => void;
}) => {
  const { message } = App.useApp();
  const [draft, setDraft] = useState<BatchAllocation[]>(() => normalizeAllocations(bill.allocations));
  const [transferRegNo, setTransferRegNo] = useState<string | null>(null);
  const [moveAmount, setMoveAmount] = useState<number | null>(null);
  const [destType, setDestType] = useState<'pool' | 'batch'>('batch');
  const [targetRegNo, setTargetRegNo] = useState<string>();
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignLines, setAssignLines] = useState<AssignLine[]>(() => [createAssignLine()]);
  const [moreForKey, setMoreForKey] = useState<string | null>(null);

  useEffect(() => {
    setDraft(normalizeAllocations(bill.allocations));
  }, [bill.id, bill.allocations]);

  useEffect(() => {
    onUnmarkedChange(unmarkedAmount(draft));
  }, [draft, onUnmarkedChange]);
  const rows = toBatchRows(draft, bill.totalAmount);
  const allocated = round2(draft.filter((item) => item.regNo).reduce((sum, item) => sum + item.amount, 0));
  const unmarked = unmarkedAmount(draft);
  const transferRow = rows.find((item) => item.regNo === transferRegNo) || null;

  const applyTransfer = () => {
    if (!transferRow) return;
    if (moveAmount == null || moveAmount <= 0) {
      message.warning('请填写调出煤量');
      return;
    }
    if (moveAmount - transferRow.amount > 0.009) {
      message.warning('调出煤量不能超过该批次当前煤量');
      return;
    }
    if (destType === 'batch') {
      if (!targetRegNo) {
        message.warning('请选择目标批次');
        return;
      }
      if (targetRegNo === transferRow.regNo) {
        message.warning('请选择其他入厂批次');
        return;
      }
    }
    const next = draft.map((item) => ({ ...item }));
    const source = next.find((item) => item.regNo === transferRow.regNo);
    if (!source) return;
    source.amount = round2(source.amount - moveAmount);
    const destKey = destType === 'pool' ? '' : targetRegNo || '';
    const dest = next.find((item) => item.regNo === destKey);
    if (dest) dest.amount = round2(dest.amount + moveAmount);
    else next.push({ regNo: destKey, amount: round2(moveAmount) });
    const normalized = normalizeAllocations(next);
    if (Math.abs(sumAmount(normalized) - bill.totalAmount) > 0.02) {
      message.warning('分配合计与上煤总量不一致');
      return;
    }
    onSave(normalized);
    message.success('调出已保存');
    setTransferRegNo(null);
  };

  const assignSum = round2(assignLines.reduce((sum, line) => sum + (line.amount || 0), 0));
  const assignRemain = round2(unmarked - assignSum);
  const moreLine = assignLines.find((line) => line.key === moreForKey);

  const lineOptions = (line: AssignLine) => {
    const used = new Set(assignLines.filter((item) => item.key !== line.key && item.regNo).map((item) => item.regNo));
    const options = rows
      .filter((item) => item.regNo && !used.has(item.regNo))
      .map((item) => batchOf(item.regNo))
      .filter((item): item is InboundBatch => !!item);
    if (line.regNo && !options.some((item) => item.regNo === line.regNo)) {
      const extra = batchOf(line.regNo);
      if (extra) options.unshift(extra);
    }
    return options;
  };

  const updateAssignLine = (key: string, patch: Partial<AssignLine>) => {
    setAssignLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const splitAssignEven = () => {
    if (assignLines.length === 0 || unmarked <= 0.009) return;
    const count = assignLines.length;
    const base = Math.floor((unmarked * 100) / count) / 100;
    let used = 0;
    setAssignLines((prev) =>
      prev.map((line, index) => {
        const amount = index === count - 1 ? round2(unmarked - used) : base;
        used = round2(used + amount);
        return { ...line, amount };
      }),
    );
  };

  const applyAssign = () => {
    const filled = assignLines.filter((line) => line.regNo || (line.amount != null && line.amount > 0));
    if (filled.length === 0) {
      message.warning('请添加分配批次');
      return;
    }
    if (filled.some((line) => !line.regNo)) {
      message.warning('请选择目标批次');
      return;
    }
    if (filled.some((line) => line.amount == null || line.amount <= 0)) {
      message.warning('请填写分配煤量');
      return;
    }
    const regNos = filled.map((line) => line.regNo);
    if (new Set(regNos).size !== regNos.length) {
      message.warning('目标批次不能重复');
      return;
    }
    const total = round2(filled.reduce((sum, line) => sum + (line.amount || 0), 0));
    if (total - unmarked > 0.009) {
      message.warning('分配煤量合计不能超过未识别煤量');
      return;
    }
    const next = draft.map((item) => ({ ...item }));
    const pool = next.find((item) => !item.regNo);
    if (pool) pool.amount = round2(pool.amount - total);
    filled.forEach((line) => {
      const dest = next.find((item) => item.regNo === line.regNo);
      if (dest) dest.amount = round2(dest.amount + (line.amount || 0));
      else next.push({ regNo: line.regNo || '', amount: round2(line.amount || 0) });
    });
    const normalized = normalizeAllocations(next);
    if (Math.abs(sumAmount(normalized) - bill.totalAmount) > 0.02) {
      message.warning('分配合计与上煤总量不一致');
      return;
    }
    onSave(normalized);
    message.success('分配已保存');
    setAssignOpen(false);
    setMoreForKey(null);
  };

  const applyDelete = (row: BatchRow) => {
    const next = draft.map((item) => ({ ...item }));
    const source = next.find((item) => item.regNo === row.regNo);
    if (!source || source.amount <= 0.009) return;
    const pool = next.find((item) => !item.regNo);
    if (pool) pool.amount = round2(pool.amount + source.amount);
    else next.push({ regNo: '', amount: source.amount });
    source.amount = 0;
    const normalized = normalizeAllocations(next);
    if (Math.abs(sumAmount(normalized) - bill.totalAmount) > 0.02) {
      message.warning('分配合计与上煤总量不一致');
      return;
    }
    onSave(normalized);
    message.success('已删除，煤量已计入未识别批次');
  };

  const currentTargetBatches = (excludeRegNo?: string) =>
    rows
      .filter((item) => item.regNo && item.regNo !== excludeRegNo)
      .map((item) => batchOf(item.regNo))
      .filter((item): item is InboundBatch => !!item);

  const batchColumns: ColumnsType<BatchRow> = [
    {
      title: '入厂登记编号',
      dataIndex: 'regNo',
      width: 250,
      render: (value: string, row) => (row.unmarked ? <span className="clbm-unmarked-label">未识别批次</span> : value),
    },
    { title: '车船号', dataIndex: 'vehicleNo', width: 110, render: (value: string) => value || '' },
    { title: '库存煤种', dataIndex: 'stockCoal', width: 110 },
    { title: '煤品种', dataIndex: 'variety', width: 90 },
    { title: '煤种', dataIndex: 'coalKind', width: 110 },
    {
      title: '实际上煤量t',
      dataIndex: 'amount',
      width: 120,
      align: 'right',
      render: (value: number) => value.toFixed(2),
    },
    {
      title: '占比',
      dataIndex: 'ratio',
      width: 80,
      align: 'right',
      render: (value: number) => `${value.toFixed(1)}%`,
    },
    ...(editable
      ? [
          {
            title: '操作',
            width: 130,
            align: 'center' as const,
            render: (_value: unknown, row: BatchRow) =>
              row.unmarked ? (
                <Button
                  type="link"
                  size="small"
                  disabled={row.amount <= 0.009}
                  onClick={() => {
                    setAssignLines([createAssignLine()]);
                    setMoreForKey(null);
                    setAssignOpen(true);
                  }}
                >
                  分配
                </Button>
              ) : (
                <Space size={0}>
                  <Button
                    type="link"
                    size="small"
                    onClick={() => {
                      setTransferRegNo(row.regNo);
                      setMoveAmount(null);
                      setDestType('batch');
                      setTargetRegNo(undefined);
                    }}
                  >
                    调出
                  </Button>
                  <Popconfirm
                    title="删除批次"
                    description="删除后，该批次煤量将分配到未识别批次，确认删除？"
                    okText="确认"
                    cancelText="取消"
                    zIndex={2000}
                    onConfirm={() => applyDelete(row)}
                  >
                    <Button type="link" size="small" danger>
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              ),
          },
        ]
      : []),
  ];

  return (
    <div className="clbm-drawer-panel">
      <div className="clbm-form-block">
        <div className="clbm-form-item">
          <label>上煤时间</label>
          <div className="clbm-readonly">{bill.loadingTime}</div>
        </div>
        <div className="clbm-form-item">
          <label>班次</label>
          <div className="clbm-readonly">
            {bill.shiftName}（{bill.shiftCode}）
          </div>
        </div>
        <div className="clbm-form-item">
          <label>批次号</label>
          <div className="clbm-readonly">{bill.batchNo}</div>
        </div>
        <div className="clbm-form-item">
          <label>状态</label>
          <div className="clbm-readonly">
            {bill.status === 'confirmed' ? (
              <span className="clbm-status-confirmed">已确认</span>
            ) : (
              <span className="clbm-status-pending">待确认</span>
            )}
          </div>
        </div>
        <div className="clbm-form-item">
          <label>上煤总量 t</label>
          <div className="clbm-readonly">{bill.totalAmount.toFixed(2)}</div>
        </div>
      </div>

      <Tabs
        className="clbm-stat-tabs"
        defaultActiveKey="batch"
        items={[
          {
            key: 'batch',
            label: '按批次统计',
            children: (
              <>
                <Table<BatchRow>
                  className="clbm-detail-table clbm-batch-table"
                  size="small"
                  rowKey="key"
                  pagination={false}
                  scroll={{ x: 1040 }}
                  dataSource={rows}
                  columns={batchColumns}
                  rowClassName={(row) => (row.unmarked ? 'clbm-unmarked-row' : '')}
                />
                <div className="clbm-balance">
                  <span>
                    已分配
                    <strong>{allocated.toFixed(2)}</strong>
                  </span>
                  <span className={unmarked > 0.009 ? 'is-warn' : ''}>
                    未识别
                    <strong>{unmarked.toFixed(2)}</strong>
                  </span>
                  <span className="is-total">
                    上煤总量
                    <strong>{bill.totalAmount.toFixed(2)}</strong>
                  </span>
                </div>
                {editable && (
                  <div className="clbm-restore-row">
                    <Popconfirm
                      title="还原批次分配"
                      description={RESTORE_HINT}
                      okText="确认"
                      cancelText="取消"
                      disabled={!canRestore}
                      zIndex={2000}
                      onConfirm={onRestore}
                    >
                      <Button disabled={!canRestore}>还原批次分配</Button>
                    </Popconfirm>
                  </div>
                )}
                {bill.unrecognizedByYard.length > 0 && (
                  <div className="clbm-yard-block">
                    <div className="clbm-detail-title">未识别批次按煤场</div>
                    <Table<YardUnrecognized>
                      className="clbm-detail-table"
                      size="small"
                      rowKey="yard"
                      pagination={false}
                      dataSource={bill.unrecognizedByYard}
                      columns={[
                        { title: '煤场', dataIndex: 'yard' },
                        {
                          title: '未识别煤量t',
                          dataIndex: 'amount',
                          width: 140,
                          align: 'right',
                          render: (value: number) => value.toFixed(2),
                        },
                      ]}
                      summary={() => (
                        <Table.Summary>
                          <Table.Summary.Row>
                            <Table.Summary.Cell index={0}>合计</Table.Summary.Cell>
                            <Table.Summary.Cell index={1} align="right">
                              {round2(bill.unrecognizedByYard.reduce((sum, item) => sum + item.amount, 0)).toFixed(2)}
                            </Table.Summary.Cell>
                          </Table.Summary.Row>
                        </Table.Summary>
                      )}
                    />
                  </div>
                )}
              </>
            ),
          },
          {
            key: 'bunker',
            label: '按煤仓统计',
            children: (
              <Table
                className="clbm-detail-table"
                size="small"
                rowKey="id"
                scroll={{ x: 834, y: 360 }}
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                  pageSizeOptions: ['10', '20', '50'],
                  showTotal: (total) => `共 ${total} 条明细`,
                }}
                dataSource={sortDetails(bill.details)}
                columns={detailColumns}
              />
            ),
          },
        ]}
      />

      <Drawer
        title="调出煤量"
        open={!!transferRow}
        width={480}
        zIndex={1300}
        onClose={() => setTransferRegNo(null)}
        destroyOnHidden
        extra={
          <Space>
            <Button onClick={() => setTransferRegNo(null)}>取消</Button>
            <Button type="primary" onClick={applyTransfer}>
              确定
            </Button>
          </Space>
        }
      >
        {transferRow && (
          <div className="clbm-modal-form">
            <div className="clbm-source">
              <div>
                <div className="clbm-source-kicker">当前批次</div>
                <div className="clbm-source-title">
                  {transferRow.stockCoal} / {transferRow.vehicleNo}
                </div>
                <div className="clbm-source-sub">{transferRow.regNo}</div>
              </div>
              <div className="clbm-source-amount">
                <div className="clbm-source-kicker">当前煤量 t</div>
                <strong>{transferRow.amount.toFixed(2)}</strong>
              </div>
            </div>
            <div className="clbm-field">
              <FieldLabel required>调出类型</FieldLabel>
              <div className="clbm-seg" role="radiogroup" aria-label="调出类型">
                <button type="button" role="radio" aria-checked={destType === 'pool'} className={destType === 'pool' ? 'is-on' : ''} onClick={() => setDestType('pool')}>
                  退回未识别
                </button>
                <button type="button" role="radio" aria-checked={destType === 'batch'} className={destType === 'batch' ? 'is-on' : ''} onClick={() => setDestType('batch')}>
                  划入其他批次
                </button>
              </div>
            </div>
            <div className="clbm-field">
              <FieldLabel required>调出煤量 t</FieldLabel>
              <InputNumber
                min={0.01}
                max={transferRow.amount}
                step={0.01}
                precision={2}
                value={moveAmount ?? undefined}
                style={{ width: '100%' }}
                onChange={(value) => setMoveAmount(typeof value === 'number' ? value : null)}
              />
              <div className="clbm-field-hint">不可超过当前批次煤量 {transferRow.amount.toFixed(2)} t</div>
            </div>
            {destType === 'batch' && (
              <TargetBatchField
                value={targetRegNo}
                onChange={setTargetRegNo}
                currentBatches={currentTargetBatches(transferRow.regNo)}
                excludeRegNos={[transferRow.regNo]}
              />
            )}
          </div>
        )}
      </Drawer>

      <Drawer
        title="分配未识别煤量"
        open={assignOpen}
        width={760}
        zIndex={1300}
        onClose={() => {
          setMoreForKey(null);
          setAssignOpen(false);
        }}
        destroyOnHidden
        extra={
          <Space>
            <Button
              onClick={() => {
                setMoreForKey(null);
                setAssignOpen(false);
              }}
            >
              取消
            </Button>
            <Button type="primary" onClick={applyAssign}>
              确定
            </Button>
          </Space>
        }
      >
        <div className="clbm-modal-form">
          <div className="clbm-source">
            <div>
              <div className="clbm-source-kicker">未识别批次</div>
              <div className="clbm-source-title">待分配煤量</div>
            </div>
            <div className="clbm-source-amount">
              <div className="clbm-source-kicker">未识别煤量 t</div>
              <strong>{unmarked.toFixed(2)}</strong>
            </div>
          </div>
          <div className="clbm-assign-toolbar">
            <FieldLabel required>分摊批次</FieldLabel>
            <Space>
              <Button onClick={() => setAssignLines((prev) => [...prev, createAssignLine()])}>添加批次</Button>
              <Button onClick={splitAssignEven}>均分煤量</Button>
            </Space>
          </div>
          <div className="clbm-assign-list">
            <div className="clbm-assign-head">
              <span>目标批次</span>
              <span>分配煤量 t</span>
              <span />
            </div>
            {assignLines.map((line) => {
              const lineRemain = round2(assignRemain + (line.amount || 0));
              return (
                <div className="clbm-assign-row" key={line.key}>
                  <div className="clbm-target-row">
                    <Select
                      value={line.regNo}
                      placeholder="批次编码 / 车船号 / 库存煤种"
                      options={lineOptions(line).map((item) => ({ value: item.regNo, label: batchOptionLabel(item) }))}
                      onChange={(regNo) => updateAssignLine(line.key, { regNo })}
                    />
                    <Button className="clbm-more-batch" onClick={() => setMoreForKey(line.key)}>
                      更多批次
                    </Button>
                  </div>
                  <InputNumber
                    min={0.01}
                    max={Math.max(lineRemain, 0.01)}
                    step={0.01}
                    precision={2}
                    value={line.amount ?? undefined}
                    style={{ width: '100%' }}
                    onChange={(value) => updateAssignLine(line.key, { amount: typeof value === 'number' ? value : null })}
                  />
                  <Button
                    type="link"
                    danger
                    disabled={assignLines.length === 1}
                    onClick={() => setAssignLines((prev) => prev.filter((item) => item.key !== line.key))}
                  >
                    删除
                  </Button>
                </div>
              );
            })}
          </div>
          <div className="clbm-assign-sum">
            <span>
              本次分摊 <strong>{assignSum.toFixed(2)}</strong>
            </span>
            <span className={assignRemain < -0.009 ? 'is-over' : 'is-rest'}>
              剩余 <strong>{assignRemain.toFixed(2)}</strong>
            </span>
          </div>
          <div className="clbm-field-hint">可一次分摊到多个批次，合计不可超过未识别煤量。目标批次已存在时累加。</div>
        </div>
        <MoreBatchDrawer
          open={!!moreLine}
          value={moreLine?.regNo}
          excludeRegNos={assignLines.filter((line) => line.key !== moreForKey && line.regNo).map((line) => line.regNo || '')}
          onClose={() => setMoreForKey(null)}
          onConfirm={(regNo) => {
            if (moreForKey) updateAssignLine(moreForKey, { regNo });
            setMoreForKey(null);
          }}
        />
      </Drawer>

    </div>
  );
};

const CoalLoadingBillManagement = () => {
  const { message } = App.useApp();
  const [bills, setBills] = useState<LoadingBill[]>(initialBills);
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [drawer, setDrawer] = useState<{
    open: boolean;
    mode: DrawerMode;
    billId: string | null;
  }>({ open: false, mode: 'view', billId: null });
  const [submitPopOpen, setSubmitPopOpen] = useState(false);
  const [draftUnmarked, setDraftUnmarked] = useState(0);
  const handleUnmarkedChange = useCallback((amount: number) => setDraftUnmarked(amount), []);

  const [queryBatchNo, setQueryBatchNo] = useState('');
  const [queryConfirmer, setQueryConfirmer] = useState('');
  const [queryDateRange, setQueryDateRange] = useState<[Dayjs, Dayjs] | null>([
    dayjs().subtract(2, 'day').startOf('day'),
    dayjs().endOf('day'),
  ]);
  const [querySnapshot, setQuerySnapshot] = useState({
    batchNo: '',
    confirmer: '',
    dateRange: [dayjs().subtract(2, 'day').startOf('day'), dayjs().endOf('day')] as [Dayjs, Dayjs] | null,
  });

  const currentBill = bills.find((item) => item.id === drawer.billId) || null;
  const editable = !!currentBill && drawer.mode !== 'view' && currentBill.status === 'unconfirmed' && currentBill.shiftEnded;

  const runQuery = () => {
    setQuerySnapshot({
      batchNo: queryBatchNo.trim(),
      confirmer: queryConfirmer.trim(),
      dateRange: queryDateRange,
    });
  };

  const filteredBills = useMemo(() => {
    return bills
      .filter((item) => {
        const hitBatch = !querySnapshot.batchNo || item.batchNo.includes(querySnapshot.batchNo);
        const hitConfirmer = !querySnapshot.confirmer || item.confirmer.includes(querySnapshot.confirmer);
        const hitDate =
          !querySnapshot.dateRange ||
          (dayjs(item.feedDate).isAfter(querySnapshot.dateRange[0].subtract(1, 'day')) &&
            dayjs(item.feedDate).isBefore(querySnapshot.dateRange[1].add(1, 'day')));
        return hitBatch && hitConfirmer && hitDate;
      })
      .sort((a, b) => dayjs(b.feedDate).valueOf() - dayjs(a.feedDate).valueOf() || b.shiftCode.localeCompare(a.shiftCode));
  }, [bills, querySnapshot]);

  const openDrawer = (bill: LoadingBill, mode: DrawerMode) => {
    setSubmitPopOpen(false);
    setDraftUnmarked(unmarkedAmount(bill.allocations));
    setDrawer({ open: true, mode, billId: bill.id });
  };

  const closeDrawer = () => {
    setSubmitPopOpen(false);
    setDrawer({ open: false, mode: 'view', billId: null });
  };

  const saveAllocations = (allocations: BatchAllocation[]) => {
    if (!currentBill) return;
    const manualAdjusted = allocationSignature(allocations) !== allocationSignature(currentBill.baselineAllocations);
    setBills((prev) =>
      prev.map((item) => (item.id === currentBill.id ? { ...item, allocations, manualAdjusted } : item)),
    );
  };

  const canRestore =
    !!currentBill &&
    editable &&
    allocationSignature(currentBill.allocations) !== allocationSignature(currentBill.baselineAllocations);

  const handleRestore = () => {
    if (!currentBill) return;
    setBills((prev) =>
      prev.map((item) =>
        item.id === currentBill.id
          ? {
              ...item,
              allocations: normalizeAllocations(item.baselineAllocations),
              manualAdjusted: false,
            }
          : item,
      ),
    );
    message.success('已根据输煤程控计算结果还原批次分配');
  };

  const handleSubmitOpenChange = (visible: boolean) => {
    if (!visible) {
      setSubmitPopOpen(false);
      return;
    }
    if (draftUnmarked > 0.009) {
      message.warning(UNRECOGNIZED_BLOCK_NOTE);
      setSubmitPopOpen(false);
      return;
    }
    setSubmitPopOpen(true);
  };

  const handleConfirm = () => {
    if (!currentBill) return;
    if (!currentBill.shiftEnded) {
      message.warning('未结束班次的上煤单禁止确认');
      return;
    }
    if (unmarkedAmount(currentBill.allocations) > 0.009) {
      message.warning(UNRECOGNIZED_BLOCK_NOTE);
      return;
    }
    setSubmitPopOpen(false);
    setBills((prev) =>
      prev.map((item) =>
        item.id === currentBill.id
          ? {
              ...item,
              status: 'confirmed',
              confirmer: '当前用户',
              confirmTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            }
          : item,
      ),
    );
    message.success('确认成功：上煤单已上传 MIS，入炉明细已锁定，煤堆库存已更新。');
    closeDrawer();
  };

  const columns: ColumnsType<LoadingBill> = [
    {
      title: '序号',
      width: 60,
      align: 'center',
      fixed: 'left',
      render: (_v, _r, index) => index + 1,
    },
    {
      title: '上煤日期',
      dataIndex: 'feedDate',
      width: 120,
      sorter: (a, b) => dayjs(a.feedDate).valueOf() - dayjs(b.feedDate).valueOf(),
      defaultSortOrder: 'descend',
    },
    {
      title: '班次',
      width: 110,
      render: (_v, row) => `${row.shiftName}（${row.shiftCode}）`,
    },
    { title: '批次号', dataIndex: 'batchNo', width: 150 },
    {
      title: '上煤总量 t',
      dataIndex: 'totalAmount',
      width: 120,
      align: 'right',
      render: (value: number) => value.toFixed(2),
    },
    {
      title: '确认状态',
      width: 110,
      render: (_v, row) => {
        if (row.status === 'confirmed') return <span className="clbm-status-confirmed">已确认</span>;
        if (!row.shiftEnded) return <span className="clbm-status-running">班次进行中</span>;
        return <span className="clbm-status-pending">未确认</span>;
      },
    },
    {
      title: '确认人',
      dataIndex: 'confirmer',
      width: 100,
      render: (value: string) => value || '-',
    },
    {
      title: '确认时间',
      dataIndex: 'confirmTime',
      width: 170,
      render: (value: string) => value || '-',
    },
    {
      title: '操作',
      fixed: 'right',
      width: 200,
      render: (_v, row) => (
        <Space size={4}>
          <Button className="clbm-op-link" type="link" size="small" icon={<EyeOutlined />} onClick={() => openDrawer(row, 'view')}>
            查看
          </Button>
          {row.status === 'unconfirmed' && (
            <Button
              className="clbm-op-link"
              type="link"
              size="small"
              icon={<CheckOutlined />}
              disabled={!row.shiftEnded}
              onClick={() => openDrawer(row, 'confirm')}
            >
              确认
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const drawerTitle = currentBill
    ? `${drawer.mode === 'view' ? '查看上煤单' : '确认入炉批次'} - ${currentBill.batchNo}`
    : '上煤单详情';

  return (
    <div className="clbm-root">
      <div className="clbm-page-title">
        <span className="clbm-title-icon">+</span>
        <h1>上煤单管理</h1>
      </div>

      <div className="clbm-filter-bar">
        <div className="clbm-filter-row">
          <span className="clbm-filter-label">上煤日期</span>
          <RangePicker value={queryDateRange} onChange={(value) => setQueryDateRange(value as [Dayjs, Dayjs] | null)} style={{ width: 260 }} />
          {showAdvancedFilter && (
            <>
              <Input value={queryBatchNo} onChange={(event) => setQueryBatchNo(event.target.value)} placeholder="批次号" style={{ width: 160 }} allowClear />
              <Input
                value={queryConfirmer}
                onChange={(event) => setQueryConfirmer(event.target.value)}
                placeholder="确认人"
                style={{ width: 140 }}
                allowClear
              />
            </>
          )}
          <div className="clbm-filter-actions">
            <Button type="primary" icon={<SearchOutlined />} onClick={runQuery}>
              查询
            </Button>
            <span className="clbm-filter-link" onClick={() => setShowAdvancedFilter((value) => !value)}>
              <FilterOutlined /> 筛选
            </span>
          </div>
        </div>
      </div>

      <div className="clbm-table-wrap">
        <Table<LoadingBill>
          rowKey="id"
          size="middle"
          columns={columns}
          dataSource={filteredBills}
          scroll={{ x: 1140 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total, range) => `共 ${total} 条记录 第 ${range[0]}-${range[1]} 条`,
          }}
        />
      </div>

      <Drawer
        open={drawer.open}
        width={1120}
        onClose={closeDrawer}
        classNames={{ body: 'clbm-drawer-body' }}
        title={drawerTitle}
        extra={
          editable && currentBill ? (
            <Space>
              <Button onClick={closeDrawer}>取消</Button>
              <Popconfirm
                title="提交确认"
                description={CONFIRM_HINT}
                okText="确认"
                cancelText="取消"
                open={submitPopOpen}
                zIndex={2000}
                onOpenChange={handleSubmitOpenChange}
                onConfirm={handleConfirm}
              >
                <Button type="primary">提交确认</Button>
              </Popconfirm>
            </Space>
          ) : (
            <Button onClick={closeDrawer}>关闭</Button>
          )
        }
      >
        {currentBill && (
          <BillDrawerContent
            bill={currentBill}
            editable={editable}
            canRestore={canRestore}
            onRestore={handleRestore}
            onSave={saveAllocations}
            onUnmarkedChange={handleUnmarkedChange}
          />
        )}
      </Drawer>
    </div>
  );
};

const Component = () => (
  <ConfigProvider locale={zhCN}>
    <App>
      <CoalLoadingBillManagement />
    </App>
  </ConfigProvider>
);

export default Component;
