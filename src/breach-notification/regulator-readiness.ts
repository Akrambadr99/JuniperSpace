export interface RegulatorResponseRecord {
  responseId: string
  regulator: string
  deadline: string
  reviewOn: string | null
  reviewer: string | null
  draftComplete: boolean
  missingEvidence: string[]
  amendmentRequired: boolean
  amendmentCompleted: boolean
  released: boolean
}

export interface RegulatorResponseReadiness {
  responseId: string
  regulator: string
  priority: 'overdue' | 'review-due' | 'blocked' | 'ready'
  blockers: string[]
  reviewScheduled: boolean
  releaseEligible: boolean
  released: boolean
}

export const seededRegulatorResponses: RegulatorResponseRecord[] = [
  { responseId: 'REG-FCA-204', regulator: 'FCA', deadline: '2026-10-21', reviewOn: '2026-10-19', reviewer: 'M. Chen', draftComplete: true, missingEvidence: ['EVD-DEVICE-7'], amendmentRequired: false, amendmentCompleted: false, released: false },
  { responseId: 'REG-DPA-118', regulator: 'DPA', deadline: '2026-10-28', reviewOn: null, reviewer: null, draftComplete: true, missingEvidence: [], amendmentRequired: true, amendmentCompleted: false, released: false },
  { responseId: 'REG-ICO-099', regulator: 'ICO', deadline: '2026-10-15', reviewOn: '2026-10-13', reviewer: 'R. Diaz', draftComplete: true, missingEvidence: [], amendmentRequired: false, amendmentCompleted: false, released: true },
]

export function regulatorResponseReadiness(
  records: RegulatorResponseRecord[],
  asOf: string,
): RegulatorResponseReadiness[] {
  const rank = { overdue: 0, 'review-due': 1, blocked: 2, ready: 3 } as const
  return records
    .map((record) => {
      const blockers = [
        ...record.missingEvidence.map((evidence) => `Missing ${evidence}`),
        ...(!record.draftComplete ? ['Draft incomplete'] : []),
        ...(record.amendmentRequired && !record.amendmentCompleted ? ['Amendment outstanding'] : []),
      ]
      const reviewScheduled = record.reviewOn !== null && record.reviewer !== null
      const priority = record.released
        ? 'ready'
        : record.deadline < asOf
          ? 'overdue'
          : record.reviewOn !== null && record.reviewOn <= asOf
            ? 'review-due'
            : blockers.length > 0 || !reviewScheduled
              ? 'blocked'
              : 'ready'
      return {
        responseId: record.responseId,
        regulator: record.regulator,
        priority,
        blockers,
        reviewScheduled,
        releaseEligible: !record.released && blockers.length === 0 && reviewScheduled,
        released: record.released,
      } satisfies RegulatorResponseReadiness
    })
    .sort((a, b) => rank[a.priority] - rank[b.priority])
}
