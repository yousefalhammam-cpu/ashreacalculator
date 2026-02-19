/* --- 1. المرجع (Reference Page) Logic --- */
function renderReferencePage() {
    const container = document.getElementById('roomsList'); // The ID from your HTML Rooms tab
    container.innerHTML = "";

    FLAT_ITEMS.forEach(item => {
        const card = document.createElement('div');
        card.className = "item";
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong>${I18N.current === 'ar' ? item.label_ar : item.label_en}</strong>
                <span class="pill">ACH: ${item.ach}</span>
            </div>
            <div class="itemSub">${item.label_en} | Pressure: ${getPN(item)}</div>
        `;
        container.appendChild(card);
    });
}

/* --- 2. تصدير (Export Page) Logic --- */
// This function creates a visual preview of what will be in the PDF
function updateExportPreview() {
    const previewContainer = document.getElementById('exportHint'); 
    if (RESULTS.length === 0) {
        previewContainer.innerHTML = I18N.current === 'ar' ? "لا توجد بيانات للتصدير" : "No data to export";
        return;
    }

    let html = `<table style="width:100%; border-collapse: collapse; font-size:12px; margin-top:10px;">
        <tr style="border-bottom:1px solid var(--line)">
            <th>Room</th><th>Supply</th><th>Exh</th><th>TR</th>
        </tr>`;
    
    RESULTS.forEach(r => {
        html += `<tr>
            <td>${r.roomName}</td>
            <td>${Math.round(r.supply)}</td>
            <td>${Math.round(r.exhaust)}</td>
            <td>${r.tr.toFixed(2)}</td>
        </tr>`;
    });
    html += `</table>`;
    previewContainer.innerHTML = html;
}

/* --- 3. إعدادات (Settings) Language Logic --- */
function changeLanguage(lang) {
    I18N.current = lang;
    applyLanguage(lang); // Your existing translation function
    renderReferencePage(); // Refresh the list in the new language
    renderResults();       // Refresh calculator results
}
