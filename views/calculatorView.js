window.convertKj = function () {
  const kj = Number(document.getElementById("kjInput").value || 0);
  const calories = kj / 4.2;

  document.getElementById("calorieResult").innerText =
    kj ? `${calories.toFixed(0)} calories` : "Enter kJ above";
};

export function renderCalculatorView() {
  return `
    <h2>kJ → Calories</h2>
    <p class="muted">Quick label maths while shopping.</p>

    <div class="card">
      <input
        id="kjInput"
        type="number"
        placeholder="Enter kilojoules"
        oninput="convertKj()"
      />

      <div class="metric">
        <span class="muted">Estimated calories</span>
        <strong id="calorieResult">Enter kJ above</strong>
      </div>
    </div>
  `;
}