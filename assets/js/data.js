window.WORKOUT_DAYS = ['monday', 'tuesday', 'thursday', 'saturday'];

function makeExercise(day, order, details) {
  const idBase = details.slug || details.name.toLowerCase()
    .replace(/\+/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const imageBase = `assets/images/exercises/${day}/${String(order).padStart(2, '0')}-${idBase}`;

  return {
    id: `${day}-${idBase}`,
    name: details.name,
    sets: details.sets,
    repMin: details.repMin,
    repMax: details.repMax,
    restSeconds: details.restSeconds,
    category: details.category,
    cue: details.cue,
    doseSuffix: details.doseSuffix || '',
    doseMode: details.doseMode || 'range',
    images: {
      a: `${imageBase}-a.png`,
      b: `${imageBase}-b.png`
    }
  };
}

window.exerciseDoseText = function exerciseDoseText(exercise) {
  if (exercise.doseMode === 'quality') return `${exercise.sets} quality sets`;
  return `${exercise.sets} × ${exercise.repMin}–${exercise.repMax}${exercise.doseSuffix || ''}`;
};

window.repTargetText = function repTargetText(exercise) {
  if (exercise.doseMode === 'quality') return 'Quality reps';
  return `${exercise.repMin}–${exercise.repMax} reps${exercise.doseSuffix || ''}`;
};

window.WORKOUTS = {
  monday: {
    label: 'Mon', title: 'Push', color: '#c8ff3d',
    exercises: [
      makeExercise('monday', 1, { name:'Band-resisted push-up', sets:4, repMin:6, repMax:12, restSeconds:120, category:'compound', cue:'Brace the ribs. Lower under control; stop 1–2 reps before failure.' }),
      makeExercise('monday', 2, { name:'Feet-elevated push-up', sets:3, repMin:8, repMax:15, restSeconds:120, category:'compound', cue:'Keep one straight line from ankle to head. Drive through the upper chest.' }),
      makeExercise('monday', 3, { name:'Deep push-up', sets:3, repMin:8, repMax:15, restSeconds:120, category:'compound', cue:'Use stable handles only. Get a deep stretch without dumping the shoulders forward.' }),
      makeExercise('monday', 4, { name:'Pike push-up', sets:3, repMin:6, repMax:12, restSeconds:120, category:'compound', cue:'Hips high. Lower the head slightly ahead of the hands; press through shoulders.' }),
      makeExercise('monday', 5, { name:'Band lateral raise', sets:4, repMin:12, repMax:25, restSeconds:75, category:'isolation', cue:'Lead with elbows. Stop around shoulder height; do not swing the torso.' }),
      makeExercise('monday', 6, { name:'Band triceps extension', sets:3, repMin:10, repMax:20, restSeconds:75, category:'isolation', cue:'Keep elbows fixed and fully straighten without arching the lower back.' })
    ]
  },
  tuesday: {
    label: 'Tue', title: 'Pull', color: '#7ad7ff',
    exercises: [
      makeExercise('tuesday', 1, { name:'Strict pull-up', sets:4, repMin:1, repMax:8, restSeconds:150, category:'heavy-compound', doseMode:'quality', cue:'Start from a controlled hang. Pull chest upward; no kicking or swinging.' }),
      makeExercise('tuesday', 2, { name:'Band + lathi row', slug:'band-lathi-row', sets:4, repMin:8, repMax:15, restSeconds:120, category:'compound', cue:'Pull elbows behind you and pause. Keep the torso still.' }),
      makeExercise('tuesday', 3, { name:'One-arm band row', sets:3, repMin:10, repMax:15, restSeconds:120, category:'compound', doseSuffix:' / side', cue:'Reach forward, then drive the elbow toward the hip without twisting.' }),
      makeExercise('tuesday', 4, { name:'Straight-arm pulldown', sets:3, repMin:12, repMax:20, restSeconds:90, category:'pulldown', cue:'Use a secure anchor. Keep arms long and pull toward your thighs.' }),
      makeExercise('tuesday', 5, { name:'Rear-delt fly', sets:3, repMin:15, repMax:25, restSeconds:75, category:'isolation', cue:'Soft elbows. Open the arms without shrugging.' }),
      makeExercise('tuesday', 6, { name:'Band biceps curl', sets:3, repMin:8, repMax:15, restSeconds:75, category:'isolation', cue:'Keep elbows by the ribs and resist the return.' }),
      makeExercise('tuesday', 7, { name:'Hammer band curl', sets:2, repMin:10, repMax:20, restSeconds:75, category:'isolation', cue:'Neutral grip, still upper arm, complete range.' })
    ]
  },
  thursday: {
    label: 'Thu', title: 'Legs + core', color: '#ffc568',
    exercises: [
      makeExercise('thursday', 1, { name:'Band + lathi squat', slug:'band-lathi-squat', sets:4, repMin:8, repMax:15, restSeconds:150, category:'heavy-compound', cue:'Knees track with toes. Descend as far as control allows; drive the floor away.' }),
      makeExercise('thursday', 2, { name:'Bulgarian split squat', sets:3, repMin:8, repMax:15, restSeconds:120, category:'compound', doseSuffix:' / leg', cue:'Use a stable rear support. Keep most pressure through the front foot.' }),
      makeExercise('thursday', 3, { name:'Band Romanian deadlift', sets:4, repMin:8, repMax:15, restSeconds:150, category:'heavy-compound', cue:'Push hips back with a neutral spine. Stop when hamstrings limit the range.' }),
      makeExercise('thursday', 4, { name:'Hip thrust', sets:3, repMin:10, repMax:20, restSeconds:150, category:'heavy-compound', cue:'Finish by squeezing glutes, not by overextending the lower back.' }),
      makeExercise('thursday', 5, { name:'Single-leg calf raise', sets:4, repMin:15, repMax:30, restSeconds:75, category:'isolation', cue:'Use full stretch and a pause at the top. Hold support for balance.' }),
      makeExercise('thursday', 6, { name:'Hanging knee raise', sets:3, repMin:8, repMax:15, restSeconds:60, category:'core', cue:'Curl the pelvis upward; avoid turning it into a swinging drill.' }),
      makeExercise('thursday', 7, { name:'Reverse crunch', sets:3, repMin:12, repMax:20, restSeconds:60, category:'core', cue:'Lift the pelvis with abs. Lower slowly instead of throwing the legs.' })
    ]
  },
  saturday: {
    label: 'Sat', title: 'Upper growth', color: '#ff81cd',
    exercises: [
      makeExercise('saturday', 1, { name:'Strict pull-up', sets:3, repMin:6, repMax:12, restSeconds:150, category:'heavy-compound', cue:'Use clean reps. Add backpack load only after the top of the range is controlled.' }),
      makeExercise('saturday', 2, { name:'Band-resisted push-up', sets:3, repMin:8, repMax:15, restSeconds:120, category:'compound', cue:'Keep tension through the full rep and lock the torso in place.' }),
      makeExercise('saturday', 3, { name:'Band row', sets:3, repMin:8, repMax:15, restSeconds:120, category:'compound', cue:'Pull to the lower ribs and pause briefly.' }),
      makeExercise('saturday', 4, { name:'Band chest fly', sets:3, repMin:12, repMax:20, restSeconds:90, category:'fly', cue:'Use a secure rear anchor. Hug inward without letting shoulders roll forward.' }),
      makeExercise('saturday', 5, { name:'Band lateral raise', sets:4, repMin:15, repMax:25, restSeconds:75, category:'isolation', cue:'Controlled burn, not body swing.' }),
      makeExercise('saturday', 6, { name:'Rear-delt fly', sets:3, repMin:15, repMax:25, restSeconds:75, category:'isolation', cue:'Open wide and keep traps relaxed.' }),
      makeExercise('saturday', 7, { name:'Band biceps curl', sets:3, repMin:10, repMax:15, restSeconds:75, category:'isolation', cue:'Earn every rep with a slow lowering phase.' }),
      makeExercise('saturday', 8, { name:'Band triceps extension', sets:3, repMin:10, repMax:15, restSeconds:75, category:'isolation', cue:'Keep elbows narrow and reach full extension.' })
    ]
  }
};

window.DIETS = {
  veg: {
    totals: [['2,475', 'kcal'], ['119 g', 'protein'], ['~320 g', 'carbs'], ['~68 g', 'fat']],
    note: 'Numbers are estimates. Paneer fat %, roti size and cooking oil can move this plan by 200–400 kcal. Weigh the main foods for two weeks, then adjust from your weekly weight trend.',
    meals: [
      ['08:00', 'Breakfast', 'Oats + milk + banana', '470', '50 g oats, 150 ml milk, 1 banana, 15 g peanut butter', '17 g protein'],
      ['11:30', 'Mid-morning', 'Curd', '130', '200 g plain curd', '8 g protein'],
      ['14:00', 'Lunch', 'Roti, dal, paneer, sabzi', '870', '2 rotis, 1 bowl dal, 100 g paneer, 1 bowl vegetable sabzi', '42 g protein'],
      ['17:30', 'Pre-workout', 'Milk + banana', '250', '250 ml milk and 1 banana, ideally 60–90 minutes before training', '8 g protein'],
      ['20:30', 'Dinner', 'Rice, soy chunks, vegetables', '545', '1 cup cooked rice, 50 g dry-weight soy chunks, 1 bowl vegetables', '34 g protein'],
      ['22:30', 'Before sleep', 'Milk + a few nuts', '210', '250 ml milk and 10 g mixed nuts', '10 g protein']
    ]
  },
  nonveg: {
    totals: [['2,420', 'kcal'], ['128 g', 'protein'], ['~305 g', 'carbs'], ['~70 g', 'fat']],
    note: 'This is already high enough in protein for 61 kg. More chicken or whey is not automatically better. If bodyweight stays flat for 2–3 weeks, add about 150 kcal—not another 50 g of protein.',
    meals: [
      ['08:00', 'Breakfast', 'Eggs, toast, milk, banana', '620', '3 whole eggs, 2 bread slices, 250 ml milk, 1 banana', '32 g protein'],
      ['11:30', 'Mid-morning', 'Curd + fruit', '210', '200 g plain curd and one seasonal fruit', '8 g protein'],
      ['14:00', 'Lunch', 'Rice, chicken, dal, sabzi', '735', '1.25 cups cooked rice, 100 g cooked chicken, small bowl dal, vegetables', '48 g protein'],
      ['17:30', 'Pre-workout', 'Banana + tea/coffee', '120', '1 banana; tea or coffee with limited sugar', '1 g protein'],
      ['20:30', 'Dinner', 'Roti, fish, vegetables', '585', '2 rotis, 100 g fish, 1 bowl vegetables; account for cooking oil', '31 g protein'],
      ['22:30', 'Before sleep', 'Milk', '150', '250 ml milk', '8 g protein']
    ]
  }
};
