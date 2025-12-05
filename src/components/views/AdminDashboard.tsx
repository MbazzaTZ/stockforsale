import { useState, useEffect } from 'react';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { StatsGrid } from '@/components/dashboard/StatsGrid';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, 
  UserCheck,
  Shield,
  Package,
  AlertTriangle,
  Clock,
  CheckCircle,
  Loader2
} from 'lucide-react';

interface PendingApproval {
  id: string;
  full_name: string;
  email: string;
  role: string;
  created_at: string;
}

export function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    pendingUsers: 0,
    pendingTeams: 0,
    pendingSales: 0,
    totalTLs: 0,
    totalDSRs: 0,
    unassignedStock: 0,
    unpaidStock: 0,
  });
  const [pendingUsers, setPendingUsers] = useState<PendingApproval[]>([]);

  useEffect(() => {
    fetchAdminData();
  }, []);

  async function fetchAdminData() {
    try {
      // Fetch pending users with explicit debug logging
      console.log('📊 Fetching pending users...');
      const { data: profiles, count: pendingCount, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, created_at, is_approved, approval_status', { count: 'exact' })
        .eq('is_approved', false)
        .eq('approval_status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5);

      if (profilesError) {
        console.error('❌ Error fetching profiles:', profilesError);
      } else {
        console.log('✅ Pending users fetched:', profiles?.length || 0, 'records');
      }

      // Fetch pending teams
      const { count: pendingTeams, error: teamsError } = await supabase
        .from('teams')
        .select('*', { count: 'exact', head: true })
        .eq('is_approved', false);

      if (teamsError) console.error('❌ Error fetching teams:', teamsError);

      // Fetch pending sales
      const { count: pendingSales, error: salesError } = await supabase
        .from('sales')
        .select('*', { count: 'exact', head: true })
        .eq('admin_approved', false)
        .eq('tl_verified', true);

      if (salesError) console.error('❌ Error fetching sales:', salesError);

      // Fetch TLs count
      const { count: tlCount } = await supabase
        .from('team_leaders')
        .select('*', { count: 'exact', head: true });

      // Fetch DSRs count
      const { count: dsrCount } = await supabase
        .from('dsrs')
        .select('*', { count: 'exact', head: true });

      // Fetch unassigned stock
      const { count: unassignedStock } = await supabase
        .from('stock')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'unassigned');

      // Fetch unpaid stock (items marked sold-unpaid)
      const { count: unpaidStock } = await supabase
        .from('stock')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'sold-unpaid');

      // Get roles for pending users
      const usersWithRoles = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', profile.id)
            .single();
          return {
            ...profile,
            role: roleData?.role || 'dsr',
          };
        })
      );

      console.log('✅ Admin data fetched successfully:', {
        pendingUsers: pendingCount || 0,
        pendingTeams: pendingTeams || 0,
        pendingSales: pendingSales || 0,
      });

      setMetrics({
        pendingUsers: pendingCount || 0,
        pendingTeams: pendingTeams || 0,
        pendingSales: pendingSales || 0,
        totalTLs: tlCount || 0,
        totalDSRs: dsrCount || 0,
        unassignedStock: unassignedStock || 0,
        unpaidStock: unpaidStock || 0,
      });
      setPendingUsers(usersWithRoles);
    } catch (error) {
      console.error('❌ Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage approvals and system overview</p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setLoading(true);
            fetchAdminData();
          }}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Refresh
        </Button>
      </div>

      {/* Pending Actions */}
      <StatsGrid columns={3}>
        <MetricCard
          title="Pending User Approvals"
          value={metrics.pendingUsers}
          icon={UserCheck}
          variant={metrics.pendingUsers > 0 ? 'warning' : 'default'}
        />
        <MetricCard
          title="Pending Team Approvals"
          value={metrics.pendingTeams}
          icon={Users}
          variant={metrics.pendingTeams > 0 ? 'warning' : 'default'}
        />
        <MetricCard
          title="Sales Awaiting Approval"
          value={metrics.pendingSales}
          icon={Clock}
          variant={metrics.pendingSales > 0 ? 'warning' : 'default'}
        />
      </StatsGrid>

      {/* System Stats */}
      <StatsGrid columns={4}>
        <MetricCard
          title="Total Team Leaders"
          value={metrics.totalTLs}
          icon={Shield}
          variant="primary"
        />
        <MetricCard
          title="Total DSRs"
          value={metrics.totalDSRs}
          icon={Users}
          variant="success"
        />
        <MetricCard
          title="Unassigned Stock"
          value={metrics.unassignedStock}
          icon={Package}
          variant={metrics.unassignedStock > 0 ? 'danger' : 'default'}
        />
        <MetricCard
          title="Unpaid Stock"
          value={metrics.unpaidStock}
          icon={AlertTriangle}
          variant={metrics.unpaidStock > 0 ? 'danger' : 'default'}
        />
      </StatsGrid>

      {/* Pending Users */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Recent Pending Approvals
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-2 text-success" />
              <p>All caught up! No pending approvals.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-background/50"
                >
                  <div>
                    <p className="font-medium text-foreground">{user.full_name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="capitalize">
                      {user.role}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
              {metrics.pendingUsers > 5 && (
                <p className="text-center text-sm text-muted-foreground">
                  +{metrics.pendingUsers - 5} more pending approvals
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
