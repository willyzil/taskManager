import React, { useState, useEffect } from 'react';
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
  const [loading, setLoading] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState('MEDIUM');
  const [creating, setCreating] = useState(false);
  const [taskError, setTaskError] = useState('');

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get(`/api/projects/${id}`),
      api.get(`/api/tasks?projectId=${id}`),
    ]).then(([projectData, tasksData]) => {
      if (projectData.success) setProject(projectData.project);
      if (tasksData.success) setTasks(tasksData.tasks);
    }).finally(() => setLoading(false));
  }, [id]);

  const moveTask = async (taskId: string, currentStatus: Status) => {
    const currentIndex = STATUS_ORDER.indexOf(currentStatus);
    if (currentIndex === STATUS_ORDER.length - 1) return;
    const nextStatus = STATUS_ORDER[currentIndex + 1];
    const data = await api.patch(`/api/tasks/${taskId}`, { status: nextStatus });
    if (data.success) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: nextStatus } : t));
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setTaskError('');
    const data = await api.post('/api/tasks', { title: newTitle, projectId: id, priority: newPriority });
    if (data.success) {
      setTasks(prev => [...prev, data.task]);
      setShowAddTask(false);
      setNewTitle('');
      setNewPriority('MEDIUM');
    } else {
      setTaskError(data.message || 'Failed to create task');
    }
    setCreating(false);
  };

  const handleDeleteTask = async (taskId: string) => {
    const data = await api.delete(`/api/tasks/${taskId}`);
    if (data.success) {
      setTasks(prev => prev.filter(t => t.id !== taskId));
    }
  };

  if (loading) return <div className="p-6 text-gray-400">Loading...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
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
        <button
          onClick={() => setShowAddTask(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          Add Task
        </button>
      </div>

      <div className="flex space-x-4 overflow-x-auto pb-4">
        {STATUS_ORDER.map(status => {
          const columnTasks = tasks.filter(t => t.status === status);
          const nextStatus = STATUS_ORDER[STATUS_ORDER.indexOf(status) + 1];
          return (
            <div key={status} className="flex-shrink-0 w-72 bg-gray-800 rounded-lg border border-gray-700">
              <div className="p-3 border-b border-gray-700 flex items-center gap-2">
                <h2 className="font-medium">{COLUMN_TITLES[status]}</h2>
                <span className="text-xs bg-gray-700 rounded-full px-2 py-0.5">{columnTasks.length}</span>
              </div>
              <div className="p-2 space-y-2 min-h-[100px]">
                {columnTasks.map(task => (
                  <div
                    key={task.id}
                    className="bg-gray-900 rounded-md border border-gray-700 p-3 hover:border-gray-600 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <h3 className="font-medium text-sm flex-1">{task.title}</h3>
                      <span className={`text-xs rounded-full px-2 py-0.5 shrink-0 ${PRIORITY_COLORS[task.priority] || 'bg-gray-600'}`}>
                        {task.priority}
                      </span>
                    </div>
                    {task.assignee && (
                      <div className="flex items-center gap-1 mb-2">
                        <div className="bg-gray-600 rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">
                          {task.assignee.name.charAt(0)}
                        </div>
                        <span className="text-xs text-gray-400">{task.assignee.name}</span>
                      </div>
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
              <div className="mb-6">
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
    </div>
  );
};

export default ProjectBoard;
