document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.delete-form').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      const username = form.dataset.username;
      if (!confirm('Delete user "' + username + '"? This action cannot be undone.')) {
        e.preventDefault();
      }
    });
  });
});
