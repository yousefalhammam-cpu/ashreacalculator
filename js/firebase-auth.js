(function(){
'use strict';
const firebaseConfig = {
  apiKey: "AIzaSyCybA-8hTTps0Xy5iR2HxntSSASIeibYaU",
  authDomain: "aircalcpro-24809.firebaseapp.com",
  projectId: "aircalcpro-24809",
  storageBucket: "aircalcpro-24809.firebasestorage.app",
  messagingSenderId: "937103891998",
  appId: "1:937103891998:web:65c231517bcd41102b980f",
  measurementId: "G-3FZ87Q1V31"
};

let firebaseReady = false;
let auth = null;
let db = null;
let currentUser = null;
let currentProfile = null;
let authMode = 'signin';
let proUnlockContext = null;
let firebaseInitPromise = null;
let authBusy = false;
let authReturnFocus = null;

let createUserWithEmailAndPasswordFn = null;
let signInWithEmailAndPasswordFn = null;
let signOutFn = null;
let onAuthStateChangedFn = null;
let sendPasswordResetEmailFn = null;
let updateProfileFn = null;
let docFn = null;
let setDocFn = null;
let getDocFn = null;
let collectionFn = null;
let getDocsFn = null;
let serverTimestampFn = null;

const PROJECT_ROLES = Object.freeze({
  OWNER: 'owner',
  EDITOR: 'editor',
  VIEWER: 'viewer'
});

function GG(id){ return document.getElementById(id); }
function isAr(){ return (window.lang || 'ar') === 'ar'; }
function isFileProtocol(){
  try{
    return !!(window.location && window.location.protocol === 'file:');
  }catch(e){
    return false;
  }
}
function tt(key, fallback){
  try{
    if(window.t) return window.t(key);
    if(window.T && window.T[window.lang || 'ar']){
      return window.T[window.lang || 'ar'][key] || fallback || key;
    }
  }catch(e){}
  return fallback || key;
}
function toastMsg(msg){
  if(typeof window.toast === 'function') window.toast(msg);
}
function showAuthMessage(message){
  const status = GG('auth-message');
  if(status){ status.textContent = message || ''; status.hidden = !message; }
}
function authErrorMessage(err){
  const code = err && err.code;
  const messages = {
    'auth/invalid-credential': ['البريد الإلكتروني أو كلمة المرور غير صحيحة.', 'Incorrect email or password.'],
    'auth/wrong-password': ['البريد الإلكتروني أو كلمة المرور غير صحيحة.', 'Incorrect email or password.'],
    'auth/user-not-found': ['البريد الإلكتروني أو كلمة المرور غير صحيحة.', 'Incorrect email or password.'],
    'auth/email-already-in-use': ['هذا البريد مسجل بالفعل. سجّل الدخول أو استعد كلمة المرور.', 'This email is already registered. Sign in or reset your password.'],
    'auth/too-many-requests': ['محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.', 'Too many attempts. Please try again later.'],
    'auth/network-request-failed': ['تعذر الاتصال. تحقق من الإنترنت وأعد المحاولة.', 'Connection failed. Check your internet and try again.'],
    'auth/invalid-email': ['صيغة البريد الإلكتروني غير صحيحة.', 'The email address is not valid.'],
    'auth/user-disabled': ['تم تعطيل هذا الحساب. تواصل مع الدعم.', 'This account has been disabled. Contact support.'],
    'auth/weak-password': ['كلمة المرور ضعيفة. استخدم 8 أحرف على الأقل.', 'The password is too weak. Use at least 8 characters.'],
    'auth/internal-error': ['حدث خطأ داخلي في خدمة الحساب. أعد المحاولة.', 'The account service returned an internal error. Please try again.'],
    'auth/operation-not-allowed': ['تسجيل الدخول بالبريد غير مفعّل في إعدادات Firebase لهذا التطبيق.', 'Email/password sign-in is not enabled in this app’s Firebase settings.'],
    'auth/unauthorized-domain': ['نطاق هذا الموقع غير مصرح به في Firebase.', 'This website domain is not authorized in Firebase.']
  };
  if(messages[code]) return messages[code][isAr() ? 0 : 1];
  const fallback = tt('authfirebase_unavailable', 'Account service is unavailable right now');
  return code ? `${fallback} (${code})` : fallback;
}
function validEmail(v){
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
}
function openOverlay(id){
  const el = GG(id);
  if(el) el.classList.remove('hidden');
}
function closeOverlay(id){
  const el = GG(id);
  if(el) el.classList.add('hidden');
}
function getDisplayName(user){
  return (user && (user.displayName || user.email)) || '--';
}
function getDisplayEmail(user){
  return (user && user.email) || '--';
}
function buildProjectLink(projectId){
  try{
    if(!window.location || !projectId) return '';
    if(window.location.protocol !== 'http:' && window.location.protocol !== 'https:') return '';
    const url = new URL(window.location.href);
    url.searchParams.set('project', projectId);
    return url.toString();
  }catch(e){
    return '';
  }
}
function normalizeProjectRole(role){
  const value = String(role || '').toLowerCase();
  if(value === PROJECT_ROLES.EDITOR) return PROJECT_ROLES.EDITOR;
  if(value === PROJECT_ROLES.VIEWER) return PROJECT_ROLES.VIEWER;
  return PROJECT_ROLES.OWNER;
}
function canEditProjectRole(role){
  const normalized = normalizeProjectRole(role);
  return normalized === PROJECT_ROLES.OWNER || normalized === PROJECT_ROLES.EDITOR;
}
function canViewProjectRole(role){
  return !!normalizeProjectRole(role);
}
function normalizeCollaborationRoles(roles, ownerId){
  const out = {};
  const source = roles && typeof roles === 'object' ? roles : {};
  Object.keys(source).forEach((uid) => {
    const cleanUid = String(uid || '').trim();
    if(cleanUid) out[cleanUid] = normalizeProjectRole(source[uid]);
  });
  if(ownerId) out[ownerId] = PROJECT_ROLES.OWNER;
  return out;
}
function notifyPlanDependents(){
  try{
    if(typeof window.updatePlanUI === 'function') window.updatePlanUI();
    if(typeof window.renderProjects === 'function') window.renderProjects();
    if(typeof window.updateNavDots === 'function') window.updateNavDots();
  }catch(e){}
}

function setAuthMode(mode){
  if(authBusy) return;
  authMode = mode === 'create' ? 'create' : 'signin';
  showAuthMessage('');
  updateAuthUI();
}

function updateAuthUI(){
  const loggedIn = !!currentUser;
  const accountButton = GG('topbar-account-btn');
  if(accountButton){
    const label = loggedIn ? `${tt('authacct', 'Account')}: ${getDisplayName(currentUser)}` : tt('authsignin', 'Sign In');
    accountButton.title = label;
    accountButton.setAttribute('aria-label', label);
    accountButton.classList.toggle('signed-in', loggedIn);
    let nameLabel=accountButton.querySelector('.account-display-name');
    if(!nameLabel){
      nameLabel=document.createElement('span');
      nameLabel.className='account-display-name';
      accountButton.appendChild(nameLabel);
    }
    nameLabel.textContent=loggedIn?getDisplayName(currentUser):'';
    nameLabel.hidden=!loggedIn;
    accountButton.classList.toggle('has-account-name',loggedIn);
  }
  ['auth-email', 'auth-password'].forEach(id => {
    const input = GG(id);
    const field = input && input.closest('.auth-field');
    if(field) field.hidden = loggedIn;
  });
  if(GG('auth-password')) GG('auth-password').autocomplete = authMode === 'create' ? 'new-password' : 'current-password';
  const openBtn = GG('auth-open-btn');
  const logoutBtn = GG('auth-logout-btn');
  const userRow = GG('auth-user-row');
  const userName = GG('auth-user-name');
  const userEmail = GG('auth-user-email');
  const statusSub = GG('auth-status-sub');
  const modalSub = GG('auth-modal-sub');
  const primaryBtn = GG('auth-primary-btn');
  const forgotBtn = GG('auth-forgot-btn');
  const logoutModalBtn = GG('auth-logout-modal-btn');
  const fullRow = GG('auth-fullname-row');
  const confirmRow = GG('auth-confirm-row');
  const tabs = GG('auth-mode-tabs');
  const summary = GG('auth-user-summary');
  const summaryName = GG('auth-summary-name');
  const summaryEmail = GG('auth-summary-email');
  const helper = GG('auth-helper-note');
  const tabSignIn = GG('auth-tab-signin');
  const tabCreate = GG('auth-tab-create');
  const laterBtn = GG('auth-later-btn');
  const modalTitle = GG('auth-modal-title');

  const unlockTitle = tt('authunlocktitle', isAr() ? 'تسجيل الدخول لتفعيل PRO' : 'Sign in to unlock PRO');
  const unlockSub = tt('authunlocksub', isAr() ? 'سجّل الدخول أو أنشئ حسابًا لتفعيل PRO Early Access.' : 'Sign in or create an account to unlock PRO Early Access.');
  const defaultTitle = tt('authacct', 'Account');
  const defaultSub = isAr()?'جميع الأدوات مجانية. يحفظ الضيف مشروعًا واحدًا؛ الحساب المجاني يتيح حفظ مشاريع متعددة والمزامنة السحابية.':'All tools are free. Guests can save one project; a free account enables multiple projects and cloud sync.';
  const modalTitleText = (!loggedIn && proUnlockContext) ? unlockTitle : defaultTitle;
  const modalSubText = (!loggedIn && proUnlockContext) ? unlockSub : defaultSub;

  if(openBtn){
    openBtn.textContent = loggedIn
      ? (isAr()?'إدارة الحساب':'Manage account')
      : (isAr()?'تسجيل الدخول / إنشاء حساب مجاني':'Sign in / Create free account');
  }
  if(statusSub){
    statusSub.textContent = loggedIn
      ? `${tt('authloggedin', 'Signed in as')} ${getDisplayName(currentUser)}`
      : defaultSub;
  }
  if(userName) userName.textContent = getDisplayName(currentUser);
  if(userEmail) userEmail.textContent = getDisplayEmail(currentUser);
  if(userRow) userRow.style.display = loggedIn ? '' : 'none';
  if(logoutBtn) logoutBtn.textContent = tt('authlogout', 'Log Out');

  if(summaryName) summaryName.textContent = getDisplayName(currentUser);
  if(summaryEmail) summaryEmail.textContent = getDisplayEmail(currentUser);
  if(summary) summary.style.display = loggedIn ? '' : 'none';
  if(tabs) tabs.style.display = loggedIn ? 'none' : '';

  if(tabSignIn){
    tabSignIn.textContent = tt('authsignin', 'Sign In');
    tabSignIn.classList.toggle('active', authMode === 'signin');
  }
  if(tabCreate){
    tabCreate.textContent = tt('authcreate', 'Create Account');
    tabCreate.classList.toggle('active', authMode === 'create');
  }

  if(fullRow) fullRow.style.display = (!loggedIn && authMode === 'create') ? '' : 'none';
  if(confirmRow) confirmRow.style.display = (!loggedIn && authMode === 'create') ? '' : 'none';

  if(primaryBtn){
    primaryBtn.textContent = loggedIn
      ? tt('authearlypro', 'PRO Early Access')
      : (authMode === 'create' ? tt('authcreate', 'Create Account') : tt('authsignin', 'Sign In'));
    primaryBtn.disabled = loggedIn || authBusy;
    if(authBusy) primaryBtn.textContent = isAr() ? 'جارٍ الاتصال...' : 'Connecting...';
  }

  if(forgotBtn){
    forgotBtn.textContent = tt('authforgot', 'Forgot Password?');
    forgotBtn.style.display = (!loggedIn && authMode === 'signin') ? '' : 'none';
  }

  if(logoutModalBtn){
    logoutModalBtn.textContent = tt('authlogout', 'Log Out');
    logoutModalBtn.style.display = loggedIn ? '' : 'none';
  }

  if(helper){
    helper.textContent = loggedIn
      ? (isAr()?'حسابك مجاني؛ يمكنك حفظ مشاريع متعددة ومزامنتها.':'Your account is free; save multiple projects and sync them.')
      : (isFileProtocol()
          ? (isAr()
              ? 'تسجيل الدخول يتطلب تشغيل التطبيق من الموقع أو من خادم محلي، وليس من file://'
              : 'Sign in requires running the app from the website or a local server, not from file://')
          : (isAr()?'حساب مجاني لحفظ مشاريع إضافية ومزامنة بياناتك.':'A free account for additional projects and cloud sync.'));
  }

  if(modalSub){
    modalSub.textContent = loggedIn
      ? `${tt('authloggedin', 'Signed in as')} ${getDisplayName(currentUser)}`
      : modalSubText;
  }

  if(GG('auth-panel-title')) GG('auth-panel-title').textContent = tt('authacct', 'Account');
  if(modalTitle) modalTitle.textContent = modalTitleText;
  if(GG('auth-fullname-lbl')) GG('auth-fullname-lbl').textContent = tt('authfullname', 'Full Name');
  if(GG('auth-email-lbl')) GG('auth-email-lbl').textContent = tt('authemail', 'Email');
  if(GG('auth-password-lbl')) GG('auth-password-lbl').textContent = tt('authpassword', 'Password');
  if(GG('auth-confirm-lbl')) GG('auth-confirm-lbl').textContent = tt('authconfirm', 'Confirm Password');
  if(laterBtn){
    laterBtn.textContent = tt('authlater', isAr() ? 'لاحقًا' : 'Later');
    laterBtn.style.display = loggedIn ? 'none' : '';
  }
}

function clearAuthForm(){
  ['auth-fullname','auth-email','auth-password','auth-confirm'].forEach(id => {
    const el = GG(id);
    if(el) el.value = '';
  });
}

async function loadUserProfileDoc(user){
  if(!firebaseReady || !db || !user) return null;
  const ref = docFn(db, 'users', user.uid);
  try{
    const snap = await getDocFn(ref);
    if(snap && typeof snap.exists === 'function' && snap.exists()){
      return snap.data() || null;
    }
  }catch(e){}
  return null;
}

async function ensureFirebase(options = {}){
  if(firebaseReady) return true;
  if(firebaseInitPromise) return firebaseInitPromise;
  const timeout = new Promise((resolve) => {
    window.setTimeout(() => resolve(false), 15000);
  });
  firebaseInitPromise = Promise.race([initializeFirebase(options), timeout]);
  try { return await firebaseInitPromise; }
  finally { firebaseInitPromise = null; }
}

async function initializeFirebase(options = {}){
  const silent = options && options.silent === true;
  if(firebaseReady) return true;
  if(isFileProtocol()){
    firebaseReady = false;
    if(!silent){
      showAuthMessage(isAr() ? 'افتح التطبيق من رابط الخادم المحلي لتسجيل الدخول. تبقى بيانات الملف محفوظة في المتصفح.' : 'Open the app using the local server URL to sign in. Your file-based data remains saved in this browser.');
      toastMsg(
        isAr()
          ? 'تسجيل الدخول لا يعمل عند فتح التطبيق مباشرة من الملف. شغّل AirCalc Pro من الموقع أو من خادم محلي.'
          : 'Sign in does not work when the app is opened directly from a file. Run AirCalc Pro from the website or a local server.'
      );
    }
    updateAuthUI();
    notifyPlanDependents();
    return false;
  }
  try{
    const [appMod, authMod, fsMod] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js')
    ]);

    const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(firebaseConfig);
    auth = authMod.getAuth(app);
    db = fsMod.getFirestore(app);

    // Keep the signed-in account across refreshes. If storage is unavailable,
    // Firebase still falls back to its in-memory session for the current page.
    try{
      await authMod.setPersistence(auth, authMod.browserLocalPersistence);
    }catch(err){
      console.warn('[AirCalc] Persistent auth session unavailable:', err);
    }

    createUserWithEmailAndPasswordFn = authMod.createUserWithEmailAndPassword;
    signInWithEmailAndPasswordFn = authMod.signInWithEmailAndPassword;
    signOutFn = authMod.signOut;
    onAuthStateChangedFn = authMod.onAuthStateChanged;
    sendPasswordResetEmailFn = authMod.sendPasswordResetEmail;
    updateProfileFn = authMod.updateProfile;

    docFn = fsMod.doc;
    setDocFn = fsMod.setDoc;
    getDocFn = fsMod.getDoc;
    collectionFn = fsMod.collection;
    getDocsFn = fsMod.getDocs;
    serverTimestampFn = fsMod.serverTimestamp;

    firebaseReady = true;
    onAuthStateChangedFn(auth, async (user) => {
      currentUser = user || null;
      currentProfile = null;
      updateAuthUI();
      notifyPlanDependents();
      if(currentUser){
        const profile = await loadUserProfileDoc(user).catch(() => null);
        if(currentUser && currentUser.uid === user.uid) currentProfile = profile;
      }
      updateAuthUI();
      notifyPlanDependents();
    });
    return true;
  }catch(err){
    console.warn('[AirCalc] Firebase auth unavailable:', err);
    firebaseReady = false;
    if(!silent){
      showAuthMessage(authErrorMessage(err));
      toastMsg(
        navigator.onLine
          ? tt('authfirebase_unavailable', 'Account service is unavailable right now')
          : tt('authoffline', 'You appear to be offline - local calculator remains available')
      );
    }
    updateAuthUI();
    notifyPlanDependents();
    return false;
  }
}

async function createUserProfileDoc(user, fullName){
  if(!firebaseReady || !db || !user) return;
  const ref = docFn(db, 'users', user.uid);
  await setDocFn(ref, {
    email: user.email || '',
    plan: 'pro',
    accessType: 'early_access',
    fullName: fullName || user.displayName || '',
    createdAt: serverTimestampFn(),
    lastLoginAt: serverTimestampFn()
  }, { merge: true });
}

async function updateUserLoginRecord(user){
  if(!firebaseReady || !db || !user) return;
  const ref = docFn(db, 'users', user.uid);
  let snap = null;
  try{ snap = await getDocFn(ref); }catch(e){}
  const prev = snap && typeof snap.exists === 'function' && snap.exists() ? (snap.data() || {}) : {};
  await setDocFn(ref, {
    email: user.email || prev.email || '',
    plan: 'pro',
    accessType: 'early_access',
    fullName: user.displayName || prev.fullName || '',
    createdAt: prev.createdAt || serverTimestampFn(),
    lastLoginAt: serverTimestampFn()
  }, { merge: true });
}

async function handlePrimaryAuth(){
  if(currentUser || authBusy) return;
  showAuthMessage('');

  const fullName = (GG('auth-fullname')?.value || '').trim();
  const email = (GG('auth-email')?.value || '').trim();
  const password = GG('auth-password')?.value || '';
  const confirm = GG('auth-confirm')?.value || '';

  if(authMode === 'create' && !fullName){
    showAuthMessage(tt('authfullname_req', 'Full name is required'));
    return;
  }
  if(!validEmail(email)){
    showAuthMessage(tt('authemail_invalid', 'Enter a valid email address'));
    return;
  }
  if(!password || (authMode === 'create' && password.length < 8)){
    showAuthMessage(authMode === 'create' ? tt('authpassword_min', 'Password must be at least 8 characters') : (isAr() ? 'أدخل كلمة المرور.' : 'Enter your password.'));
    return;
  }
  if(authMode === 'create' && password !== confirm){
    showAuthMessage(tt('authconfirm_mismatch', 'Confirm password does not match'));
    return;
  }

  authBusy = true;
  updateAuthUI();
  try{
    const ready = await ensureFirebase();
    if(!ready){
      showAuthMessage(
        isFileProtocol()
          ? (isAr() ? 'افتح التطبيق من رابط الخادم المحلي لتسجيل الدخول.' : 'Open the app using the local server URL to sign in.')
          : tt('authfirebase_unavailable', 'Account service is unavailable right now')
      );
      return;
    }
    if(authMode === 'create'){
      const cred = await createUserWithEmailAndPasswordFn(auth, email, password);
      if(cred && cred.user){
        currentUser = cred.user;
        // Firestore availability must not turn successful Authentication into a failed login.
        updateProfileFn(cred.user, { displayName: fullName }).then(updateAuthUI).catch(() => {});
        createUserProfileDoc(cred.user, fullName).catch(() => {});
      }
      if(typeof window.trackEvent === 'function'){
        window.trackEvent('signup_success', {
          language: isAr() ? 'ar' : 'en',
          access_type: 'early_access'
        });
      }
      toastMsg(tt('authcreated', 'Account created'));
    } else {
      const cred = await signInWithEmailAndPasswordFn(auth, email, password);
      if(cred && cred.user){
        currentUser = cred.user;
        updateUserLoginRecord(cred.user).catch(() => {});
      }
      if(typeof window.trackEvent === 'function'){
        window.trackEvent('login_success', {
          language: isAr() ? 'ar' : 'en',
          access_type: 'early_access'
        });
      }
      toastMsg(tt('authsignedin', 'Signed in'));
    }
    clearAuthForm();
    updateAuthUI();
    notifyPlanDependents();
    closeAuthModal();
  }catch(err){
    showAuthMessage(authErrorMessage(err));
  }finally{
    authBusy = false;
    updateAuthUI();
  }
}

async function handleForgotPassword(){
  const email = (GG('auth-email')?.value || '').trim();
  if(!validEmail(email)){
    toastMsg(tt('authemail_invalid', 'Enter a valid email address'));
    return;
  }
  const ready = await ensureFirebase();
  if(!ready) return;
  try{
    await sendPasswordResetEmailFn(auth, email);
    toastMsg(tt('authreset', 'Password reset link sent'));
  }catch(err){
    toastMsg((err && err.message) ? err.message : tt('authfirebase_unavailable', 'Account service is unavailable right now'));
  }
}

async function logoutAuth(){
  if(!firebaseReady || !auth || !currentUser){
    currentUser = null;
    currentProfile = null;
    updateAuthUI();
    notifyPlanDependents();
    closeAuthModal();
    return;
  }
  try{
    await signOutFn(auth);
    currentUser = null;
    currentProfile = null;
    toastMsg(tt('authlogout', 'Log Out'));
    updateAuthUI();
    notifyPlanDependents();
    closeAuthModal();
  }catch(err){
    toastMsg((err && err.message) ? err.message : tt('authfirebase_unavailable', 'Account service is unavailable right now'));
  }
}

function openAuthModal(){
  proUnlockContext = null;
  showAccountDialog();
}

function showAccountDialog(){
  authReturnFocus = document.activeElement;
  const overlay=GG('auth-overlay');
  if(overlay && overlay.parentElement!==document.body) document.body.appendChild(overlay);
  // Opening the dialog must not depend on Firebase or the plan UI refreshing.
  openOverlay('auth-overlay');
  showAuthMessage('');
  updateAuthUI();
  const target = GG(currentUser ? 'auth-logout-modal-btn' : 'auth-email');
  if(target) target.focus();
}

function openAuthModalWithContext(options){
  proUnlockContext = options && options.proUnlock ? {
    featureKey: options.featureKey || ''
  } : null;
  showAccountDialog();
}

function closeAuthModal(e){
  if(e && e.target !== GG('auth-overlay')) return;
  proUnlockContext = null;
  closeOverlay('auth-overlay');
  if(authReturnFocus && authReturnFocus.isConnected) authReturnFocus.focus();
}

function requireLoginForCloudFeature(){
  if(!currentUser){
    toastMsg(typeof lang!=='undefined' && lang==='ar'?'سجل الدخول لحماية بياناتك السحابية.':'Sign in to access your private cloud data.');
    return false;
  }
  if (window.AppPlan && typeof window.AppPlan.requirePro === 'function') {
    return window.AppPlan.requirePro('cloud_save');
  }
  if(!currentUser){
    toastMsg(tt('authcloudreq', 'Login required for PRO features and cloud saving'));
    return false;
  }
  return true;
}

async function saveProjectToCloud(project){
  if(!requireLoginForCloudFeature()) return { ok:false, reason:'login_required', project:project || null };
  const ready = await ensureFirebase({ silent:true });
  if(!ready || !db || !currentUser || !docFn || !setDocFn){
    return { ok:false, reason:navigator.onLine ? 'firebase_unavailable' : 'offline', project:project || null };
  }
  if(!project || typeof project !== 'object'){
    return { ok:false, reason:'invalid_project', project:null };
  }

  const localId = String(project.id || '').trim();
  const cloudId = String(project.cloudId || localId || '').trim();
  if(!cloudId){
    return { ok:false, reason:'missing_project_id', project:project || null };
  }

  const projectUrl = buildProjectLink(cloudId);
  const existingCollaboration = (project.collaboration && typeof project.collaboration === 'object')
    ? project.collaboration
    : {};
  const existingRoles = (existingCollaboration.roles && typeof existingCollaboration.roles === 'object')
    ? existingCollaboration.roles
    : {};
  const collaboration = {
    ownerId: currentUser.uid,
    ownerEmail: currentUser.email || '',
    visibility: existingCollaboration.visibility || 'private',
    roles: {
      ...existingRoles,
      [currentUser.uid]: PROJECT_ROLES.OWNER
    },
    updatedBy: currentUser.uid
  };
  const ref = docFn(db, 'users', currentUser.uid, 'projects', cloudId);
  const payload = {
    id: localId || cloudId,
    cloudId,
    name: String(project.name || '').trim(),
    ownerId: currentUser.uid,
    ownerEmail: currentUser.email || '',
    role: PROJECT_ROLES.OWNER,
    collaboration,
    status: project.status || 'active',
    localUpdatedAt: project.updatedAt || '',
    updatedAt: serverTimestampFn(),
    lastSyncedAt: serverTimestampFn(),
    projectUrl,
    schemaVersion: 1,
    snapshot: project.snapshot || {}
  };

  try{
    await setDocFn(ref, payload, { merge:true });
    return { ok:true, cloudId, projectUrl, ownerId:currentUser.uid };
  }catch(err){
    console.warn('[AirCalc] Cloud project save failed:', err);
    return {
      ok:false,
      reason:navigator.onLine ? 'write_failed' : 'offline',
      error:(err && err.message) ? err.message : String(err || ''),
      project:project || null
    };
  }
}

async function loadUserProjectsFromCloud(){
  if(!requireLoginForCloudFeature()) return [];
  const ready = await ensureFirebase({ silent:true });
  if(!ready || !db || !currentUser || !collectionFn || !getDocsFn) return [];

  try{
    const ref = collectionFn(db, 'users', currentUser.uid, 'projects');
    const snap = await getDocsFn(ref);
    const projects = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() || {};
      projects.push({
        id: data.id || docSnap.id,
        cloudId: data.cloudId || docSnap.id,
        name: data.name || '',
        createdAt: data.createdAt || '',
        updatedAt: data.localUpdatedAt || '',
        ownerId: data.ownerId || currentUser.uid,
        ownerEmail: data.ownerEmail || currentUser.email || '',
        role: normalizeProjectRole(data.role),
        collaboration: data.collaboration || {
          ownerId: data.ownerId || currentUser.uid,
          ownerEmail: data.ownerEmail || currentUser.email || '',
          visibility: 'private',
          roles: { [currentUser.uid]: normalizeProjectRole(data.role) }
        },
        status: data.status || 'active',
        syncStatus: 'synced',
        projectUrl: data.projectUrl || buildProjectLink(data.cloudId || docSnap.id),
        snapshot: data.snapshot || {}
      });
    });
    projects.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
    return projects;
  }catch(err){
    console.warn('[AirCalc] Cloud project load failed:', err);
    return [];
  }
}

function normalizeEquipmentCloudRecord(record){
  const source = record && typeof record === 'object' ? record : {};
  return {
    ...source,
    ownerId: currentUser ? currentUser.uid : '',
    ownerEmail: currentUser ? (currentUser.email || '') : '',
    updatedAt: serverTimestampFn ? serverTimestampFn() : '',
    schemaVersion: 1
  };
}

async function saveEquipmentCatalogueToCloud(store, options = {}){
  const silent = options && options.silent === true;
  if(!silent && !requireLoginForCloudFeature()) return { ok:false, reason:'login_required' };
  const ready = await ensureFirebase({ silent:true });
  if(!ready || !db || !currentUser || !docFn || !setDocFn){
    return { ok:false, reason:navigator.onLine ? 'firebase_unavailable' : 'offline' };
  }
  const catalogues = Array.isArray(store && store.catalogues) ? store.catalogues : [];
  const versions = Array.isArray(store && store.versions) ? store.versions : [];
  const records = Array.isArray(store && store.records) ? store.records : [];

  try{
    for(const catalogue of catalogues){
      const id = String(catalogue && catalogue.id || '').trim();
      if(!id) continue;
      await setDocFn(docFn(db, 'users', currentUser.uid, 'equipmentCatalogues', id), normalizeEquipmentCloudRecord(catalogue), { merge:true });
    }
    for(const version of versions){
      const id = String(version && version.id || '').trim();
      if(!id) continue;
      await setDocFn(docFn(db, 'users', currentUser.uid, 'equipmentCatalogueVersions', id), normalizeEquipmentCloudRecord(version), { merge:true });
    }
    for(const record of records){
      const id = String(record && record.id || '').trim();
      if(!id || record.sampleData) continue;
      await setDocFn(docFn(db, 'users', currentUser.uid, 'equipmentRecords', id), normalizeEquipmentCloudRecord(record), { merge:true });
    }
    return {
      ok:true,
      ownerId:currentUser.uid,
      catalogues:catalogues.length,
      versions:versions.length,
      records:records.filter((record) => record && !record.sampleData).length
    };
  }catch(err){
    console.warn('[AirCalc] Equipment catalogue cloud save failed:', err);
    return {
      ok:false,
      reason:navigator.onLine ? 'write_failed' : 'offline',
      error:(err && err.message) ? err.message : String(err || '')
    };
  }
}

async function loadEquipmentCatalogueFromCloud(options = {}){
  const silent = options && options.silent === true;
  if(!silent && !requireLoginForCloudFeature()) return { ok:false, reason:'login_required', catalogues:[], versions:[], records:[] };
  const ready = await ensureFirebase({ silent:true });
  if(!ready || !db || !currentUser || !collectionFn || !getDocsFn){
    return { ok:false, reason:navigator.onLine ? 'firebase_unavailable' : 'offline', catalogues:[], versions:[], records:[] };
  }
  async function readCollection(name){
    const ref = collectionFn(db, 'users', currentUser.uid, name);
    const snap = await getDocsFn(ref);
    const rows = [];
    snap.forEach((docSnap) => {
      rows.push({ id:docSnap.id, ...(docSnap.data() || {}) });
    });
    return rows;
  }
  try{
    return {
      ok:true,
      catalogues:await readCollection('equipmentCatalogues'),
      versions:await readCollection('equipmentCatalogueVersions'),
      records:await readCollection('equipmentRecords')
    };
  }catch(err){
    console.warn('[AirCalc] Equipment catalogue cloud load failed:', err);
    return {
      ok:false,
      reason:navigator.onLine ? 'read_failed' : 'offline',
      error:(err && err.message) ? err.message : String(err || ''),
      catalogues:[],
      versions:[],
      records:[]
    };
  }
}

async function publishSharedProject(project){
  if(!requireLoginForCloudFeature()) return { ok:false, reason:'login_required' };
  const ready = await ensureFirebase({ silent:true });
  if(!ready || !db || !currentUser || !docFn || !setDocFn){
    return { ok:false, reason:navigator.onLine ? 'firebase_unavailable' : 'offline' };
  }
  if(!project || typeof project !== 'object') return { ok:false, reason:'invalid_project' };

  const projectId = String(project.cloudId || project.id || '').trim();
  if(!projectId) return { ok:false, reason:'missing_project_id' };

  const existing = project.collaboration && typeof project.collaboration === 'object'
    ? project.collaboration
    : {};
  const roles = normalizeCollaborationRoles(existing.roles, currentUser.uid);
  const collaboration = {
    ownerId: currentUser.uid,
    ownerEmail: currentUser.email || '',
    visibility: 'shared',
    roles,
    updatedBy: currentUser.uid
  };
  const ref = docFn(db, 'sharedProjects', projectId);
  const payload = {
    id: project.id || projectId,
    cloudId: projectId,
    name: String(project.name || '').trim(),
    ownerId: currentUser.uid,
    ownerEmail: currentUser.email || '',
    role: PROJECT_ROLES.OWNER,
    collaboration,
    status: project.status || 'active',
    localUpdatedAt: project.updatedAt || '',
    updatedAt: serverTimestampFn(),
    lastSyncedAt: serverTimestampFn(),
    projectUrl: buildProjectLink(projectId),
    schemaVersion: 1,
    snapshot: project.snapshot || {}
  };

  try{
    await setDocFn(ref, payload, { merge:true });
    return { ok:true, cloudId:projectId, collaboration, projectUrl:payload.projectUrl };
  }catch(err){
    console.warn('[AirCalc] Shared project publish failed:', err);
    return {
      ok:false,
      reason:navigator.onLine ? 'write_failed' : 'offline',
      error:(err && err.message) ? err.message : String(err || '')
    };
  }
}

async function updateSharedProjectRole(projectId, userId, role){
  if(!requireLoginForCloudFeature()) return { ok:false, reason:'login_required' };
  const ready = await ensureFirebase({ silent:true });
  if(!ready || !db || !currentUser || !docFn || !getDocFn || !setDocFn){
    return { ok:false, reason:navigator.onLine ? 'firebase_unavailable' : 'offline' };
  }
  const cleanProjectId = String(projectId || '').trim();
  const cleanUserId = String(userId || '').trim();
  if(!cleanProjectId || !cleanUserId) return { ok:false, reason:'missing_ids' };
  const normalizedRole = normalizeProjectRole(role);
  const ref = docFn(db, 'sharedProjects', cleanProjectId);

  try{
    const snap = await getDocFn(ref);
    if(!snap || !snap.exists()) return { ok:false, reason:'project_not_found' };
    const data = snap.data() || {};
    if(data.ownerId !== currentUser.uid) return { ok:false, reason:'owner_required' };
    const collaboration = data.collaboration && typeof data.collaboration === 'object'
      ? data.collaboration
      : {};
    const roles = normalizeCollaborationRoles(collaboration.roles, currentUser.uid);
    roles[cleanUserId] = normalizedRole;
    await setDocFn(ref, {
      collaboration: {
        ownerId: currentUser.uid,
        ownerEmail: currentUser.email || data.ownerEmail || '',
        visibility: 'shared',
        roles,
        updatedBy: currentUser.uid
      },
      updatedAt: serverTimestampFn()
    }, { merge:true });
    return { ok:true, projectId:cleanProjectId, userId:cleanUserId, role:normalizedRole };
  }catch(err){
    console.warn('[AirCalc] Shared role update failed:', err);
    return {
      ok:false,
      reason:navigator.onLine ? 'write_failed' : 'offline',
      error:(err && err.message) ? err.message : String(err || '')
    };
  }
}

function bindAuthUI(){
  ['topbar-account-btn','auth-open-btn'].forEach(id => {
    const button=GG(id);
    if(button) button.onclick = event => { event.preventDefault(); openAuthModal(); };
  });
  const signInTab = GG('auth-tab-signin');
  const createTab = GG('auth-tab-create');
  const primaryBtn = GG('auth-primary-btn');
  const forgotBtn = GG('auth-forgot-btn');
  const logoutBtn = GG('auth-logout-modal-btn');
  const laterBtn = GG('auth-later-btn');

  if(signInTab) signInTab.addEventListener('click', () => setAuthMode('signin'));
  if(createTab) createTab.addEventListener('click', () => setAuthMode('create'));
  if(primaryBtn) primaryBtn.onclick = handlePrimaryAuth;
  if(forgotBtn) forgotBtn.addEventListener('click', handleForgotPassword);
  if(logoutBtn) logoutBtn.addEventListener('click', logoutAuth);
  if(laterBtn) laterBtn.addEventListener('click', () => closeAuthModal());
  const overlay = GG('auth-overlay');
  if(overlay) overlay.addEventListener('keydown', (event) => {
    if(event.key === 'Escape'){ event.preventDefault(); closeAuthModal(); }
    if(event.key === 'Enter' && event.target.matches('input')){ event.preventDefault(); handlePrimaryAuth(); }
    if(event.key === 'Tab'){
      const elements = [...overlay.querySelectorAll('button, input, a[href]')].filter(el => !el.disabled && el.getClientRects().length);
      const first = elements[0], last = elements[elements.length - 1];
      if(event.shiftKey && document.activeElement === first){ event.preventDefault(); last.focus(); }
      else if(!event.shiftKey && document.activeElement === last){ event.preventDefault(); first.focus(); }
    }
  });
}

window.openAuthModal = openAuthModal;
window.showAirCalcAccount = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.logoutAuth = logoutAuth;
window.submitAirCalcAuth = handlePrimaryAuth;
window.requireLoginForCloudFeature = requireLoginForCloudFeature;
window.saveProjectToCloud = saveProjectToCloud;
window.loadUserProjectsFromCloud = loadUserProjectsFromCloud;
window.saveEquipmentCatalogueToCloud = saveEquipmentCatalogueToCloud;
window.loadEquipmentCatalogueFromCloud = loadEquipmentCatalogueFromCloud;
window.AppAuth = {
  openAuthModal: openAuthModalWithContext,
  closeAuthModal,
  logoutAuth,
  updateAuthUI,
  requireLoginForCloudFeature,
  saveProjectToCloud,
  loadUserProjectsFromCloud,
  saveEquipmentCatalogueToCloud,
  loadEquipmentCatalogueFromCloud,
  publishSharedProject,
  updateSharedProjectRole,
  getCurrentUser: () => currentUser,
  getCurrentProfile: () => currentProfile,
  isSignedIn: () => !!currentUser,
  hasProEarlyAccess: () => !!currentUser
};
window.AppProjectRoles = {
  PROJECT_ROLES,
  normalizeProjectRole,
  canEditProjectRole,
  canViewProjectRole,
  normalizeCollaborationRoles
};

function initAccount(){
  const actions = document.querySelector('.desktop-topbar-actions');
  if(actions && !GG('topbar-account-btn')){
    const button = document.createElement('button');
    button.id = 'topbar-account-btn';
    button.type = 'button';
    button.className = 'desktop-topbar-btn icon-only';
    button.setAttribute('aria-haspopup', 'dialog');
    button.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg>';
    button.addEventListener('click', openAuthModal);
    actions.prepend(button);
  }
  const sheet = document.querySelector('#auth-overlay .auth-sheet');
  if(sheet){
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-labelledby', 'auth-modal-title');
    const message = document.createElement('p');
    message.id = 'auth-message';
    message.setAttribute('role', 'alert');
    message.hidden = true;
    GG('auth-helper-note').after(message);
    const close = sheet.querySelector('.upgrade-sheet-close');
    if(close){ close.textContent = '\u00d7'; close.setAttribute('aria-label', 'Close'); }
    ['email','password','fullname','confirm'].forEach(name => {
      GG('auth-' + name).setAttribute('aria-labelledby', 'auth-' + name + '-lbl');
    });
  }
  bindAuthUI();
  updateAuthUI();
  ensureFirebase({ silent:true }).then(() => {
    updateAuthUI();
    notifyPlanDependents();
  });
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAccount, {once:true});
else initAccount();
})();
