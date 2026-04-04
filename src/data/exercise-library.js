export const EXERCISES = [
  // CHEST
  { id: 'bench-press',      name: 'Bench Press',        muscle: 'Chest',     equipment: 'barbell',    cues: ['Retract shoulder blades', 'Bar to lower chest', 'Feet flat on floor', 'Elbows at ~75° from torso'] },
  { id: 'push-up',          name: 'Push-up',             muscle: 'Chest',     equipment: 'bodyweight', cues: ['Body in a straight line', 'Hands shoulder-width apart', 'Chest nearly touches floor', 'Elbows at 45°'] },
  { id: 'cable-fly',        name: 'Cable Chest Fly',     muscle: 'Chest',     equipment: 'cable',      cues: ['Slight bend in elbows', 'Squeeze at centre', 'Control the eccentric', 'Chest height cables'] },
  // BACK
  { id: 'deadlift',         name: 'Deadlift',            muscle: 'Back',      equipment: 'barbell',    cues: ['Bar close to body', 'Back flat — chest up', 'Push floor away', 'Lock out at the top'] },
  { id: 'barbell-row',      name: 'Barbell Row',         muscle: 'Back',      equipment: 'barbell',    cues: ['Hinge at hips ~45°', 'Pull bar to lower chest', 'Retract scapulae', 'Keep back flat'] },
  { id: 'lat-pulldown',     name: 'Lat Pulldown',        muscle: 'Back',      equipment: 'machine',    cues: ['Lean back slightly', 'Pull to upper chest', 'Squeeze lats at bottom', 'Control the return'] },
  { id: 'pull-up',          name: 'Pull-up',             muscle: 'Back',      equipment: 'bodyweight', cues: ['Full hang to start', 'Pull chest to bar', 'Retract shoulder blades', 'No kipping'] },
  // LEGS
  { id: 'squat',            name: 'Barbell Squat',       muscle: 'Legs',      equipment: 'barbell',    cues: ['Knees track over toes', 'Hip crease below knee', 'Chest up', 'Brace your core'] },
  { id: 'leg-press',        name: 'Leg Press',           muscle: 'Legs',      equipment: 'machine',    cues: ['Feet shoulder-width', 'Knees track over toes', 'Do not lock knees at top', 'Lower until 90° knee angle'] },
  { id: 'lunge',            name: 'Lunge',               muscle: 'Legs',      equipment: 'bodyweight', cues: ['Step forward to 90° knee angle', 'Keep torso upright', 'Front knee over ankle', 'Push through heel'] },
  // SHOULDERS
  { id: 'overhead-press',   name: 'Overhead Press',      muscle: 'Shoulders', equipment: 'barbell',    cues: ['Bar in front of face', 'Core tight', 'Press straight up', 'Lock out at top'] },
  { id: 'lateral-raise',    name: 'Lateral Raise',       muscle: 'Shoulders', equipment: 'dumbbell',   cues: ['Slight elbow bend', 'Raise to shoulder height', 'Lead with elbows', 'Control descent'] },
  // ARMS
  { id: 'bicep-curl',       name: 'Bicep Curl',          muscle: 'Arms',      equipment: 'dumbbell',   cues: ['Elbows at side — do not swing', 'Supinate at the top', 'Full range of motion', 'Control descent'] },
  { id: 'tricep-dip',       name: 'Tricep Dip',          muscle: 'Arms',      equipment: 'bodyweight', cues: ['Hands at hips width', 'Elbows track back not out', 'Lower until 90°', 'Press through palms'] },
  // CORE
  { id: 'plank',            name: 'Plank',               muscle: 'Core',      equipment: 'bodyweight', cues: ['Body in straight line', 'Brace abs — do not sag hips', 'Shoulders over wrists', 'Breathe steadily'] },
  { id: 'kettlebell-swing', name: 'Kettlebell Swing',    muscle: 'Core',      equipment: 'kettlebell', cues: ['Hip hinge — not squat', 'Drive hips forward explosively', 'Arms are just a guide', 'Keep back flat'] },
];

export const MUSCLE_GROUPS = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'];

export function exercisesByMuscle(muscle) {
  return EXERCISES.filter(e => e.muscle === muscle);
}
