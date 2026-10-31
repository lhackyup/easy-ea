export function suggestLibraryCode(name: string): string {
  if (!name || !name.trim()) return '';
  const trimmed = name.trim();
  const words = trimmed.split(/[^a-zA-Z]+/).filter(Boolean);
  
  if (words.length >= 4) {
    const initials = words.slice(0, 4).map(w => w[0].toUpperCase()).join('');
    if (initials.length === 4) return initials;
  }
  
  const letters = trimmed.replace(/[^a-zA-Z]/g, '').toUpperCase();
  if (letters.length >= 4) {
    return letters.slice(0, 4);
  }
  return letters.padEnd(4, 'X');
}

export function sanitizeLibraryCode(input: string): string {
  return input.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase();
}
