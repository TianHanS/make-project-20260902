/**
 * @name 视频公共模块
 * @mode axure
 *
 * 5.1 设备管理业务域：摄像头管理（含分组、设备与流媒体信息）
 * 5.2 视频监控业务域：视频监控（实时监控 / 视频回放）
 *
 * 参考资料：
 * - rules/axure-export-workflow.md
 * - rules/prototype-development-guide.md
 * - rules/axure-api-guide.md
 */
import React, { useEffect, useState } from 'react';
import { MonitorPlay, Video } from 'lucide-react';
import { defineHashPageRoute, useHashPage } from '../../common/useHashPage';
import {
    DeviceDomainData,
    loadDomainData,
    resetDomainData,
    saveDomainData,
} from './data';
import { Button, MessageHost, message } from './components/ui';
import { CameraPage } from './pages/CameraPage';
import { MonitorPage } from './pages/MonitorPage';
import './style.css';

const route = defineHashPageRoute(
    [
        { id: 'monitor', title: '视频监控', group: '视频 / 监控' },
        { id: 'cameras', title: '摄像头管理', group: '视频 / 设备管理' },
    ],
    { defaultPageId: 'monitor' },
);

const MENU_GROUPS = [
    {
        title: '视频 / 监控',
        items: [{ id: 'monitor', title: '视频监控', icon: MonitorPlay }],
    },
    {
        title: '视频 / 设备管理',
        items: [{ id: 'cameras', title: '摄像头管理', icon: Video }],
    },
];

const MENU = MENU_GROUPS.flatMap((group) => group.items);

const Component = function Component() {
    const { page, setPage } = useHashPage(route);
    const [data, setData] = useState<DeviceDomainData>(() => loadDomainData());

    useEffect(() => {
        saveDomainData(data);
    }, [data]);

    const active = MENU.find((item) => item.id === page) ? page : 'monitor';

    return (
        <div className="vdm-app">
            <aside className="vdm-nav">
                <div className="vdm-nav-brand">
                    <strong>视频公共模块</strong>
                    <span>视频监控 / 设备管理业务域</span>
                </div>
                <nav className="vdm-nav-group">
                    {MENU_GROUPS.map((group) => (
                        <React.Fragment key={group.title}>
                            <p className="vdm-nav-group-title">{group.title}</p>
                            {group.items.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        className={`vdm-nav-item${active === item.id ? ' is-active' : ''}`}
                                        onClick={() => setPage(item.id)}
                                    >
                                        <Icon size={15} />
                                        <span className="vdm-nav-item-main">{item.title}</span>
                                    </button>
                                );
                            })}
                        </React.Fragment>
                    ))}
                </nav>
                <div className="vdm-nav-foot">
                    <Button
                        size="small"
                        onClick={() => {
                            setData(resetDomainData());
                            message.success('已恢复演示数据');
                        }}
                    >
                        恢复演示数据
                    </Button>
                </div>
            </aside>

            <main className="vdm-body">
                {active === 'monitor' ? <MonitorPage data={data} /> : null}
                {active === 'cameras' ? <CameraPage data={data} onChange={setData} /> : null}
            </main>

            <MessageHost />
        </div>
    );
};

export default Component;
