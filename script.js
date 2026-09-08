/**
 * Surat Izin Sekolah - Main Application Engine
 * Architecture: Clean Vanilla JS, Modular, Native Routing SPA Compatibility
 * Integration: Supabase Cloud Database (Async Routing & Persistence)
 */

'use strict';

// Config Supabase (Ganti dengan kredensial project Supabase Anda)
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Global Application State
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
   1. Theme Management (Light / Dark Mode)
   ========================================================================== */
function initTheme() {
  const savedTheme = localStorage.getItem('sis_theme') || 'light';
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-theme');
    document.body.classList.remove('light-theme');
  } else {
    document.body.classList.add('light-theme');
    document.body.classList.remove('dark-theme');
  }
}

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark-theme');
  document.body.classList.toggle('light-theme', !isDark);
  localStorage.setItem('sis_theme', isDark ? 'dark' : 'light');
}

/* ==========================================================================
   2. URL & SPA Routing Engine (Async Supabase Fetching)
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
      document.title = 'Surat Tidak Ditemukan — Surat Izin Sekolah';
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
   3. Event Listeners Initialization
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
  document.getElementById('btn-close-about').addEventListener('click', () => toggleModal('modal-about', false));
  document.getElementById('btn-about-ok').addEventListener('click', () => toggleModal('modal-about', false));

  document.getElementById('btn-edit-letter').addEventListener('click', handleEditLetter);
  document.getElementById('btn-new-letter').addEventListener('click', () => navigateTo('/buat'));
  
  document.getElementById('btn-download-pdf').addEventListener('click', () => exportPDF());
  document.getElementById('btn-download-png').addEventListener('click', () => exportImage('png'));
  document.getElementById('btn-download-jpg').addEventListener('click', () => exportImage('jpg'));

  document.getElementById('btn-mobile-pdf').addEventListener('click', () => exportPDF());
  document.getElementById('btn-mobile-png').addEventListener('click', () => exportImage('png'));

  document.getElementById('btn-share-link').addEventListener('click', shareLetter);
  document.getElementById('btn-mobile-share').addEventListener('click', shareLetter);
  document.getElementById('btn-copy-link').addEventListener('click', copyLetterLink);

  document.getElementById('btn-close-share').addEventListener('click', () => toggleModal('modal-share', false));
  document.getElementById('share-wa').addEventListener('click', shareToWhatsApp);
  document.getElementById('share-tg').addEventListener('click', shareToTelegram);
  document.getElementById('share-copy-modal').addEventListener('click', copyLetterLink);
}

/* ==========================================================================
   4. Form Management & Auto-Slug Engine
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
  const displaySlug = slug || 'rizki-pratama';
  const url = `${getDynamicOrigin()}/${displaySlug}`;
  document.getElementById('slug-preview-text').textContent = url;
}

function validateForm() {
  let isValid = true;
  const authorType = document.querySelector('input[name="authorType"]:checked').value;

  const fields = [
    { id: 'studentName', errId: 'err-studentName' },
    { id: 'studentClass', errId: 'err-studentClass' },
    { id: 'homeroomTeacher', errId: 'err-homeroomTeacher' },
    { id: 'schoolName', errId: 'err-schoolName' },
    { id: 'cityName', errId: 'err-cityName' },
    { id: 'letterDate', errId: 'err-letterDate' },
    { id: 'startDate', errId: 'err-startDate' },
    { id: 'endDate', errId: 'err-endDate' },
    { id: 'reasonType', errId: 'err-reasonType' },
    { id: 'userSlug', errId: 'err-userSlug' }
  ];

  if (authorType === 'orangtua') {
    fields.push({ id: 'parentName', errId: 'err-parentName' });
  }

  fields.forEach(f => {
    const el = document.getElementById(f.id);
    const parent = el.closest('.form-field');
    if (!el.value.trim()) {
      parent.classList.add('error');
      isValid = false;
    } else {
      parent.classList.remove('error');
    }
  });

  const reasonType = document.getElementById('reasonType').value;
  if (reasonType === 'Lainnya') {
    const customEl = document.getElementById('customReason');
    const customParent = customEl.closest('.form-field');
    if (!customEl.value.trim()) {
      customParent.classList.add('error');
      isValid = false;
    } else {
      customParent.classList.remove('error');
    }
  }

  return isValid;
}

function resetForm() {
  document.getElementById('letter-form').reset();
  AppState.isCustomSlugEdited = false;

  const defaultRadio = document.querySelector('input[name="authorType"][value="orangtua"]');
  if (defaultRadio) {
    defaultRadio.checked = true;
    updateAuthorTypeUI('orangtua');
  }

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('letterDate').value = today;
  document.getElementById('startDate').value = today;
  document.getElementById('endDate').value = today;
  document.getElementById('custom-reason-container').classList.add('hidden');
  updateSlugPreview('');
  
  document.querySelectorAll('.form-field').forEach(el => el.classList.remove('error'));
}

/* ==========================================================================
   5. Supabase Data Storage & Retrieval Engine
   ========================================================================== */
async function processAndSaveForm() {
  showLoading('Menyimpan ke Cloud Database...');

  try {
    const authorType = document.querySelector('input[name="authorType"]:checked').value;
    const reasonType = document.getElementById('reasonType').value;
    const customReason = document.getElementById('customReason').value;
    const finalReason = (reasonType === 'Lainnya') ? customReason : reasonType;
    const slug = document.getElementById('userSlug').value;

    const payload = {
      slug: slug,
      author_type: authorType,
      student_name: document.getElementById('studentName').value,
      student_class: document.getElementById('studentClass').value,
      homeroom_teacher: document.getElementById('homeroomTeacher').value,
      school_name: document.getElementById('schoolName').value,
      city_name: document.getElementById('cityName').value,
      letter_date: document.getElementById('letterDate').value,
      start_date: document.getElementById('startDate').value,
      end_date: document.getElementById('endDate').value,
      reason_type: reasonType,
      custom_reason: customReason,
      final_reason: finalReason,
      parent_name: authorType === 'orangtua' ? document.getElementById('parentName').value : '',
      parent_relation: authorType === 'orangtua' ? document.getElementById('parentRelation').value : ''
    };

    await saveLetterData(payload);
    hideLoading();
    showToast('Surat berhasil disimpan ke cloud!', 'success');

    navigateTo(`/${slug}`);
  } catch (err) {
    hideLoading();
    console.error(err);
    showToast(`Gagal menyimpan: ${err.message}`, 'error');
  }
}

async function saveLetterData(payload) {
  const { data, error } = await supabase
    .from('surat_izin')
    .upsert(payload, { onConflict: 'slug' });

  if (error) throw error;
  return data;
}

async function loadLetterData(slug) {
  try {
    const { data, error } = await supabase
      .from('surat_izin')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error || !data) return null;

    // Mapping ke CamelCase Format untuk Render Engine
    return {
      slug: data.slug,
      authorType: data.author_type,
      studentName: data.student_name,
      studentClass: data.student_class,
      homeroomTeacher: data.homeroom_teacher,
      schoolName: data.school_name,
      cityName: data.city_name,
      letterDate: data.letter_date,
      startDate: data.start_date,
      endDate: data.end_date,
      reasonType: data.reason_type,
      customReason: data.custom_reason,
      finalReason: data.final_reason,
      parentName: data.parent_name,
      parentRelation: data.parent_relation,
      createdAt: data.created_at
    };
  } catch (err) {
    console.error('Database fetch error:', err);
    return null;
  }
}

function formatIndonesianDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
}

function formatDateRange(startDateStr, endDateStr) {
  const startFormatted = formatIndonesianDate(startDateStr);
  const endFormatted = formatIndonesianDate(endDateStr);

  if (startDateStr === endDateStr) {
    return startFormatted;
  }
  return `${startFormatted} s.d. ${endFormatted}`;
}

/* ==========================================================================
   6. Render Letter to DOM Preview
   ========================================================================== */
function renderLetterPreview(data) {
  document.getElementById('view-recipient-teacher').textContent = data.homeroomTeacher || 'Wali Kelas';
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
  const mainReasonPara = document.getElementById('view-main-reason-paragraph');
  const signatureTitleEl = document.getElementById('view-signature-title');
  const signerNameEl = document.getElementById('view-signer-name');

  if (data.authorType === 'siswa') {
    introEl.textContent = 'Saya yang bertanda tangan di bawah ini:';
    mainReasonPara.innerHTML = `Memberitahukan bahwa saya tidak dapat mengikuti kegiatan pembelajaran pada hari/tanggal <strong id="view-permit-date">${formatDateRange(data.startDate, data.endDate)}</strong> dikarenakan <strong id="view-reason">${data.finalReason}</strong>.`;
    signatureTitleEl.textContent = 'Siswa yang Bersangkutan';
    signerNameEl.textContent = data.studentName;
  } else {
    introEl.textContent = 'Saya yang bertanda tangan di bawah ini, selaku orang tua/wali dari siswa:';
    mainReasonPara.innerHTML = `Memberitahukan bahwa anak saya tersebut di atas tidak dapat mengikuti kegiatan pembelajaran pada hari/tanggal <strong id="view-permit-date">${formatDateRange(data.startDate, data.endDate)}</strong> dikarenakan <strong id="view-reason">${data.finalReason}</strong>.`;
    signatureTitleEl.textContent = 'Orang Tua / Wali Siswa';
    signerNameEl.textContent = data.parentName || 'Orang Tua/Wali';
  }
}

function handleEditLetter() {
  if (!AppState.currentLetterData) return;
  const d = AppState.currentLetterData;

  navigateTo('/buat');

  const authorRadio = document.querySelector(`input[name="authorType"][value="${d.authorType || 'orangtua'}"]`);
  if (authorRadio) {
    authorRadio.checked = true;
    updateAuthorTypeUI(d.authorType || 'orangtua');
  }

  document.getElementById('studentName').value = d.studentName || '';
  document.getElementById('studentClass').value = d.studentClass || '';
  document.getElementById('homeroomTeacher').value = d.homeroomTeacher || '';
  document.getElementById('schoolName').value = d.schoolName || '';
  document.getElementById('cityName').value = d.cityName || '';
  document.getElementById('letterDate').value = d.letterDate || '';
  document.getElementById('startDate').value = d.startDate || '';
  document.getElementById('endDate').value = d.endDate || '';
  document.getElementById('reasonType').value = d.reasonType || '';

  if (d.reasonType === 'Lainnya') {
    document.getElementById('custom-reason-container').classList.remove('hidden');
    document.getElementById('customReason').value = d.customReason || '';
  }

  if (d.authorType !== 'siswa') {
    document.getElementById('parentName').value = d.parentName || '';
    document.getElementById('parentRelation').value = d.parentRelation || 'Ayah';
  }

  document.getElementById('userSlug').value = d.slug || '';
  AppState.isCustomSlugEdited = true;
  updateSlugPreview(d.slug || '');
}

/* ==========================================================================
   7. High-Quality Export Handlers (PDF & PNG/JPG)
   ========================================================================== */
async function exportPDF() {
  const element = document.getElementById('letter-paper');
  if (!element || !AppState.currentLetterData) return;

  showLoading('Menyiapkan file PDF...');

  try {
    const canvas = await html2canvas(element, {
      scale: 2.5,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false
    });

    const imgData = canvas.toDataURL('image/jpeg', 1.0);
    const { jsPDF } = window.jspdf;
    
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = 210;
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    
    const fileName = `surat-izin-${AppState.currentSlug}.pdf`;
    pdf.save(fileName);

    showToast('Berhasil mengunduh PDF!', 'success');
  } catch (err) {
    console.error(err);
    showToast('Gagal membuat file PDF. Silakan coba lagi.', 'error');
  } finally {
    hideLoading();
  }
}

async function exportImage(format) {
  const element = document.getElementById('letter-paper');
  if (!element || !AppState.currentLetterData) return;

  const formatName = format.toUpperCase();
  showLoading(`Menyiapkan file ${formatName}...`);

  try {
    const canvas = await html2canvas(element, {
      scale: 3,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false
    });

    const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
    const imageData = canvas.toDataURL(mimeType, 0.98);

    const link = document.createElement('a');
    link.href = imageData;
    link.download = `surat-izin-${AppState.currentSlug}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`Berhasil mengunduh ${formatName}!`, 'success');
  } catch (err) {
    console.error(err);
    showToast(`Gagal membuat file ${formatName}.`, 'error');
  } finally {
    hideLoading();
  }
}

/* ==========================================================================
   8. Sharing & Clipboard Operations
   ========================================================================== */
function getFullShareUrl() {
  return `${getDynamicOrigin()}/${AppState.currentSlug}`;
}

async function shareLetter() {
  const shareUrl = getFullShareUrl();
  const title = `Surat Izin Sekolah — ${AppState.currentLetterData ? AppState.currentLetterData.studentName : ''}`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: title,
        text: 'Berikut adalah tautan surat izin tidak masuk sekolah:',
        url: shareUrl
      });
      showToast('Berhasil membagikan link!', 'success');
    } catch (err) {
      if (err.name !== 'AbortError') {
        toggleModal('modal-share', true);
      }
    }
  } else {
    toggleModal('modal-share', true);
  }
}

function copyLetterLink() {
  const shareUrl = getFullShareUrl();

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        showToast('Link berhasil disalin!', 'success');
        toggleModal('modal-share', false);
      })
      .catch(() => fallbackCopyText(shareUrl));
  } else {
    fallbackCopyText(shareUrl);
  }
}

function fallbackCopyText(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
    showToast('Link berhasil disalin!', 'success');
    toggleModal('modal-share', false);
  } catch (err) {
    showToast('Gagal menyalin link.', 'error');
  }
  document.body.removeChild(textArea);
}

function shareToWhatsApp() {
  const url = getFullShareUrl();
  const text = encodeURIComponent(`Berikut adalah surat izin tidak masuk sekolah: ${url}`);
  window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  toggleModal('modal-share', false);
}

function shareToTelegram() {
  const url = getFullShareUrl();
  const text = encodeURIComponent(`Surat Izin Tidak Masuk Sekolah`);
  window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${text}`, '_blank');
  toggleModal('modal-share', false);
}

/* ==========================================================================
   9. UI Utilities (Toast, Loading, Modal)
   ========================================================================== */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(30px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
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
  if (modal) {
    if (show) modal.classList.add('active');
    else modal.classList.remove('active');
  }
}