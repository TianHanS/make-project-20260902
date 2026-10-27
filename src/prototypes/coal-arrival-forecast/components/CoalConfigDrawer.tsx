/**
 * 煤种配置
 *
 * 一条预报对应一个库存煤种。选择已有煤种时带出其颜色；
 * 输入新煤种后失焦，自动分配一个未占用色值，用户可在输入框后改色。
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AutoComplete, Button, ColorPicker, Descriptions, Drawer, Popconfirm, Space } from 'antd';
import {
  normalizeColor,
  pickDefaultColor,
  validateStockAssignment,
  type ForecastRow,
  type StockCoal,
} from '../data';

const colorForName = (
  nameInput: string,
  colorInput: string,
  coals: StockCoal[],
  colorTouched: boolean,
) => {
  const trimmed = nameInput.trim();
  if (!trimmed) return '';
  const current = normalizeColor(colorInput);
  const hit = coals.find((item) => item.name === trimmed);
  const takenByOther = Boolean(current) && coals.some((item) => item.color === current && item.name !== trimmed);
  if (hit && !colorTouched) return hit.color;
  if (!current || (!colorTouched && takenByOther)) return pickDefaultColor(coals, trimmed);
  return current;
};

interface Props {
  row: ForecastRow | null;
  coals: StockCoal[];
  rows: ForecastRow[];
  onClose: () => void;
  onSave: (name: string, color: string) => void;
  onClear: () => void;
}

const CoalConfigDrawer: React.FC<Props> = ({ row, coals, rows, onClose, onSave, onClear }) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [error, setError] = useState('');
  const nameRef = useRef('');
  const colorRef = useRef('');
  const colorTouched = useRef(false);
  const coalsRef = useRef(coals);
  coalsRef.current = coals;
  const editingId = row?.id ?? null;
  const boundName = row?.stockCoalName ?? '';

  useEffect(() => {
    if (!editingId) return;
    const bound = coals.find((item) => item.name === boundName);
    nameRef.current = boundName;
    colorRef.current = bound?.color ?? '';
    colorTouched.current = false;
    setName(boundName);
    setColor(colorRef.current);
    setError('');
    // 只在切换预报时回填。色板变化不应打断正在输入的煤种和色值。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

  const cleanupFocus = useRef<(() => void) | null>(null);
  const setInputWrap = useCallback((node: HTMLSpanElement | null) => {
    cleanupFocus.current?.();
    cleanupFocus.current = null;
    if (!node) return;
    const onFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget as Node | null;
      if (next && node.contains(next)) return;
      const assigned = colorForName(nameRef.current, colorRef.current, coalsRef.current, colorTouched.current);
      colorRef.current = assigned;
      setColor(assigned);
    };
    node.addEventListener('focusout', onFocusOut);
    cleanupFocus.current = () => node.removeEventListener('focusout', onFocusOut);
  }, []);

  const normalized = normalizeColor(color);

  const applyName = (value: string) => {
    nameRef.current = value;
    setName(value);
    setError('');
    const trimmed = value.trim();
    if (!trimmed) {
      colorRef.current = '';
      colorTouched.current = false;
      setColor('');
      return;
    }
    const hit = coals.find((item) => item.name === trimmed);
    if (hit) {
      colorRef.current = hit.color;
      colorTouched.current = false;
      setColor(hit.color);
    }
  };

  const pickColor = (value: string) => {
    const next = normalizeColor(value);
    if (!next) return;
    colorTouched.current = true;
    colorRef.current = next;
    setColor(next);
    setError('');
  };

  const handleSave = () => {
    const nextColor = colorForName(nameRef.current, colorRef.current, coals, colorTouched.current);
    colorRef.current = nextColor;
    setColor(nextColor);
    const result = validateStockAssignment(nameRef.current, nextColor, coals);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onSave(result.name, result.color);
  };

  const lastUsage = Boolean(boundName) && rows.filter((item) => item.stockCoalName === boundName).length <= 1;

  return (
    <Drawer
      title="煤种配置"
      width={520}
      open={Boolean(row)}
      onClose={onClose}
      destroyOnHidden
      footer={(
        <div className="caf-drawer-footer">
          {boundName ? (
            <Popconfirm
              title="清除本条预报的库存煤种？"
              description={lastUsage
                ? `这是最后一条使用「${boundName}」的预报，清除后该煤种和色值会从计划中移除。`
                : '其他预报仍使用该煤种时，煤种和色值会保留。'}
              okText="清除"
              cancelText="取消"
              onConfirm={onClear}
            >
              <Button>清除配置</Button>
            </Popconfirm>
          ) : <span />}
          <Space>
            <Button onClick={onClose}>取消</Button>
            <Button type="primary" onClick={handleSave}>确定</Button>
          </Space>
        </div>
      )}
    >
      {row && (
        <div className="caf-drawer">
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="入厂登记编号" span={2}>{row.regNo}</Descriptions.Item>
            <Descriptions.Item label="车船名">{row.vessel}</Descriptions.Item>
            <Descriptions.Item label="航次">{row.voyage}</Descriptions.Item>
            <Descriptions.Item label="煤品种">{row.variety}</Descriptions.Item>
            <Descriptions.Item label="煤种">{row.coalKind}</Descriptions.Item>
            <Descriptions.Item label="计划编号">{row.planNo}</Descriptions.Item>
            <Descriptions.Item label="预报时间">{row.forecastDate}</Descriptions.Item>
            <Descriptions.Item label="供应商名称" span={2}>{row.supplier}</Descriptions.Item>
          </Descriptions>

          <section className="caf-config">
            <h2>库存煤种</h2>
            <div className="caf-coal-row">
              <span className="caf-coal-input" ref={setInputWrap}>
                <AutoComplete
                  value={name}
                  options={coals.map((item) => ({ value: item.name }))}
                  filterOption={(input, option) => String(option?.value ?? '').includes(input.trim())}
                  onChange={applyName}
                  onBlur={() => {
                    const assigned = colorForName(
                      nameRef.current,
                      colorRef.current,
                      coalsRef.current,
                      colorTouched.current,
                    );
                    colorRef.current = assigned;
                    setColor(assigned);
                  }}
                  placeholder="选择已有库存煤种，或输入新煤种"
                  allowClear
                />
              </span>
              <ColorPicker
                value={normalized || undefined}
                showText
                disabledAlpha
                format="hex"
                onChange={(value) => pickColor(value.toHexString())}
              />
            </div>
            {error && <p className="caf-error">{error}</p>}
          </section>
        </div>
      )}
    </Drawer>
  );
};

export default CoalConfigDrawer;
