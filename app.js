// تبديل التبويبات
function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');
}

// محاكي مسح الكاميرا
function runARScan() {
    const msg = document.getElementById('scanMsg');
    msg.innerHTML = "🔍 جاري التعرف على السطح...";
    setTimeout(() => {
        document.getElementById('L').value = 5.2;
        document.getElementById('W').value = 4.5;
        document.getElementById('H').value = 3.0;
        msg.innerHTML = "✅ تم التقاط الأبعاد: 5.2 × 4.5 م";
    }, 2500);
}

// حسابات ASHRAE
function doHvacCalc() {
    const l = document.getElementById('L').value;
    const w = document.getElementById('W').value;
    const h = document.getElementById('H').value;
    const type = document.getElementById('usage').value;

    if(!l || !w || !h) return alert("أدخل الأبعاد أولاً");

    const area = l * w;
    const vol = area * h;
    const ach = (type === 'or') ? 20 : 6;
    const cfm = (vol * 35.31 * ach) / 60;
    const tr = area * ((type === 'or') ? 0.08 : 0.05);

    const res = document.getElementById('resDisplay');
    res.style.display = 'block';
    res.innerHTML = `
        <div style="background:#e3f2fd; padding:15px; border-radius:10px; text-align:center;">
            <strong>الحمل: ${tr.toFixed(2)} طن</strong><br>
            <strong>الهواء: ${Math.round(cfm)} CFM</strong>
        </div>
    `;
    // تمرير الـ CFM للدكت تلقائياً
    document.getElementById('cfm').value = Math.round(cfm);
}

// حساب الدكت
function doDuctCalc() {
    const q = document.getElementById('cfm').value;
    const w = document.getElementById('ductWidth').value;
    if(!q || !w) return;

    const areaIn = (q / 1000) * 144; // فرض سرعة 1000 FPM
    const h = Math.ceil(areaIn / w);
    
    const res = document.getElementById('ductRes');
    res.style.display = 'block';
    res.innerHTML = `المقاس المقترح: ${w} × ${h} بوصة`;
}

// ساحة النقاش
function postToForum() {
    const msg = document.getElementById('newMsg');
    if(!msg.value) return;
    const box = document.getElementById('chatArea');
    box.innerHTML += `<div class="chat-msg"><strong>أنت:</strong> ${msg.value}</div>`;
    msg.value = '';
    box.scrollTop = box.scrollHeight;
}
