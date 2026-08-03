/** Process-area tint for floating glass pool labels. */
export type PoolLabelTone =
  | 'intake'
  | 'ph'
  | 'fenton'
  | 'coagulation'
  | 'clarifier'
  | 'intermediate'
  | 'daf'
  | 'mixing'
  | 'drainage'
  | 'outfall'
  | 'sludge'
  | 'chemical-pac'
  | 'chemical-pam'
  | 'chemical-cacl2'
  | 'purewater'
  | 'neutral';

export function resolvePoolLabelTone(equipmentId: string): PoolLabelTone {
  if (equipmentId.startsWith('pw-')) return 'purewater';
  if (equipmentId.startsWith('tk-collection')) return 'intake';
  if (equipmentId === 'tk-ph1' || equipmentId === 'tk-ph2' || equipmentId === 'tk-ph3') return 'ph';
  if (equipmentId === 'tk-fenton') return 'fenton';
  if (equipmentId === 'tk-coagulation' || equipmentId === 'tk-flocculation') return 'coagulation';
  if (equipmentId === 'tk-clarifier') return 'clarifier';
  if (equipmentId === 'tk-intermediate') return 'intermediate';
  if (equipmentId === 'tk-daf') return 'daf';
  if (equipmentId === 'tk-mixing') return 'mixing';
  if (equipmentId === 'tk-drainage') return 'drainage';
  if (equipmentId === 'tk-outfall') return 'outfall';
  if (equipmentId === 'tk-sludge') return 'sludge';
  if (equipmentId.includes('pac')) return 'chemical-pac';
  if (equipmentId.includes('pam')) return 'chemical-pam';
  if (equipmentId.includes('cacl2')) return 'chemical-cacl2';
  return 'neutral';
}
