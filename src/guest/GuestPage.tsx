import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Search, Package, ArrowLeft, ShoppingBag, Tag, Layers, X } from 'lucide-react';
import logoUrl from '../assets/casso.png';
import slide1 from '../assets/casso1.jpg';
import slide2 from '../assets/carousel 4.jpg';
import slide3 from '../assets/carousel 5.jpg';
import slide4 from '../assets/carousel 6.jpg';
import slide5 from '../assets/carousel 7.jpg';

const CAROUSEL_ITEMS = [
  {
    image: slide1,
    title: "Office Supplies & Materials",
    description: "Browse the current inventory of Iligan City Assessor's Office. Stock levels are updated in real-time."
  },
  {
    image: slide2,
    title: "City of Majestic Waterfalls",
    description: "Building a progressive future while preserving our rich heritage and natural wonders."
  },
  {
    image: slide3,
    title: "Community First",
    description: "Serving the constituents of Iligan City with dedication and transparency in all our transactions."
  },
  {
    image: slide4,
    title: "Digital Transformation",
    description: "Embracing technology to modernize our services and improve public accessibility."
  },
  {
    image: slide5,
    title: "Professional Excellence",
    description: "Committed to highest standards of integrity, competence, and public service."
  }
];

interface Material {
  id: string;
  material_id: string;
  name: string;
  category: string;
  unit: string;
  stocks: number;
  description: string;
  picture: string | null;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  furniture:   { bg: 'from-emerald-500 to-teal-600',   text: 'text-emerald-700', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700' },
  electronics: { bg: 'from-blue-500 to-indigo-600',    text: 'text-blue-700',    border: 'border-blue-200',    badge: 'bg-blue-100 text-blue-700' },
  supplies:    { bg: 'from-purple-500 to-violet-600',   text: 'text-purple-700',  border: 'border-purple-200',  badge: 'bg-purple-100 text-purple-700' },
  other:       { bg: 'from-gray-500 to-slate-600',      text: 'text-gray-700',    border: 'border-gray-200',    badge: 'bg-gray-100 text-gray-700' },
};

const getStockStatus = (stocks: number) => {
  if (stocks === 0) return { label: 'Out of Stock', cls: 'bg-red-100 text-red-600 border-red-200' };
  if (stocks < 6)  return { label: 'Low Stock',  cls: 'bg-amber-100 text-amber-600 border-amber-200' };
  return               { label: 'In Stock',    cls: 'bg-green-100 text-green-700 border-green-200' };
};

export default function GuestPage() {
  const navigate = useNavigate();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedItem, setSelectedItem] = useState<Material | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % CAROUSEL_ITEMS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        const q = query(collection(db, 'materials'), orderBy('name', 'asc'));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Material));
        setMaterials(data);
      } catch (error) {
        console.error('Error fetching materials:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMaterials();
  }, []);

  const categories = ['all', ...Array.from(new Set(materials.map(m => m.category.toLowerCase())))];

  const filtered = materials.filter(m => {
    const matchCat = activeCategory === 'all' || m.category.toLowerCase() === activeCategory;
    const matchSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.category.toLowerCase().includes(search.toLowerCase()) ||
      (m.material_id && m.material_id.toLowerCase().includes(search.toLowerCase()));
    return matchCat && matchSearch;
  });

  const colorFor = (cat: string) => CATEGORY_COLORS[cat.toLowerCase()] || CATEGORY_COLORS.other;

  const renderModal = () => {
    if (!selectedItem) return null;
    const colors = colorFor(selectedItem.category);
    const status = getStockStatus(selectedItem.stocks);
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        onClick={() => setSelectedItem(null)}
      >
        <div
          className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-gray-100"
          onClick={e => e.stopPropagation()}
        >
          {/* Image header */}
          <div className={`relative w-full h-56 bg-gradient-to-br ${colors.bg} flex items-center justify-center overflow-hidden`}>
            {selectedItem.picture ? (
              <img src={selectedItem.picture} alt={selectedItem.name} className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-3 opacity-50">
                <Package className="w-20 h-20 text-white" />
                <span className="text-white text-xs font-bold uppercase tracking-widest">No Image</span>
              </div>
            )}
            <button
              onClick={() => setSelectedItem(null)}
              className="absolute top-3 right-3 w-8 h-8 bg-black/30 hover:bg-black/50 text-white rounded-full flex items-center justify-center transition-all"
            >
              <X className="w-4 h-4" />
            </button>
            <span className={`absolute bottom-3 left-3 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${status.cls}`}>
              {status.label}
            </span>
          </div>

          {/* Details */}
          <div className="p-5">
            <div className="flex items-start justify-between mb-1">
              <div>
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">{selectedItem.material_id || 'N/A'}</p>
                <h2 className="text-xl font-black text-gray-800 leading-tight">{selectedItem.name}</h2>
              </div>
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full mt-1 ${colors.badge}`}>
                <Tag className="w-3 h-3" />
                {selectedItem.category}
              </span>
            </div>

            {selectedItem.description && (
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">{selectedItem.description}</p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold flex items-center gap-1">
                  <Layers className="w-3 h-3" /> Stock Level
                </p>
                <p className="text-2xl font-black text-gray-800 mt-0.5">{selectedItem.stocks}</p>
                <p className="text-[10px] text-gray-400 font-semibold">{selectedItem.unit}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold flex items-center gap-1">
                  <Tag className="w-3 h-3" /> Unit Type
                </p>
                <p className="text-2xl font-black text-gray-800 mt-0.5 capitalize">{selectedItem.unit || '—'}</p>
                <p className="text-[10px] text-gray-400 font-semibold">per piece</p>
              </div>
            </div>

            <button
              onClick={() => setSelectedItem(null)}
              className="mt-5 w-full bg-[#166534] hover:bg-[#14532d] text-white font-bold py-3 rounded-xl transition-all active:scale-[0.98] text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="min-h-screen bg-[#f5f6fa] flex flex-col" style={{ animation: 'guestFadeIn 0.5s ease-out forwards' }}>
        <style>
          {`
            @keyframes guestFadeIn {
              from { opacity: 0; transform: translateY(15px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}
        </style>

        {/* ─── NAVBAR ─────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <img src={logoUrl} alt="Logo" className="w-9 h-9 object-contain" />
            <div className="hidden sm:block">
              <p className="text-[11px] font-black tracking-[0.2em] text-[#166534] uppercase leading-none">Iligan City</p>
              <p className="text-[9px] text-gray-400 uppercase tracking-widest font-semibold leading-none mt-0.5">Assessor's Office</p>
            </div>
          </div>

          {/* Search bar */}
          <div className="flex-1 max-w-sm relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search materials…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-full border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]/20 focus:border-[#166534] transition-all"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Back to login */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#166534] bg-[#166534]/10 hover:bg-[#166534]/20 px-3 py-2 rounded-full transition-all whitespace-nowrap cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back To Login
          </button>
        </div>
      </header>

      {/* ─── HERO BANNER ─────────────────────────── */}
      <section className="relative py-12 px-4 overflow-hidden h-[340px] flex items-center">
        {/* Carousel Backgrounds */}
        {CAROUSEL_ITEMS.map((item, index) => (
          <div 
            key={index}
            className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out ${index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[#14532d]/95 via-[#166534]/75 to-transparent z-10 mix-blend-multiply"></div>
            <div className="absolute inset-0 bg-black/30 z-10"></div>
            <img src={item.image} alt="" className="w-full h-full object-cover" />
          </div>
        ))}

        <div className="max-w-7xl mx-auto w-full relative z-20">
          <div className="flex items-center gap-3 mb-3">
            <ShoppingBag className="w-6 h-6 text-emerald-400 drop-shadow" />
            <span className="text-emerald-400 text-sm font-bold uppercase tracking-widest drop-shadow">Public Inventory Catalog</span>
          </div>
          
          <div className="relative h-[80px] w-full">
            {CAROUSEL_ITEMS.map((item, index) => (
              <div 
                key={index}
                className={`absolute inset-0 transition-all duration-700 ease-in-out ${index === currentSlide ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
              >
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2 text-white drop-shadow-lg">
                  {item.title}
                </h1>
                <p className="text-white/90 text-sm max-w-lg drop-shadow-md font-medium">
                  {item.description}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-4">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 shadow-xl rounded-xl px-5 py-2.5 text-center transition-transform hover:scale-105">
              <p className="text-2xl font-black text-white drop-shadow-sm">{materials.length}</p>
              <p className="text-[10px] text-white/80 uppercase tracking-widest font-bold">Items</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/20 shadow-xl rounded-xl px-5 py-2.5 text-center transition-transform hover:scale-105">
              <p className="text-2xl font-black text-white drop-shadow-sm">{materials.reduce((s, m) => s + m.stocks, 0).toLocaleString()}</p>
              <p className="text-[10px] text-white/80 uppercase tracking-widest font-bold">Total Stock</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/20 shadow-xl rounded-xl px-5 py-2.5 text-center transition-transform hover:scale-105">
              <p className="text-2xl font-black text-white drop-shadow-sm">{categories.length - 1}</p>
              <p className="text-[10px] text-white/80 uppercase tracking-widest font-bold">Categories</p>
            </div>
          </div>

          {/* Carousel Indicators */}
          <div className="absolute -bottom-8 left-0 flex gap-2 w-full max-w-sm">
            {CAROUSEL_ITEMS.map((_, index) => (
              <div 
                key={index} 
                onClick={() => setCurrentSlide(index)}
                className={`h-1.5 rounded-full cursor-pointer transition-all duration-500 ease-in-out ${index === currentSlide ? 'w-10 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'w-4 bg-white/40 hover:bg-white/70'}`} 
              />
            ))}
          </div>
        </div>
      </section>

      {/* ─── CATEGORY TABS ────────────────────────── */}
      <div className="bg-white border-b border-gray-200 sticky top-16 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 overflow-x-auto">
          <div className="flex gap-1 py-2.5 min-w-max">
            {categories.map(cat => {
              const isAll = cat === 'all';
              const colors = isAll ? null : colorFor(cat);
              const active = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap border cursor-pointer
                    ${active
                      ? isAll
                        ? 'bg-[#166534] text-white border-[#166534] shadow'
                        : `${colors?.badge} border-transparent shadow`
                      : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                    }`}
                >
                  {cat === 'all' ? 'All Items' : cat}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── PRODUCT GRID ─────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">

        {/* Results info */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm text-gray-500 font-medium">
            {loading ? 'Loading…' : (
              <><span className="font-bold text-gray-700">{filtered.length}</span> {filtered.length === 1 ? 'item' : 'items'} found</>
            )}
          </p>
          {search && (
            <button onClick={() => setSearch('')} className="text-xs text-[#166534] font-semibold hover:underline flex items-center gap-1">
              <X className="w-3 h-3" /> Clear search
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden border border-gray-100 animate-pulse">
                <div className="w-full aspect-square bg-gray-100" />
                <div className="p-2.5 space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                  <div className="h-5 bg-gray-200 rounded-full w-1/3 mt-2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <Package className="w-16 h-16 mb-4 text-gray-200" />
            <p className="font-semibold text-gray-500">No materials found</p>
            <p className="text-sm mt-1">Try a different search or category</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filtered.map(mat => {
              const colors = colorFor(mat.category);
              const status = getStockStatus(mat.stocks);
              return (
                <div
                  key={mat.id}
                  onClick={() => setSelectedItem(mat)}
                  className="group bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer"
                >
                  {/* Image */}
                  <div className={`relative w-full aspect-square bg-gradient-to-br ${colors.bg} flex items-center justify-center overflow-hidden`}>
                    {mat.picture ? (
                      <img
                        src={mat.picture}
                        alt={mat.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 opacity-60">
                        <Package className="w-12 h-12 text-white" />
                        <span className="text-white text-[10px] font-bold uppercase tracking-widest">No Image</span>
                      </div>
                    )}
                    {/* Stock badge */}
                    <span className={`absolute top-2 right-2 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${status.cls}`}>
                      {status.label}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="p-2.5">
                    <p className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5">{mat.material_id || 'N/A'}</p>
                    <h3 className="text-sm font-bold text-gray-800 leading-snug line-clamp-2 mb-2">{mat.name}</h3>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${colors.badge}`}>
                        <Tag className="w-2.5 h-2.5" />
                        {mat.category}
                      </span>
                      <span className="text-[10px] font-black text-gray-700">{mat.stocks} <span className="font-medium text-gray-400 text-[9px]">{mat.unit}</span></span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ─── FOOTER ───────────────────────────────── */}
      <footer className="bg-white border-t border-gray-200 py-6 text-center">
        <p className="text-[10px] text-gray-400 uppercase tracking-[0.2em] font-bold">
          Iligan City Assessor's Office · Public Inventory Catalog · 2026
        </p>
      </footer>
      </div>

      {/* ─── ITEM DETAIL MODAL ────────────────────── */}
      {renderModal()}
      
    </div>
  );
}
