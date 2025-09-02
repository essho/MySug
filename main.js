const DB_NAME = 'diabetesAppDB';
const DB_VERSION = 2;
const DAILY_STORE_NAME = 'dailyData';
const PATIENT_STORE_NAME = 'patientDataStore';

const PATIENT_LS_KEY = 'patientLocal';
let db;

function openDatabase() {
    if (db) return Promise.resolve(db);
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const _db = e.target.result;
            if (!_db.objectStoreNames.contains(DAILY_STORE_NAME)) _db.createObjectStore(DAILY_STORE_NAME, { keyPath: 'date' });
            if (!_db.objectStoreNames.contains(PATIENT_STORE_NAME)) _db.createObjectStore(PATIENT_STORE_NAME, { keyPath: 'id' });
        };
        req.onsuccess = (e) => {
            db = e.target.result;
            console.log("Database opened successfully");
            resolve(db);
        };
        req.onerror = (e) => {
            console.error("Database error:", e.target.errorCode);
            reject(e.target.error || 'idb error');
        };
    });
}

function getPatientLS() {
    try {
        return JSON.parse(localStorage.getItem(PATIENT_LS_KEY) || 'null')
    } catch (e) {
        return null
    }
}

function setPatientLS(obj) {
    localStorage.setItem(PATIENT_LS_KEY, JSON.stringify(obj || {}));
}

async function savePatientProfile(profile) {
    const record = {
        id: 'patient',
        ...profile,
        updatedAt: new Date().toISOString()
    };
    setPatientLS(record);
    try {
        const database = await openDatabase();
        await new Promise((resolve, reject) => {
            const tx = database.transaction([PATIENT_STORE_NAME], 'readwrite');
            const st = tx.objectStore(PATIENT_STORE_NAME);
            const r = st.put(record);
            r.onsuccess = () => resolve();
            r.onerror = (e) => reject(e.target.error);
        });
    } catch (e) {
        console.warn('IDB mirror failed:', e);
    }
    return record;
}

async function loadPatientProfile() {
    const ls = getPatientLS();
    if (ls) return ls;
    try {
        const database = await openDatabase();
        return await new Promise((resolve, reject) => {
            const tx = database.transaction([PATIENT_STORE_NAME], 'readonly');
            const st = tx.objectStore(PATIENT_STORE_NAME);
            const r = st.get('patient');
            r.onsuccess = e => resolve(e.target.result || null);
            r.onerror = e => reject(e.target.error);
        });
    } catch (e) {
        console.warn('IDB read failed:', e);
        return null;
    }
}

function wirePatientForm() {
    const form = document.getElementById('patientForm');
    if (!form) return;
    const nameEl = document.getElementById('name');
    const ageEl = document.getElementById('age');
    const weightEl = document.getElementById('weight');
    const insulinEl = document.getElementById('insulinType');
    loadPatientProfile().then(data => {
        if (!data) return;
        if (nameEl && data.name != null) nameEl.value = data.name;
        if (ageEl && data.age != null) ageEl.value = data.age;
        if (weightEl && data.weight != null) weightEl.value = data.weight;
        if (insulinEl && data.insulinType != null) insulinEl.value = data.insulinType;
    }).catch(console.error);
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const profile = {
            name: nameEl?.value?.trim() || '',
            age: Number(ageEl?.value) || null,
            weight: Number(weightEl?.value) || null,
            insulinType: insulinEl?.value || ''
        };
        try {
            await savePatientProfile(profile);
        } catch (e) {
            console.error(e);
        }
        alert('تم حفظ بيانات المريض.');
    });
    const fields = [nameEl, ageEl, weightEl, insulinEl].filter(Boolean);
    let t = null;
    fields.forEach(el => el.addEventListener('input', () => {
        clearTimeout(t);
        t = setTimeout(() => {
            const p = {
                name: nameEl?.value?.trim() || '',
                age: Number(ageEl?.value) || null,
                weight: Number(weightEl?.value) || null,
                insulinType: insulinEl?.value || ''
            };
            savePatientProfile(p).catch(console.error);
        }, 500);
    }));
}

async function saveData(date, data) {
    const database = await openDatabase();
    const transaction = database.transaction([DAILY_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(DAILY_STORE_NAME);
    const request = store.put({
        date: date,
        data: data
    });
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}

async function loadData(date) {
    const database = await openDatabase();
    const transaction = database.transaction([DAILY_STORE_NAME], 'readonly');
    const store = transaction.objectStore(DAILY_STORE_NAME);
    const request = store.get(date);
    return new Promise((resolve, reject) => {
        request.onsuccess = (event) => {
            const record = event.target.result;
            resolve(record ? record.data : null);
        };
        request.onerror = (event) => reject(event.target.error);
    });
}

// ===== Backup & Restore =====
async function exportAllData() {
    const database = await openDatabase();
    const dump = {
        meta: {
            exportedAt: new Date().toISOString(),
            dbName: DB_NAME,
            version: DB_VERSION
        },
        stores: {}
    };
    dump.stores[DAILY_STORE_NAME] = await new Promise((resolve, reject) => {
        const tx = database.transaction([DAILY_STORE_NAME], 'readonly');
        const st = tx.objectStore(DAILY_STORE_NAME);
        const req = st.getAll();
        req.onsuccess = e => resolve(e.target.result || []);
        req.onerror = e => reject(e.target.error);
    });
    dump.stores[PATIENT_STORE_NAME] = await new Promise((resolve, reject) => {
        const tx = database.transaction([PATIENT_STORE_NAME], 'readonly');
        const st = tx.objectStore(PATIENT_STORE_NAME);
        const req = st.getAll();
        req.onsuccess = e => resolve(e.target.result || []);
        req.onerror = e => reject(e.target.error);
    });
    dump.alerts = getAlertsLS();
    dump.patientLocal = getPatientLS();
    const blob = new Blob([JSON.stringify(dump, null, 2)], {
        type: 'application/json;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'diabetes_backup.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
async function importAllData(file) {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const database = await openDatabase();
    if (parsed?.stores?.[PATIENT_STORE_NAME]) {
        const tx = database.transaction([PATIENT_STORE_NAME], 'readwrite');
        const st = tx.objectStore(PATIENT_STORE_NAME);
        for (const rec of parsed.stores[PATIENT_STORE_NAME]) {
            await new Promise((resolve, reject) => {
                const r = st.put(rec);
                r.onsuccess = () => resolve();
                r.onerror = e => reject(e.target.error);
            });
        }
    }
    if (parsed?.stores?.[DAILY_STORE_NAME]) {
        const tx = database.transaction([DAILY_STORE_NAME], 'readwrite');
        const st = tx.objectStore(DAILY_STORE_NAME);
        for (const rec of parsed.stores[DAILY_STORE_NAME]) {
            await new Promise((resolve, reject) => {
                const r = st.put(rec);
                r.onsuccess = () => resolve();
                r.onerror = e => reject(e.target.error);
            });
        }
    }
    if (parsed?.alerts) setAlertsLS(parsed.alerts);
    if (parsed?.patientLocal) setPatientLS(parsed.patientLocal);
    alert('تمت الاستعادة.');
}
document.addEventListener('DOMContentLoaded', () => {
    const b = document.getElementById('backupBtn');
    const f = document.getElementById('restoreFile');
    if (b) b.addEventListener('click', () => exportAllData());
    if (f) f.addEventListener('change', (e) => e.target.files?.[0] && importAllData(e.target.files[0]));
});


// ===== Alerts global scheduler (DISABLED) =====
function getAlertsLS() {
    try {
        return JSON.parse(localStorage.getItem('alerts') || '[]')
    } catch (e) {
        return []
    }
}

function setAlertsLS(arr) {
    localStorage.setItem('alerts', JSON.stringify(arr || []));
}

function notifyNow(title, body) {
    try {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title || 'تنبيه', {
                body: body || '',
                icon: './icons/icon-192x192.png'
            });
        } else {
            // Fallback: inline banner + beep
        }
    } catch (e) {
        console.error(e);
    }
}

let _alertTimer = null;
function startGlobalAlertScheduler() {
    clearInterval(_alertTimer);
    _alertTimer = setInterval(() => {
        const alerts = getAlertsLS();
        const now = Date.now();
        let changed = false;
        alerts.forEach(a => {
            if (!a || !a.enabled) return;
            if (a.nextTime == null) {
                const [h, m] = (a.time || '00:00').split(':').map(Number);
                const dt = new Date();
                dt.setHours(h || 0, m || 0, 0, 0);
                if (dt.getTime() <= now) dt.setDate(dt.getDate() + 1);
                a.nextTime = dt.getTime();
                changed = true;
            }
            if (a.nextTime && a.nextTime <= now) {
                notifyNow(a.title || 'تنبيه سكر', a.message || 'حان وقت القياس/الجرعة');
                const dt = new Date(a.nextTime);
                dt.setDate(dt.getDate() + 1);
                a.nextTime = dt.getTime();
                changed = true;
            }
        });
        if (changed) setAlertsLS(alerts);
    }, 30000);
}

// **هنا يتم دمج الكود الذي كان في ملف index.html**
document.addEventListener('DOMContentLoaded', () => {
    wirePatientForm();

    // نتحقق من Service Worker ونشترك في الإشعارات
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', function() {
            navigator.serviceWorker.register('./service-worker.js', { scope: './' }).then(function(registration) {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);

                // **تم دمج كود الاشتراك هنا**
                const applicationServerKey = 'BFT2H-0xJ6409nSdj5Ck2erqEe0SyxrZ78mv-I2mYbgVFp0Y6H41982dg6eaxoWUesvQiVQSXqYJZK8-871_19s';
                if ('PushManager' in window) {
                    Notification.requestPermission().then(permission => {
                        if (permission === 'granted') {
                            console.log('Notification permission granted.');
                            registration.pushManager.subscribe({
                                userVisibleOnly: true,
                                applicationServerKey: applicationServerKey
                            }).then(function(subscription) {
                                console.log('User is subscribed to Push:', subscription);
                                // هنا يجب إرسال الـ subscription إلى خادمك
                            }).catch(function(error) {
                                console.error('Failed to subscribe to the push service.', error);
                            });
                        } else {
                            console.log('Notification permission denied.');
                        }
                    });
                }

            }, function(err) {
                console.log('ServiceWorker registration failed: ', err);
            });
        });
    }
});