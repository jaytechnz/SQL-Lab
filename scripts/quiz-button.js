// Tiny non-module fallback so the Quiz button opens even if the app bundle stalls.
(function () {
  function openQuizFallback() {
    var overlay = document.getElementById('quiz-overlay');
    var card = document.getElementById('quiz-card');
    if (!overlay) {
      alert('Quiz panel was not found on this page. Please reload the latest index.html.');
      return;
    }
    overlay.classList.remove('hidden');
    overlay.style.setProperty('display', 'flex', 'important');
    overlay.style.setProperty('z-index', '5000', 'important');
    if (card && !card.innerHTML.trim()) {
      card.innerHTML = '<div class="quiz-card-body"><p class="quiz-prompt">Loading quiz...</p></div>';
    }
  }

  function closeQuizFallback() {
    var overlay = document.getElementById('quiz-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
      overlay.style.removeProperty('display');
      overlay.style.removeProperty('z-index');
    }
  }

  window.SQLLabQuizOpen = window.SQLLabQuizOpen || openQuizFallback;

  function wire() {
    var openButton = document.getElementById('btn-quiz');
    var closeButton = document.getElementById('quiz-close');
    if (openButton && !openButton.dataset.quizFallbackReady) {
      openButton.dataset.quizFallbackReady = 'true';
      openButton.addEventListener('click', function () {
        window.SQLLabQuizOpen();
      });
    }
    if (closeButton && !closeButton.dataset.quizFallbackReady) {
      closeButton.dataset.quizFallbackReady = 'true';
      closeButton.addEventListener('click', closeQuizFallback);
    }
  }

  document.addEventListener('click', function (event) {
    var quizButton = event.target && event.target.closest && event.target.closest('#btn-quiz');
    if (!quizButton) return;
    event.preventDefault();
    event.stopPropagation();
    window.SQLLabQuizOpen();
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
