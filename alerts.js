document.addEventListener('DOMContentLoaded', () => {
  const addAlertForm = document.getElementById('addAlertForm');
  const alertsList = document.getElementById('alertsList');

  const repeatLabelMap = { once: 'مرة واحدة', daily: 'يومي', weekly: 'أسبوعي', monthly: 'شهري' };

  // ---------- Helpers ----------
  function pad(n){ return String(n).padStart(2,'0'); }
  function toLocalFloating(date){
    return `${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
  }
  function weekdayToIcsByDay(jsDayIndex){
    const map = ['SU','MO','TU','WE','TH','FR','SA'];
    return map[jsDayIndex];
  }

  function makeSingleEventICS(a) {
    // يبني نص VEVENT واحد من كائن تنبيه
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
  }

  function wrapCalendar(eventsText){
    return [
      'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//MySug//Alerts//AR','CALSCALE:GREGORIAN','METHOD:PUBLISH',
      eventsText,
      'END:VCALENDAR'
    ].join('\r\n');
  }

  async function shareOrDownloadICS(icsText, filename='mysug-alert.ics') {
    const blob = new Blob([icsText], { type: 'text/calendar;charset=utf-8' });

    // Web Share API (Level 2) مع الملفات
    const canShareFiles = !!(navigator.share && (navigator.canShare ? navigator.canShare({ files: [new File([blob], filename, { type: 'text/calendar' })] }) : true));
    if (navigator.share && canShareFiles) {
      try {
        const file = new File([blob], filename, { type: 'text/calendar' });
        await navigator.share({ files: [file], title: 'Add to Calendar' });
        return;
      } catch(e) {
        // لو المستخدم لغى المشاركة، نرجع للفallback
        console.log('Share canceled or failed, fallback to download/open.', e);
      }
    }

    // Fallback: تنزيل تقليدي
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename.replace(/[^\w.\-]/g,'_');
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch(e) {
      // Fallback أخير: فتح في تبويب (iOS أحيانًا يطلب Share يدوي)
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      // لا نعمل revokeObjectURL هنا فورًا عشان التبويب يفتح المحتوى
    }
  }

  // ---------- Rendering (with sorting) ----------
  function sortAlerts(alerts) {
    // فرز حسب الوقت تصاعديًا ثم الاسم
    return (alerts || []).slice().sort((a, b) => {
      const [ah, am] = (a.time || '00:00').split(':').map(Number);
      const [bh, bm] = (b.time || '00:00').split(':').map(Number);
      const aMin = (ah||0)*60 + (am||0);
      const bMin = (bh||0)*60 + (bm||0);
      if (aMin !== bMin) return aMin - bMin;
      return (a.name || '').localeCompare(b.name || '');
    });
  }

  const renderAlerts = async () => {
    const alertsRaw = await loadAlertsLocally();
    const alerts = sortAlerts(alertsRaw);
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
          <button class="share-btn" data-id="${alert.id}" title="مشاركة ملف التقويم">📤</button>
          <button class="delete-btn" data-id="${alert.id}">حذف</button>
        </div>
      `;
      alertsList.appendChild(li);
    });
  };

  // ---------- Form submit (إضافة تنبيه) ----------
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

    // ترتيب آمن للموبايل: إغلاق التركيز → (اختياري) إشعار غير حابس → إعادة العرض → reset
    document.activeElement?.blur();
    await renderAlerts();
    addAlertForm.reset();
    // (لو عايز رسالة سريعة، خليها Toast بدل alert حابس)
    // console.log('تم إضافة التنبيه بنجاح!');
  });

  // ---------- Per-item actions (download/share/delete) ----------
  alertsList.addEventListener('click', async (e) => {
    if (e.target.classList.contains('delete-btn')) {
      e.stopPropagation();
      const id = parseInt(e.target.dataset.id);
      await deleteAlertLocally(id);
      await renderAlerts();
    }

    if (e.target.classList.contains('ics-btn') || e.target.closest('.ics-btn')) {
      e.stopPropagation();
      const btn = e.target.closest('.ics-btn');
      const id = parseInt(btn.dataset.id, 10);
      const alerts = await loadAlertsLocally();
      const alertObj = alerts.find(a => a.id === id);
      if (!alertObj) return;

      const vevent = makeSingleEventICS(alertObj);
      const ics = wrapCalendar(vevent);
      const fname = `${(alertObj.name||'تنبيه')}_${alertObj.repeat||'once'}_${(alertObj.time||'00-00').replace(':','-')}.ics`;
      await shareOrDownloadICS(ics, fname); // نفس الدالة تدعم المشاركة أو التنزيل
    }

    if (e.target.classList.contains('share-btn') || e.target.closest('.share-btn')) {
      e.stopPropagation();
      const btn = e.target.closest('.share-btn');
      const id = parseInt(btn.dataset.id, 10);
      const alerts = await loadAlertsLocally();
      const alertObj = alerts.find(a => a.id === id);
      if (!alertObj) return;

      const vevent = makeSingleEventICS(alertObj);
      const ics = wrapCalendar(vevent);
      const fname = `${(alertObj.name||'تنبيه')}_${alertObj.repeat||'once'}_${(alertObj.time||'00-00').replace(':','-')}.ics`;
      await shareOrDownloadICS(ics, fname); // مشاركة/تنزيل
    }
  });

  // ---------- Export All & Share All ----------
  // إنشاء زر "مشاركة الكل للتقويم" بجوار "تصدير الكل"
  (function ensureShareAllButton() {
    const exportBtn = document.getElementById('exportAllIcsBtn');
    if (!exportBtn || document.getElementById('shareAllIcsBtn')) return;
    const shareBtn = document.createElement('button');
    shareBtn.type = 'button';
    shareBtn.id = 'shareAllIcsBtn';
    shareBtn.textContent = '📤 مشاركة الكل للتقويم';
    shareBtn.style.backgroundColor = '#6c757d';
    shareBtn.style.color = '#fff';
    shareBtn.style.marginInlineStart = '8px';
    exportBtn.parentElement?.insertBefore(shareBtn, exportBtn.nextSibling);
  })();

  // تصدير الكل (ملف واحد)
  document.getElementById('exportAllIcsBtn')?.addEventListener('click', async () => {
    const alerts = sortAlerts(await loadAlertsLocally());
    if (!alerts || !alerts.length) { alert('لا توجد تنبيهات للتصدير.'); return; }
    const events = alerts.map(makeSingleEventICS).join('\r\n');
    const ics = wrapCalendar(events);
    await shareOrDownloadICS(ics, 'mysug_alerts_all.ics'); // يدعم المشاركة أيضًا لو متاح
  });

  // مشاركة الكل (نفس الملف لكن نُفضّل المشاركة)
  document.getElementById('shareAllIcsBtn')?.addEventListener('click', async () => {
    const alerts = sortAlerts(await loadAlertsLocally());
    if (!alerts || !alerts.length) { alert('لا توجد تنبيهات للمشاركة.'); return; }
    const events = alerts.map(makeSingleEventICS).join('\r\n');
    const ics = wrapCalendar(events);
    await shareOrDownloadICS(ics, 'mysug_alerts_all.ics');
  });

  // Initial render
  renderAlerts();
});
