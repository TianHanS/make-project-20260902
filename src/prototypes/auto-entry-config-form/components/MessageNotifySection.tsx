import React, { useRef, useState } from 'react';
import { MESSAGE_PLACEHOLDERS, NotifyItem } from '../data';
import { Button, Checkbox, message } from './ui';

type FocusTarget = { cardKey: string; field: 'broadcast' | 'led' };

const WBM_PLACEHOLDERS = [...MESSAGE_PLACEHOLDERS, { key: '重量', token: '{重量}' }] as const;

function renderTestContent(template: string): string {
    return template
        .replace(/\{\/n\/\}/g, '\n')
        .replace(/\{[^{}]+\}/g, '— —')
        .trim();
}

export type MessageNotifyItem = {
    key: string;
    title: string;
    value: NotifyItem;
    onChange: (v: NotifyItem) => void;
};

/** 与高级参数 / AER 一致的消息通知配置（占位符 + 发送测试 + 广播/LED） */
export function MessageNotifySection({ items }: { items: MessageNotifyItem[] }) {
    const focusRef = useRef<{ target: FocusTarget; el: HTMLInputElement } | null>(null);
    const [focusKey, setFocusKey] = useState<string | null>(null);

    const insertToken = (token: string) => {
        const cur = focusRef.current;
        if (!cur) return;
        const item = items.find((i) => i.key === cur.target.cardKey);
        if (!item) return;
        const field = cur.target.field;
        const enabled = field === 'broadcast' ? item.value.broadcastEnabled : item.value.ledEnabled;
        if (!enabled) return;
        const el = cur.el;
        const start = el.selectionStart ?? item.value[field].length;
        const end = el.selectionEnd ?? item.value[field].length;
        const nextText = item.value[field].slice(0, start) + token + item.value[field].slice(end);
        item.onChange({ ...item.value, [field]: nextText });
        const caret = start + token.length;
        requestAnimationFrame(() => {
            el.focus();
            el.setSelectionRange(caret, caret);
        });
    };

    const sendTest = (item: MessageNotifyItem) => {
        const { broadcastEnabled, ledEnabled } = item.value;
        if (!broadcastEnabled && !ledEnabled) {
            message.warning('请先启用广播或 LED 后再发送测试');
            return;
        }
        const parts: string[] = [];
        let pushed = 0;
        if (broadcastEnabled) {
            const raw = item.value.broadcast.trim();
            const text = raw ? renderTestContent(raw) : '';
            if (text) {
                parts.push(`广播「${text}」`);
                pushed += 1;
            } else {
                parts.push('广播（内容为空，已跳过）');
            }
        } else {
            parts.push('广播（未启用）');
        }
        if (ledEnabled) {
            const raw = item.value.led.trim();
            const text = raw ? renderTestContent(raw) : '';
            if (text) {
                parts.push(`LED「${text}」`);
                pushed += 1;
            } else {
                parts.push('LED（内容为空，已跳过）');
            }
        } else {
            parts.push('LED（未启用）');
        }
        if (pushed === 0) {
            message.warning('已启用通道内容均为空，未推送');
            return;
        }
        message.success(
            `已下发「${item.title}」测试至对应设备（变量以 — — 占位）：${parts.join('；')}`,
        );
    };

    if (!items.length) return null;

    return (
        <section className="ae-msg-cfg">
            <header className="ae-msg-cfg-head">
                <h4>
                    <span className="ae-msg-cfg-dot" />
                    消息通知配置
                </h4>
                <p>每组可分别设定广播 / LED 是否启用及推送内容；未启用或内容为空则不推送该通道</p>
            </header>
            <div className="ae-msg-placeholders">
                <div className="ae-msg-placeholders-label">插入占位符（光标点选按钮）</div>
                <div className="ae-msg-placeholders-btns">
                    {WBM_PLACEHOLDERS.map((p) => (
                        <button
                            key={p.key}
                            type="button"
                            className="ae-msg-ph-btn"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => insertToken(p.token)}
                            title={`插入 ${p.token}`}
                        >
                            {p.key}
                        </button>
                    ))}
                </div>
                {!focusKey ? (
                    <p className="ae-msg-ph-tip">先点击下方任一输入框，再点选变量插入到光标位置</p>
                ) : null}
            </div>
            <div className={`ae-msg-grid${items.length === 1 ? ' is-single' : ''}`}>
                {items.map((item) => {
                    const anyChannelOn = item.value.broadcastEnabled || item.value.ledEnabled;
                    const broadcastOff = !item.value.broadcastEnabled;
                    const ledOff = !item.value.ledEnabled;
                    return (
                        <article
                            key={item.key}
                            className={`ae-msg-card${focusKey?.startsWith(item.key) ? ' is-active' : ''}`}
                        >
                            <div className="ae-msg-card-title-row">
                                <h5>{item.title}</h5>
                                <Button
                                    size="small"
                                    disabled={!anyChannelOn}
                                    onClick={() => sendTest(item)}
                                    title="仅向已启用且内容非空的通道下发测试，变量以 — — 占位"
                                >
                                    发送测试
                                </Button>
                            </div>
                            <div
                                className={`ae-msg-channel${
                                    focusKey === `${item.key}:broadcast` ? ' is-focus' : ''
                                }${broadcastOff ? ' is-off' : ''}`}
                            >
                                <Checkbox
                                    checked={item.value.broadcastEnabled}
                                    onChange={(broadcastEnabled) =>
                                        item.onChange({ ...item.value, broadcastEnabled })
                                    }
                                >
                                    广播
                                </Checkbox>
                                <input
                                    className="ae-input"
                                    disabled={broadcastOff}
                                    value={item.value.broadcast}
                                    placeholder="广播内容"
                                    onFocus={(e) => {
                                        focusRef.current = {
                                            target: { cardKey: item.key, field: 'broadcast' },
                                            el: e.currentTarget,
                                        };
                                        setFocusKey(`${item.key}:broadcast`);
                                    }}
                                    onChange={(e) =>
                                        item.onChange({ ...item.value, broadcast: e.target.value })
                                    }
                                />
                            </div>
                            <div
                                className={`ae-msg-channel${
                                    focusKey === `${item.key}:led` ? ' is-focus' : ''
                                }${ledOff ? ' is-off' : ''}`}
                            >
                                <Checkbox
                                    checked={item.value.ledEnabled}
                                    onChange={(ledEnabled) =>
                                        item.onChange({ ...item.value, ledEnabled })
                                    }
                                >
                                    LED
                                </Checkbox>
                                <input
                                    className="ae-input"
                                    disabled={ledOff}
                                    value={item.value.led}
                                    placeholder="LED 推送内容"
                                    onFocus={(e) => {
                                        focusRef.current = {
                                            target: { cardKey: item.key, field: 'led' },
                                            el: e.currentTarget,
                                        };
                                        setFocusKey(`${item.key}:led`);
                                    }}
                                    onChange={(e) =>
                                        item.onChange({ ...item.value, led: e.target.value })
                                    }
                                />
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}
