export async function api(path, body, method = 'GET') {
  const response = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      typeof error.detail === 'string'
        ? error.detail
        : Array.isArray(error.detail)
          ? error.detail.map((e) => e.msg).join(' · ')
          : 'Não foi possível concluir a operação. Verifique a API.',
    );
  }
  return response.status === 204 ? null : response.json();
}
export const post = (path, body) => api(path, body, 'POST');
export const route = (path) => {
  window.location.hash = path;
};
export const number = (value, digits = 1) =>
  value == null ? '—' : Number(value).toLocaleString('pt-BR', { maximumFractionDigits: digits });
export function download(path) {
  window.open(`/api${path}`, '_blank', 'noopener');
}
