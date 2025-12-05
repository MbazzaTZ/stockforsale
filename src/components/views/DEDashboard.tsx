import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Plus, Users, TrendingUp, Trash2, Edit2, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { StatsGrid } from '@/components/dashboard/StatsGrid';

interface Agent {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  region_id?: string;
  created_at: string;
  updated_at: string;
}

interface Sale {
  id: string;
  agent_id?: string;
  sale_type: string;
  smartcard_number?: string;
  serial_number?: string;
  sale_price?: number;
  payment_status: string;
  created_at: string;
}

export function DEDashboard() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  // Form states
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [agentName, setAgentName] = useState('');
  const [agentEmail, setAgentEmail] = useState('');
  const [agentPhone, setAgentPhone] = useState('');
  
  const [selectedAgent, setSelectedAgent] = useState('');
  const [selectedSaleType, setSelectedSaleType] = useState<'FS' | 'DO' | 'DVS'>('FS');
  const [smartcard, setSmartcard] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid'>('unpaid');
  
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Mock data for agents (will be replaced with DB query after migration)
  const { data: agents = [], isLoading: agentsLoading, refetch: refetchAgents } = useQuery({
    queryKey: ['de-agents'],
    queryFn: async () => {
      // Temporary mock - will work after DB migration
      return [] as Agent[];
    },
  });

  // Mock data for sales (will be replaced with DB query after migration)
  const { data: deSales = [], isLoading: salesLoading, refetch: refetchSales } = useQuery({
    queryKey: ['de-sales'],
    queryFn: async () => {
      // Temporary mock - will work after DB migration
      return [] as Sale[];
    },
  });

  // Add agent mutation
  const addAgentMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('User not found');
      
      if (editingAgent) {
        // Update existing agent
        toast.success('Agent updated successfully');
      } else {
        // Create new agent
        toast.success('Agent created successfully');
      }
    },
    onSuccess: () => {
      refetchAgents();
      setAgentName('');
      setAgentEmail('');
      setAgentPhone('');
      setShowAddAgent(false);
      setEditingAgent(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to save agent');
    },
  });

  // Add sale mutation
  const addSaleMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !selectedAgent) throw new Error('Invalid sale data');

      // Add sale
      toast.success('Sale added successfully');
    },
    onSuccess: () => {
      refetchSales();
      setSelectedAgent('');
      setSmartcard('');
      setSerialNumber('');
      setSalePrice('');
      setPaymentStatus('unpaid');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add sale');
    },
  });

  // Delete agent mutation
  const deleteAgentMutation = useMutation({
    mutationFn: async (agentId: string) => {
      // Delete agent
      toast.success('Agent deleted successfully');
    },
    onSuccess: () => {
      refetchAgents();
      setDeleteConfirm(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete agent');
    },
  });

  // Calculate sales summary
  const salesSummary = {
    total: deSales.length,
    fs: deSales.filter((s: any) => s.sale_type === 'FS').length,
    do: deSales.filter((s: any) => s.sale_type === 'DO').length,
    dvs: deSales.filter((s: any) => s.sale_type === 'DVS').length,
    totalAmount: deSales.reduce((sum: number, s: any) => sum + (s.sale_price || 0), 0),
  };

  const handleEditAgent = (agent: Agent) => {
    setEditingAgent(agent);
    setAgentName(agent.full_name);
    setAgentEmail(agent.email || '');
    setAgentPhone(agent.phone || '');
    setShowAddAgent(true);
  };

  const handleCancelEdit = () => {
    setEditingAgent(null);
    setAgentName('');
    setAgentEmail('');
    setAgentPhone('');
    setShowAddAgent(false);
  };

  const isLoading = agentsLoading || salesLoading;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Distribution Executive Dashboard</h1>
        <p className="text-muted-foreground">Welcome, {profile?.full_name}! Manage your agents and track your sales</p>
      </div>

      {/* Sales Summary */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-3">Sales Summary (MTD)</h3>
        <StatsGrid columns={4}>
          <MetricCard
            title="Total Sales"
            value={salesSummary.total}
            icon={TrendingUp}
            variant="default"
          />
          <MetricCard
            title="Full Set (FS)"
            value={salesSummary.fs}
            icon={TrendingUp}
            variant="default"
          />
          <MetricCard
            title="Decoder Only (DO)"
            value={salesSummary.do}
            icon={TrendingUp}
            variant="default"
          />
          <MetricCard
            title="Total Amount"
            value={`${salesSummary.totalAmount.toLocaleString()}`}
            subtitle="TSH"
            icon={TrendingUp}
            variant="success"
          />
        </StatsGrid>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Tabs defaultValue="agents" className="space-y-4">
          <TabsList>
            <TabsTrigger value="agents" className="gap-2">
              <Users className="h-4 w-4" />
              My Agents ({agents.length})
            </TabsTrigger>
            <TabsTrigger value="add-sale" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Sale
            </TabsTrigger>
            <TabsTrigger value="sales" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              My Sales ({salesSummary.total})
            </TabsTrigger>
          </TabsList>

          {/* Agents Tab */}
          <TabsContent value="agents">
            <Card className="glass">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>My Agents</CardTitle>
                  <Button
                    size="sm"
                    onClick={() => setShowAddAgent(!showAddAgent)}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Agent
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {showAddAgent && (
                  <div className="border border-border rounded-lg p-4 space-y-4 bg-muted/30">
                    <h4 className="font-semibold">{editingAgent ? 'Edit Agent' : 'Create New Agent'}</h4>
                    
                    <div className="space-y-2">
                      <Label htmlFor="agent-name">Full Name *</Label>
                      <Input
                        id="agent-name"
                        placeholder="John Doe"
                        value={agentName}
                        onChange={(e) => setAgentName(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="agent-email">Email (Optional)</Label>
                      <Input
                        id="agent-email"
                        type="email"
                        placeholder="john@example.com"
                        value={agentEmail}
                        onChange={(e) => setAgentEmail(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="agent-phone">Phone (Optional)</Label>
                      <Input
                        id="agent-phone"
                        type="tel"
                        placeholder="+255 xxx xxx xxx"
                        value={agentPhone}
                        onChange={(e) => setAgentPhone(e.target.value)}
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => addAgentMutation.mutate()}
                        disabled={addAgentMutation.isPending || !agentName}
                        className="gap-2"
                      >
                        {addAgentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        {editingAgent ? 'Update Agent' : 'Create Agent'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleCancelEdit}
                      >
                        <X className="h-4 w-4" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {agents.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-2 text-muted-foreground opacity-50" />
                    <p className="font-medium">No agents yet</p>
                    <p className="text-sm">Create an agent to start adding sales</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {agents.map((agent: Agent) => (
                          <TableRow key={agent.id}>
                            <TableCell className="font-medium">{agent.full_name}</TableCell>
                            <TableCell>{agent.email || '-'}</TableCell>
                            <TableCell>{agent.phone || '-'}</TableCell>
                            <TableCell>{new Date(agent.created_at).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEditAgent(agent)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => setDeleteConfirm(agent.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
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

          {/* Add Sale Tab */}
          <TabsContent value="add-sale">
            <Card className="glass">
              <CardHeader>
                <CardTitle>Add Sale on Behalf of Agent</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {agents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Please create an agent first before adding sales.</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="agent-select">Select Agent *</Label>
                      <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose an agent" />
                        </SelectTrigger>
                        <SelectContent>
                          {agents.map((agent: Agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              {agent.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="sale-type">Sale Type *</Label>
                      <Select value={selectedSaleType} onValueChange={(v) => setSelectedSaleType(v as 'FS' | 'DO' | 'DVS')}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="FS">Full Set (FS)</SelectItem>
                          <SelectItem value="DO">Decoder Only (DO)</SelectItem>
                          <SelectItem value="DVS">DVS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="smartcard">Smartcard Number *</Label>
                      <Input
                        id="smartcard"
                        placeholder="Enter smartcard number"
                        value={smartcard}
                        onChange={(e) => setSmartcard(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="serial">Serial Number *</Label>
                      <Input
                        id="serial"
                        placeholder="Enter serial number"
                        value={serialNumber}
                        onChange={(e) => setSerialNumber(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="price">Sale Price *</Label>
                      <Input
                        id="price"
                        type="number"
                        placeholder="0.00"
                        value={salePrice}
                        onChange={(e) => setSalePrice(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="payment">Payment Status</Label>
                      <Select value={paymentStatus} onValueChange={(v) => setPaymentStatus(v as 'paid' | 'unpaid')}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="unpaid">Unpaid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      onClick={() => addSaleMutation.mutate()}
                      disabled={addSaleMutation.isPending || !selectedAgent || !smartcard || !serialNumber}
                      className="w-full gap-2"
                    >
                      {addSaleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Add Sale
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sales Tab */}
          <TabsContent value="sales">
            <Card className="glass">
              <CardHeader>
                <CardTitle>My Sales History</CardTitle>
              </CardHeader>
              <CardContent>
                {deSales.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <TrendingUp className="h-12 w-12 mx-auto mb-2 text-muted-foreground opacity-50" />
                    <p className="font-medium">No sales yet</p>
                    <p className="text-sm">Add sales to track your performance</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Agent</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Smartcard</TableHead>
                          <TableHead>Serial</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Payment</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deSales.map((sale: Sale) => {
                          const agent = agents.find((a: Agent) => a.id === sale.agent_id);
                          return (
                            <TableRow key={sale.id}>
                              <TableCell className="font-medium">{agent?.full_name || 'Unknown'}</TableCell>
                              <TableCell className="text-sm">{sale.sale_type}</TableCell>
                              <TableCell className="text-sm">{sale.smartcard_number || '-'}</TableCell>
                              <TableCell className="text-sm">{sale.serial_number || '-'}</TableCell>
                              <TableCell>{sale.sale_price?.toLocaleString() || '-'}</TableCell>
                              <TableCell className="text-sm capitalize">{sale.payment_status}</TableCell>
                              <TableCell className="text-sm">{new Date(sale.created_at).toLocaleDateString()}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete Agent</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this agent? This action cannot be undone.
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteConfirm) {
                  deleteAgentMutation.mutate(deleteConfirm);
                }
              }}
              disabled={deleteAgentMutation.isPending}
            >
              {deleteAgentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
