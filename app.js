let currentLang = 'ar';
let currentInput = "";
let calcHistory = []; // السجل التراكمي

const roomData = {
    medical: [{ id: 'or', ar: 'عمليات', en: 'OR', ach: 20, factor: 350 }, { id: 'icu', ar: 'عناية', en: 'ICU', ach: 6, factor: 400 }],
    commercial: [{ id: 'off', ar: 'مكتب', en: 'Office', ach: 6, factor: 450 }, { id: 'rest', ar: 'مطعم', en: 'Restaurant', ach: 15, factor: 300 }],
    residential: [{ id: 'bed', ar: 'نوم', en: 'Bedroom', ach: 4, factor: 500 }, { id: 'liv', ar: 'صالة', en: 'Living', ach: 4, factor: 450 }]
};

function press(n) { currentInput += n; document.getElementById('display').innerText = currentInput; }
function clearDisplay() { currentInput = ""; document.getElementById('display').innerText = "0"; }
function deleteLast() { currentInput = currentInput.slice(0, -1); document.getElementById('display').innerText = currentInput || "0"; }

function calculateLoad() {
    const vol = parseFloat(currentInput);
    if (!vol) return;
    
    const roomId = document.getElementById('room-select').value;
    const all = [...roomData.medical, ...roomData.commercial, ...roomData.residential];
    const spec = all.find(r => r.id === roomId);
    
    const cfm = Math.round((vol * 35.3147 * spec.ach) / 60);
    const tr = (cfm / spec.factor).toFixed(2);
    
    // تسجيل النتيجة في المصفوفة
    const newEntry = {
        room: currentLang === 'ar' ? spec.ar : spec.en,
        tr: tr,
        cfm: cfm
    };
    calcHistory.push(newEntry);
    
    // تحديث الشاشة والجدول
    document.getElementById('unit-label').innerText = `${cfm} CFM | ${tr} TR`;
    updateHistoryUI();
}

function updateHistoryUI() {
    const tbody = document.getElementById('history-body');
    if (!tbody) return;
    
    tbody.innerHTML = calcHistory.map(item => `
        <tr>
            <td>${item.room}</td>
            <td style="color:var(--accent)">${item.tr}</td>
            <td>${item.cfm}</td>
        </tr>
    `).reverse().join(''); // جعل الأحدث بالأعلى
}

function clearHistory() { calcHistory = []; updateHistoryUI(); }

function switchTab(tabId, btn) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    btn.classList.add('active');
}

function toggleLanguage() {
    currentLang = currentLang === 'ar' ? 'en' : 'ar';
    updateUI();
}

function updateUI() {
    const select = document.getElementById('room-select');
    select.innerHTML = `
        <optgroup label="طبي">${roomData.medical.map(r=>`<option value="${r.id}">${currentLang=='ar'?r.ar:r.en}</option>`).join('')}</optgroup>
        <optgroup label="تجاري">${roomData.commercial.map(r=>`<option value="${r.id}">${currentLang=='ar'?r.ar:r.en}</option>`).join('')}</optgroup>
        <optgroup label="سكني">${roomData.residential.map(r=>`<option value="${r.id}">${currentLang=='ar'?r.ar:r.en}</option>`).join('')}</optgroup>
    `;
}

function exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("HVAC Project Report", 20, 20);
    calcHistory.forEach((item, i) => {
        doc.text(`${i+1}. Room: ${item.room} | TR: ${item.tr} | CFM: ${item.cfm}`, 20, 30 + (i*10));
    });
    doc.save("Report.pdf");
}

window.onload = updateUI;
