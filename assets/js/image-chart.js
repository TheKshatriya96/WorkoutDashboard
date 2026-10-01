const chart = document.getElementById('chart');

for (const dayKey of window.WORKOUT_DAYS) {
  const day = window.WORKOUTS[dayKey];
  const section = document.createElement('section');
  section.className = 'day';
  section.innerHTML = `
    <div class="day-head">
      <h2>${day.label} · ${day.title}</h2>
      <div class="folder">assets/images/exercises/${dayKey}/</div>
    </div>
    <div class="grid">
      ${day.exercises.map(exercise => `
        <article class="exercise">
          <h3>${exercise.name}</h3>
          <div class="poses">
            <div class="pose"><img src="${exercise.images.a}" alt="${exercise.name} A"><strong>FORM A</strong><code>${exercise.images.a}</code></div>
            <div class="pose"><img src="${exercise.images.b}" alt="${exercise.name} B"><strong>FORM B</strong><code>${exercise.images.b}</code></div>
          </div>
        </article>`).join('')}
    </div>`;
  chart.appendChild(section);
}
