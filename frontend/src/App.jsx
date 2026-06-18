import { useState, useEffect } from 'react';
import { BrowserRouter, Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ThemeProvider, useTheme } from './context/ThemeContext.jsx';
import AppRoutes from './routes/AppRoutes.jsx';
import { Tv, LogOut, Settings, Bell, X, UserPlus, ArrowRight, MessageSquare, Sun, Moon } from 'lucide-react';
import { socket } from './services/socket.js';

/**
 * Navbar component that adapts to user session and active theme.
 * Displays logged-in status, theme toggle, and logs users out via JWT endpoint calls.
 */
function Navbar() {
  const { user, logout, fetchWithAuth } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup';

  const fetchNotifications = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
      const res = await fetchWithAuth(`${apiUrl}/notifications`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    fetchNotifications();

    const handleNewNotification = (notif) => {
      setNotifications((prev) => [notif, ...prev]);
    };

    socket.on('notification-received', handleNewNotification);

    return () => {
      socket.off('notification-received', handleNewNotification);
    };
  }, [user]);

  const markAsRead = async (id) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
      const res = await fetchWithAuth(`${apiUrl}/notifications/${id}/read`, {
        method: 'PUT',
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        );
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
      const res = await fetchWithAuth(`${apiUrl}/notifications/read-all`, {
        method: 'PUT',
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      }
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const deleteNotification = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
      const res = await fetchWithAuth(`${apiUrl}/notifications/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const clearAll = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
      const res = await fetchWithAuth(`${apiUrl}/notifications`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setNotifications([]);
      }
    } catch (err) {
      console.error('Error clearing notifications:', err);
    }
  };

  const handleFriendRequestAction = async (requestId, action, notificationId, e) => {
    if (e) e.stopPropagation();
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
      const res = await fetchWithAuth(`${apiUrl}/friends/requests/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        await deleteNotification(notificationId);
      } else {
        const data = await res.json();
        alert(data.message || 'Error processing friend request');
      }
    } catch (err) {
      console.error('Error in handleFriendRequestAction:', err);
    }
  };

  const handleNotificationClick = async (notif) => {
    await markAsRead(notif.id);
    setIsOpen(false);
    if (['room_invite', 'friend_started_room', 'mention'].includes(notif.type) && notif.referenceId) {
      navigate(`/room/${notif.referenceId}`);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-900 bg-white/90 dark:bg-slate-950/70 backdrop-blur-md transition-colors duration-200">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-2.5 text-xl font-extrabold tracking-tight text-slate-900 dark:text-white font-display hover:opacity-90 transition-opacity"
        >
          <div className="p-2 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <Tv className="w-5 h-5 text-white" />
          </div>
          <span>
            Watch<span className="text-indigo-500 dark:text-indigo-400">2</span>Gether
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {/* Theme Toggle Button */}
          <button
            id="theme-toggle-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {user && !isAuthPage ? (
            <div className="flex items-center gap-3">
              {/* Notifications Bell Icon and Dropdown Tray */}
              <div className="relative">
                <button
                  onClick={() => setIsOpen(!isOpen)}
                  className={`p-2 rounded-xl border transition-all cursor-pointer relative shrink-0 ${isOpen
                      ? 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-300 dark:border-indigo-500/40 text-indigo-500 dark:text-indigo-400'
                      : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 border border-white dark:border-slate-950 rounded-full text-[8px] font-extrabold text-white flex items-center justify-center animate-pulse">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {/* Notification Dropdown Container */}
                {isOpen && (
                  <div className="absolute right-0 mt-3 w-80 bg-white/95 dark:bg-slate-950/95 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-4 z-50 backdrop-blur-md animate-fade-in flex flex-col gap-3 max-h-[400px] overflow-hidden">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-900 pb-2 shrink-0">
                      <span className="text-xs font-bold text-slate-800 dark:text-white font-display">Notifications</span>
                      <div className="flex gap-2">
                        {notifications.length > 0 && (
                          <>
                            <button
                              onClick={markAllAsRead}
                              className="text-[10px] text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 font-bold transition-all cursor-pointer"
                            >
                              Mark all read
                            </button>
                            <span className="text-slate-300 dark:text-slate-700 text-[10px]">|</span>
                            <button
                              onClick={clearAll}
                              className="text-[10px] text-rose-500 dark:text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 font-bold transition-all cursor-pointer"
                            >
                              Clear all
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 max-h-[280px] pr-1">
                      {notifications.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs">
                          <Bell className="w-5 h-5 mx-auto mb-2 text-slate-300 dark:text-slate-700 animate-bounce" />
                          No notifications yet
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <div
                            key={notif.id}
                            onClick={() => handleNotificationClick(notif)}
                            className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-2 relative ${notif.isRead
                                ? 'bg-slate-50/50 dark:bg-slate-950/40 border-slate-100 dark:border-slate-900/40 opacity-70 hover:opacity-100 hover:border-slate-200 dark:hover:border-slate-800'
                                : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm shadow-indigo-500/5'
                              }`}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex gap-2 min-w-0">
                                <div className={`p-1.5 rounded-lg border text-indigo-500 dark:text-indigo-400 shrink-0 ${notif.type === 'friend_request'
                                    ? 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-900/30'
                                    : notif.type === 'mention'
                                      ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/30 text-amber-500 dark:text-amber-400'
                                      : 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900/30 text-indigo-500 dark:text-indigo-400'
                                  }`}>
                                  {notif.type === 'friend_request' ? (
                                    <UserPlus className="w-3.5 h-3.5" />
                                  ) : notif.type === 'mention' ? (
                                    <MessageSquare className="w-3.5 h-3.5" />
                                  ) : (
                                    <Tv className="w-3.5 h-3.5" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-xs font-bold text-slate-800 dark:text-white truncate">{notif.title}</h4>
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5 break-words">
                                    {notif.content}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={(e) => deleteNotification(notif.id, e)}
                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg cursor-pointer shrink-0 transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>

                            {notif.type === 'friend_request' && !notif.isRead && (
                              <div className="flex gap-2 mt-1 justify-end">
                                <button
                                  onClick={(e) => handleFriendRequestAction(notif.referenceId, 'reject', notif.id, e)}
                                  className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 hover:bg-slate-200 dark:hover:bg-slate-900 text-[9px] font-bold px-3 py-1 rounded-lg cursor-pointer transition-all text-slate-500 dark:text-slate-400"
                                >
                                  Decline
                                </button>
                                <button
                                  onClick={(e) => handleFriendRequestAction(notif.referenceId, 'accept', notif.id, e)}
                                  className="bg-indigo-600 hover:bg-indigo-500 text-[9px] font-bold px-3 py-1 rounded-lg text-white cursor-pointer transition-all shadow-sm"
                                >
                                  Accept
                                </button>
                              </div>
                            )}

                            {(notif.type === 'room_invite' || notif.type === 'friend_started_room') && (
                              <div className="flex justify-end mt-1">
                                <button
                                  onClick={() => handleNotificationClick(notif)}
                                  className="bg-indigo-600 hover:bg-indigo-500 text-[9px] font-bold px-3 py-1 rounded-lg text-white cursor-pointer transition-all shadow-sm flex items-center gap-1"
                                >
                                  <span>Join Lounge</span>
                                  <ArrowRight className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Avatar in Navbar */}
              <Link to="/profile" className="relative group focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-full shrink-0">
                <div className="w-8 h-8 rounded-full overflow-hidden border border-indigo-500/40 shadow-md shadow-indigo-500/5 group-hover:border-indigo-400 group-hover:shadow-indigo-500/20 transition-all duration-200">
                  <img
                    src={user.avatarUrl ? (user.avatarUrl.startsWith('http') || user.avatarUrl.startsWith('data:') ? user.avatarUrl : `${import.meta.env.VITE_WS_URL || 'http://localhost:3000'}${user.avatarUrl}`) : 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&w=64&h=64&q=80'}
                    alt="Navbar Profile Avatar"
                    className="w-full h-full object-cover"
                  />
                </div>
              </Link>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Hi, <span className="font-semibold text-slate-800 dark:text-white">{user.username}</span>
              </span>
              <Link
                to="/profile"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white text-xs font-semibold rounded-lg transition-all border border-slate-200 dark:border-slate-800"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Profile</span>
              </Link>
              <button
                onClick={logout}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white text-xs font-semibold rounded-lg transition-all cursor-pointer border border-slate-200 dark:border-slate-800"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>
          ) : (
            <div className="text-xs text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 rounded-full px-3 py-1 font-mono">
              v1.0.0 (JS/ESM)
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function NotificationToast() {
  const { user, fetchWithAuth } = useAuth();
  const navigate = useNavigate();
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    if (!user) {
      setNotification(null);
      return;
    }

    const handleNewNotification = (notif) => {
      setNotification(notif);
    };

    socket.on('notification-received', handleNewNotification);

    return () => {
      socket.off('notification-received', handleNewNotification);
    };
  }, [user]);



  if (!notification) return null;

  const handleFriendRequestAction = async (requestId, action, notificationId) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
      const res = await fetchWithAuth(`${apiUrl}/friends/requests/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        await fetchWithAuth(`${apiUrl}/notifications/${notificationId}`, {
          method: 'DELETE',
        });
        setNotification(null);
      } else {
        const data = await res.json();
        alert(data.message || 'Error processing friend request');
      }
    } catch (err) {
      console.error('Error handling friend request action:', err);
    }
  };

  const handleNotificationClick = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
      await fetchWithAuth(`${apiUrl}/notifications/${notification.id}/read`, {
        method: 'PUT',
      });
    } catch (err) {
      console.error('Error reading notification:', err);
    }
    setNotification(null);
    if (['room_invite', 'friend_started_room', 'mention'].includes(notification.type) && notification.referenceId) {
      navigate(`/room/${notification.referenceId}`);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-white/95 dark:bg-slate-900/90 border border-slate-200 dark:border-indigo-500/30 rounded-3xl p-6 shadow-2xl backdrop-blur-md animate-fade-in flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 text-left">
          <div className={`p-2.5 rounded-xl border shrink-0 ${notification.type === 'friend_request'
              ? 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-500/20 text-purple-500 dark:text-purple-400'
              : notification.type === 'mention'
                ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-500/20 text-amber-500 dark:text-amber-400'
                : 'bg-indigo-50 dark:bg-indigo-950/10 text-indigo-500 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20'
            }`}>
            {notification.type === 'friend_request' ? (
              <UserPlus className="w-5 h-5 animate-pulse" />
            ) : notification.type === 'mention' ? (
              <MessageSquare className="w-5 h-5 animate-pulse" />
            ) : (
              <Tv className="w-5 h-5 animate-bounce" />
            )}
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{notification.title}</h4>
            <p className="text-sm font-semibold text-slate-800 dark:text-white mt-0.5 font-display break-words">
              {notification.content}
            </p>
          </div>
        </div>
        <button
          onClick={() => setNotification(null)}
          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg transition-colors cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {notification.type === 'friend_request' ? (
        <div className="flex gap-2">
          <button
            onClick={() => handleFriendRequestAction(notification.referenceId, 'reject', notification.id)}
            className="flex-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 hover:bg-slate-200 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-bold py-2.5 rounded-xl transition-all cursor-pointer font-sans"
          >
            Decline
          </button>
          <button
            onClick={() => handleFriendRequestAction(notification.referenceId, 'accept', notification.id)}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-600/25 cursor-pointer font-sans"
          >
            Accept
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => setNotification(null)}
            className="flex-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 hover:bg-slate-200 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-bold py-2.5 rounded-xl transition-all cursor-pointer font-sans"
          >
            Dismiss
          </button>
          {['room_invite', 'friend_started_room', 'mention'].includes(notification.type) && (
            <button
              onClick={handleNotificationClick}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-600/25 cursor-pointer font-sans flex items-center justify-center gap-1.5"
            >
              <span>Join Lounge</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200">
            <Navbar />
            <NotificationToast />

            {/* Main Layout Area */}
            <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
              <AppRoutes />
            </main>

            {/* Site Footer */}
            <footer className="border-t border-slate-200 dark:border-slate-900/60 bg-white dark:bg-slate-950 py-8 text-center text-xs text-slate-400 dark:text-slate-500">
              <p>© {new Date().getFullYear()} Watch2Gether. Built with React &amp; Socket.IO.</p>
            </footer>
          </div>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
