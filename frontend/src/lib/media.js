export const normalizeMediaUrl = (url) => {
  const value = String(url || '').trim();
  if (!value) return '';
  if (value.startsWith('//')) {
    return `https:${value}`;
  }
  return value.replace('http://', 'https://');
};
