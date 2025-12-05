import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Package, Upload, Plus, Loader2, Search, FileSpreadsheet, Edit, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { StatsGrid } from '@/components/dashboard/StatsGrid';

const STOCK_TYPES = ['Full Set (FS)', 'Decoder Only (DO)'];

const statusConfig: Record<string, { label: string; className: string }> = {
  'unassigned': { label: 'Unassigned', className: 'bg-muted text-muted-foreground' },
  'assigned-tl': { label: 'Assigned to TL', className: 'bg-info/10 text-info' },
  'assigned-team': { label: 'Assigned to Team', className: 'bg-warning/10 text-warning' },
  'assigned-dsr': { label: 'Assigned to DSR', className: 'bg-primary/10 text-primary' },
  'sold-paid': { label: 'Sold (Paid)', className: 'bg-success/10 text-success' },
  'sold-unpaid': { label: 'Sold (Unpaid)', className: 'bg-destructive/10 text-destructive' },
};

export function AdminStockManagement() {
  const { user } = useAuth();
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedForDeletion, setSelectedForDeletion] = useState<Set<string>>(new Set());
  
  // Manual add form
  const [stockId, setStockId] = useState('');
  const [smartcardNumber, setSmartcardNumber] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [stockType, setStockType] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  
  // CSV upload
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [isProcessingCsv, setIsProcessingCsv] = useState(false);

  // Validate CSV data (headers and row-level checks)
  const validateCsv = (data: any[]): string[] => {
    const errors: string[] = [];
    if (!data || data.length === 0) return errors;

    const headers = Object.keys(data[0] || {}).map(h => h.toString().toLowerCase());
    const requiredCols = ['stock_id', 'type'];
    const missingCols = requiredCols.filter(c => !headers.includes(c));
    if (missingCols.length > 0) {
      errors.push(`Missing required columns: ${missingCols.join(', ')}`);
    }

    data.forEach((row, idx) => {
      const rowNum = idx + 2;
      if (!row['stock_id'] || row['stock_id'].toString().trim() === '') {
        errors.push(`Row ${rowNum}: missing stock_id`);
      }
      if (!row['type'] || row['type'].toString().trim() === '') {
        errors.push(`Row ${rowNum}: missing type`);
      }
    });

    return errors;
  };

  // Update a single CSV cell (inline edit)
  const updateCsvCell = (rowIndex: number, key: string, value: string) => {
    setCsvData(prev => {
      const next = prev.map((r, i) => (i === rowIndex ? { ...r, [key]: value } : r));
      // Re-validate after edit
      const errors = validateCsv(next);
      setCsvErrors(errors);
      return next;
    });
  };
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const queryClient = useQueryClient();

  // Fetch stock
  const { data: stock = [], isLoading } = useQuery({
    queryKey: ['stock'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock')
        .select(`
          id,
          stock_id,
          smartcard_number,
          serial_number,
          type,
          status,
          batch_id,
          region_id,
          assigned_to_tl,
          assigned_to_team,
          assigned_to_dsr,
          assigned_by,
          date_assigned,
          created_at,
          batch:stock_batches(batch_number),
          region:regions(name)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch regions
  const { data: regions = [] } = useQuery({
    queryKey: ['regions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('regions')
        .select('id, name, code');
      if (error) throw error;
      return data;
    },
  });

  const [selectedRegion, setSelectedRegion] = useState('');

  // Add single stock mutation
  const addStockMutation = useMutation({
    mutationFn: async () => {
      // Create or get batch
      let batchId = null;
      if (batchNumber) {
        const { data: existingBatch } = await supabase
          .from('stock_batches')
          .select('id')
          .eq('batch_number', batchNumber)
          .single();

        if (existingBatch) {
          batchId = existingBatch.id;
        } else {
          const { data: newBatch, error: batchError } = await supabase
            .from('stock_batches')
            .insert({ batch_number: batchNumber, created_by: user?.id })
            .select()
            .single();
          if (batchError) throw batchError;
          batchId = newBatch.id;
        }
      }

      const { error } = await supabase
        .from('stock')
        .insert({
          stock_id: stockId,
          smartcard_number: smartcardNumber || null,
          serial_number: serialNumber || null,
          type: stockType,
          batch_id: batchId,
          region_id: selectedRegion || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      toast.success('Stock item added successfully');
      setIsManualOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add stock');
    },
  });

  // Bulk upload mutation
  const bulkUploadMutation = useMutation({
    mutationFn: async () => {
      // Check if batch already exists
      const { data: existingBatch, error: checkError } = await supabase
        .from('stock_batches')
        .select('id')
        .eq('batch_number', batchNumber)
        .single();

      let batchId: string;

      if (existingBatch) {
        // Batch exists, reuse it
        batchId = existingBatch.id;
      } else if (checkError?.code === 'PGRST116') {
        // No batch found (PGRST116 is "no rows returned"), create new one
        const { data: newBatch, error: batchError } = await supabase
          .from('stock_batches')
          .insert({ batch_number: batchNumber, created_by: user?.id })
          .select()
          .single();
        
        if (batchError) throw batchError;
        batchId = newBatch.id;
      } else if (checkError) {
        // Unexpected error
        throw checkError;
      } else {
        throw new Error('Failed to determine batch status');
      }

      // Insert all stock items - use EXACTLY the selected region from form
      if (!selectedRegion) {
        throw new Error('Please select a region before uploading');
      }

      const stockItems = csvData.map(item => ({
        stock_id: item.stock_id || null,
        smartcard_number: item.smartcard_number || item.smartcard || item.smartcard_no || null,
        serial_number: item.serial_number || item.serial_no || item.sn || item.serial || null,
        type: item.type,
        batch_id: batchId,
        region_id: selectedRegion,  // ALWAYS use selected region - never from CSV
      }));

      const { error } = await supabase.from('stock').insert(stockItems);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      toast.success(`${csvData.length} stock items uploaded successfully`);
      setIsBatchOpen(false);
      setCsvData([]);
      setCsvErrors([]);
      setBatchNumber('');
      setSelectedRegion('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to upload stock');
    },
  });

  // Delete stock mutation
  const deleteStockMutation = useMutation({
    mutationFn: async (stockItemId: string) => {
      const { error } = await supabase
        .from('stock')
        .delete()
        .eq('id', stockItemId);
      if (error) throw error;
      // Give the database a moment to update before refetching
      await new Promise(resolve => setTimeout(resolve, 300));
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ['stock'] });
      toast.success('Stock item deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete stock');
    },
  });

  // Bulk delete stock mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (stockItemIds: string[]) => {
      const { error } = await supabase
        .from('stock')
        .delete()
        .in('id', stockItemIds);
      if (error) throw error;
      // Give the database a moment to update before refetching
      await new Promise(resolve => setTimeout(resolve, 300));
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ['stock'] });
      const count = selectedForDeletion.size;
      toast.success(`${count} stock item${count !== 1 ? 's' : ''} deleted successfully`);
      setSelectedForDeletion(new Set());
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete stock items');
    },
  });

  // Whether the Complete Upload button should be enabled
  const canCompleteUpload = !bulkUploadMutation.isPending && csvData.length > 0 && batchNumber.trim() !== '' && selectedRegion.trim() !== '' && csvErrors.length === 0;

  const resetForm = () => {
    setStockId('');
    setSmartcardNumber('');
    setSerialNumber('');
    setStockType('');
    setBatchNumber('');
    setSelectedRegion('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingCsv(true);
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        
        // Parse CSV with better handling of quoted values
        const parseCSVLine = (line: string): string[] => {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        };
        
        const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'));
        
        const data = lines.slice(1).map(line => {
          const values = parseCSVLine(line);
          const obj: any = {};
          headers.forEach((header, i) => {
            obj[header] = values[i] || '';
          });
          return obj;
        });

        // Validate required columns and row-level values
        const requiredCols = ['type'];
        const missingCols = requiredCols.filter(c => !headers.includes(c));
        const errors: string[] = [];
        if (missingCols.length > 0) {
          errors.push(`Missing required columns: ${missingCols.join(', ')}`);
        }

        data.forEach((row, idx) => {
          const rowNum = idx + 2; // account for header row
          // stock_id is optional now - will be auto-generated
          if (!row['type'] || row['type'].toString().trim() === '') {
            errors.push(`Row ${rowNum}: missing type`);
          }
        });

        if (errors.length > 0) {
          setCsvErrors(errors);
          setCsvData(data);
          toast.error('CSV contains validation errors. See preview for details.');
        } else {
          setCsvErrors([]);
          setCsvData(data);
          toast.success(`${data.length} records loaded. Detected columns: ${headers.join(', ')}`);
        }
      } catch (err) {
        toast.error('Failed to parse CSV file');
      } finally {
        setIsProcessingCsv(false);
      }
    };

    reader.readAsText(file);
  };

  const filteredStock = stock.filter(item => {
    const matchesSearch = 
      item.stock_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.smartcard_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.serial_number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (statusFilter === 'all') return matchesSearch;
    return matchesSearch && item.status === statusFilter;
  });

  // Calculate summary metrics
  const summaryMetrics = {
    totalDO: stock.filter(item => {
      const type = (item.type || '').toUpperCase();
      return type.includes('DO') || type.includes('DECODER') || type === 'DO';
    }).length,
    totalFS: stock.filter(item => {
      const type = (item.type || '').toUpperCase();
      return type.includes('FS') || type.includes('FULL SET') || type === 'FS';
    }).length,
    totalDVS: stock.filter(item => {
      const type = (item.type || '').toUpperCase();
      return type.includes('DVS') || type === 'DVS';
    }).length,
    assignedStock: stock.filter(item => item.status !== 'unassigned').length,
    unassignedStock: stock.filter(item => item.status === 'unassigned').length,
  };

  // Calculate regional stock summary
  const getRegionalMetrics = (regionId?: string) => {
    const filtered = regionId ? stock.filter(item => item.region_id === regionId) : stock;
    
    // Count types more flexibly to handle variations in data
    const totalDO = filtered.filter(item => {
      const type = (item.type || '').toUpperCase();
      return type.includes('DO') || type.includes('DECODER') || type === 'DO';
    }).length;
    
    const totalFS = filtered.filter(item => {
      const type = (item.type || '').toUpperCase();
      return type.includes('FS') || type.includes('FULL SET') || type === 'FS';
    }).length;
    
    const totalDVS = filtered.filter(item => {
      const type = (item.type || '').toUpperCase();
      return type.includes('DVS') || type === 'DVS';
    }).length;
    
    return {
      totalDO,
      totalFS,
      totalDVS,
      assignedStock: filtered.filter(item => item.status !== 'unassigned').length,
      unassignedStock: filtered.filter(item => item.status === 'unassigned').length,
      total: filtered.length,
    };
  };

  // Get selected region name for display
  const selectedRegionName = selectedRegion && regions.find(r => r.id === selectedRegion)?.name;

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
          <h1 className="text-2xl font-bold text-foreground">Stock Management</h1>
          <p className="text-muted-foreground">Manage inventory and upload new stock</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isManualOpen} onOpenChange={setIsManualOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Single
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Stock Item</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Stock ID <span className="text-muted-foreground text-xs">(optional - auto-generated)</span></Label>
                  <Input
                    placeholder="Leave empty for auto-generation (DO-0001, FS-0001, etc.)"
                    value={stockId}
                    onChange={(e) => setStockId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Smartcard Number</Label>
                  <Input
                    placeholder="Enter smartcard number"
                    value={smartcardNumber}
                    onChange={(e) => setSmartcardNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Serial Number</Label>
                  <Input
                    placeholder="Enter serial number"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type *</Label>
                  <Select value={stockType} onValueChange={setStockType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {STOCK_TYPES.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Region</Label>
                  <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                      {regions.map(region => (
                        <SelectItem key={region.id} value={region.id}>{region.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Batch Number</Label>
                  <Input
                    placeholder="Enter batch number"
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                  />
                </div>
                <Button 
                  className="w-full" 
                  onClick={() => addStockMutation.mutate()}
                  disabled={addStockMutation.isPending || !stockType}
                >
                  {addStockMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Add Stock
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog 
            open={isBatchOpen} 
            onOpenChange={(open) => {
              setIsBatchOpen(open);
              // Clear all batch upload state when dialog closes
              if (!open) {
                setCsvData([]);
                setCsvErrors([]);
                setBatchNumber('');
                setSelectedRegion('');
              }
            }}
          >
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Upload className="h-4 w-4" />
                Batch Upload
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Batch Stock Upload</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4 flex flex-col">
                <div className="overflow-y-auto max-h-[60vh] space-y-4">
                  <div className="space-y-2">
                    <Label>Batch Number *</Label>
                    <Input
                      placeholder="Enter batch number"
                      value={batchNumber}
                      onChange={(e) => setBatchNumber(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Region</Label>
                    <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select region" />
                      </SelectTrigger>
                      <SelectContent>
                        {regions.map(region => (
                          <SelectItem key={region.id} value={region.id}>{region.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Upload CSV</Label>
                    <div className="mb-3 p-3 bg-info/10 border border-info/20 rounded-lg">
                      <p className="text-xs text-info font-medium mb-2">📋 CSV Format Requirements:</p>
                      <ul className="text-xs text-info/80 space-y-1 list-disc list-inside">
                        <li><strong>Required:</strong> type (Full Set (FS), Decoder Only (DO), or DVS)</li>
                        <li><strong>Optional:</strong> smartcard_number, serial_number</li>
                        <li>Column names are flexible: "Smartcard Number", "Serial No.", etc.</li>
                        <li>Stock IDs will be auto-generated if not provided</li>
                      </ul>
                      <a 
                        href="/sample-stock-upload.csv" 
                        download 
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2 font-medium"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <FileSpreadsheet className="h-3 w-3" />
                        Download Sample CSV Template
                      </a>
                    </div>
                    <div 
                      className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <FileSpreadsheet className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground">
                        Click to upload CSV file
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Supports .csv files with stock data
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </div>
                  </div>
                  {csvData.length > 0 && (
                    <div>
                      <div className="p-4 bg-success/10 rounded-lg">
                        <p className="text-sm text-success font-medium">
                          {csvData.length} records ready to upload
                        </p>
                        <p className="text-xs text-success/70 mt-1">
                          Detected columns: {Object.keys(csvData[0] || {}).join(', ')}
                        </p>
                      </div>

                      {/* CSV validation errors */}
                      {csvErrors.length > 0 && (
                        <div className="mt-3 p-3 rounded border border-destructive/20 bg-destructive/5">
                          <p className="text-sm font-medium text-destructive">CSV validation errors:</p>
                          <ul className="list-disc list-inside text-xs text-destructive mt-2">
                            {csvErrors.map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="mt-4">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Preview (click cells to edit):</p>
                        <div className="overflow-auto max-h-64 rounded border border-border">
                          <table className="min-w-full">
                            <thead className="bg-muted/10 sticky top-0">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-8">#</th>
                                {Object.keys(csvData[0] || {}).map((h) => (
                                  <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground min-w-32">
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {csvData.slice(0, 10).map((row, idx) => {
                                // Check if this row has validation errors
                                const rowErrors = csvErrors.filter(e => e.includes(`Row ${idx + 2}`));
                                const hasError = rowErrors.length > 0;
                                
                                return (
                                  <tr 
                                    key={idx} 
                                    className={`border-t ${hasError ? 'bg-destructive/5' : idx % 2 === 0 ? 'bg-background/50' : ''}`}
                                    title={hasError ? rowErrors.join(', ') : ''}
                                  >
                                    <td className="px-3 py-2 text-xs font-medium text-muted-foreground w-8">{idx + 2}</td>
                                    {Object.keys(csvData[0] || {}).map((k) => {
                                      const value = (row as any)[k] ?? '';
                                      const isEmpty = value.toString().trim() === '';
                                      const isRequired = ['type'].includes(k);
                                      const hasRowError = isRequired && isEmpty;
                                      const isStockId = k === 'stock_id';
                                      
                                      return (
                                        <td key={k} className={`px-3 py-2 text-sm ${hasRowError ? 'bg-destructive/20' : ''}`}>
                                          {isStockId ? (
                                            <div className="text-xs text-muted-foreground italic py-1">Auto-generated</div>
                                          ) : (
                                            <Input
                                              value={value}
                                              onChange={(e) => updateCsvCell(idx, k, e.target.value)}
                                              className={`h-8 text-xs ${hasRowError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                                              placeholder={isRequired ? 'Required' : 'Optional'}
                                            />
                                          )}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        {csvData.length > 10 && (
                          <p className="text-xs text-muted-foreground mt-2">Showing 10 of {csvData.length} rows (all rows will be uploaded)</p>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            setCsvData([]);
                            setCsvErrors([]);
                          }}
                          className="mt-2 text-xs"
                        >
                          Clear CSV
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      // Close the batch upload dialog without uploading
                      setIsBatchOpen(false);
                    }}
                    className="flex-1"
                  >
                    Close
                  </Button>
                  <Button 
                    className="flex-1"
                    onClick={() => bulkUploadMutation.mutate()}
                    disabled={!canCompleteUpload}
                  >
                    {bulkUploadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Complete Upload
                  </Button>
                </div>
                {/* Helper text explaining disabled state */}
                {!canCompleteUpload && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {bulkUploadMutation.isPending && 'Uploading... Please wait.'}
                    {!bulkUploadMutation.isPending && csvData.length === 0 && 'Upload a CSV file to enable Complete Upload.'}
                    {!bulkUploadMutation.isPending && csvData.length > 0 && batchNumber.trim() === '' && 'Enter a batch number to enable Complete Upload.'}
                    {!bulkUploadMutation.isPending && csvData.length > 0 && batchNumber.trim() !== '' && selectedRegion.trim() === '' && 'Select a region to enable Complete Upload.'}
                    {csvErrors.length > 0 && 'Fix CSV errors before uploading.'}
                  </p>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stock Summary Cards */}
      <StatsGrid columns={4}>
        <MetricCard
          title="Total DO Stock"
          value={summaryMetrics.totalDO}
          icon={Package}
          variant="primary"
        />
        <MetricCard
          title="Total FS Stock"
          value={summaryMetrics.totalFS}
          icon={Package}
          variant="success"
        />
        <MetricCard
          title="Total DVS Stock"
          value={summaryMetrics.totalDVS}
          icon={Package}
          variant="info"
        />
        <MetricCard
          title="Unassigned Stock"
          value={summaryMetrics.unassignedStock}
          icon={Package}
          variant={summaryMetrics.unassignedStock > 0 ? 'warning' : 'default'}
        />
      </StatsGrid>

      {/* Regional Stock Summary */}
      {selectedRegion && selectedRegionName && (
        <Card className="glass border-info/20 bg-info/5">
          <CardHeader>
            <CardTitle className="text-info flex items-center gap-2">
              <Package className="h-5 w-5" />
              Stock Summary - {selectedRegionName} Region
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatsGrid columns={4}>
              <MetricCard
                title={`${selectedRegionName} - DO`}
                value={getRegionalMetrics(selectedRegion).totalDO}
                icon={Package}
                variant="primary"
              />
              <MetricCard
                title={`${selectedRegionName} - FS`}
                value={getRegionalMetrics(selectedRegion).totalFS}
                icon={Package}
                variant="success"
              />
              <MetricCard
                title={`${selectedRegionName} - DVS`}
                value={getRegionalMetrics(selectedRegion).totalDVS}
                icon={Package}
                variant="info"
              />
              <MetricCard
                title={`${selectedRegionName} - Assigned`}
                value={getRegionalMetrics(selectedRegion).assignedStock}
                icon={Package}
                variant="primary"
              />
              <MetricCard
                title={`${selectedRegionName} - Unassigned`}
                value={getRegionalMetrics(selectedRegion).unassignedStock}
                icon={Package}
                variant={getRegionalMetrics(selectedRegion).unassignedStock > 0 ? 'warning' : 'default'}
              />
            </StatsGrid>
          </CardContent>
        </Card>
      )}

      {/* All Regions Summary */}
      {regions.length > 0 && (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Stock by Region
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {regions.map(region => {
                const metrics = getRegionalMetrics(region.id);
                const isSelected = selectedRegion === region.id;
                return (
                  <div
                    key={region.id}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-info bg-info/10'
                        : 'border-border bg-background/50 hover:border-primary/50'
                    }`}
                  >
                    <h3 className={`font-semibold mb-3 ${isSelected ? 'text-info' : 'text-foreground'}`}>
                      {region.name}
                      {isSelected && <span className="ml-2 text-xs bg-info/20 text-info px-2 py-1 rounded">Selected</span>}
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Stock:</span>
                        <span className="font-medium">{metrics.total}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">DO:</span>
                        <span className="font-medium text-primary">{metrics.totalDO}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">FS:</span>
                        <span className="font-medium text-success">{metrics.totalFS}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">DVS:</span>
                        <span className="font-medium text-secondary">{metrics.totalDVS}</span>
                      </div>
                      <div className="border-t my-2"></div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Assigned:</span>
                        <span className="font-medium">{metrics.assignedStock}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Unassigned:</span>
                        <span className={`font-medium ${metrics.unassignedStock > 0 ? 'text-warning' : 'text-muted-foreground'}`}>
                          {metrics.unassignedStock}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="glass">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Inventory ({filteredStock.length})
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search stock..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {Object.entries(statusConfig).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Bulk selection actions */}
          {selectedForDeletion.size > 0 && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center justify-between">
              <p className="text-sm font-medium text-destructive">
                {selectedForDeletion.size} item{selectedForDeletion.size !== 1 ? 's' : ''} selected
              </p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedForDeletion(new Set())}
                  className="text-destructive hover:bg-destructive/10"
                >
                  Clear Selection
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (confirm(`Delete ${selectedForDeletion.size} item${selectedForDeletion.size !== 1 ? 's' : ''}? This cannot be undone.`)) {
                      bulkDeleteMutation.mutate(Array.from(selectedForDeletion));
                    }
                  }}
                  disabled={bulkDeleteMutation.isPending}
                >
                  {bulkDeleteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Delete Selected
                </Button>
              </div>
            </div>
          )}
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedForDeletion.size > 0 && selectedForDeletion.size === filteredStock.slice(0, 50).length}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          const newSelected = new Set(filteredStock.slice(0, 50).map(item => item.id));
                          setSelectedForDeletion(newSelected);
                        } else {
                          setSelectedForDeletion(new Set());
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>Stock ID</TableHead>
                  <TableHead>Smartcard</TableHead>
                  <TableHead>Serial No.</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStock.slice(0, 50).map((item) => (
                  <TableRow key={item.id} className={selectedForDeletion.has(item.id) ? 'bg-muted/50' : ''}>
                    <TableCell className="w-12">
                      <Checkbox
                        checked={selectedForDeletion.has(item.id)}
                        onCheckedChange={(checked) => {
                          const newSelected = new Set(selectedForDeletion);
                          if (checked) {
                            newSelected.add(item.id);
                          } else {
                            newSelected.delete(item.id);
                          }
                          setSelectedForDeletion(newSelected);
                        }}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{item.stock_id}</TableCell>
                    <TableCell>{item.smartcard_number || '-'}</TableCell>
                    <TableCell>{item.serial_number || '-'}</TableCell>
                    <TableCell>
                      {(() => {
                        const type = (item.type || '').toUpperCase();
                        if (type.includes('DO') || type.includes('DECODER')) {
                          return <Badge className="bg-primary text-primary-foreground">{item.type}</Badge>;
                        } else if (type.includes('FS') || type.includes('FULL')) {
                          return <Badge className="bg-success text-success-foreground">{item.type}</Badge>;
                        } else if (type.includes('DVS')) {
                          return <Badge className="bg-info text-info-foreground">{item.type}</Badge>;
                        } else {
                          return <Badge variant="outline">{item.type}</Badge>;
                        }
                      })()}
                    </TableCell>
                    <TableCell>{(item as any).batch?.batch_number || '-'}</TableCell>
                    <TableCell>{(item as any).region?.name || '-'}</TableCell>
                    <TableCell>
                      <Badge className={statusConfig[item.status]?.className || ''}>
                        {statusConfig[item.status]?.label || item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            // TODO: Implement edit functionality
                            toast.info('Edit functionality coming soon');
                          }}
                        >
                          <Edit className="h-4 w-4 text-blue-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this stock item?')) {
                              deleteStockMutation.mutate(item.id);
                            }
                          }}
                          disabled={deleteStockMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filteredStock.length > 50 && (
            <p className="text-center text-sm text-muted-foreground mt-4">
              Showing 50 of {filteredStock.length} items
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
