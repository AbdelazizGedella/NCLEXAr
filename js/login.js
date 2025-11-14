// نفس الـ config بتاعك
const firebaseConfig = {
  apiKey: "AIzaSyCByQute9IKG_2nvSFWcAThgEH7PKIhMDw",
  authDomain: "ctwo-eee79.firebaseapp.com",
  projectId: "ctwo-eee79",
  storageBucket: "ctwo-eee79.appspot.com",
  messagingSenderId: "788657051205",
  appId: "1:788657051205:web:5d4b6884a0ca09e4cb352c",
  measurementId: "G-4VTCQR4ZVR"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db   = firebase.firestore();

// نفس showToast اللي عملناه قبل كده
function showToast(type, message) {
  const container = document.getElementById('toastContainer');
  if (!container) { alert(message); return; }

  const toast = document.createElement('div');
  toast.className =
    'alert shadow-lg max-w-sm ' +
    (type === 'success' ? 'alert-success' :
     type === 'error'   ? 'alert-error'   :
                          'alert-info');

  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'transition');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Login
function login() {
  const emailInput    = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  if (!emailInput || !passwordInput) return;

  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  if (!email || !password) {
    showToast('error', "من فضلك أدخل الإيميل والباسورد.");
    return;
  }

  const btn = document.getElementById('btnLogin');
  if (btn) { btn.disabled = true; btn.classList.add('loading'); }

  auth.signInWithEmailAndPassword(email, password)
    .then((cred) => {
      const user = cred.user;
      // نحدّث آخر Login في UworldUsers (لو موجود)
      db.collection('UworldUsers').doc(user.uid).set({
        lastLoginAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true }).catch(() => {});

      showToast('success', "تم تسجيل الدخول بنجاح ✅");
      window.location.href = "index.html";
    })
    .catch((error) => {
      showToast('error', "Login failed: " + error.message);
    })
    .finally(() => {
      if (btn) { btn.disabled = false; btn.classList.remove('loading'); }
    });
}

// Signup
function signup() {
  const nameEl  = document.getElementById("signupName");
  const emailEl = document.getElementById("signupEmail");
  const passEl  = document.getElementById("signupPassword");

  if (!nameEl || !emailEl || !passEl) return;

  const name  = nameEl.value.trim();
  const email = emailEl.value.trim().toLowerCase();
  const password = passEl.value;

  if (!name || !email || !password) {
    showToast('error', "من فضلك أكمل كل البيانات.");
    return;
  }

  if (password.length < 6) {
    showToast('error', "الباسورد لازم يكون 6 حروف/أرقام على الأقل.");
    return;
  }

  const btn = document.getElementById('btnSignup');
  if (btn) { btn.disabled = true; btn.classList.add('loading'); }

  auth.createUserWithEmailAndPassword(email, password)
    .then((userCredential) => {
      const user = userCredential.user;
      const uid  = user.uid;

      // نحدث الـ profile بالاسم
      const profilePromise = user.updateProfile({ displayName: name });

      // نحفظ بياناته في Collection خاصة بالـ Uworld
      const userDocPromise = db.collection('UworldUsers').doc(uid).set({
        uid,
        name,
        email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastLoginAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      return Promise.all([profilePromise, userDocPromise]);
    })
    .then(() => {
      showToast('success', "تم إنشاء الحساب بنجاح 🎉");
      // بعد التسجيل يروح للصفحة الرئيسية
      window.location.href = "index.html";
    })
    .catch((error) => {
      showToast('error', "فشل إنشاء الحساب: " + error.message);
    })
    .finally(() => {
      if (btn) { btn.disabled = false; btn.classList.remove('loading'); }
    });
}

// Reset password
function resetPassword() {
  const emailInput = document.getElementById("email");
  if (!emailInput) {
    showToast('error', "من فضلك افتح صفحة تسجيل الدخول أولاً.");
    return;
  }

  const email = emailInput.value.trim();
  if (!email) {
    showToast('error', "من فضلك أدخل الإيميل أولاً.");
    return;
  }

  auth.sendPasswordResetEmail(email)
    .then(() => {
      showToast('success', "تم إرسال رابط إعادة تعيين كلمة السر إلى بريدك الإلكتروني.");
    })
    .catch((error) => {
      showToast('error', "فشل في إرسال الرابط: " + error.message);
    });
}
