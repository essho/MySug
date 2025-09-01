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
        req.onsuccess = (e) => { db = e.target.result; resolve(db); };
        req.onerror = (e) => reject(e.target.error || 'idb error');
    });
}

function getPatientLS(){ try{return JSON.parse(localStorage.getItem(PATIENT_LS_KEY)||'null')}catch(e){return null} }
function setPatientLS(obj){ localStorage.setItem(PATIENT_LS_KEY, JSON.stringify(obj||{})); }

async function savePatientProfile(profile) {
    const record = { id:'patient', ...profile, updatedAt: new Date().toISOString() };
    setPatientLS(record); // primary
    try{
        const database = await openDatabase();
        await new Promise((resolve,reject)=>{
            const tx = database.transaction([PATIENT_STORE_NAME], 'readwrite');
            const st = tx.objectStore(PATIENT_STORE_NAME);
            const r = st.put(record);
            r.onsuccess = ()=>resolve();
            r.onerror = (e)=>reject(e.target.error);
        });
    }catch(e){ console.warn('IDB mirror failed:', e); }
    return record;
}

async function loadPatientProfile() {
    const ls = getPatientLS(); if (ls) return ls;
    try{
        const database = await openDatabase();
        return await new Promise((resolve,reject)=>{
            const tx = database.transaction([PATIENT_STORE_NAME], 'readonly');
            const st = tx.objectStore(PATIENT_STORE_NAME);
            const r = st.get('patient');
            r.onsuccess = e=>resolve(e.target.result||null);
            r.onerror = e=>reject(e.target.error);
        });
    }catch(e){ console.warn('IDB read failed:', e); return null; }
}

// Wire patient form
function wirePatientForm(){
    const form = document.getElementById('patientForm');
    if (!form) return;
    const nameEl = document.getElementById('name');
    const ageEl = document.getElementById('age');
    const weightEl = document.getElementById('weight');
    const insulinEl = document.getElementById('insulinType');
    // Prefill
    loadPatientProfile().then(data=>{
        if (!data) return;
        if (nameEl && data.name!=null) nameEl.value = data.name;
        if (ageEl && data.age!=null) ageEl.value = data.age;
        if (weightEl && data.weight!=null) weightEl.value = data.weight;
        if (insulinEl && data.insulinType!=null) insulinEl.value = data.insulinType;
    }).catch(console.error);
    form.addEventListener('submit', async (e)=>{
        e.preventDefault();
        const profile = {
            name: nameEl?.value?.trim()||'',
            age: Number(ageEl?.value)||null,
            weight: Number(weightEl?.value)||null,
            insulinType: insulinEl?.value||''
        };
        try { await savePatientProfile(profile); } catch(e){ console.error(e); }
        alert('تم حفظ بيانات المريض.');
    });
    // Auto-save on input
    const fields = [nameEl, ageEl, weightEl, insulinEl].filter(Boolean);
    let t=null;
    fields.forEach(el=>el.addEventListener('input', ()=>{
        clearTimeout(t);
        t=setTimeout(()=>{
            const p = { name: nameEl?.value?.trim()||'', age: Number(ageEl?.value)||null, weight: Number(weightEl?.value)||null, insulinType: insulinEl?.value||'' };
            savePatientProfile(p).catch(console.error);
        }, 500);
    }));
}
document.addEventListener('DOMContentLoaded', wirePatientForm);


function openDatabase() {
    if (db) {
        return Promise.resolve(db);
    }
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(DAILY_STORE_NAME)) {
                db.createObjectStore(DAILY_STORE_NAME, { keyPath: 'date' });
            }
            if (!db.objectStoreNames.contains(PATIENT_STORE_NAME)) {
                db.createObjectStore(PATIENT_STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = (event) => {
            db = event.target.result;
            console.log("Database opened successfully");
            resolve(db);
        };
        request.onerror = (event) => {
            console.error("Database error:", event.target.errorCode);
            reject(event.target.errorCode);
        };
    });
}

async function saveData(date, data) {
    const database = await openDatabase();
    const transaction = database.transaction([DAILY_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(DAILY_STORE_NAME);
    const request = store.put({ date: date, data: data });
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
async function exportAllData(){
    const database = await openDatabase();
    const dump = { meta:{ exportedAt:new Date().toISOString(), dbName:DB_NAME, version:DB_VERSION }, stores:{} };
    // daily
    dump.stores[DAILY_STORE_NAME] = await new Promise((resolve,reject)=>{
        const tx = database.transaction([DAILY_STORE_NAME],'readonly');
        const st = tx.objectStore(DAILY_STORE_NAME);
        const req = st.getAll(); req.onsuccess = e=>resolve(e.target.result||[]); req.onerror = e=>reject(e.target.error);
    });
    // patient (IDB)
    dump.stores[PATIENT_STORE_NAME] = await new Promise((resolve,reject)=>{
        const tx = database.transaction([PATIENT_STORE_NAME],'readonly');
        const st = tx.objectStore(PATIENT_STORE_NAME);
        const req = st.getAll(); req.onsuccess = e=>resolve(e.target.result||[]); req.onerror = e=>reject(e.target.error);
    });
    // alerts + patientLocal
    dump.alerts = getAlertsLS();
    dump.patientLocal = getPatientLS();
    const blob = new Blob([JSON.stringify(dump,null,2)], {type:'application/json;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'diabetes_backup.json';
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
async function importAllData(file){
    const text = await file.text();
    const parsed = JSON.parse(text);
    const database = await openDatabase();
    if (parsed?.stores?.[PATIENT_STORE_NAME]){
        const tx = database.transaction([PATIENT_STORE_NAME],'readwrite');
        const st = tx.objectStore(PATIENT_STORE_NAME);
        for (const rec of parsed.stores[PATIENT_STORE_NAME]){
            await new Promise((resolve,reject)=>{ const r = st.put(rec); r.onsuccess=()=>resolve(); r.onerror=e=>reject(e.target.error); });
        }
    }
    if (parsed?.stores?.[DAILY_STORE_NAME]){
        const tx = database.transaction([DAILY_STORE_NAME],'readwrite');
        const st = tx.objectStore(DAILY_STORE_NAME);
        for (const rec of parsed.stores[DAILY_STORE_NAME]){
            await new Promise((resolve,reject)=>{ const r = st.put(rec); r.onsuccess=()=>resolve(); r.onerror=e=>reject(e.target.error); });
        }
    }
    if (parsed?.alerts) setAlertsLS(parsed.alerts);
    if (parsed?.patientLocal) setPatientLS(parsed.patientLocal);
    alert('تمت الاستعادة.');
}
// Wire buttons if found
document.addEventListener('DOMContentLoaded', ()=>{
    const b=document.getElementById('backupBtn'); const f=document.getElementById('restoreFile');
    if (b) b.addEventListener('click', ()=>exportAllData());
    if (f) f.addEventListener('change', (e)=> e.target.files?.[0] && importAllData(e.target.files[0]));
});


// ===== Alerts global scheduler =====
function getAlertsLS(){ try{return JSON.parse(localStorage.getItem('alerts')||'[]')}catch(e){return []} }
function setAlertsLS(arr){ localStorage.setItem('alerts', JSON.stringify(arr||[])); }
async function requestNotifyPermission(){
    try{
        if (!('Notification' in window)) return false;
        if (Notification.permission==='granted') return true;
        const p = await Notification.requestPermission(); return p==='granted';
    }catch(e){return false;}
}
function notifyNow(title, body){
    try{
        if ('Notification' in window && Notification.permission==='granted'){
            new Notification(title||'تنبيه', { body: body||'', icon:'./icon-192.png' });
        } else {
            // Fallback: inline banner + beep
            let bar = document.getElementById('inlineAlertBar');
            if (!bar){ bar=document.createElement('div'); bar.id='inlineAlertBar'; bar.style.cssText='position:fixed;top:0;left:0;right:0;padding:10px;background:#ffecb3;border-bottom:1px solid #f0c36d;z-index:99999;text-align:center;font-weight:bold'; document.body.appendChild(bar); }
            bar.textContent=(title||'تنبيه')+(body?(' - '+body):'');
            try{ const ctx=new (window.AudioContext||window.webkitAudioContext)(); const o=ctx.createOscillator(); const g=ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type='sine'; o.frequency.value=880; o.start(); g.gain.setValueAtTime(0.2, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+1); o.stop(ctx.currentTime+1.05); }catch{}
            setTimeout(()=>{ if(bar&&bar.parentNode) bar.parentNode.removeChild(bar); }, 5000);
        }
    }catch(e){ console.error(e); }
}
let _alertTimer=null;
function startGlobalAlertScheduler(){
    clearInterval(_alertTimer);
    _alertTimer = setInterval(()=>{
        const alerts = getAlertsLS();
        const now = Date.now();
        let changed=false;
        alerts.forEach(a=>{
            if (!a || !a.enabled) return;
            // compute nextTime if missing
            if (a.nextTime==null){
                const [h,m]=(a.time||'00:00').split(':').map(Number);
                const dt = new Date(); dt.setHours(h||0, m||0, 0, 0);
                if (dt.getTime()<=now) dt.setDate(dt.getDate()+1);
                a.nextTime = dt.getTime(); changed=true;
            }
            if (a.nextTime && a.nextTime<=now){
                notifyNow(a.title||'تنبيه سكر', a.message||'حان وقت القياس/الجرعة');
                const dt = new Date(a.nextTime); dt.setDate(dt.getDate()+1);
                a.nextTime = dt.getTime(); changed=true;
            }
        });
        if (changed) setAlertsLS(alerts);
    }, 30000);
    requestNotifyPermission();
}
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) startGlobalAlertScheduler(); });
document.addEventListener('DOMContentLoaded', startGlobalAlertScheduler);
