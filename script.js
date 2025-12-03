const retryBtn = document.getElementById('retry-btn');
const card = document.getElementById('downtime-card');
const lastCheck = document.getElementById('last-check');

function updateLastCheck() {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  lastCheck.textContent = 'Last check: ' + time;
}

retryBtn.addEventListener('click', () => {
  card.classList.remove('pulse');
  void card.offsetWidth;
  card.classList.add('pulse');
  updateLastCheck();

  setTimeout(() => {
    location.reload();
  }, 350);
});

updateLastCheck();

setInterval(() => {
  location.reload();
}, 60000);
