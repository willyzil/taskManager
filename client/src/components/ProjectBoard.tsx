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

const PRIORITY_ORDER: Record<string, number> = {
  URGENT: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
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
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [filterAssignee, setFilterAssignee] = useState<string>('ALL');

  // Drag-and-drop state for tasks
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const dragItemRef = useRef<number | null>(null);
  const dragOverItemRef = useRef<number | null>(null);

  // Subtask state
  const [addingSubtaskId, setAddingSubtaskId] = useState<string | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState('');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const subtaskDragItemRef = useRef<number | null>(null);
  const subtaskDragOverItemRef = useRef<number | null>(null);

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

  // Filter tasks based on search and filters
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

  // Sort: by priority descending, then by title
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (PRIORITY_ORDER[b.priority] !== PRIORITY_ORDER[a.priority]) {
      return PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority];
    }
    return a.title.localeCompare(b.title);
  });

  const moveTask = async (taskId: string, currentStatus: Status) => {
    const idx = STATUS_ORDER.indexOf(currentStatus);
    if (idx === STATUS_ORDER.length - 1) return;
    const nextStatus = STATUS_ORDER[idx + 1];
    const data = await api.patch(`/api/tasks/${taskId}`, { status: nextStatus });
    if (data.success) {
      const tasksData = await api.get(`/api/tasks?projectId=${id}`);
      if (tasksData.success) {
        setTasks([...tasksData.tasks]);
      }
    } else {
      console.error('Failed to update task:', data.message);
    }
  };

  // Drag-and-drop: task moved to a different column
  const onTaskDrop = async (taskId: string, targetStatus: Status) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const currentStatus = task.status;
    if (currentStatus === targetStatus) return; // Stay in same column, handled below
    if (targetStatus === STATUS_ORDER[0]) {
      // Moving to TODO: move backward
      const idx = STATUS_ORDER.indexOf(currentStatus);
      if (idx > 0) {
        const prevStatus = STATUS_ORDER[idx - 1];
        await api.patch(`/api/tasks/${taskId}`, { status: prevStatus });
        const tasksData = await api.get(`/api/tasks?projectId=${id}`);
        if (tasksData.success) setTasks([...tasksData.tasks]);
      }
    } else {
      await moveTask(taskId, currentStatus);
    }
    setDraggedTaskId(null);
    setDragOverTaskId(null);
  };

  // Drag-and-drop: reorder tasks within a column
  const handleTaskDrop = async (e: React.DragEvent, status: Status) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragItemRef.current === null || dragOverItemRef.current === null) return;

    const statusTasks = sortedTasks.filter(t => t.status === status);
    if (statusTasks.length < 2) {
      dragItemRef.current = null;
      dragOverItemRef.current = null;
      return;
    }

    const fromIndex = dragItemRef.current;
    const toIndex = dragOverItemRef.current;
    if (fromIndex === toIndex) {
      dragItemRef.current = null;
      dragOverItemRef.current = null;
      return;
    }

    const newOrder = [...statusTasks];
    const [movedTask] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, movedTask);

    // Update order in backend
    try {
      await api.post(`/api/tasks/reorder`, {
        projectId: id,
        status,
        taskOrder: newOrder.map((t, i) => ({ id: t.id, order: i })),
      });
      const tasksData = await api.get(`/api/tasks?projectId=${id}`);
      if (tasksData.success) setTasks([...tasksData.tasks]);
    } catch (err) {
      console.error('Failed to reorder tasks:', err);
    }

    dragItemRef.current = null;
    dragOverItemRef.current = null;
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

  // Subtask management
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

  // Drag-and-drop for subtasks
  const handleSubtaskDrop = async (taskId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (subtaskDragItemRef.current === null || subtaskDragOverItemRef.current === null) return;

    const task = tasks.find(t => t.id === taskId);
    if (!task?.subtasks || task.subtasks.length < 2) return;

    const fromIndex = subtaskDragItemRef.current;
    const toIndex = subtaskDragOverItemRef.current;
    if (fromIndex === toIndex) {
      subtaskDragItemRef.current = null;
      subtaskDragOverItemRef.current = null;
      return;
    }

    const newOrder = [...task.subtasks];
    const [movedSubtask] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, movedSubtask);

    try {
      await api.post(`/api/tasks/${taskId}/reorder-subtasks`, {
        subtaskOrder: newOrder.map((s, i) => ({ id: s.id, order: i })),
      });
      const tasksData = await api.get(`/api/tasks?projectId=${id}`);
      if (tasksData.success) setTasks([...tasksData.tasks]);
    } catch (err) {
      console.error('Failed to reorder subtasks:', err);
    }

    subtaskDragItemRef.current = null;
    subtaskDragOverItemRef.current = null;
  };

  if (loading) return <div className="p-6 text-gray-400">Loading...</div>;

  return (
    <div className="p-6 min-h-screen bg-[var(--background)] text-text">
      {/* Header - stacks on mobile */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-start gap-4 mb-6">
        <div className="flex-1">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-text-subtle hover:text-accent transition-colors mb-2 block flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm font-medium">← Back to Projects</span>
          </button>
          <h1 className="text-3xl font-bold tracking-tight">{project?.name || 'Project Board'}</h1>
          {project?.description && (
            <p className="text-sm text-text-muted mt-1">{project.description}</p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {/* Search input */}
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
          {/* Priority filter */}
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
          {/* Assignee filter */}
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
          {/* Task count indicator */}
          <div className="text-xs text-text-subtle bg-[var(--card)] border border-border-subtle rounded-lg px-2.5 py-1.5 whitespace-nowrap">
            {sortedTasks.length} / {tasks.length} tasks
          </div>
          {/* Member avatars - stacked */}
          <div className="flex items-center -space-x-2">
            {members.slice(0, 5).map(m => (
              <div
                key={m.id}
                title={`${m.name} (${m.role})`}
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
          <button
            onClick={() => setShowInvite(true)}
            className="text-sm px-3 py-2 rounded-lg border-2 border-border-subtle hover:bg-[var(--card)] hover:border-accent/30 transition-all-fast text-text-subtle hover:text-text flex items-center gap-1 font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Invite</span>
            <span className="sm:hidden">+</span>
          </button>
          <button
            onClick={() => setShowAddTask(true)}
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
          const columnTasks = sortedTasks.filter(t => t.status === status);
          const nextStatus = STATUS_ORDER[STATUS_ORDER.indexOf(status) + 1];
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
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedTaskId) {
                  onTaskDrop(draggedTaskId, status);
                }
              }}
            >
              <div className="p-3 border-b border-border-subtle/50 flex items-center gap-2">
                <h2 className="font-semibold text-sm uppercase tracking-wide text-text-subtle">{COLUMN_TITLES[status]}</h2>
                <span className="text-xs bg-[var(--accent)] text-white font-semibold rounded-full px-2.5 py-0.75 shadow-sm">
                  {columnTasks.length}
                </span>
              </div>
              <div className="p-2.5 space-y-2.5 min-h-[80px]">
                {columnTasks.map((task, index) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      setDraggedTaskId(task.id);
                      dragItemRef.current = index;
                    }}
                    onDragEnd={() => {
                      setDraggedTaskId(null);
                      dragItemRef.current = null;
                      dragOverItemRef.current = null;
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      dragOverItemRef.current = index;
                      setDragOverTaskId(task.id);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (dragOverTaskId === task.id) {
                        handleTaskDrop(e, status);
                      } else {
                        onTaskDrop(draggedTaskId!, status);
                      }
                      dragItemRef.current = null;
                      dragOverItemRef.current = null;
                      setDragOverTaskId(null);
                    }}
                    className={`bg-[var(--card)] border border-border-subtle/50 rounded-lg p-3.5 hover:border-accent/20 hover:-translate-y-0.5 transition-all-fast cursor-grab group shadow-sm hover:shadow-md ${
                      draggedTaskId === task.id ? 'opacity-40 scale-95' : ''
                    } ${dragOverTaskId === task.id ? 'ring-2 ring-accent/50 border-accent' : ''}`}
                  >
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <h3 className="font-semibold text-sm flex-1 leading-snug group-hover:text-white transition-colors">{task.title}</h3>
                      <span className={`text-xs rounded-full px-2 py-0.75 shrink-0 font-medium ${PRIORITY_COLORS[task.priority] || 'bg-gray-700/50 text-text-muted border border-gray-600/30'}`}>
                        {task.priority}
                      </span>
                    </div>
                    {task.assignee ? (
                      <div className="flex items-center gap-1.5 mb-2">
                        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0 text-white font-semibold border border-[var(--card)]">
                          {task.assignee.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs text-text-muted">{task.assignee.name}</span>
                      </div>
                    ) : (
                      <p className="text-xs text-text-subtle/60 mb-2">Unassigned</p>
                    )}
                    {task.dueDate && (
                      <p className="text-xs text-text-subtle/70 mb-2">
                        Due {new Date(task.dueDate).toLocaleDateString()}
                      </p>
                    )}

                    {/* Subtasks section */}
                    {task.subtasks && task.subtasks.length > 0 && (() => {
                      const progress = getSubtaskProgress(task.subtasks);
                      return (
                        <div className="mt-2 pt-2 border-t border-border-subtle/30">
                          <button
                            onClick={() => toggleTaskExpansion(task.id)}
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

                          {/* Progress bar */}
                          <div className="w-full h-1 bg-gray-700/50 rounded-full overflow-hidden mb-1">
                            <div
                              className="h-full bg-accent/60 rounded-full transition-all duration-300"
                              style={{ width: `${progress.percent}%` }}
                            />
                          </div>

                          {/* Subtasks list */}
                          {expandedTaskId === task.id && (
                            <div className="space-y-1">
                              {task.subtasks.map((subtask, subIndex) => (
                                <div
                                  key={subtask.id}
                                  draggable
                                  onDragStart={(e) => {
                                    e.dataTransfer.effectAllowed = 'move';
                                    subtaskDragItemRef.current = subIndex;
                                    e.stopPropagation();
                                  }}
                                  onDragEnter={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    subtaskDragOverItemRef.current = subIndex;
                                  }}
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleSubtaskDrop(task.id, e);
                                  }}
                                  className={`flex items-center gap-2 px-2 py-1 rounded text-xs group/subtask hover:bg-[var(--card-faint)] transition-colors ${
                                    subtaskDragOverItemRef.current === subIndex ? 'ring-1 ring-accent/50' : ''
                                  }`}
                                >
                                  <button
                                    onClick={() => handleToggleSubtask(task.id, subtask.id, subtask.completed)}
                                    className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                                      subtask.completed
                                        ? 'bg-accent border-accent'
                                        : 'border-text-subtle/50 hover:border-accent/50'
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
                                        type="text"
                                        value={editingSubtaskTitle}
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
                                      <span
                                        onDoubleClick={() => handleStartEditSubtask(subtask)}
                                        className="cursor-pointer"
                                      >
                                        {subtask.title}
                                      </span>
                                    )}
                                  </span>
                                  <div className="opacity-0 group-hover/subtask:opacity-100 transition-opacity flex items-center gap-1">
                                    <button
                                      onClick={() => handleStartEditSubtask(subtask)}
                                      className="text-text-muted hover:text-text transition-colors"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={() => handleDeleteSubtask(task.id, subtask.id)}
                                      className="text-text-muted hover:text-error transition-colors"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              ))}
                              <button
                                onClick={() => setAddingSubtaskId(task.id)}
                                className="flex items-center gap-1 text-text-muted hover:text-accent transition-colors text-xs w-full mt-1"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Add subtask
                              </button>

                              {/* Add subtask input */}
                              {addingSubtaskId === task.id && (
                                <form
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    handleAddSubtask(task.id);
                                  }}
                                  className="flex items-center gap-1 mt-1"
                                >
                                  <input
                                    type="text"
                                    value={newSubtaskTitle}
                                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                    placeholder="New subtask..."
                                    className="flex-1 bg-transparent border border-border-subtle rounded px-2 py-1 text-xs focus:outline-none focus:border-accent/50"
                                    autoFocus
                                  />
                                  <button type="submit" className="text-accent hover:text-accent/80 text-xs">Add</button>
                                  <button
                                    type="button"
                                    onClick={() => { setAddingSubtaskId(null); setNewSubtaskTitle(''); }}
                                    className="text-text-muted hover:text-text text-xs"
                                  >
                                    Cancel
                                  </button>
                                </form>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Subtask add button for tasks without subtasks */}
                    {(!task.subtasks || task.subtasks.length === 0) && (
                      <div className="mt-2 pt-2 border-t border-border-subtle/30">
                        <button
                          onClick={() => { setAddingSubtaskId(task.id); }}
                          className="flex items-center gap-1 text-text-muted hover:text-accent transition-colors text-xs w-full"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Add subtask
                        </button>
                        {addingSubtaskId === task.id && (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              handleAddSubtask(task.id);
                            }}
                            className="flex items-center gap-1 mt-1"
                          >
                            <input
                              type="text"
                              value={newSubtaskTitle}
                              onChange={(e) => setNewSubtaskTitle(e.target.value)}
                              placeholder="New subtask..."
                              className="flex-1 bg-transparent border border-border-subtle rounded px-2 py-1 text-xs focus:outline-none focus:border-accent/50"
                              autoFocus
                            />
                            <button type="submit" className="text-accent hover:text-accent/80 text-xs">Add</button>
                            <button
                              type="button"
                              onClick={() => { setAddingSubtaskId(null); setNewSubtaskTitle(''); }}
                              className="text-text-muted hover:text-text text-xs"
                            >
                              Cancel
                            </button>
                          </form>
                        )}
                      </div>
                    )}

                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-border-subtle/30">
                      {nextStatus ? (
                        <button
                          onClick={() => moveTask(task.id, status)}
                          className="text-xs text-accent hover:text-accent/80 font-medium transition-colors flex items-center gap-1"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          {COLUMN_TITLES[nextStatus]}
                        </button>
                      ) : (
                        <span className="text-xs text-success/80 font-medium">Done</span>
                      )}
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="text-xs text-text-subtle hover:text-error transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {columnTasks.length === 0 && (
                  <div className="text-center py-6 text-text-muted/50 text-xs">
                    Drag tasks here
                  </div>
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
                    className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Search..."
                    required
                  />
                  {showDropdown && searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-lg max-h-48 overflow-y-auto z-10">
                      {searchResults.map(user => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => selectSearchResult(user)}
                          className="w-full text-left px-4 py-2 hover:bg-gray-700 transition-colors"
                        >
                          <div className="font-medium">{user.name}</div>
                          <div className="text-sm text-gray-400">{user.email}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={closeInviteModal}
                  className="px-4 py-2 rounded-md bg-gray-700 hover:bg-gray-600"
                >
                  Cancel
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
