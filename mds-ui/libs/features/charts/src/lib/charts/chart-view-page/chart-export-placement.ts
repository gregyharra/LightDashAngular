export function chartExportPlacement(
  editMode: boolean,
): 'header' | 'results' {
  return editMode ? 'results' : 'header';
}
