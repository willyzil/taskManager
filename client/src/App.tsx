import './index.css';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import ProjectBoard from './components/ProjectBoard';
import { AuthProvider } from './contexts/AuthContext';
import Sidebar from './components/Sidebar';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Sidebar />
          <div className="ml-60">
            <Routes>
              <Route 
                path="/login" 
                element={<Login />} 
              />
              <Route 
                path="/register" 
                element={<Register />} 
              />
              <Route 
                path="/dashboard" 
                element={<Dashboard />} 
              />
              <Route 
                path="/project/:id" 
                element={<ProjectBoard />} 
              />
              <Route path="/" element={<Navigate to="/dashboard" />} />
            </Routes>
          </div>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;