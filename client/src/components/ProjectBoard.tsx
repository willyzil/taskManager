import React, { useState, useEffect, useRef } from 'react';
// FORCE_REBUILD_MARKER_xyz789: v3 - assignee dropdown
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useSocket } from '../contexts/SocketContext';

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

interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  order: number;
}

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
  taskOrder: number;
  assignee: { id: string; name: string } | null;
  subtasks?: Subtask[];
}

interface Project {
  id: string;
  name: string;
  description: string | null;
}

const ProjectBoard: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { socket } = useSocket();

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // Add task modal
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState('MEDIUM');
  const [newAssigneeId, setNewAssigneeId] = useState('');
  const [taskError, setTaskError] = useState('');

  // Invite member modal
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; email: string }[]>([]);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [filterAssignee, setFilterAssignee] = useState<string>('ALL');

  // Subtask state
  const [addingSubtaskId, setAddingSubtaskId] = useState<string | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState('');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [assigneeTaskId, setAssigneeTaskId] = useState<string | null>(null);

  // ===== MOVE FORWARD =====
  const handleMoveTask = async (taskId: string, fromStatus: Status) => {
    const idx = STATUS_ORDER.indexOf(fromStatus);
    if (idx >= STATUS_ORDER.length - 1) return;
    const nextStatus = STATUS_ORDER[idx + 1];
    const data = await api.patch(`/api/tasks/${taskId}`, { status: nextStatus });
    if (data.success) {
      const tasksData = await api.get(`/api/tasks?projectId=${id}`);
      if (tasksData.success) setTasks([...tasksData.tasks]);
    }
  };

  // ===== MOVE BACKWARD =====
  const handleMoveTaskBack = async (taskId: string, fromStatus: Status) => {
    const idx = STATUS_ORDER.indexOf(fromStatus);
    if (idx <= 0) return;
    const prevStatus = STATUS_ORDER[idx - 1];
    const data = await api.patch(`/api/tasks/${taskId}`, { status: prevStatus });
    if (data.success) {
      const tasksData = await api.get(`/api/tasks?projectId=${id}`);
      if (tasksData.success) setTasks([...tasksData.tasks]);
    }
  };

  // ===== OTHER HANDLERS =====
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
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
  };

  const handleDeleteTask = async (taskId: string) => {
    const data = await api.delete(`/api/tasks/${taskId}`);
    if (data.success) setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const handleInviteSearch = (value: string) => {
    setInviteEmail(value);
    clearTimeout(searchTimeout.current);
    if (value.trim().length < 2) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      const data = await api.get(`/api/users/search?q=${encodeURIComponent(value)}`);
      if (data.success) {
        const existingIds = new Set(members.map(m => m.id));
        setSearchResults(data.users.filter((u: { id: string }) => !existingIds.has(u.id)));
      }
    }, 300);
  };

  const selectSearchResult = (u: { id: string; name: string; email: string }) => {
    setInviteEmail(u.email);
    setSearchResults([]);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
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
  };

  const closeInviteModal = () => {
    setShowInvite(false);
    setInviteEmail('');
    setInviteError('');
    setInviteSuccess('');
    setSearchResults([]);
  };

  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTaskId(expandedTaskId === taskId ? null : taskId);
  };

  const getSubtaskProgress = (subtasks: Subtask[]) => {
    if (!subtasks || subtasks.length === 0) return { completed: 0, total: 0, percent: 0 };
    const completed = subtasks.filter(s => s.completed).length;
    return { completed, total: subtasks.length, percent: Math.round((completed / subtasks.length) * 100) };
  };

  const handleAddSubtask = async (taskId: string) => {
    if (!newSubtaskTitle.trim() || !id) return;
    try {
      const data = await api.post(`/api/tasks/${taskId}/subtasks`, {
        title: newSubtaskTitle.trim(),
      });
      if (data.success) {
        const tasksData = await api.get(`/api/tasks?projectId=${id}`);
        if (tasksData.success) setTasks([...tasksData.tasks]);
        setNewSubtaskTitle('');
        setAddingSubtaskId(null);
      }
    } catch (err) {
      console.error('Failed to add subtask:', err);
    }
  };

  const handleDeleteSubtask = async (taskId: string, subtaskId: string) => {
    try {
      const data = await api.delete(`/api/tasks/${taskId}/subtasks/${subtaskId}`);
      if (data.success) {
        const tasksData = await api.get(`/api/tasks?projectId=${id}`);
        if (tasksData.success) setTasks([...tasksData.tasks]);
      }
    } catch (err) {
      console.error('Failed to delete subtask:', err);
    }
  };

  const handleToggleSubtask = async (taskId: string, subtaskId: string, completed: boolean) => {
    try {
      const data = await api.patch(`/api/tasks/${taskId}/subtasks/${subtaskId}`, { completed: !completed });
      if (data.success) {
        const tasksData = await api.get(`/api/tasks?projectId=${id}`);
        if (tasksData.success) setTasks([...tasksData.tasks]);
      }
    } catch (err) {
      console.error('Failed to toggle subtask:', err);
    }
  };

  const handleStartEditSubtask = (subtask: Subtask) => {
    setEditingSubtaskId(subtask.id);
    setEditingSubtaskTitle(subtask.title);
  };

  // ===== ASSIGN / REASSIGN (MARKER: v2 - do not remove) =====
  const handleAssignTask = async (taskId: string, memberId: string) => {
    const assigneeId = memberId === 'UNASSIGNED' ? undefined : memberId;
    const data = await api.patch(`/api/tasks/${taskId}`, { assigneeId });
    if (data.success) {
      const tasksData = await api.get(`/api/tasks?projectId=${id}`);
      if (tasksData.success) setTasks([...tasksData.tasks]);
    }
    setAssigneeTaskId(null);
  };

  const handleSaveSubtask = async (taskId: string, subtaskId: string) => {
    if (!editingSubtaskTitle.trim()) return;
    try {
      const data = await api.patch(`/api/tasks/${taskId}/subtasks/${subtaskId}`, {
        title: editingSubtaskTitle.trim(),
      });
      if (data.success) {
        const tasksData = await api.get(`/api/tasks?projectId=${id}`);
        if (tasksData.success) setTasks([...tasksData.tasks]);
      }
    } catch (err) {
      console.error('Failed to update subtask:', err);
    }
    setEditingSubtaskId(null);
    setEditingSubtaskTitle('');
  };

  // ===== LOAD DATA =====
  useEffect(() => {
    if (!socket || !id) return;
    const handleTasksUpdated = (data: { projectId: string; tasks: Task[] }) => {
      if (data.projectId === id) {
        setTasks([...data.tasks]);
      }
    };
    socket.on('tasks:updated', handleTasksUpdated);
    return () => { socket.off('tasks:updated', handleTasksUpdated); };
  }, [socket, id]);

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

  const filteredTasks = tasks.filter(task => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesSearch = task.title.toLowerCase().includes(q) ||
        (task.description && task.description.toLowerCase().includes(q));
      if (!matchesSearch) return false;
    }
    if (filterPriority !== 'ALL' && task.priority !== filterPriority) return false;
    if (filterAssignee !== 'ALL' && (!task.assignee || task.assignee.id !== filterAssignee)) return false;
    return true;
  });

  const getTasksByStatus = (status: Status): Task[] => {
    return filteredTasks.filter(t => t.status === status);
  };

  if (loading) return <div className="p-6 text-gray-400">Loading...</div>;

  return (
    <div className="p-6 min-h-screen bg-[var(--background)] text-text">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-start gap-4 mb-6">
        <div className="flex-1">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-text-subtle hover:text-accent transition-colors mb-2 block flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm font-medium">Back to Projects</span>
          </button>
          <h1 className="text-3xl font-bold tracking-tight">{project?.name || 'Project Board'}</h1>
          {project?.description && (
            <p className="text-sm text-text-muted mt-1">{project.description}</p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="w-full sm:w-48 pl-9 pr-3 py-2 text-sm rounded-lg border border-border-subtle bg-[var(--card)] text-text placeholder-text-subtle/50 focus:outline-none focus:border-accent/50 transition-all-fast"
            />
          </div>
          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 text-sm rounded-lg border border-border-subtle bg-[var(--card)] text-text focus:outline-none focus:border-accent/50 transition-all-fast cursor-pointer"
          >
            <option value="ALL">All Priorities</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <select
            value={filterAssignee}
            onChange={e => setFilterAssignee(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 text-sm rounded-lg border border-border-subtle bg-[var(--card)] text-text focus:outline-none focus:border-accent/50 transition-all-fast cursor-pointer"
          >
            <option value="ALL">All Assignees</option>
            <option value="UNASSIGNED">Unassigned</option>
            {members.filter(m => m.role === 'owner').map(m => (
              <option key={m.id} value={m.id}>{m.name} (Owner)</option>
            ))}
            {members.filter(m => m.role !== 'owner').map(m => (
              <option key={m.id} value={m.id}>{m.name} ({m.role})</option>
            ))}
          </select>
          <div className="text-xs text-text-subtle bg-[var(--card)] border border-border-subtle rounded-lg px-2.5 py-1.5 whitespace-nowrap">
            {filteredTasks.length} / {tasks.length} tasks
          </div>
          <div className="flex items-center -space-x-2">
            {members.slice(0, 5).map(m => (
              <div key={m.id} title={`${m.name} (${m.role})`}
                className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-semibold border-2 border-[var(--sidebar)] shadow-sm ring-1 ring-white/10"
              >
                {m.name.charAt(0).toUpperCase()}
              </div>
            ))}
            {members.length > 5 && (
              <div className="w-8 h-8 rounded-full bg-[var(--card)] border-2 border-[var(--sidebar)] flex items-center justify-center text-xs text-text-subtle font-medium shadow-sm ring-1 ring-white/10">
                +{members.length - 5}
              </div>
            )}
          </div>
          <button onClick={() => setShowInvite(true)}
            className="text-sm px-3 py-2 rounded-lg border-2 border-border-subtle hover:bg-[var(--card)] hover:border-accent/30 transition-all-fast text-text-subtle hover:text-text flex items-center gap-1 font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Invite</span>
            <span className="sm:hidden">+</span>
          </button>
          <button onClick={() => setShowAddTask(true)}
            className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white px-4 py-2 rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all-fast font-medium text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Add Task</span>
            <span className="sm:hidden">+</span>
          </button>
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex space-x-4 overflow-x-auto pb-4">
        {STATUS_ORDER.map(status => {
          const columnTasks = getTasksByStatus(status);
          const nextStatus = STATUS_ORDER[STATUS_ORDER.indexOf(status) + 1];
          const prevStatus = STATUS_ORDER[STATUS_ORDER.indexOf(status) - 1] || null;
          const colClass = {
            TODO: 'kanban-todo',
            IN_PROGRESS: 'kanban-in-progress',
            IN_REVIEW: 'kanban-in-review',
            DONE: 'kanban-done'
          }[status];

          return (
            <div
              key={status}
              className={`flex-shrink-0 w-72 bg-[var(--card)]/50 backdrop-blur-sm rounded-xl border border-border-subtle/50 ${colClass}`}
            >
              <div className="p-3 border-b border-border-subtle/50 flex items-center gap-2">
                <h2 className="font-semibold text-sm uppercase tracking-wide text-text-subtle">{COLUMN_TITLES[status]}</h2>
                <span className="text-xs bg-[var(--accent)] text-white font-semibold rounded-full px-2.5 py-0.75 shadow-sm">
                  {columnTasks.length}
                </span>
              </div>
              <div className="p-2.5 space-y-2.5 min-h-[80px]">
                {columnTasks.map((task) => (
                  <div
                    key={task.id}
                    data-task-id={task.id}
                    className="bg-[var(--card)] border border-border-subtle/50 rounded-lg p-3.5 hover:border-accent/20 hover:-translate-y-0.5 transition-all-fast shadow-sm hover:shadow-md select-none group"
                  >
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <h3 className="font-semibold text-sm flex-1 leading-snug group-hover:text-white transition-colors">{task.title}</h3>
                      <span className={`text-xs rounded-full px-2 py-0.75 shrink-0 font-medium ${PRIORITY_COLORS[task.priority] || 'bg-gray-700/50 text-text-muted border border-gray-600/30'}`}>
                        {task.priority}
                      </span>
                    </div>
                    {task.assignee ? (
                      <div className="relative">
                        <button
                          onClick={() => setAssigneeTaskId(assigneeTaskId === task.id ? null : task.id)}
                          className="flex items-center gap-1.5 hover:bg-[var(--card-faint)] rounded px-1.5 py-0.5 -ml-1.5 transition-colors"
                        >
                          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0 text-white font-semibold border border-[var(--card)]">
                            {task.assignee.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs text-text-muted">{task.assignee.name}</span>
                          <svg className="w-3 h-3 text-text-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {assigneeTaskId === task.id && (
                          <div className="absolute top-full left-0 mt-1 z-50 bg-[var(--card)] border border-border-subtle rounded-lg shadow-lg py-1 min-w-[140px]">
                            <button
                              onClick={() => handleAssignTask(task.id, 'UNASSIGNED')}
                              className="w-full text-left px-3 py-1.5 text-xs text-text-subtle hover:bg-[var(--card-faint)] hover:text-text transition-colors flex items-center gap-2"
                            >
                              Unassigned
                            </button>
                            <hr className="border-border-subtle my-1" />
                            {members.map(m => (
                              <button
                                key={m.id}
                                onClick={() => handleAssignTask(task.id, m.id)}
                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--card-faint)] hover:text-text transition-colors flex items-center gap-2"
                              >
                                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full w-4 h-4 flex items-center justify-center text-[10px] shrink-0 text-white font-semibold">
                                  {m.name.charAt(0).toUpperCase()}
                                </div>
                                {m.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="relative">
                        <button
                          onClick={() => setAssigneeTaskId(task.id)}
                          className="text-xs text-accent/80 hover:text-accent transition-colors flex items-center gap-1"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          Assign
                        </button>
                        {assigneeTaskId === task.id && (
                          <div className="absolute top-full left-0 mt-1 z-50 bg-[var(--card)] border border-border-subtle rounded-lg shadow-lg py-1 min-w-[140px]">
                            {members.map(m => (
                              <button
                                key={m.id}
                                onClick={() => handleAssignTask(task.id, m.id)}
                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--card-faint)] hover:text-text transition-colors flex items-center gap-2"
                              >
                                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full w-4 h-4 flex items-center justify-center text-[10px] shrink-0 text-white font-semibold">
                                  {m.name.charAt(0).toUpperCase()}
                                </div>
                                {m.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {task.dueDate && (
                      <p className="text-xs text-text-subtle/70 mb-2">
                        Due {new Date(task.dueDate).toLocaleDateString()}
                      </p>
                    )}

                    {/* Subtasks */}
                    {task.subtasks && task.subtasks.length > 0 && (() => {
                      const progress = getSubtaskProgress(task.subtasks);
                      return (
                        <div className="mt-2 pt-2 border-t border-border-subtle/30">
                          <button onClick={() => toggleTaskExpansion(task.id)}
                            className="flex items-center justify-between w-full text-xs text-text-subtle hover:text-text transition-colors mb-1"
                          >
                            <span className="flex items-center gap-1">
                              <svg className={`w-3 h-3 transition-transform ${expandedTaskId === task.id ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                              {progress.completed}/{progress.total} subtasks
                            </span>
                            <span className="text-[10px] text-text-muted">{progress.percent}%</span>
                          </button>
                          <div className="w-full h-1 bg-gray-700/50 rounded-full overflow-hidden mb-1">
                            <div className="h-full bg-accent/60 rounded-full transition-all duration-300" style={{ width: `${progress.percent}%` }} />
                          </div>
                          {expandedTaskId === task.id && (
                            <div className="space-y-1">
                              {task.subtasks.map((subtask) => (
                                <div
                                  key={subtask.id}
                                  data-subtask-id={subtask.id}
                                  className="flex items-center gap-2 px-2 py-1 rounded text-xs group/subtask hover:bg-[var(--card-faint)] transition-colors"
                                >
                                  <button
                                    onClick={() => handleToggleSubtask(task.id, subtask.id, subtask.completed)}
                                    className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                                      subtask.completed ? 'bg-accent border-accent' : 'border-text-subtle/50 hover:border-accent/50'
                                    }`}
                                  >
                                    {subtask.completed && (
                                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </button>
                                  <span className={`flex-1 truncate ${subtask.completed ? 'line-through text-text-muted' : 'text-text'}`}>
                                    {editingSubtaskId === subtask.id ? (
                                      <input
                                        type="text" value={editingSubtaskTitle}
                                        onChange={(e) => setEditingSubtaskTitle(e.target.value)}
                                        onBlur={() => handleSaveSubtask(task.id, subtask.id)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleSaveSubtask(task.id, subtask.id);
                                          if (e.key === 'Escape') setEditingSubtaskId(null);
                                        }}
                                        className="w-full bg-transparent border border-accent/50 rounded px-1 py-0.5 text-xs focus:outline-none"
                                        autoFocus
                                      />
                                    ) : (
                                      <span onDoubleClick={() => handleStartEditSubtask(subtask)} className="cursor-pointer">
                                        {subtask.title}
                                      </span>
                                    )}
                                  </span>
                                  <div className="opacity-0 group-hover/subtask:opacity-100 transition-opacity flex items-center gap-1">
                                    <button onClick={() => handleStartEditSubtask(subtask)}
                                      className="text-text-muted hover:text-text transition-colors"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                      </svg>
                                    </button>
                                    <button onClick={() => handleDeleteSubtask(task.id, subtask.id)}
                                      className="text-text-muted hover:text-error transition-colors"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              ))}
                              <button onClick={() => setAddingSubtaskId(task.id)}
                                className="flex items-center gap-1 text-text-muted hover:text-accent transition-colors text-xs w-full mt-1"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Add subtask
                              </button>
                              {addingSubtaskId === task.id && (
                                <form onSubmit={(e) => { e.preventDefault(); handleAddSubtask(task.id); }}
                                  className="flex items-center gap-1 mt-1"
                                >
                                  <input type="text" value={newSubtaskTitle}
                                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                    placeholder="New subtask..."
                                    className="flex-1 bg-transparent border border-border-subtle rounded px-2 py-1 text-xs focus:outline-none focus:border-accent/50"
                                    autoFocus
                                  />
                                  <button type="submit" className="text-accent hover:text-accent/80 text-xs">Add</button>
                                  <button type="button" onClick={() => { setAddingSubtaskId(null); setNewSubtaskTitle(''); }}
                                    className="text-text-muted hover:text-text text-xs"
                                  >Cancel</button>
                                </form>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {(!task.subtasks || task.subtasks.length === 0) && (
                      <div className="mt-2 pt-2 border-t border-border-subtle/30">
                        <button onClick={() => { setAddingSubtaskId(task.id); }}
                          className="flex items-center gap-1 text-text-muted hover:text-accent transition-colors text-xs w-full"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Add subtask
                        </button>
                        {addingSubtaskId === task.id && (
                          <form onSubmit={(e) => { e.preventDefault(); handleAddSubtask(task.id); }}
                            className="flex items-center gap-1 mt-1"
                          >
                            <input type="text" value={newSubtaskTitle}
                              onChange={(e) => setNewSubtaskTitle(e.target.value)}
                              placeholder="New subtask..."
                              className="flex-1 bg-transparent border border-border-subtle rounded px-2 py-1 text-xs focus:outline-none focus:border-accent/50"
                              autoFocus
                            />
                            <button type="submit" className="text-accent hover:text-accent/80 text-xs">Add</button>
                            <button type="button" onClick={() => { setAddingSubtaskId(null); setNewSubtaskTitle(''); }}
                              className="text-text-muted hover:text-text text-xs"
                            >Cancel</button>
                          </form>
                        )}
                      </div>
                    )}

                    {/* Action buttons - Move Back | Move Forward | Delete */}
                    <div className="flex gap-2 mt-3 pt-2 border-t border-border-subtle/30">
                      {prevStatus && (
                        <button
                          onClick={() => handleMoveTaskBack(task.id, task.status)}
                          className="text-xs px-2 py-1 rounded border border-border-subtle hover:border-accent/50 text-text-subtle hover:text-text transition-colors"
                        >
                          ← {COLUMN_TITLES[prevStatus]}
                        </button>
                      )}
                      {nextStatus && (
                        <button
                          onClick={() => handleMoveTask(task.id, task.status)}
                          className="text-xs px-2 py-1 rounded border border-border-subtle hover:border-accent/50 text-text-subtle hover:text-text transition-colors"
                        >
                          {COLUMN_TITLES[nextStatus]} →
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="text-xs px-2 py-1 rounded border border-border-subtle hover:border-error/50 text-text-subtle hover:text-error transition-colors ml-auto"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Task Modal */}
      {showAddTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--card)] rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add New Task</h2>
            <form onSubmit={handleAddTask}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Task title..."
                  className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-[var(--card)] text-text focus:outline-none focus:border-accent/50"
                  autoFocus
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Priority</label>
                <select
                  value={newPriority}
                  onChange={e => setNewPriority(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-[var(--card)] text-text focus:outline-none focus:border-accent/50"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Assignee</label>
                <select
                  value={newAssigneeId}
                  onChange={e => setNewAssigneeId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-[var(--card)] text-text focus:outline-none focus:border-accent/50"
                >
                  <option value="">Unassigned</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              {taskError && <div className="text-error text-sm mb-4">{taskError}</div>}
              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 py-2 rounded-lg font-medium">
                  Add Task
                </button>
                <button type="button" onClick={() => { setShowAddTask(false); setTaskError(''); }} className="flex-1 border border-border-subtle text-text px-4 py-2 rounded-lg">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--card)] rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Invite Member</h2>
            <form onSubmit={handleInvite}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Email</label>
                <div className="relative">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => handleInviteSearch(e.target.value)}
                    placeholder="Enter email..."
                    className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-[var(--card)] text-text focus:outline-none focus:border-accent/50"
                    autoFocus
                  />
                  {searchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-[var(--card)] border border-border-subtle rounded-lg shadow-lg">
                      {searchResults.map(u => (
                        <div
                          key={u.id}
                          onClick={() => selectSearchResult(u)}
                          className="px-3 py-2 hover:bg-[var(--card-faint)] cursor-pointer"
                        >
                          <div className="text-sm font-medium">{u.name}</div>
                          <div className="text-xs text-text-subtle">{u.email}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {inviteError && <div className="text-error text-sm mb-4">{inviteError}</div>}
              {inviteSuccess && <div className="text-accent text-sm mb-4">{inviteSuccess}</div>}
              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 py-2 rounded-lg font-medium">
                  Invite
                </button>
                <button type="button" onClick={closeInviteModal} className="flex-1 border border-border-subtle text-text px-4 py-2 rounded-lg">
                  Cancel
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
