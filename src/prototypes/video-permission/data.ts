/** 视频权限设置 · mock 数据与授权工具 */

export interface OrgNode {
    id: string;
    name: string;
    children?: OrgNode[];
}

export interface UserItem {
    id: string;
    name: string;
    loginName: string;
    unit: string;
    dept: string;
    orgId: string;
    post: string;
    role: string;
    enabled: boolean;
}

export interface CameraNode {
    id: string;
    name: string;
    children?: CameraNode[];
}

/** userId -> cameraIds（仅叶子摄像头） */
export type AuthMap = Record<string, string[]>;

export const POST_OPTIONS = [
    { value: '', label: '全部岗位' },
    { value: '公司领导', label: '公司领导' },
    { value: '计量员', label: '计量员' },
    { value: '入炉化验员', label: '入炉化验员' },
    { value: '安全员', label: '安全员' },
    { value: '调度员', label: '调度员' },
];

export const DEPT_OPTIONS = [
    { value: '', label: '全部部门' },
    { value: '燃料部', label: '燃料部' },
    { value: '运行部', label: '运行部' },
    { value: '化验室', label: '化验室' },
    { value: '生产部', label: '生产部' },
    { value: '安监部', label: '安监部' },
];

export const ROLE_OPTIONS = [
    { value: '', label: '全部角色' },
    { value: '管理员', label: '管理员' },
    { value: '公司领导', label: '公司领导' },
    { value: '调度员', label: '调度员' },
    { value: '计量员', label: '计量员' },
    { value: '入炉化验员', label: '入炉化验员' },
    { value: '安全员', label: '安全员' },
    { value: '安全测试', label: '安全测试' },
];

export const ORG_TREE: OrgNode = {
    id: 'org-root',
    name: '大唐集团',
    children: [
        {
            id: 'org-fr',
            name: '丰润电厂',
            children: [
                { id: 'org-fr-ops', name: '运行部' },
                { id: 'org-fr-fuel', name: '燃料部' },
                { id: 'org-fr-lab', name: '化验室' },
            ],
        },
        {
            id: 'org-xy',
            name: '贵州兴义电力发展有限公司',
            children: [
                { id: 'org-xy-ops', name: '生产部' },
                { id: 'org-xy-sec', name: '安监部' },
            ],
        },
        { id: 'org-dev3', name: 'dev3' },
        { id: 'org-prod', name: 'prod' },
    ],
};

export const USERS: UserItem[] = [
    { id: 'u1', name: '田涵', loginName: 'tianhan', unit: '大唐集团', dept: '燃料部', orgId: 'org-fr-fuel', post: '调度员', role: '调度员', enabled: true },
    { id: 'u2', name: '张鹏', loginName: 'zhangpeng', unit: '大唐集团', dept: '运行部', orgId: 'org-fr-ops', post: '公司领导', role: '管理员', enabled: true },
    { id: 'u3', name: '李明', loginName: 'liming', unit: '大唐集团', dept: '化验室', orgId: 'org-fr-lab', post: '入炉化验员', role: '入炉化验员', enabled: true },
    { id: 'u4', name: '王芳', loginName: 'wangfang', unit: '大唐集团', dept: '燃料部', orgId: 'org-fr-fuel', post: '计量员', role: '计量员', enabled: true },
    { id: 'u5', name: '赵强', loginName: 'zhaoqiang', unit: '贵州兴义电力发展有限公司', dept: '生产部', orgId: 'org-xy-ops', post: '调度员', role: '调度员', enabled: true },
    { id: 'u6', name: '陈静', loginName: 'chenjing', unit: '贵州兴义电力发展有限公司', dept: '安监部', orgId: 'org-xy-sec', post: '安全员', role: '安全测试', enabled: true },
    { id: 'u7', name: '刘伟', loginName: 'liuwei', unit: '大唐集团', dept: '运行部', orgId: 'org-fr-ops', post: '公司领导', role: '公司领导', enabled: true },
    { id: 'u8', name: '周敏', loginName: 'zhoumin', unit: '大唐集团', dept: '化验室', orgId: 'org-fr-lab', post: '入炉化验员', role: '入炉化验员', enabled: false },
    { id: 'u9', name: '吴涛', loginName: 'wutao', unit: '大唐集团', dept: '燃料部', orgId: 'org-fr-fuel', post: '计量员', role: '计量员', enabled: true },
    { id: 'u10', name: '郑丽', loginName: 'zhengli', unit: '大唐集团', dept: '', orgId: 'org-fr', post: '调度员', role: '调度员', enabled: true },
    { id: 'u11', name: '孙浩', loginName: 'sunhao', unit: '大唐集团', dept: '燃料部', orgId: 'org-fr-fuel', post: '安全员', role: '安全员', enabled: true },
    { id: 'u12', name: '钱峰', loginName: 'qianfeng', unit: '贵州兴义电力发展有限公司', dept: '生产部', orgId: 'org-xy-ops', post: '计量员', role: '计量员', enabled: true },
    { id: 'u13', name: '何佳', loginName: 'hejia', unit: '', dept: '', orgId: '', post: '调度员', role: '调度员', enabled: true },
    { id: 'u14', name: '高翔', loginName: 'gaoxiang', unit: '', dept: '', orgId: '', post: '安全员', role: '安全员', enabled: true },
];

export const CAMERA_TREE: CameraNode[] = [
    { id: 'g-stack', name: '堆场存放及清扫' },
    { id: 'g-hd', name: '高显区' },
    { id: 'g-aisle', name: '过道' },
    {
        id: 'g-lab',
        name: '无人化实验室',
        children: [
            { id: 'c-lab-1', name: '实验室入口球机' },
            { id: 'c-lab-2', name: '制样间枪机' },
            { id: 'c-lab-3', name: '化验台全景' },
        ],
    },
    {
        id: 'g-yard',
        name: '煤场区域',
        children: [
            { id: 'c-yard-a1', name: 'A煤场1区球机' },
            { id: 'c-yard-a2', name: 'A煤场2区球机' },
            { id: 'c-yard-b1', name: 'B煤场1区球机' },
            { id: 'c-yard-b2', name: 'B煤场2区球机' },
            { id: 'c-yard-gate', name: '煤场大门枪机' },
        ],
    },
    {
        id: 'g-scale',
        name: '计量区域',
        children: [
            { id: 'c-scale-1', name: '1#汽车衡球机' },
            { id: 'c-scale-2', name: '2#汽车衡球机' },
        ],
    },
];

export function flattenCameras(nodes: CameraNode[] = CAMERA_TREE): CameraNode[] {
    const out: CameraNode[] = [];
    const walk = (list: CameraNode[]) => {
        for (const n of list) {
            if (n.children?.length) walk(n.children);
            else out.push(n);
        }
    };
    walk(nodes);
    return out;
}

export function collectLeafIds(nodes: CameraNode[]): string[] {
    return flattenCameras(nodes).map((c) => c.id);
}

export function findCameraName(id: string, nodes: CameraNode[] = CAMERA_TREE): string {
    for (const n of nodes) {
        if (n.id === id) return n.name;
        if (n.children) {
            const hit = findCameraName(id, n.children);
            if (hit) return hit;
        }
    }
    return id;
}

export function collectOrgIds(root: OrgNode, selectedId: string): Set<string> {
    const find = (node: OrgNode): OrgNode | null => {
        if (node.id === selectedId) return node;
        for (const c of node.children || []) {
            const hit = find(c);
            if (hit) return hit;
        }
        return null;
    };
    const target = find(root);
    const ids = new Set<string>();
    if (!target) return ids;
    const walk = (n: OrgNode) => {
        ids.add(n.id);
        (n.children || []).forEach(walk);
    };
    walk(target);
    return ids;
}

const ALL_LEAVES = collectLeafIds(CAMERA_TREE);

export function createInitialAuthMap(): AuthMap {
    return {
        u1: ['c-yard-a1', 'c-yard-a2', 'c-scale-1'],
        u2: ['c-yard-a1', 'c-yard-b1', 'c-lab-1', 'c-lab-2', 'g-hd'],
        u3: ['c-lab-1', 'c-lab-2', 'c-lab-3'],
        u4: ['c-scale-1', 'c-scale-2'],
        u5: ['c-yard-b1', 'c-yard-b2', 'c-yard-gate'],
        u6: ['g-aisle', 'c-yard-gate'],
        u7: [...ALL_LEAVES.filter((id) => id.startsWith('c-') || id === 'g-hd' || id === 'g-aisle' || id === 'g-stack')].slice(0, 8),
        u9: ['c-scale-1'],
        u10: ['c-yard-a1'],
        u11: ['g-stack', 'g-aisle'],
        u12: ['c-yard-b1'],
    };
}

const STORAGE_KEY = 'vp-video-permission-auth-v1';

export function loadAuthMap(): AuthMap {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return createInitialAuthMap();
        return { ...createInitialAuthMap(), ...(JSON.parse(raw) as AuthMap) };
    } catch {
        return createInitialAuthMap();
    }
}

export function saveAuthMap(map: AuthMap) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

/** 选中用户摄像头并集 */
export function unionCameraIds(auth: AuthMap, userIds: string[]): string[] {
    const set = new Set<string>();
    for (const uid of userIds) {
        (auth[uid] || []).forEach((id) => set.add(id));
    }
    return [...set];
}

export function usersForCamera(auth: AuthMap, cameraId: string, users: UserItem[] = USERS): UserItem[] {
    return users.filter((u) => (auth[u.id] || []).includes(cameraId));
}

export function getDescendantLeafIds(node: CameraNode): string[] {
    if (!node.children?.length) return [node.id];
    return node.children.flatMap(getDescendantLeafIds);
}
