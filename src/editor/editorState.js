export const EDITOR_MODES = [
  { id: 'simple', name: 'Simple Editor', description: 'Click to edit content. Move sections without extra design controls.' },
  { id: 'advanced', name: 'Easy + Advanced', description: 'Content first, with design settings when you need them.' },
  { id: 'professional', name: 'Professional Editor', description: 'Layers, reusable sections and detailed responsive settings.' },
];
export function editorMode(value) { return EDITOR_MODES.some(mode => mode.id === value) ? value : 'advanced'; }
