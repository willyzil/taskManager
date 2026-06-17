import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';

const STATUS_ORDER = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as const;
type Status = typeof STATUS_ORDER[number];

const COLUMN_TITLES: Record<Status, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-600',
  MEDIUM: 'bg-blue-600',
  HIGH: 'bg-orange-600',
  URGENT: 'bg-red-600',
};

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  priority: string;
  dueDate: string | null;
  assignee: { id: string; name: string } | null;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
}

const ProjectBoard: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // Add task modal
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState('MEDIUM');
  const [newAssigneeId, setNewAssigneeId] = useState('');
  const [creating, setCreating] = useState(false);
  const [taskError, setTaskError] = useState('');

  // Invite member modal
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; email: string }[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get(`/api/projects/${id}`),
      api.get(`/api/tasks?projectId=${id}`),
      api.get(`/api/projects/${id}/members`),
    ]).then(([projectData, tasksData, membersData]) => {
      if (projectData.success) setProject(projectData.project);
      if (tasksData.success) setTasks(tasksData.tasks);
      if (membersData.success) setMembers(membersData.members);
    }).finally(() => setLoading(false));
  }, [id]);

  const moveTask = async (taskId: string, currentStatus: Status) => {
    const idx = STATUS_ORDER.indexOf(currentStatus);
    if (idx === STATUS_ORDER.length - 1) return;
    const nextStatus = STATUS_ORDER[idx + 1];
    const data = await api.patch(`/api/tasks/${taskId}`, { status: nextStatus });
    if (data.success) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: nextStatus } : t));
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setTaskError('');
    const data = await api.post('/api/tasks', {
      title: newTitle,
      projectId: id,
      priority: newPriority,
      assigneeId: newAssigneeId || undefined,
    });
    if (data.success) {
      setTasks(prev => [...prev, data.task]);
      setShowAddTask(false);
      setNewTitle('');
      setNewPriority('MEDIUM');
      setNewAssigneeId('');
    } else {
      setTaskError(data.message || 'Failed to create task');
    }
    setCreating(false);
  };

  const handleDeleteTask = async (taskId: string) => {
    const data = await api.delete(`/api/tasks/${taskId}`);
    if (data.success) setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const handleInviteSearch = (value: string) => {
    setInviteEmail(value);
    setShowDropdown(false);
    clearTimeout(searchTimeout.current);
    if (value.trim().length < 2) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      const data = await api.get(`/api/users/search?q=${encodeURIComponent(value)}`);
      if (data.success) {
        const existingIds = new Set(members.map(m => m.id));
        setSearchResults(data.users.filter((u: { id: string }) => !existingIds.has(u.id)));
        setShowDropdown(true);
      }
    }, 300);
  };

  const selectSearchResult = (u: { id: string; name: string; email: string }) => {
    setInviteEmail(u.email);
    setSearchResults([]);
    setShowDropdown(false);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setInviteError('');
    setInviteSuccess('');
    const data = await api.post(`/api/projects/${id}/members`, { email: inviteEmail });
    if (data.success) {
      setMembers(prev => [...prev, data.member]);
      setInviteSuccess(`${data.member.name} has been added to the project`);
      setInviteEmail('');
    } else {
      setInviteError(data.message || 'Failed to invite member');
    }
    setInviting(false);
  };

  const closeInviteModal = () => {
    setShowInvite(false);
    setInviteEmail('');
    setInviteError('');
    setInviteSuccess('');
    setSearchResults([]);
    setShowDropdown(false);
  };

  if (loading) return <div className="p-6 text-gray-400">Loading...</div>;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm text-gray-400 hover:text-gray-300 mb-1 block"
          >
            ← Back to Projects
          </button>
          <h1 className="text-2xl font-bold">{project?.name || 'Project Board'}</h1>
          {project?.description && (
            <p className="text-sm text-gray-400 mt-1">{project.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Member avatars */}
          <div className="flex items-center gap-1">
            {members.slice(0, 5).map(m => (
              <div
                key={m.id}
                title={`${m.name} (${m.role})`}
                className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-xs font-semibold border-2 border-gray-900"
              >
                {m.name.charAt(0).toUpperCase()}
              </div>
            ))}
            {members.length > 5 && (
              <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-xs">
                +{members.length - 5}
              </div>
            )}
          </div>
          <button
            onClick={() => setShowInvite(true)}
            className="text-sm px-3 py-1.5 rounded-md border border-gray-600 hover:bg-gray-700"
          >
            + Invite
          </button>
          <button
            onClick={() => setShowAddTask(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
          >
            Add Task
          </button>
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex space-x-4 overflow-x-auto pb-4">
        {STATUS_ORDER.map(status => {
          const columnTasks = tasks.filter(t => t.status === status);
          const nextStatus = STATUS_ORDER[STATUS_ORDER.indexOf(status) + 1];
          return (
            <div key={status} className="flex-shrink-0 w-72 bg-gray-800 rounded-lg border border-gray-700">
              <div className="p-3 border-b border-gray-700 flex items-center gap-2">
                <h2 className="font-medium text-sm">{COLUMN_TITLES[status]}</h2>
                <span className="text-xs bg-gray-700 rounded-full px-2 py-0.5">{columnTasks.length}</span>
              </div>
              <div className="p-2 space-y-2 min-h-[80px]">
                {columnTasks.map(task => (
                  <div
                    key={task.id}
                    className="bg-gray-900 rounded-md border border-gray-700 p-3 hover:border-gray-600 transition-colors"
                  >
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <h3 className="font-medium text-sm flex-1">{task.title}</h3>
                      <span className={`text-xs rounded-full px-2 py-0.5 shrink-0 ${PRIORITY_COLORS[task.priority] || 'bg-gray-600'}`}>
                        {task.priority}
                      </span>
                    </div>
                    {task.assignee ? (
                      <div className="flex items-center gap-1.5 mb-2">
                        <div className="bg-blue-700 rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">
                          {task.assignee.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs text-gray-400">{task.assignee.name}</span>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-600 mb-2">Unassigned</p>
                    )}
                    {task.dueDate && (
                      <p className="text-xs text-gray-500 mb-2">
                        Due {new Date(task.dueDate).toLocaleDateString()}
                      </p>
                    )}
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-800">
                      {nextStatus ? (
                        <button
                          onClick={() => moveTask(task.id, status)}
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          → {COLUMN_TITLES[nextStatus]}
                        </button>
                      ) : (
                        <span className="text-xs text-green-500">Done</span>
                      )}
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="text-xs text-gray-600 hover:text-red-400"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {columnTasks.length === 0 && (
                  <p className="text-xs text-gray-600 text-center py-6">No tasks</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Task modal */}
      {showAddTask && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Add Task</h2>
            {taskError && <p className="text-red-400 text-sm mb-4">{taskError}</p>}
            <form onSubmit={handleAddTask}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-1">Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  autoFocus
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-1">Priority</label>
                <select
                  value={newPriority}
                  onChange={e => setNewPriority(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Assign to <span className="text-gray-500">(optional)</span>
                </label>
                <select
                  value={newAssigneeId}
                  onChange={e => setNewAssigneeId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Unassigned</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.role})</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => { setShowAddTask(false); setTaskError(''); }}
                  className="px-4 py-2 rounded-md bg-gray-700 hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  {creating ? 'Adding...' : 'Add Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite member modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-1">Invite Member</h2>
            <p className="text-sm text-gray-400 mb-4">The user must already have an account.</p>
            {inviteError && <p className="text-red-400 text-sm mb-3">{inviteError}</p>}
            {inviteSuccess && <p className="text-green-400 text-sm mb-3">{inviteSuccess}</p>}

            {/* Current members list */}
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Current members</p>
              <div className="space-y-1">
                {members.map(m => (
                  <div key={m.id} className="flex items-center gap-2 text-sm">
                    <div className="w-6 h-6 rounded-full bg-blue-700 flex items-center justify-center text-xs shrink-0">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <span>{m.name}</span>
                    <span className="text-xs text-gray-500 ml-auto">{m.role}</span>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleInvite}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-1">Search by name or email</label>
                <div className="relative">
                  <input
                    type="text"
                    value={inviteEmail}
                    onChange={e => handleInviteSearch(e.target.value)}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                    onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                    placeholder="Start typing a name or email..."
                    className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    autoFocus
                  />
                  {showDropdown && searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-md shadow-xl z-10 overflow-hidden">
                      {searchResults.map(u => (
                        <button
                          key={u.id}
                          type="button"
                          onMouseDown={() => selectSearchResult(u)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-800 flex items-center gap-3 transition-colors"
                        >
                          <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-sm font-semibold shrink-0">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm text-white">{u.name}</p>
                            <p className="text-xs text-gray-400">{u.email}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {inviteEmail.length >= 2 && !showDropdown && searchResults.length === 0 && (
                    <p className="mt-1 text-xs text-gray-500">No users found — you can still invite by exact email</p>
                  )}
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={closeInviteModal}
                  className="px-4 py-2 rounded-md bg-gray-700 hover:bg-gray-600"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  {inviting ? 'Inviting...' : 'Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectBoard;
