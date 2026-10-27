/**
 * 操作 · 入库
 *
 * 入厂登记编号从来煤预报抽屉带回。分区先在列表抽屉里勾选确认，再回显到已选分区，
 * 按分区平均分摊煤量并反算新增煤层的体积、俯仰角和高度。
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, App, Button, Drawer, Input, InputNumber, Space, Table } from 'antd';
import BatchPickerModal from './BatchPickerModal';
import StockCoalField from './StockCoalField';
import type { ColumnsType } from 'antd/es/table';
import {
  type ArrivalBatch,
  type CoalYard,
  type CoalZone,
  type StockCoal,
  forecastView,
  fmt,
  validateStockAssignment,
} from '../data';
import { buildInboundPlan, type ComputedZone, type InboundPlanItem } from '../model';

interface Props {
  open: boolean;
  yard: CoalYard;
  zones: ComputedZone[];
  rawZones: CoalZone[];
  batches: ArrivalBatch[];
  stockCoals: StockCoal[];
  defaultDensity: number;
  onClose: () => void;
  onSubmit: (params: {
    plan: InboundPlanItem[];
    regNo: string;
    stockCoalType: string;
    stockColor: string;
    density: number;
    totalMass: number;
    note: string;
    needSurveyWarning: boolean;
  }) => void;
}

const stripMass = (value: string | undefined) => String(value ?? '').replace(/[\s-]/g, '');

const InboundDrawer: React.FC<Props> = ({
  open,
  yard,
  zones,
  rawZones,
  batches,
  stockCoals,
  defaultDensity,
  onClose,
  onSubmit,
}) => {
  const [picked, setPicked] = useState<string[]>([]);
  const [regNo, setRegNo] = useState<string>();
  const [stockCoal, setStockCoal] = useState('');
  const [stockColor, setStockColor] = useState('');
  const [stockError, setStockError] = useState('');
  const readStock = useRef<(() => { name: string; color: string }) | null>(null);
  const [totalMass, setTotalMass] = useState<number | null>(null);
  const [density, setDensity] = useState(defaultDensity);
  const [note, setNote] = useState('');
  const { message } = App.useApp();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [zoneOpen, setZoneOpen] = useState(false);
  const [zoneDraft, setZoneDraft] = useState<string[]>([]);
  const [pendingRemove, setPendingRemove] = useState<ComputedZone | null>(null);

  useEffect(() => {
    if (open) return;
    setZoneOpen(false);
    setPendingRemove(null);
    setPickerOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setPicked([]);
    setRegNo(undefined);
    setStockCoal('');
    setStockColor('');
    setStockError('');
    setTotalMass(null);
    setDensity(defaultDensity);
    setNote('');
  }, [open, defaultDensity]);

  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current && yard.autoUpdateByVolume) {
      message.info('本煤场按盘煤体积自动更新库存，手动入库会在下次盘煤后被覆盖。');
    }
    wasOpen.current = open;
  }, [open, yard.autoUpdateByVolume, message]);

  const batch = batches.find((item) => item.regNo === regNo);
  const forecast = batch ? forecastView(batch) : null;
  const plan = useMemo(
    () => buildInboundPlan(rawZones, picked, totalMass ?? 0, density),
    [rawZones, picked, totalMass, density],
  );
  const planMap = useMemo(() => new Map(plan.map((item) => [item.zoneId, item])), [plan]);
  const overCapacityZones = plan.filter((item) => item.overCapacity);
  const selectedRows = picked
    .map((id) => zones.find((zone) => zone.id === id))
    .filter((zone): zone is ComputedZone => Boolean(zone))
    .sort((a, b) => a.code - b.code);

  const canSubmit =
    Boolean(regNo) &&
    (forecast?.stockFilled || stockCoal.trim().length > 0) &&
    (totalMass ?? 0) > 0 &&
    density > 0 &&
    picked.length > 0;

  const submitInbound = () => {
    const filled = forecast?.stockFilled ? forecast.stockCoalType : '';
    const draft = filled
      ? {
          name: filled,
          color: stockCoals.find((item) => item.name === filled)?.color ?? stockColor,
        }
      : readStock.current?.() ?? { name: stockCoal.trim(), color: stockColor };
    const result = validateStockAssignment(draft.name, draft.color, stockCoals);
    if (!result.ok) {
      setStockError(result.message);
      return;
    }
    onSubmit({
      plan,
      regNo: regNo ?? '',
      stockCoalType: result.name,
      stockColor: result.color,
      density,
      totalMass: totalMass ?? 0,
      note,
      needSurveyWarning: yard.autoUpdateByVolume,
    });
  };

  const selectedColumns: ColumnsType<ComputedZone> = [
    { title: '分区名称', dataIndex: 'name', width: 88 },
    {
      title: '存煤量 t',
      key: 'mass',
      width: 100,
      align: 'right',
      render: (_, zone) => <span className="cssm-num">{fmt(zone.totalMass)}</span>,
    },
    {
      title: '剩余容量 m³',
      key: 'left',
      width: 110,
      align: 'right',
      render: (_, zone) => (
        <span className="cssm-num">{fmt(Math.max(0, zone.capacity - zone.totalVolume))}</span>
      ),
    },
    {
      title: '分摊煤量 t',
      key: 'alloc',
      width: 110,
      align: 'right',
      render: (_, zone) => {
        const item = planMap.get(zone.id);
        return item ? <span className="cssm-num">{fmt(item.mass, 3)}</span> : '—';
      },
    },
    {
      title: '新增体积 m³',
      key: 'volume',
      width: 110,
      align: 'right',
      render: (_, zone) => {
        const item = planMap.get(zone.id);
        return item ? <span className="cssm-num">{fmt(item.volume)}</span> : '—';
      },
    },
    {
      title: '俯仰角度',
      key: 'pitch',
      width: 140,
      render: (_, zone) => {
        const item = planMap.get(zone.id);
        return item ? (
          <span className="cssm-num">
            {item.pitchFrom.toFixed(2)}° ~ {item.pitchTo.toFixed(2)}°
          </span>
        ) : (
          '—'
        );
      },
    },
    {
      title: '煤层高度',
      key: 'height',
      width: 150,
      render: (_, zone) => {
        const item = planMap.get(zone.id);
        return item ? (
          <span className="cssm-num">
            {item.heightFrom.toFixed(2)} ~ {item.heightTo.toFixed(2)} m
          </span>
        ) : (
          '—'
        );
      },
    },
    {
      title: '操作',
      key: 'op',
      width: 72,
      render: (_, zone) => (
        <Button type="link" danger size="small" onClick={() => setPendingRemove(zone)}>
          删除
        </Button>
      ),
    },
  ].filter((column) => yard.hasSurvey || !['pitch', 'height'].includes(String(column.key)));

  return (
    <Drawer
      title="入库"
      open={open}
      onClose={onClose}
      size="min(1180px, 96vw)"
      destroyOnHidden
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="cssm-hint">
            已选 {picked.length} 个分区 · 合计入库 {fmt(totalMass ?? 0, 3)} t · 折算体积{' '}
            {fmt(density > 0 ? (totalMass ?? 0) / density : 0)} m³
          </span>
          <Space>
            <Button onClick={onClose}>取消</Button>
            <Button
              type="primary"
              disabled={!canSubmit}
              onClick={submitInbound}
            >
              确认入库
            </Button>
          </Space>
        </div>
      }
    >
      <div className="cssm-drawer-form">
        <div>
          <label className="cssm-req" htmlFor="cssm-in-reg">
            入厂登记编号
          </label>
          <Input
            id="cssm-in-reg"
            readOnly
            className="cssm-reg-input"
            value={regNo}
            placeholder="选择来煤预报"
            onClick={() => setPickerOpen(true)}
          />
        </div>
        <div>
          <label className="cssm-req" htmlFor="cssm-in-mass">
            入库煤量
          </label>
          <InputNumber
            id="cssm-in-mass"
            style={{ width: '100%' }}
            min={0}
            step={0.001}
            precision={3}
            suffix="t"
            value={totalMass}
            keyboard
            parser={(display) => {
              const cleaned = stripMass(display);
              return cleaned ? Number(cleaned) : Number.NaN;
            }}
            onKeyDown={(event) => {
              if (event.key === ' ' || event.key === '-') event.preventDefault();
            }}
            onChange={(value) => setTotalMass(typeof value === 'number' ? value : null)}
          />
        </div>
        <div>
          <label className="cssm-req" htmlFor="cssm-in-density">
            计算密度
          </label>
          <InputNumber
            id="cssm-in-density"
            style={{ width: '100%' }}
            min={0.001}
            step={0.001}
            precision={3}
            suffix="t/m³"
            value={density}
            onChange={(value) => setDensity(typeof value === 'number' ? value : defaultDensity)}
          />
        </div>
        {forecast && (
          <div className="cssm-writeback">
            {(forecast.stockFilled
              ? [
                  ['批次号', forecast.batchNo],
                  ['车船号', forecast.shipName],
                  ['航次', forecast.voyage],
                  ['煤品种', forecast.coalVariety],
                  ['煤种', forecast.coalKind],
                  ['库存煤种', forecast.stockCoalType],
                ]
              : [
                  ['批次号', forecast.batchNo],
                  ['车船号', forecast.shipName],
                  ['航次', forecast.voyage],
                  ['煤品种', forecast.coalVariety],
                  ['煤种', forecast.coalKind],
                ]
            ).map(([label, value]) => (
              <div key={label}>
                <span className="cssm-writeback-k">{label}</span>
                <span className="cssm-writeback-v">{value}</span>
              </div>
            ))}
          </div>
        )}
        {forecast && !forecast.stockFilled && (
          <StockCoalField
            coals={stockCoals}
            resetKey={regNo ?? ''}
            value={stockCoal}
            onChange={(name) => {
              setStockCoal(name);
              setStockError('');
            }}
            color={stockColor}
            onColorChange={setStockColor}
            error={stockError}
            readerRef={readStock}
          />
        )}
        <div className="is-wide">
          <label htmlFor="cssm-in-note">备注</label>
          <Input
            id="cssm-in-note"
            placeholder="补充说明"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
      </div>

      {overCapacityZones.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ margin: '12px 0' }}
          title="超出分区高度上限"
          description={`${overCapacityZones.map((item) => item.zoneName).join('、')} 入库后将超过堆煤高度与容量上限，仍可继续入库。`}
        />
      )}

      <div className="cssm-drawer-h3">
        <span>已选分区</span>
        <Button
          size="small"
          onClick={() => {
            setZoneDraft(picked);
            setZoneOpen(true);
          }}
        >
          选择入库分区
        </Button>
      </div>
      <Table<ComputedZone>
        rowKey="id"
        size="small"
        columns={selectedColumns}
        dataSource={selectedRows}
        pagination={false}
        locale={{ emptyText: '尚未选择分区' }}
        scroll={{ x: 980 }}
      />

      <Drawer
        title="选择入库分区"
        open={zoneOpen}
        size="min(640px, 94vw)"
        zIndex={2000}
        push={false}
        destroyOnHidden
        onClose={() => setZoneOpen(false)}
        footer={
          <div className="cssm-drawer-foot">
            <Button onClick={() => setZoneOpen(false)}>取消</Button>
            <Button
              type="primary"
              disabled={zoneDraft.length === 0}
              onClick={() => {
                setPicked(zoneDraft);
                setZoneOpen(false);
              }}
            >
              确认选择
            </Button>
          </div>
        }
      >
        <Table<ComputedZone>
          rowKey="id"
          size="small"
          dataSource={zones}
          pagination={{ pageSize: 8, showSizeChanger: false, showTotal: (total) => `共 ${total} 个分区` }}
          rowSelection={{
            selectedRowKeys: zoneDraft,
            onChange: (keys) => setZoneDraft(keys as string[]),
          }}
          onRow={(zone) => ({
            onClick: (event) => {
              const target = event.target as HTMLElement;
              if (target.closest('.ant-checkbox-wrapper, .ant-checkbox')) return;
              setZoneDraft((prev) =>
                prev.includes(zone.id) ? prev.filter((id) => id !== zone.id) : [...prev, zone.id],
              );
            },
          })}
          columns={[
            { title: '分区名称', dataIndex: 'name', width: 100 },
            {
              title: '存煤量 t',
              key: 'mass',
              align: 'right',
              render: (_, zone) => <span className="cssm-num">{fmt(zone.totalMass)}</span>,
            },
            {
              title: '剩余容量 m³',
              key: 'left',
              align: 'right',
              render: (_, zone) => (
                <span className="cssm-num">{fmt(Math.max(0, zone.capacity - zone.totalVolume))}</span>
              ),
            },
          ]}
        />
      </Drawer>

      <Drawer
        title="确认删除该分区？"
        open={Boolean(pendingRemove)}
        onClose={() => setPendingRemove(null)}
        size={420}
        zIndex={2200}
        push={false}
        destroyOnHidden
        footer={
          <div className="cssm-drawer-foot">
            <Button onClick={() => setPendingRemove(null)}>取消</Button>
            <Button
              type="primary"
              danger
              onClick={() => {
                const zoneId = pendingRemove?.id;
                setPendingRemove(null);
                if (zoneId) setPicked((prev) => prev.filter((id) => id !== zoneId));
              }}
            >
              删除
            </Button>
          </div>
        }
      >
        <p className="cssm-confirm-copy">
          将从本次入库分区中移除 {pendingRemove?.name ?? '该分区'}，并按剩余分区重新分摊煤量。
        </p>
      </Drawer>

      <BatchPickerModal
        open={pickerOpen}
        batches={batches}
        onClose={() => setPickerOpen(false)}
        onPick={(next) => {
          const view = forecastView(next);
          setRegNo(next.regNo);
          setStockCoal(view.stockFilled ? view.stockCoalType : '');
          setStockColor(view.stockFilled
            ? stockCoals.find((item) => item.name === view.stockCoalType)?.color ?? ''
            : '');
          setStockError('');
          setPickerOpen(false);
        }}
      />
    </Drawer>
  );
};

export default InboundDrawer;
