export const ORG_REPOSITORY = Symbol('ORG_REPOSITORY');

export interface OrgRepository {
  countActiveUsersByReviewGroupId(reviewGroupId: string): Promise<number>;
}
