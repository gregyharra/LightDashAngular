import { GitProvider } from '../../core/models/project.model';

export function detectGitProvider(url: string): GitProvider | null {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const host = new URL(trimmed).hostname.toLowerCase();
    if (host.includes('github')) {
      return 'github';
    }
    if (host.includes('gitlab')) {
      return 'gitlab';
    }
    if (host.includes('bitbucket')) {
      return 'bitbucket';
    }
  } catch {
    const lowered = trimmed.toLowerCase();
    if (lowered.includes('github')) {
      return 'github';
    }
    if (lowered.includes('gitlab')) {
      return 'gitlab';
    }
    if (lowered.includes('bitbucket')) {
      return 'bitbucket';
    }
  }

  return 'generic';
}
