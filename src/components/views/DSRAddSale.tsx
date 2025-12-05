import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowLeft, ShoppingCart, Package, Zap } from 'lucide-react';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

interface DSRAddSaleProps {
  onNavigate: (tab: string) => void;
}

interface StockOption {
  id: string;
  stock_id: string;
  smartcard_number: string | null;
  serial_number: string | null;
  type: string;
}

const STOCK_PRICES: Record<string, number> = {
  'FS': 65000,
  'DO': 25000,
  'DVS': 27500,
  'Full Set (FS)': 65000,
  'Decoder Only (DO)': 25000,
};

const DSTV_PACKAGES = [
  'Premium',
  'Compact Plus',
  'Compact',
  'Family',
  'Access',
  'Lite',
];

export function DSRAddSale({ onNavigate }: DSRAddSaleProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dsrId, setDsrId] = useState<string | null>(null);
  const [tlId, setTlId] = useState<string | null>(null);
  const [regionId, setRegionId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [availableStock, setAvailableStock] = useState<StockOption[]>([]);
  
  // Form state
  const [saleSource, setSaleSource] = useState<'physical' | 'virtual'>('physical');
  const [selectedStockId, setSelectedStockId] = useState('');
  const [smartCardNumber, setSmartCardNumber] = useState('');
  const [snNumber, setSnNumber] = useState('');
  const [saleType, setSaleType] = useState<'FS' | 'DO' | 'DVS'>('FS');
  const [packageOption, setPackageOption] = useState<'package' | 'no-package'>('no-package');
  const [dstvPackage, setDstvPackage] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid'>('paid');

  useEffect(() => {
    if (user) {
      fetchDSRData();
    }
  }, [user]);

  async function fetchDSRData() {
    if (!user) return;

    try {
      // Get DSR record
      const { data: dsrData } = await supabase
        .from('dsrs')
        .select('id, tl_id, region_id, team_id')
        .eq('user_id', user.id)
        .single();

      if (!dsrData) {
        setLoading(false);
        return;
      }

      setDsrId(dsrData.id);
      setTlId(dsrData.tl_id);
      setRegionId(dsrData.region_id);
      setTeamId(dsrData.team_id);

      // Fetch available stock
      const { data: stockData } = await supabase
        .from('stock')
        .select('id, stock_id, smartcard_number, serial_number, type')
        .eq('assigned_to_dsr', dsrData.id)
        .eq('status', 'assigned-dsr');

      setAvailableStock(stockData || []);
    } catch (error) {
      console.error('Error fetching DSR data:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleStockSelect = (stockId: string) => {
    setSelectedStockId(stockId);
    const selected = availableStock.find(s => s.id === stockId);
    if (selected) {
      setSmartCardNumber(selected.smartcard_number || '');
      setSnNumber(selected.serial_number || '');
      // Set sale type based on stock type
      if (selected.type.includes('Full Set') || selected.type === 'FS') {
        setSaleType('FS');
      } else if (selected.type.includes('Decoder') || selected.type === 'DO') {
        setSaleType('DO');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!dsrId) {
      toast.error('DSR record not found');
      return;
    }

    if (!smartCardNumber || !snNumber) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (saleSource === 'physical' && !selectedStockId) {
      toast.error('Please select a stock item');
      return;
    }

    setSubmitting(true);

    try {
      const finalSaleType = saleSource === 'virtual' ? 'DVS' : saleType;
      const salePrice = STOCK_PRICES[finalSaleType] || 0;

      // Create sale record
      const { error: saleError } = await supabase
        .from('sales')
        .insert({
          stock_id: saleSource === 'physical' ? selectedStockId : null,
          dsr_id: dsrId,
          team_id: teamId,
          tl_id: tlId,
          region_id: regionId,
          smart_card_number: smartCardNumber,
          sn_number: snNumber,
          sale_type: finalSaleType as any,
          is_virtual: saleSource === 'virtual',
          package_option: packageOption,
          dstv_package: packageOption === 'package' ? dstvPackage : null,
          payment_status: paymentStatus as any,
          sale_price: salePrice,
        } as any);

      if (saleError) throw saleError;

      // Update stock status if physical sale
      if (saleSource === 'physical' && selectedStockId) {
        const newStatus = paymentStatus === 'paid' ? 'sold-paid' : 'sold-unpaid';
        await supabase
          .from('stock')
          .update({ status: newStatus })
          .eq('id', selectedStockId);
      }

      toast.success('Sale recorded successfully!');
      onNavigate('my-sales');
    } catch (error: any) {
      console.error('Error creating sale:', error);
      toast.error(error.message || 'Failed to record sale');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => onNavigate('dashboard')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Add New Sale</h1>
          <p className="text-muted-foreground">Record a new sale transaction</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Sale Source Selection */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-lg">Select Sale Type</CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={saleSource}
              onValueChange={(v) => setSaleSource(v as 'physical' | 'virtual')}
              className="grid grid-cols-2 gap-4"
            >
              <Label
                htmlFor="physical"
                className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all ${
                  saleSource === 'physical' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                }`}
              >
                <RadioGroupItem value="physical" id="physical" />
                <Package className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Physical Stock</p>
                  <p className="text-xs text-muted-foreground">Full Set or Decoder Only</p>
                </div>
              </Label>
              <Label
                htmlFor="virtual"
                className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all ${
                  saleSource === 'virtual' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                }`}
              >
                <RadioGroupItem value="virtual" id="virtual" />
                <Zap className="h-5 w-5 text-warning" />
                <div>
                  <p className="font-medium">Virtual Sale (DVS)</p>
                  <p className="text-xs text-muted-foreground">Digital Virtual Stock</p>
                </div>
              </Label>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Stock Selection (for physical) */}
        {saleSource === 'physical' && (
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg">Select Stock Item</CardTitle>
            </CardHeader>
            <CardContent>
              {availableStock.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground">
                  No stock available. Contact your TL for stock assignment.
                </p>
              ) : (
                <Select value={selectedStockId} onValueChange={handleStockSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select stock item" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableStock.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.stock_id} - {item.type} {item.smartcard_number ? `(SC: ${item.smartcard_number})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>
        )}

        {/* Sale Details */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-lg">Sale Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="smartcard">Smartcard Number *</Label>
                <Input
                  id="smartcard"
                  placeholder="Enter smartcard number"
                  value={smartCardNumber}
                  onChange={(e) => setSmartCardNumber(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sn">Serial Number *</Label>
                <Input
                  id="sn"
                  placeholder="Enter serial number"
                  value={snNumber}
                  onChange={(e) => setSnNumber(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Package Option</Label>
              <RadioGroup
                value={packageOption}
                onValueChange={(v) => setPackageOption(v as 'package' | 'no-package')}
                className="flex gap-4"
              >
                <Label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="package" />
                  <span>With Package</span>
                </Label>
                <Label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="no-package" />
                  <span>No Package</span>
                </Label>
              </RadioGroup>
            </div>

            {packageOption === 'package' && (
              <div className="space-y-2">
                <Label htmlFor="dstv-package">DSTV Package</Label>
                <Select value={dstvPackage} onValueChange={setDstvPackage}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select package" />
                  </SelectTrigger>
                  <SelectContent>
                    {DSTV_PACKAGES.map((pkg) => (
                      <SelectItem key={pkg} value={pkg}>{pkg}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Payment Status</Label>
              <RadioGroup
                value={paymentStatus}
                onValueChange={(v) => setPaymentStatus(v as 'paid' | 'unpaid')}
                className="flex gap-4"
              >
                <Label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="paid" />
                  <span className="text-success">Paid</span>
                </Label>
                <Label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="unpaid" />
                  <span className="text-warning">Unpaid</span>
                </Label>
              </RadioGroup>
            </div>
          </CardContent>
        </Card>

        {/* Price Summary */}
        <Card className="glass">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Sale Price:</span>
              <span className="text-2xl font-bold text-primary">
                TZS {(STOCK_PRICES[saleSource === 'virtual' ? 'DVS' : saleType] || 0).toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>

        <Button 
          type="submit" 
          className="w-full gap-2" 
          size="lg"
          disabled={submitting || (saleSource === 'physical' && !selectedStockId)}
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Recording Sale...
            </>
          ) : (
            <>
              <ShoppingCart className="h-4 w-4" />
              Record Sale
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
