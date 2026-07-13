export type OrganizationProject = {
  projectUuid: string;
  name: string;
  type: string;
  createdByUserUuid: string | null;
  createdByUserName: string | null;
  createdAt: string;
  upstreamProjectUuid: string | null;
  warehouseType?: string;
  expiresAt: string | null;
};
