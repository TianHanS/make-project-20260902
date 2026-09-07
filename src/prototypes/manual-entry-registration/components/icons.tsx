/**
 * lucide 图标别名，替代 @ant-design/icons
 */
import React from 'react';
import {
  ArrowRight,
  ArrowLeftRight,
  Car,
  CheckCircle2,
  CreditCard,
  Eraser,
  FileText,
  Inbox,
  LogOut,
  MapPin,
  QrCode,
  ScanLine,
  SquarePlus,
  Zap,
  XCircle,
} from 'lucide-react';

type IconProps = {
  className?: string;
  style?: React.CSSProperties;
  size?: number;
  spin?: boolean;
};

function wrap(
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties; size?: number }>,
  defaultSize = 16,
) {
  return function MerIcon({ className = '', style, size = defaultSize, spin }: IconProps) {
    return (
      <Icon
        size={size}
        className={`${spin ? 'mer-spin-icon' : ''} ${className}`.trim()}
        style={style}
      />
    );
  };
}

export const InboxOutlined = wrap(Inbox);
export const FileTextOutlined = wrap(FileText);
export const SwapOutlined = wrap(ArrowLeftRight);
export const CarOutlined = wrap(Car);
export const ExportOutlined = wrap(LogOut);
export const EnvironmentOutlined = wrap(MapPin, 20);
export const RightOutlined = wrap(ArrowRight, 14);
export const CreditCardOutlined = wrap(CreditCard, 22);
export const ScanOutlined = wrap(ScanLine, 28);
export const CheckCircleFilled = wrap(CheckCircle2, 28);
export const CloseCircleFilled = wrap(XCircle, 28);
export const ClearOutlined = wrap(Eraser, 14);
export const PlusSquareOutlined = wrap(SquarePlus, 14);
export const QrcodeOutlined = wrap(QrCode, 14);
export const ThunderboltOutlined = wrap(Zap, 14);
