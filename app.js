// دالة التنقل بين الصفحات
document.querySelectorAll(".navBtn").forEach(btn => {
  btn.onclick = () => {
    const target = btn.dataset.tab;

    // إخفاء كل الصفحات وإزالة الحالة النشطة من الأزرار
    document.querySelectorAll(".tabPage").forEach(p => p.classList.remove("active"));
    document.querySelectorAll(".navBtn").forEach(b => b.classList.remove("active"));

    // إظهار الصفحة المطلوبة وتفعيل الزر
    document.getElementById(target).classList.add("active");
    btn.classList.add("active");
  };
});

// تحميل البيانات (عينة مبسطة)
async function init() {
  const resp = await fetch('data.json');
  const data = await resp.json();
  // ... كود بناء القوائم ...
}
init();
