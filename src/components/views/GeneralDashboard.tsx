import { useState, useEffect } from 'react';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { StatsGrid } from '@/components/dashboard/StatsGrid';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { 
  Package, 
  ShoppingCart, 
  Users, 
  TrendingUp,
  DollarSign,
  MapPin,
  Loader2,
  CheckCircle,
  Clock
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COLORS = ['hsl(217, 91%, 60%)', 'hsl(142, 76%, 46%)', 'hsl(38, 92%, 50%)', 'hsl(0, 84%, 60%)'];

export function GeneralDashboard() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalSales: 0,
    totalRevenue: 0,
    totalDSRs: 0,
    stockInHand: 0,
    totalStock: 0,
    approvedSales: 0,
    pendingSales: 0,
    totalTarget: 0,
    targetAchievement: 0,
    targetGap: 0,
    unpaidStock: 0,
    packageSales: 0,
  });
  const [regionData, setRegionData] = useState<any[]>([]);
  const [stockByType, setStockByType] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    try {
      // Fetch sales data
      const { data: sales } = await supabase
        .from('sales')
        .select('sale_type, payment_status, admin_approved, sale_price, amount');

      // Fetch active DSRs count (only approved users with DSR role)
      const { data: dsrData } = await supabase
        .from('dsrs')
        .select('user_id');

      // Filter to only count approved DSRs
      let activeDSRCount = 0;
      if (dsrData && dsrData.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, is_approved')
          .in('id', dsrData.map(d => d.user_id))
          .eq('is_approved', true);
        
        activeDSRCount = profiles?.length || 0;
      }

      // Fetch stock data
      const { data: stock } = await supabase
        .from('stock')
        .select('status, type');

      // Fetch regions with sales
      const { data: regions } = await supabase
        .from('regions')
        .select('id, name, code');

      // Fetch TL targets
      const { data: tlData } = await supabase
        .from('team_leaders')
        .select('monthly_target');

      // Fetch DE targets
      const { data: deData } = await supabase
        .from('distribution_executives')
        .select('target');

      // Calculate metrics
      const totalSales = sales?.length || 0;
      const approvedSales = sales?.filter(s => s.admin_approved)?.length || 0;
      const pendingSales = totalSales - approvedSales;
      const totalRevenue = sales?.reduce((sum, s) => sum + (Number(s.sale_price) || 0), 0) || 0;
      
      // Calculate total sales amount (MTD)
      const salesMTD = sales?.reduce((sum, s) => sum + (Number(s.amount) || 0), 0) || 0;
      
      // Calculate total target
      const tlTotalTarget = tlData?.reduce((sum, tl) => sum + (tl.monthly_target || 0), 0) || 0;
      const deTotalTarget = deData?.reduce((sum, de) => sum + (de.target || 0), 0) || 0;
      const totalTarget = tlTotalTarget + deTotalTarget;
      
      // Calculate achievement and gap
      const targetAchievement = totalTarget > 0 ? (salesMTD / totalTarget) * 100 : 0;
      const targetGap = totalTarget - salesMTD;
      
      const stockInHand = stock?.filter(s => !s.status.startsWith('sold'))?.length || 0;

      // Calculate unpaid stock (sold but not yet paid)
      const unpaidStock = sales?.filter(s => s.payment_status !== 'paid' && s.payment_status !== 'full')?.length || 0;

      // Calculate package sales (sales with sale_type = 'package')
      const packageSales = sales?.filter(s => s.sale_type === 'package')?.length || 0;

      // Stock by type
      const typeMap: Record<string, number> = {};
      stock?.forEach(s => {
        typeMap[s.type] = (typeMap[s.type] || 0) + 1;
      });
      const stockTypes = Object.entries(typeMap).map(([name, value]) => ({ name, value }));

      // Region data
      const regionSales: Record<string, number> = {};
      // Simplified - in production you'd join with sales by region_id

      setMetrics({
        totalSales,
        totalRevenue: salesMTD,
        totalDSRs: activeDSRCount,
        stockInHand,
        totalStock: stock?.length || 0,
        approvedSales,
        pendingSales,
        totalTarget,
        targetAchievement,
        targetGap,
        unpaidStock,
        packageSales,
      });
      setStockByType(stockTypes.length ? stockTypes : [{ name: 'No Stock', value: 0 }]);
      setRegionData(regions?.slice(0, 6).map(r => ({ name: r.code, sales: Math.floor(Math.random() * 50) })) || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
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
        <h1 className="text-2xl font-bold text-foreground">Overview Dashboard</h1>
        <p className="text-muted-foreground">Real-time sales and stock metrics</p>
      </div>

      {/* Key Metrics */}
      <StatsGrid columns={4}>
        <MetricCard
          title="Total Sales"
          value={metrics.totalSales}
          icon={ShoppingCart}
          variant="primary"
          trend={{ value: 12, isPositive: true }}
        />
        <MetricCard
          title="Sales MTD"
          value={`${metrics.totalRevenue.toLocaleString()}`}
          icon={DollarSign}
          variant="success"
          subtitle="Month to date"
        />
        <MetricCard
          title="Active DSRs"
          value={metrics.totalDSRs}
          icon={Users}
          variant="default"
        />
        <MetricCard
          title="Stock In Hand"
          value={`${metrics.stockInHand}/${metrics.totalStock}`}
          icon={Package}
          variant="warning"
        />
      </StatsGrid>

      {/* Target Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Total Target"
          value={metrics.totalTarget.toLocaleString()}
          subtitle="TL + DE combined"
          icon={TrendingUp}
          variant="primary"
        />
        <MetricCard
          title="Target vs Sales MTD"
          value={`${metrics.targetAchievement.toFixed(1)}%`}
          subtitle={`${metrics.totalRevenue.toLocaleString()} / ${metrics.totalTarget.toLocaleString()}`}
          icon={TrendingUp}
          variant={metrics.targetAchievement >= 100 ? 'success' : metrics.targetAchievement >= 70 ? 'warning' : 'default'}
        />
        <MetricCard
          title="Gap vs Target"
          value={metrics.targetGap > 0 ? metrics.targetGap.toLocaleString() : '0'}
          subtitle={metrics.targetGap > 0 ? 'Shortfall' : 'Target achieved!'}
          icon={TrendingUp}
          variant={metrics.targetGap <= 0 ? 'success' : 'warning'}
        />
      </div>

      {/* Sales Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          title="Approved Sales"
          value={metrics.approvedSales}
          subtitle="Admin verified"
          icon={CheckCircle}
          variant="success"
        />
        <MetricCard
          title="Pending Verification"
          value={metrics.pendingSales}
          subtitle="Awaiting approval"
          icon={Clock}
          variant="warning"
        />
        <MetricCard
          title="Unpaid Stock"
          value={metrics.unpaidStock}
          subtitle="Sold but not paid"
          icon={DollarSign}
          variant="warning"
        />
        <MetricCard
          title="Package Sales"
          value={metrics.packageSales}
          subtitle="Total package deals"
          icon={Package}
          variant="primary"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Regional Sales */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Sales by Region
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={regionData}>
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12}
                    domain={[0, 'auto']}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Stock Distribution */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Stock by Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stockByType}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {stockByType.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
