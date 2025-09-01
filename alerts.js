document.addEventListener('DOMContentLoaded', () => {
    const addAlertForm = document.getElementById('addAlertForm');
    const alertsList = document.getElementById('alertsList');
    const alertAudio = document.getElementById('alertAudio');
    if (Notification.permission !== 'granted') {
        Notification.requestPermission();
    }
    const saveAlerts = (alerts) => {
        localStorage.setItem('alerts', JSON.stringify(alerts));
    };
    const loadAlerts = () => {
        const alerts = localStorage.getItem('alerts');
        return alerts ? JSON.parse(alerts) : [];
    };
    const renderAlerts = () => {
        alertsList.innerHTML = '';
        const alerts = loadAlerts();
        alerts.forEach((alert, index) => {
            const li = document.createElement('li');
            li.className = 'alert-item';
            li.innerHTML = `
                <div class="alert-details">
                    <strong>${alert.name}</strong>
                    <span>الوقت: ${alert.time}</span>
                </div>
                <button class="delete-btn" data-index="${index}">حذف</button>
            `;
            alertsList.appendChild(li);
        });
    };
    const scheduleAlert = (alert) => {
        const now = new Date();
        const [alertHour, alertMinute] = alert.time.split(':');
        const alertDate = new Date();
        alertDate.setHours(alertHour, alertMinute, 0, 0);
        if (alertDate < now) {
            alertDate.setDate(alertDate.getDate() + 1);
        }
        const timeUntilAlert = alertDate.getTime() - now.getTime();
        setTimeout(() => {
            if (Notification.permission === 'granted') {
                new Notification(alert.name, {
                    body: `حان وقت ${alert.name} الآن.`,
                    icon: '/path/to/your/icon.png'
                });
                if (alertAudio) {
                    alertAudio.play();
                }
            }
            scheduleAlert(alert);
        }, timeUntilAlert);
    };
    addAlertForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const newAlert = {
            name: document.getElementById('alertName').value,
            time: document.getElementById('alertTime').value,
            sound: document.getElementById('alertSound').value
        };
        const alerts = loadAlerts();
        alerts.push(newAlert);
        saveAlerts(alerts);
        renderAlerts();
        scheduleAlert(newAlert);
        addAlertForm.reset();
    });
    alertsList.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const index = e.target.dataset.index;
            const alerts = loadAlerts();
            alerts.splice(index, 1);
            saveAlerts(alerts);
            renderAlerts();
        }
    });
    const alerts = loadAlerts();
    alerts.forEach(alert => scheduleAlert(alert));
    renderAlerts();
});