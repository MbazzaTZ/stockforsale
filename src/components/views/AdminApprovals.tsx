import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ClipboardCheck, UserCheck, Users, ShoppingCart, Loader2, Check, X, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function AdminApprovals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch pending users using the check_pending_users RPC
  const { data: pendingUsers = [], isLoading: usersLoading, error: usersError, refetch: refetchUsers } = useQuery({
    queryKey: ['pending-users'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('check_pending_users');
      if (error) {
        console.error('❌ Error fetching pending users (RPC):', error);
        throw error;
      }
      return data || [];
    },
  });

  // Fetch pending teams
  const { data: pendingTeams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ['pending-teams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select(`
          id,
          name,
          captain_name,
          created_at,
          tl:team_leaders(
            profiles:user_id(full_name)
          ),
          regions(name)
        `)
        .eq('is_approved', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch sales pending admin approval (TL verified)
  const { data: pendingSales = [], isLoading: salesLoading } = useQuery({
    queryKey: ['pending-sales'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select(`
          id,
          sale_id,
          smart_card_number,
          sale_type,
          sale_price,
          payment_status,
          created_at,
          dsr:dsrs(
            profiles:user_id(full_name)
          )
        `)
        .eq('tl_verified', true)
        .eq('admin_approved', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Approve user mutation
  const approveUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_approved: true, approval_status: 'approved' as any })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-users'] });
      toast.success('User approved successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to approve user');
    },
  });

  // Reject user mutation
  const rejectUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('profiles')
        .update({ approval_status: 'rejected' as any })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-users'] });
      toast.success('User rejected');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to reject user');
    },
  });

  // Approve team mutation
  const approveTeamMutation = useMutation({
    mutationFn: async (teamId: string) => {
      const { error } = await supabase
        .from('teams')
        .update({ 
          is_approved: true, 
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', teamId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-teams'] });
      toast.success('Team approved successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to approve team');
    },
  });

  // Approve sale mutation
  const approveSaleMutation = useMutation({
    mutationFn: async (saleId: string) => {
      const { error } = await supabase
        .from('sales')
        .update({ 
          admin_approved: true,
          admin_approved_at: new Date().toISOString(),
          admin_approved_by: user?.id,
        })
        .eq('id', saleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-sales'] });
      toast.success('Sale approved successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to approve sale');
    },
  });

  const isLoading = usersLoading || teamsLoading || salesLoading;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Approvals</h1>
        <p className="text-muted-foreground">Review and approve pending requests</p>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" className="gap-2">
            <UserCheck className="h-4 w-4" />
            Users ({pendingUsers.length})
          </TabsTrigger>
          <TabsTrigger value="teams" className="gap-2">
            <Users className="h-4 w-4" />
            Teams ({pendingTeams.length})
          </TabsTrigger>
          <TabsTrigger value="sales" className="gap-2">
            <ShoppingCart className="h-4 w-4" />
            Sales ({pendingSales.length})
          </TabsTrigger>
          <TabsTrigger value="debug" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Debug
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card className="glass">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Pending User Approvals</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['pending-users'] })}
                  disabled={usersLoading}
                >
                  {usersLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : pendingUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Check className="h-12 w-12 mx-auto mb-2 text-success" />
                  <p>No pending user approvals</p>
                </div>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.full_name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{user.phone || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{user.role}</Badge>
                          </TableCell>
                          <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                onClick={() => approveUserMutation.mutate(user.id)}
                                disabled={approveUserMutation.isPending}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="destructive"
                                onClick={() => rejectUserMutation.mutate(user.id)}
                                disabled={rejectUserMutation.isPending}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="teams">
          <Card className="glass">
            <CardHeader>
              <CardTitle>Pending Team Approvals</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingTeams.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Check className="h-12 w-12 mx-auto mb-2 text-success" />
                  <p>No pending team approvals</p>
                </div>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Team Name</TableHead>
                        <TableHead>Captain</TableHead>
                        <TableHead>TL</TableHead>
                        <TableHead>Region</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingTeams.map((team: any) => (
                        <TableRow key={team.id}>
                          <TableCell className="font-medium">{team.name}</TableCell>
                          <TableCell>{team.captain_name || '-'}</TableCell>
                          <TableCell>{team.tl?.profiles?.full_name || '-'}</TableCell>
                          <TableCell>{team.regions?.name || '-'}</TableCell>
                          <TableCell>{new Date(team.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Button 
                              size="sm" 
                              onClick={() => approveTeamMutation.mutate(team.id)}
                              disabled={approveTeamMutation.isPending}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales">
          <Card className="glass">
            <CardHeader>
              <CardTitle>Sales Pending Approval (TL Verified)</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingSales.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Check className="h-12 w-12 mx-auto mb-2 text-success" />
                  <p>No pending sales approvals</p>
                </div>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Sale ID</TableHead>
                        <TableHead>DSR</TableHead>
                        <TableHead>Smartcard</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingSales.map((sale: any) => (
                        <TableRow key={sale.id}>
                          <TableCell className="font-medium">{sale.sale_id}</TableCell>
                          <TableCell>{sale.dsr?.profiles?.full_name || '-'}</TableCell>
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
                          <TableCell>
                            <Button 
                              size="sm" 
                              onClick={() => approveSaleMutation.mutate(sale.id)}
                              disabled={approveSaleMutation.isPending}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="debug">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Debug Information
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                Open browser console (F12) to see detailed logs
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-lg space-y-2 font-mono text-xs">
                <div>
                  <strong>Pending Users Count:</strong> {pendingUsers.length}
                </div>
                <div>
                  <strong>Users Loading:</strong> {usersLoading ? 'Yes' : 'No'}
                </div>
                <div>
                  <strong>Check Console (F12):</strong>
                  <div className="mt-2 text-muted-foreground">
                    Look for logs like:
                    <br/>• "All unapproved users:"
                    <br/>• "Filtered pending users:"
                    <br/>• "Users with roles:"
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-2">Debug Steps:</h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Check if users exist in database</li>
                  <li>Verify trigger is running (check Supabase SQL logs)</li>
                  <li>Run migration: 20251205_verify_user_trigger.sql</li>
                  <li>Run in Supabase SQL: SELECT * FROM check_pending_users();</li>
                  <li>Check auth.users table directly</li>
                </ol>
              </div>

              <Button
                onClick={() => {
                  console.log('=== ADMIN APPROVALS DEBUG ===');
                  console.log('Pending Users:', pendingUsers);
                  console.log('Users Loading:', usersLoading);
                  console.log('Teams Loading:', teamsLoading);
                  console.log('Sales Loading:', salesLoading);
                  alert('Debug info logged to console. Press F12 to view.');
                }}
              >
                Log Debug Info to Console
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
