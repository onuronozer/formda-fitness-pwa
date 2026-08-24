import type { EvidenceReference } from '../domain/models'
import { createEntityMetadata } from '../domain/models'

export const CLINICAL_EVIDENCE_SEED_VERSION = 2
const reviewedAt = '2026-08-24T00:00:00.000Z'
const evidence = (input: Omit<EvidenceReference, 'createdAt' | 'updatedAt' | 'deletedAt' | 'version' | 'schemaVersion' | 'lastReviewedAt' | 'verificationStatus' | 'reviewStatus'>): EvidenceReference => ({
  ...createEntityMetadata(reviewedAt),
  ...input,
  lastReviewedAt: reviewedAt,
  verificationStatus: 'VERIFIED',
  reviewStatus: 'PENDING',
})

export const EVIDENCE_IDS = {
  acsmResistance2026: 'evidence-acsm-resistance-2026',
  whoPhysicalActivity2020: 'evidence-who-physical-activity-2020',
  accAhaBloodPressure2025: 'evidence-acc-aha-blood-pressure-2025',
  ahaSevereBpRepeat: 'evidence-aha-severe-bp-repeat',
  wfnsLumbarConservative2024: 'evidence-wfns-lumbar-conservative-2024',
  lumbarExercise2025: 'evidence-lumbar-exercise-meta-2025',
  lumbarExercise2026: 'evidence-lumbar-exercise-meta-2026',
  caudaEquinaGuidelines2025: 'evidence-cauda-equina-guidelines-2025',
  resistanceWeightLoss2025: 'evidence-resistance-weight-loss-2025',
  niceNg246: 'evidence-nice-ng246',
  mifflin1990: 'evidence-mifflin-1990',
  mortonProtein2018: 'evidence-morton-protein-2018',
} as const

export const clinicalEvidenceSeed: EvidenceReference[] = [
  evidence({ id: EVIDENCE_IDS.acsmResistance2026, title: 'American College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews', organization: 'American College of Sports Medicine', authors: ["Brad S. Currier", "Alysha C. D'Souza", 'Maria A. Fiatarone Singh', 'et al.'], year: 2026, evidenceType: 'systematic_review', doi: '10.1249/MSS.0000000000003897', url: 'https://doi.org/10.1249/MSS.0000000000003897' }),
  evidence({ id: EVIDENCE_IDS.whoPhysicalActivity2020, title: 'WHO Guidelines on Physical Activity and Sedentary Behaviour', organization: 'World Health Organization', year: 2020, evidenceType: 'guideline', url: 'https://www.who.int/publications/i/item/9789240015128' }),
  evidence({ id: EVIDENCE_IDS.accAhaBloodPressure2025, title: '2025 AHA/ACC/AANP/AAPA/ABC/ACCP/ACPM/AGS/AMA/ASPC/NMA/PCNA/SGIM Guideline for the Prevention, Detection, Evaluation, and Management of High Blood Pressure in Adults', organization: 'American Heart Association and American College of Cardiology', year: 2025, evidenceType: 'guideline', doi: '10.1016/j.jacc.2025.05.007', url: 'https://doi.org/10.1016/j.jacc.2025.05.007' }),
  evidence({ id: EVIDENCE_IDS.ahaSevereBpRepeat, title: 'Understanding Blood Pressure Readings', organization: 'American Heart Association', year: 2025, evidenceType: 'guideline', url: 'https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings' }),
  evidence({ id: EVIDENCE_IDS.wfnsLumbarConservative2024, title: 'The role of conservative treatment in lumbar disc herniations: WFNS spine committee recommendations', organization: 'WFNS Spine Committee', authors: ['Onur Yaman', 'Artem Guchkha', 'Sandeep Vaishya', 'et al.'], year: 2024, evidenceType: 'systematic_review', doi: '10.1016/j.wnsx.2024.100277', url: 'https://doi.org/10.1016/j.wnsx.2024.100277' }),
  evidence({ id: EVIDENCE_IDS.lumbarExercise2025, title: 'Clinical efficacy of exercise therapy for lumbar disc herniation: a systematic review and meta-analysis of randomized controlled trials', authors: ['Shaojie Du', 'Zeyu Cui', 'Shurui Peng', 'et al.'], year: 2025, evidenceType: 'meta_analysis', doi: '10.3389/fmed.2025.1531637', url: 'https://doi.org/10.3389/fmed.2025.1531637' }),
  evidence({ id: EVIDENCE_IDS.lumbarExercise2026, title: 'Effects of Physical Exercise on Pain in Patients With Lumbar Disc Herniation: A Systematic Review and Meta-Analysis of Randomised Controlled Trials', authors: ['Diego Gama Linhares', 'Bruno Gama Linhares', 'Lilliany de Souza Cordeiro', 'et al.'], year: 2026, evidenceType: 'meta_analysis', doi: '10.1002/msc.70231', url: 'https://doi.org/10.1002/msc.70231' }),
  evidence({ id: EVIDENCE_IDS.caudaEquinaGuidelines2025, title: 'Assessment and early investigation of cauda equina syndrome: a systematic review of existing international guidelines and summary of the current evidence', authors: ['Orla Hennessy', 'A. T. Devitt', 'K. Synnott', 'M. Timlin'], year: 2025, evidenceType: 'systematic_review', doi: '10.1007/s00586-025-08732-0', url: 'https://doi.org/10.1007/s00586-025-08732-0' }),
  evidence({ id: EVIDENCE_IDS.resistanceWeightLoss2025, title: 'Effect of resistance exercise on body composition, muscle strength and cardiometabolic health during dietary weight loss in people living with overweight or obesity: a systematic review and meta-analysis', authors: ['Ahmad Binmahfoz', 'Anas Dighriri', 'Cindy Gray'], year: 2025, evidenceType: 'meta_analysis', doi: '10.1136/bmjsem-2024-002363', url: 'https://doi.org/10.1136/bmjsem-2024-002363' }),
  evidence({ id: EVIDENCE_IDS.niceNg246, title: 'Overweight and obesity management (NG246)', organization: 'National Institute for Health and Care Excellence', year: 2025, evidenceType: 'guideline', url: 'https://www.nice.org.uk/guidance/ng246' }),
  evidence({ id: EVIDENCE_IDS.mifflin1990, title: 'A new predictive equation for resting energy expenditure in healthy individuals', authors: ['M. D. Mifflin', 'S. T. St Jeor', 'L. A. Hill', 'B. J. Scott', 'S. A. Daugherty', 'Y. O. Koh'], year: 1990, evidenceType: 'prediction_equation', doi: '10.1093/ajcn/51.2.241', url: 'https://pubmed.ncbi.nlm.nih.gov/2305711/' }),
  evidence({ id: EVIDENCE_IDS.mortonProtein2018, title: 'A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength in healthy adults', authors: ['Robert W. Morton', 'Kevin T. Murphy', 'Sean R. McKellar', 'et al.'], year: 2018, evidenceType: 'meta_analysis', doi: '10.1136/bjsports-2017-097608', url: 'https://doi.org/10.1136/bjsports-2017-097608' }),
]
