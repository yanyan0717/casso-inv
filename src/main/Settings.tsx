import { useState, useEffect, useRef } from 'react';
import { User, Camera, Save } from 'lucide-react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import { CardSkeleton } from '../components/SkeletonLoader';

interface Profile {
  id: string;
  full_name: string | null;
  profile_picture_path: string | null;
  email: string | null;
  role: string | null;
}

export default function Settings() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ full_name: '', profile_picture_path: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const docSnap = await getDoc(doc(db, 'profiles', user.uid));
          if (docSnap.exists()) {
            const data = docSnap.data() as Profile;
            setProfile(data);
            setFormData({ 
              full_name: data.full_name || '', 
              profile_picture_path: data.profile_picture_path || '' 
            });
          }
        } catch (error) {
          console.error("Error fetching profile:", error);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        setFormData({ ...formData, profile_picture_path: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const user = auth.currentUser;
    if (user) {
      try {
        await updateDoc(doc(db, 'profiles', user.uid), { 
          full_name: formData.full_name,
          profile_picture_path: formData.profile_picture_path,
          updated_at: new Date().toISOString()
        });
        setProfile(prev => prev ? { ...prev, full_name: formData.full_name, profile_picture_path: formData.profile_picture_path } : null);
      } catch (error) {
        console.error("Error saving profile:", error);
      }
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col space-y-4 relative w-full max-w-2xl mx-auto pb-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 font-[var(--heading)] tracking-tight">Settings</h2>
          <p className="text-sm text-gray-600 mt-1 font-medium">Manage your system preferences and account settings.</p>
        </div>
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4 relative w-full max-w-2xl mx-auto pb-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800 font-[var(--heading)] tracking-tight">Settings</h2>
        <p className="text-sm text-gray-600 mt-1 font-medium">Manage your system preferences and account settings.</p>
      </div>

      <div className="bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6">
          <div className="space-y-5">
            <div className="flex flex-col items-center pb-6 border-b border-gray-100">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center overflow-hidden shadow-sm border-2 border-white">
                  {formData.profile_picture_path ? (
                    <img src={formData.profile_picture_path} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-[#166534]" />
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 w-8 h-8 bg-[#166534] text-white rounded-full flex items-center justify-center shadow-md hover:bg-[#14532d] cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[13px] font-bold text-gray-600 uppercase tracking-wider">Full Name</label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-md border border-gray-200 bg-gray-50/30 text-black text-sm focus:ring-2 focus:ring-[#166534]/10 focus:border-[#166534] transition-all outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[13px] font-bold text-gray-600 uppercase tracking-wider">Email Address</label>
                <input
                  type="email"
                  value={profile?.email || ''}
                  disabled
                  className="w-full px-3 py-2.5 rounded-md border border-gray-200 bg-gray-100 text-gray-500 text-sm cursor-not-allowed"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[13px] font-bold text-gray-600 uppercase tracking-wider">Role</label>
                <input
                  type="text"
                  value={profile?.role || 'user'}
                  disabled
                  className="w-full px-3 py-2.5 rounded-md border border-gray-200 bg-gray-100 text-gray-500 text-sm capitalize cursor-not-allowed"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="bg-[#166534] hover:bg-[#14532d] text-white px-6 py-3 rounded-md text-sm font-bold shadow-sm transition-all flex items-center gap-2 active:scale-[0.98] cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
