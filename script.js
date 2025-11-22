/**
 * 呼吸照護平台前端邏輯
 * 包含資料儲存 (localStorage)、異常判斷、圖表繪製與頁面互動
 */

// === 1. 常數與設定 ===
const STORAGE_KEY_VITALS = 'respiratory_patient_vitals';
const STORAGE_KEY_PHOTOS = 'respiratory_patient_photos';

// 異常閾值定義
const THRESHOLDS = {
    SpO2: { dangerLower: 92, warningLower: 95 }, // <92 危險, <95 注意
    RR: { dangerUpper: 24, warningUpper: 20, warningLower: 12 }, // >24 危險, >20 或 <12 注意
    EtCO2: { dangerUpper: 45, warningUpper: 40 }, // >45 危險, >40 注意
    BP_sys: { dangerUpper: 160, dangerLower: 90, warningUpper: 140 }, // >160 或 <90 危險, >140 注意
    HR: { dangerUpper: 120, dangerLower: 50, warningUpper: 100, warningLower: 60 }, // 簡化範例 thresholds
    Pulse: { dangerUpper: 120, dangerLower: 50, warningUpper: 100, warningLower: 60 }
};

// 顏色常數 (需與 CSS 一致)
const COLORS = {
    normal: 'normal', // 對應 CSS class .status-normal
    warning: 'warning', // 對應 CSS class .status-warning
    danger: 'danger',   // 對應 CSS class .status-danger
    chartBlue: 'rgb(0, 102, 204)',
    chartRed: 'rgb(220, 53, 69)',
    chartGreen: 'rgb(40, 167, 69)'
};


// === 2. 資料模型與輔助函式 ===

/**
 * 判斷數據顏色狀態與是否異常
 * @param {string} type 數據類型 (如 'SpO2', 'HR')
 * @param {number} value 數值
 * @returns {string} 顏色狀態字串 (normal, warning, danger)
 */
function determineColorZone(type, value) {
    if (value === null || value === undefined || isNaN(value)) return COLORS.normal;
    const t = THRESHOLDS[type];
    if (!t) return COLORS.normal;

    // Danger 判斷 (優先)
    if ((t.dangerUpper && value > t.dangerUpper) || (t.dangerLower && value < t.dangerLower)) {
        return COLORS.danger;
    }
    // Warning 判斷
    if ((t.warningUpper && value > t.warningUpper) || (t.warningLower && value < t.warningLower)) {
        return COLORS.warning;
    }
    return COLORS.normal;
}

/**
 * 從 LocalStorage 讀取數據
 */
function loadVitalsData() {
    const dataStr = localStorage.getItem(STORAGE_KEY_VITALS);
    if (!dataStr) return [];
    // Parse 後將 timestamp 字串轉回 Date 物件以便排序和繪圖
    return JSON.parse(dataStr).map(item => ({
        ...item,
        timestamp: new Date(item.timestamp)
    }));
}

/**
 * 儲存數據到 LocalStorage
 * NOTE: 未來應改為呼叫後端 API
 * 例如: fetch('/api/vitals', { method: 'POST', body: JSON.stringify(newObservation) })
 */
function saveVitalsData(dataArray) {
    localStorage.setItem(STORAGE_KEY_VITALS, JSON.stringify(dataArray));
}

/**
 * 初始化假資料 (如果 LocalStorage 是空的)
 */
function initializeFakeData() {
    if (loadVitalsData().length > 0) return; // 已有資料就不初始化

    const fakeData = [];
    const now = new Date();
    // 產生過去 24 小時的資料，每 4 小時一筆
    for (let i = 6; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 4 * 60 * 60 * 1000);
        // 產生一些稍微波動的正常值，偶爾出現異常
        const baseHR = 75 + Math.random() * 10 - 5;
        const baseSpO2 = i === 2 ? 91 : (96 + Math.random() * 3); // 故意製造一筆低血氧
        const baseRR = 16 + Math.random() * 4 - 2;
        const baseSys = 120 + Math.random() * 20 - 10;
        const baseDia = 80 + Math.random() * 10 - 5;

        fakeData.push(
            { patientId: 'P001', type: 'HR', value: Math.round(baseHR), unit: 'bpm', timestamp: time, colorZone: determineColorZone('HR', Math.round(baseHR)) },
            { patientId: 'P001', type: 'SpO2', value: Math.round(baseSpO2), unit: '%', timestamp: time, colorZone: determineColorZone('SpO2', Math.round(baseSpO2)) },
            { patientId: 'P001', type: 'RR', value: Math.round(baseRR), unit: '次/分', timestamp: time, colorZone: determineColorZone('RR', Math.round(baseRR)) },
            { patientId: 'P001', type: 'BP_sys', value: Math.round(baseSys), unit: 'mmHg', timestamp: time, colorZone: COLORS.normal }, // BP 分開存
            { patientId: 'P001', type: 'BP_dia', value: Math.round(baseDia), unit: 'mmHg', timestamp: time, colorZone: COLORS.normal },
            { patientId: 'P001', type: 'Pulse', value: Math.round(baseHR), unit: 'bpm', timestamp: time, colorZone: determineColorZone('Pulse', Math.round(baseHR)) },
            { patientId: 'P001', type: 'EtCO2', value: Math.round(35 + Math.random()*5), unit: 'mmHg', timestamp: time, colorZone: COLORS.normal }
        );
    }
    saveVitalsData(fakeData);
    console.log('已初始化假資料');
}


// === 3. Dashboard 頁面邏輯 (index.html) ===
const DashboardApp = {
    data: [],
    charts: {}, // 儲存 Chart.js 實體

    init: function() {
        initializeFakeData();
        this.data = loadVitalsData();
        this.updateDashboard();
        this.setupEmergencyButton();
    },

    updateDashboard: function() {
        // 1. 更新卡片與警示
        this.updateCardsAndAlerts();
        // 2. 更新圖表
        this.renderCharts();
    },

    updateCardsAndAlerts: function() {
        const latestValues = {};
        const alerts = [];

        // 依時間排序，確保找到最新一筆
        const sortedData = [...this.data].sort((a, b) => b.timestamp - a.timestamp);

        // 找出每種類型的最新值
        ['SpO2', 'HR', 'RR', 'Pulse', 'EtCO2', 'BP_sys', 'BP_dia'].forEach(type => {
            const latest = sortedData.find(d => d.type === type);
            if (latest) latestValues[type] = latest;
        });

        // 更新單一數值卡片 (SpO2, HR, RR, Pulse, EtCO2)
        ['SpO2', 'HR', 'RR', 'Pulse', 'EtCO2'].forEach(type => {
            const card = document.getElementById(`card-${type}`);
            if (!card || !latestValues[type]) return;

            const data = latestValues[type];
            card.querySelector('.vital-value').textContent = data.value;
            card.querySelector('.vital-time').textContent = `更新於: ${data.timestamp.toLocaleString('zh-TW', { hour: '2-digit', minute:'2-digit' })}`;

            // 移除舊狀態 class，加入新狀態
            card.classList.remove('status-normal', 'status-warning', 'status-danger');
            card.classList.add(`status-${data.colorZone}`);

            // 收集警示 (只針對最新數據)
            if (data.colorZone === COLORS.danger) {
                let msg = `${type} 異常 (${data.value} ${data.unit})`;
                if (type === 'SpO2' && data.value < 92) msg = `SpO2 血氧過低 (<92%)`;
                if (type === 'RR' && data.value > 24) msg = `RR 呼吸率過快 (>24)`;
                if (type === 'EtCO2' && data.value > 45) msg = `EtCO2 過高 (>45)`;
                alerts.push(msg);
            }
        });

        // 更新血壓卡片 (特殊處理: 組合 sys 和 dia)
        const cardBP = document.getElementById('card-BP');
        const sys = latestValues['BP_sys'];
        const dia = latestValues['BP_dia'];
        if (cardBP && sys && dia) {
            cardBP.querySelector('.vital-value').textContent = `${sys.value}/${dia.value}`;
            // 使用最新的那個時間
            const latestTime = sys.timestamp > dia.timestamp ? sys.timestamp : dia.timestamp;
            cardBP.querySelector('.vital-time').textContent = `更新於: ${latestTime.toLocaleString('zh-TW', { hour: '2-digit', minute:'2-digit' })}`;

            // 判斷血壓顏色: 任一危險則危險
            const sysColor = determineColorZone('BP_sys', sys.value);
            const diaColor = determineColorZone('BP_sys', dia.value); // dia 也用類似邏輯判斷
            
            let finalColor = COLORS.normal;
            if(sysColor === COLORS.warning || diaColor === COLORS.warning) finalColor = COLORS.warning;
            if(sysColor === COLORS.danger || diaColor === COLORS.danger) finalColor = COLORS.danger;

             // BP 收縮壓 > 160 或 < 90 警示
            if (sys.value > 160 || sys.value < 90) {
                 finalColor = COLORS.danger;
                 alerts.push(`收縮壓血壓異常 (${sys.value} mmHg)`);
            }

            cardBP.classList.remove('status-normal', 'status-warning', 'status-danger');
            cardBP.classList.add(`status-${finalColor}`);
        }

        // 渲染警示區
        const alertsContainer = document.getElementById('alerts-section');
        alertsContainer.innerHTML = ''; // 清空
        alerts.forEach(msg => {
            const alertHtml = `
                <div class="alert-card">
                    <span class="alert-icon">⚠️</span>
                    <span class="alert-text">${msg}</span>
                </div>
            `;
            alertsContainer.insertAdjacentHTML('beforeend', alertHtml);
        });
    },

    renderCharts: function() {
        // 準備 Chart.js 需要的資料格式
        const prepareChartData = (type) => {
            const filtered = this.data
                .filter(d => d.type === type)
                .sort((a, b) => a.timestamp - b.timestamp); // 依時間排序
            return {
                labels: filtered.map(d => d.timestamp.toLocaleString('zh-TW', { month: 'numeric', day:'numeric', hour: '2-digit', minute:'2-digit' })),
                data: filtered.map(d => d.value)
            };
        };

        const createLineChart = (canvasId, label, chartData, color) => {
            const ctx = document.getElementById(canvasId).getContext('2d');
            // 如果圖表已存在，先銷毀以避免重疊
            if (this.charts[canvasId]) this.charts[canvasId].destroy();

            this.charts[canvasId] = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: chartData.labels,
                    datasets: [{
                        label: label,
                        data: chartData.data,
                        borderColor: color,
                        backgroundColor: color.replace('rgb', 'rgba').replace(')', ', 0.1)'), // 半透明背景
                        tension: 0.3, // 曲線平滑度
                        fill: true,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: false, grid: { color: '#f0f0f0' } },
                        x: { grid: { display: false }, ticks: { maxTicksLimit: 6 } } // X軸最多顯示6個標籤避免擁擠
                    },
                    plugins: { legend: { display: false } } // 隱藏圖例
                }
            });
        };

        // 繪製三個趨勢圖
        const spO2Data = prepareChartData('SpO2');
        createLineChart('chart-SpO2', 'SpO2 (%)', spO2Data, COLORS.chartBlue);

        const hrData = prepareChartData('HR');
        createLineChart('chart-HR', 'HR (bpm)', hrData, COLORS.chartRed);

        const rrData = prepareChartData('RR');
        createLineChart('chart-RR', 'RR (次/分)', rrData, COLORS.chartGreen);
    },

    setupEmergencyButton: function() {
        const emergencyBtn = document.getElementById('emergencyBtn');
        const modal = document.getElementById('emergencyModal');
        const confirmBtn = document.getElementById('confirmEmergencyBtn');
        const cancelBtn = document.getElementById('cancelEmergencyBtn');

        if (!emergencyBtn) return;

        emergencyBtn.addEventListener('click', () => modal.classList.add('show'));
        cancelBtn.addEventListener('click', () => modal.classList.remove('show'));

        confirmBtn.addEventListener('click', () => {
            modal.classList.remove('show');
            // 模擬通報醫院
            console.log('[後端模擬] 已收到病患 P001 緊急通報！');
            alert("已通報醫院！\n\n請保持冷靜，醫護人員將儘速與您聯繫。");
            // 在這裡可以建立一筆緊急事件紀錄存入 localStorage 或發送 API
        });

        // 點擊 Modal 外部關閉
        window.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('show');
        });
    }
};


// === 4. Upload 頁面邏輯 (upload.html) ===
const UploadApp = {
    init: function() {
        // 設定時間輸入框預設為現在時間 (需格式化為 YYYY-MM-DDTHH:mm)
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); // 調整時區
        document.getElementById('measurementTime').value = now.toISOString().slice(0, 16);

        this.setupFormSubmit();
        this.setupPhotoUpload();
        this.renderGallery();
    },

    setupFormSubmit: function() {
        const form = document.getElementById('vitalsForm');
        form.addEventListener('submit', (e) => {
            e.preventDefault();

            // 1. 獲取輸入值
            const timeStr = document.getElementById('measurementTime').value;
            const timestamp = timeStr ? new Date(timeStr) : new Date();
            
            // 定義欄位映射
            const inputs = [
                { id: 'input-BP_sys', type: 'BP_sys', unit: 'mmHg' },
                { id: 'input-BP_dia', type: 'BP_dia', unit: 'mmHg' },
                { id: 'input-SpO2', type: 'SpO2', unit: '%' },
                { id: 'input-HR', type: 'HR', unit: 'bpm' },
                { id: 'input-Pulse', type: 'Pulse', unit: 'bpm' },
                { id: 'input-RR', type: 'RR', unit: '次/分' },
                { id: 'input-EtCO2', type: 'EtCO2', unit: 'mmHg' }
            ];

            const newObservations = [];
            let hasData = false;

            inputs.forEach(input => {
                const valStr = document.getElementById(input.id).value;
                if (valStr !== '') {
                    const val = parseFloat(valStr);
                    newObservations.push({
                        patientId: 'P001',
                        type: input.type,
                        value: val,
                        unit: input.unit,
                        timestamp: timestamp, // 這裡存的是 Date 物件
                        colorZone: determineColorZone(input.type, val)
                    });
                    hasData = true;
                }
            });

            if (!hasData) {
                alert('請至少輸入一項數據');
                return;
            }

            // 2. 讀取舊資料，合併新資料，並儲存
            const currentData = loadVitalsData();
            const updatedData = [...currentData, ...newObservations];
            saveVitalsData(updatedData);

            alert('數據提交成功！將返回首頁更新。');
            window.location.href = 'index.html';
        });
    },

    setupPhotoUpload: function() {
        const photoInput = document.getElementById('photoInput');
        const previewContainer = document.getElementById('photoPreviewContainer');
        const previewImg = document.getElementById('photoPreview');
        const confirmBtn = document.getElementById('confirmUploadBtn');
        const noteInput = document.getElementById('photoNote');
        let currentFileBase64 = null;

        // 選擇檔案後顯示預覽
        photoInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;

            // 使用 FileReader 讀取檔案為 Base64
            const reader = new FileReader();
            reader.onloadend = function() {
                currentFileBase64 = reader.result;
                previewImg.src = currentFileBase64;
                previewContainer.style.display = 'block';
            }
            // NOTE: 這裡沒做圖片壓縮，大圖可能會超過 LocalStorage 限制 (約5MB)。
            // 實際專案應在前端壓縮或上傳到後端取得 URL。
            reader.readAsDataURL(file);
        });

        // 確認上傳
        confirmBtn.addEventListener('click', () => {
            if (!currentFileBase64) return;

            const note = noteInput.value;
            const newPhoto = {
                id: Date.now(), // 簡易 ID
                timestamp: new Date(),
                imageData: currentFileBase64, // 儲存 Base64 字串
                note: note
            };

            // 讀取舊照片紀錄並更新
            let photos = JSON.parse(localStorage.getItem(STORAGE_KEY_PHOTOS) || '[]');
            photos.unshift(newPhoto); // 加到最前面
            
            try {
                localStorage.setItem(STORAGE_KEY_PHOTOS, JSON.stringify(photos));
                alert('照片上傳成功！');
                // 重置表單
                photoInput.value = '';
                noteInput.value = '';
                previewContainer.style.display = 'none';
                currentFileBase64 = null;
                // 重新渲染列表
                this.renderGallery();
            } catch (e) {
                 alert('上傳失敗：儲存空間不足。 (LocalStorage 限制)');
                 console.error(e);
            }
        });
    },

    renderGallery: function() {
        const galleryGrid = document.getElementById('galleryGrid');
        const photos = JSON.parse(localStorage.getItem(STORAGE_KEY_PHOTOS) || '[]');

        if (photos.length === 0) {
            galleryGrid.innerHTML = '<p class="text-muted" style="grid-column: 1 / -1;">暫無照片紀錄</p>';
            return;
        }

        galleryGrid.innerHTML = '';
        photos.forEach(photo => {
            const dateStr = new Date(photo.timestamp).toLocaleString('zh-TW', {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'});
            const item = document.createElement('div');
            item.className = 'gallery-item';
            item.innerHTML = `
                <img src="${photo.imageData}" alt="photo" class="gallery-thumb">
            `;
            // 點擊放大功能
            item.addEventListener('click', () => {
                this.showImageModal(photo.imageData, `${dateStr} - ${photo.note || '無備註'}`);
            });
            galleryGrid.appendChild(item);
        });
    },

    showImageModal: function(src, caption) {
        const modal = document.getElementById('imageModal');
        const modalImg = document.getElementById('expandedImage');
        const captionText = document.getElementById('imageCaption');
        modal.classList.add('show');
        modalImg.src = src;
        captionText.textContent = caption;

        modal.querySelector('.close-modal').onclick = () => modal.classList.remove('show');
        modal.onclick = (e) => { if(e.target === modal) modal.classList.remove('show'); };
    }
};