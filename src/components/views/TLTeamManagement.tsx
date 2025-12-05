import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Users, Plus, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function TLTeamManagement() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [captainName, setCaptainName] = useState('');
  const queryClient = useQueryClient();

  // Fetch TL's teams
  const { data: teams = [], isLoading } = useQuery({
    queryKey: ['tl-teams', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get TL record
      const { data: tlData } = await supabase
        .from('team_leaders')
        .select('id, region_id')
        .eq('user_id', user.id)
        .single();

      if (!tlData) return [];

      const { data, error } = await supabase
        .from('teams')
        .select(`
          id,
          name,
          captain_name,
          is_approved,
          created_at,
          regions(name)
        `)
        .eq('tl_id', tlData.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get DSR count for each team
      const teamsWithCounts = await Promise.all(
        (data || []).map(async (team) => {
          const { count } = await supabase
            .from('dsrs')
            .select('*', { count: 'exact', head: true })
            .eq('team_id', team.id);
          return { ...team, dsrCount: count || 0 };
        })
      );

      return teamsWithCounts;
    },
    enabled: !!user,
  });

  // Create team mutation
  const createTeamMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const { data: tlData } = await supabase
        .from('team_leaders')
        .select('id, region_id')
        .eq('user_id', user.id)
        .single();

      if (!tlData) throw new Error('TL record not found');

      const { error } = await supabase
        .from('teams')
        .insert({
          name: teamName,
          captain_name: captainName || null,
          tl_id: tlData.id,
          region_id: tlData.region_id,
          is_approved: false,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tl-teams'] });
      toast.success('Team created! Awaiting admin approval.');
      setIsOpen(false);
      setTeamName('');
      setCaptainName('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create team');
    },
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Team Management</h1>
          <p className="text-muted-foreground">Create and manage your sales teams</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Team
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Team</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Team Name *</Label>
                <Input
                  placeholder="Enter team name"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Captain Name</Label>
                <Input
                  placeholder="Enter team captain name (optional)"
                  value={captainName}
                  onChange={(e) => setCaptainName(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                New teams require admin approval before they become active.
              </p>
              <Button 
                className="w-full" 
                onClick={() => createTeamMutation.mutate()}
                disabled={createTeamMutation.isPending || !teamName}
              >
                {createTeamMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Create Team
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            My Teams ({teams.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {teams.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium text-foreground">No Teams Yet</p>
              <p className="text-muted-foreground mb-4">Create your first team to start managing DSRs</p>
              <Button onClick={() => setIsOpen(true)}>Create First Team</Button>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Team Name</TableHead>
                    <TableHead>Captain</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>DSRs</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teams.map((team: any) => (
                    <TableRow key={team.id}>
                      <TableCell className="font-medium">{team.name}</TableCell>
                      <TableCell>{team.captain_name || '-'}</TableCell>
                      <TableCell>{team.regions?.name || '-'}</TableCell>
                      <TableCell>{team.dsrCount}</TableCell>
                      <TableCell>
                        <Badge className={team.is_approved ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}>
                          {team.is_approved ? 'Active' : 'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(team.created_at).toLocaleDateString()}</TableCell>
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
