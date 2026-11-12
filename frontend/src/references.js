import { api, post } from './api.js';
export async function loadReferences() {
  const projects = await api('/projects');
  const full = await Promise.all(projects.map((p) => api(`/projects/${p.id}`)));
  return full.flatMap((p) => p.references.map((r) => ({ ...r, projectId: p.id })));
}
export async function uploadProject() {
  const projects = await api('/projects');
  return (
    projects.find((p) => p.title === 'Minhas fotos') ||
    post('/projects', {
      title: 'Minhas fotos',
      objective: 'Referências para localizar placas nos meus vídeos.',
    })
  );
}
