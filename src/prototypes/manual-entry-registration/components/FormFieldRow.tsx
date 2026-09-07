/**
 * 表单字段行：只读下划线 / 可编辑 InputNumber / Select
 */
import React from 'react';
import { InputNumber, Select } from 'antd';

interface Props {
  label: string;
  required?: boolean;
  editable?: boolean;
  value?: React.ReactNode;
  emptyText?: string;
  /** number 类型可编辑 */
  numberValue?: number | null;
  onNumberChange?: (v: number | null) => void;
  /** select 类型可编辑 */
  selectValue?: string;
  selectOptions?: string[];
  onSelectChange?: (v: string) => void;
  step?: number;
  precision?: number;
}

const FormFieldRow: React.FC<Props> = ({
  label,
  required,
  editable,
  value,
  emptyText = '—',
  numberValue,
  onNumberChange,
  selectValue,
  selectOptions,
  onSelectChange,
  step = 0.01,
  precision = 2,
}) => {
  if (editable && numberValue !== undefined && onNumberChange) {
    return (
      <div className={`mer-ufield${required ? ' mer-ufield-req' : ''}`}>
        <span className="mer-ufield-label">{label}</span>
        <InputNumber
          className="mer-field-input"
          size="small"
          min={0}
          max={199.99}
          step={step}
          precision={precision}
          value={numberValue}
          placeholder="请输入"
          onChange={(v) => onNumberChange(v == null ? null : Number(v))}
        />
      </div>
    );
  }

  if (editable && selectOptions && onSelectChange) {
    return (
      <div className={`mer-ufield${required ? ' mer-ufield-req' : ''}`}>
        <span className="mer-ufield-label">{label}</span>
        <Select
          className="mer-field-select"
          size="small"
          value={selectValue || undefined}
          placeholder="请选择"
          options={selectOptions.map((o) => ({ value: o, label: o }))}
          onChange={onSelectChange}
        />
      </div>
    );
  }

  const empty =
    value === undefined ||
    value === null ||
    value === '' ||
    (typeof value === 'number' && Number.isNaN(value));

  return (
    <div className={`mer-ufield${required ? ' mer-ufield-req' : ''}`}>
      <span className="mer-ufield-label">{label}</span>
      <span className={`mer-ufield-value${empty ? ' is-empty' : ''}`}>{empty ? emptyText : value}</span>
    </div>
  );
};

export default FormFieldRow;
