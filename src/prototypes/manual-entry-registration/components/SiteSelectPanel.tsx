/**
 * 登记点选择：进入页面后首选，大卡片列表排开
 */
import React from 'react';
import { EnvironmentOutlined, RightOutlined } from '@ant-design/icons';
import { SITE_PRESENTATION, type SiteConfig } from '../data';

interface Props {
  sites: SiteConfig[];
  onSelect: (siteId: string) => void;
}

const SiteSelectPanel: React.FC<Props> = ({ sites, onSelect }) => (
  <div className="mer-site-select">
    <div className="mer-site-select-head">
      <h2>请选择登记点</h2>
      <p>选择当前值班所在的入厂登记点，进入对应登记界面</p>
    </div>
    <div className="mer-site-grid">
      {sites.map((site) => {
        const meta = SITE_PRESENTATION[site.id];
        return (
          <button
            key={site.id}
            type="button"
            className="mer-site-card"
            onClick={() => onSelect(site.id)}
          >
            <span className="mer-site-card-icon">
              <EnvironmentOutlined />
            </span>
            <span className="mer-site-card-abbr">{meta?.abbr ?? site.name.slice(0, 2)}</span>
            <span className="mer-site-card-name">{site.name}</span>
            <span className="mer-site-card-hint">{meta?.hint ?? '点击进入登记'}</span>
            <span className="mer-site-card-go">
              进入登记
              <RightOutlined />
            </span>
          </button>
        );
      })}
    </div>
  </div>
);

export default SiteSelectPanel;
