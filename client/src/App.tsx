import { useState, useEffect } from 'react';
import './index.css';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import ProjectBoard from './components/ProjectBoard';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import Sidebar from './components/Sidebar';

const AUTH_PATHS= ['/login', '/register'];

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function MobileMenuButton() {
  const [isOpen, setIsOpen] = useState(false);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    setIsOpen(false);
  }, [useLocation().pathname]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setIsOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (isAuthenticated) {
    return (
      <>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="lg:hidden fixed top-4 left-4 z-40 w-10 h-10 flex items-center justify-center rounded-lg bg-[var(--card)] border border-border-subtle shadow-lg"
          aria-label="Toggle menu"
        >
          <svg className="w-5 h-5 text-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
        {isOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
            onClick={() => setIsOpen(false)}
          />
        )}
        <Sidebar mobileOpen={isOpen} />
      </>
    );
  }

  return null;
}

function Layout() {
  const location = useLocation();
  const isAuthPage = AUTH_PATHS.includes(location.pathname);

  return (
    <div className="App">
      {!isAuthPage && <MobileMenuButton />}
      <div className={!isAuthPage ? 'lg:ml-64' : ''}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/project/:id"
            element={
              <ProtectedRoute>
                <ProjectBoard />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <SocketProvider>
          <Layout />
        </SocketProvider>
      </Router>
    </AuthProvider>
  );
}

export default App;
