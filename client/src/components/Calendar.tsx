import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

interface Project {
  id: string;
  name: string;
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  assignee: { id: string; name: string } | null;
  taskTags: Array<{ tag: { id: string; name: string; color: string } }>;
}

interface CalendarTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  assignee: { id: string; name: string } | null;
  taskTags: Array<{ tag: { id: string; name: string; color: string } }>;
  projectId: string;
  projectName: string;
}

type CalendarView = 'month' | 'week';

const STATUS_COLORS: Record<string, string> = {
  TODO: 'border-l-gray-500',
  IN_PROGRESS: 'border-l-blue-500',
  IN_REVIEW: 'border-l-yellow-500',
  DONE: 'border-l-green-500',
};

const PRIORITY_BADGE: Record<string, string> = {
  LOW: 'bg-gray-600 text-white',
  MEDIUM: 'bg-blue-600 text-white',
  HIGH: 'bg-orange-600 text-white',
  URGENT: 'bg-red-600 text-white',
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const Calendar: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Navigation
  const [view, setView] = useState<CalendarView>('month');
  const [viewDate, setViewDate] = useState(new Date());
  const currentMonth = viewDate.getMonth();
  const currentYear = viewDate.getFullYear();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Keyboard navigation
  const cellRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const [focusedDate, setFocusedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Create-task mode
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [createTaskDate, setCreateTaskDate] = useState<string>('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('MEDIUM');
  const [newTaskProjectId, setNewTaskProjectId] = useState('');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  // Tooltip state
  const [tooltip, setTooltip] = useState<{
    date: string;
    tasks: CalendarTask[];
    x: number;
    y: number;
  } | null>(null);

  // ---- Fetch data ----
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const data = await api.get('/api/projects');
        if (data.success) setProjects(data.projects);
      } catch (e) {
        setError('Failed to load projects');
      }
    };
    fetchProjects();
  }, []);

  useEffect(() => {
    if (projects.length === 0) return;
    const fetchAll = async () => {
      try {
        const results = await Promise.all(
          projects.map(async p => {
            const res = await api.get(`/api/tasks?projectId=${p.id}`);
            if (!res.success) return [] as CalendarTask[];
            return (res.tasks || []).map((t: Task) => ({
              ...t,
              projectId: p.id,
              projectName: p.name,
            }));
          })
        );
        const allTasks = results
          .flat()
          .filter((t: CalendarTask) => t.dueDate !== null) as CalendarTask[];
        setTasks(allTasks);
        setLoading(false);
      } catch {
        setError('Failed to load tasks');
        setLoading(false);
      }
    };
    fetchAll();
  }, [projects]);

  // ---- Calendar grid generation ----
  const getGridDates = useCallback(() => {
    if (view === 'month') {
      const firstDay = new Date(currentYear, currentMonth, 1);
      const lastDay = new Date(currentYear, currentMonth + 1, 0);
      const startDate = new Date(firstDay);
      startDate.setDate(startDate.getDate() - startDate.getDay());
      const endDate = new Date(lastDay);
      endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

      const days: { date: Date; isCurrentMonth: boolean }[] = [];
      const current = new Date(startDate);
      while (current <= endDate) {
        days.push({
          date: new Date(current),
          isCurrentMonth: current.getMonth() === currentMonth,
        });
        current.setDate(current.getDate() + 1);
      }
      return { days, isWeek: false };
    }

    // Week view: start from Monday
    const today = viewDate;
    const dayOfWeek = today.getDay();
    const daysAgo = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday = 0
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - daysAgo);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);

    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      days.push({
        date: new Date(current),
        isCurrentMonth: current.getMonth() === currentMonth,
      });
      current.setDate(current.getDate() + 1);
    }
    return { days, isWeek: true };
  }, [view, currentMonth, currentYear, viewDate]);

  const { days: gridDates, isWeek } = getGridDates();

  const formatDateKey = (date: Date): string =>
    date.toISOString().split('T')[0];

  const todayStr = formatDateKey(new Date());

  // ---- Task queries ----
  const getTasksForDate = useCallback(
    (date: Date): CalendarTask[] => {
      const dateStr = formatDateKey(date);
      const filter = selectedProjectId
        ? (t: CalendarTask) =>
            t.dueDate?.startsWith(dateStr) && t.projectId === selectedProjectId
        : (t: CalendarTask) => t.dueDate?.startsWith(dateStr);
      return (tasks as CalendarTask[]).filter(filter as any);
    },
    [tasks, selectedProjectId]
  );

  const isOverdue = (task: CalendarTask): boolean => {
    if (!task.dueDate || task.status === 'DONE') return false;
    const due = new Date(task.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today;
  };

  // Tasks for the currently-selected day (detail panel). `dayTasks` inside the grid
  // .map() below is scoped to each cell's callback and isn't visible here -- this is
  // the same filter as getTasksForDate, applied directly to the selectedDate string.
  const selectedDateTasks: CalendarTask[] = selectedDate
    ? tasks.filter(t =>
        t.dueDate?.startsWith(selectedDate) &&
        (!selectedProjectId || t.projectId === selectedProjectId)
      )
    : [];

  // ---- Navigation ----
  const prev = () => {
    if (view === 'month') {
      setViewDate(new Date(currentYear, currentMonth - 1, 1));
    } else {
      const d = new Date(viewDate);
      d.setDate(d.getDate() - 7);
      setViewDate(d);
    }
    setSelectedDate(null);
  };

  const next = () => {
    if (view === 'month') {
      setViewDate(new Date(currentYear, currentMonth + 1, 1));
    } else {
      const d = new Date(viewDate);
      d.setDate(d.getDate() + 7);
      setViewDate(d);
    }
    setSelectedDate(null);
  };

  const goToToday = () => setViewDate(new Date());

  // ---- Keyboard navigation ----
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, dateStr: string) => {
      let target = dateStr;
      switch (e.key) {
        case 'ArrowRight': {
          const d = new Date(dateStr + 'T00:00:00');
          d.setDate(d.getDate() + 1);
          target = formatDateKey(d);
          break;
        }
        case 'ArrowLeft': {
          const d = new Date(dateStr + 'T00:00:00');
          d.setDate(d.getDate() - 1);
          target = formatDateKey(d);
          break;
        }
        case 'ArrowUp': {
          const d = new Date(dateStr + 'T00:00:00');
          d.setDate(d.getDate() - 7);
          target = formatDateKey(d);
          break;
        }
        case 'ArrowDown': {
          const d = new Date(dateStr + 'T00:00:00');
          d.setDate(d.getDate() + 7);
          target = formatDateKey(d);
          break;
        }
        case 'Enter':
          setSelectedDate(dateStr);
          setFocusedDate(dateStr);
          return;
        default:
          return;
      }
      e.preventDefault();
      setFocusedDate(target);
      const el = cellRef.current.get(target);
      el?.focus();
    },
    []
  );

  // ---- Create task from calendar ----
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !createTaskDate || !newTaskProjectId) return;
    setCreateError('');
    setCreating(true);
    try {
      const data = await api.post('/api/tasks', {
        title: newTaskTitle.trim(),
        projectId: newTaskProjectId,
        dueDate: createTaskDate,
        priority: newTaskPriority,
      });
      if (data.success) {
        // Refresh tasks
        const res = await api.get(`/api/tasks?projectId=${newTaskProjectId}`);
        if (res.success) {
          setTasks(prev => [...prev, { ...data.task, projectId: newTaskProjectId, projectName: '' }]);
        }
        setShowCreateTask(false);
        setNewTaskTitle('');
        setNewTaskPriority('MEDIUM');
        setNewTaskProjectId('');
        setCreateError('');
      } else {
        setCreateError(data.message || 'Failed to create task');
      }
    } catch {
      setCreateError('Failed to create task');
    } finally {
      setCreating(false);
    }
  };

  const openCreateTask = (dateStr: string) => {
    setCreateTaskDate(dateStr);
    setNewTaskTitle('');
    setCreateError('');
    setNewTaskProjectId(selectedProjectId || projects[0]?.id || '');
    setShowCreateTask(true);
  };

  // ---- Tooltip ----
  const showTooltip = (e: React.MouseEvent, dateStr: string, dateTasks: CalendarTask[]) => {
    setTooltip({ date: dateStr, tasks: dateTasks, x: e.clientX, y: e.clientY });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--background)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-text-subtle text-sm">Loading calendar…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6 min-h-screen bg-[var(--background)]">
      {/* Main Calendar */}
      <div className="flex-1">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={prev}
              className="w-9 h-9 rounded-lg bg-[var(--card)] border border-border-subtle flex items-center justify-center hover:bg-[var(--card)]/80 transition-colors"
              aria-label="Previous"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-xl font-bold min-w-[180px]">
              {isWeek
                ? `${gridDates[0] ? new Date(gridDates[0].date.toISOString().split('T')[0] + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' }) : ''} – ${gridDates[6] ? new Date(gridDates[6].date.toISOString().split('T')[0] + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''} ${gridDates[0] ? new Date(gridDates[0].date.toISOString().split('T')[0] + 'T00:00:00').getFullYear() : ''}`
                : `${MONTHS[currentMonth]} ${currentYear}`}
            </h2>
            <button onClick={next} className="w-9 h-9 rounded-lg bg-[var(--card)] border border-border-subtle flex items-center justify-center hover:bg-[var(--card)]/80 transition-colors" aria-label="Next">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button onClick={goToToday} className="px-3 py-1.5 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
              Today
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* View toggle */}
            <div className="flex bg-[var(--card)] rounded-lg border border-border-subtle overflow-hidden">
              <button
                onClick={() => setView('month')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${view === 'month' ? 'bg-accent text-white' : 'text-text-subtle hover:text-text'}`}
              >
                Month
              </button>
              <button
                onClick={() => setView('week')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${view === 'week' ? 'bg-accent text-white' : 'text-text-subtle hover:text-text'}`}
              >
                Week
              </button>
            </div>

            {/* Project filter */}
            {projects.length > 1 && (
              <select
                value={selectedProjectId || ''}
                onChange={e => { setSelectedProjectId(e.target.value || null); setSelectedDate(null); }}
                className="flex-1 sm:flex-none px-3 py-1.5 text-sm rounded-lg bg-[var(--card)] border border-border-subtle focus:outline-none focus:border-accent"
              >
                <option value="">All Projects</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/25 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Calendar Grid */}
        <div className="bg-[var(--card)] border border-border-subtle rounded-xl overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-border-subtle">
            {(isWeek ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : DAYS_SHORT).map(day => (
              <div key={day} className="py-2 text-center text-xs font-semibold text-text-subtle uppercase tracking-wider">
                {day}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7">
            {gridDates.map(d => {
              const dateStr = formatDateKey(d.date);
              const isToday = dateStr === todayStr;
              const dayTasks = getTasksForDate(d.date);
              const isFocused = dateStr === focusedDate;

              return (
                <div
                  key={dateStr}
                  ref={el => { if (el) cellRef.current.set(dateStr, el); }}
                  tabIndex={0}
                  onFocus={() => setFocusedDate(dateStr)}
                  onKeyDown={e => handleKeyDown(e, dateStr)}
                  onClick={() => { setSelectedDate(dateStr); setTooltip(null); }}
                  onMouseEnter={e => showTooltip(e, dateStr, dayTasks)}
                  onMouseLeave={() => setTooltip(null)}
                  onDoubleClick={() => openCreateTask(dateStr)}
                  className={`
                    relative min-h-[80px] p-1.5 border-b border-r border-border-subtle/30 cursor-pointer transition-colors
                    hover:bg-[var(--card)]/50
                    ${d.isCurrentMonth ? '' : 'bg-[var(--background)]/50'}
                    ${isFocused ? 'ring-2 ring-accent ring-inset z-10' : ''}
                  `}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday
                          ? 'bg-accent text-white shadow-sm'
                          : d.isCurrentMonth ? 'text-text' : 'text-gray-600'
                      }`}
                    >
                      {d.date.getDate()}
                    </span>
                    {dayTasks.length > 0 && (
                      <span className="text-[10px] text-gray-400 bg-[var(--background)]/80 rounded-full px-1.5 py-0.5">
                        {dayTasks.length}
                      </span>
                    )}
                  </div>

                  {/* Task previews */}
                  <div className="space-y-0.5">
                    {dayTasks.slice(0, 3).map(task => {
                      const overdue = isOverdue(task);
                      return (
                        <Link
                          key={task.id}
                          to={`/project/${task.projectId}`}
                          onClick={() => setSelectedDate(null)}
                          title={task.title}
                          className={`
                            text-[10px] truncate px-1 py-0.5 rounded border-l-2
                            ${STATUS_COLORS[task.status] || ''}
                            ${overdue ? 'opacity-70 line-through' : 'opacity-100'}
                            bg-[var(--background)]/60 text-gray-300 hover:text-text transition-colors
                          `}
                        >
                          {task.title}
                        </Link>
                      );
                    })}
                    {dayTasks.length > 3 && (
                      <div className="text-[10px] text-gray-500 pl-1">
                        +{dayTasks.length - 3} more
                      </div>
                    )}
                  </div>

                  {/* Add button on hover */}
                  <button
                    onClick={(e) => { e.stopPropagation(); openCreateTask(dateStr); }}
                    className="absolute top-1 right-1 w-5 h-5 rounded bg-accent/80 text-white text-xs opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center"
                    aria-label={`Add task for ${dateStr}`}
                  >
                    +
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Task detail panel */}
      {selectedDate && (
        <div className="lg:w-80 flex-shrink-0">
          <div className="bg-[var(--card)] border border-border-subtle rounded-xl p-4 sticky top-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">
                {selectedDate}
              </h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openCreateTask(selectedDate)}
                  className="text-accent hover:text-accent/80 text-xs px-2 py-1 rounded hover:bg-[var(--card)]/50"
                >
                  + Add task
                </button>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="text-text-subtle/50 hover:text-text transition-colors ml-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {selectedDateTasks.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-xs text-text-subtle/50">No tasks due</p>
                <button
                  onClick={() => openCreateTask(selectedDate)}
                  className="text-xs text-accent hover:text-accent/80 mt-2 block mx-auto"
                >
                  Create one?
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {selectedDateTasks.map(task => (
                  <Link
                    key={task.id}
                    to={`/project/${task.projectId}`}
                    onClick={() => setSelectedDate(null)}
                    className={`
                      block p-3 rounded-lg bg-[var(--background)]/60 border border-border-subtle/50 border-l-4
                      ${STATUS_COLORS[task.status] || ''}
                      hover:bg-[var(--background)] transition-colors group
                    `}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-medium group-hover:text-accent transition-colors flex-1 truncate">
                        {task.title}
                      </h4>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${PRIORITY_BADGE[task.priority] || ''}`}>
                        {task.priority}
                      </span>
                    </div>
                    {isOverdue(task) && (
                      <span className="text-[10px] text-red-400 font-medium mt-0.5 block">Overdue</span>
                    )}
                    <p className="text-xs text-text-subtle/60 mt-1">{task.projectName}</p>
                    {task.assignee && (
                      <p className="text-xs text-text-subtle/50 mt-0.5">
                        <svg className="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {task.assignee.name}
                      </p>
                    )}
                    {task.taskTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {task.taskTags.map(tt => (
                          <span
                            key={tt.tag.id}
                            className="text-[10px] px-1.5 py-0.5 rounded-full"
                            style={{ backgroundColor: tt.tag.color + '30', color: tt.tag.color }}
                          >
                            {tt.tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                    <span className={`text-[10px] ${
                      task.status === 'DONE' ? 'text-green-400' :
                      task.status === 'IN_PROGRESS' ? 'text-blue-400' :
                      task.status === 'IN_REVIEW' ? 'text-yellow-400' :
                      'text-gray-400'
                    }`}>
                      {task.status.replace('_', ' ')}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating tooltip for task previews */}
      {tooltip && (
        <div
          className="fixed z-50 bg-[var(--card)] border border-border-subtle rounded-lg shadow-2xl p-3 w-64 pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 12 }}
        >
          <p className="text-xs text-text-subtle mb-2">{tooltip.date}</p>
          <div className="space-y-1">
            {tooltip.tasks.slice(0, 5).map(t => (
              <Link
                key={t.id}
                to={`/project/${t.projectId}`}
                className="block text-xs truncate hover:text-accent transition-colors"
                onClick={() => setTooltip(null)}
              >
                <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${
                  STATUS_COLORS[t.status]?.replace('border-l-', 'bg-') || 'bg-gray-500'
                }`} />
                {t.title}
              </Link>
            ))}
            {tooltip.tasks.length > 5 && (
              <p className="text-[10px] text-text-subtle mt-1">+{tooltip.tasks.length - 5} more</p>
            )}
          </div>
        </div>
      )}

      {/* Create task modal */}
      {showCreateTask && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]" onClick={() => setShowCreateTask(false)}>
          <div className="bg-[var(--card)] rounded-xl p-6 w-full max-w-md border border-border-subtle" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-1">New Task</h2>
            <p className="text-xs text-text-subtle mb-4">Due: {createTaskDate}</p>
            <form onSubmit={handleCreateTask}>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  placeholder="Task title..."
                  className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-[var(--background)] text-text focus:outline-none focus:border-accent/50"
                  autoFocus
                  required
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Project</label>
                <select
                  value={newTaskProjectId}
                  onChange={e => setNewTaskProjectId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-[var(--background)] text-text focus:outline-none focus:border-accent/50"
                  required
                >
                  <option value="">Select project...</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Priority</label>
                <select
                  value={newTaskPriority}
                  onChange={e => setNewTaskPriority(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-[var(--background)] text-text focus:outline-none focus:border-accent/50"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
              {createError && <div className="text-error text-sm mb-3">{createError}</div>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Task'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateTask(false)}
                  className="flex-1 border border-border-subtle text-text px-4 py-2 rounded-lg"
                >
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

export default Calendar;
