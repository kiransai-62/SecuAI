import { api } from './api';
import { Project } from '../types';

export const projectsService = {
  getProjects: () => api.getProjects(),
  getProject: (id: string) => api.getProject(id),
  createProject: (input: any) => api.createProject(input),
  updateProject: (id: string, input: any) => api.updateProject(id, input),
  deleteProject: (id: string) => api.deleteProject(id),
  getProjectScans: (projectId: string) => api.getProjectScans(projectId),
};

export default projectsService;
