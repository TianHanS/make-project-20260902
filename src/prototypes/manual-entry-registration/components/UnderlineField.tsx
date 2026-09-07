/**
 * 只读下划线字段：计划/扫码回填后展示，不可手改
 */
import React from 'react';

interface Props {
  label: string;
  value?: React.ReactNode;
  required?: boolean;
  emptyText?: string;
}

const UnderlineField: React.FC<Props> = ({ label, value, required, emptyText = '—' }) => {
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

export default UnderlineField;
