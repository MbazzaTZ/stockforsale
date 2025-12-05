import { useState, useEffect } from 'react';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { StatsGrid } from '@/components/dashboard/StatsGrid';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Users, 
  Package,
  ShoppingCart,
  TrendingUp,
  Target,
  Clock,
  Loader2,
  ArrowRight
} from 'lucide-react';

interface TLDashboardProps {
  onNavigate: (tab: string) => void;
}

export function TLDashboard({ onNavigate }: TLDashboardProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tlId, setTlId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState({
    totalTeams: 0,
    totalDSRs: 0,
    myStock: 0,
    totalSales: 0,
    pendingVerification: 0,
    monthlyTarget: 0,
    achieved: 0,
  });
  const [recentSales, setRecentSales] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      fetchTLData();
    }
  }, [user]);

  async function fetchTLData() {
    if (!user) return;

    try {
      // Get TL record
      const { data: tlData } = await supabase
        .from('team_leaders')
        .select('id, monthly_target')
        .eq('user_id', user.id)
        .single();

      if (!tlData) {
        setLoading(false);
        return;
      }

      setTlId(tlData.id);

      // Fetch teams
      const { count: teamCount } = await supabase
        .from('teams')
        .select('*', { count: 'exact', head: true })
        .eq('tl_id', tlData.id);

      // Fetch DSRs
      const { count: dsrCount } = await supabase
        .from('dsrs')
        .select('*', { count: 'exact', head: true })
        .eq('tl_id', tlData.id);

      // Fetch my stock
      const { count: stockCount } = await supabase
        .from('stock')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to_tl', tlData.id)
        .neq('status', 'sold-paid')
        .neq('status', 'sold-unpaid');

      // Fetch sales
      const { data: sales, count: salesCount } = await supabase
        .from('sales')
        .select('*', { count: 'exact' })
        .eq('tl_id', tlData.id)
        .order('created_at', { ascending: false })
        .limit(5);

      // Pending verification
      const { count: pendingCount } = await supabase
        .from('sales')
        .select('*', { count: 'exact', head: true })
        .eq('tl_id', tlData.id)
        .eq('tl_verified', false);

      // Approved sales this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count: achievedCount } = await supabase
        .from('sales')
        .select('*', { count: 'exact', head: true })
        .eq('tl_id', tlData.id)
        .eq('admin_approved', true)
        .gte('created_at', startOfMonth.toISOString());

      setMetrics({
        totalTeams: teamCount || 0,
        totalDSRs: dsrCount || 0,
        myStock: stockCount || 0,
        totalSales: salesCount || 0,
        pendingVerification: pendingCount || 0,
        monthlyTarget: tlData.monthly_target || 0,
        achieved: achievedCount || 0,
      });
      setRecentSales(sales || []);
    } catch (error) {
      console.error('Error fetching TL data:', error);
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

  const targetProgress = metrics.monthlyTarget > 0 
    ? Math.round((metrics.achieved / metrics.monthlyTarget) * 100) 
    : 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Team Leader Dashboard</h1>
        <p className="text-muted-foreground">Manage your teams and track performance</p>
      </div>

      {/* Key Metrics */}
      <StatsGrid columns={4}>
        <MetricCard
          title="My Teams"
          value={metrics.totalTeams}
          icon={Users}
          variant="primary"
        />
        <MetricCard
          title="Total DSRs"
          value={metrics.totalDSRs}
          icon={Users}
          variant="default"
        />
        <MetricCard
          title="Stock Available"
          value={metrics.myStock}
          icon={Package}
          variant="warning"
        />
        <MetricCard
          title="Total Sales"
          value={metrics.totalSales}
          icon={ShoppingCart}
          variant="success"
        />
      </StatsGrid>

      {/* Target Progress */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Monthly Target Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{metrics.achieved} / {metrics.monthlyTarget}</span>
            </div>
            <div className="h-3 bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full gradient-primary transition-all duration-500"
                style={{ width: `${Math.min(targetProgress, 100)}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              {targetProgress}% of monthly target achieved
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card 
          className="glass cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => onNavigate('verification')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Pending Verification</p>
                  <p className="text-sm text-muted-foreground">{metrics.pendingVerification} sales awaiting review</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className="glass cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => onNavigate('assign-stock')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Package className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Assign Stock to DSRs</p>
                  <p className="text-sm text-muted-foreground">{metrics.myStock} items available</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Sales */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Recent Sales
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentSales.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No sales recorded yet</p>
          ) : (
            <div className="space-y-3">
              {recentSales.map((sale) => (
                <div
                  key={sale.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-background/50"
                >
                  <div>
                    <p className="font-medium text-foreground">{sale.sale_id}</p>
                    <p className="text-sm text-muted-foreground">{sale.smart_card_number}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={sale.admin_approved ? 'default' : sale.tl_verified ? 'secondary' : 'outline'}>
                      {sale.admin_approved ? 'Approved' : sale.tl_verified ? 'Verified' : 'Pending'}
                    </Badge>
                    <Badge variant="outline">{sale.sale_type}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
