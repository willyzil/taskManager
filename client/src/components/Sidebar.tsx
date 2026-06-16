import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { io as socketIO, Socket } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';

interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
  projectId?: string;
}

const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const unreadCount = notifications.filter(n => !n.read).length;
  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    if (!user) return;

    api.get('/api/notifications').then(data => {
      if (data.success) setNotifications(data.notifications);
    });

    const socket = socketIO({ path: '/socket.io', transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('connect', () => socket.emit('join', user.id));
    socket.on('notification', (n: Notification) => {
      setNotifications(prev => [n, ...prev]);
    });

    return () => { socket.disconnect(); };
  }, [user]);

  const markRead = async (id: string) => {
    await api.patch(`/api/notifications/${id}/read`, {});
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = async () => {
    await api.post('/api/notifications/read-all', {});
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  return (
    <div className="fixed inset-y-0 left-0 w-60 bg-gray-800 text-white flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-xl font-bold">Task Manager</h1>
      </div>

      <nav className="flex-1 p-2">
        <ul className="space-y-1">
          <li>
            <Link
              to="/dashboard"
              className={`flex w-full px-4 py-2 rounded-md ${isActive('/dashboard') ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
            >
              Projects
            </Link>
          </li>
        </ul>
      </nav>

      {/* Notifications */}
      <div className="relative px-3 mb-2">
        <button
          onClick={() => setShowPanel(v => !v)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-700 text-sm"
        >
          <span>Notifications</span>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5 min-w-[20px] text-center">
              {unreadCount}
            </span>
          )}
        </button>

        {showPanel && (
          <div className="absolute bottom-full left-0 right-0 mb-1 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl max-h-80 overflow-y-auto z-50">
            <div className="sticky top-0 bg-gray-900 flex justify-between items-center px-3 py-2 border-b border-gray-700">
              <span className="text-xs font-semibold text-gray-300">Notifications</span>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs text-blue-400 hover:text-blue-300">
                  Mark all read
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-8">No notifications yet</p>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => !n.read && markRead(n.id)}
                  className={`px-3 py-2 border-b border-gray-800 cursor-pointer hover:bg-gray-800 transition-colors ${!n.read ? 'bg-gray-800/60' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                    <p className={`text-xs leading-snug ${n.read ? 'text-gray-400 ml-4' : 'text-white'}`}>
                      {n.message}
                    </p>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5 ml-4">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center space-x-3 mb-3">
          <div className="bg-blue-600 rounded-full w-9 h-9 flex items-center justify-center shrink-0">
            <span className="font-semibold text-sm">{user?.name.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full px-3 py-2 text-sm rounded-md bg-gray-700 hover:bg-gray-600"
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
