import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileCheck, Loader2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function TLSalesVerification() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: tlData } = useQuery({
    queryKey: ['tl-record', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('team_leaders').select('id').eq('user_id', user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: pendingSales = [], isLoading } = useQuery({
    queryKey: ['pending-verification', tlData?.id],
    queryFn: async () => {
      const { data } = await supabase.from('sales').select('*, dsrs!inner(profiles!inner(full_name))').eq('tl_id', tlData!.id).eq('tl_verified', false);
      return data || [];
    },
    enabled: !!tlData,
  });

  const verifyMutation = useMutation({
    mutationFn: async (saleId: string) => {
      await supabase.from('sales').update({ tl_verified: true, tl_verified_at: new Date().toISOString(), tl_verified_by: user?.id }).eq('id', saleId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-verification'] });
      toast.success('Sale verified!');
    },
  });

  if (isLoading) return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Sales Verification</h1>
      <p className="text-muted-foreground">Verify DSR sales before admin approval</p>
      <Card className="glass">
        <CardHeader><CardTitle><FileCheck className="h-5 w-5 inline mr-2" />Pending Verification ({pendingSales.length})</CardTitle></CardHeader>
        <CardContent>
          {pendingSales.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground"><Check className="h-12 w-12 mx-auto text-success" /><p>All sales verified!</p></div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Sale ID</TableHead><TableHead>DSR</TableHead><TableHead>Smartcard</TableHead><TableHead>Type</TableHead><TableHead>Payment</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
              <TableBody>
                {pendingSales.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.sale_id}</TableCell>
                    <TableCell>{s.dsrs?.profiles?.full_name}</TableCell>
                    <TableCell>{s.smart_card_number}</TableCell>
                    <TableCell><Badge variant="outline">{s.sale_type}</Badge></TableCell>
                    <TableCell><Badge className={s.payment_status === 'paid' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}>{s.payment_status}</Badge></TableCell>
                    <TableCell><Button size="sm" onClick={() => verifyMutation.mutate(s.id)}><Check className="h-4 w-4 mr-1" />Verify</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
