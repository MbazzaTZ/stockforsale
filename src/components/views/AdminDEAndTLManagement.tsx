import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Loader2, Target, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface TLWithStats {
  id: string;
  user_id?: string;
  region_id?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  is_approved?: boolean;
  region_name?: string;
  monthly_target?: number | null;
  actualSales?: number;
  teamCount: number;
  dsrCount: number;
  salesCount: number;
  created_at: string;
}

interface DEWithStats {
  id: string;
  user_id: string;
  region_id?: string | null;
  full_name?: string;
  email?: string;
  phone?: string;
  is_approved?: boolean;
  region_name?: string;
  target?: number | null;
  actualSales?: number;
  agentCount: number;
  salesCount: number;
  created_at: string;
}

export function AdminDEAndTLManagement() {
  const queryClient = useQueryClient();
  const [selectedTL, setSelectedTL] = useState<string | null>(null);
  const [tlTarget, setTLTarget] = useState('');
  const [selectedDE, setSelectedDE] = useState<string | null>(null);
  const [deTarget, setDETarget] = useState('');

  // Fetch TLs with their data
  const { data: teamLeaders = [], isLoading: tlsLoading } = useQuery({
    queryKey: ['team-leaders-full'],
    queryFn: async () => {
      try {
        console.log('🔍 Fetching TLs...');
        
        // First, get all profiles (this query works in AdminSignupManagement)
        const { data: allProfiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, email, phone, is_approved');

        if (profilesError) {
          console.error('❌ Error fetching all profiles:', profilesError);
          return [];
        }

        console.log(`✅ Fetched ${allProfiles?.length || 0} total profiles`);

        // Fetch team_leaders table data
        const { data: tlsData, error: tlsError } = await supabase
          .from('team_leaders')
          .select('id, user_id, region_id, monthly_target, created_at')
          .order('created_at', { ascending: false });

        if (tlsError) {
          console.error('❌ Error fetching team_leaders:', tlsError);
          return [];
        }

        console.log(`✅ Fetched ${tlsData?.length || 0} team leaders`);
        if (!tlsData || tlsData.length === 0) return [];

        // Merge the data
        const tlsWithData = await Promise.all(
          tlsData.map(async (tl: any) => {
            // Find profile from the list we already fetched
            const profile = allProfiles?.find(p => p.id === tl.user_id);

            if (!profile) {
              console.warn('⚠️ No profile found for TL user_id:', tl.user_id);
            } else {
              console.log('✅ Found profile for TL:', { user_id: tl.user_id, name: profile.full_name, email: profile.email });
            }

            // Get region name
            let region_name = null;
            if (tl.region_id) {
              const { data: region } = await supabase
                .from('regions')
                .select('name')
                .eq('id', tl.region_id)
                .single();
              region_name = region?.name;
            }

            // Get team and DSR counts
            const { count: teamCount = 0 } = await supabase
              .from('teams')
              .select('*', { count: 'exact', head: true })
              .eq('tl_id', tl.id);

            const { count: dsrCount = 0 } = await supabase
              .from('dsrs')
              .select('*', { count: 'exact', head: true })
              .eq('tl_id', tl.id);

            // Get sales count and total amount
            const { data: salesData } = await supabase
              .from('sales')
              .select('amount')
              .eq('tl_id', tl.id);
            
            const salesCount = salesData?.length || 0;
            const actualSales = salesData?.reduce((sum, sale) => sum + (sale.amount || 0), 0) || 0;

            return {
              id: tl.id,
              user_id: tl.user_id,
              region_id: tl.region_id,
              region_name,
              full_name: profile?.full_name || profile?.email || 'No Name',
              email: profile?.email || 'No Email',
              phone: profile?.phone || '',
              is_approved: profile?.is_approved || false,
              monthly_target: tl.monthly_target,
              actualSales,
              teamCount,
              dsrCount,
              salesCount,
              created_at: tl.created_at,
            };
          })
        );

        console.log('✅ Final TLs with data:', tlsWithData);
        return tlsWithData;
      } catch (err) {
        console.error('Error fetching TLs:', err);
        return [];
      }
    },
  });

  // Fetch DEs with their data
  const { data: des = [], isLoading: desLoading } = useQuery({
    queryKey: ['distribution-executives'],
    queryFn: async () => {
      try {
        console.log('🔍 Fetching DEs...');
        
        // First, get all profiles (this query works in AdminSignupManagement)
        const { data: allProfiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, email, phone, is_approved');

        if (profilesError) {
          console.error('❌ Error fetching all profiles:', profilesError);
          return [];
        }

        console.log(`✅ Fetched ${allProfiles?.length || 0} total profiles for DEs`);

        // Fetch distribution_executives table data
        const { data: desData, error: desError } = await supabase
          .from('distribution_executives')
          .select('id, user_id, region_id, target, created_at')
          .order('created_at', { ascending: false });

        if (desError) {
          console.error('❌ Error fetching distribution_executives:', desError);
          return [];
        }

        console.log(`✅ Fetched ${desData?.length || 0} distribution executives`);
        if (!desData || desData.length === 0) return [];

        // Merge the data
        const desWithData = await Promise.all(
          desData.map(async (de: any) => {
            // Find profile from the list we already fetched
            const profile = allProfiles?.find(p => p.id === de.user_id);

            if (!profile) {
              console.warn('⚠️ No profile found for DE user_id:', de.user_id);
            } else {
              console.log('✅ Found profile for DE:', { user_id: de.user_id, name: profile.full_name, email: profile.email });
            }

            // Get region name
            let region_name = null;
            if (de.region_id) {
              const { data: region } = await supabase
                .from('regions')
                .select('name')
                .eq('id', de.region_id)
                .single();
              region_name = region?.name;
            }

            // Get agent count (DSRs under this DE)
            const { count: agentCount = 0 } = await supabase
              .from('dsrs')
              .select('*', { count: 'exact', head: true })
              .eq('de_id', de.id);

            // Get sales count
            const { data: salesData } = await supabase
              .from('sales')
              .select('amount')
              .eq('de_id', de.id);
            
            const salesCount = salesData?.length || 0;
            const actualSales = salesData?.reduce((sum, sale) => sum + (sale.amount || 0), 0) || 0;

            return {
              id: de.id,
              user_id: de.user_id,
              region_id: de.region_id,
              full_name: profile?.full_name || profile?.email || 'No Name',
              email: profile?.email || 'No Email',
              phone: profile?.phone || '',
              is_approved: profile?.is_approved || false,
              region_name,
              target: de.target,
              actualSales,
              agentCount,
              salesCount,
              created_at: de.created_at,
            };
          })
        );

        console.log('✅ Final DEs with data:', desWithData);
        return desWithData;
      } catch (err) {
        console.error('Error fetching DEs:', err);
        return [];
      }
    },
  });

  // Set TL target mutation
  const setTLTargetMutation = useMutation({
    mutationFn: async ({ tlId, target }: { tlId: string; target: number }) => {
      const { error } = await supabase
        .from('team_leaders')
        .update({ monthly_target: target })
        .eq('id', tlId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-leaders-full'] });
      toast.success('TL target updated');
      setSelectedTL(null);
      setTLTarget('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to set target');
    },
  });

  // Set DE target mutation
  const setDETargetMutation = useMutation({
    mutationFn: async ({ deId, target }: { deId: string; target: number }) => {
      const { error } = await supabase
        .from('distribution_executives')
        .update({ target: target })
        .eq('id', deId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distribution-executives'] });
      toast.success('DE target updated');
      setSelectedDE(null);
      setDETarget('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to set target');
    },
  });

  const isLoading = tlsLoading || desLoading;

  // Calculate TL totals
  const tlTotalTarget = teamLeaders.reduce((sum, tl) => sum + (tl.monthly_target || 0), 0);
  const tlTotalActual = teamLeaders.reduce((sum, tl) => sum + (tl.actualSales || 0), 0);
  const tlCount = teamLeaders.length;

  // Calculate DE totals
  const deTotalTarget = des.reduce((sum, de) => sum + (de.target || 0), 0);
  const deTotalActual = des.reduce((sum, de) => sum + (de.actualSales || 0), 0);
  const deCount = des.length;

  // Calculate combined totals
  const combinedTotalTarget = tlTotalTarget + deTotalTarget;
  const combinedTotalActual = tlTotalActual + deTotalActual;
  const combinedCount = tlCount + deCount;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">DE and TL Management</h1>
        <p className="text-muted-foreground">Manage Distribution Executives and Team Leaders, set targets</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Count</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{combinedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">{tlCount} TLs + {deCount} DEs</p>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Target (TL + DE)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{combinedTotalTarget.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              TL: {tlTotalTarget.toLocaleString()} + DE: {deTotalTarget.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Actual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{combinedTotalActual.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              TL: {tlTotalActual.toLocaleString()} + DE: {deTotalActual.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Achievement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              {combinedTotalTarget > 0 ? `${((combinedTotalActual / combinedTotalTarget) * 100).toFixed(1)}%` : '0%'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Combined TL + DE performance
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="tls" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tls" className="gap-2">
            <Users className="h-4 w-4" />
            Team Leaders ({teamLeaders.length})
          </TabsTrigger>
          <TabsTrigger value="des" className="gap-2">
            <Users className="h-4 w-4" />
            Distribution Executives ({des.length})
          </TabsTrigger>
        </TabsList>

        {/* Team Leaders Tab */}
        <TabsContent value="tls">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Team Leaders
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : teamLeaders.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium text-foreground">No Team Leaders</p>
                  <p className="text-muted-foreground">Team Leaders will appear here once they sign up and are approved</p>
                </div>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Region</TableHead>
                        <TableHead>Teams</TableHead>
                        <TableHead>DSRs</TableHead>
                        <TableHead>Sales Count</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Actual</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamLeaders.map((tl: TLWithStats) => (
                        <TableRow key={tl.id}>
                          <TableCell className="font-medium">{tl.full_name}</TableCell>
                          <TableCell>{tl.email}</TableCell>
                          <TableCell>
                            {tl.region_name ? (
                              <Badge variant="outline">{tl.region_name}</Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell>{tl.teamCount}</TableCell>
                          <TableCell>{tl.dsrCount}</TableCell>
                          <TableCell>{tl.salesCount}</TableCell>
                          <TableCell>
                            {selectedTL === tl.id ? (
                              <div className="flex gap-2">
                                <Input
                                  type="number"
                                  placeholder="Enter target"
                                  value={tlTarget}
                                  onChange={(e) => setTLTarget(e.target.value)}
                                  className="w-32 h-8"
                                  autoFocus
                                />
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    if (tlTarget) {
                                      setTLTargetMutation.mutate({
                                        tlId: tl.id,
                                        target: parseFloat(tlTarget),
                                      });
                                    }
                                  }}
                                  disabled={setTLTargetMutation.isPending}
                                  className="whitespace-nowrap"
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedTL(null);
                                    setTLTarget('');
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <span className="font-semibold">{tl.monthly_target?.toLocaleString() || '0'}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="font-medium text-success">{tl.actualSales?.toLocaleString() || '0'}</span>
                          </TableCell>
                          <TableCell>
                            <Badge className={tl.is_approved ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}>
                              {tl.is_approved ? 'Active' : 'Pending'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {selectedTL !== tl.id && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedTL(tl.id);
                                  setTLTarget((tl.monthly_target || 0).toString());
                                }}
                                className="gap-2"
                              >
                                <Target className="h-4 w-4" />
                                Set Target
                              </Button>
                            )}
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

        {/* Distribution Executives Tab */}
        <TabsContent value="des">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Distribution Executives
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : des.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium text-foreground">No Distribution Executives</p>
                  <p className="text-muted-foreground">DEs will appear here once they sign up and are approved</p>
                </div>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Region</TableHead>
                        <TableHead>Agents</TableHead>
                        <TableHead>Sales Count</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Actual</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {des.map((de: DEWithStats) => (
                        <TableRow key={de.id}>
                          <TableCell className="font-medium">{de.full_name}</TableCell>
                          <TableCell>{de.email}</TableCell>
                          <TableCell>
                            {de.region_name ? (
                              <Badge variant="outline">{de.region_name}</Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell>{de.agentCount}</TableCell>
                          <TableCell>{de.salesCount}</TableCell>
                          <TableCell>
                            {selectedDE === de.id ? (
                              <div className="flex gap-2">
                                <Input
                                  type="number"
                                  placeholder="Enter target"
                                  value={deTarget}
                                  onChange={(e) => setDETarget(e.target.value)}
                                  className="w-32 h-8"
                                  autoFocus
                                />
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    if (deTarget) {
                                      setDETargetMutation.mutate({
                                        deId: de.id,
                                        target: parseFloat(deTarget),
                                      });
                                    }
                                  }}
                                  disabled={setDETargetMutation.isPending}
                                  className="whitespace-nowrap"
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedDE(null);
                                    setDETarget('');
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <span className="font-semibold">{de.target?.toLocaleString() || '0'}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="font-medium text-success">{de.actualSales?.toLocaleString() || '0'}</span>
                          </TableCell>
                          <TableCell>
                            <Badge className={de.is_approved ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}>
                              {de.is_approved ? 'Active' : 'Pending'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {selectedDE !== de.id && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedDE(de.id);
                                  setDETarget((de.target || 0).toString());
                                }}
                                className="gap-2"
                              >
                                <Target className="h-4 w-4" />
                                Set Target
                              </Button>
                            )}
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
      </Tabs>
    </div>
  );
}
