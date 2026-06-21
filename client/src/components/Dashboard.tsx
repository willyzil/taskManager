import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import ActivityFeed from './ActivityFeed';

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
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
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

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    const data = await api.delete(`/api/projects/${confirmDelete.id}`);
    if (data.success) {
      setProjects(prev => prev.filter(p => p.id !== confirmDelete.id));
    }
    setDeleting(false);
    setConfirmDelete(null);
  };

  return (
    <div className="p-6 flex flex-col lg:flex-row gap-6 min-h-screen bg-[var(--background)] text-text dashboard-main">
      {/* Projects section - left 2/3 */}
      <div className="flex-1">
        <div className="flex justify-between items-center mb-6 dashboard-header">
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <button
            onClick={() => setShowModal(true)}
            className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white px-4 py-2.5 rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all-fast font-medium text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Project
          </button>
        </div>

        {loading ? (
          <p className="text-text-subtle">Loading...</p>
        ) : projects.length === 0 ? (
          <div className="text-center py-20 text-text-subtle/70 bg-[var(--card)]/30 rounded-xl border-2 border-dashed border-border-subtle/40">
            <div className="empty-icon mb-3">
              <svg className="w-10 h-10 text-text-subtle/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <p className="text-lg font-medium mb-1">No projects yet</p>
            <p className="text-sm">Click "New Project" to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 projects-grid">
            {projects.map(project => (
              <div key={project.id} className="bg-[var(--card)] border border-border-subtle rounded-xl p-5 transition-all-fast hover:shadow-xl hover:-translate-y-1 hover:border-accent/30 group cursor-pointer project-card">
                <div className="flex justify-between items-start mb-3 project-header">
                  <h2 className="text-xl font-bold tracking-tight group-hover:text-white transition-colors">{project.name}</h2>
                  {project.ownerId === user?.id && (
                    <button
                      onClick={() => setConfirmDelete(project)}
                      className="text-xs text-text-subtle hover:text-error transition-colors p-1"
                    >
                      Delete
                    </button>
                  )}
                </div>
                {project.description && (
                  <p className="text-sm text-text-muted line-clamp-2 mb-3">{project.description}</p>
                )}
                <p className="text-xs text-text-subtle">
                  Created {new Date(project.createdAt).toLocaleDateString()}
                </p>
                <div className="mt-4 pt-3 border-t border-border-subtle/30 flex justify-between items-center">
                  <button
                    onClick={() => navigate(`/project/${project.id}`)}
                    className="text-accent hover:text-accent/80 text-sm font-medium transition-colors flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"
                  >
                    View Board
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* New Project modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]">
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

        {/* Delete confirmation modal */}
        {confirmDelete && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]">
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 w-full max-w-sm">
              <h2 className="text-lg font-semibold mb-2">Delete Project</h2>
              <p className="text-gray-400 text-sm mb-1">
                Are you sure you want to delete{' '}
                <span className="text-white font-medium">"{confirmDelete.name}"</span>?
              </p>
              <p className="text-gray-500 text-xs mb-6">
                This will permanently remove all tasks and data. This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="px-4 py-2 rounded-md bg-gray-700 hover:bg-gray-600 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-sm disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Activity Feed - right 1/3, stacks below on mobile */}
      <div className="w-full lg:w-[350px] mt-6 lg:mt-0 dashboard-activity">
        <ActivityFeed />
      </div>
    </div>
  );
};

export default Dashboard;
