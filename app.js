/**
 * ALER KUAFOR — Ahmet Aler Kar Premium Erkek Kuaförü (DEMO)
 * Main Application Logic (app.js)
 *
 * Features:
 * - Client-side persistence via localStorage ('aler_kuafor_appointments_v1')
 * - Non-auto-approved Appointment State Machine ('Beklemede' -> 'Onaylandı' / 'Reddedildi')
 * - Ahmet Aler Kar Admin Approval Panel (#admin-approval-panel)
 * - Simulated SMS (Netgsm REST v2) & Email (EmailJS / SMTP) Notification Queue
 * - One-click service pre-selection from .service-card to #serviceSelect
 * - Interactive Gallery Category Filtering & Lightbox Modal
 * - Responsive Mobile Navigation & Progressive-Enhancement AOS Init
 */

(function () {
  'use strict';

  /* ========================================================================
     1. CONSTANTS & CANONICAL SERVICE CATALOG
     ======================================================================== */
  const STORAGE_KEY = 'aler_kuafor_appointments_v1';
  const CONFIRMATION_MESSAGE =
    'Randevu talebiniz alındı. Ahmet Aler Kar onayladıktan sonra size bilgi verilecektir. (DEMO)';

  const SERVICES_MAP = {
    'sac-kesimi': {
      code: 'sac-kesimi',
      label: 'Saç Kesimi — Kişiye Özel Anatomik Saç Kesimi (45 Dk - 950 ₺ DEMO)',
      shortTitle: 'Kişiye Özel Anatomik Saç Kesimi',
      duration: '45 Dakika',
      price: '950 ₺ (DEMO)',
      brands: 'Davines Naturaltech, Uppercut Deluxe, Wahl Senior, BabylissPRO'
    },
    'sakal-tasarimi': {
      code: 'sakal-tasarimi',
      label: 'Sakal Tasarımı — Sıcak Havlu Ustura Ritüeli (30 Dk - 600 ₺ DEMO)',
      shortTitle: 'Sakal Tasarımı & Sıcak Havlu Ritüeli',
      duration: '30 Dakika',
      price: '600 ₺ (DEMO)',
      brands: 'Proraso Sandalwood, Reuzel Beard Foam, BabylissPRO FoilFX'
    },
    'sac-boyama': {
      code: 'sac-boyama',
      label: 'Saç Boyama — Profesyonel Gri Kamuflaj (45 Dk - 1.450 ₺ DEMO)',
      shortTitle: 'Profesyonel Saç Boyama & Gri Kamuflaj',
      duration: '45 Dakika',
      price: '1.450 ₺ (DEMO)',
      brands: 'Schwarzkopf Igora Royal, [3D]MEN Grey Blending, Davines Minu'
    },
    'cilt-bakimi': {
      code: 'cilt-bakimi',
      label: 'Cilt Bakımı — VIP Medikal & Buharlı Cilt Bakımı (45 Dk - 1.200 ₺ DEMO)',
      shortTitle: 'VIP Medikal & Buharlı Cilt Bakımı',
      duration: '45 Dakika',
      price: '1.200 ₺ (DEMO)',
      brands: 'La Roche-Posay Effaclar, CeraVe Seramid, Proraso'
    },
    'keratin-bakimi': {
      code: 'keratin-bakimi',
      label: 'Keratin & Saç Botoksu Onarım Bakımı (60 Dk - 1.800 ₺ DEMO)',
      shortTitle: 'Keratin & Saç Botoksu Onarım Bakımı',
      duration: '60 Dakika',
      price: '1.800 ₺ (DEMO)',
      brands: 'Schwarzkopf Fibre Clinix, Davines Nourishing, BabylissPRO Titanium'
    },
    'vip-damat-paketi': {
      code: 'vip-damat-paketi',
      label: 'VIP Damat Paketi & Özel Gün Hazırlığı (120 Dk - 4.500 ₺ DEMO)',
      shortTitle: 'VIP Damat Paketi & Özel Gün Hazırlığı',
      duration: '120 Dakika',
      price: '4.500 ₺ (DEMO)',
      brands: 'Tüm Lüks Koleksiyon (Davines, Proraso, Reuzel, La Roche-Posay)'
    }
  };

  let memoryFallbackStore = [];
  let activeAdminFilter = 'all';
  let lastSubmittedAppointmentId = null;

  /* ========================================================================
     2. HELPER UTILITIES (ESCAPE HTML, DATES, PHONE MASKING)
     ======================================================================== */
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getFutureDateISO(daysAhead) {
    const d = new Date();
    d.setDate(d.getDate() + (daysAhead || 0));
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatTurkishPhone(rawValue) {
    let digits = String(rawValue || '').replace(/\D/g, '');
    if (digits.startsWith('90') && digits.length > 10) {
      digits = '0' + digits.slice(2);
    }
    if (digits.startsWith('5')) {
      digits = '0' + digits;
    }
    digits = digits.slice(0, 11);

    if (digits.length <= 4) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
    if (digits.length <= 9) return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9, 11)}`;
  }

  function isValidTurkishPhone(phoneStr) {
    const digits = String(phoneStr || '').replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('05')) return true;
    if (digits.length === 10 && digits.startsWith('5')) return true;
    if (digits.length === 12 && digits.startsWith('905')) return true;
    return false;
  }

  function isValidEmail(emailStr) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(emailStr || '').trim());
  }

  /* ========================================================================
     3. SEED DATA & LOCALSTORAGE CRUD ('aler_kuafor_appointments_v1')
     ======================================================================== */
  function buildDefaultSeedAppointments() {
    const nowIso = new Date().toISOString();
    const date1 = getFutureDateISO(1);
    const date2 = getFutureDateISO(2);
    const date3 = getFutureDateISO(3);

    return [
      {
        id: 'ALR-849201',
        fullName: 'Burak Yılmaz',
        phone: '0532 418 90 12',
        email: 'burak.yilmaz@ornek.com',
        serviceCode: 'sac-kesimi',
        serviceLabel: SERVICES_MAP['sac-kesimi'].label,
        preferredDate: date1,
        preferredTime: '14:30',
        notes: 'Yanlar skin fade geçiş, üstler makasla doğal doku olsun lütfen.',
        status: 'Beklemede',
        createdAt: nowIso,
        updatedAt: nowIso,
        decidedBy: null,
        notificationLog: [
          {
            timestamp: nowIso,
            channel: 'SMS (Netgsm REST v2 Simülasyon)',
            recipient: '0532 418 90 12',
            event: 'TALEP_ALINDI',
            message: `Sayın Burak Yılmaz, ALER KUAFOR (${date1} 14:30) randevu talebiniz alındı. Ahmet Aler Kar onayladıktan sonra size bilgi verilecektir. (DEMO)`
          },
          {
            timestamp: nowIso,
            channel: 'E-POSTA (EmailJS / SMTP Simülasyon)',
            recipient: 'burak.yilmaz@ornek.com',
            event: 'TALEP_ALINDI',
            message: CONFIRMATION_MESSAGE
          }
        ]
      },
      {
        id: 'ALR-849202',
        fullName: 'Emre Karahan',
        phone: '0544 312 67 89',
        email: 'emre.karahan@ornek.com',
        serviceCode: 'vip-damat-paketi',
        serviceLabel: SERVICES_MAP['vip-damat-paketi'].label,
        preferredDate: date2,
        preferredTime: '11:00',
        notes: 'Cumartesi düğün çekimi öncesi VIP damat paketi ve cilt bakımı.',
        status: 'Beklemede',
        createdAt: nowIso,
        updatedAt: nowIso,
        decidedBy: null,
        notificationLog: [
          {
            timestamp: nowIso,
            channel: 'SMS (Netgsm REST v2 Simülasyon)',
            recipient: '0544 312 67 89',
            event: 'TALEP_ALINDI',
            message: `Sayın Emre Karahan, ALER KUAFOR (${date2} 11:00 - VIP Damat Paketi) randevu talebiniz alındı (Durum: Beklemede). Ahmet Aler Kar onayladıktan sonra size bilgi verilecektir. (DEMO)`
          }
        ]
      },
      {
        id: 'ALR-849190',
        fullName: 'Mert Soylu',
        phone: '0533 789 45 21',
        email: 'mert.soylu@ornek.com',
        serviceCode: 'sakal-tasarimi',
        serviceLabel: SERVICES_MAP['sakal-tasarimi'].label,
        preferredDate: date3,
        preferredTime: '16:30',
        notes: 'Sıcak havlu ritüeli ve elmacık kemiği hattı ustura kontürü.',
        status: 'Onaylandı',
        createdAt: nowIso,
        updatedAt: nowIso,
        decidedBy: 'Ahmet Aler Kar',
        notificationLog: [
          {
            timestamp: nowIso,
            channel: 'SMS (Netgsm REST v2 Simülasyon)',
            recipient: '0533 789 45 21',
            event: 'RANDEVU_ONAYLANDI',
            message: `Sayın Mert Soylu, ${date3} saat 16:30 (Sakal Tasarımı & Sıcak Havlu Ritüeli) randevunuz Ahmet Aler Kar tarafından ONAYLANMIŞTIR. ALER KUAFOR (DEMO)`
          }
        ]
      }
    ];
  }

  function getAppointments() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const seed = buildDefaultSeedAppointments();
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
        memoryFallbackStore = seed;
        return seed;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        memoryFallbackStore = parsed;
        return parsed;
      }
    } catch (err) {
      if (memoryFallbackStore.length === 0) {
        memoryFallbackStore = buildDefaultSeedAppointments();
      }
      return memoryFallbackStore;
    }
    return memoryFallbackStore;
  }

  function saveAppointments(list) {
    memoryFallbackStore = Array.isArray(list) ? list : [];
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryFallbackStore));
    } catch (err) {
      // Fallback to memoryFallbackStore if storage quota/sandbox blocks write
    }
  }

  function createAppointment(formData) {
    const appointments = getAppointments();
    const nowIso = new Date().toISOString();
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    const id = `ALR-${randomNum}`;
    const serviceInfo = SERVICES_MAP[formData.serviceCode] || {
      code: formData.serviceCode,
      label: formData.serviceLabel || formData.serviceCode,
      shortTitle: formData.serviceCode
    };

    const newRecord = {
      id: id,
      fullName: formData.fullName.trim(),
      phone: formatTurkishPhone(formData.phone),
      email: formData.email.trim().toLowerCase(),
      serviceCode: formData.serviceCode,
      serviceLabel: serviceInfo.label,
      preferredDate: formData.preferredDate,
      preferredTime: formData.preferredTime,
      notes: (formData.notes || '').trim(),
      status: 'Beklemede',
      createdAt: nowIso,
      updatedAt: nowIso,
      decidedBy: null,
      notificationLog: [
        {
          timestamp: nowIso,
          channel: 'SMS (Netgsm REST v2 Simülasyon)',
          recipient: formatTurkishPhone(formData.phone),
          event: 'TALEP_ALINDI',
          message: `Sayın ${formData.fullName.trim()}, ALER KUAFOR (${formData.preferredDate} ${formData.preferredTime} - ${serviceInfo.shortTitle}) randevu talebiniz alındı. Ahmet Aler Kar onayladıktan sonra size bilgi verilecektir. (DEMO)`
        },
        {
          timestamp: nowIso,
          channel: 'E-POSTA (EmailJS / SMTP Simülasyon)',
          recipient: formData.email.trim().toLowerCase(),
          event: 'TALEP_ALINDI',
          message: CONFIRMATION_MESSAGE
        }
      ]
    };

    appointments.unshift(newRecord);
    saveAppointments(appointments);
    return newRecord;
  }

  function updateAppointmentStatus(appointmentId, newStatus) {
    const appointments = getAppointments();
    const nowIso = new Date().toISOString();
    let updatedItem = null;

    for (let i = 0; i < appointments.length; i++) {
      if (appointments[i].id === appointmentId) {
        appointments[i].status = newStatus;
        appointments[i].updatedAt = nowIso;
        appointments[i].decidedBy = 'Ahmet Aler Kar';

        if (!Array.isArray(appointments[i].notificationLog)) {
          appointments[i].notificationLog = [];
        }

        const actionText =
          newStatus === 'Onaylandı'
            ? `Sayın ${appointments[i].fullName}, ${appointments[i].preferredDate} saat ${appointments[i].preferredTime} (${appointments[i].serviceLabel}) randevunuz Ahmet Aler Kar tarafından ONAYLANMIŞTIR. ALER KUAFOR (DEMO)`
            : `Sayın ${appointments[i].fullName}, ${appointments[i].preferredDate} saat ${appointments[i].preferredTime} için ilettiğiniz randevu talebi salon yoğunluğu nedeniyle onaylanamamıştır (Durum: Reddedildi). Farklı bir saat için yeni talep oluşturabilirsiniz. ALER KUAFOR (DEMO)`;

        appointments[i].notificationLog.unshift({
          timestamp: nowIso,
          channel: 'SMS & E-POSTA (Yönetici Karar Bildirimi - DEMO)',
          recipient: `${appointments[i].phone} / ${appointments[i].email}`,
          event: newStatus === 'Onaylandı' ? 'RANDEVU_ONAYLANDI' : 'RANDEVU_REDDEDILDI',
          message: actionText
        });

        updatedItem = appointments[i];
        break;
      }
    }

    if (updatedItem) {
      saveAppointments(appointments);
    }
    return updatedItem;
  }

  function deleteAppointment(appointmentId) {
    const appointments = getAppointments();
    const filtered = appointments.filter(function (item) {
      return item.id !== appointmentId;
    });
    saveAppointments(filtered);
  }

  function resetDemoAppointments() {
    const seed = buildDefaultSeedAppointments();
    saveAppointments(seed);
    return seed;
  }

  /* ========================================================================
     4. RENDER CONFIRMATION BANNER & ADMIN APPROVAL PANEL
     ======================================================================== */
  function renderConfirmationMeta(record) {
    const metaEl = document.getElementById('appointment-confirmation-meta');
    const textEl = document.getElementById('appointment-confirmation-text');
    if (textEl) {
      textEl.textContent = CONFIRMATION_MESSAGE;
    }
    if (!metaEl || !record) return;

    const statusBadgeClass =
      record.status === 'Onaylandı'
        ? 'badge-onaylandi'
        : record.status === 'Reddedildi'
        ? 'badge-reddedildi'
        : 'badge-beklemede';

    metaEl.innerHTML = `
      <div style="display: grid; gap: 0.4rem;">
        <div><strong>Referans No:</strong> <code>${escapeHtml(record.id)}</code></div>
        <div><strong>Müşteri:</strong> ${escapeHtml(record.fullName)} (${escapeHtml(record.phone)} &bull; ${escapeHtml(record.email)})</div>
        <div><strong>Seçilen Hizmet:</strong> ${escapeHtml(record.serviceLabel)}</div>
        <div><strong>Tercih Edilen Tarih &amp; Saat:</strong> ${escapeHtml(record.preferredDate)} — Saat ${escapeHtml(record.preferredTime)}</div>
        <div>
          <strong>Onay Durumu:</strong>
          <span class="status-badge ${statusBadgeClass}">${escapeHtml(record.status)}</span>
          ${
            record.decidedBy
              ? `<span style="font-size: 0.8rem; color: var(--gold-light); margin-left: 0.4rem;">(Karar: ${escapeHtml(record.decidedBy)})</span>`
              : `<span style="font-size: 0.8rem; color: var(--text-muted); margin-left: 0.4rem;">(Otomatik onaylanmaz — Ahmet Aler Kar onayı bekleniyor)</span>`
          }
        </div>
      </div>
    `;
  }

  function getStatusBadgeClass(status) {
    if (status === 'Onaylandı') return 'badge-onaylandi';
    if (status === 'Reddedildi') return 'badge-reddedildi';
    return 'badge-beklemede';
  }

  function renderAdminPanel() {
    const appointments = getAppointments();

    // Update KPI Stats
    const totalCount = appointments.length;
    const pendingCount = appointments.filter(function (a) {
      return a.status === 'Beklemede';
    }).length;
    const approvedCount = appointments.filter(function (a) {
      return a.status === 'Onaylandı';
    }).length;
    const rejectedCount = appointments.filter(function (a) {
      return a.status === 'Reddedildi';
    }).length;

    const statTotal = document.getElementById('stat-total');
    const statPending = document.getElementById('stat-pending');
    const statApproved = document.getElementById('stat-approved');
    const statRejected = document.getElementById('stat-rejected');

    if (statTotal) statTotal.textContent = String(totalCount);
    if (statPending) statPending.textContent = String(pendingCount);
    if (statApproved) statApproved.textContent = String(approvedCount);
    if (statRejected) statRejected.textContent = String(rejectedCount);

    // Filter Appointments List
    const listContainer = document.getElementById('admin-appointments-list');
    if (listContainer) {
      const visibleItems =
        activeAdminFilter === 'all'
          ? appointments
          : appointments.filter(function (item) {
              return item.status === activeAdminFilter;
            });

      if (visibleItems.length === 0) {
        listContainer.innerHTML = `
          <div class="admin-appointment-card" style="justify-content: center; text-align: center; padding: 2rem;">
            <p style="color: var(--text-muted);">Seçili filtrede ("${escapeHtml(activeAdminFilter)}") randevu talebi bulunmamaktadır.</p>
          </div>
        `;
      } else {
        listContainer.innerHTML = visibleItems
          .map(function (item) {
            const badgeClass = getStatusBadgeClass(item.status);
            const isApproved = item.status === 'Onaylandı';
            const isRejected = item.status === 'Reddedildi';

            return `
              <article class="admin-appointment-card" data-appointment-id="${escapeHtml(item.id)}">
                <div class="admin-appointment-info">
                  <div class="admin-appointment-header">
                    <span class="appointment-id-tag">#${escapeHtml(item.id)}</span>
                    <strong style="color: var(--text-white); font-size: 1.02rem;">${escapeHtml(item.fullName)}</strong>
                    <span class="status-badge ${badgeClass}" data-status-badge="${escapeHtml(item.id)}">${escapeHtml(item.status)}</span>
                  </div>
                  <div class="admin-appointment-meta">
                    <div><strong>Hizmet:</strong> ${escapeHtml(item.serviceLabel)}</div>
                    <div><strong>Tarih &amp; Saat:</strong> ${escapeHtml(item.preferredDate)} | Saat: ${escapeHtml(item.preferredTime)}</div>
                    <div><strong>İletişim:</strong> ${escapeHtml(item.phone)} &bull; ${escapeHtml(item.email)}</div>
                    ${
                      item.notes
                        ? `<div><strong>Müşteri Notu:</strong> <em>"${escapeHtml(item.notes)}"</em></div>`
                        : ''
                    }
                    <div>
                      <strong>Onay Yetkilisi:</strong>
                      ${
                        item.decidedBy
                          ? `<span style="color: var(--gold-light);">${escapeHtml(item.decidedBy)} (${escapeHtml(item.status)})</span>`
                          : `<span>Henüz onaylanmadı — Ahmet Aler Kar onayı bekleniyor</span>`
                      }
                    </div>
                  </div>
                </div>
                <div class="admin-appointment-actions">
                  <button
                    type="button"
                    class="btn-approve"
                    data-action="approve"
                    data-id="${escapeHtml(item.id)}"
                    ${isApproved ? 'disabled' : ''}
                  >
                    Onayla (DEMO)
                  </button>
                  <button
                    type="button"
                    class="btn-reject"
                    data-action="reject"
                    data-id="${escapeHtml(item.id)}"
                    ${isRejected ? 'disabled' : ''}
                  >
                    Reddet (DEMO)
                  </button>
                  <button
                    type="button"
                    class="btn-delete"
                    data-action="delete"
                    data-id="${escapeHtml(item.id)}"
                  >
                    Sil (DEMO)
                  </button>
                </div>
              </article>
            `;
          })
          .join('');
      }
    }

    // Render Notification Simulator Log
    const logContainer = document.getElementById('notification-log-list');
    if (logContainer) {
      const allLogs = [];
      appointments.forEach(function (appt) {
        if (Array.isArray(appt.notificationLog)) {
          appt.notificationLog.forEach(function (entry) {
            allLogs.push({
              appointmentId: appt.id,
              timestamp: entry.timestamp,
              channel: entry.channel,
              recipient: entry.recipient,
              event: entry.event,
              message: entry.message
            });
          });
        }
      });

      allLogs.sort(function (a, b) {
        return String(b.timestamp).localeCompare(String(a.timestamp));
      });

      if (allLogs.length === 0) {
        logContainer.innerHTML = `<div class="notification-log-item">Henüz simüle edilmiş SMS veya E-posta bildirimi bulunmamaktadır.</div>`;
      } else {
        logContainer.innerHTML = allLogs
          .slice(0, 12)
          .map(function (log) {
            const timeFormatted = log.timestamp
              ? new Date(log.timestamp).toLocaleTimeString('tr-TR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                })
              : '--:--';
            return `
              <div class="notification-log-item">
                <div class="notification-log-meta">
                  <span>[${escapeHtml(log.channel)}] &bull; Alıcı: ${escapeHtml(log.recipient)}</span>
                  <span>Ref: #${escapeHtml(log.appointmentId)} &bull; ${escapeHtml(timeFormatted)} &bull; HTTP 200 OK (DEMO)</span>
                </div>
                <div style="color: var(--text-ivory);">${escapeHtml(log.message)}</div>
              </div>
            `;
          })
          .join('');
      }
    }

    // If a newly submitted appointment is displayed in #appointment-confirmation, keep its badge synced
    if (lastSubmittedAppointmentId) {
      const currentRecord = appointments.find(function (a) {
        return a.id === lastSubmittedAppointmentId;
      });
      if (currentRecord) {
        renderConfirmationMeta(currentRecord);
      }
    }
  }

  /* ========================================================================
     5. FORM VALIDATION & INTERACTION BINDINGS
     ======================================================================== */
  function setFieldError(fieldId, errorMessage) {
    const inputEl = document.getElementById(fieldId);
    const errorEl = document.getElementById(`${fieldId}-error`);
    if (inputEl) {
      if (errorMessage) {
        inputEl.classList.add('input-error');
        inputEl.setAttribute('aria-invalid', 'true');
      } else {
        inputEl.classList.remove('input-error');
        inputEl.removeAttribute('aria-invalid');
      }
    }
    if (errorEl) {
      errorEl.textContent = errorMessage || '';
    }
  }

  function clearAllFieldErrors() {
    ['fullName', 'phone', 'email', 'serviceSelect', 'preferredDate', 'preferredTime'].forEach(function (id) {
      setFieldError(id, '');
    });
  }

  function initAppointmentForm() {
    const form = document.getElementById('appointment-form');
    const fullNameInput = document.getElementById('fullName');
    const phoneInput = document.getElementById('phone');
    const emailInput = document.getElementById('email');
    const serviceSelect = document.getElementById('serviceSelect');
    const serviceHelper = document.getElementById('serviceSelect-helper');
    const preferredDateInput = document.getElementById('preferredDate');
    const preferredTimeSelect = document.getElementById('preferredTime');
    const notesInput = document.getElementById('notes');
    const notesCounter = document.getElementById('notes-counter');
    const confirmationBanner = document.getElementById('appointment-confirmation');

    // Initialize date constraints
    if (preferredDateInput) {
      const todayIso = getFutureDateISO(0);
      const maxDateIso = getFutureDateISO(60);
      preferredDateInput.setAttribute('min', todayIso);
      preferredDateInput.setAttribute('max', maxDateIso);
      if (!preferredDateInput.value) {
        preferredDateInput.value = getFutureDateISO(1);
      }
    }

    // Turkish phone masking on input
    if (phoneInput) {
      phoneInput.addEventListener('input', function () {
        const formatted = formatTurkishPhone(phoneInput.value);
        phoneInput.value = formatted;
        if (isValidTurkishPhone(formatted)) {
          setFieldError('phone', '');
        }
      });
    }

    // Live error clearing on input/change
    if (fullNameInput) {
      fullNameInput.addEventListener('input', function () {
        if (fullNameInput.value.trim().length >= 3) {
          setFieldError('fullName', '');
        }
      });
    }

    if (emailInput) {
      emailInput.addEventListener('input', function () {
        if (isValidEmail(emailInput.value)) {
          setFieldError('email', '');
        }
      });
    }

    if (serviceSelect) {
      serviceSelect.addEventListener('change', function () {
        const code = serviceSelect.value;
        setFieldError('serviceSelect', '');
        if (serviceHelper && SERVICES_MAP[code]) {
          const s = SERVICES_MAP[code];
          serviceHelper.textContent = `Seçilen Hizmet Süresi: ${s.duration} | Konsept Ücret: ${s.price} | Markalar: ${s.brands}`;
        }
      });
    }

    if (preferredDateInput) {
      preferredDateInput.addEventListener('change', function () {
        if (preferredDateInput.value) {
          setFieldError('preferredDate', '');
        }
      });
    }

    if (preferredTimeSelect) {
      preferredTimeSelect.addEventListener('change', function () {
        if (preferredTimeSelect.value) {
          setFieldError('preferredTime', '');
        }
      });
    }

    if (notesInput && notesCounter) {
      notesInput.addEventListener('input', function () {
        const len = notesInput.value.length;
        notesCounter.textContent = `${len} / 300 karakter`;
      });
    }

    // One-click service pre-selection from .service-card buttons
    const serviceButtons = document.querySelectorAll('.service-book-btn');
    serviceButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const targetService = btn.getAttribute('data-service');
        if (serviceSelect && targetService) {
          serviceSelect.value = targetService;
          serviceSelect.dispatchEvent(new Event('change', { bubbles: true }));
          serviceSelect.classList.add('field-preselected-glow');
          setTimeout(function () {
            serviceSelect.classList.remove('field-preselected-glow');
          }, 1400);
        }
        const randevuSection = document.getElementById('randevu');
        if (randevuSection) {
          randevuSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        if (fullNameInput) {
          setTimeout(function () {
            fullNameInput.focus({ preventScroll: true });
          }, 450);
        }
      });
    });

    // Form submission handler
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        clearAllFieldErrors();

        const fullNameVal = fullNameInput ? fullNameInput.value.trim() : '';
        const phoneVal = phoneInput ? phoneInput.value.trim() : '';
        const emailVal = emailInput ? emailInput.value.trim() : '';
        const serviceVal = serviceSelect ? serviceSelect.value : '';
        const dateVal = preferredDateInput ? preferredDateInput.value : '';
        const timeVal = preferredTimeSelect ? preferredTimeSelect.value : '';
        const notesVal = notesInput ? notesInput.value : '';

        let isValid = true;

        if (fullNameVal.length < 3) {
          setFieldError('fullName', 'Lütfen geçerli bir Ad ve Soyad giriniz (en az 3 karakter).');
          isValid = false;
        }

        if (!isValidTurkishPhone(phoneVal)) {
          setFieldError('phone', 'Lütfen 05XX XXX XX XX formatında geçerli bir cep telefonu numarası giriniz.');
          isValid = false;
        }

        if (!isValidEmail(emailVal)) {
          setFieldError('email', 'Lütfen bildirimlerin iletileceği geçerli bir e-posta adresi giriniz.');
          isValid = false;
        }

        if (!serviceVal) {
          setFieldError('serviceSelect', 'Lütfen randevu almak istediğiniz hizmeti seçiniz.');
          isValid = false;
        }

        const todayIso = getFutureDateISO(0);
        if (!dateVal || dateVal < todayIso) {
          setFieldError('preferredDate', 'Lütfen bugün veya ileri bir randevu tarihi seçiniz.');
          isValid = false;
        }

        if (!timeVal) {
          setFieldError('preferredTime', 'Lütfen tercih ettiğiniz randevu saatini seçiniz.');
          isValid = false;
        }

        if (!isValid) {
          return;
        }

        const createdRecord = createAppointment({
          fullName: fullNameVal,
          phone: phoneVal,
          email: emailVal,
          serviceCode: serviceVal,
          preferredDate: dateVal,
          preferredTime: timeVal,
          notes: notesVal
        });

        lastSubmittedAppointmentId = createdRecord.id;

        if (confirmationBanner) {
          confirmationBanner.classList.remove('hidden');
          renderConfirmationMeta(createdRecord);
          confirmationBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        renderAdminPanel();

        // Reset text inputs while keeping date valid for convenience
        form.reset();
        if (preferredDateInput) {
          preferredDateInput.value = dateVal;
        }
        if (serviceHelper) {
          serviceHelper.textContent = '';
        }
        if (notesCounter) {
          notesCounter.textContent = '0 / 300 karakter';
        }
      });
    }
  }

  /* ========================================================================
     6. ADMIN APPROVAL PANEL EVENT DELEGATION
     ======================================================================== */
  function initAdminPanelControls() {
    const adminList = document.getElementById('admin-appointments-list');
    const filterButtons = document.querySelectorAll('.admin-filter-btn');
    const resetBtn = document.getElementById('reset-demo-data-btn');

    filterButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        filterButtons.forEach(function (b) {
          b.classList.remove('active');
        });
        btn.classList.add('active');
        activeAdminFilter = btn.getAttribute('data-status-filter') || 'all';
        renderAdminPanel();
      });
    });

    if (adminList) {
      adminList.addEventListener('click', function (e) {
        const targetBtn = e.target.closest('button[data-action]');
        if (!targetBtn) return;

        const action = targetBtn.getAttribute('data-action');
        const id = targetBtn.getAttribute('data-id');
        if (!id) return;

        if (action === 'approve') {
          updateAppointmentStatus(id, 'Onaylandı');
          renderAdminPanel();
        } else if (action === 'reject') {
          updateAppointmentStatus(id, 'Reddedildi');
          renderAdminPanel();
        } else if (action === 'delete') {
          deleteAppointment(id);
          renderAdminPanel();
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        activeAdminFilter = 'all';
        filterButtons.forEach(function (b) {
          b.classList.toggle('active', b.getAttribute('data-status-filter') === 'all');
        });
        resetDemoAppointments();
        renderAdminPanel();
      });
    }
  }

  /* ========================================================================
     7. GALLERY FILTERING & LIGHTBOX MODAL
     ======================================================================== */
  function initGalleryAndLightbox() {
    const filterBtns = document.querySelectorAll('.gallery-filter-btn');
    const galleryItems = document.querySelectorAll('.gallery-item');
    const lightbox = document.getElementById('gallery-lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxTitle = document.getElementById('lightbox-title');
    const lightboxCredit = document.getElementById('lightbox-credit');
    const lightboxCloseBtn = document.getElementById('lightbox-close-btn');

    filterBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        filterBtns.forEach(function (b) {
          b.classList.remove('active');
        });
        btn.classList.add('active');
        const category = btn.getAttribute('data-filter');

        galleryItems.forEach(function (item) {
          const itemCat = item.getAttribute('data-category');
          if (category === 'all' || itemCat === category) {
            item.classList.remove('hidden');
          } else {
            item.classList.add('hidden');
          }
        });
      });
    });

    galleryItems.forEach(function (item) {
      item.addEventListener('click', function () {
        const imgEl = item.querySelector('img');
        if (!imgEl || !lightbox || !lightboxImg) return;
        lightboxImg.src = imgEl.src;
        lightboxImg.alt = imgEl.alt;
        if (lightboxTitle) {
          lightboxTitle.textContent = item.getAttribute('data-title') || '';
        }
        if (lightboxCredit) {
          lightboxCredit.textContent = item.getAttribute('data-credit') || '';
        }
        lightbox.classList.remove('hidden');
      });
    });

    function closeLightbox() {
      if (lightbox) {
        lightbox.classList.add('hidden');
      }
    }

    if (lightboxCloseBtn) {
      lightboxCloseBtn.addEventListener('click', closeLightbox);
    }

    if (lightbox) {
      lightbox.addEventListener('click', function (e) {
        if (e.target === lightbox) {
          closeLightbox();
        }
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeLightbox();
      }
    });
  }

  /* ========================================================================
     8. MOBILE NAVIGATION & AOS INITIALIZATION
     ======================================================================== */
  function initNavigationAndAnimations() {
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const navMenu = document.getElementById('nav-menu');

    if (mobileBtn && navMenu) {
      mobileBtn.addEventListener('click', function () {
        const isOpen = navMenu.classList.toggle('open');
        mobileBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });

      navMenu.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', function () {
          navMenu.classList.remove('open');
          mobileBtn.setAttribute('aria-expanded', 'false');
        });
      });
    }

    if (typeof window.AOS !== 'undefined' && window.AOS && typeof window.AOS.init === 'function') {
      window.AOS.init({
        duration: 700,
        once: true,
        offset: 40
      });
    }
  }

  /* ========================================================================
     9. BOOTSTRAP ON DOMCONTENTLOADED
     ======================================================================== */
  function bootstrap() {
    getAppointments();
    initNavigationAndAnimations();
    initAppointmentForm();
    initAdminPanelControls();
    initGalleryAndLightbox();
    renderAdminPanel();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
