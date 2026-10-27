import React, { useMemo, useState } from 'react';
import { AuthMap, DEPT_OPTIONS, POST_OPTIONS, ROLE_OPTIONS, USERS } from '../data';
import { BatchAuthDrawer } from './BatchAuthDrawer';
import { Button, Input, Select, message } from './ui';

export function ByPersonTab({
    auth,
    onChangeAuth,
}: {
    auth: AuthMap;
    onChangeAuth: (next: AuthMap) => void;
}) {
    const [nameKw, setNameKw] = useState('');
    const [dept, setDept] = useState('');
    const [post, setPost] = useState('');
    const [role, setRole] = useState('');
    const [query, setQuery] = useState({ nameKw: '', dept: '', post: '', role: '' });
    const [adjustUserId, setAdjustUserId] = useState<string | null>(null);

    const runQuery = () => {
        setQuery({ nameKw: nameKw.trim(), dept, post, role });
    };

    const filteredUsers = useMemo(() => {
        const q = query.nameKw;
        return USERS.filter((u) => {
            if (query.dept && u.dept !== query.dept) return false;
            if (query.post && u.post !== query.post) return false;
            if (query.role && u.role !== query.role) return false;
            if (q && !(u.name.includes(q) || u.loginName.includes(q))) return false;
            return true;
        });
    }, [query]);

    return (
        <div className="vp-person-main vp-person-main--solo">
            <div className="vp-filter-bar">
                <div className="vp-filter-field">
                    <span>姓名、登录名</span>
                    <Input value={nameKw} onChange={setNameKw} placeholder="请输入" />
                </div>
                <div className="vp-filter-field">
                    <span>部门</span>
                    <Select value={dept} options={DEPT_OPTIONS} onChange={setDept} />
                </div>
                <div className="vp-filter-field">
                    <span>岗位</span>
                    <Select value={post} options={POST_OPTIONS} onChange={setPost} />
                </div>
                <div className="vp-filter-field">
                    <span>角色</span>
                    <Select value={role} options={ROLE_OPTIONS} onChange={setRole} />
                </div>
                <Button variant="primary" onClick={runQuery}>
                    查询
                </Button>
            </div>

            <div className="vp-table-wrap">
                <table className="vp-table">
                    <thead>
                        <tr>
                            <th style={{ width: 56 }}>序号</th>
                            <th>姓名</th>
                            <th>登录名</th>
                            <th>部门</th>
                            <th>岗位</th>
                            <th>角色</th>
                            <th style={{ width: 140 }}>已授权摄像头数量</th>
                            <th style={{ width: 100 }}>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.map((u, i) => {
                            const count = auth[u.id]?.length ?? 0;
                            return (
                                <tr key={u.id} className="vp-row">
                                    <td>{i + 1}</td>
                                    <td className="vp-td-strong">{u.name}</td>
                                    <td>{u.loginName}</td>
                                    <td>{u.dept || '—'}</td>
                                    <td>{u.post || '—'}</td>
                                    <td>{u.role || '—'}</td>
                                    <td>{count}</td>
                                    <td>
                                        <Button
                                            variant="link"
                                            size="small"
                                            onClick={() => setAdjustUserId(u.id)}
                                        >
                                            调整权限
                                        </Button>
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredUsers.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="vp-empty-cell">
                                    无匹配用户
                                </td>
                            </tr>
                        ) : null}
                    </tbody>
                </table>
            </div>

            <BatchAuthDrawer
                open={!!adjustUserId}
                userIds={adjustUserId ? [adjustUserId] : []}
                auth={auth}
                onClose={() => setAdjustUserId(null)}
                onConfirm={(nextAuth) => {
                    onChangeAuth(nextAuth);
                    setAdjustUserId(null);
                    message.success('已更新该用户的摄像头权限');
                }}
            />
        </div>
    );
}
