// ... (نفس المتغيرات والدوال السابقة لضغط الأزرار والحساب)

function openContact() {
    document.getElementById('contact-modal').style.display = 'block';
}

function closeContact() {
    document.getElementById('contact-modal').style.display = 'none';
}

// لإغلاق النافذة عند الضغط خارجها
window.onclick = function(event) {
    let modal = document.getElementById('contact-modal');
    if (event.target == modal) {
        modal.style.display = 'none';
    }
}

// ... (بقية دوال الحساب والتصدير)
