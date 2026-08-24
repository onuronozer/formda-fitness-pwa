import type { ClinicalReleaseStatus } from '../domain/enums'

export const CLINICAL_RELEASE_STATUS: ClinicalReleaseStatus = 'CLINICAL_REVIEW_PENDING'

export const CLINICAL_RELEASE = {
  status: CLINICAL_RELEASE_STATUS,
  reviewedBy: undefined,
  reviewedAt: undefined,
  releaseApprovedAt: undefined,
} as const
