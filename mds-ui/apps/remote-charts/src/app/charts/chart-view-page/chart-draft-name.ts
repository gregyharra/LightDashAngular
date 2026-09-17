export function resolveChartDraftName(
  draftName: string,
  edited: boolean,
  translatedDefault: string,
): string {
  return edited ? draftName : translatedDefault;
}
