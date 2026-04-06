export const normalizeMediaUrl = (url) => {
  const value = String(url || '').trim();
  if (!value) return '';
  if (value.startsWith('//')) {
    return `https:${value}`;
  }
  if (value.startsWith('http://')) {
    return `https://${value.slice('http://'.length)}`;
  }
  return value;
};
