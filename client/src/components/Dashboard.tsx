import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';

interface Project {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  createdAt: string;
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/api/projects')
      .then(data => { if (data.success) setProjects(data.projects); })
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    const data = await api.post('/api/projects', { name: newName, description: newDesc || undefined });
    if (data.success) {
      setProjects(prev => [...prev, data.project]);
      setShowModal(false);
      setNewName('');
      setNewDesc('');
    } else {
      setError(data.message || 'Failed to create project');
    }
    setCreating(false);
  };

  const handleDelete = async (projectId: string, projectName: string) => {
    if (!window.confirm(`Delete "${projectName}"? This will permanently remove all tasks and data.`)) return;
    const data = await api.delete(`/api/projects/${projectId}`);
    if (data.success) {
      setProjects(prev => prev.filter(p => p.id !== projectId));
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          New Project
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : projects.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg mb-2">No projects yet</p>
          <p className="text-sm">Click "New Project" to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(project => (
            <div key={project.id} className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
              <div className="p-4">
                <h2 className="text-lg font-semibold mb-2">{project.name}</h2>
                {project.description && (
                  <p className="text-sm text-gray-400 mb-3">{project.description}</p>
                )}
                <p className="text-xs text-gray-500">
                  Created {new Date(project.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="px-4 py-3 bg-gray-900 border-t border-gray-700 flex justify-between items-center">
                <button
                  onClick={() => navigate(`/project/${project.id}`)}
                  className="text-blue-400 hover:text-blue-300 text-sm"
                >
                  View Board →
                </button>
                {project.ownerId === user?.id && (
                  <button
                    onClick={() => handleDelete(project.id, project.name)}
                    className="text-xs text-gray-600 hover:text-red-400"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">New Project</h2>
            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
            <form onSubmit={handleCreate}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  autoFocus
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Description <span className="text-gray-500">(optional)</span>
                </label>
                <textarea
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setError(''); }}
                  className="px-4 py-2 rounded-md bg-gray-700 hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
