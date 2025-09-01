// analytics.js

// دالة مساعدة للحصول على لون عشوائي
const getRandomColor = () => {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await openDatabase();
    } catch (e) {
        console.error("Failed to open database:", e);
        return;
    }
    const getAllData = async () => {
        const transaction = db.transaction([DAILY_STORE_NAME], 'readonly');
        const store = transaction.objectStore(DAILY_STORE_NAME);
        const request = store.getAll();
        return new Promise((resolve, reject) => {
            request.onsuccess = (event) => {
                resolve(event.target.result);
            };
            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    };
    const allData = await getAllData();
    const processed = processData(allData);
    if (processed && processed.weeklyData && processed.weeklyData.some(d => parseFloat(d) > 0)) {
        createSugarChart(processed);
        createDailyAverageChart(processed);
    } else {
        console.log("No sufficient data available to draw charts.");
        const container = document.querySelector('.container');
        const message = document.createElement('p');
        message.style.textAlign = 'center';
        message.textContent = 'لا توجد بيانات كافية لعرض الرسوم البيانية.';
        container.appendChild(message);
    }
    function processData(allRecords) {
        const today = new Date();
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(today.getDate() - 7);
        const sugarData = {};
        const dailyAverages = {};
        const dates = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(today.getDate() - i);
            const dateString = date.toISOString().slice(0, 10);
            dates.push(dateString);
            dailyAverages[dateString] = [];
            sugarData[dateString] = [];
        }
        allRecords.forEach(record => {
            const recordDate = record.date;
            if (recordDate >= dates[0] && recordDate <= dates[dates.length - 1]) {
                for (const hour in record.data) {
                    if (record.data[hour].sugar) {
                        const sugarLevel = parseFloat(record.data[hour].sugar);
                        if (!isNaN(sugarLevel)) {
                            dailyAverages[recordDate].push(sugarLevel);
                            sugarData[recordDate].push({ x: recordDate + 'T' + String(hour).padStart(2, '0') + ':00:00', y: sugarLevel });
                        }
                    }
                }
            }
        });
        const weeklyLabels = dates.map(dateStr => {
            const d = new Date(dateStr);
            return d.toLocaleDateString('ar-EG', { weekday: 'short', month: 'numeric', day: 'numeric' });
        });
        const weeklyData = dates.map(dateStr => {
            const total = dailyAverages[dateStr].reduce((sum, val) => sum + val, 0);
            return dailyAverages[dateStr].length > 0 ? (total / dailyAverages[dateStr].length).toFixed(1) : 0;
        });
        return { sugarData, weeklyLabels, weeklyData };
    }
    function createSugarChart(data) {
        const ctx = document.getElementById('sugarLevelChart').getContext('2d');
        const datasets = Object.keys(data.sugarData).map(date => {
            return {
                label: new Date(date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' }),
                data: data.sugarData[date],
                borderColor: getRandomColor(),
                tension: 0.1,
                fill: false
            };
        });
        if (datasets.some(d => d.data.length > 0)) {
            new Chart(ctx, {
                type: 'line',
                data: { datasets },
                options: {
                    responsive: true,
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                unit: 'day'
                            },
                            title: {
                                display: true,
                                text: 'التاريخ'
                            }
                        },
                        y: {
                            title: {
                                display: true,
                                text: 'مستوى السكر (ملجم/ديسيلتر)'
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'top',
                        }
                    }
                }
            });
        }
    }
    function createDailyAverageChart(data) {
        const ctx = document.getElementById('dailyAverageChart').getContext('2d');
        const datasets = [{
            label: 'متوسط السكر',
            data: data.weeklyData,
            backgroundColor: 'rgba(54, 162, 235, 0.5)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1
        }];
        if (datasets[0].data.some(d => parseFloat(d) > 0)) {
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: data.weeklyLabels,
                    datasets
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'متوسط السكر (ملجم/ديسيلتر)'
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
        }
    }
});