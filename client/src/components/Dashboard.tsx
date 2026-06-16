import React, { useState } from 'react';

interface Project {
  id: string;
  name: string;
  owner: string;
  contributors: number;
  tasks: number;
  progress: number;
}

const Dashboard: React.FC = () => {
  const [projects] = useState<Project[]>([
    {
      id: '1',
      name: 'Website Redesign',
      owner: 'John Doe',
      contributors: 5,
      tasks: 24,
      progress: 65
    },
    {
      id: '2',
      name: 'Mobile App',
      owner: 'Jane Smith',
      contributors: 3,
      tasks: 18,
      progress: 40
    },
    {
      id: '3',
      name: 'Marketing Campaign',
      owner: 'Robert Johnson',
      contributors: 7,
      tasks: 32,
      progress: 80
    }
  ]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
          New Project
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project) => (
          <div key={project.id} className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            <div className="p-4">
              <h2 className="text-lg font-semibold mb-2">{project.name}</h2>
              <p className="text-sm text-gray-400 mb-3">Owner: {project.owner}</p>
              <div className="flex justify-between mb-2">
                <span className="text-sm">Contributors: {project.contributors}</span>
                <span className="text-sm">Tasks: {project.tasks}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full" 
                  style={{ width: `${project.progress}%` }}
                ></div>
              </div>
              <div className="text-right text-sm text-gray-400">
                {project.progress}%
              </div>
            </div>
            <div className="px-4 py-3 bg-gray-900 border-t border-gray-700">
              <button className="text-blue-400 hover:text-blue-300 text-sm">
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;