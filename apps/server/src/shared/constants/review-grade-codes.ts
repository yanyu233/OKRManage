export const REVIEW_GRADE_CODES = ['A+', 'A', 'B+', 'B', 'C'] as const;

export type ReviewGradeCode = (typeof REVIEW_GRADE_CODES)[number];
