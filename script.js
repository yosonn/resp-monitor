/**
 * 呼吸照護平台前端邏輯
 * 包含資料儲存 (localStorage)、異常判斷、圖表繪製與頁面互動 + 儀器資訊
 */

/* -------------------------
   1. LocalStorage Keys
------------------------- */
const STORAGE_KEY_VITALS = 'respiratory_patient_vitals';
const STORAGE_KEY_PHOTOS = 'respiratory_patient_photos';
const STORAGE_KEY_DEVICE = "respiratory_patient_device"; // ⭐ 新增：儀器資料用

/* -------------------------
   2. 異常閾值定義
------------------------- */
const THRESHOLDS = {
    SpO2: { dangerLower: 92, warningLower: 95 },
    RR: { dangerUpper: 24, warningUpper: 20, warningLower: 12 },
    EtCO2: { dangerUpper: 45, warningUpper: 40 },
    BP_sys: { dangerUpper: 160, dangerLower: 90, warningUpper: 140 },
    HR: { dangerUpper: 120, dangerLower: 50, warningUpper: 100, warningLower: 60 },
    Pulse: { dangerUpper: 120, dangerLower: 50, warningUpper: 100, warningLower: 60 }
};

const COLORS = {
    normal: 'normal',
    warning: 'warning',
    danger: 'danger',
    chartBlue: 'rgb(0, 102, 204)',
    chartRed: 'rgb(220, 53, 69)',
    chartGreen: 'rgb(40, 167, 69)'
};


/* -------------------------
   3. 呼吸數據 判斷 / 儲存
------------------------- */
function determineColorZone(type, value) {
    if (value === null || value === undefined || isNaN(value)) return COLORS.normal;
    const t = THRESHOLDS[type];
    if (!t) return COLORS.normal;

    if ((t.dangerUpper && value > t.dangerUpper) || (t.dangerLower && value < t.dangerLower)) {
        return COLORS.danger;
    }
    if ((t.warningUpper && value > t.warningUpper) || (t.warningLower && value < t.warningLower)) {
        return COLORS.warning;
    }
    return COLORS.normal;
}

function loadVitalsData() {
    const str = localStorage.getItem(STORAGE_KEY_VITALS);
    if (!str) return [];
    return JSON.parse(str).map(item => ({
        ...item,
        timestamp: new Date(item.timestamp)
    }));
}

function saveVitalsData(dataArray) {
    localStorage.setItem(STORAGE_KEY_VITALS, JSON.stringify(dataArray));
}

function initializeFakeData() {
    if (loadVitalsData().length > 0) return;

    const fakeData = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 4 * 60 * 60 * 1000);

        const baseHR = 75 + Math.random() * 10 - 5;
        const baseSpO2 = i === 2 ? 91 : (96 + Math.random() * 3);
        const baseRR = 16 + Math.random() * 4 - 2;
        const baseSys = 120 + Math.random() * 20 - 10;
        const baseDia = 80 + Math.random() * 10 - 5;

        fakeData.push(
            { patientId: 'P001', type: 'HR', value: Math.round(baseHR), unit: 'bpm', timestamp: time, colorZone: determineColorZone('HR', baseHR) },
            { patientId: 'P001', type: 'SpO2', value: Math.round(baseSpO2), unit: '%', timestamp: time, colorZone: determineColorZone('SpO2', baseSpO2) },
            { patientId: 'P001', type: 'RR', value: Math.round(baseRR), unit: '次/分', timestamp: time, colorZone: determineColorZone('RR', baseRR) },
            { patientId: 'P001', type: 'BP_sys', value: Math.round(baseSys), unit: 'mmHg', timestamp: time, colorZone: COLORS.normal },
            { patientId: 'P001', type: 'BP_dia', value: Math.round(baseDia), unit: 'mmHg', timestamp: time, colorZone: COLORS.normal },
            { patientId: 'P001', type: 'Pulse', value: Math.round(baseHR), unit: 'bpm', timestamp: time, colorZone: determineColorZone('Pulse', baseHR) },
            { patientId: 'P001', type: 'EtCO2', value: Math.round(35 + Math.random()*5), unit: 'mmHg', timestamp: time, colorZone: COLORS.normal }
        );
    }

    saveVitalsData(fakeData);
}


/* -------------------------
   4. ⭐ 儀器資料功能
------------------------- */

// 初始化假儀器資料（強制覆蓋）
function initializeDeviceData() {

    const fakeDevice = {
        name: "氧氣濃縮機（家用型）",
        id: "OX-8821-TW",
        borrowTime: "2025/01/10 14:20",
        usagePeriod: "2025/01/10 ～ 2025/03/10",
        notes: "每天至少使用 8 小時，睡覺時需全程佩戴。請保持管線乾淨，避免彎折。",
        status: "正常"
    };

    // ⭐ 強制覆蓋 localStorage（最重要）
    localStorage.setItem(STORAGE_KEY_DEVICE, JSON.stringify(fakeDevice));
}

// 讀取儀器資料
function loadDeviceData() {
    const str = localStorage.getItem(STORAGE_KEY_DEVICE);
    if (!str) return null;
    return JSON.parse(str);
}


/* -------------------------
   5. Dashboard 主邏輯
------------------------- */
const DashboardApp = {
    data: [],
    charts: {},

    init: function() {
        initializeFakeData();
        initializeDeviceData();  // ⭐ 初始化儀器資訊

        this.data = loadVitalsData();
        this.updateDashboard();
        this.renderDeviceInfo(); // ⭐ 顯示儀器資訊
        this.setupEmergencyButton();
    },

    /* --- 儀器資訊 --- */
    renderDeviceInfo: function () {
        const device = loadDeviceData();
        if (!device) return;

        document.getElementById("deviceName").textContent = device.name;
        document.getElementById("deviceId").textContent = device.id;
        document.getElementById("borrowTime").textContent = device.borrowTime;
        document.getElementById("usagePeriod").textContent = device.usagePeriod;
        document.getElementById("deviceNotes").textContent = device.notes;

        const statusEl = document.getElementById("deviceStatus");
        statusEl.textContent = device.status;

        if (device.status === "正常") {
            statusEl.classList.add("status-normal");
        } else {
            statusEl.classList.add("status-danger");
        }
    },

    /* --- 生命徵象卡片 / 異常提示 --- */
    updateDashboard: function() {
        this.updateCardsAndAlerts();
        this.renderCharts();
    },

    updateCardsAndAlerts: function() {
        const latest = {};
        const alerts = [];

        const sorted = [...this.data].sort((a, b) => b.timestamp - a.timestamp);

        ['SpO2', 'HR', 'RR', 'Pulse', 'EtCO2', 'BP_sys', 'BP_dia'].forEach(type => {
            latest[type] = sorted.find(d => d.type === type);
        });

        ['SpO2', 'HR', 'RR', 'Pulse', 'EtCO2'].forEach(type => {
            const card = document.getElementById(`card-${type}`);
            if (!card || !latest[type]) return;

            const d = latest[type];
            card.querySelector('.vital-value').textContent = d.value;
            card.querySelector('.vital-time').textContent =
                `更新於: ${d.timestamp.toLocaleString('zh-TW', { hour: '2-digit', minute:'2-digit' })}`;

            card.classList.remove('status-normal', 'status-warning', 'status-danger');
            card.classList.add(`status-${d.colorZone}`);

            if (d.colorZone === "danger") alerts.push(`${type} 異常 (${d.value})`);
        });

        const sys = latest['BP_sys'], dia = latest['BP_dia'];
        const cardBP = document.getElementById('card-BP');

        if (sys && dia) {
            cardBP.querySelector('.vital-value').textContent = `${sys.value}/${dia.value}`;
            const latestTime = sys.timestamp > dia.timestamp ? sys.timestamp : dia.timestamp;
            cardBP.querySelector('.vital-time').textContent =
                `更新於: ${latestTime.toLocaleString('zh-TW', { hour:'2-digit', minute:'2-digit' })}`;
        }

        const alertBox = document.getElementById("alerts-section");
        alertBox.innerHTML = "";
        alerts.forEach(msg => {
            alertBox.insertAdjacentHTML("beforeend", `
                <div class="alert-card">
                    <span class="alert-icon">⚠️</span>
                    <span class="alert-text">${msg}</span>
                </div>
            `);
        });
    },

    /* --- Charts --- */
    renderCharts: function() {
        const prepare = (type) => {
            const d = this.data.filter(x => x.type === type)
                .sort((a, b) => a.timestamp - b.timestamp);

            return {
                labels: d.map(x =>
                    x.timestamp.toLocaleString('zh-TW', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' })
                ),
                data: d.map(x => x.value)
            };
        };

        const create = (id, label, chartData, color) => {
            const ctx = document.getElementById(id).getContext("2d");
            if (this.charts[id]) this.charts[id].destroy();

            this.charts[id] = new Chart(ctx, {
                type: "line",
                data: {
                    labels: chartData.labels,
                    datasets: [{
                        label,
                        data: chartData.data,
                        borderColor: color,
                        backgroundColor: color.replace("rgb", "rgba").replace(")", ",0.1)"),
                        tension: 0.3,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } }
                }
            });
        };

        create("chart-SpO2", "SpO2", prepare("SpO2"), COLORS.chartBlue);
        create("chart-HR", "HR", prepare("HR"), COLORS.chartRed);
        create("chart-RR", "RR", prepare("RR"), COLORS.chartGreen);
    },

    /* --- Emergency Button --- */
    setupEmergencyButton: function() {
        const btn = document.getElementById("emergencyBtn");
        const modal = document.getElementById("emergencyModal");
        const cancel = document.getElementById("cancelEmergencyBtn");
        const confirm = document.getElementById("confirmEmergencyBtn");

        btn.addEventListener("click", () => modal.classList.add("show"));
        cancel.addEventListener("click", () => modal.classList.remove("show"));
        confirm.addEventListener("click", () => {
            modal.classList.remove("show");
            alert("已通報醫院，醫護人員將儘速聯繫您。");
        });

        window.addEventListener("click", (e) => {
            if (e.target === modal) modal.classList.remove("show");
        });
    }
};


/* -------------------------
   6. Upload Page（原本功能）
------------------------- */
const UploadApp = {
    init: function() {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        document.getElementById('measurementTime').value = now.toISOString().slice(0, 16);

        this.setupFormSubmit();
        this.setupPhotoUpload();
        this.renderGallery();
    },

    setupFormSubmit: function() {
        const form = document.getElementById("vitalsForm");
        form.addEventListener("submit", (e) => {
            e.preventDefault();

            const tStr = document.getElementById("measurementTime").value;
            const timestamp = tStr ? new Date(tStr) : new Date();

            const fields = [
                { id: 'input-BP_sys', type:'BP_sys', unit:'mmHg' },
                { id: 'input-BP_dia', type:'BP_dia', unit:'mmHg' },
                { id: 'input-SpO2', type:'SpO2', unit:'%' },
                { id: 'input-HR', type:'HR', unit:'bpm' },
                { id: 'input-Pulse', type:'Pulse', unit:'bpm' },
                { id: 'input-RR', type:'RR', unit:'次/分' },
                { id: 'input-EtCO2', type:'EtCO2', unit:'mmHg' }
            ];

            const newRecords = [];
            let has = false;

            fields.forEach(f => {
                const v = document.getElementById(f.id).value;
                if (v !== "") {
                    const val = parseFloat(v);
                    newRecords.push({
                        patientId: "P001",
                        type: f.type,
                        value: val,
                        unit: f.unit,
                        timestamp,
                        colorZone: determineColorZone(f.type, val)
                    });
                    has = true;
                }
            });

            if (!has) return alert("請至少輸入一項數據");

            const current = loadVitalsData();
            const updated = [...current, ...newRecords];
            saveVitalsData(updated);

            alert("數據提交成功！");
            window.location.href = "index.html";
        });
    },

    setupPhotoUpload: function() {
        const input = document.getElementById("photoInput");
        const previewContainer = document.getElementById("photoPreviewContainer");
        const previewImg = document.getElementById("photoPreview");
        const confirmBtn = document.getElementById("confirmUploadBtn");
        const noteInput = document.getElementById("photoNote");

        let currentBase64 = null;

        input.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onloadend = () => {
                currentBase64 = reader.result;
                previewImg.src = currentBase64;
                previewContainer.style.display = "block";
            };
            reader.readAsDataURL(file);
        });

        confirmBtn.addEventListener("click", () => {
            if (!currentBase64) return;

            const note = noteInput.value;
            const newPhoto = {
                id: Date.now(),
                timestamp: new Date(),
                imageData: currentBase64,
                note
            };

            let photos = JSON.parse(localStorage.getItem(STORAGE_KEY_PHOTOS) || "[]");
            photos.unshift(newPhoto);

            try {
                localStorage.setItem(STORAGE_KEY_PHOTOS, JSON.stringify(photos));
                alert("照片上傳成功！");

                input.value = "";
                noteInput.value = "";
                previewContainer.style.display = "none";
                currentBase64 = null;

                this.renderGallery();
            } catch (e) {
                alert("上傳失敗：LocalStorage 儲存空間不足。");
            }
        });
    },

    renderGallery: function() {
        const grid = document.getElementById("galleryGrid");
        const photos = JSON.parse(localStorage.getItem(STORAGE_KEY_PHOTOS) || "[]");

        if (photos.length === 0) {
            grid.innerHTML = `<p class="text-muted" style="grid-column:1/-1;">暫無照片紀錄</p>`;
            return;
        }

        grid.innerHTML = "";
        photos.forEach(photo => {
            const dateStr = new Date(photo.timestamp).toLocaleString('zh-TW', {
                month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'
            });

            const item = document.createElement("div");
            item.className = "gallery-item";
            item.innerHTML = `<img src="${photo.imageData}" class="gallery-thumb">`;

            item.addEventListener("click", () => {
                this.showImageModal(photo.imageData, `${dateStr} - ${photo.note || '無備註'}`);
            });

            grid.appendChild(item);
        });
    },

    showImageModal: function(src, caption) {
        const modal = document.getElementById("imageModal");
        const img = document.getElementById("expandedImage");
        const cap = document.getElementById("imageCaption");

        modal.classList.add("show");
        img.src = src;
        cap.textContent = caption;

        modal.querySelector(".close-modal").onclick = () => modal.classList.remove("show");
        modal.onclick = (e) => { if (e.target === modal) modal.classList.remove("show"); };
    }
};

