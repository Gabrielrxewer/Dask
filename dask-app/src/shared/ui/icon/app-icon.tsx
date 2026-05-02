import type { ComponentProps } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUp,
  Bot,
  BriefcaseBusiness,
  Bug,
  CalendarCheck,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Code,
  Copy,
  CreditCard,
  Eye,
  EyeOff,
  FileText,
  FlaskConical,
  GripVertical,
  Info,
  KanbanSquare,
  Layers,
  LayoutTemplate,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Lock,
  Megaphone,
  MessageSquare,
  Minus,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  Repeat2,
  Search,
  Send,
  Settings,
  SquareCheckBig,
  SquareCode,
  Table2,
  Trash2,
  TrendingUp,
  UserRound,
  Users,
  WalletCards,
  Wrench,
  X,
  Zap,
  type LucideIcon
} from "lucide-react";

export type AppIconName =
  | "alert-circle"
  | "arrow-left"
  | "arrow-up"
  | "automation"
  | "billing"
  | "board"
  | "bot"
  | "briefcase"
  | "bug"
  | "calendar-check"
  | "check"
  | "chevron-down"
  | "chevron-left"
  | "chevron-right"
  | "code"
  | "copy"
  | "credit-card"
  | "documentation"
  | "eye"
  | "eye-off"
  | "file"
  | "flask"
  | "grip"
  | "info"
  | "layers"
  | "link"
  | "list"
  | "list-checks"
  | "list-ordered"
  | "lock"
  | "marketing"
  | "message"
  | "minus"
  | "pencil"
  | "plus"
  | "receipt"
  | "refresh"
  | "search"
  | "send"
  | "settings"
  | "square-check"
  | "square-code"
  | "table"
  | "template"
  | "trash"
  | "trend-up"
  | "user"
  | "users"
  | "wallet"
  | "wrench"
  | "x"
  | "zap";

const icons: Record<AppIconName, LucideIcon> = {
  "alert-circle": AlertCircle,
  "arrow-left": ArrowLeft,
  "arrow-up": ArrowUp,
  automation: Repeat2,
  billing: WalletCards,
  board: KanbanSquare,
  bot: Bot,
  briefcase: BriefcaseBusiness,
  bug: Bug,
  "calendar-check": CalendarCheck,
  check: Check,
  "chevron-down": ChevronDown,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  code: Code,
  copy: Copy,
  "credit-card": CreditCard,
  documentation: FileText,
  eye: Eye,
  "eye-off": EyeOff,
  file: FileText,
  flask: FlaskConical,
  grip: GripVertical,
  info: Info,
  layers: Layers,
  link: Link,
  list: List,
  "list-checks": ListChecks,
  "list-ordered": ListOrdered,
  lock: Lock,
  marketing: Megaphone,
  message: MessageSquare,
  minus: Minus,
  pencil: Pencil,
  plus: Plus,
  receipt: ReceiptText,
  refresh: RefreshCw,
  search: Search,
  send: Send,
  settings: Settings,
  "square-check": SquareCheckBig,
  "square-code": SquareCode,
  table: Table2,
  template: LayoutTemplate,
  trash: Trash2,
  "trend-up": TrendingUp,
  user: UserRound,
  users: Users,
  wallet: WalletCards,
  wrench: Wrench,
  x: X,
  zap: Zap
};

export interface AppIconProps extends Omit<ComponentProps<LucideIcon>, "name"> {
  name: AppIconName;
}

export function AppIcon({
  name,
  size = 16,
  strokeWidth = 1.8,
  absoluteStrokeWidth = true,
  ...props
}: AppIconProps) {
  const Icon = icons[name];

  return (
    <Icon
      aria-hidden="true"
      focusable="false"
      size={size}
      strokeWidth={strokeWidth}
      absoluteStrokeWidth={absoluteStrokeWidth}
      {...props}
    />
  );
}
