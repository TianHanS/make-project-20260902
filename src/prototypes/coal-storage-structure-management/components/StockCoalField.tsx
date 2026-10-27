/**
 * 库存煤种 + 色值。
 * 交互对齐来煤预报的煤种配置：选择已有煤种带出色值，输入新煤种后自动分配未占用色值，色值可改。
 */

import React, { useEffect, useRef } from 'react';
import { AutoComplete, ColorPicker } from 'antd';
import {
  colorForStockName,
  normalizeColor,
  type StockCoal,
} from '../data';

interface Props {
  coals: StockCoal[];
  /** 打开新一条记录时重置，避免色板变化打断正在输入的煤种和色值 */
  resetKey?: string;
  value?: string;
  onChange?: (name: string) => void;
  color: string;
  onColorChange: (color: string) => void;
  error?: string;
  /** 确认时读取已经按规则补全的煤种名和色值 */
  readerRef?: React.MutableRefObject<(() => { name: string; color: string }) | null>;
}

const StockCoalField: React.FC<Props> = ({
  coals,
  resetKey = '',
  value = '',
  onChange,
  color,
  onColorChange,
  error,
  readerRef,
}) => {
  const nameRef = useRef(value);
  const colorRef = useRef(color);
  const colorTouched = useRef(false);
  const coalsRef = useRef(coals);
  coalsRef.current = coals;
  nameRef.current = value;
  colorRef.current = color;

  useEffect(() => {
    const hit = coalsRef.current.find((item) => item.name === nameRef.current.trim());
    colorTouched.current = false;
    const next = hit?.color ?? '';
    colorRef.current = next;
    onColorChange(next);
    // 只在切换记录时回填色值。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const assignColor = (nameInput: string, colorInput: string, touched: boolean) => {
    const next = colorForStockName(nameInput, colorInput, coalsRef.current, touched);
    colorRef.current = next;
    onColorChange(next);
    return next;
  };

  useEffect(() => {
    if (!readerRef) return undefined;
    readerRef.current = () => ({
      name: nameRef.current.trim(),
      color: assignColor(nameRef.current, colorRef.current, colorTouched.current),
    });
    return () => {
      readerRef.current = null;
    };
  });

  const applyName = (nextName: string) => {
    nameRef.current = nextName;
    onChange?.(nextName);
    const trimmed = nextName.trim();
    if (!trimmed) {
      colorTouched.current = false;
      colorRef.current = '';
      onColorChange('');
      return;
    }
    const hit = coalsRef.current.find((item) => item.name === trimmed);
    if (hit) {
      colorTouched.current = false;
      colorRef.current = hit.color;
      onColorChange(hit.color);
      return;
    }
    queueMicrotask(() => {
      if (nameRef.current.trim() !== trimmed) return;
      assignColor(nameRef.current, colorRef.current, colorTouched.current);
    });
  };

  const pickColor = (nextColor: string) => {
    const normalized = normalizeColor(nextColor);
    if (!normalized || normalized === normalizeColor(colorRef.current)) return;
    colorTouched.current = true;
    colorRef.current = normalized;
    onColorChange(normalized);
  };

  const normalized = normalizeColor(color);

  return (
    <div className="cssm-stock-span">
      <div className="cssm-stock-row">
        <div>
          <label className="cssm-req" htmlFor="cssm-stock-coal">
            库存煤种
          </label>
          <AutoComplete
            id="cssm-stock-coal"
            style={{ width: '100%' }}
            value={value}
            options={coals.map((item) => ({ value: item.name }))}
            filterOption={(input, option) => String(option?.value ?? '').includes(input.trim())}
            placeholder="选择已有库存煤种，或输入新煤种"
            allowClear
            onChange={applyName}
            onBlur={() => {
              assignColor(nameRef.current, colorRef.current, colorTouched.current);
            }}
          />
        </div>
        <div>
          <label className="cssm-req">色值</label>
          <ColorPicker
            value={normalized || undefined}
            showText
            disabledAlpha
            format="hex"
            onChange={(next) => pickColor(next.toHexString())}
          />
        </div>
      </div>
      {error ? <p className="cssm-stock-error">{error}</p> : null}
    </div>
  );
};

export default StockCoalField;
