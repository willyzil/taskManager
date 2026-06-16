import React from 'react';

interface Task {
  id: string;
  title: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assignee: string;
  dueDate: string;
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
}

interface Column {
  id: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
  title: string;
  tasks: Task[];
}

const ProjectBoard: React.FC = () => {
  const columns: Column[] = [
    {
      id: 'TODO',
      title: 'To Do',
      tasks: [
        {
          id: '1',
          title: 'Design Homepage',
          priority: 'HIGH',
          assignee: 'John Doe',
          dueDate: '2023-06-15',
          status: 'TODO'
        },
        {
          id: '2',
          title: 'Setup CI/CD',
          priority: 'MEDIUM',
          assignee: 'Jane Smith',
          dueDate: '2023-06-10',
          status: 'TODO'
        }
      ]
    },
    {
      id: 'IN_PROGRESS',
      title: 'In Progress',
      tasks: [
        {
          id: '3',
          title: 'Implement Auth',
          priority: 'URGENT',
          assignee: 'Robert Johnson',
          dueDate: '2023-06-05',
          status: 'IN_PROGRESS'
        }
      ]
    },
    {
      id: 'IN_REVIEW',
      title: 'In Review',
      tasks: [
        {
          id: '4',
          title: 'Write Documentation',
          priority: 'LOW',
          assignee: 'Emily Davis',
          dueDate: '2023-06-20',
          status: 'IN_REVIEW'
        }
      ]
    },
    {
      id: 'DONE',
      title: 'Done',
      tasks: [
        {
          id: '5',
          title: 'Project Setup',
          priority: 'MEDIUM',
          assignee: 'Michael Wilson',
          dueDate: '2023-06-01',
          status: 'DONE'
        }
      ]
    }
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'LOW': return 'bg-gray-600';
      case 'MEDIUM': return 'bg-blue-600';
      case 'HIGH': return 'bg-orange-600';
      case 'URGENT': return 'bg-red-600';
      default: return 'bg-gray-600';
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'LOW': return 'Low';
      case 'MEDIUM': return 'Medium';
      case 'HIGH': return 'High';
      case 'URGENT': return 'Urgent';
      default: return 'Low';
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Project Board</h1>
      
      <div className="flex space-x-4 overflow-x-auto pb-4">
        {columns.map((column) => (
          <div key={column.id} className="flex-shrink-0 w-72 bg-gray-800 rounded-lg border border-gray-700">
            <div className="p-3 border-b border-gray-700">
              <h2 className="font-medium">{column.title}</h2>
              <span className="text-xs bg-gray-700 rounded-full px-2 py-1 ml-2">
                {column.tasks.length}
              </span>
            </div>
            
            <div className="p-2 space-y-2">
              {column.tasks.map((task) => (
                <div 
                  key={task.id} 
                  className="bg-gray-900 rounded-md border border-gray-700 p-3 hover:border-gray-600 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium">{task.title}</h3>
                    <span className={`text-xs rounded-full px-2 py-1 ${getPriorityColor(task.priority)}`}>
                      {getPriorityText(task.priority)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center mt-2">
                    <div className="flex items-center">
                      <div className="bg-gray-600 rounded-full w-6 h-6 flex items-center justify-center text-xs">
                        {task.assignee.charAt(0)}
                      </div>
                      <span className="text-xs ml-2">{task.assignee}</span>
                    </div>
                    <span className="text-xs">{task.dueDate}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProjectBoard;