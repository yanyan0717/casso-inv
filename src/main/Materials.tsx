import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, Settings2, Trash, BookOpen, X, Save, Camera, Plus, ArrowUp, ArrowDown, ChevronsUpDown, Minus, FileDown, Palette, Ruler, Tag, Calendar, TrendingUp, TrendingDown, BarChart3, AlertTriangle } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { collection, query, orderBy, getDocs, doc, deleteDoc, addDoc, updateDoc, where } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { showToast } from '../components/Toast';
import { TableSkeleton } from '../components/SkeletonLoader';

interface Material {
  id: string;
  material_id: string;
  name: string;
  category: string;
  unit: string;
  stocks: number;
  description: string;
  picture: string | null;
  added_by: string | null;
  profiles?: any;
  color?: string;
  size?: string;
  variant?: string;
  low_stock_threshold?: number;
}

interface MaterialLog {
  id: string;
  material_id: string;
  material_name: string;
  action_type: string;
  quantity: number;
  reason: string;
  user_id: string;
  created_at: string;
}

// Color options for materials
const COLOR_OPTIONS = [
  { value: 'Red', label: '🔴 Red', bgClass: 'bg-red-100', textClass: 'text-red-700', borderClass: 'border-red-300' },
  { value: 'Blue', label: '🔵 Blue', bgClass: 'bg-blue-100', textClass: 'text-blue-700', borderClass: 'border-blue-300' },
  { value: 'Green', label: '🟢 Green', bgClass: 'bg-green-100', textClass: 'text-green-700', borderClass: 'border-green-300' },
  { value: 'Yellow', label: '🟡 Yellow', bgClass: 'bg-yellow-100', textClass: 'text-yellow-700', borderClass: 'border-yellow-300' },
  { value: 'Black', label: '⚫ Black', bgClass: 'bg-gray-100', textClass: 'text-gray-700', borderClass: 'border-gray-300' },
  { value: 'White', label: '⚪ White', bgClass: 'bg-gray-50', textClass: 'text-gray-600', borderClass: 'border-gray-200' },
  { value: 'Purple', label: '🟣 Purple', bgClass: 'bg-purple-100', textClass: 'text-purple-700', borderClass: 'border-purple-300' },
  { value: 'Orange', label: '🟠 Orange', bgClass: 'bg-orange-100', textClass: 'text-orange-700', borderClass: 'border-orange-300' },
  { value: 'Pink', label: '🌸 Pink', bgClass: 'bg-pink-100', textClass: 'text-pink-700', borderClass: 'border-pink-300' },
  { value: 'Brown', label: '🟤 Brown', bgClass: 'bg-amber-100', textClass: 'text-amber-700', borderClass: 'border-amber-300' },
];

// Size options
const SIZE_OPTIONS = [
  'Small (S)',
  'Medium (M)',
  'Large (L)',
  'Extra Large (XL)',
  'XXL',
  'One Size',
  'Custom'
];

export default function Materials() {
  const location = useLocation();
  const [highlightItemId, setHighlightItemId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'view'>('add');
  const [saving, setSaving] = useState(false);

  // Delete Confirmation State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // Deduction Modal State
  const [showDeductModal, setShowDeductModal] = useState(false);
  const [deductSearch, setDeductSearch] = useState('');
  const [selectedDeductItem, setSelectedDeductItem] = useState<Material | null>(null);
  const [deductQty, setDeductQty] = useState('');
  const [deductReason, setDeductReason] = useState('');
  const [deducting, setDeducting] = useState(false);

  // Monthly Report Modal State
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportMonth, setReportMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [reportData, setReportData] = useState<{
    additions: MaterialLog[];
    deductions: MaterialLog[];
    summary: {
      totalAdditions: number;
      totalDeductions: number;
      netChange: number;
      mostAdded: { name: string; quantity: number } | null;
      mostDeducted: { name: string; quantity: number } | null;
    };
  }>({
    additions: [],
    deductions: [],
    summary: {
      totalAdditions: 0,
      totalDeductions: 0,
      netChange: 0,
      mostAdded: null,
      mostDeducted: null,
    }
  });
  const [generatingReport, setGeneratingReport] = useState(false);

  const [formData, setFormData] = useState({
    id: '',
    material_id: '',
    name: '',
    category: '',
    unit: '',
    stocks: '',
    description: '',
    picture: '',
    color: '',
    size: '',
    variant: '',
    low_stock_threshold: '5',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMaterials = async () => {
    try {
      const q = query(collection(db, 'materials'), orderBy('material_id', 'asc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Material));
      setMaterials(data);
    } catch (error) {
      console.error('Error fetching materials:', error);
      showToast('Failed to load materials', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isModalOpen]);

  const handleDelete = async (id: string) => {
    setItemToDelete(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;

    const materialToDelete = materials.find(m => m.id === itemToDelete);
    const user = auth.currentUser;

    try {
      await deleteDoc(doc(db, 'materials', itemToDelete));
      
      if (user && materialToDelete) {
        await addDoc(collection(db, 'material_logs'), {
          material_id: materialToDelete.id,
          material_name: materialToDelete.name,
          action_type: 'DELETE',
          quantity: materialToDelete.stocks,
          reason: 'Material deleted',
          user_id: user.uid,
          created_at: new Date().toISOString()
        });
      }
      showToast('Material deleted successfully', 'success');
      await fetchMaterials();
    } catch (error) {
      console.error('Error deleting material:', error);
      showToast('Failed to delete material', 'error');
    }

    setShowDeleteConfirm(false);
    setItemToDelete(null);
  };

  const handleDeduct = async () => {
    if (!selectedDeductItem || !deductQty || parseInt(deductQty) <= 0) {
      showToast('Please select an item and enter a valid quantity', 'error');
      return;
    }

    const qty = parseInt(deductQty);
    if (qty > selectedDeductItem.stocks) {
      showToast('Cannot deduct more than available stock', 'error');
      return;
    }

    setDeducting(true);
    const oldStock = selectedDeductItem.stocks;
    const newStock = oldStock - qty;

    const user = auth.currentUser;

    try {
      await updateDoc(doc(db, 'materials', selectedDeductItem.id), { stocks: newStock });
      
      await addDoc(collection(db, 'material_logs'), {
        material_id: selectedDeductItem.id,
        material_name: selectedDeductItem.name,
        action_type: 'deduction',
        quantity: qty,
        reason: deductReason || 'No reason provided',
        user_id: user?.uid || null,
        created_at: new Date().toISOString()
      });

      showToast(`Deducted ${qty} ${selectedDeductItem.unit} from ${selectedDeductItem.name}`, 'success');
      
      setShowDeductModal(false);
      setSelectedDeductItem(null);
      setDeductQty('');
      setDeductReason('');
      setDeductSearch('');
      await fetchMaterials();
    } catch (error: any) {
      console.error('Error during deduction:', error);
      showToast(`Error: ${error.message}`, 'error');
    } finally {
      setDeducting(false);
    }
  };

  const openDeductModal = () => {
    setShowDeductModal(true);
    setDeductSearch('');
    setSelectedDeductItem(null);
    setDeductQty('');
    setDeductReason('');
  };

  const closeDeductModal = () => {
    setShowDeductModal(false);
    setSelectedDeductItem(null);
    setDeductQty('');
    setDeductReason('');
    setDeductSearch('');
  };

  const filteredDeductItems = materials.filter((mat) =>
    deductSearch === '' || (
      mat.name.toLowerCase().includes(deductSearch.toLowerCase()) ||
      mat.category.toLowerCase().includes(deductSearch.toLowerCase()) ||
      (mat.material_id && mat.material_id.toLowerCase().includes(deductSearch.toLowerCase()))
    )
  );

  // Generate Monthly Report
  const generateMonthlyReport = async () => {
    setGeneratingReport(true);
    try {
      const [year, month] = reportMonth.split('-');
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
      
      const logsRef = collection(db, 'material_logs');
      const q = query(
        logsRef,
        where('created_at', '>=', startDate.toISOString()),
        where('created_at', '<=', endDate.toISOString())
      );
      
      const snapshot = await getDocs(q);
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MaterialLog));
      
      const additions = logs.filter(log => log.action_type === 'ADD' || log.action_type === 'add');
      const deductions = logs.filter(log => log.action_type === 'deduction');
      
      const totalAdditions = additions.reduce((sum, log) => sum + (log.quantity || 0), 0);
      const totalDeductions = deductions.reduce((sum, log) => sum + (log.quantity || 0), 0);
      
      // Find most added and deducted items
      const addedMap = new Map<string, number>();
      additions.forEach(log => {
        const current = addedMap.get(log.material_name) || 0;
        addedMap.set(log.material_name, current + (log.quantity || 0));
      });
      
      const deductedMap = new Map<string, number>();
      deductions.forEach(log => {
        const current = deductedMap.get(log.material_name) || 0;
        deductedMap.set(log.material_name, current + (log.quantity || 0));
      });
      
      let mostAdded: { name: string; quantity: number } | null = null;
      let mostDeducted: { name: string; quantity: number } | null = null;
      
      for (const [name, qty] of addedMap.entries()) {
        if (!mostAdded || qty > mostAdded.quantity) {
          mostAdded = { name, quantity: qty };
        }
      }
      
      for (const [name, qty] of deductedMap.entries()) {
        if (!mostDeducted || qty > mostDeducted.quantity) {
          mostDeducted = { name, quantity: qty };
        }
      }
      
      setReportData({
        additions,
        deductions,
        summary: {
          totalAdditions,
          totalDeductions,
          netChange: totalAdditions - totalDeductions,
          mostAdded,
          mostDeducted,
        }
      });
      
      setShowReportModal(true);
    } catch (error) {
      console.error('Error generating report:', error);
      showToast('Failed to generate report', 'error');
    } finally {
      setGeneratingReport(false);
    }
  };
  
  // Export Monthly Report to PDF
  const exportMonthlyReportPDF = () => {
    const doc = new jsPDF();
    const [year, month] = reportMonth.split('-');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = monthNames[parseInt(month) - 1];
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(22, 101, 52);
    doc.text('Monthly Inventory Report', 14, 22);
    
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`${monthName} ${year}`, 14, 32);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 40);
    
    // Summary Section
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Summary', 14, 55);
    
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text(`Total Additions: ${reportData.summary.totalAdditions} items`, 14, 65);
    doc.text(`Total Deductions: ${reportData.summary.totalDeductions} items`, 14, 73);
    doc.text(`Net Change: ${reportData.summary.netChange} items`, 14, 81);
    
    if (reportData.summary.mostAdded) {
      doc.text(`Most Added: ${reportData.summary.mostAdded.name} (${reportData.summary.mostAdded.quantity} items)`, 14, 89);
    }
    if (reportData.summary.mostDeducted) {
      doc.text(`Most Deducted: ${reportData.summary.mostDeducted.name} (${reportData.summary.mostDeducted.quantity} items)`, 14, 97);
    }
    
    // Additions Table
    let yOffset = 110;
    if (reportData.additions.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(22, 101, 52);
      doc.text('Additions', 14, yOffset);
      yOffset += 5;
      
      const additionsData = reportData.additions.map(log => [
        new Date(log.created_at).toLocaleDateString(),
        log.material_name,
        log.quantity.toString(),
        log.reason || '-'
      ]);
      
      autoTable(doc, {
        startY: yOffset,
        head: [['Date', 'Material', 'Quantity', 'Reason']],
        body: additionsData,
        headStyles: {
          fillColor: [34, 197, 94],
          textColor: [255, 255, 255],
          fontSize: 9,
        },
        styles: {
          fontSize: 8,
          cellPadding: 2,
        },
      });
      yOffset = (doc as any).lastAutoTable.finalY + 10;
    }
    
    // Deductions Table
    if (reportData.deductions.length > 0) {
      doc.addPage();
      doc.setFontSize(12);
      doc.setTextColor(220, 38, 38);
      doc.text('Deductions', 14, 20);
      
      const deductionsData = reportData.deductions.map(log => [
        new Date(log.created_at).toLocaleDateString(),
        log.material_name,
        log.quantity.toString(),
        log.reason || '-'
      ]);
      
      autoTable(doc, {
        startY: 30,
        head: [['Date', 'Material', 'Quantity', 'Reason']],
        body: deductionsData,
        headStyles: {
          fillColor: [239, 68, 68],
          textColor: [255, 255, 255],
          fontSize: 9,
        },
        styles: {
          fontSize: 8,
          cellPadding: 2,
        },
      });
    }
    
    doc.save(`Monthly_Report_${monthName}_${year}.pdf`);
    showToast('Monthly report exported successfully', 'success');
  };

  const openModal = (mode: 'add' | 'edit' | 'view', material?: Material) => {
    setModalMode(mode);
    if (material) {
      setFormData({
        id: material.id,
        material_id: material.material_id || '',
        name: material.name,
        category: material.category,
        unit: material.unit || '',
        stocks: material.stocks.toString(),
        description: material.description || '',
        picture: material.picture || '',
        color: material.color || '',
        size: material.size || '',
        variant: material.variant || '',
        low_stock_threshold: material.low_stock_threshold?.toString() || '5',
      });
    } else {
      let nextIdStr = '';
      if (materials.length > 0) {
        let maxNum = 0;
        let prefix = '';
        let padLength = 3;

        materials.forEach(m => {
          if (!m.material_id) return;
          const match = m.material_id.match(/^(.*?)(\d+)$/);
          if (match) {
            const numStr = match[2];
            const num = parseInt(numStr, 10);
            if (num >= maxNum) {
              maxNum = num;
              prefix = match[1];
              padLength = Math.max(padLength, numStr.length);
            }
          }
        });

        if (maxNum > 0) {
          nextIdStr = `${prefix}${String(maxNum + 1).padStart(padLength, '0')}`;
        } else {
          nextIdStr = materials.length > 0
            ? String(materials.length + 1).padStart(3, '0')
            : '001';
        }
      } else {
        nextIdStr = '001';
      }

      setFormData({ 
        id: '', 
        material_id: nextIdStr, 
        name: '', 
        category: '', 
        unit: '', 
        stocks: '', 
        description: '', 
        picture: '',
        color: '',
        size: '',
        variant: '',
        low_stock_threshold: '5',
      });
    }
    setIsModalOpen(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, picture: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const normalizeItemName = (name: string) => name.replace(/[^a-z0-9]/gi, '').toLowerCase();
  const sortedItemName = (name: string) => normalizeItemName(name).split('').sort().join('');
  const isDuplicateItemName = (name: string, excludeId?: string) => {
    const normalized = normalizeItemName(name);
    const sorted = sortedItemName(name);
    return materials.some((mat) => {
      if (excludeId && mat.id === excludeId) return false;
      const matNormalized = normalizeItemName(mat.name);
      if (!matNormalized) return false;
      if (matNormalized === normalized) return true;
      return sortedItemName(mat.name) === sorted;
    });
  };

  const closeModal = () => setIsModalOpen(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modalMode === 'view') {
      closeModal();
      return;
    }

    if (!formData.name || !formData.category) {
      showToast('Please fill in required fields', 'error');
      return;
    }

    if (isDuplicateItemName(formData.name, modalMode === 'edit' ? formData.id : undefined)) {
      showToast('Item name already exists or uses the same letters as another item.', 'error');
      return;
    }

    setSaving(true);
    const user = auth.currentUser;
    const newStock = parseInt(formData.stocks) || 0;

    const materialData: any = {
      material_id: formData.material_id,
      name: formData.name,
      category: formData.category,
      unit: formData.unit,
      stocks: newStock,
      description: formData.description,
      picture: formData.picture || null,
      color: formData.color || null,
      size: formData.size || null,
      variant: formData.variant || null,
      low_stock_threshold: parseInt(formData.low_stock_threshold) || 5,
    };

    if (modalMode === 'add' && user) {
      materialData.created_by = user.uid;
      materialData.added_by = user.email;
    }

    try {
      if (modalMode === 'edit') {
        await updateDoc(doc(db, 'materials', formData.id), materialData);
        showToast('Material updated successfully', 'success');
      } else {
        const docRef = await addDoc(collection(db, 'materials'), materialData);
        if (user) {
          await addDoc(collection(db, 'material_logs'), {
            material_id: docRef.id,
            material_name: materialData.name,
            action_type: 'ADD',
            quantity: materialData.stocks,
            reason: 'Material added to inventory',
            user_id: user.uid,
            created_at: new Date().toISOString()
          });
        }
        showToast('Material added successfully', 'success');
      }
      closeModal();
      await fetchMaterials();
    } catch (error: any) {
      console.error('Error saving material:', error);
      showToast(error.message || 'Failed to save material', 'error');
    } finally {
      setSaving(false);
    }
  };

  const getStatus = (stock: number, threshold?: number) => {
    const lowThreshold = threshold || 5;
    if (stock === 0) return { label: 'Out of Stock', class: 'bg-red-50 text-red-700 ring-red-600/10', dot: 'bg-red-600', text: 'text-red-600' };
    if (stock <= lowThreshold) return { label: 'Low Stock', class: 'bg-amber-50 text-amber-700 ring-amber-600/10', dot: 'bg-amber-600', text: 'text-amber-600' };
    return { label: 'In Stock', class: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10', dot: 'bg-emerald-600', text: 'text-emerald-600' };
  };

  // Helper function to extract numeric value from material_id for sorting
  const getNumericId = (materialId: string): number => {
    if (!materialId) return 0;
    const match = materialId.match(/(\d+)/);
    return match ? parseInt(match[0], 10) : 0;
  };

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        if (prev.direction === 'asc') {
          return { key, direction: 'desc' };
        }
        return null;
      }
      return { key, direction: 'asc' };
    });
  };

  const filteredMaterials = materials.filter((mat) =>
    mat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    mat.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (mat.material_id && mat.material_id.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Sort materials with proper numeric sorting for material_id
  const sortedMaterials = [...filteredMaterials].sort((a, b) => {
    if (!sortConfig) {
      // Default: sort by material_id numerically (ascending)
      const numA = getNumericId(a.material_id);
      const numB = getNumericId(b.material_id);
      return numA - numB;
    }

    const { key, direction } = sortConfig;
    const multiplier = direction === 'asc' ? 1 : -1;

    // Special handling for material_id - sort numerically
    if (key === 'material_id') {
      const numA = getNumericId(a.material_id);
      const numB = getNumericId(b.material_id);
      return (numA - numB) * multiplier;
    }

    // Special handling for stocks - sort numerically
    if (key === 'stocks') {
      return (a.stocks - b.stocks) * multiplier;
    }

    // Default string sorting for other fields
    const aVal = a[key as keyof Material]?.toString().toLowerCase() || '';
    const bVal = b[key as keyof Material]?.toString().toLowerCase() || '';
    
    if (aVal < bVal) return -1 * multiplier;
    if (aVal > bVal) return 1 * multiplier;
    return 0;
  });

  const totalPages = Math.ceil(sortedMaterials.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedMaterials = sortedMaterials.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    if (location.state?.highlightItemId && sortedMaterials.length > 0) {
      const targetId = location.state.highlightItemId;
      setHighlightItemId(targetId);
      
      const itemIndex = sortedMaterials.findIndex(m => m.id === targetId || m.material_id === targetId);
      if (itemIndex !== -1) {
         const targetPage = Math.floor(itemIndex / itemsPerPage) + 1;
         setCurrentPage(targetPage);
      }
      
      const timer = setTimeout(() => {
        setHighlightItemId(null);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [location.state?.highlightItemId, sortedMaterials.length]);

  // Get color class for display
  const getColorDisplay = (color: string) => {
    const colorOption = COLOR_OPTIONS.find(c => c.value === color);
    if (colorOption) {
      return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${colorOption.bgClass} ${colorOption.textClass}`}>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color.toLowerCase() }}></span>
          {color}
        </span>
      );
    }
    return color ? <span className="text-xs text-gray-500">{color}</span> : null;
  };

  const exportToPDF = () => {
    const doc = new jsPDF();

    // Header section
    doc.setFontSize(18);
    doc.setTextColor(22, 101, 52);
    doc.text('Inventory CASSO System', 14, 22);

    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text(`Materials Inventory Report - Generated on ${new Date().toLocaleDateString()}`, 14, 30);

    // Sort numerically for PDF export as well
    const sortedForPDF = [...filteredMaterials].sort((a, b) => {
      const numA = getNumericId(a.material_id);
      const numB = getNumericId(b.material_id);
      return numA - numB;
    });

    const tableData = sortedForPDF.map(mat => [
      mat.material_id || 'N/A',
      mat.name,
      mat.category,
      mat.unit || '-',
      mat.stocks.toString(),
      getStatus(mat.stocks, mat.low_stock_threshold).label,
      mat.color || '-',
      mat.size || '-',
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Item ID', 'Name', 'Category', 'Unit', 'Stock', 'Status', 'Color', 'Size']],
      body: tableData,
      headStyles: {
        fillColor: [22, 101, 52],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
        valign: 'middle'
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { top: 40 }
    });

    doc.save(`Materials_Report_${new Date().getTime()}.pdf`);
    showToast('PDF Exported Successfully', 'success');
  };

  return (
    <div className="flex flex-col space-y-4 relative w-full max-w-full pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 font-[var(--heading)] tracking-tight">Materials</h2>
          <p className="text-sm text-gray-600 mt-1 font-medium">Manage and track your supplies efficiently.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <div className="relative flex-1 sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-3.5 w-3.5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-[#166534]/10 focus:border-[#166534] transition-all outline-none"
            />
          </div>
          
          <button
            onClick={() => openModal('add')}
            className="flex items-center gap-2 text-sm font-semibold cursor-pointer text-white bg-[#166534] px-5 py-1.5 rounded-md hover:bg-[#14532d] transition-all active:scale-95 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </button>
          <button
            onClick={openDeductModal}
            className="flex items-center gap-2 text-sm font-semibold cursor-pointer text-white bg-red-600 px-5 py-1.5 rounded-md hover:bg-red-700 transition-all active:scale-95 shadow-sm"
          >
            <Minus className="w-4 h-4" />
            Deduct
          </button>
          <button
            onClick={generateMonthlyReport}
            disabled={generatingReport}
            className="flex items-center gap-2 text-sm font-semibold cursor-pointer text-white bg-purple-600 px-5 py-1.5 rounded-md hover:bg-purple-700 transition-all active:scale-95 shadow-sm"
          >
            <Calendar className="w-4 h-4" />
            {generatingReport ? 'Loading...' : 'Monthly Report'}
          </button>
          <button
            onClick={exportToPDF}
            className="flex items-center gap-2 text-sm font-semibold cursor-pointer text-gray-700 bg-white border border-gray-200 px-5 py-1.5 rounded-md hover:bg-gray-50 transition-all active:scale-95 shadow-sm"
          >
            <FileDown className="w-4 h-4" />
            PDF
          </button>
        </div>
      </div>

      <div className="bg-white rounded-md shadow-sm border border-gray-200 mt-4 overflow-hidden">
        {/* Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <TableSkeleton rows={10} cols={10} />
          ) : filteredMaterials.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-300" />
              </div>
              <p className="font-medium text-gray-500 text-base">No materials found.</p>
              <p className="text-sm mt-1">Try a different search term or add a new one.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-gray-200">
                  <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider cursor-pointer select-none group" onClick={() => handleSort('material_id')}>
                    <span className="flex items-center gap-1">
                      Item ID
                      {sortConfig?.key === 'material_id' ? (
                        sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-orange-500" /> : <ArrowDown className="w-3 h-3 text-orange-500" />
                      ) : (
                        <ChevronsUpDown className="w-3 h-3 text-gray-300 group-hover:text-gray-400 transition-colors" />
                      )}
                    </span>
                  </th>
                  <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider">Picture</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider">Color/Size</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider">Unit</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider">Added By</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider text-right cursor-pointer select-none group" onClick={() => handleSort('stocks')}>
                    <span className="flex items-center justify-end gap-1">
                      Stock
                      {sortConfig?.key === 'stocks' ? (
                        sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-orange-500" /> : <ArrowDown className="w-3 h-3 text-orange-500" />
                      ) : (
                        <ChevronsUpDown className="w-3 h-3 text-gray-300 group-hover:text-gray-400 transition-colors" />
                      )}
                    </span>
                  </th>
                  <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      Status
                    </span>
                  </th>
                  <th className="px-6 py-3 text-[11px] font-bold text-[#166534] uppercase tracking-wider text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-gray-50">
                {paginatedMaterials.map((mat, index) => {
                  const status = getStatus(mat.stocks, mat.low_stock_threshold);
                  const isHighlighted = mat.id === highlightItemId || mat.material_id === highlightItemId;
                  return (
                    <tr 
                      key={mat.id} 
                      className={`transition-all duration-500 group border-b border-slate-100 last:border-0 ${isHighlighted ? 'bg-yellow-200 hover:bg-yellow-300' : (index % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-gray-50 hover:bg-slate-50')}`}
                    >
                      <td className="px-6 py-1.5 font-mono text-[10px] text-slate-800 font-bold tracking-tight">
                        {mat.material_id || 'N/A'}
                      </td>
                      <td className="px-6 py-1.5">
                        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200 shadow-sm">
                          {mat.picture ? (
                            <img src={mat.picture} alt={mat.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-slate-400 text-[10px] font-bold">N/A</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-1.5">
                        <div>
                          <p className="text-slate-800 text-sm font-medium">{mat.name}</p>
                          {mat.variant && (
                            <p className="text-[10px] text-gray-400 mt-0.5">{mat.variant}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-1.5 text-slate-800 text-sm">{mat.category}</td>
                      <td className="px-6 py-1.5">
                        <div className="flex flex-col gap-1">
                          {mat.color && getColorDisplay(mat.color)}
                          {mat.size && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
                              <Ruler className="w-2.5 h-2.5" />
                              {mat.size}
                            </span>
                          )}
                          {!mat.color && !mat.size && (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-1.5 text-slate-800 text-sm">{mat.unit || '-'}</td>
                      <td className="px-6 py-1.5 text-slate-800 text-sm">
                        {Array.isArray(mat.profiles)
                          ? (mat.profiles[0]?.full_name || mat.added_by || '-')
                          : (mat.profiles?.full_name || mat.added_by || '-')}
                      </td>
                      <td className="px-6 py-1.5 text-right">
                        <span className={`text-sm tracking-tight ${status.text}`}>{mat.stocks}</span>
                      </td>
                      <td className="px-6 py-1.5">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ring-1 ring-inset ${status.class}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${status.dot} animate-pulse`}></span>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-1.5">
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            onClick={() => openModal('view', mat)}
                            title="View Details"
                            className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                          >
                            <BookOpen className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openModal('edit', mat)}
                            title="Edit Item"
                            className="p-1.5 text-amber-500 hover:bg-amber-50 rounded-lg transition-all cursor-pointer"
                          >
                            <Settings2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(mat.id)}
                            title="Delete Item"
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-white">
            <div className="text-sm text-gray-500">
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, sortedMaterials.length)} of {sortedMaterials.length} entries
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${currentPage === page
                    ? 'bg-[#166534] text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Monthly Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-md shadow-xl overflow-hidden relative border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0">
              <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-600" />
                Monthly Inventory Report
              </h3>
              <button
                onClick={() => setShowReportModal(false)}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {/* Month Selector */}
              <div className="mb-6 flex items-center gap-4">
                <label className="text-sm font-semibold text-gray-700">Select Month:</label>
                <input
                  type="month"
                  value={reportMonth}
                  onChange={(e) => setReportMonth(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
                <button
                  onClick={generateMonthlyReport}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-semibold hover:bg-purple-700 transition-all"
                >
                  Refresh Report
                </button>
                <button
                  onClick={exportMonthlyReportPDF}
                  className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-semibold hover:bg-green-700 transition-all flex items-center gap-2"
                >
                  <FileDown className="w-4 h-4" />
                  Export PDF
                </button>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <div className="flex items-center gap-2 text-green-600 mb-2">
                    <TrendingUp className="w-5 h-5" />
                    <span className="text-xs font-bold uppercase tracking-wider">Total Additions</span>
                  </div>
                  <p className="text-2xl font-bold text-green-700">{reportData.summary.totalAdditions}</p>
                  <p className="text-xs text-green-600 mt-1">items added this month</p>
                </div>
                
                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <div className="flex items-center gap-2 text-red-600 mb-2">
                    <TrendingDown className="w-5 h-5" />
                    <span className="text-xs font-bold uppercase tracking-wider">Total Deductions</span>
                  </div>
                  <p className="text-2xl font-bold text-red-700">{reportData.summary.totalDeductions}</p>
                  <p className="text-xs text-red-600 mt-1">items deducted this month</p>
                </div>
                
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center gap-2 text-blue-600 mb-2">
                    <BarChart3 className="w-5 h-5" />
                    <span className="text-xs font-bold uppercase tracking-wider">Net Change</span>
                  </div>
                  <p className={`text-2xl font-bold ${reportData.summary.netChange >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {reportData.summary.netChange >= 0 ? '+' : ''}{reportData.summary.netChange}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">overall inventory change</p>
                </div>
                
                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                  <div className="flex items-center gap-2 text-purple-600 mb-2">
                    <Calendar className="w-5 h-5" />
                    <span className="text-xs font-bold uppercase tracking-wider">Period</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-700">
                    {new Date(reportMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>

              {/* Most Active Items */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                {reportData.summary.mostAdded && (
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <p className="text-xs font-bold text-green-600 uppercase tracking-wider mb-2">🏆 Most Added Item</p>
                    <p className="font-semibold text-gray-800">{reportData.summary.mostAdded.name}</p>
                    <p className="text-sm text-green-600">+{reportData.summary.mostAdded.quantity} items</p>
                  </div>
                )}
                {reportData.summary.mostDeducted && (
                  <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                    <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2">⚠️ Most Deducted Item</p>
                    <p className="font-semibold text-gray-800">{reportData.summary.mostDeducted.name}</p>
                    <p className="text-sm text-red-600">-{reportData.summary.mostDeducted.quantity} items</p>
                  </div>
                )}
              </div>

              {/* Additions Table */}
              {reportData.additions.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-bold text-green-600 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Additions ({reportData.additions.length} records)
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-green-50">
                          <th className="px-4 py-2 text-left text-xs font-bold text-green-700">Date</th>
                          <th className="px-4 py-2 text-left text-xs font-bold text-green-700">Material</th>
                          <th className="px-4 py-2 text-right text-xs font-bold text-green-700">Quantity</th>
                          <th className="px-4 py-2 text-left text-xs font-bold text-green-700">Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.additions.map((log, idx) => (
                          <tr key={log.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-2 text-gray-600">{new Date(log.created_at).toLocaleDateString()}</td>
                            <td className="px-4 py-2 font-medium text-gray-800">{log.material_name}</td>
                            <td className="px-4 py-2 text-right text-green-600 font-semibold">+{log.quantity}</td>
                            <td className="px-4 py-2 text-gray-500 text-xs">{log.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Deductions Table */}
              {reportData.deductions.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-red-600 mb-3 flex items-center gap-2">
                    <TrendingDown className="w-4 h-4" />
                    Deductions ({reportData.deductions.length} records)
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-red-50">
                          <th className="px-4 py-2 text-left text-xs font-bold text-red-700">Date</th>
                          <th className="px-4 py-2 text-left text-xs font-bold text-red-700">Material</th>
                          <th className="px-4 py-2 text-right text-xs font-bold text-red-700">Quantity</th>
                          <th className="px-4 py-2 text-left text-xs font-bold text-red-700">Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.deductions.map((log, idx) => (
                          <tr key={log.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-2 text-gray-600">{new Date(log.created_at).toLocaleDateString()}</td>
                            <td className="px-4 py-2 font-medium text-gray-800">{log.material_name}</td>
                            <td className="px-4 py-2 text-right text-red-600 font-semibold">-{log.quantity}</td>
                            <td className="px-4 py-2 text-gray-500 text-xs">{log.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {reportData.additions.length === 0 && reportData.deductions.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No transactions found for this period</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit/View Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-2xl rounded-md shadow-xl overflow-hidden relative border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
              <h3 className="font-bold text-gray-800 text-base">
                {modalMode === 'add' ? 'Add Material' : modalMode === 'edit' ? 'Edit Material' : 'View Material'}
              </h3>
              <button
                onClick={closeModal}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 max-h-[80vh] overflow-y-auto">
              <div className="flex flex-col sm:flex-row gap-6">
                <div className="flex flex-col items-center shrink-0">
                  <div className="relative">
                    <div className="w-28 h-28 rounded-md bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200">
                      {formData.picture ? (
                        <img src={formData.picture} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        modalMode === 'view' ? <span className="text-gray-400 text-[10px] font-bold">N/A</span> : <Camera className="w-8 h-8 text-gray-300" />
                      )}
                    </div>
                    {modalMode !== 'view' && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute -bottom-2 -right-2 w-8 h-8 bg-[#166534] text-white rounded-full flex items-center justify-center shadow-md hover:bg-[#14532d] z-10"
                      >
                        <Camera className="w-4 h-4" />
                      </button>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                </div>

                <div className="flex-1 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Material ID</label>
                      <input
                        type="text"
                        value={formData.material_id}
                        onChange={(e) => setFormData({ ...formData, material_id: e.target.value })}
                        disabled={modalMode === 'view'}
                        className="w-full px-3 py-2 rounded-md border border-gray-200 bg-gray-50/30 text-black text-sm focus:ring-2 focus:ring-[#166534]/10 focus:border-[#166534] transition-all outline-none disabled:opacity-70 disabled:bg-gray-100 font-medium"
                        placeholder="e.g. 001"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Item Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        disabled={modalMode === 'view'}
                        className="w-full px-3 py-2 rounded-md border border-gray-200 bg-gray-50/30 text-black text-sm focus:ring-2 focus:ring-[#166534]/10 focus:border-[#166534] transition-all outline-none disabled:opacity-70 disabled:bg-gray-100 font-medium"
                        placeholder="e.g. Printer Paper"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Category</label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        disabled={modalMode === 'view'}
                        className="w-full px-3 py-2 rounded-md border border-gray-200 bg-gray-50/30 text-black text-sm focus:ring-2 focus:ring-[#166534]/10 focus:border-[#166534] transition-all outline-none disabled:opacity-70 disabled:bg-gray-100 font-medium"
                        required
                      >
                        <option value="">Select...</option>
                        <option value="furniture">Furniture</option>
                        <option value="electronics">Electronics</option>
                        <option value="supplies">Supplies</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Unit</label>
                      <select
                        value={formData.unit}
                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                        disabled={modalMode === 'view'}
                        className="w-full px-3 py-2 rounded-md border border-gray-200 bg-gray-50/30 text-black text-sm focus:ring-2 focus:ring-[#166534]/10 focus:border-[#166534] transition-all outline-none disabled:opacity-70 disabled:bg-gray-100 font-medium"
                        required
                      >
                        <option value="">Select...</option>
                        <option value="pcs">pcs</option>
                        <option value="box">box</option>
                        <option value="bottle">bottle</option>
                        <option value="gallon">gallon</option>
                        <option value="rolls">rolls</option>
                        <option value="pack">pack</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Stock Qty</label>
                      <input
                        type="number"
                        value={formData.stocks}
                        onChange={(e) => setFormData({ ...formData, stocks: e.target.value })}
                        disabled={modalMode === 'view'}
                        className="w-full px-3 py-2 rounded-md border border-gray-200 bg-gray-50/30 text-black text-sm focus:ring-2 focus:ring-[#166534]/10 focus:border-[#166534] transition-all outline-none disabled:opacity-70 disabled:bg-gray-100 font-bold"
                        placeholder="0"
                        min="0"
                      />
                    </div>
                  </div>

                  {/* Low Stock Threshold */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Low Stock Threshold
                    </label>
                    <input
                      type="number"
                      value={formData.low_stock_threshold}
                      onChange={(e) => setFormData({ ...formData, low_stock_threshold: e.target.value })}
                      disabled={modalMode === 'view'}
                      className="w-full px-3 py-2 rounded-md border border-gray-200 bg-gray-50/30 text-black text-sm focus:ring-2 focus:ring-[#166534]/10 focus:border-[#166534] transition-all outline-none disabled:opacity-70 disabled:bg-gray-100 font-medium"
                      placeholder="5"
                      min="0"
                    />
                    <p className="text-[10px] text-gray-400">You'll be notified when stock falls below this number</p>
                  </div>

                  {/* Color and Size Section */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                        <Palette className="w-3 h-3" />
                        Color
                      </label>
                      <input
                        list="color-options"
                        type="text"
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        disabled={modalMode === 'view'}
                        className="w-full px-3 py-2 rounded-md border border-gray-200 bg-gray-50/30 text-black text-sm focus:ring-2 focus:ring-[#166534]/10 focus:border-[#166534] transition-all outline-none disabled:opacity-70 disabled:bg-gray-100 font-medium"
                        placeholder="Select or type a color..."
                      />
                      <datalist id="color-options">
                        {COLOR_OPTIONS.map(color => (
                          <option key={color.value} value={color.value}>{color.label}</option>
                        ))}
                      </datalist>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                        <Ruler className="w-3 h-3" />
                        Size
                      </label>
                      <input
                        list="size-options"
                        type="text"
                        value={formData.size}
                        onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                        disabled={modalMode === 'view'}
                        className="w-full px-3 py-2 rounded-md border border-gray-200 bg-gray-50/30 text-black text-sm focus:ring-2 focus:ring-[#166534]/10 focus:border-[#166534] transition-all outline-none disabled:opacity-70 disabled:bg-gray-100 font-medium"
                        placeholder="Select or type a size..."
                      />
                      <datalist id="size-options">
                        {SIZE_OPTIONS.map(size => (
                          <option key={size} value={size}>{size}</option>
                        ))}
                      </datalist>
                    </div>
                  </div>

                  {/* Variant/Additional Info */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      Variant / Additional Info
                    </label>
                    <input
                      type="text"
                      value={formData.variant}
                      onChange={(e) => setFormData({ ...formData, variant: e.target.value })}
                      disabled={modalMode === 'view'}
                      className="w-full px-3 py-2 rounded-md border border-gray-200 bg-gray-50/30 text-black text-sm focus:ring-2 focus:ring-[#166534]/10 focus:border-[#166534] transition-all outline-none disabled:opacity-70 disabled:bg-gray-100 font-medium"
                      placeholder="e.g. Premium quality, Waterproof, etc."
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      disabled={modalMode === 'view'}
                      rows={2}
                      className="w-full px-3 py-2 rounded-md border border-gray-200 bg-gray-50/30 text-black text-sm focus:ring-2 focus:ring-[#166534]/10 focus:border-[#166534] transition-all outline-none resize-none disabled:opacity-70 disabled:bg-gray-100"
                      placeholder="Brief details..."
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6">
                {modalMode !== 'view' ? (
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full bg-[#166534] hover:bg-[#14532d] text-white py-3 rounded-md text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    <Save className="w-5 h-5" />
                    {saving ? 'Saving...' : 'Save Material'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={closeModal}
                    className="w-full bg-[#166534] hover:bg-[#14532d] text-white py-3 rounded-md text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    <X className="w-4 h-4" />
                    Close View
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-xs rounded-lg shadow-xl overflow-hidden relative border border-gray-200">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="font-bold text-gray-800 text-lg mb-2">Delete Material</h3>
              <p className="text-gray-500 text-sm">Are you sure you want to delete this material? This action cannot be undone.</p>
            </div>
            <div className="flex border-t border-gray-100">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setItemToDelete(null);
                }}
                className="flex-1 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors border-l border-gray-100"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deduction Modal */}
      {showDeductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-md shadow-xl overflow-hidden relative border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
              <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
                <Minus className="w-4 h-4 text-red-600" />
                Deduct Material
              </h3>
              <button
                onClick={closeDeductModal}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Search Material</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name, category, or ID..."
                    value={deductSearch}
                    onChange={(e) => {
                      setDeductSearch(e.target.value);
                      setSelectedDeductItem(null);
                    }}
                    className="w-full pl-9 pr-3 py-2 rounded-md border border-gray-200 bg-gray-50/30 text-black text-sm focus:ring-2 focus:ring-red-500/10 focus:border-red-500 transition-all outline-none font-medium"
                  />
                </div>
              </div>

              {!selectedDeductItem && (
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100">
                  {filteredDeductItems.length === 0 ? (
                    <div className="p-4 text-center text-gray-400 text-sm">No materials found</div>
                  ) : (
                    filteredDeductItems.map((mat) => (
                      <button
                        key={mat.id}
                        onClick={() => setSelectedDeductItem(mat)}
                        className="w-full px-4 py-3 text-left hover:bg-red-50 transition-colors flex items-center justify-between"
                      >
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{mat.name}</p>
                          <p className="text-xs text-gray-500">
                            {mat.category} · {mat.material_id || 'N/A'}
                            {mat.color && ` · ${mat.color}`}
                            {mat.size && ` · ${mat.size}`}
                          </p>
                        </div>
                        <span className="text-sm font-bold text-emerald-600">{mat.stocks} {mat.unit}</span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {selectedDeductItem && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-md p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-800">{selectedDeductItem.name}</p>
                      <p className="text-xs text-gray-500">
                        {selectedDeductItem.category} · {selectedDeductItem.material_id || 'N/A'}
                        {selectedDeductItem.color && ` · ${selectedDeductItem.color}`}
                        {selectedDeductItem.size && ` · ${selectedDeductItem.size}`}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedDeductItem(null)}
                      className="text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      Change
                    </button>
                  </div>
                  <div className="mt-3 pt-3 border-t border-emerald-200 flex items-center justify-between">
                    <span className="text-xs text-gray-500">Available Stock</span>
                    <span className="text-sm font-bold text-emerald-700">{selectedDeductItem.stocks} {selectedDeductItem.unit}</span>
                  </div>
                </div>
              )}

              {selectedDeductItem && (
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Quantity to Deduct</label>
                  <input
                    type="number"
                    placeholder="Enter quantity"
                    value={deductQty}
                    onChange={(e) => setDeductQty(e.target.value)}
                    min="1"
                    max={selectedDeductItem.stocks}
                    className="w-full px-3 py-2 rounded-md border border-gray-200 bg-gray-50/30 text-black text-sm focus:ring-2 focus:ring-red-500/10 focus:border-red-500 transition-all outline-none font-medium"
                  />
                  <p className="text-xs text-gray-400">
                    Max: {selectedDeductItem.stocks} {selectedDeductItem.unit}
                  </p>
                </div>
              )}

              {selectedDeductItem && (
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Reason (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g., Used for project, Damaged, Expired"
                    value={deductReason}
                    onChange={(e) => setDeductReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-gray-200 bg-gray-50/30 text-black text-sm focus:ring-2 focus:ring-red-500/10 focus:border-red-500 transition-all outline-none font-medium"
                  />
                </div>
              )}
            </div>

            <div className="px-6 pb-6">
              <button
                onClick={handleDeduct}
                disabled={!selectedDeductItem || !deductQty || parseInt(deductQty) <= 0 || deducting || (selectedDeductItem && parseInt(deductQty) > selectedDeductItem.stocks)}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-md text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <Minus className="w-4 h-4" />
                {deducting ? 'Deducting...' : 'Confirm Deduction'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}