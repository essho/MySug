document.addEventListener('DOMContentLoaded', async () => {
    const combinedChartCtx = document.getElementById('combinedChart').getContext('2d');

    const allData = await loadAllData();
    console.log("All data loaded:", allData);

    const sugarEntries = [];
    const insulinEntries = [];

    if (allData && allData.length > 0) {
        // فرز البيانات حسب التاريخ
        const sortedData = allData.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        sortedData.forEach(record => {
            record.data.forEach((entry, index) => {
                if (entry.sugarLevel != null && entry.sugarLevel > 0) {
                    sugarEntries.push({
                        x: new Date(record.date).getTime() + (index * 1000),
                        y: entry.sugarLevel,
                        notes: entry.notes
                    });
                }
                if (entry.insulinUnits != null && entry.insulinUnits > 0) {
                    insulinEntries.push({
                        x: new Date(record.date).getTime() + (index * 1000),
                        y: entry.insulinUnits,
                        notes: entry.notes
                    });
                }
            });
        });
    }

    const combinedChart = new Chart(combinedChartCtx, {
        type: 'line', // تم التغيير من 'scatter' إلى 'line'
        data: {
            datasets: [{
                label: 'قياسات السكر (mg/dL)',
                data: sugarEntries,
                backgroundColor: 'rgba(255, 99, 132, 0.8)',
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 2,
                fill: false,
                tension: 0, // لإنشاء خطوط مستقيمة "زجزاجية"
                pointRadius: 6,
                pointHoverRadius: 9
            }, {
                label: 'جرعات الأنسولين (وحدة)',
                data: insulinEntries,
                backgroundColor: 'rgba(54, 162, 235, 0.8)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 2,
                fill: false,
                tension: 0, // لإنشاء خطوط مستقيمة "زجزاجية"
                pointRadius: 6,
                pointHoverRadius: 9
            }]
        },
        options: {
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        displayFormats: {
                            day: 'yyyy-MM-dd' // تم توحيد التنسيق ليكون ميلادياً
                        }
                    },
                    title: {
                        display: true,
                        text: 'التاريخ'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'القيم'
                    },
                    beginAtZero: true
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        title: (tooltipItems) => {
                            const item = tooltipItems[0];
                            const date = new Date(item.raw.x);
                            return date.toLocaleDateString('ar-SA-u-ca-gregory', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
                        },
                        label: (tooltipItem) => {
                            const value = tooltipItem.raw.y;
                            const notes = tooltipItem.raw.notes || 'لا توجد ملاحظات';
                            if (tooltipItem.dataset.label.includes('السكر')) {
                                return `قياس السكر: ${value} mg/dL\nالملاحظات: ${notes}`;
                            } else {
                                return `جرعة الأنسولين: ${value} وحدة\nالملاحظات: ${notes}`;
                            }
                        }
                    }
                }
            }
        }
    });
});