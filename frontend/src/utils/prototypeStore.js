export const loadMock = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

export const saveMock = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event('av-management-updated'));
  window.dispatchEvent(new Event('av-customer-updated'));
  return value;
};

export const uid = (prefix = 'REC') => {
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  return `${prefix}-${stamp}-${Math.floor(Math.random() * 90 + 10)}`;
};
