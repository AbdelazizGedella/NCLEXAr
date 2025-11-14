// يعتمد على firebase + db + showToast من login.js

function parseIsoDate(str) {
  if (!str) return null;
  // نتوقع صيغة YYYY-MM-DD
  const d = new Date(str.trim());
  if (isNaN(d.getTime())) return null;
  return d;
}

function checkUworldAccess() {
  const auth = firebase.auth();
  const db   = firebase.firestore();

  const deniedBox = document.getElementById('uworldDenied');
  const deniedMsg = document.getElementById('uworldDeniedMsg');
  const area      = document.getElementById('uworldArea');

  const showDenied = (msg) => {
    if (area) area.classList.add('hidden');
    if (deniedBox) {
      deniedBox.classList.remove('hidden');
      if (deniedMsg && msg) deniedMsg.textContent = msg;
    }
  };

  const showAllowed = () => {
    if (deniedBox) deniedBox.classList.add('hidden');
    if (area) area.classList.remove('hidden');
  };

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      // مش مسجل دخول
      window.location.href = "Login.html";
      return;
    }

    try {
      // نجيب رابط الـ sheet من config/uworldAccess
      const cfgSnap = await db.collection('config').doc('uworldAccess').get();
      if (!cfgSnap.exists) {
        showDenied("إعدادات الاشتراك غير موجودة. تواصل مع الأدمن.");
        return;
      }

      const data = cfgSnap.data();
      const subsCsvUrl = data.subsCsvUrl;
      if (!subsCsvUrl) {
        showDenied("رابط قائمة الاشتراكات غير مضبوط. تواصل مع الأدمن.");
        return;
      }

      const res = await fetch(subsCsvUrl);
      const csvText = await res.text();

      const parsed = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true
      });

      const userEmail = (user.email || "").trim().toLowerCase();

      const row = parsed.data.find(r =>
        (r.email || "").trim().toLowerCase() === userEmail
      );

      if (!row) {
        showDenied("لا يوجد اشتراك مرتبط بهذا الإيميل. تواصل مع الأدمن لو شايف إن في خطأ.");
        return;
      }

      const expiry = parseIsoDate(row.expire_date);
      if (!expiry) {
        showDenied("تاريخ انتهاء الاشتراك غير مضبوط. تواصل مع الأدمن.");
        return;
      }

      const today = new Date();
      // نخلي التوقيت لمنتصف اليوم للتسهيل
      expiry.setHours(23,59,59,999);

      if (expiry < today) {
        showDenied("اشتراكك منتهي. برجاء التواصل مع الأدمن لتجديده.");
        return;
      }

      // هنا الاشتراك فعّال 🎉
      showAllowed();
      showToast('success', "اشتراك Uworld فعّال ✅");

      // لو هتستخدم رابط تاني لبيانات Uworld ممكن تخزنه في window:
      if (data.uworldCsvUrl) {
        window.UWORLD_CSV_URL = data.uworldCsvUrl;
      }

    } catch (err) {
      console.error(err);
      showDenied("حدث خطأ أثناء فحص الاشتراك. حاول مرة أخرى لاحقًا.");
    }
  });
}

// شغّل الفحص أول ما الصفحة تحمل
document.addEventListener('DOMContentLoaded', checkUworldAccess);
