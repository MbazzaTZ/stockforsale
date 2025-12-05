import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Boxes, Loader2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function TLStockAssignment() {
  const { user } = useAuth();
  const [selectedDSR, setSelectedDSR] = useState('');
  const [selectedStock, setSelectedStock] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const { data: tlData } = useQuery({
    queryKey: ['tl-record', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('team_leaders').select('id').eq('user_id', user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: myStock = [], isLoading: stockLoading } = useQuery({
    queryKey: ['tl-stock', tlData?.id],
    queryFn: async () => {
      const { data } = await supabase.from('stock').select('id, stock_id, smartcard_number, serial_number, type, status, date_assigned').eq('assigned_to_tl', tlData!.id).eq('status', 'assigned-tl');
      return data || [];
    },
    enabled: !!tlData,
  });

  const { data: dsrs = [] } = useQuery({
    queryKey: ['tl-dsrs-list', tlData?.id],
    queryFn: async () => {
      const { data } = await supabase.from('dsrs').select('id, profiles!inner(full_name)').eq('tl_id', tlData!.id);
      return data || [];
    },
    enabled: !!tlData,
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      for (const stockId of selectedStock) {
        await supabase.from('stock').update({ status: 'assigned-dsr', assigned_to_dsr: selectedDSR, date_assigned: new Date().toISOString() }).eq('id', stockId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tl-stock'] });
      toast.success(`${selectedStock.length} items assigned to DSR`);
      setSelectedStock([]);
      setSelectedDSR('');
    },
  });

  if (stockLoading) return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Assign Stock to DSRs</h1>
      <Card className="glass">
        <CardContent className="p-6 flex gap-4 items-end">
          <div className="flex-1">
            <Select value={selectedDSR} onValueChange={setSelectedDSR}>
              <SelectTrigger><SelectValue placeholder="Select DSR" /></SelectTrigger>
              <SelectContent>
                {dsrs.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.profiles?.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Badge variant="secondary">{selectedStock.length} selected</Badge>
          <Button onClick={() => assignMutation.mutate()} disabled={!selectedDSR || selectedStock.length === 0}>
            <Check className="h-4 w-4 mr-1" />Assign
          </Button>
        </CardContent>
      </Card>
      <Card className="glass">
        <CardHeader><CardTitle><Boxes className="h-5 w-5 inline mr-2" />My Stock ({myStock.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead className="w-12"></TableHead><TableHead>Stock ID</TableHead><TableHead>Type</TableHead></TableRow></TableHeader>
            <TableBody>
              {myStock.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell><Checkbox checked={selectedStock.includes(s.id)} onCheckedChange={() => setSelectedStock(p => p.includes(s.id) ? p.filter(i => i !== s.id) : [...p, s.id])} /></TableCell>
                  <TableCell>{s.stock_id}</TableCell>
                  <TableCell><Badge variant="outline">{s.type}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
