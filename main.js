// الدوال الأساسية لإدارة البيانات
const DB_NAME = 'diabetesAppDB';
const DB_VERSION = 2;
const DAILY_STORE_NAME = 'dailyData';
const PATIENT_STORE_NAME = 'patientDataStore';
const ALERTS_STORE_NAME = 'alertsStore';
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
            if (!_db.objectStoreNames.contains(ALERTS_STORE_NAME)) _db.createObjectStore(ALERTS_STORE_NAME, { keyPath: 'id', autoIncrement: true });
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

async function loadAllData() {
    const database = await openDatabase();
    const transaction = database.transaction([DAILY_STORE_NAME], 'readonly');
    const store = transaction.objectStore(DAILY_STORE_NAME);
    const request = store.getAll();
    return new Promise((resolve, reject) => {
        request.onsuccess = (event) => {
            resolve(event.target.result);
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

// ===== Alerts & Push Notifications Logic (Hybrid System) =====

async function saveAlertLocally(alert) {
    await openDatabase();
    const transaction = db.transaction([ALERTS_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(ALERTS_STORE_NAME);
    const request = store.add(alert);
    return new Promise((resolve, reject) => {
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function loadAlertsLocally() {
    await openDatabase();
    const transaction = db.transaction([ALERTS_STORE_NAME], 'readonly');
    const store = transaction.objectStore(ALERTS_STORE_NAME);
    const request = store.getAll();
    return new Promise((resolve, reject) => {
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function syncAlertsWithServer() {
    const alerts = await loadAlertsLocally();
    if (alerts.length > 0) {
        // يمكنك إرسال جميع التنبيهات دفعة واحدة إلى الخادم
        try {
            const response = await fetch('YOUR_FIREBASE_CLOUD_FUNCTION_URL_TO_SYNC_ALERTS', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(alerts)
            });
            const result = await response.json();
            console.log('Alerts synced with server:', result);
        } catch (error) {
            console.error('Failed to sync alerts with server:', error);
        }
    }
}

async function requestNotificationPermissionAndSubscribe() {
    if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');
            if ('serviceWorker' in navigator && 'PushManager' in window) {
                try {
                    const registration = await navigator.serviceWorker.ready;
                    const subscription = await registration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: 'YOUR_FIREBASE_VAPID_KEY_HERE'
                    });
                    console.log('User subscribed to push:', subscription.toJSON());
                } catch (error) {
                    console.error('Failed to subscribe:', error);
                }
            }
        } else {
            console.log('Notification permission denied.');
        }
    }
}

function playSound(soundName) {
    const audio = document.getElementById('alertAudio');
    if (!audio) return;
    switch (soundName) {
        case 'sound1':
            audio.src = 'sound1.mp3';
            break;
        case 'sound2':
            audio.src = 'sound2.mp3';
            break;
        case 'default':
        default:
            audio.src = 'sound.mp3';
            break;
    }
    audio.play().catch(e => console.error("Error playing audio:", e));
}

// Global scheduler to run alerts locally
let _alertTimer = null;
function startGlobalAlertScheduler() {
    clearInterval(_alertTimer);
    _alertTimer = setInterval(async () => {
        const alerts = await loadAlertsLocally();
        const now = Date.now();
        alerts.forEach(a => {
            if (!a || !a.enabled) return;
            const [h, m] = (a.time || '00:00').split(':').map(Number);
            const dt = new Date();
            dt.setHours(h || 0, m || 0, 0, 0);

            if (dt.getTime() > now) return; // Not time yet

            // Check if this alert was already triggered today
            const lastTrigger = localStorage.getItem(`alert-last-trigger-${a.id}`);
            const today = new Date().toDateString();

            if (lastTrigger !== today) {
                new Notification(a.name || 'تنبيه سكر', {
                    body: `حان وقت ${a.name} الآن.`,
                    icon: './icons/icon-192x192.png'
                });
                playSound(a.sound);
                localStorage.setItem(`alert-last-trigger-${a.id}`, today);
            }
        });
    }, 30000); // Check every 30 seconds
}

document.addEventListener('DOMContentLoaded', () => {
    // This is for index.html functionality
    const patientForm = document.getElementById('patientForm');
    if (patientForm) {
        wirePatientForm();
    }
    const backupBtn = document.getElementById('backupBtn');
    const restoreFile = document.getElementById('restoreFile');
    if (backupBtn) backupBtn.addEventListener('click', () => exportAllData());
    if (restoreFile) restoreFile.addEventListener('change', (e) => e.target.files?.[0] && importAllData(e.target.files[0]));

    const alertsPage = document.getElementById('alertsList');
    if (alertsPage) {
        // This is for alerts.html functionality
        // Handled by alerts.js now
    }
    
    // Request notification permission and subscribe
    requestNotificationPermissionAndSubscribe();
    startGlobalAlertScheduler();
    window.addEventListener('online', syncAlertsWithServer);
    syncAlertsWithServer();
});