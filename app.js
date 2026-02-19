let REF_DATA = null;
let FLAT_ITEMS = [];
let RESULTS = [];
let currentLang = 'ar';

const $ = (id) => document.getElementById(id);

// --- المحرك الحسابي ---
function ach_to_cfm(ach, vol_m3){
    return (ach * (vol_m3 * 35.3147)) / 60;
}

// --- تحميل البيانات ---
async function init(){
    const resp = await fetch('data.json?v=' + Date.now());
    REF_DATA = await resp.json();
    FLAT_ITEMS = [];
    REF_DATA.categories.forEach(cat => {
        cat.items.forEach(it => FLAT_ITEMS.push({ ...it, catName: cat.name }));
    });
    
    setupNavigation();
    buildRoomSelect();
    renderReferencePage();
}

// --- التنقل بين الصفحات ---
function setupNavigation(){
    document.querySelectorAll(".navBtn").forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll(".tabPage").forEach(p => p.classList.remove("active"));
            document.querySelectorAll(".navBtn").forEach(b => b.classList.remove("active"));
            
            const target = btn.dataset.tab;
            $(target).classList.add("active");
            btn.classList.add("active");

            if(target === 'tab-rooms') renderReferencePage();
            if(target === 'tab-export') renderExportPreview();
        };
    });
}

// --- صفحة المرجع ---
function renderReferencePage(){
    const list = $("roomsList");
    const q = $("roomSearch").value.toLowerCase();
    list.innerHTML = "";
    
    FLAT_ITEMS.filter(it => 
        it.label_ar.includes(q) || it.label_en.toLowerCase().includes(q)
    ).forEach(it => {
        const item = document.createElement("div");
        item.className = "item";
        item.innerHTML = `
            <div style="display:flex; justify-content:space-between">
                <strong>${currentLang === 'ar' ? it.label_ar : it.label_en}</strong>
                <span class="pill">ACH: ${it.ach}</span>
            </div>
            <div class="muted" style="font-size:11px">${it.catName} | Pressure: ${it.pressureOffset > 0 ? 'P' : 'N'}</div>
        `;
        list.appendChild(item);
    });
}

// --- صفحة التصدير ---
function renderExportPreview(){
    const box = $("exportPreview");
    if(RESULTS.length === 0){
        box.innerHTML = "<center>لا توجد بيانات حالياً</center>";
        return;
    }
    let html = `<table style="width:100%; text-align:right; font-size:12px">
                <tr style="border-bottom:1px solid var(--line)">
                    <th>الغرفة</th><th>Supply</th><th>TR</th>
                </tr>`;
    RESULTS.forEach(r => {
        html += `<tr><td>${r.roomName}</td><td>${Math.round(r.supply)}</td><td>${r.tr.toFixed(2)}</td></tr>`;
    });
    html += `</table>`;
    box.innerHTML = html;
}

// --- وظائف الأزرار ---
$("btnAdd").onclick = () => {
    const it = FLAT_ITEMS.find(x => x.id === $("roomType").value);
    const vol = parseFloat($("roomVol").value);
    if(!vol) return;

    const supply = ach_to_cfm(it.ach, vol);
    const tr = supply / parseFloat($("thumb").value);

    RESULTS.unshift({
        roomName: currentLang === 'ar' ? it.label_ar : it.label_en,
        supply, tr, vol, ach: it.ach
    });
    
    renderResultsList();
    $("roomVol").value = "";
};

function renderResultsList(){
    const box = $("resultsList");
    box.innerHTML = RESULTS.map((r, i) => `
        <div class="item">
            <div style="display:flex; justify-content:space-between">
                <b>${r.roomName}</b>
                <button onclick="deleteRoom(${i})" style="color:red; background:none; border:none">X</button>
            </div>
            <div class="grid3" style="font-size:12px; margin-top:5px">
                <span>Supply: ${Math.round(r.supply)}</span>
                <span>TR: ${r.tr.toFixed(2)}</span>
            </div>
        </div>
    `).join("");
}

window.deleteRoom = (i) => { RESULTS.splice(i, 1); renderResultsList(); };

$("btnExportPDF").onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("Air Calc Pro Report", 10, 10);
    doc.autoTable({
        head: [['Room', 'ACH', 'Supply CFM', 'Tons (TR)']],
        body: RESULTS.map(r => [r.roomName, r.ach, Math.round(r.supply), r.tr.toFixed(2)])
    });
    doc.save("Report.pdf");
};

$("langSel").onchange = (e) => {
    currentLang = e.target.value;
    document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
    // هنا يمكن إضافة ترجمة بقية النصوص الثابتة
};

init();
