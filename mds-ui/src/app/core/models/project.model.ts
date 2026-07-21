export type GitProvider = 'github' | 'gitlab' | 'bitbucket' | 'generic';

export type ProjectRepoSummary = {
  configured: boolean;
  cloned: boolean;
  branch?: string | null;
  commitSha?: string | null;
  lastSyncAt?: string | null;
};

export type ProjectSummary = {
  projectUuid: string;
  name: string;
  type: string;
  createdByUserUuid: string | null;
  createdByUserName: string | null;
  createdAt: string;
  upstreamProjectUuid: string | null;
  warehouseType?: string;
  warehouseUuid?: string | null;
  warehouseName?: string | null;
  expiresAt: string | null;
  gitRepoUrl?: string | null;
  gitDefaultBranch?: string;
  gitProvider?: GitProvider | null;
  gitSubdirectory?: string | null;
  hasGitToken?: boolean;
  dbtProjectPath?: string | null;
  repo?: ProjectRepoSummary;
};

export type ProjectRepoStatus = {
  configured: boolean;
  cloned: boolean;
  clonePath?: string | null;
  branch?: string | null;
  defaultBranch: string;
  commitSha?: string | null;
  lastSyncAt?: string | null;
  gitRepoUrl?: string | null;
  gitProvider?: GitProvider | null;
  gitSubdirectory?: string | null;
  dbtProjectPath?: string | null;
};
