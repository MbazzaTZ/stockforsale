import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UserCheck, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';

export function TLDSRManagement() {
  const { user } = useAuth();

  // Fetch TL's DSRs
  const { data: dsrs = [], isLoading } = useQuery({
    queryKey: ['tl-dsrs', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get TL record
      const { data: tlData } = await supabase
        .from('team_leaders')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!tlData) return [];

      const { data, error } = await supabase
        .from('dsrs')
        .select(`
          id,
          created_at,
          profiles!inner(full_name, email, phone, is_approved),
          teams(name),
          regions(name)
        `)
        .eq('tl_id', tlData.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get sales count for each DSR
      const dsrsWithCounts = await Promise.all(
        (data || []).map(async (dsr) => {
          const { count } = await supabase
            .from('sales')
            .select('*', { count: 'exact', head: true })
            .eq('dsr_id', dsr.id);
          return { ...dsr, salesCount: count || 0 };
        })
      );

      return dsrsWithCounts;
    },
    enabled: !!user,
  });

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
        <h1 className="text-2xl font-bold text-foreground">DSR Management</h1>
        <p className="text-muted-foreground">View and manage your DSRs</p>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            My DSRs ({dsrs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dsrs.length === 0 ? (
            <div className="text-center py-12">
              <UserCheck className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium text-foreground">No DSRs Yet</p>
              <p className="text-muted-foreground">DSRs will appear here once they are assigned to your teams</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Sales</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dsrs.map((dsr: any) => (
                    <TableRow key={dsr.id}>
                      <TableCell className="font-medium">{dsr.profiles?.full_name}</TableCell>
                      <TableCell>{dsr.profiles?.email}</TableCell>
                      <TableCell>{dsr.profiles?.phone || '-'}</TableCell>
                      <TableCell>{dsr.teams?.name || '-'}</TableCell>
                      <TableCell>{dsr.regions?.name || '-'}</TableCell>
                      <TableCell>{dsr.salesCount}</TableCell>
                      <TableCell>
                        <Badge className={dsr.profiles?.is_approved ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}>
                          {dsr.profiles?.is_approved ? 'Active' : 'Pending'}
                        </Badge>
                      </TableCell>
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
