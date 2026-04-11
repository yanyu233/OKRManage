import { IsIn } from 'class-validator';

const COMPLETION_STATES = ['incomplete', 'completed'] as const;

export class UpdateKrCompletionDto {
  @IsIn(COMPLETION_STATES)
  completionState!: (typeof COMPLETION_STATES)[number];
}
