let currentLang = 'ar';
let currentInput = "";
let calcHistory = [];

const roomData = {
    medical: [
        { id: 'or_gen', ar: 'غرفة عمليات عامة', en: 'General OR', ach: 20, factor: 300 },
        { id: 'or_ortho', ar: 'غرفة عمليات عظام', en: 'Orthopedic OR', ach: 25, factor: 280 },
        { id: 'icu', ar: 'عناية مركزة (ICU)', en: 'Intensive Care', ach: 6, factor: 400 },
        { id: 'pe', ar: 'عزل ضغط موجب', en: 'Positive Pressure', ach: 12, factor: 380 },
        { id: 'aii', ar: 'عزل ضغط سالب', en: 'Negative Pressure', ach: 12, factor: 380 },
        { id: 'er', ar: 'طوارئ واستقبال', en: 'Emergency Room', ach: 15, factor: 350 },
        { id: 'patient', ar: 'غرفة تنويم مرضى', en: 'Patient Room', ach: 4, factor: 500 }
    ],
    commercial: [
        { id: 'off', ar: 'مكاتب مفتوحة', en: 'Open Offices', ach: 8, factor: 450 },
        { id: 'mall', ar: 'مركز تجاري', en: 'Shopping Mall', ach: 10, factor: 400 },
        { id: 'rest', ar: 'مطعم', en: 'Restaurant', ach: 20, factor: 300 },
        { id: 'gym', ar: 'نادي رياضي', en: 'Gym', ach: 15, factor: 350 }
    ],
    residential: [
        { id: 'liv', ar: 'صالة / مجلس', en: 'Living Room', ach: 6, factor: 450 },
        { id: 'bed', ar: 'غرفة نوم', en: 'Bedroom', ach: 4, factor: 550 },
        { id: 'kit', ar: 'مطبخ', en: 'Kitchen', ach: 8, factor: 400 }
    ]
};

window.onload = () => updateUI();

function resetForNewRoom() {
    clearDisplay();
    document.getElementById('people-count').value = 0;
    document.getElementById('equip-watts').value = 0;
    document.getElementById('unit-label').innerText = "0 CFM | 0 TR";
}

function press(n) { 
    if (currentInput.length > 9) return;
    currentInput += n; 
    document.getElementById('display').innerText = currentInput; 
}

function clearDisplay() { 
    currentInput = ""; 
    document.getElementById('display').innerText = "0"; 
}

function deleteLast() { 
    currentInput = currentInput.slice(0, -1); 
    document.getElementById('display').innerText = currentInput || "0"; 
}

function calculateLoad(save = false) {
    const vol = parseFloat(currentInput);
    const people = parseInt(document.getElementById('people-count').value) || 0;
    const watts = parseFloat(document.getElementById('equip-watts').value) || 0;
    
    if (!vol) return;
    
    const roomId = document.getElementById('room-select').value;
    const all = [...roomData.medical, ...roomData.commercial, ...roomData.residential];
    const spec = all.find(r => r.id === roomId);
    
    // معادلة هندسية شاملة
    let cfm_vent = (vol * 35.3147 * spec.ach) / 60;
    const people_btu = people * 450;
    const equip_btu = watts * 3.41;
    const base_btu = (cfm_vent * spec.factor / 1.15); 
    
    const total_btu = base_btu + people_btu + equip_btu;
    const tr = (total_btu / 12000).toFixed(2);
    const total_cfm = Math.round(cfm_vent + (people * 15)); 

    document.getElementById('unit-label').innerText = `${total_cfm} CFM | ${tr} TR`;

    if (save) {
        calcHistory.push({ id: Date.now(), room: currentLang==='ar'?spec.ar:spec.en, tr: tr, cfm: total_cfm });
        updateHistoryUI();
    }
}

function updateHistoryUI() {
    const tbody = document.getElementById('history-body');
    tbody.innerHTML = calcHistory.map(item => `
        <tr>
            <td>${item.room}</td>
            <td style="color:var(--ios-orange); font-weight:bold;">${item.tr}</td>
            <td>${item.cfm}</td>
            <td><button style="background:none; border:none; color:#ff3b30;" onclick="deleteEntry(${item.id})">✕</button></td>
        </tr>
    `).reverse().join('');
}

function deleteEntry(id) {
    calcHistory = calcHistory.filter(i => i.id !== id);
    updateHistoryUI();
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
    document.getElementById('html-tag').dir = currentLang === 'ar' ? 'rtl' : 'ltr';
    updateUI();
}

function updateUI() {
    const select = document.getElementById('room-select');
    const t = currentLang === 'ar' ? {m:"🏥 طبي", c:"🏢 تجاري", r:"🏠 سكني"} : {m:"Med", c:"Comm", r:"Res"};
    
    select.innerHTML = `
        <optgroup label="${t.m}">${roomData.medical.map(r=>`<option value="${r.id}">${currentLang=='ar'?r.ar:r.en}</option>`).join('')}</optgroup>
        <optgroup label="${t.c}">${roomData.commercial.map(r=>`<option value="${r.id}">${currentLang=='ar'?r.ar:r.en}</option>`).join('')}</optgroup>
        <optgroup label="${t.r}">${roomData.residential.map(r=>`<option value="${r.id}">${currentLang=='ar'?r.ar:r.en}</option>`).join('')}</optgroup>
    `;
    document.getElementById('txt-lang-btn').innerText = currentLang === 'ar' ? "English" : "العربية";
}

function runDuctCalc() {
    const q = document.getElementById('targetCFM').value;
    const w = document.getElementById('fixWidth').value;
    if(!q || !w) return;
    const h = Math.ceil(((q / 1000) * 144) / w); 
    document.getElementById('duct-result').innerText = `${w}" x ${h}"`;
}

function exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("HVAC Load Report", 20, 20);
    calcHistory.forEach((item, i) => doc.text(`${i+1}. ${item.room}: ${item.tr} TR / ${item.cfm} CFM`, 20, 30 + (i*10)));
    doc.save("Project_Report.pdf");
}

function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(calcHistory);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, "Project_Report.xlsx");
}
