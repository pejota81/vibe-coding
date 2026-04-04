document.addEventListener('DOMContentLoaded', function () {
  function syncRepeatableEmptyState(manager) {
    const emptyState = manager.querySelector('[data-repeatable-empty]');
    const entries = manager.querySelectorAll('[data-repeatable-entry]');
    if (!emptyState) {
      return;
    }
    emptyState.style.display = entries.length === 0 ? '' : 'none';
  }

  function updateRepeatablePlaceholder(entry) {
    const select = entry.querySelector('[data-repeatable-type]');
    const input = entry.querySelector('[data-repeatable-value]');
    if (!select || !input) {
      return;
    }
    const selectedOption = select.options[select.selectedIndex];
    input.placeholder = selectedOption ? (selectedOption.dataset.placeholder || '') : '';
  }

  function getDragAfterElement(list, clientY) {
    const draggableElements = Array.from(list.querySelectorAll('[data-repeatable-entry]:not(.is-dragging)'));
    let closest = { offset: Number.NEGATIVE_INFINITY, element: null };

    draggableElements.forEach(function (entry) {
      const box = entry.getBoundingClientRect();
      const offset = clientY - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        closest = { offset: offset, element: entry };
      }
    });

    return closest.element;
  }

  function initializeRepeatableManager(manager) {
    const addButton = manager.querySelector('[data-repeatable-add]');
    const list = manager.querySelector('[data-repeatable-list]');
    const template = manager.querySelector('[data-repeatable-template]');
    const removeMessage = manager.dataset.removeMessage || 'Remove this entry?';
    const enableReorder = manager.dataset.enableReorder === 'true';
    let draggedEntry = null;

    if (!addButton || !list || !template) {
      return;
    }

    addButton.addEventListener('click', function () {
      const fragment = template.content.cloneNode(true);
      const entry = fragment.querySelector('[data-repeatable-entry]');
      if (!entry) {
        return;
      }
      list.appendChild(fragment);
      updateRepeatablePlaceholder(list.lastElementChild);
      syncRepeatableEmptyState(manager);
    });

    list.addEventListener('change', function (event) {
      if (!event.target.matches('[data-repeatable-type]')) {
        return;
      }
      const entry = event.target.closest('[data-repeatable-entry]');
      if (entry) {
        updateRepeatablePlaceholder(entry);
      }
    });

    list.addEventListener('click', function (event) {
      if (!event.target.matches('[data-repeatable-remove]')) {
        return;
      }
      const entry = event.target.closest('[data-repeatable-entry]');
      if (!entry) {
        return;
      }
      if (!confirm(removeMessage)) {
        return;
      }
      entry.remove();
      syncRepeatableEmptyState(manager);
    });

    if (enableReorder) {
      list.addEventListener('dragstart', function (event) {
        const entry = event.target.closest('[data-repeatable-entry]');
        if (!entry) {
          return;
        }
        draggedEntry = entry;
        entry.classList.add('is-dragging');
        event.dataTransfer.effectAllowed = 'move';
      });

      list.addEventListener('dragover', function (event) {
        event.preventDefault();
        if (!draggedEntry) {
          return;
        }
        const afterElement = getDragAfterElement(list, event.clientY);
        if (!afterElement) {
          list.appendChild(draggedEntry);
          return;
        }
        if (afterElement !== draggedEntry) {
          list.insertBefore(draggedEntry, afterElement);
        }
      });

      list.addEventListener('drop', function (event) {
        event.preventDefault();
      });

      list.addEventListener('dragend', function () {
        if (!draggedEntry) {
          return;
        }
        draggedEntry.classList.remove('is-dragging');
        draggedEntry = null;
      });
    }

    list.querySelectorAll('[data-repeatable-entry]').forEach(function (entry) {
      updateRepeatablePlaceholder(entry);
    });
    syncRepeatableEmptyState(manager);
  }

  function initializeRepeatableValidation(form) {
    form.addEventListener('submit', function (event) {
      const managers = form.querySelectorAll('[data-repeatable-manager]');
      for (let i = 0; i < managers.length; i += 1) {
        const manager = managers[i];
        const kind = manager.dataset.entryKind || 'entry';
        const entries = manager.querySelectorAll('[data-repeatable-entry]');

        for (let j = 0; j < entries.length; j += 1) {
          const entry = entries[j];
          const valueInput = entry.querySelector('[data-repeatable-value]');
          if (!valueInput) {
            continue;
          }

          if (String(valueInput.value || '').trim() === '') {
            event.preventDefault();
            alert('Please fill or remove the empty ' + kind.replace('-', ' ') + ' entry before saving.');
            valueInput.focus();
            return;
          }
        }
      }
    });
  }

  document.querySelectorAll('.delete-form').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      const username = form.dataset.username;
      if (!confirm('Delete user "' + username + '"? This action cannot be undone.')) {
        e.preventDefault();
      }
    });
  });

  document.querySelectorAll('.delete-role-form').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      const rolename = form.dataset.rolename;
      if (!confirm('Delete role "' + rolename + '"? This action cannot be undone.')) {
        e.preventDefault();
      }
    });
  });

  document.querySelectorAll('[data-repeatable-manager]').forEach(initializeRepeatableManager);
  document.querySelectorAll('form').forEach(initializeRepeatableValidation);
});
