import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, TrendingUp, AlertTriangle, CheckCircle2, X, FileDown, RefreshCw } from 'lucide-react';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Material {
  id: string;
  material_id: string;
  name: string;
  category: string;
  unit: string;
  stocks: number;
  description: string;
  created_at: Date | string | Timestamp;
  created_by?: string;
  added_by?: string;
  userName?: string;
}

interface LogEntry {
  id: string;
  material_id: string;
  material_name: string;
  action_type: string;
  quantity: number;
  reason: string;
  created_at: Date | string | Timestamp;
  userName?: string;
  user_id?: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStat, setSelectedStat] = useState<string | null>(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  // Removed unused generatingModalPDF and setGeneratingModalPDF

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log("Fetching dashboard data...");
      
      if (!db) {
        throw new Error("Firestore is not initialized");
      }
      
      // Fetch materials
      const materialsRef = collection(db, 'materials');
      const materialsSnapshot = await getDocs(materialsRef);
      
      const matData: Material[] = [];
      materialsSnapshot.forEach(doc => {
        const data = doc.data();
        
        // Parse the date correctly
        let createdAt: Date | string | Timestamp = data.created_at || new Date();
        
        matData.push({
          id: doc.id,
          material_id: data.material_id || `MAT-${doc.id.slice(0, 8)}`,
          name: data.name || 'Unnamed Material',
          category: data.category || 'other',
          unit: data.unit || 'pcs',
          stocks: typeof data.stocks === 'number' ? data.stocks : 0,
          description: data.description || '',
          created_at: createdAt,
          created_by: data.created_by,
          added_by: data.added_by,
          userName: data.added_by || data.created_by || 'System'
        });
      });
      
      // Sort materials by created_at (newest first)
      const sortedMaterials = [...matData].sort((a, b) => {
        const dateA = a.created_at instanceof Timestamp ? a.created_at.toDate() : new Date(a.created_at);
        const dateB = b.created_at instanceof Timestamp ? b.created_at.toDate() : new Date(b.created_at);
        return dateB.getTime() - dateA.getTime();
      });
      
      console.log("Materials loaded:", sortedMaterials.length);
      setMaterials(sortedMaterials);
      
      // Fetch profiles to map user IDs to full names
      const profilesRef = collection(db, 'profiles');
      const profilesSnapshot = await getDocs(profilesRef);
      const profileMap: Record<string, string> = {};
      profilesSnapshot.forEach(doc => {
        const data = doc.data();
        profileMap[doc.id] = data.full_name || data.email || 'Unknown User';
      });

      // Fetch logs
      try {
        const logsRef = collection(db, 'material_logs');
        const logsSnapshot = await getDocs(logsRef);
        
        const logData: LogEntry[] = [];
        logsSnapshot.forEach(doc => {
          const data = doc.data();
          
          // Parse the date correctly
          let createdAt: Date | string | Timestamp = data.created_at || new Date();
          
          const resolvedUserName = data.user_id
            ? profileMap[data.user_id] || data.user_name || data.performed_by || data.user_id
            : data.user_name || data.performed_by || 'System';

          logData.push({
            id: doc.id,
            material_id: data.material_id || '',
            material_name: data.material_name || '',
            action_type: data.action_type || '',
            quantity: data.quantity || 0,
            reason: data.reason || '',
            created_at: createdAt,
            userName: resolvedUserName,
            user_id: data.user_id
          });
        });
        
        // Sort logs by created_at (newest first)
        const sortedLogs = [...logData].sort((a, b) => {
          const dateA = a.created_at instanceof Timestamp ? a.created_at.toDate() : new Date(a.created_at);
          const dateB = b.created_at instanceof Timestamp ? b.created_at.toDate() : new Date(b.created_at);
          return dateB.getTime() - dateA.getTime();
        });
        
        console.log("Logs loaded:", sortedLogs.length);
        setLogs(sortedLogs);
      } catch (logError) {
        console.warn("Could not fetch logs:", logError);
        setLogs([]);
      }
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Calculate statistics
  const totalMaterials = materials.length;
  const totalStock = materials.reduce((sum, m) => sum + (m.stocks || 0), 0);
  const lowStock = materials.filter(m => (m.stocks || 0) > 0 && (m.stocks || 0) < 6).length;
  const outOfStock = materials.filter(m => (m.stocks || 0) === 0).length;
  const inStock = materials.filter(m => (m.stocks || 0) >= 6).length;

  // Category data
  const categoryData: Record<string, number> = {};
  materials.forEach(m => {
    const category = m.category || 'other';
    categoryData[category] = (categoryData[category] || 0) + (m.stocks || 0);
  });

  const categoryLabels = Object.keys(categoryData);
  const maxStock = Math.max(...Object.values(categoryData), 1);

  // Get recent materials (already sorted by created_at desc)
  const recentMaterials = materials.slice(0, 5);
  
  // Get recent logs (already sorted by created_at desc)
  const recentLogs = logs.slice(0, 5);

  const getStatus = (stock: number) => {
    if (stock === 0) return { label: 'Out of Stock', class: 'bg-red-100 text-red-700', dot: 'bg-red-600' };
    if (stock < 6) return { label: 'Low Stock', class: 'bg-orange-100 text-orange-700', dot: 'bg-orange-600' };
    return { label: 'In Stock', class: 'bg-green-100 text-green-700', dot: 'bg-green-600' };
  };

  const formatDate = (date: Date | string | Timestamp): string => {
    if (!date) return 'N/A';
    try {
      let dateObj: Date;
      if (date instanceof Timestamp) {
        dateObj = date.toDate();
      } else if (date instanceof Date) {
        dateObj = date;
      } else {
        dateObj = new Date(date);
      }
      return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Invalid date';
    }
  };

  const formatDateTime = (date: Date | string | Timestamp): string => {
    if (!date) return 'N/A';
    try {
      let dateObj: Date;
      if (date instanceof Timestamp) {
        dateObj = date.toDate();
      } else if (date instanceof Date) {
        dateObj = date;
      } else {
        dateObj = new Date(date);
      }
      return dateObj.toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return 'Invalid date';
    }
  };

  const stats = [
    { title: 'Total Materials', value: totalMaterials.toLocaleString(), icon: Package, color: 'text-blue-800', bg: 'bg-blue-100', type: 'all' },
    { title: 'Total Stock', value: totalStock.toLocaleString(), icon: TrendingUp, color: 'text-green-800', bg: 'bg-green-100', type: 'all' },
    { title: 'Low Stock', value: lowStock.toLocaleString(), icon: AlertTriangle, color: 'text-orange-800', bg: 'bg-orange-100', type: 'low' },
    { title: 'Out of Stock', value: outOfStock.toLocaleString(), icon: CheckCircle2, color: 'text-red-800', bg: 'bg-red-100', type: 'out' },
  ];

  const getFilteredMaterials = (): Material[] => {
    if (!selectedStat) return [];
    const statType = stats.find(s => s.title === selectedStat)?.type;
    if (statType === 'all') return materials;
    if (statType === 'low') return materials.filter(m => (m.stocks || 0) > 0 && (m.stocks || 0) < 6);
    if (statType === 'out') return materials.filter(m => (m.stocks || 0) === 0);
    return [];
  };

  const handleStatClick = (title: string) => {
    setSelectedStat(title);
    setIsModalOpen(true);
  };

  const generatePDF = async () => {
    if (loading || materials.length === 0) return;
    setGeneratingPDF(true);
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let yPos = 20;
      
      // Header
      doc.setFontSize(20);
      doc.setTextColor(22, 101, 52);
      doc.text('CASSO Inventory System', pageWidth / 2, yPos, { align: 'center' });
      
      yPos += 8;
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, yPos, { align: 'center' });
      
      yPos += 12;
      
      // Summary
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text('Dashboard Overview', 14, yPos);
      yPos += 6;
      
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(`Total Materials: ${totalMaterials}`, 14, yPos);
      doc.text(`Total Stock: ${totalStock}`, 80, yPos);
      doc.text(`Low Stock: ${lowStock}`, 140, yPos);
      doc.text(`Out of Stock: ${outOfStock}`, 180, yPos);
      
      yPos += 15;
      
      // Recent Materials Table
      if (recentMaterials.length > 0) {
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.text('Recent Materials', 14, yPos);
        yPos += 5;
        
        const tableData = recentMaterials.map(mat => [
          mat.material_id || 'N/A',
          mat.name,
          mat.category,
          mat.unit || '-',
          mat.stocks.toString(),
          getStatus(mat.stocks).label,
          formatDate(mat.created_at)
        ]);
        
        autoTable(doc, {
          startY: yPos,
          head: [['ID', 'Name', 'Category', 'Unit', 'Stock', 'Status', 'Date']],
          body: tableData,
          headStyles: { fillColor: [22, 101, 52], textColor: [255, 255, 255], fontSize: 8 },
          styles: { fontSize: 7, cellPadding: 2 },
          margin: { left: 14, right: 14 }
        });
        
        const lastTable = doc as any;
        yPos = lastTable.lastAutoTable?.finalY + 10 || yPos + 50;
      }
      
      // Recent Logs Table
      if (recentLogs.length > 0) {
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.text('Recent Activity Logs', 14, yPos);
        yPos += 5;
        
        const logData = recentLogs.map(log => [
          formatDateTime(log.created_at),
          log.material_name,
          log.action_type,
          `${log.action_type?.toLowerCase() === 'add' ? '+' : '-'}${log.quantity}`,
          log.reason || '-',
          log.userName || 'System'
        ]);
        
        autoTable(doc, {
          startY: yPos,
          head: [['Date & Time', 'Material', 'Action', 'Qty', 'Reason', 'Performed By']],
          body: logData,
          headStyles: { fillColor: [22, 101, 52], textColor: [255, 255, 255], fontSize: 8 },
          styles: { fontSize: 7, cellPadding: 2 },
          margin: { left: 14, right: 14 }
        });
      }
      
      doc.save(`Dashboard_Report_${new Date().getTime()}.pdf`);
    } catch (error) {
      console.error('PDF generation error:', error);
    } finally {
      setGeneratingPDF(false);
    }
  };

  const categoryColors: Record<string, string> = {
    furniture: 'bg-[#166534]',
    electronics: 'bg-blue-500',
    supplies: 'bg-purple-500',
    other: 'bg-gray-500',
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-md p-6 text-center max-w-md">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Data</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={fetchData} 
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4 relative w-full max-w-full pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Dashboard Overview</h2>
          {!loading && materials.length === 0 && (
            <p className="text-sm text-gray-500 mt-1">No materials found. Add some materials to get started.</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 text-sm font-semibold cursor-pointer text-gray-700 bg-gray-100 px-4 py-2 rounded-md hover:bg-gray-200 disabled:bg-gray-300"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <button
            onClick={generatePDF}
            disabled={generatingPDF || materials.length === 0}
            className="flex items-center gap-2 text-sm font-semibold cursor-pointer text-white bg-[#166534] px-4 py-2 rounded-md hover:bg-[#14532d] disabled:bg-gray-400"
          >
            <FileDown className={`w-4 h-4 ${generatingPDF ? 'animate-spin' : ''}`} />
            {generatingPDF ? 'Generating...' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-gray-100 rounded-md p-5 h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div 
                key={idx} 
                onClick={() => handleStatClick(stat.title)}
                className={`${stat.bg} rounded-md p-5 shadow-sm border border-gray-200 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${stat.bg}`}>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div>
                  <p className={`text-sm font-medium ${stat.color} mb-0.5`}>{stat.title}</p>
                  <h3 className={`text-xl font-bold ${stat.color}`}>{stat.value}</h3>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && materials.length > 0 && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Stock by Category */}
            <div className="bg-white rounded-md p-5 shadow-sm border border-gray-200">
              <h3 className="text-base font-bold text-gray-800 mb-4">Stock by Category</h3>
              {categoryLabels.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-gray-400">No data available</div>
              ) : (
                <div className="space-y-3">
                  {categoryLabels.map((cat) => {
                    const value = categoryData[cat];
                    const percentage = (value / maxStock) * 100;
                    return (
                      <div key={cat} className="space-y-1.5">
                        <div className="flex justify-between text-sm">
                          <span className="capitalize font-medium text-gray-700">{cat}</span>
                          <span className="text-gray-500">{value.toLocaleString()} units</span>
                        </div>
                        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${categoryColors[cat] || 'bg-[#166534]'}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Stock Status Distribution */}
            <div className="bg-white rounded-md p-5 shadow-sm border border-gray-200">
              <h3 className="text-base font-bold text-gray-800 mb-4">Stock Status Distribution</h3>
              <div className="flex items-center justify-center">
                <div className="relative w-32 h-32">
                  <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#eee" strokeWidth="3" />
                    {totalMaterials > 0 && (
                      <>
                        <circle 
                          cx="18" cy="18" r="15.9" 
                          fill="none" 
                          stroke="#166534" 
                          strokeWidth="3"
                          strokeDasharray={`${(inStock / totalMaterials) * 100} 100`}
                        />
                        <circle 
                          cx="18" cy="18" r="15.9" 
                          fill="none" 
                          stroke="#f97316" 
                          strokeWidth="3"
                          strokeDasharray={`${(lowStock / totalMaterials) * 100} 100`}
                          strokeDashoffset={-((inStock / totalMaterials) * 100)}
                        />
                        <circle 
                          cx="18" cy="18" r="15.9" 
                          fill="none" 
                          stroke="#ef4444" 
                          strokeWidth="3"
                          strokeDasharray={`${(outOfStock / totalMaterials) * 100} 100`}
                          strokeDashoffset={-(((inStock + lowStock) / totalMaterials) * 100)}
                        />
                      </>
                    )}
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold text-gray-800">{totalMaterials}</span>
                  </div>
                </div>
                <div className="ml-6 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#166534]"></div>
                    <span className="text-sm text-gray-600">In Stock ({inStock})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                    <span className="text-sm text-gray-600">Low Stock ({lowStock})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span className="text-sm text-gray-600">Out of Stock ({outOfStock})</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Materials Table */}
          <div className="bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-800">Recent Materials</h3>
              <p className="text-xs text-gray-400 mt-1">Showing the 5 most recently added items</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#f8fafc] border-b border-gray-200">
                    <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider">Item ID</th>
                    <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider">Item Name</th>
                    <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider">Unit</th>
                    <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider">Stock</th>
                    <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider">Date Added</th>
                  </tr>
                </thead>
                <tbody>
                  {recentMaterials.map((mat) => {
                    const status = getStatus(mat.stocks);
                    return (
                      <tr 
                        key={mat.id} 
                        onClick={() => navigate('/materials', { state: { highlightItemId: mat.id } })}
                        className="hover:bg-yellow-50 transition-colors cursor-pointer border-b border-gray-100"
                      >
                        <td className="px-6 py-3 font-mono text-[11px] text-slate-800 font-bold">{mat.material_id}</td>
                        <td className="px-6 py-3 text-slate-800">{mat.name}</td>
                        <td className="px-6 py-3 text-slate-800 capitalize">{mat.category}</td>
                        <td className="px-6 py-3 text-slate-800">{mat.unit || '-'}</td>
                        <td className="px-6 py-3 text-slate-800 font-bold">{mat.stocks}</td>
                        <td className="px-6 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${status.class}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`}></span>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-slate-500 text-xs">{formatDate(mat.created_at)}</td>
                       </tr>
                    );
                  })}
                </tbody>
               </table>
            </div>
          </div>

          {/* Recent Activity Logs */}
          {recentLogs.length > 0 && (
            <div className="bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-base font-bold text-gray-800">Recent Activity Logs</h3>
                <p className="text-xs text-gray-400 mt-1">Showing the 5 most recent transactions</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f8fafc] border-b border-gray-200">
                      <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider">Date & Time</th>
                      <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider">Material</th>
                      <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider">Action</th>
                      <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider text-right">Quantity</th>
                      <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider">Reason</th>
                      <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider">Performed By</th>
                     </tr>
                  </thead>
                  <tbody>
                    {recentLogs.map((log) => (
                      <tr 
                        key={log.id} 
                        onClick={() => navigate('/materials', { state: { highlightItemId: log.material_id } })}
                        className="hover:bg-yellow-50 transition-colors cursor-pointer border-b border-gray-100"
                      >
                        <td className="px-6 py-3 text-gray-500 text-xs">{formatDateTime(log.created_at)}</td>
                        <td className="px-6 py-3 font-semibold text-slate-800">{log.material_name}</td>
                        <td className="px-6 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            log.action_type?.toLowerCase() === 'add' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                          }`}>
                            {log.action_type}
                          </span>
                        </td>
                        <td className={`px-6 py-3 text-right font-bold ${
                          log.action_type?.toLowerCase() === 'add' ? 'text-emerald-600' : 'text-red-600'
                        }`}>
                          {log.action_type?.toLowerCase() === 'add' ? '+' : '-'}{log.quantity}
                        </td>
                        <td className="px-6 py-3 text-gray-600 text-xs italic">{log.reason || 'No reason provided'}</td>
                        <td className="px-6 py-3 text-slate-800 text-sm">{log.userName || 'System'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {!loading && materials.length === 0 && (
        <div className="bg-white rounded-md shadow-sm border border-gray-200 p-12 text-center">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No Materials Found</h3>
          <p className="text-gray-500 mb-4">Get started by adding your first material to the inventory.</p>
          <button
            onClick={() => navigate('/materials')}
            className="bg-[#166534] text-white px-6 py-2 rounded-md hover:bg-[#14532d]"
          >
            Add Materials
          </button>
        </div>
      )}

      {/* Stats Detail Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-4xl rounded-md shadow-xl overflow-hidden relative border border-gray-200 max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
              <h3 className="font-bold text-gray-800 text-base">{selectedStat} Details</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-[#f8fafc]">
                  <tr className="border-b border-gray-200">
                    <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider">#</th>
                    <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider">Item ID</th>
                    <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider text-center">Stock</th>
                    <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider">Status</th>
                   </tr>
                </thead>
                <tbody>
                  {getFilteredMaterials().map((mat, idx) => {
                    const status = getStatus(mat.stocks);
                    return (
                      <tr 
                        key={mat.id} 
                        onClick={() => { setIsModalOpen(false); navigate('/materials', { state: { highlightItemId: mat.id } }); }}
                        className="hover:bg-yellow-50 transition-colors cursor-pointer border-b border-gray-100"
                      >
                        <td className="px-6 py-3 text-gray-500 text-sm">{idx + 1}</td>
                        <td className="px-6 py-3 text-slate-800 whitespace-nowrap font-mono text-xs">{mat.material_id}</td>
                        <td className="px-6 py-3 text-slate-800">{mat.name}</td>
                        <td className="px-6 py-3 text-slate-800 capitalize">{mat.category}</td>
                        <td className="px-6 py-3 text-center text-slate-800 font-bold">{mat.stocks}</td>
                        <td className="px-6 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${status.class}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`}></span>
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}