document.addEventListener('DOMContentLoaded', () => {
  const addAlertForm = document.getElementById('addAlertForm');
  const alertsList = document.getElementById('alertsList');

  const repeatLabelMap = { once: 'مرة واحدة', daily: 'يومي', weekly: 'أسبوعي', monthly: 'شهري' };

  function pad(n){ return String(n).padStart(2,'0'); }
  function toLocalFloating(date){
    return `${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
  }
  function weekdayToIcsByDay(jsDayIndex){
    const map = ['SU','MO','TU','WE','TH','FR','SA'];
    return map[jsDayIndex];
  }
  function makeAlarmICS({ title, startDate, repeat='once', offsetMin=0, description='' }){
    const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@mysug`;
    const dtstamp = toLocalFloating(new Date());
    const dtstart = toLocalFloating(startDate);
    let rrule = '';
    if (repeat === 'daily') rrule = 'RRULE:FREQ=DAILY';
    else if (repeat === 'weekly') rrule = `RRULE:FREQ=WEEKLY;BYDAY=${weekdayToIcsByDay(startDate.getDay())}`;
    else if (repeat === 'monthly') rrule = `RRULE:FREQ=MONTHLY;BYMONTHDAY=${startDate.getDate()}`;
    const trigger = `TRIGGER:-PT${Math.max(0, Number(offsetMin)||0)}M`;
    const lines = [
      'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//MySug//Alerts//AR','CALSCALE:GREGORIAN','METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`, `DTSTAMP:${dtstamp}`, `DTSTART:${dtstart}`,
      ...(rrule ? [rrule] : []),
      `SUMMARY:${title}`,
      ...(description ? [`DESCRIPTION:${description}`] : []),
      'BEGIN:VALARM', trigger, 'ACTION:DISPLAY', `DESCRIPTION:${title}`, 'END:VALARM',
      'END:VEVENT','END:VCALENDAR'
    ];
    return new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  }
  function downloadICS(blob, filename='mysug-alert.ics'){
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.replace(/[^\w.\-]/g,'_');
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const renderAlerts = async () => {
    const alerts = await loadAlertsLocally();
    alertsList.innerHTML = '';
    alerts.forEach((alert) => {
      const li = document.createElement('li');
      li.className = 'alert-item';
      const dateLabel = alert.date ? `التاريخ: ${alert.date}` : 'التاريخ: —';
      const repLabel  = `التكرار: ${repeatLabelMap[alert.repeat || 'once']}`;
      const offLabel  = `التذكير: ${Number(alert.offsetMin||0)} د`;
      li.innerHTML = `
        <div class="alert-details">
          <strong>${alert.name || 'تنبيه'}</strong>
          <span>الوقت: ${alert.time || '--:--'}</span>
          <span>${dateLabel} | ${repLabel} | ${offLabel}</span>
          <span>الصوت: ${alert.sound || 'default'}</span>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <button class="ics-btn" data-id="${alert.id}" title="إضافة إلى التقويم">📅</button>
          <button class="delete-btn" data-id="${alert.id}">حذف</button>
        </div>
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
      date: document.getElementById('alertDate').value || null,
      repeat: document.getElementById('alertRepeat').value || 'once',
      offsetMin: parseInt(document.getElementById('alertOffset').value || '0', 10),
      enabled: true
    };
    const alertId = await saveAlertLocally(newAlert);
    newAlert.id = alertId;
    alert('تم إضافة التنبيه بنجاح!');
    renderAlerts();
    addAlertForm.reset();
  });

  alertsList.addEventListener('click', async (e) => {
    if (e.target.classList.contains('delete-btn')) {
      e.stopPropagation();
      const id = parseInt(e.target.dataset.id);
      await deleteAlertLocally(id);
      renderAlerts();
    }
    if (e.target.classList.contains('ics-btn')) {
      e.stopPropagation();
      const id = parseInt(e.target.dataset.id, 10);
      const alerts = await loadAlertsLocally();
      const alertObj = alerts.find(a => a.id === id);
      if (!alertObj) return;
      const [hh, mm] = (alertObj.time || '00:00').split(':').map(Number);
      const baseDate = alertObj.date ? new Date(alertObj.date + 'T00:00:00') : new Date();
      baseDate.setHours(hh||0, mm||0, 0, 0);
      const blob = makeAlarmICS({
        title: alertObj.name || 'تنبيه',
        startDate: baseDate,
        repeat: alertObj.repeat || 'once',
        offsetMin: Number(alertObj.offsetMin||0),
        description: 'تنبيه من تطبيق سكري'
      });
      const fname = `${(alertObj.name||'تنبيه')}_${alertObj.repeat||'once'}_${(alertObj.time||'00-00').replace(':','-')}.ics`;
      downloadICS(blob, fname);
    }
  });

  // Export all alerts to one ICS
  document.getElementById('exportAllIcsBtn')?.addEventListener('click', async () => {
    const alerts = await loadAlertsLocally();
    if (!alerts || !alerts.length) { alert('لا توجد تنبيهات للتصدير.'); return; }

    const events = alerts.map((a) => {
      const [hh, mm] = (a.time || '00:00').split(':').map(Number);
      const start = a.date ? new Date(a.date + 'T00:00:00') : new Date();
      start.setHours(hh||0, mm||0, 0, 0);
      const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@mysug`;
      const dtstamp = toLocalFloating(new Date());
      const dtstart = toLocalFloating(start);
      let rrule = '';
      const rep = a.repeat || 'once';
      if (rep === 'daily') rrule = 'RRULE:FREQ=DAILY';
      else if (rep === 'weekly') rrule = `RRULE:FREQ=WEEKLY;BYDAY=${weekdayToIcsByDay(start.getDay())}`;
      else if (rep === 'monthly') rrule = `RRULE:FREQ=MONTHLY;BYMONTHDAY=${start.getDate()}`;
      const trigger = `TRIGGER:-PT${Math.max(0, Number(a.offsetMin||0))}M`;
      const title = a.name || 'تنبيه';
      const desc  = 'تنبيه من تطبيق سكري';
      return [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART:${dtstart}`,
        ...(rrule ? [rrule] : []),
        `SUMMARY:${title}`,
        `DESCRIPTION:${desc}`,
        'BEGIN:VALARM', trigger, 'ACTION:DISPLAY', `DESCRIPTION:${title}`, 'END:VALARM',
        'END:VEVENT'
      ].join('\r\n');
    }).join('\r\n');

    const ics = [
      'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//MySug//Alerts Export//AR','CALSCALE:GREGORIAN','METHOD:PUBLISH',
      events,'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    downloadICS(blob, 'mysug_alerts_all.ics');
  });

  renderAlerts();
});
