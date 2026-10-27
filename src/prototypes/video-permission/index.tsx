/**
 * @name 视频权限设置
 */
import React, { useEffect, useState } from 'react';
import { AuthMap, loadAuthMap, saveAuthMap } from './data';
import { ByCameraTab } from './components/ByCameraTab';
import { ByPersonTab } from './components/ByPersonTab';
import { MessageHost } from './components/ui';
import './style.css';

type MainTab = 'camera' | 'person';

export default function VideoPermissionApp() {
    const [tab, setTab] = useState<MainTab>('camera');
    const [auth, setAuth] = useState<AuthMap>(() => loadAuthMap());

    useEffect(() => {
        saveAuthMap(auth);
    }, [auth]);

    return (
        <div className="vp-app">
            <main className="vp-main">
                <div className="vp-card">
                    <div className="vp-card-head">
                        <div className="vp-tabs" role="tablist">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={tab === 'camera'}
                                className={`vp-tab${tab === 'camera' ? ' is-active' : ''}`}
                                onClick={() => setTab('camera')}
                            >
                                按摄像头授权
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={tab === 'person'}
                                className={`vp-tab${tab === 'person' ? ' is-active' : ''}`}
                                onClick={() => setTab('person')}
                            >
                                按人员授权
                            </button>
                        </div>
                    </div>

                    <div className="vp-card-body">
                        {tab === 'camera' ? (
                            <ByCameraTab auth={auth} onChangeAuth={setAuth} />
                        ) : (
                            <ByPersonTab auth={auth} onChangeAuth={setAuth} />
                        )}
                    </div>
                </div>
            </main>
            <MessageHost />
        </div>
    );
}
