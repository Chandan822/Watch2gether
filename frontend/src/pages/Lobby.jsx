import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { socket } from '../services/socket.js';
import {
  Tv,
  Plus,
  ArrowRight,
  User,
  Film,
  BookOpen,
  Code,
  Gamepad2,
  Music,
  Users,
  Sliders,
  Sparkles,
  HelpCircle,
  Compass,
  UserPlus
} from 'lucide-react';

const ROOM_TYPES = [
  { code: 'movie_night', name: 'Movie Night', icon: Film, desc: 'Watch films with friends.' },
  { code: 'youtube_party', name: 'YouTube Party', icon: Tv, desc: 'Stream YouTube in sync.' },
  { code: 'study_group', name: 'Study Group', icon: BookOpen, desc: 'Learn together in sync.' },
  { code: 'coding_session', name: 'Coding Session', icon: Code, desc: 'Code along in real-time.' },
  { code: 'gaming_party', name: 'Gaming Party', icon: Gamepad2, desc: 'Watch gameplay streams.' },
  { code: 'music_party', name: 'Music Party', icon: Music, desc: 'Listen to playlists.' },
  { code: 'community_event', name: 'Community Event', icon: Users, desc: 'Host virtual meetups.' },
  { code: 'custom', name: 'Custom Room', icon: Sliders, desc: 'A flexible custom lounge.' },
];

/**
 * Lobby Dashboard Page (Authenticated)
 * 
 * Permits authenticated users to:
 * 1. Create a Watch Room (Public, Private, or Password Protected).
 * 2. Join rooms by pasting room codes.
 * 3. Browse and join active Public watch lounges.
 * 4. Manage active friends, pending requests, and view online statuses.
 */
export default function Lobby() {
  const { user, fetchWithAuth } = useAuth();

  // Create Room States
  const [roomName, setRoomName] = useState('');
  const [roomIdInput, setRoomIdInput] = useState('');
  const [selectedType, setSelectedType] = useState('movie_night');
  const [visibility, setVisibility] = useState('public');
  const [password, setPassword] = useState('');
  const [isAiEnabled, setIsAiEnabled] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  // Public Rooms List State
  const [publicRooms, setPublicRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  // Friends States
  const [friendsList, setFriendsList] = useState([]);
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [addFriendUsername, setAddFriendUsername] = useState('');
  const [friendsActiveTab, setFriendsActiveTab] = useState('friends'); // 'friends' | 'requests'
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [friendsError, setFriendsError] = useState('');
  const [friendsSuccess, setFriendsSuccess] = useState('');

  const navigate = useNavigate();

  // Fetch all public rooms
  const fetchPublicRooms = async () => {
    setLoadingRooms(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
      const res = await fetchWithAuth(`${apiUrl}/rooms`);
      const data = await res.json();
      if (res.ok) {
        setPublicRooms(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
    } finally {
      setLoadingRooms(false);
    }
  };

  // Fetch friends list and pending requests
  const fetchFriendsData = async () => {
    setLoadingFriends(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

      // 1. Fetch Friends
      const friendsRes = await fetchWithAuth(`${apiUrl}/friends`);
      const friendsData = await friendsRes.json();
      if (friendsRes.ok) {
        setFriendsList(friendsData.data || []);
      }

      // 2. Fetch Requests
      const requestsRes = await fetchWithAuth(`${apiUrl}/friends/requests`);
      const requestsData = await requestsRes.json();
      if (requestsRes.ok) {
        setReceivedRequests(requestsData.data?.received || []);
      }
    } catch (err) {
      console.error('Failed to fetch friends data:', err);
    } finally {
      setLoadingFriends(false);
    }
  };

  useEffect(() => {
    fetchPublicRooms();
    fetchFriendsData();

    // Listen to real-time status updates via global socket
    socket.on('user-status-changed', ({ userId, status }) => {
      setFriendsList((prev) =>
        prev.map((f) => f.id === userId ? { ...f, isOnline: status === 'online' } : f)
      );
    });

    socket.on('friends-updated', () => {
      fetchFriendsData();
    });

    return () => {
      socket.off('user-status-changed');
      socket.off('friends-updated');
    };
  }, []);

  // Create room API call using fetch wrapper
  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!roomName.trim()) return;

    setIsCreating(true);
    setError('');

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
      const res = await fetchWithAuth(`${apiUrl}/rooms`, {
        method: 'POST',
        body: JSON.stringify({
          name: roomName.trim(),
          roomTypeCode: selectedType,
          visibility,
          password: visibility === 'password_protected' ? password : undefined,
          isAiEnabled
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to initialize session');
      }

      // Redirect into room view
      navigate(`/room/${data.data.id}`);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Could not connect to server. Ensure backend is running.');
    } finally {
      setIsCreating(false);
    }
  };

  // Direct room redirect
  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (!roomIdInput.trim()) return;
    navigate(`/room/${roomIdInput.trim()}`);
  };

  // Delete Room from dashboard (if user is host)
  const handleDeleteRoom = async (roomId) => {
    if (!confirm('Are you sure you want to permanently delete this watch lounge?')) return;
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
      const res = await fetchWithAuth(`${apiUrl}/rooms/${roomId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchPublicRooms();
      } else {
        const data = await res.json();
        throw new Error(data.message || 'Failed to delete room');
      }
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error deleting room');
    }
  };

  // Send Friend Request handler
  const handleAddFriend = async (e) => {
    e.preventDefault();
    if (!addFriendUsername.trim()) return;

    setFriendsError('');
    setFriendsSuccess('');

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
      const res = await fetchWithAuth(`${apiUrl}/friends/requests`, {
        method: 'POST',
        body: JSON.stringify({ username: addFriendUsername.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to send request');
      }

      setFriendsSuccess(`Friend request sent to "${addFriendUsername.trim()}"!`);
      setAddFriendUsername('');
      fetchFriendsData();
    } catch (err) {
      setFriendsError(err.message || 'Error sending request.');
    }
  };

  // Accept / Reject Friend Request handler
  const handleResolveRequest = async (requestId, action) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
      const res = await fetchWithAuth(`${apiUrl}/friends/requests/${requestId}`, {
        method: 'PUT',
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        fetchFriendsData();
      } else {
        const data = await res.json();
        throw new Error(data.message || 'Failed to resolve request');
      }
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error resolving request');
    }
  };

  // Remove Friend handler
  const handleRemoveFriend = async (friendshipId, friendName) => {
    if (!confirm(`Are you sure you want to remove ${friendName} from your friends list?`)) return;
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
      const res = await fetchWithAuth(`${apiUrl}/friends/${friendshipId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchFriendsData();
      } else {
        const data = await res.json();
        throw new Error(data.message || 'Failed to remove friend');
      }
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error removing friend');
    }
  };

  return (
    <div className="max-w-6xl mx-auto my-6 space-y-8 animate-fade-in px-4">

      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-900 bg-gradient-to-r from-indigo-50 via-purple-50 to-slate-50 dark:from-indigo-950/30 dark:via-purple-950/20 dark:to-slate-900/40 p-8 shadow-2xl backdrop-blur-sm">
        {/* Abstract background decorative blobs */}
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-indigo-400/10 dark:bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-64 h-64 bg-purple-400/10 dark:bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-xs font-bold text-indigo-600 dark:text-indigo-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Real-Time Sync Lounge</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold font-display tracking-tight text-slate-900 dark:text-white">
              Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-500 dark:from-indigo-400 dark:to-purple-400">{user?.username || 'Watcher'}</span>!
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
              Create a custom watch room, invite your friends, and stream video content together in absolute real-time sync with integrated live chat!
            </p>
          </div>

          {/* Quick Profile Card */}
          <div className="shrink-0 flex items-center gap-3.5 p-4 bg-white/60 dark:bg-slate-950/45 border border-slate-200 dark:border-slate-900 rounded-2xl md:max-w-xs w-full md:w-auto">
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-indigo-500/30 shadow-md shadow-indigo-500/5">
              <img
                src={user?.avatarUrl ? (user.avatarUrl.startsWith('http') || user.avatarUrl.startsWith('data:') ? user.avatarUrl : `${import.meta.env.VITE_WS_URL || 'http://localhost:3000'}${user.avatarUrl}`) : 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&w=64&h=64&q=80'}
                alt="Profile Avatar"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] text-slate-500 dark:text-slate-500 font-semibold uppercase tracking-wider">Account Profile</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[185px]">{user?.username}</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate max-w-[185px]">{user?.email}</div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 rounded-2xl text-xs text-center font-medium max-w-3xl mx-auto shadow-lg">
          {error}
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Column (Create Watch Room) - Spans 2 columns */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900/10 border border-slate-200 dark:border-slate-900 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-sm space-y-6">
          <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100 dark:border-slate-900">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 rounded-xl border border-indigo-100 dark:border-transparent">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-xl font-display text-slate-900 dark:text-white">Create a Lounge</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Initialize a new video sync room with custom vibes.</p>
            </div>
          </div>

          <form onSubmit={handleCreateRoom} className="space-y-6">
            {/* Room Name Input */}
            <div className="space-y-2">
              <label className="text-xs text-slate-600 dark:text-slate-400 font-bold block px-1">
                Lounge Name
              </label>
              <input
                type="text"
                placeholder="Give your room a fun name (e.g., Chill Anime Night, Coding Jam)"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3.5 text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm font-medium"
                required
              />
            </div>

            {/* Room Accessibility / Visibility */}
            <div className="space-y-2.5">
              <label className="text-xs text-slate-600 dark:text-slate-400 font-bold block px-1">
                Lounge Accessibility &amp; Privacy
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { code: 'public', name: 'Public', desc: 'Visible on Lobby dashboard.' },
                  { code: 'private', name: 'Private', desc: 'Direct invitation or link only.' },
                  { code: 'password_protected', name: 'Password Protected', desc: 'Requires password to enter.' },
                ].map((vis) => (
                  <button
                    key={vis.code}
                    type="button"
                    onClick={() => {
                      setVisibility(vis.code);
                      if (vis.code !== 'password_protected') setPassword('');
                    }}
                    className={`flex flex-col items-start p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${visibility === vis.code
                        ? 'bg-indigo-50 dark:bg-indigo-600/10 border-indigo-400 dark:border-indigo-500 text-slate-900 dark:text-white shadow-md'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-800'
                      }`}
                  >
                    <span className="text-xs font-bold font-display block mb-0.5">{vis.name}</span>
                    <span className="text-[9px] text-slate-500 dark:text-slate-500 leading-tight block">{vis.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Password input (only if password protected) */}
            {visibility === 'password_protected' && (
              <div className="space-y-2 animate-fade-in">
                <label className="text-xs text-slate-600 dark:text-slate-400 font-bold block px-1">
                  Room Password
                </label>
                <input
                  type="password"
                  placeholder="Enter a secure room password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3.5 text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm font-medium"
                  required
                />
              </div>
            )}

            {/* Optional AI Assistant settings toggle */}
            <div className="space-y-2 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-900 rounded-2xl p-4 flex items-center justify-between gap-4 animate-fade-in">
              <div className="space-y-0.5">
                <label className="text-xs text-slate-800 dark:text-white font-bold block">
                  Enable Gemini AI Assistant
                </label>
                <span className="text-[10px] text-slate-500 dark:text-slate-500 leading-tight block">
                  Enables video summaries, study explanations, quizzes, and discussion questions.
                </span>
              </div>
              <input
                type="checkbox"
                checked={isAiEnabled}
                onChange={(e) => setIsAiEnabled(e.target.checked)}
                className="w-4 h-4 accent-indigo-600 rounded bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800 cursor-pointer shrink-0"
              />
            </div>

            {/* Room Type Selector */}
            <div className="space-y-3">
              <label className="text-xs text-slate-600 dark:text-slate-400 font-bold block px-1">
                Choose room style
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {ROOM_TYPES.map((type) => {
                  const Icon = type.icon;
                  const isSelected = selectedType === type.code;
                  return (
                    <button
                      key={type.code}
                      type="button"
                      onClick={() => setSelectedType(type.code)}
                      className={`flex items-start gap-4 p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer group hover:scale-[1.01] ${isSelected
                          ? 'bg-indigo-50 dark:bg-indigo-600/10 border-indigo-400 dark:border-indigo-500 text-slate-900 dark:text-white shadow-lg shadow-indigo-500/5'
                          : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-900 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-800 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                    >
                      <div className={`p-2.5 rounded-xl shrink-0 transition-colors ${isSelected
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                          : 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300'
                        }`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <span className="text-xs font-bold font-display block text-slate-900 dark:text-white">{type.name}</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-400 leading-tight block truncate">
                          {type.desc}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={isCreating}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl py-3.5 shadow-lg shadow-indigo-600/20 active:scale-[0.99] transition-all disabled:opacity-50 text-sm cursor-pointer mt-4"
            >
              {isCreating ? 'Setting up lounge...' : 'Create Watch Lounge'}
            </button>
          </form>
        </div>

        {/* Right Column (Join Watch Room & Public Lounges & Friends) */}
        <div className="space-y-6 lg:col-span-1">

          {/* Join Lounge Card */}
          <div className="bg-white dark:bg-slate-900/10 border border-slate-200 dark:border-slate-900 rounded-3xl p-6 shadow-2xl backdrop-blur-sm space-y-4">
            <div className="flex items-center gap-3 pb-2 border-b border-slate-100 dark:border-slate-900">
              <div className="p-2.5 bg-purple-50 dark:bg-purple-500/10 text-purple-500 dark:text-purple-400 rounded-xl border border-purple-100 dark:border-transparent">
                <Tv className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-lg font-display text-slate-900 dark:text-white">Join Room</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Join a friend&apos;s live stream lounge.</p>
              </div>
            </div>

            <form onSubmit={handleJoinRoom} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-600 dark:text-slate-400 font-bold block px-1">
                  Enter Code ID
                </label>
                <input
                  type="text"
                  placeholder="Paste Room ID (e.g. 8f237b12-...)"
                  value={roomIdInput}
                  onChange={(e) => setRoomIdInput(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3.5 text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all text-sm font-medium"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-xl py-3 shadow-lg shadow-purple-600/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
              >
                <span>Enter Room</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* Browse Public Lounges */}
          <div className="bg-white dark:bg-slate-900/10 border border-slate-200 dark:border-slate-900 rounded-3xl p-6 shadow-2xl backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-900">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 rounded-xl border border-emerald-100 dark:border-transparent">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-lg font-display text-slate-900 dark:text-white">Public Lounges</h2>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Join an ongoing public watch party.</p>
                </div>
              </div>
              <button
                onClick={fetchPublicRooms}
                className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:underline cursor-pointer"
              >
                Refresh
              </button>
            </div>

            {loadingRooms ? (
              <div className="flex justify-center py-6">
                <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : publicRooms.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-500 text-center py-4">No active public rooms. Create one!</p>
            ) : (
              <div className="space-y-2.5 max-h-[200px] overflow-y-auto pr-1">
                {publicRooms.map((room) => {
                  const isOwner = user && room.ownerId === user.id;
                  return (
                    <div key={room.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950/65 border border-slate-200 dark:border-slate-900 rounded-xl hover:border-slate-300 dark:hover:border-slate-800 transition-all">
                      <div className="min-w-0 pr-2">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate">{room.name}</span>
                        <span className="text-[9px] text-slate-500 dark:text-slate-500 font-mono capitalize">
                          {room.roomTypeCode.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isOwner && (
                          <button
                            onClick={() => handleDeleteRoom(room.id)}
                            className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-500 dark:text-rose-400 text-[10px] font-bold rounded-lg cursor-pointer transition-colors border border-rose-200 dark:border-transparent"
                          >
                            Delete
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/room/${room.id}`)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded-lg cursor-pointer transition-colors"
                        >
                          Join
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Friends & Requests Widget */}
          <div className="bg-white dark:bg-slate-900/10 border border-slate-200 dark:border-slate-900 rounded-3xl p-6 shadow-2xl backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-900">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                <h2 className="font-bold text-lg font-display text-slate-900 dark:text-white">Friends</h2>
              </div>

              {/* Tab Toggles */}
              <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-900">
                <button
                  onClick={() => setFriendsActiveTab('friends')}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${friendsActiveTab === 'friends' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                  List ({friendsList.length})
                </button>
                <button
                  onClick={() => setFriendsActiveTab('requests')}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer relative ${friendsActiveTab === 'requests' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                  Requests
                  {receivedRequests.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span>
                  )}
                </button>
              </div>
            </div>

            {loadingFriends ? (
              <div className="flex justify-center py-6">
                <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : friendsActiveTab === 'friends' ? (
              // Friends list tab
              friendsList.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-500 text-center py-4">No friends added yet. Add some below!</p>
              ) : (
                <div className="space-y-2.5 max-h-[180px] overflow-y-auto pr-1">
                  {friendsList.map((friend) => (
                    <div key={friend.id} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-950/45 border border-slate-200 dark:border-slate-900/60 rounded-xl hover:border-slate-300 dark:hover:border-slate-800 transition-all">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative">
                          <div className="w-7 h-7 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
                            <img
                              src={friend.avatarUrl ? (friend.avatarUrl.startsWith('http') || friend.avatarUrl.startsWith('data:') ? friend.avatarUrl : `${import.meta.env.VITE_WS_URL || 'http://localhost:3000'}${friend.avatarUrl}`) : 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&w=64&h=64&q=80'}
                              alt="Friend Avatar"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-950 ${friend.isOnline ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-500'
                            }`} title={friend.isOnline ? 'Online' : 'Offline'}></span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate">{friend.username}</span>
                          <span className={`text-[8px] font-bold tracking-wider uppercase ${friend.isOnline ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'
                            }`}>
                            {friend.isOnline ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveFriend(friend.friendshipId, friend.username)}
                        className="text-[9px] font-bold text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 transition-colors px-2 py-1 hover:bg-rose-50 dark:hover:bg-rose-950/15 rounded-md cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )
            ) : (
              // Requests tab
              receivedRequests.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-500 text-center py-4">No pending friend requests.</p>
              ) : (
                <div className="space-y-2.5 max-h-[180px] overflow-y-auto pr-1">
                  {receivedRequests.map((reqItem) => (
                    <div key={reqItem.id} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-950/45 border border-slate-200 dark:border-slate-900/60 rounded-xl hover:border-slate-300 dark:hover:border-slate-800 transition-all">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
                          <img
                            src={reqItem.sender.avatarUrl ? (reqItem.sender.avatarUrl.startsWith('http') || reqItem.sender.avatarUrl.startsWith('data:') ? reqItem.sender.avatarUrl : `${import.meta.env.VITE_WS_URL || 'http://localhost:3000'}${reqItem.sender.avatarUrl}`) : 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&w=64&h=64&q=80'}
                            alt="Sender Avatar"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate">{reqItem.sender.username}</span>
                          <span className="text-[8px] text-slate-500 dark:text-slate-500 font-mono">wants to connect</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleResolveRequest(reqItem.id, 'accept')}
                          className="px-2 py-1 bg-emerald-500 hover:bg-emerald-400 text-white text-[9px] font-bold rounded cursor-pointer transition-colors"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleResolveRequest(reqItem.id, 'reject')}
                          className="px-2 py-1 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 text-[9px] font-bold rounded cursor-pointer transition-colors border border-slate-200 dark:border-slate-800"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* Add Friend form */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-900">
              <div className="flex items-center gap-1.5 mb-2 text-indigo-500 dark:text-indigo-400">
                <UserPlus className="w-4 h-4" />
                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">Add a Friend</h3>
              </div>
              <form onSubmit={handleAddFriend} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter exact username..."
                  value={addFriendUsername}
                  onChange={(e) => setAddFriendUsername(e.target.value)}
                  className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
                  required
                />
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-sm"
                >
                  Add
                </button>
              </form>
              {friendsSuccess && (
                <p className="text-[10px] text-emerald-500 dark:text-emerald-400 font-semibold mt-1.5 text-center">{friendsSuccess}</p>
              )}
              {friendsError && (
                <p className="text-[10px] text-rose-500 dark:text-rose-400 font-semibold mt-1.5 text-center">{friendsError}</p>
              )}
            </div>
          </div>

          {/* Quick Help Card */}
          <div className="bg-white dark:bg-slate-900/10 border border-slate-200 dark:border-slate-900 rounded-3xl p-6 shadow-2xl backdrop-blur-sm space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-900 text-indigo-500 dark:text-indigo-400">
              <HelpCircle className="w-4.5 h-4.5" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">How it works</h3>
            </div>
            <ul className="space-y-3.5 text-xs text-slate-600 dark:text-slate-400">
              <li className="flex items-start gap-2.5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-50 dark:bg-slate-900 text-[10px] font-bold text-indigo-500 dark:text-indigo-400 border border-indigo-200 dark:border-slate-800 shrink-0">1</span>
                <span>Create a new lounge name and choose your preferred vibe category and accessibility.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-50 dark:bg-slate-900 text-[10px] font-bold text-indigo-500 dark:text-indigo-400 border border-indigo-200 dark:border-slate-800 shrink-0">2</span>
                <span>Invite friends by clicking <strong>&quot;Invite Friends&quot;</strong> to copy the unique room ID.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-50 dark:bg-slate-900 text-[10px] font-bold text-indigo-500 dark:text-indigo-400 border border-indigo-200 dark:border-slate-800 shrink-0">3</span>
                <span>Paste any MP4, YouTube, or video URL and stream it in complete, real-time sync!</span>
              </li>
            </ul>
          </div>

        </div>

      </div>
    </div>
  );
}
