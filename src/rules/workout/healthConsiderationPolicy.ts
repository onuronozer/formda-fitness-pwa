import type { EvidenceReference, ExerciseHealthConsideration } from '../../domain/models'

export function isOperationalHealthConsideration(consideration: ExerciseHealthConsideration, evidenceReferences: EvidenceReference[]) {
  if (!consideration.reviewed || consideration.reviewStatus !== 'REVIEWED' || !consideration.reviewedBy || !consideration.reviewedAt || !consideration.nextReviewAt || consideration.evidenceIds.length === 0) return false
  const verifiedIds = new Set(evidenceReferences.filter((reference) => reference.verificationStatus === 'VERIFIED').map((reference) => reference.id))
  return consideration.evidenceIds.every((id) => verifiedIds.has(id))
}
