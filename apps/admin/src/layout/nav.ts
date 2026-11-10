import {
  ChartColumn,
  Boxes,
  HandCoins,
  LayoutDashboard,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { AppRole } from '../auth/AuthContext'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  roles: AppRole[]
  description: string
}

const BOTH: AppRole[] = ['owner', 'staff']
const OWNER: AppRole[] = ['owner']

/** The sidebar. Staff see daily work; the owner also sees reports and settings. */
export const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: BOTH, description: 'Your business at a glance.' },
  { to: '/sales', label: 'Sales', icon: ShoppingCart, roles: BOTH, description: 'Record shop sales, credit sales and part payments.' },
  { to: '/purchases', label: 'Purchases', icon: Truck, roles: BOTH, description: 'Record goods bought from suppliers.' },
  { to: '/stock', label: 'Stock', icon: Boxes, roles: BOTH, description: 'Live stock, low-stock alerts, adjustments and stock counts.' },
  { to: '/customers', label: 'Customers', icon: Users, roles: BOTH, description: 'Customer list, buying history and who is going quiet.' },
  { to: '/debtors', label: 'Debtors', icon: HandCoins, roles: BOTH, description: 'Who owes you, how much, and part payments.' },
  { to: '/reports', label: 'Reports', icon: ChartColumn, roles: OWNER, description: 'Profit, best customers and best-selling products.' },
  { to: '/settings', label: 'Settings', icon: Settings, roles: OWNER, description: 'Products, suppliers, staff and profit method.' },
]
