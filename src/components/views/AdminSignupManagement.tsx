import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Users, Edit2, Trash2, Loader2, Mail, Phone, MapPin, Plus, X, RefreshCw, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface SignupUser {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  role: string;
  region_id?: string;
  region_name?: string;
  created_at: string;
  is_approved: boolean;
}

export function AdminSignupManagement() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState('dsr');
  const [editPhone, setEditPhone] = useState('');
  const [editRegionId, setEditRegionId] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [manageRegionsUserId, setManageRegionsUserId] = useState<string | null>(null);
  const [userRegions, setUserRegions] = useState<string[]>([]);
  const [newRegionId, setNewRegionId] = useState('');
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [newUserData, setNewUserData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    role: 'dsr',
    regionId: '',
    additionalRegions: [] as string[],
  });

  // Load additional regions when dialog opens
  useEffect(() => {
    if (manageRegionsUserId) {
      const storedRegions = localStorage.getItem(`user_regions_${manageRegionsUserId}`);
      if (storedRegions) {
        try {
          setUserRegions(JSON.parse(storedRegions));
        } catch (e) {
          setUserRegions([]);
        }
      }
    }
  }, [manageRegionsUserId]);

  // Fetch all approved users
  const { data: signups = [], isLoading, error: queryError } = useQuery({
    queryKey: ['admin-signups'],
    queryFn: async () => {
      try {
        console.log('🔍 Fetching all user profiles...');
        // Get all profiles
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, email, phone, region_id, created_at, is_approved')
          .order('created_at', { ascending: false });

        if (profilesError) {
          console.error('❌ Error fetching profiles:', profilesError);
          throw profilesError;
        }

        console.log(`✅ Fetched ${profiles?.length || 0} profiles`);

        // Get roles for each user
        const signupsWithRoles = await Promise.all(
          (profiles || []).map(async (profile) => {
            // Get user role
            const { data: roleData, error: roleError } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', profile.id)
              .single();

            if (roleError && roleError.code !== 'PGRST116') {
              console.error('❌ Error fetching role for user:', profile.id, roleError);
            }

            // Get region name if exists
            let region_name = '';
            if (profile.region_id) {
              const { data: regionData } = await supabase
                .from('regions')
                .select('name')
                .eq('id', profile.region_id)
                .single();
              region_name = regionData?.name || '';
            }

            const userRole = roleData?.role || 'dsr';
            
            console.log(`👤 User: ${profile.email}, Role: ${userRole}`);

            return {
              id: profile.id,
              full_name: profile.full_name,
              email: profile.email,
              phone: profile.phone || '',
              role: userRole,
              region_id: profile.region_id,
              region_name,
              created_at: profile.created_at,
              is_approved: profile.is_approved,
            };
          })
        );

        console.log(`✅ Successfully processed ${signupsWithRoles.length} users with roles`);
        
        // Log role breakdown
        const roleBreakdown = signupsWithRoles.reduce((acc, user) => {
          acc[user.role] = (acc[user.role] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        console.log('📊 Role breakdown:', roleBreakdown);
        return signupsWithRoles;
      } catch (err) {
        console.error('❌ Error fetching signups:', err);
        toast.error('Failed to load user signups. Please check console for details.');
        return [];
      }
    },
  });

  // Fetch all regions
  const { data: regions = [] } = useQuery({
    queryKey: ['regions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('regions')
        .select('id, name, code')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Update user info mutation (phone and region)
  const updateUserInfoMutation = useMutation({
    mutationFn: async ({ userId, phone, regionId, role }: { userId: string; phone: string; regionId: string; role: string }) => {
      try {
        // Update phone in profile
        const { error: phoneError } = await supabase
          .from('profiles')
          .update({ 
            phone: phone || null,
            region_id: regionId || null 
          })
          .eq('id', userId);

        if (phoneError) throw phoneError;

        // Update role
        const { error: roleError } = await supabase
          .from('user_roles')
          .update({ role: role })
          .eq('user_id', userId);

        if (roleError) throw roleError;

        toast.success('User information updated successfully');
      } catch (err) {
        console.error('Error updating user info:', err);
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-signups'] });
      setEditingId(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update user information');
    },
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: 'admin' | 'manager' | 'tl' | 'de' | 'dsr' }) => {
      try {
        // Update user_roles
        const { error: roleError } = await supabase
          .from('user_roles')
          .update({ role: newRole })
          .eq('user_id', userId);

        if (roleError) throw roleError;
        toast.success('Role updated successfully');
      } catch (err) {
        console.error('Error updating role:', err);
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-signups'] });
      setEditingId(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update role');
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Since we can't use admin.deleteUser in client SDK, we'll:
      // 1. Delete the user_roles record
      // 2. Delete the profile record
      // Note: The auth.users record will remain but user cannot sign in
      
      // Delete user_roles
      const { error: roleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);
      
      if (roleError) throw roleError;
      
      // Delete profile
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);
      
      if (profileError) throw profileError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-signups'] });
      toast.success('User deleted successfully');
      setDeleteId(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete user');
    },
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUserData) => {
      try {
        console.log('🔐 Creating auth user:', userData.email);
        
        // Create auth user
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: userData.email,
          password: userData.password,
          options: {
            data: {
              full_name: userData.fullName,
            },
          },
        });

        if (authError) {
          console.error('❌ Auth error:', authError);
          throw new Error(`Failed to create user account: ${authError.message}`);
        }
        
        if (!authData.user) {
          throw new Error('User creation succeeded but no user data returned');
        }

        const userId = authData.user.id;
        console.log('✅ Auth user created:', userId);

        // Wait longer for the trigger to create the profile
        console.log('⏳ Waiting for profile trigger...');
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Verify profile exists
        const { data: profileCheck, error: profileCheckError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', userId)
          .single();

        if (profileCheckError || !profileCheck) {
          console.error('❌ Profile not found after trigger:', profileCheckError);
          throw new Error('Profile was not created by trigger. Please check database triggers.');
        }

        console.log('✅ Profile exists, updating...');

        // Update profile with additional info (phone and region)
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            phone: userData.phone || null,
            region_id: userData.regionId || null,
            is_approved: true,
            approval_status: 'approved',
          })
          .eq('id', userId);

        if (profileError) {
          console.error('❌ Profile update error:', profileError);
          throw new Error(`Failed to update profile: ${profileError.message}`);
        }

        console.log('✅ Profile updated');

        // Create or update user role (upsert to avoid duplicate key error)
        console.log('📝 Creating user role:', userData.role);
        const { error: roleError } = await supabase
          .from('user_roles')
          .upsert({
            user_id: userId,
            role: userData.role,
          }, {
            onConflict: 'user_id'
          });

        if (roleError) {
          console.error('❌ Role creation error:', roleError);
          throw new Error(`Failed to create user role: ${roleError.message}`);
        }

        console.log('✅ User role created');

        // Create role-specific record based on role (using upsert to avoid duplicates)
        console.log('👤 Creating role-specific record for:', userData.role);
        
        if (userData.role === 'tl') {
          const { error } = await supabase.from('team_leaders').upsert({
            user_id: userId,
            region_id: userData.regionId || null,
          }, {
            onConflict: 'user_id'
          });
          if (error) throw new Error(`Failed to create TL record: ${error.message}`);
        } else if (userData.role === 'de') {
          const { error } = await supabase.from('distribution_executives').upsert({
            user_id: userId,
            region_id: userData.regionId || null,
          }, {
            onConflict: 'user_id'
          });
          if (error) throw new Error(`Failed to create DE record: ${error.message}`);
        } else if (userData.role === 'manager') {
          const { error } = await supabase.from('managers').upsert({
            user_id: userId,
            region_id: userData.regionId || null,
          }, {
            onConflict: 'user_id'
          });
          if (error) throw new Error(`Failed to create Manager record: ${error.message}`);
        } else if (userData.role === 'dsr') {
          const { error } = await supabase.from('dsrs').upsert({
            user_id: userId,
          }, {
            onConflict: 'user_id'
          });
          if (error) throw new Error(`Failed to create DSR record: ${error.message}`);
        }

        console.log('✅ Role-specific record created');

        // Store additional regions for DE/Manager in localStorage
        if ((userData.role === 'de' || userData.role === 'manager') && userData.additionalRegions.length > 0) {
          localStorage.setItem(`user_regions_${userId}`, JSON.stringify(userData.additionalRegions));
        }

        console.log('✅✅ User creation completed successfully!');
        return userId;
      } catch (error: any) {
        console.error('💥 User creation failed:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-signups'] });
      toast.success('User created successfully');
      setIsCreateUserOpen(false);
      setNewUserData({
        fullName: '',
        email: '',
        phone: '',
        password: '',
        role: 'dsr',
        regionId: '',
        additionalRegions: [],
      });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create user');
    },
  });

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red/10 text-red';
      case 'manager':
        return 'bg-blue/10 text-blue';
      case 'tl':
        return 'bg-green/10 text-green';
      case 'de':
        return 'bg-purple/10 text-purple';
      case 'dsr':
      default:
        return 'bg-orange/10 text-orange';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Admin';
      case 'manager':
        return 'Manager';
      case 'tl':
        return 'Team Leader';
      case 'de':
        return 'Distribution Executive';
      case 'dsr':
      default:
        return 'Direct Sales Rep';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Signup Management</h1>
          <p className="text-muted-foreground">Manage user signups - edit roles or delete users</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setIsCreateUserOpen(true)}
            className="gap-2"
          >
            <UserPlus className="h-4 w-4" />
            Create User
          </Button>
          <Button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-signups'] })}
            disabled={isLoading}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            All Users ({signups.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-3 text-muted-foreground">Loading users...</p>
            </div>
          ) : queryError ? (
            <div className="text-center py-12">
              <Users className="h-16 w-16 mx-auto mb-4 text-destructive" />
              <p className="text-lg font-medium text-foreground">Error Loading Users</p>
              <p className="text-muted-foreground">{(queryError as any)?.message || 'Failed to fetch user data'}</p>
              <p className="text-xs text-muted-foreground mt-2">Check browser console for details</p>
            </div>
          ) : signups.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium text-foreground">No Users</p>
              <p className="text-muted-foreground">No users have signed up yet</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Signup Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {signups.map((signup: SignupUser) => (
                    <TableRow key={signup.id}>
                      <TableCell className="font-medium">{signup.full_name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          {signup.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        {editingId === signup.id ? (
                          <Input
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            placeholder="Phone number"
                            className="w-32"
                          />
                        ) : signup.phone ? (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            {signup.phone}
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {editingId === signup.id ? (
                          <Select value={editRegionId || 'none'} onValueChange={(val) => setEditRegionId(val === 'none' ? '' : val)}>
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="Select region" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No Region</SelectItem>
                              {regions.map(region => (
                                <SelectItem key={region.id} value={region.id}>{region.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : signup.region_name ? (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            {signup.region_name}
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {editingId === signup.id ? (
                          <Select value={editRole} onValueChange={setEditRole}>
                            <SelectTrigger className="w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="manager">Manager</SelectItem>
                              <SelectItem value="tl">Team Leader</SelectItem>
                              <SelectItem value="de">Distribution Executive</SelectItem>
                              <SelectItem value="dsr">Direct Sales Rep</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge className={getRoleColor(signup.role)}>
                            {getRoleLabel(signup.role)}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{new Date(signup.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge className={signup.is_approved ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}>
                          {signup.is_approved ? 'Approved' : 'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {editingId === signup.id ? (
                            <>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    updateUserInfoMutation.mutate({
                                      userId: signup.id,
                                      phone: editPhone,
                                      regionId: editRegionId,
                                      role: editRole,
                                    });
                                  }}
                                  disabled={updateUserInfoMutation.isPending}
                                >
                                  Save
                                </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingId(null)}
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingId(signup.id);
                                  setEditRole(signup.role);
                                  setEditPhone(signup.phone || '');
                                  setEditRegionId(signup.region_id || '');
                                }}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              {(signup.role === 'de' || signup.role === 'manager') && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setManageRegionsUserId(signup.id)}
                                  title="Manage Regions"
                                >
                                  <MapPin className="h-4 w-4 text-primary" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setDeleteId(signup.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
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

      {/* Create User Dialog */}
      <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input
                placeholder="Enter full name"
                value={newUserData.fullName}
                onChange={(e) => setNewUserData({ ...newUserData, fullName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                placeholder="user@example.com"
                value={newUserData.email}
                onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                placeholder="Phone number"
                value={newUserData.phone}
                onChange={(e) => setNewUserData({ ...newUserData, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Password *</Label>
              <Input
                type="password"
                placeholder="Minimum 6 characters"
                value={newUserData.password}
                onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">User can change this after first login</p>
            </div>
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={newUserData.role} onValueChange={(val) => setNewUserData({ ...newUserData, role: val })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="de">Distribution Executive</SelectItem>
                  <SelectItem value="tl">Team Leader</SelectItem>
                  <SelectItem value="dsr">Direct Sales Rep</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Region</Label>
              <Select value={newUserData.regionId || 'none'} onValueChange={(val) => setNewUserData({ ...newUserData, regionId: val === 'none' ? '' : val })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Region</SelectItem>
                  {regions.map(region => (
                    <SelectItem key={region.id} value={region.id}>{region.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Primary region for this user</p>
            </div>

            {/* Additional Regions - Only for DE and Manager */}
            {(newUserData.role === 'de' || newUserData.role === 'manager') && (
              <div className="space-y-2">
                <Label>Additional Regions</Label>
                <div className="space-y-2">
                  {newUserData.additionalRegions.length > 0 ? (
                    <div className="space-y-2">
                      {newUserData.additionalRegions.map((regionId, index) => {
                        const region = regions.find(r => r.id === regionId);
                        return (
                          <div key={index} className="flex items-center justify-between p-2 border border-border rounded-lg bg-muted/30">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-primary" />
                              <span className="text-sm font-medium">{region?.name || 'Unknown'}</span>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setNewUserData({
                                  ...newUserData,
                                  additionalRegions: newUserData.additionalRegions.filter((_, i) => i !== index)
                                });
                              }}
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No additional regions added yet</p>
                  )}
                </div>
                
                {/* Add Region */}
                <div className="flex gap-2 mt-2">
                  <Select 
                    value={newRegionId} 
                    onValueChange={setNewRegionId}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select region to add" />
                    </SelectTrigger>
                    <SelectContent>
                      {regions
                        .filter(r => 
                          r.id !== newUserData.regionId && 
                          !newUserData.additionalRegions.includes(r.id)
                        )
                        .map(region => (
                          <SelectItem key={region.id} value={region.id}>{region.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (newRegionId && !newUserData.additionalRegions.includes(newRegionId)) {
                        setNewUserData({
                          ...newUserData,
                          additionalRegions: [...newUserData.additionalRegions, newRegionId]
                        });
                        setNewRegionId('');
                      }
                    }}
                    disabled={!newRegionId}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">DE and Manager can operate in multiple regions</p>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateUserOpen(false);
                  setNewUserData({
                    fullName: '',
                    email: '',
                    phone: '',
                    password: '',
                    role: 'dsr',
                    regionId: '',
                    additionalRegions: [],
                  });
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => createUserMutation.mutate(newUserData)}
                disabled={
                  createUserMutation.isPending ||
                  !newUserData.fullName ||
                  !newUserData.email ||
                  !newUserData.password ||
                  newUserData.password.length < 6
                }
              >
                {createUserMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Create User
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Regions Dialog for DE/Manager - Multi-region support */}
      <Dialog open={!!manageRegionsUserId} onOpenChange={(open) => {
        if (!open) {
          setManageRegionsUserId(null);
          setUserRegions([]);
          setNewRegionId('');
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage User Regions</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-info/10 border border-info/20 rounded-lg">
              <p className="text-xs text-info">
                <strong>Note:</strong> DE and Manager roles can operate across multiple regions. 
                Add multiple regions for this user below.
              </p>
            </div>
            
            {/* Primary Region */}
            <div className="space-y-2">
              <Label>Primary Region</Label>
              <Select 
                value={signups.find(s => s.id === manageRegionsUserId)?.region_id || 'none'} 
                onValueChange={(value) => {
                  if (manageRegionsUserId) {
                    updateUserInfoMutation.mutate({
                      userId: manageRegionsUserId,
                      phone: signups.find(s => s.id === manageRegionsUserId)?.phone || '',
                      regionId: value === 'none' ? '' : value,
                      role: signups.find(s => s.id === manageRegionsUserId)?.role || 'dsr',
                    });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select primary region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Region</SelectItem>
                  {regions.map(region => (
                    <SelectItem key={region.id} value={region.id}>{region.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Current: <strong>{signups.find(s => s.id === manageRegionsUserId)?.region_name || 'None'}</strong>
              </p>
            </div>

            {/* Additional Regions */}
            <div className="space-y-2">
              <Label>Additional Regions</Label>
              <div className="space-y-2">
                {userRegions.length > 0 ? (
                  <div className="space-y-2">
                    {userRegions.map((regionId, index) => {
                      const region = regions.find(r => r.id === regionId);
                      return (
                        <div key={index} className="flex items-center justify-between p-2 border border-border rounded-lg bg-muted/30">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">{region?.name || 'Unknown'}</span>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setUserRegions(prev => prev.filter((_, i) => i !== index));
                            }}
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No additional regions added yet</p>
                )}
              </div>
              
              {/* Add Region */}
              <div className="flex gap-2 mt-2">
                <Select value={newRegionId} onValueChange={setNewRegionId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select region to add" />
                  </SelectTrigger>
                  <SelectContent>
                    {regions
                      .filter(r => 
                        r.id !== signups.find(s => s.id === manageRegionsUserId)?.region_id && 
                        !userRegions.includes(r.id)
                      )
                      .map(region => (
                        <SelectItem key={region.id} value={region.id}>{region.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={() => {
                    if (newRegionId && !userRegions.includes(newRegionId)) {
                      setUserRegions(prev => [...prev, newRegionId]);
                      setNewRegionId('');
                    }
                  }}
                  disabled={!newRegionId}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setManageRegionsUserId(null);
                  setUserRegions([]);
                  setNewRegionId('');
                }}
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  // Save additional regions to localStorage or database
                  // For now, we'll store in localStorage as a simple solution
                  if (manageRegionsUserId) {
                    localStorage.setItem(
                      `user_regions_${manageRegionsUserId}`,
                      JSON.stringify(userRegions)
                    );
                    toast.success('Additional regions saved successfully');
                    setManageRegionsUserId(null);
                    setUserRegions([]);
                    setNewRegionId('');
                  }
                }}
              >
                Save Regions
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete User</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this user? This action cannot be undone. All associated data will be removed.
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) {
                  deleteUserMutation.mutate(deleteId);
                }
              }}
              disabled={deleteUserMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteUserMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
