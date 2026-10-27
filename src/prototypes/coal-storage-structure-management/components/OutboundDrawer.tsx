/**
 * 操作 · 出库
 *
 * 分区默认取存煤结构里当前选中煤层所在分区。出库煤量失焦后核对是否超出该分区存煤量。
 * 存煤分层从表层往下排列。层号从贴地底层起为 1，向上递增。预计扣减先出更高的煤层。
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, App, Button, Drawer, Input, InputNumber, Select, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { type CoalYard, coalTypeName, fmt } from '../data';
import type { ComputedLayer, ComputedZone } from '../model';

interface Props {
  open: boolean;
  yard: CoalYard;
  zones: ComputedZone[];
  presetZoneId: string | null;
  onClose: () => void;
  onSubmit: (params: { zoneId: string; mass: number; note: string }) => void;
}

type CutMark = 'all' | 'part' | null;

interface LayerRow {
  key: string;
  seq: number;
  regNo: string;
  coalTypeName: string;
  volume: number;
  mass: number;
  cut: CutMark;
}

const stripNumber = (value: string | undefined) => String(value ?? '').replace(/[\s-]/g, '');

const markCuts = (layers: ComputedLayer[], mass: number) => {
  const marks = new Map<string, CutMark>();
  let remain = mass;
  [...layers]
    .sort((a, b) => b.seq - a.seq)
    .forEach((layer) => {
      if (remain <= 0.0005) {
        marks.set(layer.id, null);
        return;
      }
      if (remain >= layer.mass - 0.0005) {
        marks.set(layer.id, 'all');
        remain -= layer.mass;
        return;
      }
      marks.set(layer.id, 'part');
      remain = 0;
    });
  return marks;
};

const OutboundDrawer: React.FC<Props> = ({
  open,
  yard,
  zones,
  presetZoneId,
  onClose,
  onSubmit,
}) => {
  const [zoneId, setZoneId] = useState<string>();
  const [mass, setMass] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [massError, setMassError] = useState('');
  const { message } = App.useApp();

  useEffect(() => {
    if (!open) return;
    setZoneId(presetZoneId ?? undefined);
    setMass(null);
    setNote('');
    setMassError('');
  }, [open, presetZoneId]);

  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current && yard.autoUpdateByVolume) {
      message.info('本煤场按盘煤体积自动更新库存，手动出库可能在下次盘煤后被覆盖。');
    }
    wasOpen.current = open;
  }, [open, yard.autoUpdateByVolume, message]);

  const zone = zones.find((item) => item.id === zoneId) ?? null;
  const stock = zone?.totalMass ?? 0;
  const overStock = zone != null && mass != null && mass > stock + 0.0005;
  const massRef = useRef<number | null>(null);
  const stockRef = useRef(stock);
  const hasZoneRef = useRef(false);
  massRef.current = mass;
  stockRef.current = stock;
  hasZoneRef.current = Boolean(zone);

  const checkMass = (
    next = massRef.current,
    nextStock = stockRef.current,
    hasZone = hasZoneRef.current,
  ) => {
    if (!hasZone || next == null) {
      setMassError('');
      return;
    }
    if (next > nextStock + 0.0005) {
      setMassError(`出库煤量超出分区存煤量 ${fmt(nextStock, 3)} t`);
      return;
    }
    setMassError('');
  };

  const rows = useMemo<LayerRow[]>(() => {
    if (!zone) return [];
    const marks = markCuts(zone.layers, mass ?? 0);
    return [...zone.layers]
      .sort((a, b) => b.seq - a.seq)
      .map((layer) => ({
        key: layer.id,
        seq: layer.seq,
        regNo: layer.raw.regNo,
        coalTypeName: layer.raw.coalType ? coalTypeName(layer.raw.coalType) : '待标记',
        volume: layer.volume,
        mass: layer.mass,
        cut: marks.get(layer.id) ?? null,
      }));
  }, [zone, mass]);

  const cutCount = rows.filter((row) => row.cut).length;
  const canSubmit = Boolean(zone) && mass != null && mass > 0 && !overStock;

  const columns: ColumnsType<LayerRow> = [
    {
      title: '煤层',
      dataIndex: 'seq',
      width: 72,
      render: (value: number) => <span className="cssm-num">{value}</span>,
    },
    {
      title: '入厂登记编号',
      dataIndex: 'regNo',
      width: 240,
      render: (value: string) => value || <span style={{ color: '#cf1322' }}>待标记</span>,
    },
    { title: '库存煤种', dataIndex: 'coalTypeName', width: 110 },
    {
      title: '煤量 t',
      dataIndex: 'mass',
      width: 110,
      align: 'right',
      render: (value: number) => <span className="cssm-num">{fmt(value, 3)}</span>,
    },
    {
      title: '体积 m³',
      dataIndex: 'volume',
      width: 110,
      align: 'right',
      render: (value: number) => <span className="cssm-num">{fmt(value, 3)}</span>,
    },
    {
      title: '预计扣减',
      dataIndex: 'cut',
      width: 110,
      render: (value: CutMark) => {
        if (value === 'all') return <Tag color="red">全部扣减</Tag>;
        if (value === 'part') return <Tag color="blue">部分扣减</Tag>;
        return <span style={{ color: 'rgba(0,0,0,0.25)' }}>—</span>;
      },
    },
  ];

  return (
    <Drawer
      title="出库"
      open={open}
      onClose={onClose}
      size="min(980px, 96vw)"
      destroyOnHidden
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="cssm-hint">
            {cutCount > 0 ? `预计扣减 ${cutCount} 个煤层` : '尚未形成扣减'}
          </span>
          <Space>
            <Button onClick={onClose}>取消</Button>
            <Button
              type="primary"
              disabled={!canSubmit}
              onClick={() => zone && mass != null && onSubmit({ zoneId: zone.id, mass, note })}
            >
              确认出库
            </Button>
          </Space>
        </div>
      }
    >
      <div className="cssm-drawer-form">
        <div>
          <label className="cssm-req" htmlFor="cssm-out-zone">
            出库分区
          </label>
          <Select
            id="cssm-out-zone"
            showSearch
            optionFilterProp="label"
            placeholder="请选择分区"
            style={{ width: '100%' }}
            value={zoneId}
            onChange={(value) => {
              setZoneId(value);
              const next = zones.find((item) => item.id === value);
              stockRef.current = next?.totalMass ?? 0;
              hasZoneRef.current = Boolean(next);
              checkMass(massRef.current, stockRef.current, hasZoneRef.current);
            }}
            options={zones.map((item) => ({ value: item.id, label: item.name }))}
          />
        </div>
        <div>
          <label htmlFor="cssm-out-stock">存煤量 t</label>
          <Input id="cssm-out-stock" readOnly value={zone ? fmt(stock, 3) : ''} />
        </div>
        <div>
          <label className="cssm-req" htmlFor="cssm-out-mass">
            出库煤量
          </label>
          <InputNumber
            id="cssm-out-mass"
            style={{ width: '100%' }}
            min={0}
            step={0.001}
            precision={3}
            status={massError ? 'error' : undefined}
            suffix="t"
            value={mass}
            parser={(display) => {
              const cleaned = stripNumber(display);
              return cleaned ? Number(cleaned) : Number.NaN;
            }}
            onKeyDown={(event) => {
              if (event.key === ' ' || event.key === '-') event.preventDefault();
            }}
            onChange={(value) => {
              const next = typeof value === 'number' ? value : null;
              massRef.current = next;
              setMass(next);
              if (next == null || !hasZoneRef.current || next <= stockRef.current + 0.0005) {
                setMassError('');
              }
            }}
            onBlur={() => checkMass()}
          />
        </div>
        <div className="is-wide">
          <label htmlFor="cssm-out-note">备注</label>
          <Input
            id="cssm-out-note"
            placeholder="补充说明"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
      </div>

      {massError && (
        <Alert type="error" showIcon style={{ margin: '12px 0' }} title={massError} />
      )}

      <h3 className="cssm-drawer-h3">存煤分层</h3>
      <Table<LayerRow>
        rowKey="key"
        size="small"
        columns={columns}
        dataSource={rows}
        pagination={false}
        locale={{ emptyText: '请选择出库分区' }}
        scroll={{ x: 760 }}
      />
    </Drawer>
  );
};

export default OutboundDrawer;
