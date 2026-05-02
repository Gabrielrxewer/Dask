import { AppIcon } from "@/shared/ui";

function IconCard() {
  return <AppIcon name="credit-card" size={16} strokeWidth={2} />;
}

function IconBolt() {
  return <AppIcon name="zap" size={16} strokeWidth={2} />;
}

function IconArrowUp() {
  return <AppIcon name="arrow-up" size={16} strokeWidth={2} />;
}

export function IconAlertCircle() {
  return <AppIcon name="alert-circle" size={16} strokeWidth={2} />;
}

export function IconLock() {
  return <AppIcon name="lock" size={24} strokeWidth={1.6} />;
}

export function IconCheck() {
  return <AppIcon name="check" size={14} strokeWidth={2.5} />;
}

export const KPI_ICONS: Record<string, () => JSX.Element> = {
  stripe: IconCard,
  charges: IconBolt,
  payouts: IconArrowUp,
  requirements: IconAlertCircle
};
