var CAT = [
  {id:'pc',g:'office',e:'💻',ar:'كمبيوتر مكتبي',en:'Desktop PC',w:300},
  {id:'laptop',g:'office',e:'💻',ar:'لابتوب',en:'Laptop',w:65},
  {id:'monitor',g:'office',e:'🖥️',ar:'شاشة كمبيوتر',en:'Monitor',w:40},
  {id:'printer',g:'office',e:'🖨️',ar:'طابعة ليزر',en:'Laser Printer',w:500},
  {id:'server',g:'office',e:'🗄️',ar:'سيرفر',en:'Server',w:500},
  {id:'router',g:'office',e:'📡',ar:'راوتر / سويتش',en:'Router / Switch',w:20},
  {id:'ups',g:'office',e:'🔋',ar:'UPS مزود طاقة',en:'UPS',w:600},
  {id:'projector',g:'office',e:'📽️',ar:'بروجكتور',en:'Projector',w:300},
  {id:'copier',g:'office',e:'📠',ar:'آلة تصوير',en:'Copier / Scanner',w:1200},
  {id:'phone',g:'office',e:'📱',ar:'شاحن جوال',en:'Phone Charger',w:20},

  {id:'led',g:'light',e:'💡',ar:'إضاءة LED',en:'LED Light',w:15},
  {id:'fluor',g:'light',e:'🔦',ar:'فلورسنت',en:'Fluorescent',w:40},
  {id:'spot',g:'light',e:'🔆',ar:'سبوت لايت',en:'Spotlight',w:50},
  {id:'ledpanel',g:'light',e:'🟦',ar:'لوحة LED 60x60',en:'LED Panel 60x60',w:36},

  {id:'tv',g:'home',e:'📺',ar:'تلفزيون',en:'TV',w:150},
  {id:'fridge',g:'home',e:'🧊',ar:'ثلاجة',en:'Refrigerator',w:150},
  {id:'fridgelg',g:'home',e:'🏠',ar:'ثلاجة كبيرة سايد',en:'Side-by-Side Fridge',w:250},
  {id:'microwave',g:'home',e:'📦',ar:'ميكروويف',en:'Microwave',w:1000},
  {id:'coffee',g:'home',e:'☕',ar:'ماكينة قهوة',en:'Coffee Machine',w:1500},
  {id:'dispenser',g:'home',e:'🚰',ar:'واتر كولر',en:'Water Dispenser',w:500},
  {id:'oven',g:'home',e:'🔥',ar:'فرن كهربائي',en:'Electric Oven',w:2000},
  {id:'washer',g:'home',e:'👕',ar:'غسالة ملابس',en:'Washing Machine',w:500},
  {id:'dryer',g:'home',e:'🌀',ar:'مجفف ملابس',en:'Clothes Dryer',w:5000},
  {id:'dishwasher',g:'home',e:'🍽️',ar:'غسالة صحون',en:'Dishwasher',w:1800},
  {id:'iron',g:'home',e:'♨️',ar:'مكواة',en:'Clothes Iron',w:2200},
  {id:'vacuum',g:'home',e:'🌪️',ar:'مكنسة كهربائية',en:'Vacuum Cleaner',w:1200},
  {id:'hairdryer',g:'home',e:'💨',ar:'مجفف شعر',en:'Hair Dryer',w:1800},
  {id:'kettle',g:'home',e:'🫖',ar:'غلاية ماء كهربائية',en:'Electric Kettle',w:2000},
  {id:'mixer',g:'home',e:'🥣',ar:'خلاط كهربائي',en:'Electric Mixer',w:300},
  {id:'pumphome',g:'home',e:'⚙️',ar:'موتور / ضخة مياه',en:'Water Pump',w:750},

  {id:'xray',g:'health',e:'🩻',ar:'جهاز أشعة سينية',en:'X-Ray Machine',w:5000},
  {id:'mri',g:'health',e:'🧲',ar:'جهاز MRI',en:'MRI Machine',w:35000},
  {id:'ct',g:'health',e:'🔬',ar:'جهاز CT Scan',en:'CT Scanner',w:30000},
  {id:'ultrasound',g:'health',e:'🩺',ar:'جهاز سونار',en:'Ultrasound Machine',w:500},
  {id:'ventilator',g:'health',e:'🫁',ar:'جهاز تنفس اصطناعي',en:'Ventilator',w:150},
  {id:'ecg',g:'health',e:'💓',ar:'جهاز رسم القلب ECG',en:'ECG Machine',w:40},
  {id:'defib',g:'health',e:'⚡',ar:'جهاز صدمة كهربائية',en:'Defibrillator',w:200},
  {id:'infusion',g:'health',e:'💉',ar:'مضخة تسريب IV',en:'IV Infusion Pump',w:12},
  {id:'syringe',g:'health',e:'🩹',ar:'مضخة حقن آلية',en:'Syringe Pump',w:10},
  {id:'patmon',g:'health',e:'📊',ar:'مراقب المريض',en:'Patient Monitor',w:150},
  {id:'autoclave',g:'health',e:'🧼',ar:'أوتوكلاف / تعقيم',en:'Autoclave Sterilizer',w:3000},
  {id:'incubator',g:'health',e:'🍼',ar:'حاضنة أطفال',en:'Infant Incubator',w:500},
  {id:'bloodbank',g:'health',e:'🩸',ar:'ثلاجة بنك الدم',en:'Blood Bank Fridge',w:800},
  {id:'anesthesia',g:'health',e:'😷',ar:'جهاز تخدير',en:'Anesthesia Machine',w:500},
  {id:'dental',g:'health',e:'🦷',ar:'كرسي أسنان كامل',en:'Dental Unit',w:750},
  {id:'centrifuge',g:'health',e:'🧪',ar:'جهاز طرد مركزي',en:'Centrifuge',w:300},
  {id:'pcr',g:'health',e:'🧬',ar:'جهاز PCR',en:'PCR Machine',w:1200},
  {id:'pharmfridge',g:'health',e:'💊',ar:'ثلاجة أدوية',en:'Pharmacy Refrigerator',w:600},
  {id:'endoscope',g:'health',e:'🔍',ar:'جهاز منظار',en:'Endoscopy Unit',w:800},
  {id:'surglight',g:'health',e:'🔦',ar:'لمبة غرفة عمليات',en:'Surgical Light',w:300}
];

function w2b(w){ return Math.round(w * 3.412); }
function fmt(n){ return Number(n || 0).toLocaleString('en-US'); }

var lang = 'ar';
var fi = 0;
var vals = ['', ''];
var rFac = 400;
var rLbl = '🏢 Office / مكتب';
var devs = [];
var hist = [];

try { hist = JSON.parse(localStorage.getItem('acp3') || '[]'); } catch (x) {}

var TX = {
  ar:{
    calc:'احسب ▶',clr:'مسح',hclr:'مسح السجل',exp:'تصدير CSV',
    ncalc:'الحاسبة',nhist:'التصدير',ncontact:'تواصل',nset:'الإعدادات',
    lvol:'حجم الغرفة (m³)',ltype:'نوع الغرفة',lppl:'👤 أشخاص — 400 BTU/h لكل شخص',
    ladd:'+ إضافة جهاز',lmodal:'اختر نوع الجهاز',ldtot:'إجمالي حمل الأجهزة',
    sroom:'الغرفة',sdev:'الأجهزة',
    bvol:'حجم الغرفة',bbase:'الحمل الأساسي',bppl:'حمل الأشخاص',
    bdev:'حمل الأجهزة',bsub:'الإجمالي',bsf:'+ معامل أمان 10%',
    hempty:'لا توجد حسابات بعد',dempty:'لا توجد أجهزة — اضغط + لإضافة',ppu:'أشخاص',
    tnov:'⚠️ أدخل حجم الغرفة أولاً',tnodata:'⚠️ لا توجد بيانات',
    tcalc:'✅ تم الحساب',texp:'✅ تم التصدير',tclr:'🗑️ تم المسح',
    slang:'اللغة / Language',slangsub:'تبديل واجهة اللغة'
  },
  en:{
    calc:'Calculate ▶',clr:'Clear',hclr:'Clear History',exp:'Export CSV',
    ncalc:'Calc',nhist:'History',ncontact:'Contact',nset:'Settings',
    lvol:'Room Volume (m³)',ltype:'Room Type',lppl:'👤 Persons — 400 BTU/h each',
    ladd:'+ Add Device',lmodal:'Select Device Type',ldtot:'Total Device Load',
    sroom:'ROOM',sdev:'DEVICES',
    bvol:'Room Volume',bbase:'Base Load',bppl:'People Load',
    bdev:'Device Load',bsub:'Sub-total',bsf:'+ Safety 10%',
    hempty:'No calculations yet',dempty:'No devices — tap + to add',ppu:'persons',
    tnov:'⚠️ Enter room volume first',tnodata:'⚠️ No data to export',
    tcalc:'✅ Calculated',texp:'✅ Exported',tclr:'🗑️ Cleared',
    slang:'Language',slangsub:'Switch interface language'
  }
};

function tx(k){ return TX[lang][k] || k; }
function el(id){ return document.getElementById(id); }

function applyLang(){
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

  el('langBtn').textContent = lang === 'ar' ? 'EN' : 'ع';
  el('tog-lang').className = 'tog ' + (lang === 'ar' ? 'on' : '');

  var mp = {
    'lbl-calc':'calc','lbl-clr':'clr','lbl-hclr':'hclr','lbl-exp':'exp',
    'nl-calc':'ncalc','nl-hist':'nhist','nl-contact':'ncontact','nl-settings':'nset',
    'lbl-vol':'lvol','lbl-type':'ltype','lbl-ppl':'lppl',
    'lbl-add':'ladd','lbl-modal':'lmodal','lbl-dtot':'ldtot',
    'st-room':'sroom','st-dev':'sdev',
    'brl-vol':'bvol','brl-base':'bbase','brl-ppl':'bppl',
    'brl-dev':'bdev','brl-sub':'bsub','brl-sf':'bsf',
    'hist-empty':'hempty','sl-lang':'slang','sl-langsub':'slangsub'
  };

  for (var id in mp){
    var e = el(id);
    if (e) e.textContent = tx(mp[id]);
  }

  refreshDisp();
  renderDevs();
  renderHist();
}

function toggleLang(){
  lang = lang === 'ar' ? 'en' : 'ar';
  applyLang();
}

function refreshDisp(){
  el('dv').textContent = (vals[0] || '0') + ' m³';
  el('dv').className = vals[0] ? '' : 'ph';

  el('dp').textContent = (vals[1] || '0') + ' ' + tx('ppu');
  el('dp').className = vals[1] ? '' : 'ph';

  el('dt').textContent = rLbl;
}

function setF(idx){
  fi = idx;
  var fields = ['f-vol','f-type','f-ppl'];
  fields.forEach(function(fid,i){
    var e = el(fid);
    if (!e) return;
    if (i === idx) e.classList.add('on');
    else e.classList.remove('on');

    var d = el('d' + i);
    if (d) d.className = 'dot' + (i === idx ? ' on' : '');
  });
}

function flash(id, val){
  var e = el(id);
  e.classList.add('fade');
  setTimeout(function(){
    e.textContent = val;
    e.classList.remove('fade');
  },150);
}

function showToast(msg){
  var e = el('toast');
  e.textContent = msg;
  e.classList.add('on');
  setTimeout(function(){ e.classList.remove('on'); },2500);
}

function toggleDD(menuId){
  var menu = el(menuId);
  var btn = menu.previousElementSibling;
  var open = menu.classList.contains('show');
  closeAllDD();
  if (!open){
    menu.classList.add('show');
    btn.classList.add('open');
  }
}

function closeAllDD(){
  document.querySelectorAll('.dd-menu.show').forEach(function(m){
    m.classList.remove('show');
    if (m.previousElementSibling) m.previousElementSibling.classList.remove('open');
  });
}

document.addEventListener('click', function(e){
  if (!e.target.closest('.dd-wrap')) closeAllDD();
});

function pickRoom(el2, factor, label){
  document.querySelectorAll('#dd-room .dd-item').forEach(function(i){
    i.classList.remove('sel');
  });
  el2.classList.add('sel');
  rFac = factor;
  rLbl = label;
  closeAllDD();
  el('dt').textContent = label;
}

function kNum(n){
  var idx = (fi === 2) ? 1 : 0;
  var cur = vals[idx] || '';

  if (n === '.' && cur.indexOf('.') !== -1) return;
  if (cur.length >= 8) return;

  vals[idx] = cur + n;
  refreshDisp();
}

function kDEL(){
  var idx = (fi === 2) ? 1 : 0;
  vals[idx] = (vals[idx] || '').slice(0, -1);
  refreshDisp();
}

function kCLR(){
  var idx = (fi === 2) ? 1 : 0;
  vals[idx] = '';
  refreshDisp();
}

function kAC(){
  vals = ['', ''];
  refreshDisp();
  flash('vtr','0.00');
  flash('vcfm','0');
  flash('vbtu','0');
  flash('vmkt','0');
  el('breakdown').classList.remove('show');
}

function totalDevBtu(){
  return devs.reduce(function(sum,d){
    var c = CAT.filter(function(x){ return x.id === d.id; })[0];
    return sum + (c ? w2b(c.w) * d.qty : 0);
  },0);
}

function doCalc(){
  var vol = parseFloat(vals[0]) || 0;
  var ppl = parseInt(vals[1]) || 0;

  if (vol === 0){
    showToast(tx('tnov'));
    return;
  }

  var base = vol * rFac;
  var pplBtu = ppl * 400;
  var devBtu = totalDevBtu();
  var sub = base + pplBtu + devBtu;
  var total = sub * 1.10;

  var tr = total / 12000;
  var cfm = Math.round(tr * 400);
  var mkt = Math.ceil(total / 9000) * 9000;

  flash('vtr', tr.toFixed(2));
  flash('vcfm', fmt(cfm));
  flash('vbtu', fmt(Math.round(total)));
  flash('vmkt', fmt(mkt));

  el('brv-vol').textContent = fmt(vol);
  el('brv-base').textContent = fmt(Math.round(base));
  el('brv-ppl').textContent = fmt(Math.round(pplBtu));
  el('brv-dev').textContent = fmt(Math.round(devBtu));
  el('brv-sub').textContent = fmt(Math.round(sub));
  el('brv-sf').textContent = fmt(Math.round(total));
  el('breakdown').classList.add('show');

  var devSum = devs.map(function(d){
    var c = CAT.filter(function(x){ return x.id === d.id; })[0];
    return c ? ((lang === 'ar' ? c.ar : c.en) + 'x' + d.qty) : '';
  }).filter(Boolean).join(' | ');

  hist.unshift({
    time: new Date().toLocaleString('en-US'),
    vol: vol,
    ppl: ppl,
    type: rLbl,
    devSum: devSum,
    devBtu: devBtu,
    tr: tr.toFixed(2),
    cfm: cfm,
    btu: Math.round(total),
    mkt: mkt
  });

  if (hist.length > 50) hist.pop();

  localStorage.setItem('acp3', JSON.stringify(hist));
  renderHist();
  showToast(tx('tcalc'));
}

function renderDevs(){
  var list = el('dev-list');
  list.innerHTML = '';

  if (!devs.length){
    var em = document.createElement('div');
    em.className = 'dev-empty';
    em.textContent = tx('dempty');
    list.appendChild(em);
    el('dev-total').style.display = 'none';
    return;
  }

  devs.forEach(function(d){
    var c = CAT.filter(function(x){ return x.id === d.id; })[0];
    if (!c) return;

    var name = lang === 'ar' ? c.ar : c.en;
    var btu = w2b(c.w) * d.qty;

    var row = document.createElement('div');
    row.className = 'dev-row';
    row.innerHTML =
      '<div class="dev-ico">'+c.e+'</div>' +
      '<div class="dev-info">' +
        '<div class="dev-name">'+name+'</div>' +
        '<div class="dev-watt">'+fmt(c.w)+'W &times; '+fmt(d.qty)+' = '+fmt(c.w*d.qty)+'W</div>' +
      '</div>' +
      '<div class="dev-qty">' +
        '<div class="qbtn" onclick="chgQty(\''+d.id+'\',-1)">&#8722;</div>' +
        '<div class="qnum">'+fmt(d.qty)+'</div>' +
        '<div class="qbtn" onclick="chgQty(\''+d.id+'\',1)">&#43;</div>' +
      '</div>' +
      '<div class="dev-btu">'+fmt(btu)+' BTU/h</div>' +
      '<div class="dev-del" onclick="delDev(\''+d.id+'\')">&#128465;</div>';

    list.appendChild(row);
  });

  var tot = totalDevBtu();
  el('dev-total').style.display = 'flex';
  el('val-dtot').textContent = fmt(tot) + ' BTU/h';
  el('lbl-dtot').textContent = tx('ldtot');
}

function chgQty(id, delta){
  for (var i = 0; i < devs.length; i++){
    if (devs[i].id === id){
      devs[i].qty += delta;
      if (devs[i].qty <= 0) devs.splice(i,1);
      break;
    }
  }
  renderDevs();
}

function delDev(id){
  devs = devs.filter(function(d){ return d.id !== id; });
  renderDevs();
}

function openModal(){
  buildGrid(null);
  document.querySelectorAll('.ftab').forEach(function(t,i){
    t.className = 'ftab' + (i === 0 ? ' on' : '');
  });
  el('overlay').classList.add('on');
}

function closeModal(){
  el('overlay').classList.remove('on');
}

function overlayClick(e){
  if (e.target === el('overlay')) closeModal();
}

function filterTab(tabEl, grp){
  document.querySelectorAll('.ftab').forEach(function(t){ t.className = 'ftab'; });
  tabEl.className = 'ftab on';
  buildGrid(grp);
}

var gLabel = {
  office:{ar:'🏢 مكتب / Office',en:'🏢 Office'},
  light:{ar:'💡 إضاءة / Lighting',en:'💡 Lighting'},
  home:{ar:'🏠 منزلي / Domestic',en:'🏠 Domestic'},
  health:{ar:'🏥 صحي / Healthcare',en:'🏥 Healthcare'}
};

function buildGrid(grp){
  var grid = el('cat-grid');
  grid.innerHTML = '';

  var groups = grp ? [grp] : ['office','light','home','health'];

  groups.forEach(function(gk){
    var items = CAT.filter(function(d){ return d.g === gk; });
    if (!items.length) return;

    var hdr = document.createElement('div');
    hdr.className = 'cat-hdr';
    hdr.textContent = gLabel[gk][lang];
    grid.appendChild(hdr);

    items.forEach(function(d){
      var wl = d.w >= 1000 ? (d.w / 1000).toFixed(1) + 'kW' : d.w + 'W';
      var btu = w2b(d.w);

      var card = document.createElement('div');
      card.className = 'cat-item';
      card.innerHTML =
        '<div class="cat-ico">'+d.e+'</div>' +
        '<div class="cat-name">'+(lang === 'ar' ? d.ar : d.en)+'</div>' +
        '<div class="cat-w">'+wl+'</div>' +
        '<div class="cat-btu">'+fmt(btu)+' BTU/h</div>';

      (function(did, dname){
        card.onclick = function(){
          var found = false;
          for (var i = 0; i < devs.length; i++){
            if (devs[i].id === did){
              devs[i].qty++;
              found = true;
              break;
            }
          }
          if (!found) devs.push({id: did, qty: 1});
          closeModal();
          renderDevs();
          showToast('✅ ' + dname + ' +1');
        };
      })(d.id, lang === 'ar' ? d.ar : d.en);

      grid.appendChild(card);
    });
  });
}

function renderHist(){
  var list = el('hist-list');
  list.innerHTML = '';

  if (!hist.length){
    var em = document.createElement('div');
    em.className = 'hist-empty';
    em.id = 'hist-empty';
    em.textContent = tx('hempty');
    list.appendChild(em);
    return;
  }

  hist.forEach(function(h){
    var row = document.createElement('div');
    row.className = 'hist-item';
    row.innerHTML =
      '<div>' +
        '<div class="hist-info">'+h.type+' &middot; '+fmt(h.vol)+'m&sup3; &middot; '+fmt(h.ppl)+'&#128100;'+(h.devSum ? ' &middot; ' + h.devSum : '')+'</div>' +
        '<div class="hist-info" style="margin-top:2px">'+h.time+'</div>' +
      '</div>' +
      '<div class="hist-res">'+h.tr+' TR</div>';
    list.appendChild(row);
  });
}

function clearHist(){
  hist = [];
  localStorage.removeItem('acp3');
  renderHist();
  showToast(tx('tclr'));
}

function exportCSV(){
  if (!hist.length){
    showToast(tx('tnodata'));
    return;
  }

  var h = ['Time','Room Type','Volume(m3)','Persons','Devices','Device BTU/h','TR','CFM','Total BTU/h','Market BTU'];
  var rows = hist.map(function(r){
    return [r.time,r.type,r.vol,r.ppl,r.devSum || '',r.devBtu || 0,r.tr,r.cfm,r.btu,r.mkt];
  });

  var csv = [h].concat(rows).map(function(r){
    return r.map(function(v){
      return '"' + String(v).replace(/"/g,'""') + '"';
    }).join(',');
  }).join('\n');

  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], {type:'text/csv;charset=utf-8;'}));
  a.download = 'aircalc_pro.csv';
  a.click();
  showToast(tx('texp'));
}

function goPanel(name){
  document.querySelectorAll('.panel').forEach(function(p){ p.classList.remove('on'); });
  document.querySelectorAll('.ni').forEach(function(n){ n.classList.remove('on'); });

  el('p-' + name).classList.add('on');
  el('ni-' + name).classList.add('on');
}

applyLang();
setF(0);
renderDevs();
renderHist();