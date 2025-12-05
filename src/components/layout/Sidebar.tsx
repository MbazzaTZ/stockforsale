import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  UserCheck,
  MapPin,
  ClipboardCheck,
  TrendingUp,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Target,
  Shield,
  Boxes,
  FileCheck,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

type AppRole = 'admin' | 'manager' | 'tl' | 'dsr' | 'de';

interface SidebarProps {
  role: AppRole;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

const adminNav: NavItem[] = [
  { id: 'general', label: 'Overview', icon: LayoutDashboard },
  { id: 'dashboard', label: 'Admin Dashboard', icon: Shield },
  { id: 'regions', label: 'Region Management', icon: MapPin },
  { id: 'stock', label: 'Stock Management', icon: Package },
  { id: 'assign', label: 'Assign Stock', icon: Boxes },
  { id: 'de-tl-management', label: 'DE & TL Management', icon: UserCheck },
  { id: 'signups', label: 'User Signups', icon: Users },
  { id: 'approvals', label: 'Approvals', icon: ClipboardCheck },
];

const managerNav: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'targets', label: 'Set Targets', icon: Target },
  { id: 'reports', label: 'Reports', icon: TrendingUp },
];

const tlNav: NavItem[] = [
  { id: 'general', label: 'Overview', icon: LayoutDashboard },
  { id: 'dashboard', label: 'TL Dashboard', icon: Shield },
  { id: 'teams', label: 'Team Management', icon: Users },
  { id: 'dsrs', label: 'DSR Management', icon: UserCheck },
  { id: 'stock', label: 'Stock Management', icon: Package },
  { id: 'assign-stock', label: 'Assign to DSRs', icon: Boxes },
  { id: 'verification', label: 'Sales Verification', icon: FileCheck },
  { id: 'reports', label: 'Reports', icon: TrendingUp },
];

const dsrNav: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'stock', label: 'My Stock', icon: Package },
  { id: 'add-sale', label: 'Add Sale', icon: ShoppingCart },
  { id: 'my-sales', label: 'My Sales', icon: TrendingUp },
  { id: 'commission', label: 'My Commission', icon: Target },
];

const deNav: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'agents', label: 'Manage Agents', icon: Users },
  { id: 'add-sale', label: 'Add Sales', icon: ShoppingCart },
  { id: 'my-sales', label: 'My Sales', icon: TrendingUp },
  { id: 'commission', label: 'My Commission', icon: Target },
];

const getNavItems = (role: AppRole): NavItem[] => {
  switch (role) {
    case 'admin':
      return adminNav;
    case 'manager':
      return managerNav;
    case 'tl':
      return tlNav;
    case 'de':
      return deNav;
    case 'dsr':
      return dsrNav;
    default:
      return [];
  }
};

export function Sidebar({ role, activeTab, onTabChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { signOut, profile } = useAuth();
  const navItems = getNavItems(role);

  const getRoleLabel = (role: AppRole) => {
    switch (role) {
      case 'admin': return 'Administrator';
      case 'manager': return 'Manager';
      case 'tl': return 'Team Leader';
      case 'de': return 'Distribution Executive';
      case 'dsr': return 'DSR';
      default: return 'User';
    }
  };

  return (
    <aside
      className={cn(
        'h-screen bg-sidebar flex flex-col border-r border-sidebar-border transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
            <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0">
              <Package className="h-5 w-5 text-primary-foreground" />
            </div>
            {!collapsed && (
              <div>
                <h1 className="font-bold text-sidebar-foreground">SalesFlow</h1>
                <p className="text-xs text-muted-foreground">{getRoleLabel(role)}</p>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-sidebar-foreground"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50',
                collapsed && 'justify-center px-2'
              )}
            >
              <Icon className={cn('h-5 w-5 flex-shrink-0', isActive && 'text-primary')} />
              {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border space-y-1">
        <button
          onClick={() => onTabChange('profile')}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-all duration-200',
            collapsed && 'justify-center px-2'
          )}
        >
          <Settings className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Settings</span>}
        </button>
        <button
          onClick={signOut}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-destructive hover:bg-destructive/10 transition-all duration-200',
            collapsed && 'justify-center px-2'
          )}
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Logout</span>}
        </button>
      </div>
    </aside>
  );
}
