import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, updateDoc, doc, addDoc, writeBatch, where } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { showToast } from '../components/Toast';
import { Check, X, Clock, AlertCircle, AlertTriangle, FileDown } from 'lucide-react';
import { TableSkeleton } from '../components/SkeletonLoader';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface RequestEntry {
  id: string;
  created_at: string;
  user_id: string;
  material_id: string;
  quantity: number;
  purpose: string;
  status: 'pending' | 'approved' | 'rejected';
  profiles: {
    full_name: string | null;
  } | null;
  materials: {
    name: string;
    material_id: string | null;
    stocks: number;
  } | null;
}

interface RequestsListProps {
  showHistoryOnly?: boolean;
  showPendingOnly?: boolean;
}

export default function RequestsList({ showHistoryOnly = false, showPendingOnly = false }: RequestsListProps) {
  const [requests, setRequests] = useState<RequestEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const defaultTab = showHistoryOnly ? 'history' : 'pending';
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>(defaultTab);

  // Role-based access control
  const [role, setRole] = useState<string | null>(null);
  const [, setRoleLoaded] = useState(false);
  const isAdmin = role === 'admin' || role === 'administrator';

  useEffect(() => {
    if (showHistoryOnly) {
      setActiveTab('history');
    } else if (showPendingOnly) {
      setActiveTab('pending');
    }
  }, [showHistoryOnly, showPendingOnly]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      // Clean up old requests (30 days old) - only for admin users
      if (isAdmin) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const isoThreshold = thirtyDaysAgo.toISOString();

        const oldRequestsQuery = query(collection(db, 'requests'), where('created_at', '<', isoThreshold));
        const oldRequestsSnapshot = await getDocs(oldRequestsQuery);
        if (!oldRequestsSnapshot.empty) {
          const batch = writeBatch(db);
          oldRequestsSnapshot.forEach(docSnap => batch.delete(docSnap.ref));
          await batch.commit();
        }
      }

      // 1. Fetch related data maps to emulate joins
      const [profilesSnap, materialsSnap, requestsSnap] = await Promise.all([
        getDocs(collection(db, 'profiles')),
        getDocs(collection(db, 'materials')),
        getDocs(query(collection(db, 'requests'), orderBy('created_at', 'desc')))
      ]);

      const profileMap: Record<string, any> = {};
      profilesSnap.forEach(p => profileMap[p.id] = p.data());

      const materialMap: Record<string, any> = {};
      materialsSnap.forEach(m => materialMap[m.id] = m.data());

      // 2. Map request entries
      const data = requestsSnap.docs.map(docSnap => {
        const req = docSnap.data();
        return {
          id: docSnap.id,
          ...req,
          profiles: { full_name: profileMap[req.user_id]?.full_name || 'Unknown User' },
          materials: {
            name: materialMap[req.material_id]?.name || 'Unknown Item',
            material_id: materialMap[req.material_id]?.material_id || 'N/A',
            stocks: materialMap[req.material_id]?.stocks || 0
          }
        };
      });

      setRequests(data as any || []);
    } catch (error: any) {
      showToast('Failed to load requests: ' + error.message, 'error');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
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

  const handleApprove = async (request: RequestEntry) => {
    if (!request.materials) return;

    if (request.materials.stocks < request.quantity) {
      showToast('Cannot approve: Insufficient stock available.', 'error');
      return;
    }

    setProcessingId(request.id);
    const user = auth.currentUser;

    try {
      // 1. Deduct stock
      const newStock = request.materials.stocks - request.quantity;
      await updateDoc(doc(db, 'materials', request.material_id), { stocks: newStock });

      // 2. Insert Log
      await addDoc(collection(db, 'material_logs'), {
        material_id: request.material_id,
        material_name: request.materials.name,
        action_type: 'APPROVED_REQUEST',
        quantity: request.quantity,
        reason: `Approved request by ${request.profiles?.full_name || 'User'}: ${request.purpose}`,
        user_id: user?.uid || null,
        created_at: new Date().toISOString()
      });

      // 3. Update Request Status
      await updateDoc(doc(db, 'requests', request.id), { status: 'approved' });

      showToast('Request approved successfully.', 'success');
      fetchRequests();
    } catch (error: any) {
      showToast('Failed to approve request: ' + error.message, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setProcessingId(requestId);

    try {
      await updateDoc(doc(db, 'requests', requestId), { status: 'rejected' });
      showToast('Request rejected.', 'success');
      fetchRequests();
    } catch (error: any) {
      showToast('Failed to reject request: ' + error.message, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const historyRequests = requests.filter(r => r.status !== 'pending');

  const displayedRequests = activeTab === 'pending' ? pendingRequests : historyRequests;

  const getDaysUntilExpiration = (createdAt: string) => {
    const createdDate = new Date(createdAt);
    if (Number.isNaN(createdDate.getTime())) return 0;
    const diffMs = Date.now() - createdDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, 30 - diffDays);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();

    // Header section
    doc.setFontSize(18);
    doc.setTextColor(22, 101, 52); // Project green
    doc.text('Inventory CASSO System', 14, 22);

    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    const reportName = showHistoryOnly ? 'Requests History Report' : 'Requests List Report';
    doc.text(`${reportName} - Generated on ${new Date().toLocaleDateString()}`, 14, 30);

    const tableData = displayedRequests.map(req => [
      `${new Date(req.created_at).toLocaleDateString()} ${new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      req.profiles?.full_name || 'Unknown User',
      `${req.materials?.name || 'Unknown Item'} (${req.materials?.material_id || 'N/A'})`,
      req.quantity.toString(),
      req.purpose,
      req.status.charAt(0).toUpperCase() + req.status.slice(1)
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Date', 'Requested By', 'Item (ID)', 'Quantity', 'Purpose', 'Status']],
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

    const fileName = showHistoryOnly ? 'Requests_History' : 'Requests_List';
    doc.save(`${fileName}_${new Date().getTime()}.pdf`);
    showToast('Exported Successfully', 'success');
  };

  // Calculate expiring requests (20 days old - 10 days before deletion)
  const twentyDaysAgo = new Date();
  twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);
  const expiringRequestsCount = displayedRequests.filter(req => new Date(req.created_at) < twentyDaysAgo).length;

  return (
    <div className="flex flex-col space-y-4 relative w-full max-w-full pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 font-[var(--heading)] tracking-tight">
            {showHistoryOnly ? 'Requests History' : showPendingOnly ? 'Requests List' : 'Requests List'}
          </h2>
          <p className="text-sm text-gray-600 mt-1 font-medium">
            {showHistoryOnly
              ? 'Browse approved and rejected request history records.'
              : 'Review and manage material requests from users.'}
          </p>
        </div>
        
        {showHistoryOnly && (
          <div className="flex items-center gap-2">
            <button
              onClick={exportToPDF}
              className="flex items-center gap-2 text-sm font-semibold cursor-pointer text-gray-700 bg-white border border-gray-200 px-5 py-2 rounded-md hover:bg-gray-50 transition-all active:scale-95 shadow-sm whitespace-nowrap"
            >
              <FileDown className="w-4 h-4 text-green-700" />
              Export to PDF
            </button>
          </div>
        )}
      </div>

      {!showHistoryOnly && !showPendingOnly && (
        <div className="flex gap-2 border-b border-gray-200 mt-4">
          <button
            onClick={() => setActiveTab('pending')}
            className={`pb-3 px-4 text-sm font-bold transition-all relative ${activeTab === 'pending' ? 'text-[#166534]' : 'text-gray-400 hover:text-gray-600'
              }`}
          >
            Pending Requests
            {pendingRequests.length > 0 && (
              <span className="ml-2 bg-[#166534] text-white text-[10px] py-0.5 px-2 rounded-full inline-block align-middle mb-0.5">
                {pendingRequests.length}
              </span>
            )}
            {activeTab === 'pending' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#166534] rounded-t-full"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 px-4 text-sm font-bold transition-all relative ${activeTab === 'history' ? 'text-gray-800' : 'text-gray-400 hover:text-gray-600'
              }`}
          >
            History
            {activeTab === 'history' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-800 rounded-t-full"></div>
            )}
          </button>
        </div>
      )}

      {isAdmin && expiringRequestsCount > 0 && (
        <div className="bg-orange-50/50 border border-orange-100 text-orange-600 px-3 py-2 rounded flex items-center gap-2 mt-4 text-xs shadow-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>
            <strong className="font-semibold">Expiring Records:</strong> {expiringRequestsCount} request{expiringRequestsCount === 1 ? '' : 's'} scheduled for deletion within 10 days.
            {activeTab === 'history' ? ' Export to PDF to retain.' : ''}
          </span>
        </div>
      )}

      <div className="bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <TableSkeleton rows={5} cols={7} />
          ) : displayedRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                {activeTab === 'pending' ? <Clock className="w-8 h-8 text-gray-300" /> : <AlertCircle className="w-8 h-8 text-gray-300" />}
              </div>
              <p className="font-medium text-gray-500 text-base">No {activeTab} requests found.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-gray-200">
                  <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider">Requested By</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider">Item (ID)</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider">Quantity</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider">Purpose</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider">Status</th>
                  {activeTab === 'pending' && (
                    <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-gray-50">
                {displayedRequests.map((req, index) => (
                  <tr
                    key={req.id}
                    className={`transition-all duration-200 hover:bg-slate-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                  >
                    <td className="px-6 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {new Date(req.created_at).toLocaleDateString()} {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-3 text-slate-800 font-medium">
                      {req.profiles?.full_name || 'Unknown User'}
                    </td>
                    <td className="px-6 py-3">
                      <p className="text-slate-800 font-medium">{req.materials?.name || 'Unknown Item'}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{req.materials?.material_id || 'N/A'}</p>
                    </td>
                    <td className="px-6 py-3 text-slate-800 font-bold">
                      {req.quantity}
                    </td>
                    <td className="px-6 py-3 text-slate-600 text-sm max-w-xs truncate" title={req.purpose}>
                      {req.purpose}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex flex-col gap-1">
                        {req.status === 'pending' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ring-1 ring-inset bg-amber-50 text-amber-700 ring-amber-600/20">
                            <Clock className="w-3 h-3" /> Pending
                          </span>
                        )}
                        {req.status === 'approved' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ring-1 ring-inset bg-emerald-50 text-emerald-700 ring-emerald-600/20">
                            <Check className="w-3 h-3" /> Approved
                          </span>
                        )}
                        {req.status === 'rejected' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ring-1 ring-inset bg-red-50 text-red-700 ring-red-600/20">
                            <X className="w-3 h-3" /> Rejected
                          </span>
                        )}

                        {(() => {
                          const daysLeft = getDaysUntilExpiration(req.created_at);
                          if (daysLeft <= 10) {
                            return (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-orange-50 text-orange-700 ring-1 ring-orange-200 mt-1">
                                <AlertCircle className="w-3 h-3" />
                                {daysLeft === 0 ? 'Expires today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
                              </span>
                            );
                          }
                          return (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-gray-50 text-gray-500 ring-1 ring-gray-200 mt-1">
                              <Clock className="w-3 h-3" />
                              {daysLeft} days left
                            </span>
                          );
                        })()}
                      </div>
                    </td>
                    {activeTab === 'pending' && (
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleApprove(req)}
                            disabled={processingId === req.id || (req.materials?.stocks ?? 0) < req.quantity}
                            className={`flex items-center justify-center w-8 h-8 rounded-full transition-all ${(req.materials?.stocks ?? 0) < req.quantity
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                              }`}
                            title={(req.materials?.stocks ?? 0) < req.quantity ? 'Insufficient Stock' : 'Approve'}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleReject(req.id)}
                            disabled={processingId === req.id}
                            className="flex items-center justify-center w-8 h-8 bg-red-50 text-red-600 rounded-full hover:bg-red-100 transition-all"
                            title="Reject"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
