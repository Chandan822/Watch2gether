import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { 
  User, 
  Lock, 
  Upload, 
  Check, 
  AlertCircle,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react';

export default function Profile() {
  const { fetchWithAuth, updateUser } = useAuth();
  const [profileData, setProfileData] = useState(null);
  
  // Form States
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  
  // Status States
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  
  const [detailsMsg, setDetailsMsg] = useState({ type: '', text: '' });
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' });
  const [avatarMsg, setAvatarMsg] = useState({ type: '', text: '' });

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

  // Fetch complete profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetchWithAuth(`${API_URL}/users/profile`);
        const data = await res.json();
        
        if (res.ok) {
          setProfileData(data.data);
          setUsername(data.data.username);
          setEmail(data.data.email || '');
        } else {
          console.error('Failed to load profile details.');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingProfile(false);
      }
    };
    
    fetchProfile();
  }, [fetchWithAuth, API_URL]);

  // Submit Profile Details update
  const handleUpdateDetails = async (e) => {
    e.preventDefault();
    if (!username.trim()) return;

    setDetailsLoading(true);
    setDetailsMsg({ type: '', text: '' });

    try {
      const res = await fetchWithAuth(`${API_URL}/users/profile`, {
        method: 'PUT',
        body: JSON.stringify({ username: username.trim(), email: email.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Details update failed');

      setProfileData((prev) => ({ ...prev, ...data.data }));
      updateUser({ username: data.data.username, email: data.data.email });
      setDetailsMsg({ type: 'success', text: 'Profile details updated successfully!' });
    } catch (err) {
      setDetailsMsg({ type: 'error', text: err.message });
    } finally {
      setDetailsLoading(false);
    }
  };

  // Submit Password update
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!oldPassword || !newPassword) return;
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    setPasswordLoading(true);
    setPasswordMsg({ type: '', text: '' });

    try {
      const res = await fetchWithAuth(`${API_URL}/users/profile/password`, {
        method: 'PUT',
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Password change failed');

      setPasswordMsg({ type: 'success', text: 'Password updated successfully!' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowOldPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    } catch (err) {
      setPasswordMsg({ type: 'error', text: err.message });
    } finally {
      setPasswordLoading(false);
    }
  };

  // Submit Avatar Image upload
  const handleUploadAvatar = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    setAvatarLoading(true);
    setAvatarMsg({ type: '', text: '' });

    const formData = new FormData();
    formData.append('avatar', selectedFile);

    try {
      const res = await fetchWithAuth(`${API_URL}/users/profile/avatar`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'File upload failed');

      // Update local profile image path
      setProfileData((prev) => ({ ...prev, avatarUrl: data.data.avatarUrl }));
      updateUser({ avatarUrl: data.data.avatarUrl });
      setAvatarMsg({ type: 'success', text: 'Avatar uploaded successfully!' });
      setSelectedFile(null);
    } catch (err) {
      setAvatarMsg({ type: 'error', text: err.message });
    } finally {
      setAvatarLoading(false);
    }
  };

  // Remove/Delete Avatar Image
  const handleRemoveAvatar = async () => {
    setAvatarLoading(true);
    setAvatarMsg({ type: '', text: '' });

    try {
      const res = await fetchWithAuth(`${API_URL}/users/profile/avatar`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Avatar removal failed');

      setProfileData((prev) => ({ ...prev, avatarUrl: null }));
      updateUser({ avatarUrl: null });
      setAvatarMsg({ type: 'success', text: 'Avatar removed successfully!' });
      setSelectedFile(null);
    } catch (err) {
      setAvatarMsg({ type: 'error', text: err.message });
    } finally {
      setAvatarLoading(false);
    }
  };

  if (loadingProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 dark:text-slate-400 font-semibold text-xs">Loading profile settings...</p>
      </div>
    );
  }

  // Get full avatar path from backend host prefix if relative
  const hostUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3000';
  const displayAvatar = profileData?.avatarUrl
    ? (profileData.avatarUrl.startsWith('http') || profileData.avatarUrl.startsWith('data:') ? profileData.avatarUrl : `${hostUrl}${profileData.avatarUrl}`)
    : 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&w=256&h=256&q=80';

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      
      {/* Intro Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white font-display">
          Profile Settings
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Customize your credentials, upload profile avatars, and change password locks.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left Side: Avatar Display & Action Card */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-900/60 rounded-3xl p-6 shadow-2xl backdrop-blur-sm flex flex-col items-center text-center space-y-4">
            
            {/* Avatar Frame */}
            <div className="relative w-28 h-28 rounded-full overflow-hidden border-2 border-indigo-500/50 shadow-lg shadow-indigo-500/10">
              <img 
                src={displayAvatar} 
                alt="Profile Avatar" 
                className="w-full h-full object-cover"
              />
            </div>
            
            <div>
              <h2 className="font-bold text-lg text-slate-900 dark:text-white font-display">
                {profileData?.username}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-500">
                Joined {new Date(profileData?.createdAt).toLocaleDateString()}
              </p>
            </div>

            {/* Avatar Upload Form */}
            <form onSubmit={handleUploadAvatar} className="w-full pt-4 border-t border-slate-100 dark:border-slate-900/60 space-y-3">
              <div className="relative w-full">
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                  className="hidden" 
                  id="avatar-input"
                />
                <label 
                  htmlFor="avatar-input"
                  className="flex items-center justify-center gap-2 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl py-3 cursor-pointer transition-all active:scale-[0.98]"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[150px]">
                    {selectedFile ? selectedFile.name : 'Choose Image'}
                  </span>
                </label>
              </div>

              {profileData?.avatarUrl && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={avatarLoading}
                  className="flex items-center justify-center gap-2 w-full bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 font-semibold text-xs rounded-xl py-2.5 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{avatarLoading ? 'Removing...' : 'Remove Avatar'}</span>
                </button>
              )}

              {selectedFile && (
                <button
                  type="submit"
                  disabled={avatarLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl py-2.5 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 shadow-lg shadow-indigo-600/20"
                >
                  {avatarLoading ? 'Uploading...' : 'Save Avatar'}
                </button>
              )}

              {avatarMsg.text && (
                <div className={`text-[10px] font-medium p-2 rounded-lg text-center ${
                  avatarMsg.type === 'success' 
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20' 
                    : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20'
                }`}>
                  {avatarMsg.text}
                </div>
              )}
            </form>

          </div>
        </div>

        {/* Right Side: details & password forms */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Form 1: Profile details */}
          <div className="bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-900/60 rounded-3xl p-6 shadow-2xl backdrop-blur-sm space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 rounded-xl border border-indigo-100 dark:border-indigo-500/20">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-lg text-slate-900 dark:text-white font-display">Account Details</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Manage display nickname and email settings.</p>
              </div>
            </div>

            {detailsMsg.text && (
              <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                detailsMsg.type === 'success' 
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20' 
                  : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20'
              }`}>
                {detailsMsg.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{detailsMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleUpdateDetails} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-600 dark:text-slate-400 font-semibold block px-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium transition-all"
                    required
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-600 dark:text-slate-400 font-semibold block px-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium transition-all"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={detailsLoading}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl px-6 py-3 shadow-lg shadow-indigo-600/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
              >
                {detailsLoading ? 'Saving Changes...' : 'Save Details'}
              </button>
            </form>
          </div>

          {/* Form 2: Password Updates */}
          <div className="bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-900/60 rounded-3xl p-6 shadow-2xl backdrop-blur-sm space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-50 dark:bg-purple-500/10 text-purple-500 dark:text-purple-400 rounded-xl border border-purple-100 dark:border-purple-500/20">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-lg text-slate-900 dark:text-white font-display">Change Password</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Regularly update your password keys.</p>
              </div>
            </div>

            {passwordMsg.text && (
              <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                passwordMsg.type === 'success' 
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20' 
                  : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20'
              }`}>
                {passwordMsg.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{passwordMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-600 dark:text-slate-400 font-semibold block px-1">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showOldPassword ? 'text' : 'password'}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-4 pr-12 py-3 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPassword(!showOldPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none cursor-pointer flex items-center justify-center p-1"
                  >
                    {showOldPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-600 dark:text-slate-400 font-semibold block px-1">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-4 pr-12 py-3 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none cursor-pointer flex items-center justify-center p-1"
                    >
                      {showNewPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-600 dark:text-slate-400 font-semibold block px-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-4 pr-12 py-3 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none cursor-pointer flex items-center justify-center p-1"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={passwordLoading}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl px-6 py-3 shadow-lg shadow-indigo-600/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
              >
                {passwordLoading ? 'Updating Password...' : 'Update Password'}
              </button>
            </form>
          </div>

        </div>

      </div>

    </div>
  );
}
