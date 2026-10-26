export function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
}

export function downloadText(filename, text, mime = 'text/plain') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadBlob(response, filename) {
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function safeName(name) {
  return name.replace(/[^a-zA-Z0-9_.-]+/g, '_') || 'file';
}

export const LANGUAGES = [
  'Python', 'JavaScript', 'TypeScript', 'Java', 'C++', 'C#', 'Go',
  'Rust', 'Ruby', 'Kotlin', 'Swift', 'Scala', 'Dart', 'PHP', 'SQL',
];

export const PROJECT_TYPES = [
  'Web Application', 'REST API', 'CLI Tool', 'Library/Package',
  'Microservice', 'Full-Stack Application', 'Data Pipeline',
  'Machine Learning', 'Mobile App', 'Desktop Application',
];
