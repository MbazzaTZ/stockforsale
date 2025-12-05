import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { GeneralDashboard } from '@/components/views/GeneralDashboard';
import { AdminDashboard } from '@/components/views/AdminDashboard';
import { AdminStockManagement } from '@/components/views/AdminStockManagement';
import { AdminAssignStock } from '@/components/views/AdminAssignStock';
import { AdminApprovals } from '@/components/views/AdminApprovals';
import { AdminRegionManagement } from '@/components/views/AdminRegionManagement';
import { AdminDEAndTLManagement } from '@/components/views/AdminDEAndTLManagement';
import { AdminSignupManagement } from '@/components/views/AdminSignupManagement';
import { TLDashboard } from '@/components/views/TLDashboard';
import { TLTeamManagement } from '@/components/views/TLTeamManagement';
import { TLDSRManagement } from '@/components/views/TLDSRManagement';
import { TLStockAssignment } from '@/components/views/TLStockAssignment';
import { TLSalesVerification } from '@/components/views/TLSalesVerification';
import { DSRDashboard } from '@/components/views/DSRDashboard';
import { DSRStock } from '@/components/views/DSRStock';
import { DSRAddSale } from '@/components/views/DSRAddSale';
import { DSRMySales } from '@/components/views/DSRMySales';
import { DSRCommission } from '@/components/views/DSRCommission';
import { DEDashboard } from '@/components/views/DEDashboard';
import ManagerDashboard from '@/components/views/ManagerDashboard';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { user, userRole, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (userRole === 'admin' || userRole === 'tl') {
      setActiveTab('general');
    } else {
      setActiveTab('dashboard');
    }
  }, [userRole]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !userRole) return null;

  const renderContent = () => {
    if (userRole === 'admin') {
      switch (activeTab) {
        case 'general': return <GeneralDashboard />;
        case 'dashboard': return <AdminDashboard />;
        case 'regions': return <AdminRegionManagement />;
        case 'stock': return <AdminStockManagement />;
        case 'assign': return <AdminAssignStock />;
        case 'de-tl-management': return <AdminDEAndTLManagement />;
        case 'signups': return <AdminSignupManagement />;
        case 'approvals': return <AdminApprovals />;
        default: return <GeneralDashboard />;
      }
    }

    if (userRole === 'manager') {
      return <ManagerDashboard />;
    }

    if (userRole === 'tl') {
      switch (activeTab) {
        case 'general': return <GeneralDashboard />;
        case 'dashboard': return <TLDashboard onNavigate={setActiveTab} />;
        case 'teams': return <TLTeamManagement />;
        case 'dsrs': return <TLDSRManagement />;
        case 'stock': return <TLStockAssignment />;
        case 'assign-stock': return <TLStockAssignment />;
        case 'verification': return <TLSalesVerification />;
        default: return <TLDashboard onNavigate={setActiveTab} />;
      }
    }

    if (userRole === 'dsr') {
      switch (activeTab) {
        case 'dashboard': return <DSRDashboard onNavigate={setActiveTab} />;
        case 'stock': return <DSRStock onNavigate={setActiveTab} />;
        case 'add-sale': return <DSRAddSale onNavigate={setActiveTab} />;
        case 'my-sales': return <DSRMySales onNavigate={setActiveTab} />;
        case 'commission': return <DSRCommission />;
        default: return <DSRDashboard onNavigate={setActiveTab} />;
      }
    }

    if (userRole === 'de') {
      switch (activeTab) {
        case 'dashboard': return <DEDashboard />;
        case 'agents': return <DEDashboard />;
        case 'add-sale': return <DEDashboard />;
        default: return <DEDashboard />;
      }
    }

    return <GeneralDashboard />;
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar role={userRole} activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header role={userRole} userName={profile?.full_name} />
        <main className="flex-1 overflow-y-auto">{renderContent()}</main>
      </div>
    </div>
  );
};

export default Index;
