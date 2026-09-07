/**
 * 自动入厂监测 - 轻量 UI（不依赖 antd）
 */
import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/* ---------------- message ---------------- */
type MessageType = 'success' | 'error' | 'info';

type ToastItem = { id: number; type: MessageType; text: string };

let toastSeq = 0;
const toastListeners = new Set<(items: ToastItem[]) => void>();
let toastItems: ToastItem[] = [];

function emitToasts() {
  toastListeners.forEach((fn) => fn(toastItems));
}

function pushToast(type: MessageType, text: string) {
  const id = ++toastSeq;
  toastItems = [...toastItems, { id, type, text }];
  emitToasts();
  window.setTimeout(() => {
    toastItems = toastItems.filter((item) => item.id !== id);
    emitToasts();
  }, 2400);
}

export const message = {
  success: (text: string) => pushToast('success', text),
  error: (text: string) => pushToast('error', text),
  info: (text: string) => pushToast('info', text),
};

export function MessageHost() {
  const [items, setItems] = useState<ToastItem[]>(toastItems);
  useEffect(() => {
    toastListeners.add(setItems);
    return () => {
      toastListeners.delete(setItems);
    };
  }, []);
  if (items.length === 0) return null;
  return createPortal(
    <div className="aem-toast-host" aria-live="polite">
      {items.map((item) => (
        <div key={item.id} className={`aem-toast aem-toast-${item.type}`}>
          {item.text}
        </div>
      ))}
    </div>,
    document.body,
  );
}

/* ---------------- Segmented ---------------- */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'default',
  className = '',
}: {
  value: T;
  options: Array<{ label: React.ReactNode; value: T }>;
  onChange: (value: T) => void;
  size?: 'default' | 'small';
  className?: string;
}) {
  return (
    <div
      className={`aem-segmented ${size === 'small' ? 'aem-segmented-sm' : ''} ${className}`.trim()}
      role="tablist"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          className={`aem-segmented-item ${value === opt.value ? 'active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Switch ---------------- */
export function Switch({
  checked,
  checkedChildren,
  unCheckedChildren,
  onChange,
}: {
  checked: boolean;
  checkedChildren?: React.ReactNode;
  unCheckedChildren?: React.ReactNode;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`aem-switch ${checked ? 'on' : 'off'}`}
      onClick={() => onChange(!checked)}
    >
      <span className="aem-switch-knob" />
      <span className="aem-switch-text">{checked ? checkedChildren : unCheckedChildren}</span>
    </button>
  );
}

/* ---------------- Tag ---------------- */
export function Tag({
  color = 'default',
  children,
}: {
  color?: 'error' | 'warning' | 'default';
  children: React.ReactNode;
}) {
  return <span className={`aem-tag aem-tag-${color}`}>{children}</span>;
}

/* ---------------- Popconfirm ---------------- */
export function Popconfirm({
  open,
  title,
  description,
  okText = '确认',
  cancelText = '取消',
  danger = false,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean;
  title: React.ReactNode;
  description?: React.ReactNode;
  okText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children: React.ReactElement;
}) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) onCancel();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, onCancel]);

  return (
    <span className="aem-popconfirm-wrap" ref={wrapRef}>
      {children}
      {open ? (
        <div className="aem-popconfirm" role="dialog" aria-labelledby={panelId}>
          <div className="aem-popconfirm-title" id={panelId}>
            {title}
          </div>
          {description ? <div className="aem-popconfirm-desc">{description}</div> : null}
          <div className="aem-popconfirm-actions">
            <button type="button" className="aem-btn aem-btn-default" onClick={onCancel}>
              {cancelText}
            </button>
            <button
              type="button"
              className={`aem-btn ${danger ? 'aem-btn-danger' : 'aem-btn-primary'}`}
              onClick={onConfirm}
            >
              {okText}
            </button>
          </div>
        </div>
      ) : null}
    </span>
  );
}
