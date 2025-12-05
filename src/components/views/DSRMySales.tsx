import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ShoppingCart, Search, Loader2, ArrowLeft, Filter } from 'lucide-react';

interface DSRMySalesProps {
  onNavigate: (tab: string) => void;
}

interface Sale {
  id: string;
  sale_id: string;
  smart_card_number: string;
  sn_number: string;
  sale_type: string;
  payment_status: string;
  tl_verified: boolean;
  admin_approved: boolean;
  sale_price: number;
  created_at: string;
}

export function DSRMySales({ onNavigate }: DSRMySalesProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (user) {
      fetchSales();
    }
  }, [user]);

  async function fetchSales() {
    if (!user) return;

    try {
      const { data: dsrData } = await supabase
        .from('dsrs')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!dsrData) {
        setLoading(false);
        return;
      }

      const { data: salesData } = await supabase
        .from('sales')
        .select('*')
        .eq('dsr_id', dsrData.id)
        .order('created_at', { ascending: false });

      setSales(salesData || []);
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setLoading(false);
    }
  }

  const getStatusBadge = (sale: Sale) => {
    if (sale.admin_approved) {
      return <Badge className="bg-success/10 text-success">Approved</Badge>;
    }
    if (sale.tl_verified) {
      return <Badge className="bg-info/10 text-info">TL Verified</Badge>;
    }
    return <Badge variant="outline">Pending</Badge>;
  };

  const filteredSales = sales.filter(sale => {
    const matchesSearch = 
      sale.sale_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.smart_card_number.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (statusFilter === 'all') return matchesSearch;
    if (statusFilter === 'approved') return matchesSearch && sale.admin_approved;
    if (statusFilter === 'verified') return matchesSearch && sale.tl_verified && !sale.admin_approved;
    if (statusFilter === 'pending') return matchesSearch && !sale.tl_verified;
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => onNavigate('dashboard')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Sales</h1>
          <p className="text-muted-foreground">View all your recorded sales</p>
        </div>
      </div>

      <Card className="glass">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Sales History ({filteredSales.length})
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search sales..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sales</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="verified">TL Verified</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredSales.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium text-foreground">No Sales Found</p>
              <p className="text-muted-foreground mb-4">Start recording sales to see them here</p>
              <Button onClick={() => onNavigate('add-sale')}>Add First Sale</Button>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Sale ID</TableHead>
                    <TableHead>Smartcard</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-medium">{sale.sale_id}</TableCell>
                      <TableCell>{sale.smart_card_number}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{sale.sale_type}</Badge>
                      </TableCell>
                      <TableCell>TZS {Number(sale.sale_price).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge className={sale.payment_status === 'paid' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}>
                          {sale.payment_status}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(sale)}</TableCell>
                      <TableCell>{new Date(sale.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
