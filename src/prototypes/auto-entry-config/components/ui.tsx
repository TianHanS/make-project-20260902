/**
 * 自动入厂流程配置 - antd 风格基础组件（手写还原，不依赖 antd）
 * 类名统一使用 ae- 前缀，避免与宿主样式冲突。
 */
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';

/* ---------------- 点击外部关闭 ---------------- */
export function useClickOutside<T extends HTMLElement>(ref: React.RefObject<T>, handler: () => void) {
    useEffect(() => {
        const fn = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) handler();
        };
        document.addEventListener('mousedown', fn);
        return () => document.removeEventListener('mousedown', fn);
    }, [ref, handler]);
}

/* ---------------- Button ---------------- */
export type ButtonVariant = 'primary' | 'default' | 'dashed' | 'text' | 'danger' | 'link';
export type ButtonSize = 'small' | 'default' | 'large';

const SIZE_CLS: Record<ButtonSize, string> = {
    small: 'ae-btn-sm',
    default: 'ae-btn-md',
    large: 'ae-btn-lg',
};

export function Button({
    variant = 'default',
    size = 'default',
    danger = false,
    block = false,
    disabled = false,
    icon,
    children,
    onClick,
    type = 'button',
    title,
    className = '',
}: {
    variant?: ButtonVariant;
    size?: ButtonSize;
    danger?: boolean;
    block?: boolean;
    disabled?: boolean;
    icon?: React.ReactNode;
    children?: React.ReactNode;
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
    type?: 'button' | 'submit';
    title?: string;
    className?: string;
}) {
    const cls = [
        'ae-btn',
        `ae-btn-${variant}`,
        SIZE_CLS[size],
        danger ? 'ae-btn-danger' : '',
        block ? 'ae-btn-block' : '',
        className,
    ]
        .filter(Boolean)
        .join(' ');
    return (
        <button type={type} className={cls} onClick={onClick} disabled={disabled} title={title}>
            {icon ? <span className="ae-btn-icon">{icon}</span> : null}
            {children != null ? <span>{children}</span> : null}
        </button>
    );
}

/* ---------------- Tag ---------------- */
export function Tag({
    color = 'default',
    children,
}: {
    color?: 'success' | 'processing' | 'warning' | 'error' | 'default';
    children: React.ReactNode;
}) {
    return <span className={`ae-tag ae-tag-${color}`}>{children}</span>;
}

/* ---------------- Empty ---------------- */
export function Empty({
    description = '暂无数据',
    icon,
}: {
    description?: React.ReactNode;
    icon?: React.ReactNode;
}) {
    return (
        <div className="ae-empty">
            <div className="ae-empty-icon">{icon}</div>
            <div className="ae-empty-desc">{description}</div>
        </div>
    );
}

/* ---------------- Modal ---------------- */
export function Modal({
    open,
    title,
    onClose,
    footer,
    width = 480,
    children,
    closable = true,
    maskClosable = true,
}: {
    open: boolean;
    title: React.ReactNode;
    onClose: () => void;
    footer?: React.ReactNode;
    width?: number;
    children: React.ReactNode;
    closable?: boolean;
    maskClosable?: boolean;
}) {
    if (!open) return null;
    return createPortal(
        <div
            className="ae-overlay"
            onMouseDown={(e) => {
                if (maskClosable && e.target === e.currentTarget) onClose();
            }}
        >
            <div className="ae-modal" style={{ width }} role="dialog" aria-modal="true">
                <div className="ae-modal-head">
                    <span className="ae-modal-title">{title}</span>
                    {closable ? (
                        <button type="button" className="ae-modal-close" onClick={onClose} aria-label="关闭">
                            <X size={16} />
                        </button>
                    ) : null}
                </div>
                <div className="ae-modal-body">{children}</div>
                {footer != null ? <div className="ae-modal-foot">{footer}</div> : null}
            </div>
        </div>,
        document.body,
    );
}

/* ---------------- Drawer ---------------- */
export function Drawer({
    open,
    title,
    onClose,
    footer,
    width = 480,
    children,
}: {
    open: boolean;
    title: React.ReactNode;
    onClose: () => void;
    footer?: React.ReactNode;
    width?: number;
    children: React.ReactNode;
}) {
    if (!open) return null;
    return createPortal(
        <div
            className="ae-overlay ae-overlay-drawer"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="ae-drawer" style={{ width }} role="dialog" aria-modal="true">
                <div className="ae-drawer-head">
                    <span className="ae-drawer-title">{title}</span>
                    <button type="button" className="ae-modal-close" onClick={onClose} aria-label="关闭">
                        <X size={16} />
                    </button>
                </div>
                <div className="ae-drawer-body">{children}</div>
                {footer != null ? <div className="ae-drawer-foot">{footer}</div> : null}
            </div>
        </div>,
        document.body,
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
    style,
}: {
    value: string;
    options: SelectOption[];
    onChange: (v: string) => void;
    placeholder?: string;
    allowClear?: boolean;
    disabled?: boolean;
    style?: React.CSSProperties;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useClickOutside(ref, () => setOpen(false));
    const current = options.find((o) => o.value === value);
    return (
        <div className="ae-select-wrap" ref={ref} style={style}>
            <div
                className={`ae-select${open ? ' is-open' : ''}${disabled ? ' is-disabled' : ''}`}
                onClick={() => !disabled && setOpen((o) => !o)}
            >
                <span className={current ? 'ae-select-value' : 'ae-select-placeholder'}>
                    {current ? current.label : placeholder}
                </span>
                <ChevronDown size={14} className="ae-select-arrow" />
            </div>
            {open ? (
                <div className="ae-select-dropdown">
                    {allowClear ? (
                        <div
                            className="ae-select-option ae-select-clear"
                            onClick={() => {
                                onChange('');
                                setOpen(false);
                            }}
                        >
                            清空
                        </div>
                    ) : null}
                    {options.map((o) => (
                        <div
                            key={o.value}
                            className={`ae-select-option${o.value === value ? ' is-selected' : ''}${o.disabled ? ' is-disabled' : ''}`}
                            onClick={() => {
                                if (!o.disabled) {
                                    onChange(o.value);
                                    setOpen(false);
                                }
                            }}
                        >
                            <span className="ae-select-option-label">{o.label}</span>
                            {o.value === value ? <Check size={14} className="ae-select-check" /> : null}
                        </div>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

/* ---------------- DatePicker ---------------- */
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function monthStart(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number): Date {
    return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function parseLocalDate(s: string): Date | null {
    if (!s) return null;
    const [y, m, d] = s.split('-').map((v) => Number(v));
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
}

export function DatePicker({
    value,
    onChange,
    placeholder = '请选择日期',
    style,
}: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    style?: React.CSSProperties;
}) {
    const [open, setOpen] = useState(false);
    const base = parseLocalDate(value) || new Date();
    const [view, setView] = useState<Date>(monthStart(base));
    const ref = useRef<HTMLDivElement>(null);
    useClickOutside(ref, () => setOpen(false));

    const year = view.getFullYear();
    const month = view.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const lead = new Date(year, month, 1).getDay();
    const cells: (number | null)[] = [
        ...Array.from({ length: lead }, () => null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    const selectDay = (day: number) => {
        const d = new Date(year, month, day);
        onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
        setOpen(false);
    };

    const selectedDate = parseLocalDate(value);

    return (
        <div className="ae-datepicker" ref={ref} style={style}>
            <div className="ae-datepicker-input" onClick={() => setOpen((o) => !o)}>
                <span className={value ? 'ae-datepicker-value' : 'ae-datepicker-placeholder'}>
                    {value || placeholder}
                </span>
                <svg className="ae-datepicker-icon" viewBox="0 0 1024 1024" width="14" height="14" aria-hidden="true">
                    <path
                        fill="currentColor"
                        d="M880 184H712v-64c0-4.4-3.6-8-8-8h-56c-4.4 0-8 3.6-8 8v64H384v-64c0-4.4-3.6-8-8-8h-56c-4.4 0-8 3.6-8 8v64H144c-17.7 0-32 14.3-32 32v664c0 17.7 14.3 32 32 32h736c17.7 0 32-14.3 32-32V216c0-17.7-14.3-32-32-32zM648 298v24c0 4.4-3.6 8-8 8h-56c-4.4 0-8-3.6-8-8v-24H384v24c0 4.4-3.6 8-8 8h-56c-4.4 0-8-3.6-8-8v-24H168v104h688V298H648zM856 856H168V456h688v400z"
                    />
                </svg>
            </div>
            {open ? (
                <div className="ae-datepicker-popover">
                    <div className="ae-datepicker-head">
                        <button type="button" className="ae-datepicker-nav" onClick={() => setView(addMonths(view, -1))} aria-label="上个月">
                            <ChevronLeft size={14} />
                        </button>
                        <span className="ae-datepicker-title">
                            {year} 年 {month + 1} 月
                        </span>
                        <button type="button" className="ae-datepicker-nav" onClick={() => setView(addMonths(view, 1))} aria-label="下个月">
                            <ChevronRight size={14} />
                        </button>
                    </div>
                    <div className="ae-datepicker-week">
                        {WEEKDAYS.map((w) => (
                            <span key={w}>{w}</span>
                        ))}
                    </div>
                    <div className="ae-datepicker-grid">
                        {cells.map((day, i) => {
                            if (day == null) return <span key={i} className="ae-datepicker-cell is-empty" />;
                            const isSelected =
                                !!selectedDate &&
                                selectedDate.getFullYear() === year &&
                                selectedDate.getMonth() === month &&
                                selectedDate.getDate() === day;
                            const isToday =
                                new Date().getFullYear() === year &&
                                new Date().getMonth() === month &&
                                new Date().getDate() === day;
                            return (
                                <span
                                    key={i}
                                    className={`ae-datepicker-cell${isSelected ? ' is-selected' : ''}${isToday ? ' is-today' : ''}`}
                                    onClick={() => selectDay(day)}
                                >
                                    {day}
                                </span>
                            );
                        })}
                    </div>
                    <div className="ae-datepicker-footer">
                        <button type="button" onClick={() => selectDay(new Date().getDate())}>
                            今天
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

/* ---------------- 表单控件 ---------------- */
export function Field({
    label,
    required = false,
    extra,
    children,
}: {
    label: React.ReactNode;
    required?: boolean;
    extra?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="ae-field">
            <label className="ae-field-label">
                {required ? <span className="ae-field-required">*</span> : null}
                {label}
            </label>
            <div className="ae-field-control">{children}</div>
            {extra ? <div className="ae-field-extra">{extra}</div> : null}
        </div>
    );
}

export function Input({
    value,
    onChange,
    placeholder,
    maxLength,
    disabled = false,
    onFocus,
    className = '',
}: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    maxLength?: number;
    disabled?: boolean;
    onFocus?: () => void;
    className?: string;
}) {
    return (
        <input
            className={`ae-input${className ? ` ${className}` : ''}`}
            value={value}
            disabled={disabled}
            maxLength={maxLength}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            onFocus={onFocus}
        />
    );
}

export function TextArea({
    value,
    onChange,
    placeholder,
    rows = 4,
    maxLength,
}: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    rows?: number;
    maxLength?: number;
}) {
    return (
        <textarea
            className="ae-textarea"
            value={value}
            rows={rows}
            maxLength={maxLength}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
        />
    );
}

/* ---------------- Checkbox ---------------- */
export function Checkbox({
    checked,
    onChange,
    children,
}: {
    checked: boolean;
    onChange: (v: boolean) => void;
    children?: React.ReactNode;
}) {
    return (
        <label className="ae-checkbox" onClick={() => onChange(!checked)}>
            <span className={`ae-cb-box${checked ? ' is-checked' : ''}`}>{checked ? <Check size={11} /> : null}</span>
            {children != null ? <span className="ae-checkbox-label">{children}</span> : null}
        </label>
    );
}

/* ---------------- 轻量消息 ---------------- */
type MsgType = 'success' | 'info' | 'warning' | 'error';
interface Msg {
    id: number;
    type: MsgType;
    content: string;
}
type Listener = (msgs: Msg[]) => void;

let idSeq = 0;
let msgStore: Msg[] = [];
const listeners = new Set<Listener>();

function pushMsg(type: MsgType, content: string) {
    const id = ++idSeq;
    msgStore = [...msgStore, { id, type, content }];
    listeners.forEach((l) => l([...msgStore]));
    window.setTimeout(() => {
        msgStore = msgStore.filter((m) => m.id !== id);
        listeners.forEach((l) => l([...msgStore]));
    }, 2600);
}

export const message = {
    success: (c: string) => pushMsg('success', c),
    info: (c: string) => pushMsg('info', c),
    warning: (c: string) => pushMsg('warning', c),
    error: (c: string) => pushMsg('error', c),
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
    return (
        <div className="ae-msg-host">
            {msgs.map((m) => (
                <div key={m.id} className={`ae-msg ae-msg-${m.type}`}>
                    <span className="ae-msg-icon">
                        {m.type === 'success' ? (
                            <Check size={14} />
                        ) : m.type === 'error' || m.type === 'warning' ? (
                            '!'
                        ) : (
                            'i'
                        )}
                    </span>
                    <span>{m.content}</span>
                </div>
            ))}
        </div>
    );
}