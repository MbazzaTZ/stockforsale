import { useState, useEffect } from 'react';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { StatsGrid } from '@/components/dashboard/StatsGrid';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Package,
  ShoppingCart,
  TrendingUp,
  DollarSign,
  Plus,
  Loader2,
  ArrowRight
} from 'lucide-react';

interface DSRDashboardProps {
  onNavigate: (tab: string) => void;
}

export function DSRDashboard({ onNavigate }: DSRDashboardProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dsrId, setDsrId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState({
    myStock: 0,
    totalSales: 0,
    approvedSales: 0,
    totalCommission: 0,
    pendingCommission: 0,
  });
  const [recentSales, setRecentSales] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      fetchDSRData();
    }
  }, [user]);

  async function fetchDSRData() {
    if (!user) return;

    try {
      // Get DSR record
      const { data: dsrData } = await supabase
        .from('dsrs')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!dsrData) {
        setLoading(false);
        return;
      }

      setDsrId(dsrData.id);

      // Fetch my stock
      const { count: stockCount } = await supabase
        .from('stock')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to_dsr', dsrData.id)
        .eq('status', 'assigned-dsr');

      // Fetch my sales
      const { data: sales, count: salesCount } = await supabase
        .from('sales')
        .select('*', { count: 'exact' })
        .eq('dsr_id', dsrData.id)
        .order('created_at', { ascending: false })
        .limit(5);

      // Approved sales
      const { count: approvedCount } = await supabase
        .from('sales')
        .select('*', { count: 'exact', head: true })
        .eq('dsr_id', dsrData.id)
        .eq('admin_approved', true);

      // Commissions
      const { data: commissions } = await supabase
        .from('commissions')
        .select('amount, is_paid')
        .eq('dsr_id', dsrData.id);

      const totalCommission = commissions?.reduce((sum, c) => sum + Number(c.amount), 0) || 0;
      const pendingCommission = commissions?.filter(c => !c.is_paid).reduce((sum, c) => sum + Number(c.amount), 0) || 0;

      setMetrics({
        myStock: stockCount || 0,
        totalSales: salesCount || 0,
        approvedSales: approvedCount || 0,
        totalCommission,
        pendingCommission,
      });
      setRecentSales(sales || []);
    } catch (error) {
      console.error('Error fetching DSR data:', error);
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
          <h1 className="text-2xl font-bold text-foreground">My Dashboard</h1>
          <p className="text-muted-foreground">Track your sales and commissions</p>
        </div>
        <Button onClick={() => onNavigate('add-sale')} className="gap-2">
          <Plus className="h-4 w-4" />
          Add New Sale
        </Button>
      </div>

      {/* Key Metrics */}
      <StatsGrid columns={4}>
        <MetricCard
          title="My Stock"
          value={metrics.myStock}
          icon={Package}
          variant="primary"
        />
        <MetricCard
          title="Total Sales"
          value={metrics.totalSales}
          icon={ShoppingCart}
          variant="default"
        />
        <MetricCard
          title="Approved Sales"
          value={metrics.approvedSales}
          icon={TrendingUp}
          variant="success"
        />
        <MetricCard
          title="Total Commission"
          value={`TZS ${metrics.totalCommission.toLocaleString()}`}
          icon={DollarSign}
          variant="warning"
        />
      </StatsGrid>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card 
          className="glass cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => onNavigate('stock')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center">
                  <Package className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">View Stock</p>
                  <p className="text-sm text-muted-foreground">{metrics.myStock} items</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className="glass cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => onNavigate('add-sale')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl gradient-success flex items-center justify-center">
                  <ShoppingCart className="h-6 w-6 text-success-foreground" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Add Sale</p>
                  <p className="text-sm text-muted-foreground">Record new sale</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className="glass cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => onNavigate('commission')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl gradient-warning flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-warning-foreground" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Commission</p>
                  <p className="text-sm text-muted-foreground">TZS {metrics.pendingCommission.toLocaleString()} pending</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Sales */}
      <Card className="glass">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Recent Sales
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => onNavigate('my-sales')}>
            View All
          </Button>
        </CardHeader>
        <CardContent>
          {recentSales.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingCart className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">No sales recorded yet</p>
              <Button className="mt-4" onClick={() => onNavigate('add-sale')}>
                Add Your First Sale
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {recentSales.map((sale) => (
                <div
                  key={sale.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-background/50"
                >
                  <div>
                    <p className="font-medium text-foreground">{sale.sale_id}</p>
                    <p className="text-sm text-muted-foreground">SC: {sale.smart_card_number}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={sale.admin_approved ? 'default' : sale.tl_verified ? 'secondary' : 'outline'}
                      className={sale.admin_approved ? 'bg-success/10 text-success' : ''}
                    >
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
