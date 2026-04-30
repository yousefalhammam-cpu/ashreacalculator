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

let createUserWithEmailAndPasswordFn = null;
let signInWithEmailAndPasswordFn = null;
let signOutFn = null;
let onAuthStateChangedFn = null;
let sendPasswordResetEmailFn = null;
let updateProfileFn = null;
let docFn = null;
let setDocFn = null;
let getDocFn = null;
let serverTimestampFn = null;

function GG(id){ return document.getElementById(id); }
function isAr(){ return (window.lang || 'ar') === 'ar'; }
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
function notifyPlanDependents(){
  try{
    if(typeof window.updatePlanUI === 'function') window.updatePlanUI();
    if(typeof window.renderProjects === 'function') window.renderProjects();
    if(typeof window.updateNavDots === 'function') window.updateNavDots();
  }catch(e){}
}

function setAuthMode(mode){
  authMode = mode === 'create' ? 'create' : 'signin';
  updateAuthUI();
}

function updateAuthUI(){
  const loggedIn = !!currentUser;
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
  const defaultSub = tt('authgueststatus', 'Sign in to unlock PRO for free');
  const modalTitleText = (!loggedIn && proUnlockContext) ? unlockTitle : defaultTitle;
  const modalSubText = (!loggedIn && proUnlockContext) ? unlockSub : defaultSub;

  if(openBtn){
    openBtn.textContent = loggedIn
      ? tt('authearlypro', 'PRO Early Access')
      : tt('authsigninunlock', 'Sign in / Unlock PRO for Free');
  }
  if(statusSub){
    statusSub.textContent = loggedIn
      ? `${tt('authloggedin', 'Signed in as')} ${getDisplayName(currentUser)}`
      : tt('authgueststatus', 'Sign in to unlock PRO for free');
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
    primaryBtn.disabled = loggedIn;
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
      ? tt('authearlypromsg', 'PRO features are free during Early Access.')
      : tt('authcloudreq', 'Login required for PRO features and cloud saving');
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
  const silent = options && options.silent === true;
  if(firebaseReady) return true;
  try{
    const appMod = await import('https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js');
    const authMod = await import('https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js');
    const fsMod = await import('https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js');

    const app = appMod.initializeApp(firebaseConfig);
    auth = authMod.getAuth(app);
    db = fsMod.getFirestore(app);

    createUserWithEmailAndPasswordFn = authMod.createUserWithEmailAndPassword;
    signInWithEmailAndPasswordFn = authMod.signInWithEmailAndPassword;
    signOutFn = authMod.signOut;
    onAuthStateChangedFn = authMod.onAuthStateChanged;
    sendPasswordResetEmailFn = authMod.sendPasswordResetEmail;
    updateProfileFn = authMod.updateProfile;

    docFn = fsMod.doc;
    setDocFn = fsMod.setDoc;
    getDocFn = fsMod.getDoc;
    serverTimestampFn = fsMod.serverTimestamp;

    firebaseReady = true;
    onAuthStateChangedFn(auth, async (user) => {
      currentUser = user || null;
      currentProfile = null;
      if(currentUser){
        await updateUserLoginRecord(currentUser).catch(() => {});
        currentProfile = await loadUserProfileDoc(currentUser).catch(() => null);
      }
      updateAuthUI();
      notifyPlanDependents();
    });
    return true;
  }catch(err){
    console.warn('[AirCalc] Firebase auth unavailable:', err);
    firebaseReady = false;
    if(!silent){
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
  if(currentUser) return;
  const ready = await ensureFirebase();
  if(!ready) return;

  const fullName = (GG('auth-fullname')?.value || '').trim();
  const email = (GG('auth-email')?.value || '').trim();
  const password = GG('auth-password')?.value || '';
  const confirm = GG('auth-confirm')?.value || '';

  if(authMode === 'create' && !fullName){
    toastMsg(tt('authfullname_req', 'Full name is required'));
    return;
  }
  if(!validEmail(email)){
    toastMsg(tt('authemail_invalid', 'Enter a valid email address'));
    return;
  }
  if(password.length < 8){
    toastMsg(tt('authpassword_min', 'Password must be at least 8 characters'));
    return;
  }
  if(authMode === 'create' && password !== confirm){
    toastMsg(tt('authconfirm_mismatch', 'Confirm password does not match'));
    return;
  }

  try{
    if(authMode === 'create'){
      const cred = await createUserWithEmailAndPasswordFn(auth, email, password);
      if(cred && cred.user){
        await updateProfileFn(cred.user, { displayName: fullName });
        await createUserProfileDoc(cred.user, fullName);
        currentProfile = await loadUserProfileDoc(cred.user).catch(() => null);
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
        await updateUserLoginRecord(cred.user);
        currentProfile = await loadUserProfileDoc(cred.user).catch(() => null);
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
    const msg = (err && err.message) ? err.message : tt('authfirebase_unavailable', 'Account service is unavailable right now');
    toastMsg(msg);
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
  updateAuthUI();
  openOverlay('auth-overlay');
}

function openAuthModalWithContext(options){
  proUnlockContext = options && options.proUnlock ? {
    featureKey: options.featureKey || ''
  } : null;
  updateAuthUI();
  openOverlay('auth-overlay');
}

function closeAuthModal(e){
  if(e && e.target !== GG('auth-overlay')) return;
  proUnlockContext = null;
  closeOverlay('auth-overlay');
}

function requireLoginForCloudFeature(){
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
  if(!requireLoginForCloudFeature()) return false;
  toastMsg(tt('authcloudcoming', 'Cloud saving is coming soon'));
  return { ok:false, reason:'coming_soon', project:project || null };
}

async function loadUserProjectsFromCloud(){
  if(!requireLoginForCloudFeature()) return [];
  toastMsg(tt('authcloudcoming', 'Cloud saving is coming soon'));
  return [];
}

function bindAuthUI(){
  const signInTab = GG('auth-tab-signin');
  const createTab = GG('auth-tab-create');
  const primaryBtn = GG('auth-primary-btn');
  const forgotBtn = GG('auth-forgot-btn');
  const logoutBtn = GG('auth-logout-modal-btn');
  const laterBtn = GG('auth-later-btn');

  if(signInTab) signInTab.addEventListener('click', () => setAuthMode('signin'));
  if(createTab) createTab.addEventListener('click', () => setAuthMode('create'));
  if(primaryBtn) primaryBtn.addEventListener('click', handlePrimaryAuth);
  if(forgotBtn) forgotBtn.addEventListener('click', handleForgotPassword);
  if(logoutBtn) logoutBtn.addEventListener('click', logoutAuth);
  if(laterBtn) laterBtn.addEventListener('click', closeAuthModal);
}

window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.logoutAuth = logoutAuth;
window.requireLoginForCloudFeature = requireLoginForCloudFeature;
window.saveProjectToCloud = saveProjectToCloud;
window.loadUserProjectsFromCloud = loadUserProjectsFromCloud;
window.AppAuth = {
  openAuthModal: openAuthModalWithContext,
  closeAuthModal,
  logoutAuth,
  updateAuthUI,
  requireLoginForCloudFeature,
  saveProjectToCloud,
  loadUserProjectsFromCloud,
  getCurrentUser: () => currentUser,
  getCurrentProfile: () => currentProfile,
  isSignedIn: () => !!currentUser,
  hasProEarlyAccess: () => !!currentUser
};

document.addEventListener('DOMContentLoaded', () => {
  bindAuthUI();
  updateAuthUI();
  ensureFirebase({ silent:true }).then(() => {
    updateAuthUI();
    notifyPlanDependents();
  });
});
