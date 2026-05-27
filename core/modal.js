let activeModal = null;

export function showModal({ title, content, actions = [], onClose }) {
  closeModal();

  let container = document.getElementById("modal-root");

  if (!container) {
    container = document.createElement("div");
    container.id = "modal-root";
    document.body.appendChild(container);
  }

  const actionHtml = actions
    .map((action, index) => {
      const className = action.className ? ` ${action.className}` : "";
      return `<button type="button" class="modal-action${className}" data-modal-action="${index}">${action.label}</button>`;
    })
    .join("");

  container.innerHTML = `
    <div class="modal-backdrop" data-modal-close>
      <section class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header class="modal-header">
          <h2 id="modal-title">${title}</h2>
          <button type="button" class="icon-button" aria-label="Close" data-modal-close>&times;</button>
        </header>
        <div class="modal-body">
          ${content}
        </div>
        <footer class="modal-footer">
          ${actionHtml}
        </footer>
      </section>
    </div>
  `;

  activeModal = { actions, onClose };

  const runAction = (index) => {
    const action = actions[index];
    if (!action?.onClick) return;

    Promise.resolve(action.onClick()).then((shouldClose) => {
      if (shouldClose !== false) closeModal();
    });
  };

  container.querySelector(".modal-backdrop").addEventListener("click", (event) => {
    const closeButton = event.target.closest("button[data-modal-close]");

    if (event.target === event.currentTarget || closeButton) {
      closeModal();
      return;
    }

    const actionButton = event.target.closest("[data-modal-action]");
    if (!actionButton) return;

    runAction(Number(actionButton.dataset.modalAction));
  });

  container.querySelector(".modal-panel").addEventListener("submit", (event) => {
    event.preventDefault();
    runAction(0);
  });

  const firstField = container.querySelector("input, select, textarea, button");
  firstField?.focus();
}

export function closeModal() {
  const container = document.getElementById("modal-root");

  if (container) {
    container.innerHTML = "";
  }

  if (activeModal?.onClose) {
    activeModal.onClose();
  }

  activeModal = null;
}
