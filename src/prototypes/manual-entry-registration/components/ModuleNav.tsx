/**
 * 二级功能导航：按菜单权限动态展示，Segment 式切换
 */
import React from 'react';
import {
  CarOutlined,
  ExportOutlined,
  FileTextOutlined,
  InboxOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import type { ModuleCode, ModuleMenu } from '../data';

const ICONS: Record<ModuleCode, React.ReactNode> = {
  'coal-entry': <InboxOutlined />,
  'non-coal': <FileTextOutlined />,
  'transfer-coal': <SwapOutlined />,
  'vehicle-card': <CarOutlined />,
  exit: <ExportOutlined />,
};

interface Props {
  menus: ModuleMenu[];
  active: ModuleCode;
  onChange: (code: ModuleCode) => void;
}

const ModuleNav: React.FC<Props> = ({ menus, active, onChange }) => (
  <nav className="mer-module-nav" aria-label="登记功能">
    {menus.map((m) => (
      <button
        key={m.code}
        type="button"
        className={`mer-module-nav-item${active === m.code ? ' is-active' : ''}`}
        onClick={() => onChange(m.code)}
      >
        <span className="mer-module-nav-icon">{ICONS[m.code]}</span>
        <span className="mer-module-nav-label">{m.label}</span>
      </button>
    ))}
  </nav>
);

export default ModuleNav;
