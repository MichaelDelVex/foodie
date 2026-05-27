export function renderSettingsView(user) {
  return `
    <h2>Settings</h2>

    <div class="card">
      <h3>Signed in</h3>
      <p class="muted">${user.email}</p>
      <button onclick="logout()">Logout</button>
    </div>
  `;
}