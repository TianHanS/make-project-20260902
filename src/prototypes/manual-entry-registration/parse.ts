/**
 * 云驿二维码与矿发卡字符串解析
 */

import { findPlan, type CoalPlan } from './data';

export interface YunyiPayload {
  serialNo: string;
  taskNo: string;
  plate: string;
  shipTime: string;
  gross: number;
  tare: number;
  net: number;
  planId: string;
  qrTime: string;
  stationTime: string;
}

export interface MineCardPayload {
  inputPlate: string;
  cardPlate: string;
  planId: string;
  gross: number;
  tare: number;
}

export const parseYunyi = (raw: string): YunyiPayload | null => {
  const parts = raw.trim().split('|');
  if (parts.length < 10) return null;
  const [serialNo, taskNo, plate, shipTime, gross, tare, net, planId, qrTime, stationTime] =
    parts;
  if (!plate || !planId || !qrTime) return null;
  return {
    serialNo,
    taskNo,
    plate,
    shipTime,
    gross: Number(gross),
    tare: Number(tare),
    net: Number(net),
    planId,
    qrTime,
    stationTime,
  };
};

/** 二维码内「当前时间」与系统时间相差不超过 15 分钟 */
export const isYunyiFresh = (qrTime: string, now = Date.now()) => {
  const t = new Date(qrTime.replace(/-/g, '/')).getTime();
  if (Number.isNaN(t)) return false;
  return Math.abs(now - t) <= 15 * 60 * 1000;
};

/**
 * 矿发卡：txtVehicleNo + O + readWrite + O + a + O + b + O + 车牌 + O + 计划id + O + 毛重 + O + 皮重 + O
 * 例：蒙A90005OreadWriteOaObO蒙A90005O831103931018260480O105O13O
 */
export const parseMineCard = (raw: string): MineCardPayload | null => {
  const parts = raw.trim().split('O').filter((p) => p !== '');
  if (parts.length < 8) return null;
  const inputPlate = parts[0];
  const cardPlate = parts[4];
  const planId = parts[5];
  const gross = Number(parts[6]);
  const tare = Number(parts[7]);
  if (!cardPlate || !planId) return null;
  return { inputPlate, cardPlate, planId, gross, tare };
};

export const applyPlan = (plan: CoalPlan) => ({
  plate: plan.plate,
  supplier: plan.supplier,
  mine: plan.mine,
  coalType: plan.coalType,
  transporter: plan.transporter,
  unloadArea: plan.unloadArea,
  productName: plan.productName,
  shipTime: plan.shipTime,
  station: plan.station,
  planId: plan.id,
});

export const planByScan = (planId: string) => findPlan(planId.trim());
