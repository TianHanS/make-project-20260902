/**
 * 操作 · 分层拆分
 *
 * 把选中的单层煤拆分为多层。列表自上而下：上面的煤层排在前面。
 * 子层标记从当前层层序起往上递增，贴原层底的子层保留当前层序，角度不可改；
 * 其上一层的起始角等于下一层的结束角。可编辑子层点击入厂登记编号后，
 * 在上一层抽屉上再选来煤预报；贴底子层的编号保持只读。各子层已填编号不能重复。
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Drawer, Input, InputNumber, Space, Table, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { ARRIVAL_BATCHES, fmt } from '../data';
import { buildSplitPreview, type ComputedLayer, type ComputedZone, type SplitPreviewRow } from '../model';
import BatchPickerModal from './BatchPickerModal';

interface Props {
  open: boolean;
  /** 未配备盘煤仪时不展示角度和标高 */
  spatial: boolean;
  zone: ComputedZone | null;
  layer: ComputedLayer | null;
  onClose: () => void;
  onSubmit: (preview: SplitPreviewRow[]) => void;
}

const MAX_ROWS = 6;

interface Row extends SplitPreviewRow {
  key: number;
  index: number;
  /** 起始角度是否锁定（末行锁定为原层底角） */
  startLocked: boolean;
}

const SplitLayerDrawer: React.FC<Props> = ({
  open,
  spatial,
  zone,
  layer,
  onClose,
  onSubmit,
}) => {
  const [count, setCount] = useState(2);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pickerRow, setPickerRow] = useState<number | null>(null);

  useEffect(() => {
    if (!open) {
      setConfirmOpen(false);
      setPickerRow(null);
    }
  }, [open]);
  const [starts, setStarts] = useState<number[]>([]);
  const [regNos, setRegNos] = useState<string[]>([]);

  /** 按角度等分为 n 层，作为可再微调的初值 */
  const evenSplit = (n: number, top: number, bottom: number) =>
    Array.from({ length: n }, (_, i) =>
      Number((top - ((i + 1) * (top - bottom)) / n).toFixed(2)),
    );

  useEffect(() => {
    if (!open || !layer) return;
    const top = layer.bound.pitchTop;
    const bottom = layer.bound.pitchBottom;
    setCount(2);
    setStarts(evenSplit(2, top, bottom));
    setRegNos(['', layer.raw.regNo]);
  }, [open, layer]);

  const changeCount = (n: number) => {
    if (!layer) return;
    setCount(n);
    setStarts(evenSplit(n, layer.bound.pitchTop, layer.bound.pitchBottom));
    setRegNos((prev) =>
      Array.from({ length: n }, (_, i) => {
        if (i === n - 1) return layer.raw.regNo;
        if (i === prev.length - 1) return '';
        return prev[i] ?? '';
      }),
    );
  };

  const preview = useMemo<Row[]>(() => {
    if (!zone || !layer || starts.length !== count) return [];
    const top = layer.bound.pitchTop;
    const rows = Array.from({ length: count }, (_, i) => ({
      regNo: regNos[i] ?? '',
      // 结束角度：首行为原层顶角，其余取上一行的起始角度
      pitchEnd: i === 0 ? top : starts[i - 1],
      // 末行起始角度锁定为原层底角
      pitchStart: i === count - 1 ? layer.bound.pitchBottom : starts[i],
    }));
    return buildSplitPreview(zone.geometry, layer, rows).map((r, i) => ({
      ...r,
      key: i,
      index: i,
      startLocked: i === count - 1,
    }));
  }, [zone, layer, starts, regNos, count]);

  const sumVolume = preview.reduce((s, r) => s + Math.max(0, r.volume), 0);
  const orderValid = preview.every((r) => r.pitchStart < r.pitchEnd - 0.0001);
  const volumeValid = preview.every((r) => r.volume > 0.01);
  const filledRegs = preview.map((r) => r.regNo).filter(Boolean);
  const regsUnique = new Set(filledRegs).size === filledRegs.length;
  const canSubmit = orderValid && volumeValid && regsUnique && preview.length >= 2;
  const originSeq = layer?.seq ?? 1;

  const columns: ColumnsType<Row> = [
    {
      title: '子层',
      key: 'seq',
      width: 96,
      render: (_, r) => {
        const layerNo = originSeq + (count - 1 - r.index);
        return (
          <Tag color={layerNo === originSeq ? 'blue' : 'default'} style={{ marginInlineEnd: 0 }}>
            {layerNo === 1 ? '第一层' : `第 ${layerNo} 层`}
          </Tag>
        );
      },
    },
    {
      title: '入厂登记编号',
      key: 'reg',
      width: 250,
      render: (_, r) =>
        r.startLocked ? (
          <Input size="small" disabled value={r.regNo} />
        ) : (
          <Input
            size="small"
            readOnly
            allowClear
            className="cssm-reg-input"
            value={r.regNo}
            placeholder="选择来煤预报"
            onClick={(event) => {
              if ((event.target as HTMLElement).closest('.ant-input-clear-icon')) return;
              setPickerRow(r.index);
            }}
            onChange={(event) => {
              if (event.target.value) return;
              setRegNos((prev) => prev.map((item, i) => (i === r.index ? '' : item)));
            }}
          />
        ),
    },
    {
      title: '起始角度 °',
      key: 'pitchStart',
      width: 150,
      render: (_, r) =>
        r.startLocked ? (
          <span className="cssm-locked-angle cssm-num">{r.pitchStart.toFixed(2)}</span>
        ) : (
          <InputNumber
            size="small"
            style={{ width: '100%' }}
            step={0.5}
            precision={2}
            status={r.pitchStart >= r.pitchEnd ? 'error' : undefined}
            value={starts[r.index]}
            // 清空或输入中间态时 antd 给出 null，此时保留原值，避免数值被弹回 0
            onChange={(v) => {
              if (v === null || v === undefined) return;
              setStarts((prev) => prev.map((x, i) => (i === r.index ? Number(v) : x)));
            }}
          />
        ),
    },
    {
      title: '结束角度 °',
      key: 'pitchEnd',
      width: 140,
      align: 'right',
      render: (_, r) => (
        <span className="cssm-locked-angle cssm-num">{r.pitchEnd.toFixed(2)}</span>
      ),
    },
    {
      title: '标高区间 m',
      key: 'height',
      width: 128,
      align: 'right',
      render: (_, r) => (
        <span className="cssm-num">
          {r.heightStart.toFixed(2)} ~ {r.heightEnd.toFixed(2)}
        </span>
      ),
    },
    {
      title: '分层体积 m³',
      key: 'volume',
      width: 112,
      align: 'right',
      render: (_, r) => (
        <span className="cssm-num" style={{ color: r.volume > 0.01 ? undefined : '#cf1322' }}>
          {fmt(r.volume)}
        </span>
      ),
    },
    {
      title: '占比',
      key: 'ratio',
      width: 88,
      align: 'right',
      render: (_, r) => <span className="cssm-num">{(r.ratio * 100).toFixed(1)}%</span>,
    },
    {
      title: '煤量 t',
      key: 'mass',
      width: 100,
      align: 'right',
      render: (_, r) => <span className="cssm-num">{fmt(r.mass)}</span>,
    },
  ].filter((column) => spatial || !['pitchEnd', 'pitchStart', 'height'].includes(String(column.key)));

  return (
    <Drawer
      title="分层拆分"
      open={open}
      onClose={onClose}
      size="min(1180px, 96vw)"
      destroyOnHidden
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="cssm-hint">
            拆分为 {count} 层 · 体积合计 {fmt(sumVolume)} m³
            {!regsUnique && <span style={{ color: '#cf1322' }}>入厂登记编号不能重复</span>}
            {layer && Math.abs(sumVolume - layer.volume) > 1 && (
              <span style={{ color: '#cf1322' }}>
                （与原煤层 {fmt(layer.volume)} m³ 相差 {fmt(Math.abs(sumVolume - layer.volume))} m³）
              </span>
            )}
          </span>
          <Space>
            <Button onClick={onClose}>取消</Button>
            <Button type="primary" disabled={!canSubmit} onClick={() => setConfirmOpen(true)}>
              确认拆分
            </Button>
          </Space>
        </div>
      }
    >
      {zone && layer ? (
        <>
          <div className="cssm-match">
            <div className="cssm-match-cell">
              <div className="cssm-match-k">原煤层煤量</div>
              <div className="cssm-match-v cssm-num">
                {fmt(layer.mass)}
                <small>t</small>
              </div>
            </div>
            <div className="cssm-match-cell">
              <div className="cssm-match-k">原煤层体积</div>
              <div className="cssm-match-v cssm-num">
                {fmt(layer.volume)}
                <small>m³</small>
              </div>
            </div>
            {spatial && (
              <>
                <div className="cssm-match-cell">
                  <div className="cssm-match-k">俯仰夹角区间</div>
                  <div className="cssm-match-v cssm-num">
                    {layer.bound.pitchBottom.toFixed(2)}° ~ {layer.bound.pitchTop.toFixed(2)}°
                  </div>
                </div>
                <div className="cssm-match-cell">
                  <div className="cssm-match-k">标高区间</div>
                  <div className="cssm-match-v cssm-num">
                    {layer.bound.heightBottom.toFixed(2)} ~ {layer.bound.heightTop.toFixed(2)}
                    <small>m</small>
                  </div>
                </div>
              </>
            )}
          </div>

          {!orderValid && (
            <Alert
              type="error"
              showIcon
              style={{ marginBottom: 12 }}
              title="角度顺序不合法"
              description="请调整标红的角度，使每一层的起始角度小于结束角度。"
            />
          )}

          <h3 className="cssm-drawer-h3">分层信息</h3>

          <Space style={{ marginBottom: 10 }}>
            <Button
              size="small"
              icon={<PlusOutlined />}
              disabled={count >= MAX_ROWS}
              onClick={() => changeCount(count + 1)}
            >
              增加分层
            </Button>
            <Button size="small" disabled={count <= 2} onClick={() => changeCount(count - 1)}>
              减少分层
            </Button>
            <span className="cssm-hint">最多 {MAX_ROWS} 层</span>
          </Space>

          <Table<Row>
            rowKey="key"
            size="small"
            columns={columns}
            dataSource={preview}
            pagination={false}
            scroll={{ x: 1040 }}
          />
        </>
      ) : (
        <Alert type="info" showIcon title="请先在存煤结构视图中选中一个煤层" />
      )}

      <Drawer
        title="确认拆分该煤层？"
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        size={420}
        zIndex={2200}
        push={false}
        destroyOnHidden
        footer={
          <div className="cssm-drawer-foot">
            <Button onClick={() => setConfirmOpen(false)}>返回修改</Button>
            <Button
              type="primary"
              onClick={() => {
                setConfirmOpen(false);
                onSubmit(preview);
              }}
            >
              确认拆分
            </Button>
          </div>
        }
      >
        <p className="cssm-confirm-copy">原煤层将被 {count} 个子层替换，并记入调整记录。</p>
      </Drawer>
      <BatchPickerModal
        open={pickerRow !== null}
        batches={ARRIVAL_BATCHES}
        onClose={() => setPickerRow(null)}
        onPick={(batch) => {
          const row = pickerRow;
          setPickerRow(null);
          if (row === null) return;
          setRegNos((prev) => prev.map((item, i) => (i === row ? batch.regNo : item)));
        }}
      />
    </Drawer>
  );
};

export default SplitLayerDrawer;
