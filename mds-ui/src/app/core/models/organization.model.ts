export type OrganizationProject = {
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
};
