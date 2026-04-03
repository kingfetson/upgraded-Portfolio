// ==================== CONFIGURATION ====================
const CONFIG = {
  googleSheets: {
    // Replace with your Google Apps Script Web App URL
    // See README for setup instructions
    url: 'YOUR_GOOGLE_APPS_SCRIPT_URL'
  }
};

// ==================== NAVIGATION ====================
const navLinks = document.querySelectorAll('.nav-link');
const pages = document.querySelectorAll('.page');
const mobileToggle = document.getElementById('mobileToggle');
const navMenu = document.getElementById('navMenu');

function navigateTo(pageId) {
  navLinks.forEach(l => l.classList.remove('active'));
  document.querySelector(`[data-page="${pageId}"]`).classList.add('active');
  pages.forEach(p => p.classList.remove('active-page'));
  document.getElementById(pageId).classList.add('active-page');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  // Close mobile menu
  navMenu.classList.remove('active');
}

navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo(link.dataset.page);
  });
});

mobileToggle.addEventListener('click', () => {
  navMenu.classList.toggle('active');
});

// ==================== THEME TOGGLE ====================
const themeToggle = document.getElementById('themeToggle');
const html = document.documentElement;

// Load saved theme
const savedTheme = localStorage.getItem('theme') || 'dark';
html.setAttribute('data-theme', savedTheme);

themeToggle.addEventListener('click', () => {
  const currentTheme = html.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  html.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  
  // Add animation
  themeToggle.style.transform = 'rotate(360deg)';
  setTimeout(() => {
    themeToggle.style.transform = 'rotate(0)';
  }, 300);
});

// ==================== INDEXEDDB SETUP ====================
const DB_NAME = 'PortfolioDB';
const DB_VERSION = 1;
let db;

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains('resume')) {
        database.createObjectStore('resume', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('cv')) {
        database.createObjectStore('cv', { keyPath: 'id' });
      }
    };
  });
}

function saveFileToDB(type, file) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([type], 'readwrite');
    const store = transaction.objectStore(type);
    
    const record = {
      id: 1,
      file: file,
      name: file.name,
      type: file.type,
      size: file.size,
      uploadedAt: new Date().toLocaleString()
    };
    
    const request = store.put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function getFileFromDB(type) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([type], 'readonly');
    const store = transaction.objectStore(type);
    const request = store.get(1);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deleteFileFromDB(type) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([type], 'readwrite');
    const store = transaction.objectStore(type);
    const request = store.delete(1);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ==================== FILE UPLOAD ====================
document.getElementById('resumeFileInput').addEventListener('change', function(e) {
  handleFileUpload(e, 'resume');
});

document.getElementById('cvFileInput').addEventListener('change', function(e) {
  handleFileUpload(e, 'cv');
});

async function handleFileUpload(event, type) {
  const file = event.target.files[0];
  const statusEl = document.getElementById(`${type}UploadStatus`);
  
  if (!file) return;
  
  if (file.size > 50 * 1024 * 1024) {
    showStatus(statusEl, 'File too large. Max size is 50MB.', 'error');
    return;
  }
  
  const validTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ];
  
  if (!validTypes.includes(file.type)) {
    showStatus(statusEl, 'Please upload a PDF or DOCX file.', 'error');
    return;
  }
  
  try {
    showStatus(statusEl, 'Uploading...', 'success');
    await saveFileToDB(type, file);
    showStatus(statusEl, `✓ ${type === 'resume' ? 'Resume' : 'CV'} uploaded successfully!`, 'success');
    
    setTimeout(() => {
      loadFileDisplay(type);
    }, 1000);
    
  } catch (error) {
    console.error('Upload error:', error);
    showStatus(statusEl, 'Error uploading file. Please try again.', 'error');
  }
}

function showStatus(element, message, type) {
  element.textContent = message;
  element.className = `upload-status ${type}`;
}

// ==================== FILE DISPLAY & DOWNLOAD ====================
async function loadFileDisplay(type) {
  const uploadSection = document.getElementById(`${type}UploadSection`);
  const downloadSection = document.getElementById(`${type}DownloadSection`);
  const adminControls = document.getElementById(`${type}AdminControls`);
  
  try {
    const record = await getFileFromDB(type);
    
    if (record && record.file) {
      uploadSection.style.display = 'none';
      downloadSection.style.display = 'flex';
      adminControls.style.display = 'block';
      
      const blob = new Blob([record.file], { type: record.type });
      const url = URL.createObjectURL(blob);
      
      const downloadLink = document.getElementById(`${type}DownloadLink`);
      downloadLink.href = url;
      downloadLink.download = record.name;
      
      const fileInfo = document.getElementById(`${type}FileInfo`);
      const fileSize = (record.size / 1024 / 1024).toFixed(2);
      fileInfo.innerHTML = `
        <i class="fas fa-file"></i> ${record.name}<br>
        <i class="fas fa-database"></i> ${fileSize} MB | 
        <i class="fas fa-calendar"></i> ${record.uploadedAt}
      `;
    } else {
      uploadSection.style.display = 'block';
      downloadSection.style.display = 'none';
      adminControls.style.display = 'none';
    }
  } catch (error) {
    console.error('Load error:', error);
    uploadSection.style.display = 'block';
    downloadSection.style.display = 'none';
    adminControls.style.display = 'none';
  }
}

async function removeResume() {
  if (confirm('Remove your resume?')) {
    try {
      await deleteFileFromDB('resume');
      loadFileDisplay('resume');
    } catch (error) {
      alert('Error removing resume');
    }
  }
}

async function removeCV() {
  if (confirm('Remove your CV?')) {
    try {
      await deleteFileFromDB('cv');
      loadFileDisplay('cv');
    } catch (error) {
      alert('Error removing CV');
    }
  }
}

// ==================== CONTACT FORM (GOOGLE SHEETS) ====================
const contactForm = document.getElementById('contactForm');
const submitBtn = document.getElementById('submitBtn');
const formStatus = document.getElementById('formStatus');

contactForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = {
    name: document.getElementById('contactName').value,
    email: document.getElementById('contactEmail').value,
    subject: document.getElementById('contactSubject').value,
    message: document.getElementById('contactMessage').value,
    timestamp: new Date().toISOString()
  };
  
  // Disable button
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
  
  try {
    // Send to Google Sheets
    const response = await fetch(CONFIG.googleSheets.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });
    
    if (response.ok) {
      showFormStatus('✓ Message sent successfully! I\'ll get back to you soon.', 'success');
      contactForm.reset();
    } else {
      throw new Error('Failed to send');
    }
  } catch (error) {
    console.error('Form error:', error);
    showFormStatus('⚠ Error sending message. Please try again or email me directly.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Message';
  }
});

function showFormStatus(message, type) {
  formStatus.textContent = message;
  formStatus.className = `form-status ${type}`;
  
  setTimeout(() => {
    formStatus.style.display = 'none';
  }, 5000);
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initDB();
    loadFileDisplay('resume');
    loadFileDisplay('cv');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
});
