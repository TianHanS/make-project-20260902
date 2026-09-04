import React, { useEffect, useState } from 'react';
import {
    GlobalParams,
    NOTIFY_ENABLE_OPTIONS,
    defaultGlobalParams,
} from '../data';
import { Button, Drawer, Field, Input } from './ui';

export function GlobalParamsDrawer({
    open,
    initial,
    onClose,
    onSave,
}: {
    open: boolean;
    initial: GlobalParams;
    onClose: () => void;
    onSave: (params: GlobalParams) => void;
}) {
    const [draft, setDraft] = useState<GlobalParams>(defaultGlobalParams());

    useEffect(() => {
        if (open) setDraft(structuredClone(initial));
    }, [open, initial]);

    return (
        <Drawer
            open={open}
            title="全局参数配置"
            onClose={onClose}
            width={520}
            nested
            footer={
                <div className="ae-drawer-actions">
                    <Button onClick={onClose}>取消</Button>
                    <Button
                        variant="primary"
                        onClick={() => {
                            onSave(draft);
                            onClose();
                        }}
                    >
                        确定
                    </Button>
                </div>
            }
        >
            <p className="ae-param-desc">
                模块级全局参数，不属于任一子流程步骤。用于默认消息等跨流程共用设定。
            </p>

            <section className="ae-global-form">
                <h4 className="ae-global-form-group">默认消息设定</h4>

                <Field
                    label="通知启用"
                    required
                    extra={<span className="ae-field-guide">0 启用；1 禁用</span>}
                >
                    <div className="ae-radio-row">
                        {NOTIFY_ENABLE_OPTIONS.map((o) => (
                            <label key={o.value} className="ae-radio">
                                <input
                                    type="radio"
                                    checked={draft.notifyEnabled === o.value}
                                    onChange={() =>
                                        setDraft({
                                            ...draft,
                                            notifyEnabled: o.value as GlobalParams['notifyEnabled'],
                                        })
                                    }
                                />
                                {o.label}
                            </label>
                        ))}
                    </div>
                </Field>

                <Field
                    label="LED推送内容"
                    required
                    extra={<span className="ae-field-guide">默认设定：排队登记 有序入厂</span>}
                >
                    <Input
                        value={draft.ledContent}
                        onChange={(ledContent) => setDraft({ ...draft, ledContent })}
                        placeholder="排队登记 有序入厂"
                    />
                </Field>

                <Field
                    label="广播内容"
                    required
                    extra={<span className="ae-field-guide">默认设定：排队登记 有序入厂</span>}
                >
                    <Input
                        value={draft.broadcastContent}
                        onChange={(broadcastContent) => setDraft({ ...draft, broadcastContent })}
                        placeholder="排队登记 有序入厂"
                    />
                </Field>
            </section>
        </Drawer>
    );
}
