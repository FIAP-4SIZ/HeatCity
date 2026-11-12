// A single default for the video example; alternative images stay available in the catalog.
export function isHospitalAlternative(reference) {
  return (
    (reference.projectId || reference.project_id) === 'hospital-orientacao-base-v1' &&
    reference.name.includes(' B ')
  );
}
export function referenceLabel(reference) {
  if ((reference.projectId || reference.project_id) === 'hospital-orientacao-base-v1')
    return isHospitalAlternative(reference)
      ? 'Hospital — imagem alternativa (não usada no vídeo de exemplo)'
      : 'Hospital — placas do vídeo de exemplo';
  return reference.name;
}
