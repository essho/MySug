document.addEventListener('DOMContentLoaded', () => {
    const addAlertForm = document.getElementById('addAlertForm');
    const alertsList = document.getElementById('alertsList');
    
    const renderAlerts = async () => {
        const alerts = await loadAlertsLocally();
        alertsList.innerHTML = '';
        alerts.forEach((alert, index) => {
            const li = document.createElement('li');
            li.className = 'alert-item';
            li.innerHTML = `
                <div class="alert-details">
                    <strong>${alert.name}</strong>
                    <span>الوقت: ${alert.time}</span>
                    <span>الصوت: ${alert.sound}</span>
                </div>
                <button class="delete-btn" data-id="${alert.id}">حذف</button>
            `;
            alertsList.appendChild(li);
        });
    };
    
    addAlertForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newAlert = {
            name: document.getElementById('alertName').value,
            time: document.getElementById('alertTime').value,
            sound: document.getElementById('alertSound').value,
            enabled: true
        };
        const alertId = await saveAlertLocally(newAlert);
        newAlert.id = alertId;
        
        renderAlerts();
        addAlertForm.reset();
        alert('تم إضافة التنبيه بنجاح!');
        syncAlertsWithServer();
    });

    alertsList.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-btn')) {
            e.stopPropagation(); // هذا السطر يوقف انتشار الحدث
            const id = parseInt(e.target.dataset.id);
            await deleteAlertLocally(id);
            renderAlerts();
            syncAlertsWithServer();
        }
    });

    renderAlerts();
});