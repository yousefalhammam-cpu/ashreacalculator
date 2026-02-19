// 1. قاعدة بيانات ASHRAE الكاملة (تراكمي)
const roomSpecs = {
    standard: { ach: 6, loadFactor: 0.05, label: "سكني/مكاتب" },
    or: { ach: 20, loadFactor: 0.08, label: "غرفة عمليات" },
    icu: { ach: 6, loadFactor: 0.06, label: "عناية مركزة" },
    isolation: { ach: 12, loadFactor: 0.07, label: "غرفة عزل" },
    lab: { ach: 12, loadFactor: 0.07, label: "مختبر" }
};

let currentInput = "";

// 2. وظائف الحاسبة المعتادة
function press(num) {
    currentInput += num;
    document.getElementById('display').innerText = currentInput;
}

function clearDisplay() {
    currentInput = "";
    document.getElementById('display').innerText = "0";
    document.getElementById('display-label').innerText = "أدخل المساحة أو استخدم المسح";
    document.getElementById('system-recommendation').innerText = "بانتظار الحسابات...";
}

// 3. المسح الذكي بالكاميرا (محاكاة AR)
function runARScan() {
    const display = document.getElementById('display');
    const label = document.getElementById('display-label');
    display.innerText = "SCANNING...";
    setTimeout(() => {
        const areaResult = 25.5; // محاكاة نتيجة مسح الغرفة
        currentInput = areaResult.toString();
        display.innerText = areaResult;
        label.innerText = "✅ المساحة الممسوحة (م²)";
    }, 2000);
}

// 4. الحسابات الهندسية الشاملة ونظام التوصية
function calculateLoad() {
    const area = parseFloat(currentInput);
    if (!area) return alert("يرجى إدخال المساحة أولاً");

    const type = document.getElementById('room-select').value;
    const spec = roomSpecs[type];

    // حساب الحمل والـ CFM
    const tr = area * spec.loadFactor;
    const volumeCuFt = (area * 3) * 35.31; // ارتفاع 3م
    const cfm = (volumeCuFt * spec.ach) / 60;

    // عرض النتائج
    document.getElementById('display').innerText = tr.toFixed(2);
    document.getElementById('unit-label').innerText = `طناً تبريدياً | ${Math.round(cfm)} CFM`;

    // نظام التوصية التراكمي
    let advice = (type === 'or' || type === 'isolation') 
        ? "توصية: يجب استخدام وحدة AHU مع فلاتر HEPA عالية الكفاءة." 
        : (tr > 5 ? "توصية: يفضل استخدام نظام Package Unit لضمان التوزيع." : "توصية: نظام Ducted Split مناسب للمساحة.");
    
    document.getElementById('system-recommendation').innerText = advice;
    
    // ربط تلقائي مع حاسبة الدكت
    document.getElementById('targetCFM').value = Math.round(cfm);
}

// 5. حاسبة الدكت المضافة حديثاً
function runDuctCalc() {
    const q = document.getElementById('targetCFM').value;
    const w = document.getElementById('fixWidth').value;
    if (!q || !w) return;

    const areaIn = (q / 1000) * 144; // سرعة 1000 FPM
    const h = Math.ceil(areaIn / w);
    document.getElementById('duct-result').innerText = `المقاس النهائي: ${w} × ${h} بوصة`;
}

// 6. التنقل السلس بين التبويبات
function switchTab(tabId) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');
}

// 7. ساحة النقاش (ميزة المجتمع)
function postMsg() {
    const input = document.getElementById('chatInput');
    if (!input.value) return;
    const box = document.getElementById('forum-messages');
    box.innerHTML += `<div class="msg-bubble"><strong>أنت:</strong> ${input.value}</div>`;
    input.value = "";
    box.scrollTop = box.scrollHeight;
}
