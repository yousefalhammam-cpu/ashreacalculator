function updateRoomList() {
    const catIdx = document.getElementById("buildingCat").value;
    const rooms = REF_DATA.categories[catIdx].items;
    
    const roomTypeSelect = document.getElementById("roomType");
    roomTypeSelect.innerHTML = rooms.map(it => 
        `<option value="${it.id}">${currentLang === 'ar' ? it.ar : it.en}</option>`
    ).join("");
}
