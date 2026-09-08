/**
 * Surat Izin Sekolah - Main Application Engine
 * Integrated Cloud Database (Supabase) + SPA Client Routing Engine
 * Senior Full-Stack Architecture
 */

'use strict';

// 1. Inisialisasi Supabase Client
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co'; // Ganti dengan Supabase URL Anda
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';                 // Ganti dengan Supabase Anon Key Anda
let supabase = null;

if (typeof window.supabase !== 'undefined' && !SUPABASE_URL.includes('YOUR_PROJECT_ID')) {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Global State
const AppState = {
  currentSlug: '',
  currentLetterData: null,
  isCustomSlugEdited: false
};

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initEventListeners();
  initFormListeners();
  handleRoute();
});

/* ==========================================================================
   1. Theme Management
   ========================================================================== */
function initTheme() {
  const savedTheme = localStorage.getItem('sis_theme') || 'light';
  document.body.classList.toggle('dark-theme', savedTheme === 'dark');
  document.body.classList.toggle('light-theme', savedTheme !== 'dark');
}

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark-theme');
  document.body.classList.toggle('light-theme', !isDark);
  localStorage.setItem('sis_theme', isDark ? 'dark' : 'light');
}

/* ==========================================================================
   2. URL & SPA Routing Engine (Supabase Integrated)
   ========================================================================== */
function getDynamicOrigin() {
  return window.location.origin;
}

function navigateTo(path) {
  window.history.pushState({}, '', path);
  handleRoute();
}

window.addEventListener('popstate', handleRoute);

async function handleRoute() {
  const path = window.location.pathname;
  const slug = path.replace(/^\/+|\/+$/g, '');

  hideAllPages();

  if (slug === '' || slug === 'index.html') {
    showPage('page-home');
    document.title = 'Surat Izin Sekolah — Buat Surat Izin dengan Mudah';
  } else if (slug === 'buat') {
    showPage('page-form');
    document.title = 'Buat Surat Izin Sekolah';
    resetForm();
  } else {
    showLoading('Mengambil data surat...');
    const letterData = await loadLetterData(slug);
    hideLoading();

    if (letterData) {
      AppState.currentSlug = slug;
      AppState.currentLetterData = letterData;
      renderLetterPreview(letterData);
      showPage('page-preview');
      document.title = `Surat Izin — ${letterData.studentName}`;
    } else {
      showPage('page-not-found');
      document.title = 'Surat Tidak Ditemukan';
    }
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showPage(pageId) {
  document.querySelectorAll('.page-section').forEach(section => {
    section.classList.remove('active');
  });
  const pageElement = document.getElementById(pageId);
  if (pageElement) pageElement.classList.add('active');
}

function hideAllPages() {
  document.querySelectorAll('.page-section').forEach(section => {
    section.classList.remove('active');
  });
}

/* ==========================================================================
   3. Cloud & Local Data Engine (Nomor 3 & 4 Combined)
   ========================================================================== */

// NOMOR 3: SIMPAN DATA KE SUPABASE CLOUD & LOCAL CACHE
async function saveLetterData(slug, data) {
  // 1. Simpan ke LocalStorage sebagai cadangan lokal
  localStorage.setItem(`surat_${slug}`, JSON.stringify(data));

  // 2. Simpan ke Supabase Cloud
  if (supabase) {
    const { error } = await supabase
      .from('surat_izin')
      .upsert({
        slug: slug,
        student_name: data.studentName,
        payload: data
      }, { onConflict: 'slug' });

    if (error) {
      console.error('Supabase Save Error:', error.message);
      throw error;
    }
  }
}

// NOMOR 4: AMBIL DATA DARIPADA SUPABASE CLOUD (GURU / ORANG LAIN)
async function loadLetterData(slug) {
  // A. Coba dari Cloud Database Supabase First
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('surat_izin')
        .select('payload')
        .eq('slug', slug)
        .single();

      if (!error && data && data.payload) {
        localStorage.setItem(`surat_${slug}`, JSON.stringify(data.payload));
        return data.payload;
      }
    } catch (err) {
      console.warn('Gagal membaca dari Supabase, beralih ke cache lokal...', err);
    }
  }

  // B. Fallback Cache Local Storage
  const rawLocal = localStorage.getItem(`surat_${slug}`);
  if (rawLocal) {
    try {
      return JSON.parse(rawLocal);
    } catch (err) {
      return null;
    }
  }

  return null;
}

/* ==========================================================================
   4. Event Listeners Initialization
   ========================================================================== */
function initEventListeners() {
  document.getElementById('brand-logo').addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo('/');
  });
  document.getElementById('btn-nav-home').addEventListener('click', () => navigateTo('/'));
  document.getElementById('btn-nav-create').addEventListener('click', () => navigateTo('/buat'));
  document.getElementById('btn-hero-create').addEventListener('click', () => navigateTo('/buat'));
  document.getElementById('btn-404-create').addEventListener('click', () => navigateTo('/buat'));
  
  document.getElementById('btn-theme-toggle').addEventListener('click', toggleTheme);

  document.getElementById('btn-nav-about').addEventListener('click', () => toggleModal('modal-about', true));
  document.getElementById('btn-about-ok').addEventListener('click', () => toggleModal('modal-about', false));

  document.getElementById('btn-edit-letter').addEventListener('click', handleEditLetter);
  
  document.getElementById('btn-download-pdf').addEventListener('click', () => exportPDF());
  document.getElementById('btn-download-png').addEventListener('click', () => exportImage('png'));

  document.getElementById('btn-share-link').addEventListener('click', shareLetter);
  document.getElementById('btn-copy-link').addEventListener('click', copyLetterLink);

  document.getElementById('btn-close-share').addEventListener('click', () => toggleModal('modal-share', false));
  document.getElementById('share-wa').addEventListener('click', shareToWhatsApp);
  document.getElementById('share-tg').addEventListener('click', shareToTelegram);
}

/* ==========================================================================
   5. Form Management & Form Processing
   ========================================================================== */
function initFormListeners() {
  const studentNameInput = document.getElementById('studentName');
  const userSlugInput = document.getElementById('userSlug');
  const reasonTypeSelect = document.getElementById('reasonType');
  const customReasonBox = document.getElementById('custom-reason-container');
  const letterForm = document.getElementById('letter-form');
  const authorTypeRadios = document.querySelectorAll('input[name="authorType"]');

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('letterDate').value = today;
  document.getElementById('startDate').value = today;
  document.getElementById('endDate').value = today;

  authorTypeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      updateAuthorTypeUI(e.target.value);
    });
  });

  studentNameInput.addEventListener('input', (e) => {
    if (!AppState.isCustomSlugEdited) {
      const slug = generateSlug(e.target.value);
      userSlugInput.value = slug;
      updateSlugPreview(slug);
    }
  });

  userSlugInput.addEventListener('input', (e) => {
    AppState.isCustomSlugEdited = true;
    const formattedSlug = generateSlug(e.target.value);
    e.target.value = formattedSlug;
    updateSlugPreview(formattedSlug);
  });

  reasonTypeSelect.addEventListener('change', (e) => {
    if (e.target.value === 'Lainnya') {
      customReasonBox.classList.remove('hidden');
    } else {
      customReasonBox.classList.add('hidden');
    }
  });

  letterForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (validateForm()) {
      await processAndSaveForm();
    } else {
      showToast('Data belum lengkap. Silakan periksa formulir.', 'error');
    }
  });
}

function updateAuthorTypeUI(authorType) {
  const parentGroup = document.getElementById('parent-info-group');
  const parentNameInput = document.getElementById('parentName');
  const labelParent = document.getElementById('label-author-parent');
  const labelStudent = document.getElementById('label-author-student');

  if (authorType === 'siswa') {
    parentGroup.classList.add('hidden');
    parentNameInput.removeAttribute('required');
    labelStudent.classList.add('active');
    labelParent.classList.remove('active');
  } else {
    parentGroup.classList.remove('hidden');
    parentNameInput.setAttribute('required', 'true');
    labelParent.classList.add('active');
    labelStudent.classList.remove('active');
  }
}

function generateSlug(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

function updateSlugPreview(slug) {
  const displaySlug = slug || 'rizki-hermawan';
  document.getElementById('slug-preview-text').textContent = `${getDynamicOrigin()}/${displaySlug}`;
}

function validateForm() {
  let isValid = true;
  const fields = ['studentName', 'studentClass', 'homeroomTeacher', 'schoolName', 'cityName', 'letterDate', 'startDate', 'endDate', 'userSlug'];
  
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (!el.value.trim()) {
      el.style.borderColor = 'red';
      isValid = false;
    } else {
      el.style.borderColor = '';
    }
  });

  return isValid;
}

function resetForm() {
  document.getElementById('letter-form').reset();
  AppState.isCustomSlugEdited = false;
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('letterDate').value = today;
  document.getElementById('startDate').value = today;
  document.getElementById('endDate').value = today;
  document.getElementById('custom-reason-container').classList.add('hidden');
  updateSlugPreview('');
}

async function processAndSaveForm() {
  showLoading('Menyimpan surat ke database...');

  try {
    const authorType = document.querySelector('input[name="authorType"]:checked').value;
    const reasonType = document.getElementById('reasonType').value;
    const customReason = document.getElementById('customReason').value;
    const finalReason = (reasonType === 'Lainnya') ? customReason : reasonType;

    const slug = document.getElementById('userSlug').value || 'surat-izin';

    const formData = {
      slug: slug,
      authorType: authorType,
      studentName: document.getElementById('studentName').value,
      studentClass: document.getElementById('studentClass').value,
      homeroomTeacher: document.getElementById('homeroomTeacher').value,
      schoolName: document.getElementById('schoolName').value,
      cityName: document.getElementById('cityName').value,
      letterDate: document.getElementById('letterDate').value,
      startDate: document.getElementById('startDate').value,
      endDate: document.getElementById('endDate').value,
      reasonType: reasonType,
      customReason: customReason,
      finalReason: finalReason,
      parentName: authorType === 'orangtua' ? document.getElementById('parentName').value : '',
      parentRelation: authorType === 'orangtua' ? document.getElementById('parentRelation').value : '',
      createdAt: new Date().toISOString()
    };

    await saveLetterData(slug, formData);
    
    hideLoading();
    showToast('Surat berhasil dibuat & tersimpan di cloud!', 'success');
    navigateTo(`/${slug}`);

  } catch (err) {
    hideLoading();
    console.error(err);
    showToast('Gagal menyimpan surat. Pastikan koneksi/API Supabase benar.', 'error');
  }
}

/* ==========================================================================
   6. Render & PDF / Export Logic
   ========================================================================== */
function formatIndonesianDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function formatDateRange(startDateStr, endDateStr) {
  const start = formatIndonesianDate(startDateStr);
  const end = formatIndonesianDate(endDateStr);
  return (startDateStr === endDateStr) ? start : `${start} s.d. ${end}`;
}

function renderLetterPreview(data) {
  document.getElementById('view-recipient-class').textContent = data.studentClass;
  document.getElementById('view-school-name').textContent = data.schoolName;
  document.getElementById('view-student-name').textContent = data.studentName;
  document.getElementById('view-student-class').textContent = data.studentClass;
  document.getElementById('view-homeroom-teacher').textContent = data.homeroomTeacher;
  document.getElementById('view-permit-date').textContent = formatDateRange(data.startDate, data.endDate);
  document.getElementById('view-reason').textContent = data.finalReason;
  document.getElementById('view-city').textContent = data.cityName;
  document.getElementById('view-letter-date').textContent = formatIndonesianDate(data.letterDate);

  const introEl = document.getElementById('view-intro-text');
  const signatureTitleEl = document.getElementById('view-signature-title');
  const signerNameEl = document.getElementById('view-signer-name');

  if (data.authorType === 'siswa') {
    introEl.textContent = 'Saya yang bertanda tangan di bawah ini:';
    signatureTitleEl.textContent = 'Siswa yang Bersangkutan';
    signerNameEl.textContent = data.studentName;
  } else {
    introEl.textContent = 'Saya yang bertanda tangan di bawah ini, selaku orang tua/wali dari siswa:';
    signatureTitleEl.textContent = 'Orang Tua / Wali Siswa';
    signerNameEl.textContent = data.parentName || 'Orang Tua/Wali';
  }
}

function handleEditLetter() {
  if (!AppState.currentLetterData) return;
  const d = AppState.currentLetterData;
  navigateTo('/buat');

  document.getElementById('studentName').value = d.studentName || '';
  document.getElementById('studentClass').value = d.studentClass || '';
  document.getElementById('homeroomTeacher').value = d.homeroomTeacher || '';
  document.getElementById('schoolName').value = d.schoolName || '';
  document.getElementById('cityName').value = d.cityName || '';
  document.getElementById('userSlug').value = d.slug || '';
  AppState.isCustomSlugEdited = true;
}

async function exportPDF() {
  const element = document.getElementById('letter-paper');
  if (!element) return;
  showLoading('Menyiapkan file PDF...');
  try {
    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL('image/jpeg', 1.0);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    pdf.addImage(imgData, 'JPEG', 0, 0, 210, (canvas.height * 210) / canvas.width);
    pdf.save(`surat-izin-${AppState.currentSlug}.pdf`);
    showToast('Berhasil mendownload PDF!', 'success');
  } catch (err) {
    showToast('Gagal export PDF', 'error');
  } finally {
    hideLoading();
  }
}

async function exportImage(format) {
  const element = document.getElementById('letter-paper');
  if (!element) return;
  showLoading('Menyiapkan Gambar...');
  try {
    const canvas = await html2canvas(element, { scale: 2 });
    const link = document.createElement('a');
    link.href = canvas.toDataURL(`image/${format}`);
    link.download = `surat-izin-${AppState.currentSlug}.${format}`;
    link.click();
    showToast('Berhasil mendownload Gambar!', 'success');
  } catch (err) {
    showToast('Gagal export Gambar', 'error');
  } finally {
    hideLoading();
  }
}

/* ==========================================================================
   7. Sharing & Toast Utilities
   ========================================================================== */
function shareLetter() {
  const url = `${getDynamicOrigin()}/${AppState.currentSlug}`;
  document.getElementById('share-url-input').value = url;
  toggleModal('modal-share', true);
}

function copyLetterLink() {
  const urlInput = document.getElementById('share-url-input');
  navigator.clipboard.writeText(urlInput.value);
  showToast('Link berhasil disalin!', 'success');
  toggleModal('modal-share', false);
}

function shareToWhatsApp() {
  const url = `${getDynamicOrigin()}/${AppState.currentSlug}`;
  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent('Berikut Surat Izin Sekolah: ' + url)}`, '_blank');
}

function shareToTelegram() {
  const url = `${getDynamicOrigin()}/${AppState.currentSlug}`;
  window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}`, '_blank');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function showLoading(text) {
  document.getElementById('loading-text').textContent = text || 'Memproses...';
  document.getElementById('loading-overlay').classList.add('active');
}

function hideLoading() {
  document.getElementById('loading-overlay').classList.remove('active');
}

function toggleModal(modalId, show) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.toggle('active', show);
}