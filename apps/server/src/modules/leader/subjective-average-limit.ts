export type SubjectiveAverageScoreSnapshot = {
  id: string;
  score: number | null;
};

export type SubjectiveAverageLimitResult = {
  averageScore: number;
  limitScore: number;
  participantCount: number;
  totalScore: number;
  exceeded: boolean;
};

const EPSILON = 1e-6;

export function buildSubjectiveAverageLimitGroupKey(name: string, points: number) {
  return `${name.trim()}::${points}`;
}

export function evaluateSubjectiveAverageLimit(
  points: number,
  currentScores: SubjectiveAverageScoreSnapshot[],
  proposedScores: Map<string, number>
): SubjectiveAverageLimitResult {
  const participantCount = currentScores.length;
  const totalScore = currentScores.reduce(
    (sum, current) => sum + (proposedScores.get(current.id) ?? current.score ?? 0),
    0
  );
  const averageScore = participantCount > 0 ? totalScore / participantCount : 0;
  const limitScore = points * 0.9;

  return {
    averageScore,
    limitScore,
    participantCount,
    totalScore,
    exceeded: averageScore - limitScore > EPSILON
  };
}
