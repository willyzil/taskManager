import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { api } from '../api';

interface ActivityItem {
  id: string;
  action: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  projectId: string;
  projectName: string;
  entityId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

interface ActivityFeedProps {
  projectId?: string;
  onNewActivity?: (activity: ActivityItem) => void;
}

const ACTION_DESCRIPTIONS: Record<string, string> = {
  'TASK_CREATED': 'created a new task',
  'TASK_UPDATED': 'updated a task',
  'TASK_MOVED': 'moved a task',
  'TASK_ASSIGNED': 'assigned a task',
  'TASK_STATUS_CHANGED': 'changed task status',
  'TASK_DELETED': 'deleted a task',
  'COMMENT_ADDED': 'added a comment',
  'PROJECT_CREATED': 'created a project',
  'PROJECT_UPDATED': 'updated a project',
  'MEMBER_INVITED': 'invited a member',
};

const getTimeAgo = (date: Date): string => {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  const intervals = [
    { label: 'year', seconds: 31536000 },
    { label: 'month', seconds: 2592000 },
    { label: 'day', seconds: 86400 },
    { label: 'hour', seconds: 3600 },
    { label: 'minute', seconds: 60 },
  ];
  
  for (const interval of intervals) {
    const count = Math.floor(seconds / interval.seconds);
    if (count >= 1) {
      if (count === 1) return `1 ${interval.label} ago`;
      return `${count} ${interval.label}s ago`;
    }
  }
  
  return 'Just now';
};

const ActivityFeed: React.FC<ActivityFeedProps> = ({ projectId, onNewActivity }) => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(20);
  const { user } = useAuth();
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;
    const handler = (activity: ActivityItem) => {
      if (onNewActivity) onNewActivity(activity);
      setActivities(prev => [{ ...activity, createdAt: new Date(activity.createdAt) }, ...prev]);
    };
    socket.on('activity:new', handler);
    return () => { socket.off('activity:new', handler); };
  }, [socket, onNewActivity]);

  useEffect(() => {
    setLoading(true);
    api.get(`/api/activity?limit=${limit}`)
      .then(data => {
        if (data.success) {
          const newLogs: ActivityItem[] = data.logs.map((log: any) => ({ ...log, createdAt: new Date(log.createdAt) }));
          if (limit > 20) {
            setActivities(prev => {
              const existingIds = new Set(prev.map(a => a.id));
              const unique = newLogs.filter(a => !existingIds.has(a.id));
              return [...prev, ...unique];
            });
          } else {
            setActivities(newLogs);
          }
        }
      })
      .catch(err => console.error('Error fetching activities:', err))
      .finally(() => setLoading(false));
  }, [limit, projectId]);

  const getUserAvatar = (userName: string, avatar: string | null): string => {
    if (avatar && avatar.trim()) {
      return avatar;
    }
    const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase();
    return initials;
  };

  const getActionDescription = (action: string): string => {
    return ACTION_DESCRIPTIONS[action] || action;
  };

  if (!user) {
    return <div className="p-6 text-gray-400">Loading...</div>;
  }

  return (
    <div className="h-full flex flex-col bg-gray-800 rounded-lg border border-gray-700">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold">Activity Feed</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading ? (
          <p className="text-gray-400 text-center py-8">Loading...</p>
        ) : activities.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No activity yet</p>
        ) : (
          activities.map((activity) => (
            <div key={activity.id} className="bg-gray-900 rounded-md border border-gray-700 p-3 hover:border-gray-600 transition-colors">
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-xs font-semibold text-white">
                    {getUserAvatar(activity.userName, activity.userAvatar)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200">
                    <span className="font-medium">{activity.userName}</span>{' '}
                    <span className="text-gray-400">{getActionDescription(activity.action)}</span>
                  </p>
                  {activity.projectName && (
                    <p className="text-xs text-gray-500 mt-0.5">in <span className="text-gray-400">{activity.projectName}</span></p>
                  )}
                  {activity.metadata?.assignee && (
                    <p className="text-xs text-gray-500 mt-0.5">→ assigned to {activity.metadata.assignee}</p>
                  )}
                  {activity.metadata?.priority && (
                    <p className="text-xs text-gray-500 mt-0.5">→ priority: {activity.metadata.priority}</p>
                  )}
                  <p className="text-xs text-gray-600 mt-1">
                    {getTimeAgo(activity.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      <div className="p-3 border-t border-gray-700">
        <button
          onClick={() => setLimit(prev => Math.min(prev + 20, 100))}
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          Load more ({limit} items)
        </button>
      </div>
    </div>
  );
};

export default ActivityFeed;
