import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
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
              className={`w-full px-4 py-2 rounded-md ${isActive('/dashboard') ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
            >
              Dashboard
            </Link>
          </li>
          <li>
            <Link
              to="/dashboard"
              className={`w-full px-4 py-2 rounded-md ${isActive('/dashboard') ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
            >
              Projects
            </Link>
          </li>
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="bg-gray-600 rounded-full w-10 h-10 flex items-center justify-center">
            <span className="font-semibold">{user?.name.charAt(0)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
        </div>
        <button 
          onClick={logout}
          className="mt-3 w-full px-3 py-2 text-sm rounded-md bg-gray-700 hover:bg-gray-600"
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default Sidebar;