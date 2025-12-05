import { useState, useEffect } from 'react';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { StatsGrid } from '@/components/dashboard/StatsGrid';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, 
  Target,
  TrendingUp,
  DollarSign,
  Loader2
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

export default function ManagerDashboard() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalTLs: 0,
    totalDSRs: 0,
    totalSales: 0,
    totalRevenue: 0,
  });
  const [tlPerformance, setTlPerformance] = useState<any[]>([]);

  useEffect(() => {
    fetchManagerData();
  }, []);

  async function fetchManagerData() {
    try {
      // Fetch TLs
      const { data: tls, count: tlCount } = await supabase
        .from('team_leaders')
        .select(`
          id,
          monthly_target,
          user_id,
          profiles!inner(full_name)
        `, { count: 'exact' });

      // Fetch DSRs
      const { count: dsrCount } = await supabase
        .from('dsrs')
        .select('*', { count: 'exact', head: true });

      // Fetch sales
      const { data: sales, count: salesCount } = await supabase
        .from('sales')
        .select('sale_price, tl_id');

      const totalRevenue = sales?.reduce((sum, s) => sum + (Number(s.sale_price) || 0), 0) || 0;

      // Calculate TL performance
      const performanceData = (tls || []).map(tl => {
        const tlSales = sales?.filter(s => s.tl_id === tl.id).length || 0;
        return {
          name: (tl as any).profiles?.full_name?.split(' ')[0] || 'TL',
          sales: tlSales,
          target: tl.monthly_target || 0,
        };
      }).slice(0, 6);

      setMetrics({
        totalTLs: tlCount || 0,
        totalDSRs: dsrCount || 0,
        totalSales: salesCount || 0,
        totalRevenue,
      });
      setTlPerformance(performanceData);
    } catch (error) {
      console.error('Error fetching manager data:', error);
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
      <div>
        <h1 className="text-2xl font-bold text-foreground">Manager Dashboard</h1>
        <p className="text-muted-foreground">Overview of team performance and targets</p>
      </div>

      {/* Key Metrics */}
      <StatsGrid columns={4}>
        <MetricCard
          title="Total Team Leaders"
          value={metrics.totalTLs}
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
          title="Total Sales"
          value={metrics.totalSales}
          icon={TrendingUp}
          variant="success"
        />
        <MetricCard
          title="Total Revenue"
          value={`TZS ${metrics.totalRevenue.toLocaleString()}`}
          icon={DollarSign}
          variant="warning"
        />
      </StatsGrid>

      {/* TL Performance Chart */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Team Leader Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tlPerformance}>
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="sales" name="Sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="target" name="Target" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
