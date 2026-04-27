import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Search, FileDown, Trash, Trash2, AlertCircle, AlertTriangle, Check } from 'lucide-react';
import { collection, query, orderBy, getDocs, doc, deleteDoc, writeBatch, where } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { TableSkeleton } from '../components/SkeletonLoader';
import { showToast } from '../components/Toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Logs() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [logToDelete, setLogToDelete] = useState<any>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  // Role-based access control
  const [role, setRole] = useState<string | null>(null);
  const [roleLoaded, setRoleLoaded] = useState(false);
  const isAdmin = role === 'admin' || role === 'administrator';

  const getDaysUntilExpiration = (createdAt: string) => {
    const createdDate = new Date(createdAt);
    if (Number.isNaN(createdDate.getTime())) return 0;
    const diffMs = Date.now() - createdDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, 30 - diffDays);
  };

  const fetchLogs = async () => {
    setLoading(true);

    try {
      // Clean up old logs (30 days old) - for all users
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const isoThreshold = thirtyDaysAgo.toISOString();

      const oldLogsQuery = query(collection(db, 'material_logs'), where('created_at', '<', isoThreshold));
      const oldLogsSnapshot = await getDocs(oldLogsQuery);
      if (!oldLogsSnapshot.empty) {
        const batch = writeBatch(db);
        oldLogsSnapshot.forEach(docSnap => batch.delete(docSnap.ref));
        await batch.commit();
      }

      // Fetch profiles to map user_id to full_name
      const profilesSnapshot = await getDocs(collection(db, 'profiles'));
      const profileMap: Record<string, string> = {};
      profilesSnapshot.forEach(p => {
        profileMap[p.id] = p.data().full_name || '-';
      });

      // Fetch all logs
      const logsQuery = query(collection(db, 'material_logs'), orderBy('created_at', 'desc'));
      const logsSnapshot = await getDocs(logsQuery);
      
      const data = logsSnapshot.docs.map(docSnap => {
        const logData = docSnap.data();
        return {
          id: docSnap.id,
          ...logData,
          profiles: { full_name: logData.user_id ? profileMap[logData.user_id] || '-' : '-' }
        };
      });

      setLogs(data);
    } catch (error) {
      console.error(error);
      showToast('Failed to load activity logs', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    const loadRole = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          const profileDoc = await getDocs(query(collection(db, 'profiles'), where('__name__', '==', user.uid)));
          if (!profileDoc.empty) {
            const data = profileDoc.docs[0].data();
            const userRole = (data?.role || 'user').toString().toLowerCase().trim();
            setRole(userRole);
          } else {
            setRole('user');
          }
        } catch (error) {
          console.error('Error loading user role:', error);
          setRole('user');
        }
      }
      setRoleLoaded(true);
    };
    
    loadRole();
  }, []);

  const filteredLogs = logs.filter(log =>
    log.material_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.reason && log.reason.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const twentyDaysAgo = new Date();
  twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);
  const expiringLogsCount = logs.filter(log => new Date(log.created_at) < twentyDaysAgo).length;

  const handleDeleteClick = (log: any) => {
    setLogToDelete(log);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteLog = async () => {
    if (!logToDelete) return;

    try {
      await deleteDoc(doc(db, 'material_logs', logToDelete.id));
      showToast('Log deleted successfully', 'success');
      fetchLogs();
    } catch (error) {
      showToast('Failed to delete log', 'error');
    }

    setShowDeleteConfirm(false);
    setLogToDelete(null);
  };

  const confirmDeleteAll = async () => {
    try {
      const logsSnapshot = await getDocs(collection(db, 'material_logs'));
      const batch = writeBatch(db);
      logsSnapshot.forEach(docSnap => batch.delete(docSnap.ref));
      await batch.commit();
      showToast('All logs deleted successfully', 'success');
      fetchLogs();
    } catch (error) {
      showToast('Failed to delete all logs', 'error');
    }

    setShowDeleteAllConfirm(false);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();

    // Header section
    doc.setFontSize(18);
    doc.setTextColor(22, 101, 52); // Project green
    doc.text('Inventory CASSO System', 14, 22);

    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text(`Activity Logs Report - Generated on ${new Date().toLocaleDateString()}`, 14, 30);

    const tableData = filteredLogs.map(log => [
      new Date(log.created_at).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      log.material_name,
      log.action_type,
      `${log.action_type?.toLowerCase() === 'add' ? '+' : '-'}${log.quantity}`,
      log.reason || 'No reason provided',
      Array.isArray(log.profiles) ? (log.profiles[0]?.full_name || '-') : (log.profiles?.full_name || '-')
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Date & Time', 'Material', 'Action', 'Qty', 'Reason', 'Performed By']],
      body: tableData,
      headStyles: {
        fillColor: [22, 101, 52], // Project green
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 8,
        cellPadding: 3,
        valign: 'middle'
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { top: 40 }
    });

    doc.save(`Activity_Logs_${new Date().getTime()}.pdf`);
    showToast('Logs Exported Successfully', 'success');
  };

  return (
    <div className="flex flex-col space-y-4 relative w-full max-w-full pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 font-[var(--heading)] tracking-tight">Activity Logs</h2>
          <p className="text-sm text-gray-500">History of material deductions and actions</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative group max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#166534] transition-colors" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-md border border-gray-200 bg-white text-black text-sm focus:ring-2 focus:ring-[#166534]/10 focus:border-[#166534] transition-all outline-none font-medium placeholder:text-gray-400"
            />
          </div>

          {isAdmin && (
            <button
              onClick={() => setShowDeleteAllConfirm(true)}
              className="flex items-center gap-2 text-sm font-semibold cursor-pointer text-white bg-red-600 px-5 py-2 rounded-md hover:bg-red-700 transition-all active:scale-95 shadow-sm whitespace-nowrap"
            >
              <Trash2 className="w-4 h-4" />
              Delete All
            </button>
          )}
          <button
            onClick={exportToPDF}
            className="flex items-center gap-2 text-sm font-semibold cursor-pointer text-gray-700 bg-white border border-gray-200 px-5 py-2 rounded-md hover:bg-gray-50 transition-all active:scale-95 shadow-sm whitespace-nowrap"
          >
            <FileDown className="w-4 h-4 text-green-700" />
            Export to PDF
          </button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-md flex items-start gap-3 mt-4 text-sm">
        <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <span className="font-semibold block mb-1">Log Retention Policy (30-Day Allowance)</span>
          Activity logs are displayed without limits here, but to save space, the system automatically deletes any logs older than 30 days.
          Please use the Export feature frequently if you need to keep long-term records.
        </div>
      </div>

      {expiringLogsCount > 0 && (
        <div className="bg-orange-50 border border-orange-200 text-orange-800 px-4 py-3 rounded-md flex items-start gap-3 mt-4 text-sm shadow-sm animate-pulse">
          <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
          <div>
            <span className="font-semibold block mb-1">Expiring Logs Warning</span>
            {expiringLogsCount} log{expiringLogsCount === 1 ? '' : 's'} {expiringLogsCount === 1 ? 'is' : 'are'} scheduled to be deleted within the next 10 days. Please export to PDF if you need to retain {expiringLogsCount === 1 ? 'this record' : 'these records'}.
          </div>
        </div>
      )}

      <div className="bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden mt-4">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          {loading ? (
            <TableSkeleton rows={10} cols={6} />
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <BookOpen className="w-8 h-8 text-gray-300" />
              </div>
              <p className="font-medium text-gray-500 text-base">No activity logs found.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-gray-200">
                  <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider">Date & Time</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider">Material Name</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider">Action</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider text-right">Quantity</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider">Reason</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider">Retention</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider">Performed By</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-gray-50">
                {filteredLogs.map((log, index) => (
                  <tr
                    key={log.id}
                    onClick={() => log.material_id && navigate('/materials', { state: { highlightItemId: log.material_id } })}
                    className={`hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                  >
                    <td className="px-6 py-3 text-gray-500 text-xs">
                      {new Date(log.created_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-6 py-3 font-semibold text-slate-800">{log.material_name}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight italic border ${log.action_type?.toLowerCase() === 'add' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                        {log.action_type}
                      </span>
                    </td>
                    <td className={`px-6 py-3 text-right font-bold ${log.action_type?.toLowerCase() === 'add' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {log.action_type?.toLowerCase() === 'add' ? '+' : '-'}{log.quantity}
                    </td>
                    <td className="px-6 py-3 text-gray-600 text-xs italic">{log.reason || 'No reason provided'}</td>
                    <td className="px-6 py-3">
                      {(() => {
                        const daysLeft = getDaysUntilExpiration(log.created_at);
                        if (daysLeft > 0 && daysLeft <= 10) {
                          return (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-orange-50 text-orange-700 ring-1 ring-orange-200">
                              <AlertCircle className="w-3 h-3" />
                              {daysLeft === 1 ? '1 day left' : `${daysLeft} days left`}
                            </span>
                          );
                        }
                        return (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                            <Check className="w-3 h-3" />
                            Active
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-3 text-slate-800 font-medium">
                      {Array.isArray(log.profiles)
                        ? (log.profiles[0]?.full_name || '-')
                        : (log.profiles?.full_name || '-')}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-center gap-0.5">
                        {isAdmin && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteClick(log); }}
                            title="Delete log"
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-white">
          <div className="text-sm text-gray-500">
            Showing all {filteredLogs.length} entries
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-md shadow-xl p-6 w-full max-w-sm border border-gray-200">
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="font-bold text-gray-800 text-lg mb-2">Delete Log</h3>
              <p className="text-gray-500 text-sm mb-6">Are you sure you want to delete this log? This action cannot be undone.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-md hover:bg-gray-50 transition-all font-medium text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteLog}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-all font-medium text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteAllConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-md shadow-xl p-6 w-full max-w-sm border border-gray-200">
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="font-bold text-gray-800 text-lg mb-2">Delete All Logs</h3>
              <p className="text-gray-500 text-sm mb-6">Are you sure you want to delete all logs? This action cannot be undone.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteAllConfirm(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-md hover:bg-gray-50 transition-all font-medium text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteAll}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-all font-medium text-sm"
                >
                  Delete All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
