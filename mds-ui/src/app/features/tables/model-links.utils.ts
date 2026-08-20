import {
  ModelJoinOrigin,
  ModelJoinView,
} from '../../core/models/model-join.model';

export function originLabel(origin: ModelJoinOrigin): string {
  return origin === 'dbt' ? 'dbt meta' : 'custom';
}

/** Confirm-dialog copy identifying a table link by source → target. */
export function modelJoinDeleteMessage(link: ModelJoinView): string {
  return `Delete the link ${link.sourceModelName}.${link.sourceColumn} → ${link.targetModelName}.${link.targetColumn}?`;
}

/** Case-insensitive substring match across visible link fields. */
export function filterModelJoinViews(
  links: ModelJoinView[],
  query: string,
  variant: 'hub' | 'project',
): ModelJoinView[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return links;
  }

  return links.filter((link) => {
    const haystack = [
      ...(variant === 'project' ? [link.sourceModelName] : []),
      link.sourceColumn,
      link.targetModelName,
      link.targetColumn,
      link.joinType,
      link.relationship ?? '',
      originLabel(link.origin),
      link.label ?? '',
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalized);
  });
}
