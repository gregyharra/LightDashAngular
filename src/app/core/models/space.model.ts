export type Space = {
  uuid: string;
  name: string;
  isPrivate: boolean;
  projectUuid: string;
  userAccess: { userUuid: string; hasAccess: boolean }[];
  groupAccess: unknown[];
  parentSpaceUuid: string | null;
  path: string;
};
