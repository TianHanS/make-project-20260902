/**
 * 燃煤入厂登记 - 轻量 UI（不依赖 antd / dayjs）
 */
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Loader2, X } from 'lucide-react';

/* ---------------- utils ---------------- */
export function useClickOutside<T extends HTMLElement>(ref: React.RefObject<T | null>, handler: () => void) {
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) handler();
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [ref, handler]);
}

export function formatDateTime(input?: string | Date | null): string {
  const d = input == null || input === '' ? new Date() : input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function parseTime(input?: string | null): number {
  if (!input) return 0;
  const t = new Date(input.replace(/-/g, '/')).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/* ---------------- message ---------------- */
type MsgType = 'success' | 'info' | 'warning' | 'error' | 'loading';
interface Msg {
  id: number;
  key?: string;
  type: MsgType;
  content: string;
}
type Listener = (msgs: Msg[]) => void;

let idSeq = 0;
let msgStore: Msg[] = [];
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l([...msgStore]));
}

function pushMsg(type: MsgType, content: string, key?: string, duration = 2600) {
  if (key) msgStore = msgStore.filter((m) => m.key !== key);
  const id = ++idSeq;
  msgStore = [...msgStore, { id, key, type, content }];
  emit();
  if (duration > 0) {
    window.setTimeout(() => {
      msgStore = msgStore.filter((m) => m.id !== id);
      emit();
    }, duration);
  }
  return id;
}

export const message = {
  success: (c: string) => pushMsg('success', c),
  info: (c: string) => pushMsg('info', c),
  warning: (c: string) => pushMsg('warning', c),
  error: (c: string) => pushMsg('error', c),
  loading: (opts: { content: string; key?: string; duration?: number } | string) => {
    if (typeof opts === 'string') return pushMsg('loading', opts, undefined, 0);
    return pushMsg('loading', opts.content, opts.key, opts.duration ?? 0);
  },
  destroy: (key?: string) => {
    msgStore = key ? msgStore.filter((m) => m.key !== key) : [];
    emit();
  },
};

export function MessageHost() {
  const [msgs, setMsgs] = useState<Msg[]>(msgStore);
  useEffect(() => {
    const l: Listener = (next) => setMsgs(next);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  if (msgs.length === 0) return null;
  return createPortal(
    <div className="mer-msg-host">
      {msgs.map((m) => (
        <div key={m.id} className={`mer-msg mer-msg-${m.type}`}>
          {m.type === 'loading' ? <Loader2 size={14} className="mer-spin-icon" /> : null}
          <span>{m.content}</span>
        </div>
      ))}
    </div>,
    document.body,
  );
}

/* ---------------- Button ---------------- */
export function Button({
  type = 'default',
  size = 'middle',
  danger = false,
  ghost = false,
  block = false,
  disabled = false,
  loading = false,
  icon,
  children,
  onClick,
  className = '',
  style,
  htmlType = 'button',
}: {
  type?: 'default' | 'primary' | 'dashed' | 'link' | 'text';
  size?: 'small' | 'middle' | 'large';
  danger?: boolean;
  ghost?: boolean;
  block?: boolean;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  style?: React.CSSProperties;
  htmlType?: 'button' | 'submit';
}) {
  const cls = [
    'mer-btn',
    `mer-btn-${type}`,
    `mer-btn-${size}`,
    danger ? 'is-danger' : '',
    ghost ? 'is-ghost' : '',
    block ? 'is-block' : '',
    loading ? 'is-loading' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type={htmlType}
      className={cls}
      style={style}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading ? <Loader2 size={14} className="mer-spin-icon" /> : icon ? <span className="mer-btn-icon">{icon}</span> : null}
      {children != null ? <span>{children}</span> : null}
    </button>
  );
}

/* ---------------- Space ---------------- */
export function Space({
  wrap = false,
  size = 8,
  children,
  className = '',
  style,
}: {
  wrap?: boolean;
  size?: number | [number, number];
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const gap = Array.isArray(size) ? `${size[1]}px ${size[0]}px` : `${size}px`;
  return (
    <div className={`mer-space${wrap ? ' is-wrap' : ''} ${className}`.trim()} style={{ gap, ...style }}>
      {children}
    </div>
  );
}

/* ---------------- Tag ---------------- */
export function Tag({
  color = 'default',
  children,
  className = '',
  style,
}: {
  color?: 'default' | 'processing' | 'success' | 'error' | 'warning';
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span className={`mer-tag mer-tag-${color} ${className}`.trim()} style={style}>
      {children}
    </span>
  );
}

/* ---------------- Spin ---------------- */
export function Spin({
  tip,
  size = 'default',
  indicator,
  children,
}: {
  tip?: string;
  size?: 'small' | 'default' | 'large';
  indicator?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const icon =
    indicator ?? (
      <Loader2
        size={size === 'small' ? 14 : size === 'large' ? 28 : 20}
        className="mer-spin-icon"
      />
    );
  return (
    <div className={`mer-spin mer-spin-${size}`}>
      <div className="mer-spin-indicator">{icon}</div>
      {tip ? <div className="mer-spin-tip">{tip}</div> : null}
      {children}
    </div>
  );
}

/* ---------------- Empty ---------------- */
export function Empty({ description = '暂无数据' }: { description?: React.ReactNode }) {
  return (
    <div className="mer-empty">
      <div className="mer-empty-icon">∅</div>
      <div className="mer-empty-desc">{description}</div>
    </div>
  );
}
Empty.PRESENTED_IMAGE_SIMPLE = null;

/* ---------------- Alert ---------------- */
export function Alert({
  type = 'info',
  message: msg,
  showIcon,
}: {
  type?: 'info' | 'success' | 'warning' | 'error';
  message: React.ReactNode;
  showIcon?: boolean;
}) {
  return (
    <div className={`mer-alert mer-alert-${type}`}>
      {showIcon ? <span className="mer-alert-icon">i</span> : null}
      <span>{msg}</span>
    </div>
  );
}

/* ---------------- Result ---------------- */
export function Result({
  status = 'info',
  title,
  subTitle,
}: {
  status?: 'success' | 'error' | 'warning' | 'info';
  title?: React.ReactNode;
  subTitle?: React.ReactNode;
}) {
  return (
    <div className={`mer-result mer-result-${status}`}>
      <div className="mer-result-icon">{status === 'warning' ? '!' : status === 'error' ? '×' : '✓'}</div>
      {title ? <div className="mer-result-title">{title}</div> : null}
      {subTitle ? <div className="mer-result-sub">{subTitle}</div> : null}
    </div>
  );
}

/* ---------------- Input / TextArea / InputNumber ---------------- */
export function Input({
  value,
  onChange,
  placeholder,
  disabled,
  className = '',
  style,
  id,
  autoFocus,
  onFocus,
  onBlur,
  onKeyDown,
}: {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  autoFocus?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <input
      id={id}
      className={`mer-input ${className}`.trim()}
      style={style}
      value={value ?? ''}
      disabled={disabled}
      placeholder={placeholder}
      autoFocus={autoFocus}
      onChange={onChange}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  disabled,
  rows = 3,
  id,
  autoFocus,
  className = '',
  onPressEnter,
}: {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  id?: string;
  autoFocus?: boolean;
  className?: string;
  onPressEnter?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  return (
    <textarea
      id={id}
      className={`mer-textarea ${className}`.trim()}
      value={value ?? ''}
      disabled={disabled}
      rows={rows}
      placeholder={placeholder}
      autoFocus={autoFocus}
      onChange={onChange}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && onPressEnter) onPressEnter(e);
      }}
    />
  );
}
Input.TextArea = TextArea;

export function InputNumber({
  value,
  onChange,
  min,
  max,
  step = 1,
  precision,
  placeholder,
  disabled,
  className = '',
  size = 'middle',
}: {
  value?: number | null;
  onChange?: (v: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  size?: 'small' | 'middle';
}) {
  return (
    <input
      type="number"
      className={`mer-input mer-input-number mer-input-${size} ${className}`.trim()}
      value={value ?? ''}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '') {
          onChange?.(null);
          return;
        }
        let n = Number(raw);
        if (precision != null && !Number.isNaN(n)) n = Number(n.toFixed(precision));
        onChange?.(n);
      }}
    />
  );
}

/* ---------------- Select ---------------- */
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export function Select({
  value,
  options,
  onChange,
  placeholder = '请选择',
  allowClear = false,
  disabled = false,
  className = '',
  style,
  size = 'middle',
}: {
  value?: string;
  options: SelectOption[];
  onChange?: (v: string | undefined) => void;
  placeholder?: string;
  allowClear?: boolean;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  size?: 'small' | 'middle';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));
  const current = options.find((o) => o.value === value);
  return (
    <div className={`mer-select-wrap mer-select-${size} ${className}`.trim()} ref={ref} style={style}>
      <div
        className={`mer-select${open ? ' is-open' : ''}${disabled ? ' is-disabled' : ''}`}
        onClick={() => !disabled && setOpen((o) => !o)}
      >
        <span className={current ? 'mer-select-value' : 'mer-select-placeholder'}>
          {current ? current.label : placeholder}
        </span>
        <ChevronDown size={14} className="mer-select-arrow" />
      </div>
      {open ? (
        <div className="mer-select-dropdown">
          {allowClear ? (
            <div
              className="mer-select-option mer-select-clear"
              onClick={() => {
                onChange?.(undefined);
                setOpen(false);
              }}
            >
              清空
            </div>
          ) : null}
          {options.map((o) => (
            <div
              key={o.value}
              className={`mer-select-option${o.value === value ? ' is-selected' : ''}${o.disabled ? ' is-disabled' : ''}`}
              onClick={() => {
                if (!o.disabled) {
                  onChange?.(o.value);
                  setOpen(false);
                }
              }}
            >
              <span>{o.label}</span>
              {o.value === value ? <Check size={14} /> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ---------------- AutoComplete ---------------- */
export function AutoComplete({
  value,
  options,
  open,
  placeholder,
  className = '',
  onFocus,
  onBlur,
  onSearch,
  onSelect,
  onChange,
  onKeyDown,
}: {
  value?: string;
  options: { value: string; label: React.ReactNode }[];
  open?: boolean;
  placeholder?: string;
  className?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  onSearch?: (v: string) => void;
  onSelect?: (v: string) => void;
  onChange?: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const show = Boolean(open && options.length > 0);
  return (
    <div className={`mer-ac ${className}`.trim()} ref={ref}>
      <input
        className="mer-input mer-ac-input"
        value={value ?? ''}
        placeholder={placeholder}
        onFocus={onFocus}
        onBlur={onBlur}
        onChange={(e) => {
          onChange?.(e.target.value);
          onSearch?.(e.target.value);
        }}
        onKeyDown={onKeyDown}
      />
      {show ? (
        <div className="mer-ac-dropdown">
          {options.map((o) => (
            <div
              key={o.value}
              className="mer-ac-option"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect?.(o.value);
                onChange?.(o.value);
              }}
            >
              {o.label}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ---------------- Radio ---------------- */
export function Radio({
  checked,
  onChange,
}: {
  checked?: boolean;
  onChange?: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      className={`mer-radio${checked ? ' is-checked' : ''}`}
      onClick={onChange}
    >
      <i />
    </button>
  );
}

/* ---------------- Descriptions ---------------- */
export function Descriptions({
  children,
  className = '',
  bordered,
  column = 1,
  size = 'small',
}: {
  children?: React.ReactNode;
  className?: string;
  bordered?: boolean;
  column?: number;
  size?: 'small' | 'middle';
}) {
  return (
    <div
      className={`mer-desc mer-desc-${size}${bordered ? ' is-bordered' : ''} ${className}`.trim()}
      style={{ ['--mer-desc-cols' as string]: column }}
    >
      {children}
    </div>
  );
}

function DescriptionsItem({
  label,
  children,
}: {
  label?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mer-desc-item">
      <div className="mer-desc-label">{label}</div>
      <div className="mer-desc-content">{children}</div>
    </div>
  );
}
Descriptions.Item = DescriptionsItem;

/* ---------------- Modal / Drawer ---------------- */
function useOpenLifecycle(open: boolean, afterOpenChange?: (v: boolean) => void) {
  const prev = useRef(open);
  useEffect(() => {
    if (prev.current !== open) {
      afterOpenChange?.(open);
      prev.current = open;
    }
  }, [open, afterOpenChange]);
}

export function Modal({
  open,
  title,
  onCancel,
  onOk,
  okText = '确定',
  okButtonProps,
  footer,
  width = 520,
  centered,
  children,
  destroyOnHidden,
  afterOpenChange,
}: {
  open: boolean;
  title?: React.ReactNode;
  onCancel?: () => void;
  onOk?: () => void;
  okText?: string;
  okButtonProps?: { disabled?: boolean; loading?: boolean };
  footer?: React.ReactNode | null;
  width?: number;
  centered?: boolean;
  children?: React.ReactNode;
  destroyOnHidden?: boolean;
  afterOpenChange?: (v: boolean) => void;
}) {
  useOpenLifecycle(open, afterOpenChange);
  if (!open && destroyOnHidden !== false) return null;
  if (!open) return null;
  const foot =
    footer === null
      ? null
      : footer !== undefined
        ? footer
        : (
            <div className="mer-modal-foot-actions">
              <Button onClick={onCancel}>取消</Button>
              <Button
                type="primary"
                disabled={okButtonProps?.disabled}
                loading={okButtonProps?.loading}
                onClick={onOk}
              >
                {okText}
              </Button>
            </div>
          );
  return createPortal(
    <div
      className={`mer-overlay${centered ? ' is-centered' : ''}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel?.();
      }}
    >
      <div className="mer-modal" style={{ width }} role="dialog" aria-modal="true">
        <div className="mer-modal-head">
          <span className="mer-modal-title">{title}</span>
          <button type="button" className="mer-modal-close" onClick={onCancel} aria-label="关闭">
            <X size={16} />
          </button>
        </div>
        <div className="mer-modal-body">{children}</div>
        {foot != null ? <div className="mer-modal-foot">{foot}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({
  open,
  title,
  onClose,
  footer,
  width = 480,
  children,
  destroyOnHidden,
  afterOpenChange,
  maskClosable = true,
}: {
  open: boolean;
  title?: React.ReactNode;
  onClose?: () => void;
  footer?: React.ReactNode;
  width?: number;
  children?: React.ReactNode;
  destroyOnHidden?: boolean;
  afterOpenChange?: (v: boolean) => void;
  maskClosable?: boolean;
}) {
  useOpenLifecycle(open, afterOpenChange);
  if (!open) return null;
  return createPortal(
    <div
      className="mer-overlay mer-overlay-drawer"
      onMouseDown={(e) => {
        if (maskClosable && e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="mer-drawer" style={{ width }} role="dialog" aria-modal="true">
        <div className="mer-drawer-head">
          <span className="mer-drawer-title">{title}</span>
          <button type="button" className="mer-modal-close" onClick={onClose} aria-label="关闭">
            <X size={16} />
          </button>
        </div>
        <div className="mer-drawer-body">{children}</div>
        {footer != null ? <div className="mer-drawer-foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

/* ---------------- Popconfirm ---------------- */
export function Popconfirm({
  title,
  description,
  okText = '确定',
  cancelText = '取消',
  onConfirm,
  children,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  okText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  children: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  useClickOutside(wrapRef, () => setOpen(false));
  return (
    <span className="mer-popconfirm-wrap" ref={wrapRef}>
      {React.cloneElement(children, {
        onClick: (e: React.MouseEvent) => {
          children.props.onClick?.(e);
          setOpen(true);
        },
      })}
      {open ? (
        <div className="mer-popconfirm" role="dialog">
          <div className="mer-popconfirm-title">{title}</div>
          {description ? <div className="mer-popconfirm-desc">{description}</div> : null}
          <div className="mer-popconfirm-actions">
            <Button size="small" onClick={() => setOpen(false)}>
              {cancelText}
            </Button>
            <Button
              type="primary"
              size="small"
              onClick={() => {
                setOpen(false);
                onConfirm?.();
              }}
            >
              {okText}
            </Button>
          </div>
        </div>
      ) : null}
    </span>
  );
}

/* ---------------- Table ---------------- */
export type ColumnType<T> = {
  title?: React.ReactNode;
  dataIndex?: keyof T | string;
  width?: number | string;
  ellipsis?: boolean;
  fixed?: 'left' | 'right';
  render?: (value: unknown, row: T, index: number) => React.ReactNode;
};

export type ColumnsType<T> = ColumnType<T>[];

export function Table<T extends object>({
  columns,
  dataSource,
  rowKey,
  scroll,
  onRow,
  size = 'small',
  className = '',
}: {
  columns: ColumnsType<T>;
  dataSource: T[];
  rowKey: keyof T | ((row: T) => string);
  scroll?: { x?: number | string; y?: number | string };
  onRow?: (row: T) => { onClick?: () => void; style?: React.CSSProperties };
  size?: 'small' | 'middle';
  className?: string;
  pagination?: false;
}) {
  const getKey = (row: T, i: number) => {
    if (typeof rowKey === 'function') return rowKey(row);
    return String((row as Record<string, unknown>)[rowKey as string] ?? i);
  };
  return (
    <div
      className={`mer-table-wrap mer-table-${size} ${className}`.trim()}
      style={{ overflow: 'auto', maxHeight: scroll?.y, maxWidth: '100%' }}
    >
      <table className="mer-table" style={{ minWidth: scroll?.x }}>
        <thead className="mer-table-thead">
          <tr>
            {columns.map((col, i) => (
              <th key={i} style={{ width: col.width, minWidth: col.width }}>
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataSource.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="mer-table-empty">
                暂无数据
              </td>
            </tr>
          ) : (
            dataSource.map((row, rowIndex) => {
              const rowProps = onRow?.(row) ?? {};
              return (
                <tr key={getKey(row, rowIndex)} onClick={rowProps.onClick} style={rowProps.style}>
                  {columns.map((col, colIndex) => {
                    const raw =
                      col.dataIndex != null
                        ? (row as Record<string, unknown>)[col.dataIndex as string]
                        : undefined;
                    const content = col.render ? col.render(raw, row, rowIndex) : (raw as React.ReactNode);
                    return (
                      <td
                        key={colIndex}
                        className={col.ellipsis ? 'mer-ellipsis' : undefined}
                        title={col.ellipsis && typeof content === 'string' ? content : undefined}
                      >
                        {content}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
