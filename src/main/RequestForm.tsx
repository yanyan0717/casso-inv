import { useState, useEffect } from 'react';
import { Send, Package, Info, Search, FileText } from 'lucide-react';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { showToast } from '../components/Toast';

interface Material {
  id: string;
  name: string;
  stocks: number;
  unit: string;
}

export default function RequestForm() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [quantity, setQuantity] = useState('');
  const [purpose, setPurpose] = useState('');

  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'materials'));
        let data = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Material));
        
        // Filter out items with 0 stock and sort by name
        data = data.filter(m => m.stocks > 0).sort((a, b) => a.name.localeCompare(b.name));
        
        setMaterials(data);
      } catch (error) {
        console.error("Failed to fetch materials:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMaterials();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedMaterial || !quantity || !purpose) {
      showToast('Please fill out all fields completely.', 'error');
      return;
    }

    const qtyNumber = parseInt(quantity, 10);
    if (isNaN(qtyNumber) || qtyNumber <= 0) {
      showToast('Please enter a valid quantity.', 'error');
      return;
    }

    if (qtyNumber > selectedMaterial.stocks) {
      showToast('Requested quantity exceeds available stock.', 'error');
      return;
    }

    setSubmitting(true);
    
    // Get current user
    const user = auth.currentUser;

    if (!user) {
      showToast('You must be logged in to make a request.', 'error');
      setSubmitting(false);
      return;
    }

    try {
      await addDoc(collection(db, 'requests'), {
        user_id: user.uid,
        material_id: selectedMaterial.id,
        quantity: qtyNumber,
        purpose,
        status: 'pending',
        created_at: new Date().toISOString()
      });
      
      showToast('Request submitted successfully and is pending approval.', 'success');
      // Reset form
      setSelectedMaterial(null);
      setQuantity('');
      setPurpose('');
      setSearchTerm('');
    } catch (error: any) {
      console.error(error);
      showToast('Failed to submit request. ' + error.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredMaterials = materials.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col space-y-6 w-full max-w-4xl mx-auto pb-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 font-[var(--heading)] tracking-tight">Material Request</h2>
        <p className="text-sm text-gray-600 mt-1 font-medium">Submit a request for items you need from the inventory.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Form Column */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-2">Selected Item</label>
              {selectedMaterial ? (
                <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-emerald-800">{selectedMaterial.name}</p>
                      <p className="text-[11px] font-medium text-emerald-600">Available: {selectedMaterial.stocks} {selectedMaterial.unit}</p>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setSelectedMaterial(null)}
                    className="text-xs font-bold text-emerald-700 hover:bg-emerald-100 px-2 py-1 rounded transition-colors"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-gray-50 border border-dashed border-gray-300 rounded-lg text-center">
                  <p className="text-sm text-gray-500 font-medium">Please select an item from the available list.</p>
                </div>
              )}
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Quantity</label>
              <input
                type="number"
                min="1"
                max={selectedMaterial?.stocks || 1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={!selectedMaterial || submitting}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50/50 text-black text-sm focus:ring-2 focus:ring-[#166534]/20 focus:border-[#166534] transition-all outline-none disabled:opacity-50"
                placeholder="0"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Purpose / Justification</label>
              <textarea
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                disabled={!selectedMaterial || submitting}
                rows={4}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50/50 text-black text-sm focus:ring-2 focus:ring-[#166534]/20 focus:border-[#166534] transition-all outline-none disabled:opacity-50 resize-none"
                placeholder="Please explain why you need this item..."
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !selectedMaterial || !quantity || !purpose}
              className="w-full flex items-center justify-center gap-2 bg-[#166534] text-white py-2.5 rounded-lg text-sm font-bold hover:bg-[#14532d] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:scale-[0.98]"
            >
              {submitting ? (
                <>Processing...</>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Request
                </>
              )}
            </button>
          </form>
        </div>

        {/* Selection Column */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col h-[500px]">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-gray-400" />
            <h3 className="text-base font-bold text-gray-800">Available Items</h3>
          </div>

          <div className="relative mb-4 shrink-0">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-[#166534]/20 focus:border-[#166534] transition-all outline-none"
            />
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-2 relative">
            {loading ? (
              <div className="flex items-center justify-center h-full text-gray-400">Loading items...</div>
            ) : filteredMaterials.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <Info className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-sm font-medium text-gray-500">No available items found matching your search.</p>
              </div>
            ) : (
              filteredMaterials.map((mat) => (
                <div 
                  key={mat.id}
                  onClick={() => setSelectedMaterial(mat)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedMaterial?.id === mat.id 
                      ? 'border-[#166534] bg-green-50 shadow-sm ring-1 ring-[#166534]/10' 
                      : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-800">{mat.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Stock: {mat.stocks} {mat.unit}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
