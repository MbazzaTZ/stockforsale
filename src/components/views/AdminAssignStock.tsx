import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Boxes, Loader2, ArrowRight, Check, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { StatsGrid } from '@/components/dashboard/StatsGrid';

export function AdminAssignStock() {
  const { user } = useAuth();
  const [selectedTL, setSelectedTL] = useState('');
  const [selectedStock, setSelectedStock] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // Fetch unassigned stock with region data
  const { data: unassignedStock = [], isLoading: stockLoading } = useQuery({
    queryKey: ['unassigned-stock'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock')
        .select(`
          id,
          stock_id,
          smartcard_number,
          serial_number,
          type,
          status,
          batch_id,
          region_id,
          assigned_to_tl,
          assigned_to_team,
          assigned_to_dsr,
          assigned_by,
          date_assigned,
          created_at,
          region:regions(name)
        `)
        .eq('status', 'unassigned')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch team leaders
  const { data: teamLeaders = [], isLoading: tlLoading } = useQuery({
    queryKey: ['team-leaders'],
    queryFn: async () => {
      try {
        // Get all profiles first (this works due to RLS policies)
        const { data: allProfiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, email');

        if (profilesError) {
          console.error('Error fetching profiles:', profilesError);
          return [];
        }

        // Get team leaders
        const { data: tlsData, error: tlError } = await supabase
          .from('team_leaders')
          .select('id, user_id, region_id');

        if (tlError) {
          console.error('Error fetching team_leaders:', tlError);
          return [];
        }

        if (!tlsData) return [];

        // Get regions
        const { data: regions } = await supabase
          .from('regions')
          .select('id, name');

        // Merge data
        const tlsWithData = tlsData.map((tl: any) => {
          const profile = allProfiles?.find(p => p.id === tl.user_id);
          const region = regions?.find(r => r.id === tl.region_id);
          
          return {
            id: tl.id,
            user_id: tl.user_id,
            profiles: {
              full_name: profile?.full_name || profile?.email || 'Unknown',
              email: profile?.email || '',
            },
            regions: region ? { name: region.name } : null,
          };
        });

        return tlsWithData;
      } catch (error) {
        console.error('Error in team leaders query:', error);
        return [];
      }
    },
  });

  // Fetch assigned stock by TL
  const { data: assignedStock = [] } = useQuery({
    queryKey: ['assigned-stock-by-tl'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock')
        .select('assigned_to_tl, type')
        .eq('status', 'assigned-tl');
      if (error) throw error;
      return data;
    },
  });

  // Assign mutation
  const assignMutation = useMutation({
    mutationFn: async () => {
      const updates = selectedStock.map(stockId => ({
        id: stockId,
        status: 'assigned-tl' as const,
        assigned_to_tl: selectedTL,
        assigned_by: user?.id,
        date_assigned: new Date().toISOString(),
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('stock')
          .update({
            status: update.status,
            assigned_to_tl: update.assigned_to_tl,
            assigned_by: update.assigned_by,
            date_assigned: update.date_assigned,
          })
          .eq('id', update.id);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unassigned-stock'] });
      toast.success(`${selectedStock.length} items assigned to TL`);
      setSelectedStock([]);
      setSelectedTL('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to assign stock');
    },
  });

  const toggleStockSelection = (stockId: string) => {
    setSelectedStock(prev => 
      prev.includes(stockId) 
        ? prev.filter(id => id !== stockId)
        : [...prev, stockId]
    );
  };

  const toggleAllStock = () => {
    if (selectedStock.length === unassignedStock.length) {
      setSelectedStock([]);
    } else {
      setSelectedStock(unassignedStock.map(s => s.id));
    }
  };

  // Calculate stock assigned to each TL
  const getTLStockSummary = (tlId: string) => {
    const tlAssignedStock = assignedStock.filter((s: any) => s.assigned_to_tl === tlId);
    return {
      total: tlAssignedStock.length,
      doCount: tlAssignedStock.filter((s: any) => s.type === 'Decoder Only (DO)' || s.type === 'DO').length,
      fsCount: tlAssignedStock.filter((s: any) => s.type === 'Full Set (FS)' || s.type === 'FS').length,
    };
  };

  const isLoading = stockLoading || tlLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Assign Stock to TLs</h1>
        <p className="text-muted-foreground">Select stock items and assign them to Team Leaders</p>
      </div>

      {/* TL Stock Assignment Summary */}
      {teamLeaders.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-3">Stock Assignment Summary by TL</h3>
          <StatsGrid columns={teamLeaders.length > 3 ? 4 : teamLeaders.length > 2 ? 3 : 2}>
            {teamLeaders.map((tl: any) => {
              const summary = getTLStockSummary(tl.id);
              return (
                <MetricCard
                  key={tl.id}
                  title={`${tl.profiles?.full_name || 'Unknown'}`}
                  value={summary.total}
                  subtitle={`DO: ${summary.doCount} | FS: ${summary.fsCount}`}
                  icon={Users}
                  variant={summary.total > 0 ? 'success' : 'default'}
                />
              );
            })}
          </StatsGrid>
        </div>
      )}

      {/* Assignment Panel */}
      <Card className="glass">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-start md:items-end gap-4">
            <div className="flex-1 space-y-2">
              <Label>Select Team Leader</Label>
              <Select value={selectedTL} onValueChange={setSelectedTL}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a Team Leader" />
                </SelectTrigger>
                <SelectContent>
                  {teamLeaders.map((tl: any) => (
                    <SelectItem key={tl.id} value={tl.id}>
                      {tl.profiles?.full_name} {tl.regions?.name ? `(${tl.regions.name})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Badge variant="secondary">{selectedStock.length} selected</Badge>
              <ArrowRight className="h-4 w-4" />
            </div>
            <Button 
              onClick={() => assignMutation.mutate()}
              disabled={assignMutation.isPending || selectedStock.length === 0 || !selectedTL}
              className="gap-2"
            >
              {assignMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Assign Stock
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stock Table */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-primary" />
            Unassigned Stock ({unassignedStock.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {unassignedStock.length === 0 ? (
            <div className="text-center py-12">
              <Boxes className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium text-foreground">No Unassigned Stock</p>
              <p className="text-muted-foreground">All stock has been assigned to Team Leaders</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedStock.length === unassignedStock.length && unassignedStock.length > 0}
                        onCheckedChange={toggleAllStock}
                      />
                    </TableHead>
                    <TableHead>Stock ID</TableHead>
                    <TableHead>Smartcard</TableHead>
                    <TableHead>Serial No.</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Region</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unassignedStock.map((item: any) => (
                    <TableRow 
                      key={item.id}
                      className={selectedStock.includes(item.id) ? 'bg-primary/5' : ''}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedStock.includes(item.id)}
                          onCheckedChange={() => toggleStockSelection(item.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{item.stock_id}</TableCell>
                      <TableCell>{item.smartcard_number || '-'}</TableCell>
                      <TableCell>{item.serial_number || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.type}</Badge>
                      </TableCell>
                      <TableCell>{item.region?.name || '-'}</TableCell>
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
