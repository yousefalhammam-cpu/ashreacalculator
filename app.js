function setupNav() {
    document.querySelectorAll(".navBtn").forEach(btn => {
        btn.onclick = () => {
            // إخفاء كل الصفحات
            document.querySelectorAll(".tabPage").forEach(p => p.classList.remove("active"));
            // إزالة الحالة النشطة من كل الأزرار
            document.querySelectorAll(".navBtn").forEach(b => b.classList.remove("active"));
            
            // إظهار الصفحة المطلوبة وتنشيط الزر
            const targetId = btn.dataset.tab;
            $(targetId).classList.add("active");
            btn.classList.add("active");

            // تحديثات خاصة عند الانتقال لصفحات معينة
            if(targetId === 'tab-calc') updateChart();
            if(targetId === 'tab-rooms') renderReference();
            if(targetId === 'tab-export') updateExportPreview();
        }
    });
}

// دالة إضافية لتنظيف البيانات
function clearAllData() {
    if(confirm(currentLang === 'ar' ? "هل أنت متأكد من مسح جميع البيانات؟" : "Are you sure you want to clear all data?")) {
        RESULTS = [];
        localStorage.removeItem('hvac_v5');
        renderResults();
        updateChart();
        location.reload();
    }
}
