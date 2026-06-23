import React, { useState, useEffect } from 'react';
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
  tags: Array<{ tag: { id: string; name: string; color: string } }>;
}

interface CalendarTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  assignee: { id: string; name: string } | null;
  tags: Array<{ tag: { id: string; name: string; color: string } }>;
  projectId: string;
  projectName: string;
}

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

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const Calendar: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [loading, setLoading] = useState(true);

  const [viewDate, setViewDate] = useState(new Date());
  const currentMonth = viewDate.getMonth();
  const currentYear = viewDate.getFullYear();

  // Calendar grid state
  const [calendarDays, setCalendarDays] = useState<{ day: number; date: Date; isCurrentMonth: boolean }[]>([]);

  // Today's tasks (expanded view)
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  useEffect(() => {
    api.get('/api/projects').then(data => {
      if (data.success) setProjects(data.projects);
    });
  }, []);

  useEffect(() => {
    if (projects.length === 0) return;

    const fetchAll = async () => {
      const results = await Promise.all(
        projects.map(async p => {
          const res = await api.get(`/api/tasks?projectId=${p.id}`);
          if (!res.success) return [];
          return (res.tasks || []).map((t: Task) => ({
            ...t,
            projectId: p.id,
            projectName: p.name,
          }));
        })
      );
      const allTasks = results.flat().filter((t: CalendarTask) => t.dueDate !== null) as CalendarTask[];
      setTasks(allTasks);
      setLoading(false);
    };

    fetchAll();
  }, [projects]);

  // Build calendar grid
  useEffect(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const days: { day: number; date: Date; isCurrentMonth: boolean }[] = [];
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

    const current = new Date(startDate);
    while (current <= endDate) {
      days.push({
        day: current.getDate(),
        date: new Date(current),
        isCurrentMonth: current.getMonth() === currentMonth,
      });
      current.setDate(current.getDate() + 1);
    }

    setCalendarDays(days);
  }, [currentMonth, currentYear]);

  const prevMonth = () => setViewDate(new Date(currentYear, currentMonth - 1, 1));
  const nextMonth = () => setViewDate(new Date(currentYear, currentMonth + 1, 1));
  const goToToday = () => setViewDate(new Date());

  const getTasksForDate = (date: Date): CalendarTask[] => {
    const dateStr = date.toISOString().split('T')[0];
    const filter = selectedProjectId
      ? (t: CalendarTask) => t.dueDate?.startsWith(dateStr) && t.projectId === selectedProjectId
      : (t: CalendarTask) => t.dueDate?.startsWith(dateStr);
    return tasks.filter(filter as any);
  };

  const getDateString = (date: Date): string => date.toISOString().split('T')[0];

  const todayStr = new Date().toISOString().split('T')[0];
  const selectedTasks = selectedDate ? getTasksForDate(new Date(selectedDate)) : [];

  if (loading) return <div className="p-6 text-text-subtle">Loading...</div>;

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6 min-h-screen bg-[var(--background)]">
      {/* Calendar Grid */}
      <div className="flex-1">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={prevMonth} className="w-9 h-9 rounded-lg bg-[var(--card)] border border-border-subtle flex items-center justify-center hover:bg-[var(--card)]/80 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h2 className="text-xl font-bold">
              {MONTHS[currentMonth]} {currentYear}
            </h2>
            <button onClick={nextMonth} className="w-9 h-9 rounded-lg bg-[var(--card)] border border-border-subtle flex items-center justify-center hover:bg-[var(--card)]/80 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
            <button onClick={goToToday} className="px-3 py-1.5 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
              Today
            </button>
          </div>

          {/* Project filter */}
          {projects.length > 1 && (
            <select
              value={selectedProjectId || ''}
              onChange={e => setSelectedProjectId(e.target.value || null)}
              className="px-3 py-1.5 rounded-lg bg-[var(--card)] border border-border-subtle text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Projects</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Calendar Table */}
        <div className="bg-[var(--card)] border border-border-subtle rounded-xl overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-border-subtle">
            {DAYS.map(day => (
              <div key={day} className="py-2 text-center text-xs font-semibold text-text-subtle uppercase tracking-wider">
                {day}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((d, i) => {
              const dateStr = getDateString(d.date);
              const isToday = dateStr === todayStr;
              const dayTasks = getTasksForDate(d.date);
              const isSelected = dateStr === selectedDate;

              return (
                <div
                  key={i}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`min-h-[80px] p-1.5 border-b border-r border-border-subtle/30 cursor-pointer transition-colors hover:bg-[var(--card)]/50 ${
                    d.isCurrentMonth ? '' : 'bg-[var(--background)]/50'
                  } ${isSelected ? 'ring-2 ring-inset ring-accent' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday ? 'bg-accent text-white' : d.isCurrentMonth ? 'text-text' : 'text-text-subtle/40'
                    }`}>
                      {d.day}
                    </span>
                    {dayTasks.length > 0 && (
                      <span className="text-[10px] text-text-subtle/60 bg-[var(--background)]/80 rounded-full px-1.5 py-0.5">
                        {dayTasks.length}
                      </span>
                    )}
                  </div>

                  {/* Task dots */}
                  <div className="space-y-0.5">
                    {dayTasks.slice(0, 4).map(task => (
                      <div key={task.id} className={`text-[10px] truncate px-1 py-0.5 rounded border-l-2 ${STATUS_COLORS[task.status] || ''} bg-[var(--background)]/60 text-text-subtle hover:text-text transition-colors`}>
                        {task.title}
                      </div>
                    ))}
                    {dayTasks.length > 4 && (
                      <div className="text-[10px] text-text-subtle/50 pl-1">+{dayTasks.length - 4} more</div>
                    )}
                  </div>
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
              <button
                onClick={() => setSelectedDate(null)}
                className="text-text-subtle/50 hover:text-text transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {selectedTasks.length === 0 ? (
              <p className="text-xs text-text-subtle/50 text-center py-8">No tasks due on this date</p>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {selectedTasks.map(task => (
                  <Link
                    key={task.id}
                    to={`/project/${task.projectId}`}
                    onClick={() => setSelectedDate(null)}
                    className={`block p-3 rounded-lg bg-[var(--background)]/60 border border-border-subtle/50 border-l-4 ${STATUS_COLORS[task.status] || ''} hover:bg-[var(--background)] transition-colors group`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-medium group-hover:text-accent transition-colors">{task.title}</h4>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${PRIORITY_BADGE[task.priority] || ''}`}>
                        {task.priority}
                      </span>
                    </div>
                    <p className="text-xs text-text-subtle/60 mt-1">{task.projectName}</p>
                    {task.assignee && (
                      <p className="text-xs text-text-subtle/50 mt-0.5">
                        <svg className="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        {task.assignee.name}
                      </p>
                    )}
                    {task.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {task.tags.map(tt => (
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
    </div>
  );
};

export default Calendar;
