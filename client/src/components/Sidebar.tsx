import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { api } from '../api';

interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
  projectId?: string;
}

const Sidebar: React.FC<{ mobileOpen?: boolean }> = ({ mobileOpen = false }) => {
  const { user, logout } = useAuth();
  const { socket } = useSocket();
  const location = useLocation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showPanel, setShowPanel] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;
  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    if (!user) return;
    api.get('/api/notifications').then(data => {
      if (data.success) setNotifications(data.notifications);
    });
  }, [user]);

  useEffect(() => {
    if (!socket) return;
    const handler = (n: Notification) => setNotifications(prev => [n, ...prev]);
    socket.on('notification', handler);
    return () => { socket.off('notification', handler); };
  }, [socket]);

  const markRead = async (id: string) => {
    await api.patch(`/api/notifications/${id}/read`, {});
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = async () => {
    await api.post('/api/notifications/read-all', {});
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  return (
    <>
      {/* Desktop sidebar — always visible, fixed layout */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:bg-[var(--sidebar)] lg:text-text lg:border-r lg:border-border-subtle lg:flex-shrink-0 lg:h-screen lg:fixed lg:left-0 lg:top-0">
        <div className="p-5 flex items-center gap-3 border-b border-border-subtle bg-[var(--sidebar)]/95 backdrop-blur-sm">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg">
            T
          </div>
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Task Manager
          </h1>
        </div>

        <nav className="flex-1 py-4 px-2 overflow-y-auto">
          <ul className="space-y-1">
            <li>
              <Link
                to="/dashboard"
                className={`flex w-full px-4 py-2.5 rounded-lg mb-1.5 flex items-center gap-2.5 cursor-pointer transition-all-fast hover:bg-[var(--card)]/50 hover:translate-x-0.5 ${isActive('/dashboard') ? 'bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-l-2 border-accent bg-[var(--card)]/60 text-text-inverse' : 'text-text-subtle hover:text-text'}`}
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                Projects
              </Link>
            </li>
          </ul>
        </nav>

        {/* Desktop notifications */}
        <div className="px-3 mb-2 relative">
          <button
            onClick={() => setShowPanel(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-[var(--card)]/50 transition-all-fast text-text-subtle hover:text-text"
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="text-sm font-medium">Notifications</span>
            </div>
            {unreadCount > 0 && (
              <span className="bg-accent text-white text-xs font-semibold rounded-full px-2.5 py-0.75 min-w-[20px] text-center shadow-md ring-2 ring-[var(--sidebar)]">
                {unreadCount}
              </span>
            )}
          </button>

          {showPanel && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-[var(--sidebar)] border border-border-subtle rounded-xl shadow-2xl max-h-80 overflow-y-auto z-[100]">
              <div className="sticky top-0 bg-[var(--sidebar)] flex justify-between items-center px-3 py-2.5 border-b border-border-subtle bg-[var(--sidebar)]/95 backdrop-blur-sm">
                <span className="text-xs font-semibold text-text-subtle">Notifications</span>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-xs text-accent hover:text-accent/80 transition-colors font-medium">
                    Mark all read
                  </button>
                )}
              </div>
              {notifications.length === 0 ? (
                <p className="text-xs text-text-subtle text-center py-8">No notifications yet</p>
              ) : (
                notifications.map(n => (
                  <div
                    key={n.id}
                    onClick={() => !n.read && markRead(n.id)}
                    className={`px-3 py-2.5 border-b border-border-subtle/50 cursor-pointer transition-colors ${!n.read ? 'bg-[var(--card)]/60' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-accent shrink-0 animate-pulse" />}
                      <p className={`text-xs leading-snug ${n.read ? 'text-text-subtle/70' : 'text-text'}`}>
                        {n.message}
                      </p>
                    </div>
                    <p className="text-xs text-text-subtle/50 mt-0.5 ml-4">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border-subtle flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold shadow-md ring-2 ring-[var(--sidebar)] flex-shrink-0">
            {user?.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-inverse truncate">{user?.name}</p>
            <p className="text-xs text-text-subtle truncate">{user?.email}</p>
          </div>
        </div>

        <button
          onClick={logout}
          className="w-full px-4 py-2.5 text-sm rounded-lg bg-[var(--card)]/50 hover:bg-[var(--card)] border border-border-subtle/50 hover:border-accent/30 transition-all-fast text-text-subtle hover:text-accent flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </button>
      </div>

      {/* Mobile sidebar — hidden by default, slides in when open */}
      <div className={`lg:hidden fixed inset-y-0 left-0 w-64 bg-[var(--sidebar)] text-text flex flex-col border-r border-border-subtle flex-shrink-0 z-50 transition-transform duration-300 ease-in-out ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-5 flex items-center gap-3 border-b border-border-subtle bg-[var(--sidebar)]/95 backdrop-blur-sm">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg">
            T
          </div>
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Task Manager
          </h1>
        </div>

        <nav className="flex-1 py-4 px-2 overflow-y-auto">
          <ul className="space-y-1">
            <li>
              <Link
                to="/dashboard"
                className={`flex w-full px-4 py-2.5 rounded-lg mb-1.5 flex items-center gap-2.5 cursor-pointer transition-all-fast hover:bg-[var(--card)]/50 hover:translate-x-0.5 ${isActive('/dashboard') ? 'bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-l-2 border-accent bg-[var(--card)]/60 text-text-inverse' : 'text-text-subtle hover:text-text'}`}
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                Projects
              </Link>
            </li>
          </ul>
        </nav>

        {/* Mobile notifications */}
        <div className="px-3 mb-2 relative">
          <button
            onClick={() => setShowPanel(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-[var(--card)]/50 transition-all-fast text-text-subtle hover:text-text"
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="text-sm font-medium">Notifications</span>
            </div>
            {unreadCount > 0 && (
              <span className="bg-accent text-white text-xs font-semibold rounded-full px-2.5 py-0.75 min-w-[20px] text-center shadow-md ring-2 ring-[var(--sidebar)]">
                {unreadCount}
              </span>
            )}
          </button>

          {showPanel && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-[var(--sidebar)] border border-border-subtle rounded-xl shadow-2xl max-h-80 overflow-y-auto z-[100]">
              <div className="sticky top-0 bg-[var(--sidebar)] flex justify-between items-center px-3 py-2.5 border-b border-border-subtle bg-[var(--sidebar)]/95 backdrop-blur-sm">
                <span className="text-xs font-semibold text-text-subtle">Notifications</span>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-xs text-accent hover:text-accent/80 transition-colors font-medium">
                    Mark all read
                  </button>
                )}
              </div>
              {notifications.length === 0 ? (
                <p className="text-xs text-text-subtle text-center py-8">No notifications yet</p>
              ) : (
                notifications.map(n => (
                  <div
                    key={n.id}
                    onClick={() => !n.read && markRead(n.id)}
                    className={`px-3 py-2.5 border-b border-border-subtle/50 cursor-pointer transition-colors ${!n.read ? 'bg-[var(--card)]/60' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-accent shrink-0 animate-pulse" />}
                      <p className={`text-xs leading-snug ${n.read ? 'text-text-subtle/70' : 'text-text'}`}>
                        {n.message}
                      </p>
                    </div>
                    <p className="text-xs text-text-subtle/50 mt-0.5 ml-4">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border-subtle flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold shadow-md ring-2 ring-[var(--sidebar)] flex-shrink-0">
            {user?.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-inverse truncate">{user?.name}</p>
            <p className="text-xs text-text-subtle truncate">{user?.email}</p>
          </div>
        </div>

        <button
          onClick={logout}
          className="w-full px-4 py-2.5 text-sm rounded-lg bg-[var(--card)]/50 hover:bg-[var(--card)] border border-border-subtle/50 hover:border-accent/30 transition-all-fast text-text-subtle hover:text-accent flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </button>
      </div>
    </>
  );
};

export default Sidebar;
