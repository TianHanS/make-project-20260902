/**
 * 视频权限设置 - 轻量 UI（vp- 前缀）
 */
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, X } from 'lucide-react';

export function useClickOutside<T extends HTMLElement>(ref: React.RefObject<T | null>, handler: () => void) {
    useEffect(() => {
        const fn = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) handler();
        };
        document.addEventListener('mousedown', fn);
        return () => document.removeEventListener('mousedown', fn);
    }, [ref, handler]);
}

export function Button({
    variant = 'default',
    size = 'default',
    disabled = false,
    icon,
    children,
    onClick,
    title,
    className = '',
}: {
    variant?: 'primary' | 'default' | 'dashed' | 'text' | 'link' | 'danger';
    size?: 'small' | 'default';
    disabled?: boolean;
    icon?: React.ReactNode;
    children?: React.ReactNode;
    onClick?: () => void;
    title?: string;
    className?: string;
}) {
    const cls = [
        'vp-btn',
        `vp-btn-${variant}`,
        size === 'small' ? 'vp-btn-sm' : 'vp-btn-md',
        className,
    ]
        .filter(Boolean)
        .join(' ');
    return (
        <button type="button" className={cls} onClick={onClick} disabled={disabled} title={title}>
            {icon ? <span className="vp-btn-icon">{icon}</span> : null}
            {children != null ? <span>{children}</span> : null}
        </button>
    );
}

export function Checkbox({
    checked,
    indeterminate = false,
    onChange,
    children,
    disabled = false,
}: {
    checked: boolean;
    indeterminate?: boolean;
    onChange: (v: boolean) => void;
    children?: React.ReactNode;
    disabled?: boolean;
}) {
    const boxRef = useRef<HTMLSpanElement>(null);
    useEffect(() => {
        const el = boxRef.current;
        if (el) (el as HTMLSpanElement & { indeterminate?: boolean }).dataset.indeterminate = indeterminate ? '1' : '0';
    }, [indeterminate]);
    return (
        <label className={`vp-checkbox${disabled ? ' is-disabled' : ''}`}>
            <span
                ref={boxRef}
                className={`vp-cb-box${checked ? ' is-checked' : ''}${indeterminate && !checked ? ' is-indeterminate' : ''}`}
                onClick={(e) => {
                    e.preventDefault();
                    if (!disabled) onChange(!checked);
                }}
            >
                {checked ? <Check size={11} /> : indeterminate ? <span className="vp-cb-dash" /> : null}
            </span>
            {children != null ? <span className="vp-checkbox-label">{children}</span> : null}
        </label>
    );
}

export function Input({
    value,
    onChange,
    placeholder,
    disabled = false,
}: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    disabled?: boolean;
}) {
    return (
        <input
            className="vp-input"
            value={value}
            disabled={disabled}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
        />
    );
}

export function Select({
    value,
    options,
    onChange,
    placeholder = '请选择',
}: {
    value: string;
    options: { value: string; label: string }[];
    onChange: (v: string) => void;
    placeholder?: string;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useClickOutside(ref, () => setOpen(false));
    const cur = options.find((o) => o.value === value);
    return (
        <div className={`vp-select${open ? ' is-open' : ''}`} ref={ref}>
            <button type="button" className="vp-select-trigger" onClick={() => setOpen((o) => !o)}>
                <span className={cur ? '' : 'is-placeholder'}>{cur?.label || placeholder}</span>
                <ChevronDown size={14} />
            </button>
            {open ? (
                <div className="vp-select-dropdown">
                    {options.map((o) => (
                        <button
                            key={o.value}
                            type="button"
                            className={`vp-select-option${o.value === value ? ' is-active' : ''}`}
                            onClick={() => {
                                onChange(o.value);
                                setOpen(false);
                            }}
                        >
                            {o.label}
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

export function Drawer({
    open,
    title,
    onClose,
    footer,
    width = 720,
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
        <div className="vp-overlay vp-overlay-drawer" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className="vp-drawer" style={{ width }} role="dialog" aria-modal="true">
                <div className="vp-drawer-head">
                    <span className="vp-drawer-title">{title}</span>
                    <button type="button" className="vp-icon-close" onClick={onClose} aria-label="关闭">
                        <X size={16} />
                    </button>
                </div>
                <div className="vp-drawer-body">{children}</div>
                {footer != null ? <div className="vp-drawer-foot">{footer}</div> : null}
            </div>
        </div>,
        document.body,
    );
}

export function Modal({
    open,
    title,
    onClose,
    footer,
    children,
    width = 420,
}: {
    open: boolean;
    title: React.ReactNode;
    onClose: () => void;
    footer?: React.ReactNode;
    children: React.ReactNode;
    width?: number;
}) {
    if (!open) return null;
    return createPortal(
        <div className="vp-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className="vp-modal" style={{ width }} role="dialog" aria-modal="true">
                <div className="vp-modal-head">
                    <span className="vp-modal-title">{title}</span>
                    <button type="button" className="vp-icon-close" onClick={onClose} aria-label="关闭">
                        <X size={16} />
                    </button>
                </div>
                <div className="vp-modal-body">{children}</div>
                {footer != null ? <div className="vp-modal-foot">{footer}</div> : null}
            </div>
        </div>,
        document.body,
    );
}

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
    }, 2800);
}

export const message = {
    success: (c: string) => pushMsg('success', c),
    info: (c: string) => pushMsg('info', c),
    warning: (c: string) => pushMsg('warning', c),
    error: (c: string) => pushMsg('error', c),
};

export function MessageHost() {
    const [msgs, setMsgs] = useState<Msg[]>([]);
    useEffect(() => {
        listeners.add(setMsgs);
        return () => {
            listeners.delete(setMsgs);
        };
    }, []);
    return (
        <div className="vp-msg-host">
            {msgs.map((m) => (
                <div key={m.id} className={`vp-msg vp-msg-${m.type}`}>
                    {m.content}
                </div>
            ))}
        </div>
    );
}
