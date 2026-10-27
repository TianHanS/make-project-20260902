/**
 * 操作 · 分层合并（合并上层 / 合并下层）
 *
 * 依据在热力图中选中的煤层执行：仅非顶层可合并上层，仅非底层可合并下层。
 * 抽屉内并列展示两层煤的信息，并明确标记哪一层是被合并（吸收）的煤层，
 * 以及合并后的体积、煤量、加权计算密度与新的俯仰夹角区间。
 */

import React from 'react';
import { Alert, Button, Drawer, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import * as geo from '../geometry';
import { coalTypeName, fmt, shortRegNo } from '../data';
import { resolveMergePair, type ComputedLayer, type ComputedZone } from '../model';

interface Props {
  open: boolean;
  /** 未配备盘煤仪时不展示层厚和角度 */
  spatial: boolean;
  zone: ComputedZone | null;
  layerId: string | null;
  direction: 'up' | 'down';
  onClose: () => void;
  onSubmit: () => void;
}

interface PairRow {
  key: string;
  role: 'keep' | 'absorbed';
  layer: ComputedLayer;
}

const MergeLayerDrawer: React.FC<Props> = ({
  open,
  spatial,
  zone,
  layerId,
  direction,
  onClose,
  onSubmit,
}) => {
  const pair = zone && layerId ? resolveMergePair(zone, layerId, direction) : null;

  const rows: PairRow[] = pair
    ? (
        [
          { key: 'keep', role: 'keep', layer: pair.keep },
          { key: 'absorbed', role: 'absorbed', layer: pair.absorbed },
        ] as PairRow[]
      ).sort((a, b) => b.layer.seq - a.layer.seq)
    : [];

  const merged = pair
    ? (() => {
        const volume = pair.keep.volume + pair.absorbed.volume;
        const density =
          (pair.keep.volume * pair.keep.raw.density +
            pair.absorbed.volume * pair.absorbed.raw.density) /
          volume;
        const lowerSeq = Math.min(pair.keep.seq, pair.absorbed.seq);
        const base =
          lowerSeq === pair.keep.seq ? pair.keep.bound : pair.absorbed.bound;
        const heightBottom = base.heightBottom;
        const g = zone!.geometry;
        const heightTop = geo.heightFromVolume(g, geo.stackVolume(g, heightBottom) + volume);
        return {
          volume,
          density,
          mass: volume * density,
          heightBottom,
          heightTop,
          pitchBottom: geo.pitchFromHeight(g, heightBottom),
          pitchTop: geo.pitchFromHeight(g, heightTop),
        };
      })()
    : null;

  const columns: ColumnsType<PairRow> = [
    {
      title: '煤层',
      key: 'seq',
      width: 120,
      render: (_, r) => (
        <span className="cssm-num">
          第 {r.layer.seq} 层
          {r.layer.seq === zone?.layers.length ? '（表层）' : r.layer.seq === 1 ? '（底层）' : ''}
        </span>
      ),
    },
    {
      title: '合并角色',
      key: 'role',
      width: 128,
      render: (_, r) =>
        r.role === 'keep' ? (
          <Tag color="blue" style={{ marginInlineEnd: 0 }}>
            保留批次归属
          </Tag>
        ) : (
          <Tag color="red" style={{ marginInlineEnd: 0 }}>
            被合并煤层
          </Tag>
        ),
    },
    {
      title: '入厂登记编号',
      key: 'reg',
      width: 156,
      render: (_, r) =>
        r.layer.raw.regNo ? (
          shortRegNo(r.layer.raw.regNo)
        ) : (
          <span style={{ color: '#cf1322' }}>待标记</span>
        ),
    },
    {
      title: '库存煤种',
      key: 'coalType',
      width: 100,
      render: (_, r) => (r.layer.raw.coalType ? coalTypeName(r.layer.raw.coalType) : '—'),
    },
    {
      title: '体积 m³',
      key: 'volume',
      width: 100,
      align: 'right',
      render: (_, r) => <span className="cssm-num">{fmt(r.layer.volume)}</span>,
    },
    {
      title: '煤量 t',
      key: 'mass',
      width: 100,
      align: 'right',
      render: (_, r) => <span className="cssm-num">{fmt(r.layer.mass)}</span>,
    },
    {
      title: '层厚 m',
      key: 'thickness',
      width: 94,
      align: 'right',
      render: (_, r) => <span className="cssm-num">{r.layer.thickness.toFixed(2)}</span>,
    },
    {
      title: '起始 / 结束角度',
      key: 'pitch',
      render: (_, r) => (
        <span className="cssm-num">
          {r.layer.bound.pitchBottom.toFixed(2)}° ~ {r.layer.bound.pitchTop.toFixed(2)}°
        </span>
      ),
    },
  ].filter((column) => spatial || !['thickness', 'pitch'].includes(String(column.key)));

  const differentBatch =
    pair && pair.keep.raw.regNo !== pair.absorbed.raw.regNo;

  return (
    <Drawer
      title={direction === 'up' ? '分层合并 · 合并上层' : '分层合并 · 合并下层'}
      open={open}
      onClose={onClose}
      size="min(1020px, 96vw)"
      destroyOnHidden
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="cssm-hint">
            {merged
              ? `合并后 1 层 · ${fmt(merged.volume)} m³ / ${fmt(merged.mass)} t · 密度 ${merged.density.toFixed(3)} t/m³`
              : '无可合并的相邻煤层'}
          </span>
          <Space>
            <Button onClick={onClose}>取消</Button>
            <Button type="primary" disabled={!pair} onClick={onSubmit}>
              确认合并
            </Button>
          </Space>
        </div>
      }
    >
      {pair && zone && merged ? (
        <>
          {differentBatch && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              title="两层煤的入厂批次不同"
              description={`合并后将统一归属 ${
                pair.keep.raw.regNo ? shortRegNo(pair.keep.raw.regNo) : '待标记'
              }，第 ${pair.absorbed.seq} 层原有的批次与煤质信息将不再单独保留。`}
            />
          )}

          <h3 className="cssm-drawer-h3">参与合并的两层煤</h3>
          <Table<PairRow>
            rowKey="key"
            size="small"
            columns={columns}
            dataSource={rows}
            pagination={false}
            rowClassName={(r) => (r.role === 'absorbed' ? 'cssm-row-absorbed' : '')}
            scroll={{ x: 900 }}
          />

          <h3 className="cssm-drawer-h3" style={{ marginTop: 18 }}>
            合并结果
          </h3>
          <div className="cssm-match">
            <div className="cssm-match-cell">
              <div className="cssm-match-k">合并后体积</div>
              <div className="cssm-match-v cssm-num is-ok">
                {fmt(merged.volume)}
                <small>m³</small>
              </div>
            </div>
            <div className="cssm-match-cell">
              <div className="cssm-match-k">合并后煤量</div>
              <div className="cssm-match-v cssm-num is-ok">
                {fmt(merged.mass)}
                <small>t</small>
              </div>
            </div>
            <div className="cssm-match-cell">
              <div className="cssm-match-k">计算密度</div>
              <div className="cssm-match-v cssm-num">
                {merged.density.toFixed(3)}
                <small>t/m³</small>
              </div>
            </div>
            {spatial && (
              <div className="cssm-match-cell">
                <div className="cssm-match-k">起始 / 结束角度</div>
                <div className="cssm-match-v cssm-num">
                  {merged.pitchBottom.toFixed(2)}° ~ {merged.pitchTop.toFixed(2)}°
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <Alert
          type="info"
          showIcon
          title={
            direction === 'up'
              ? '该煤层为表层，上方无相邻煤层可合并'
              : '该煤层为底层，下方无相邻煤层可合并'
          }
        />
      )}
    </Drawer>
  );
};

export default MergeLayerDrawer;
