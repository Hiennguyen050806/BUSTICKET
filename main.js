
// Định dạng ngày giờ chuẩn
const formatDateVN = (isoStr) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2); // yy format as requested
    return `${day}/${month}/${year}`;
};

const formatTimeVN = (isoStr) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${mins}`;
};

const formatDateTimeVN = (isoStr) => {
    if (!isoStr) return '';
    return `${formatTimeVN(isoStr)} ${formatDateVN(isoStr)}`;
};

// =======================================================================
// HỆ THỐNG ĐẶT VÉ XE YOLO BUS LINES
// MAIN FRONTEND JAVASCRIPT
// =======================================================================

const API_BASE = 'http://localhost:3000/api';

// Trạng thái ứng dụng (Application State)
const appState = {
    currentUser: null,
    currentTrip: null,
    selectedSeats: [],
    maxSeats: 1,
    currentStep: 1,
    cachedTrips: [],
    activeTimeSlot: 'all',
    selectedPayMethod: 'VNPAY-QR',
    countdownTimer: null,
    countdownSeconds: 300 // 5 phút
};

let sepayInterval = null;
let currentSepayBooking = null;

// Lấy ngày theo giờ địa phương (tránh lỗi múi giờ UTC/GMT 0 của toISOString)
const getLocalDateStr = (d = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// =======================================================================
// 1. KHỞI TẠO ỨNG DỤNG & THIẾT LẬP BAN ĐẦU
// =======================================================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Khởi tạo giao diện Dark Mode
    initTheme();

    // 2. Đặt ngày mặc định là hôm nay theo giờ địa phương
    const today = getLocalDateStr();
    const dateInput = document.getElementById('date');
    if (dateInput) {
        dateInput.value = today;
        dateInput.min = today;
    }
    const returnDateInput = document.getElementById('return-date');
    if (returnDateInput) {
        returnDateInput.min = today;
    }

    // 3. Kiểm tra phiên đăng nhập đã lưu trong localStorage
    loadSavedUser();

    // 4. Tự động tải bảng lịch trình nền
    loadScheduleData();

    // 5. Lắng nghe sự kiện form tìm kiếm
    setupSearchForm();

    // 6. Thiết lập modal và các sự kiện chung
    setupModals();
});

// =======================================================================
// 2. CHẾ ĐỘ DARK MODE (SÁNG / TỐI)
// =======================================================================
function initTheme() {
    const savedTheme = localStorage.getItem('yolo_theme') || 'light';
    const body = document.body;
    const themeIcon = document.getElementById('theme-icon');

    if (savedTheme === 'dark') {
        body.classList.add('dark-mode');
        if (themeIcon) {
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
        }
    } else {
        body.classList.remove('dark-mode');
        if (themeIcon) {
            themeIcon.classList.remove('fa-sun');
            themeIcon.classList.add('fa-moon');
        }
    }
}

function toggleDarkMode() {
    const body = document.body;
    const themeIcon = document.getElementById('theme-icon');
    const isDark = body.classList.toggle('dark-mode');

    if (isDark) {
        localStorage.setItem('yolo_theme', 'dark');
        if (themeIcon) {
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
        }
        showToast('Đã kích hoạt chế độ giao diện Tối (Dark Mode)', 'info');
    } else {
        localStorage.setItem('yolo_theme', 'light');
        if (themeIcon) {
            themeIcon.classList.remove('fa-sun');
            themeIcon.classList.add('fa-moon');
        }
        showToast('Đã chuyển sang chế độ giao diện Sáng (Light Mode)', 'info');
    }
}

// Lưu / Nạp người dùng từ localStorage
function loadSavedUser() {
    try {
        const saved = localStorage.getItem('yolo_user');
        if (saved) {
            appState.currentUser = JSON.parse(saved);
            updateAuthUI();
        }
    } catch (e) {
        console.error('Lỗi nạp thông tin user:', e);
    }
}

function updateAuthUI() {
    const authContainer = document.getElementById('auth-buttons');
    if (!authContainer) return;

    if (appState.currentUser) {
        const name = appState.currentUser.FullName || 'Khách hàng';
        const initial = name.trim().charAt(0).toUpperCase();
        authContainer.innerHTML = `
            <div class="user-profile-menu" title="${name}">
                <div class="user-avatar">${initial}</div>
                <div style="display: flex; flex-direction: column;">
                    <span style="font-size: 13.5px; font-weight: 700; color: var(--yolo-blue);">${name}</span>
                    <span style="font-size: 11px; color: var(--text-muted);">${appState.currentUser.PhoneNumber}</span>
                </div>
                ${appState.currentUser.IsAdmin ? `
                <a href="admin.html" class="btn-logout-small" style="text-decoration: none; background: var(--yolo-cyan); color: white; border-color: var(--yolo-cyan);" title="Trang quản trị">
                    <i class="fa-solid fa-user-shield"></i> Admin
                </a>
                ` : ''}
                <button type="button" class="btn-logout-small" onclick="handleLogout()" title="Đăng xuất">
                    <i class="fa-solid fa-right-from-bracket"></i> Thoát
                </button>
            </div>
        `;
    } else {
        authContainer.innerHTML = `
            <button id="btn-open-login" class="btn-auth btn-login" onclick="openAuthModal('login')">Đăng nhập</button>
            <button id="btn-open-register" class="btn-auth btn-register" onclick="openAuthModal('register')">Đăng ký</button>
        `;
    }
}

function handleLogout() {
    localStorage.removeItem('yolo_user');
    appState.currentUser = null;
    updateAuthUI();
    showToast('Bạn đã đăng xuất tài khoản thành công.', 'info');
    if (document.getElementById('view-my-tickets').style.display !== 'none') {
        switchTab('home');
    }
}

// =======================================================================
// 3. ĐIỀU HƯỚNG TABS (SINGLE PAGE APPLICATION)
// =======================================================================
function switchTab(tabName) {
    // Cập nhật class active trên menu
    document.querySelectorAll('.nav-item').forEach(el => {
        if (el.getAttribute('data-tab') === tabName) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });

    // Ẩn tất cả các view
    document.querySelectorAll('.spa-view').forEach(view => {
        view.style.display = 'none';
        view.classList.remove('active');
    });

    // Hiện view được chọn
    const targetView = document.getElementById(`view-${tabName}`);
    if (targetView) {
        targetView.style.display = 'block';
        targetView.classList.add('active');
    }

    // Ẩn / hiện hero banner tùy tab
    const hero = document.getElementById('hero-banner');
    if (hero) {
        hero.style.display = (tabName === 'home') ? 'block' : 'none';
    }

    // Tác vụ bổ sung theo từng tab
    if (tabName === 'schedule') {
        loadScheduleData();
    } else if (tabName === 'my-tickets') {
        renderMyTicketsView();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =======================================================================
// 4. TÌM KIẾM CHUYẾN XE & ĐIỀU KHIỂN FORM
// =======================================================================
function setupSearchForm() {
    const searchForm = document.getElementById('search-form');
    if (!searchForm) return;

    // Nút đảo chiều điểm đi & đến
    document.getElementById('btn-swap')?.addEventListener('click', () => {
        const dep = document.getElementById('departure');
        const des = document.getElementById('destination');
        const temp = dep.value;
        dep.value = des.value;
        des.value = temp;
    });

    // Bắt sự kiện submit form tìm kiếm
    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await performSearch();
    });
}

function toggleTripType() {
    const tripType = document.querySelector('input[name="tripType"]:checked')?.value;
    const returnBox = document.getElementById('return-date-box');
    const searchGrid = document.getElementById('search-grid');

    if (tripType === 'roundTrip') {
        returnBox.style.display = 'flex';
        searchGrid.classList.remove('one-way');
        const depDate = document.getElementById('date').value;
        if (depDate) {
            const d = new Date(depDate);
            d.setDate(d.getDate() + 1);
            const returnDateStr = getLocalDateStr(d);
            const returnDateInput = document.getElementById('return-date');
            if (returnDateInput) {
                returnDateInput.value = returnDateStr;
                if (returnDateInput._flatpickr) {
                    returnDateInput._flatpickr.setDate(returnDateStr, true);
                }
            }
        }
    } else {
        returnBox.style.display = 'none';
        searchGrid.classList.add('one-way');
    }
}

function setQuickDate(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const dateStr = getLocalDateStr(d);
    const dateInput = document.getElementById('date');
    if (dateInput) {
        dateInput.value = dateStr;
        if (dateInput._flatpickr) {
            dateInput._flatpickr.setDate(dateStr, true);
        }
    }
}

function quickSelectRoute(dep, des) {
    switchTab('home');
    const depSelect = document.getElementById('departure');
    const desSelect = document.getElementById('destination');
    if (depSelect) depSelect.value = dep;
    if (desSelect) desSelect.value = des;
    performSearch();
}

async function performSearch() {
    const dep = document.getElementById('departure').value;
    const des = document.getElementById('destination').value;
    const date = document.getElementById('date').value;
    const ticketCount = parseInt(document.getElementById('ticket-count').value || '1');

    appState.maxSeats = ticketCount;

    const resultsSection = document.getElementById('results-section');
    const tripResultsContainer = document.getElementById('trip-results');
    const wizardContainer = document.getElementById('booking-wizard');

    wizardContainer.style.display = 'none';
    resultsSection.style.display = 'block';

    tripResultsContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border-color);">
            <i class="fa-solid fa-spinner fa-spin" style="font-size: 32px; color: var(--yolo-blue);"></i>
            <p style="margin-top: 12px; color: var(--text-sub); font-weight: 600;">Đang tìm chuyến xe phù hợp nhất từ ${dep} đến ${des}...</p>
        </div>
    `;

    resultsSection.scrollIntoView({ behavior: 'smooth' });

    try {
        const url = `${API_BASE}/trips?departure=${encodeURIComponent(dep)}&destination=${encodeURIComponent(des)}&date=${date}`;
        const res = await fetch(url);
        const trips = await res.json();

        appState.cachedTrips = trips;
        renderTripsList(trips);
    } catch (err) {
        console.error('Lỗi tìm kiếm chuyến xe:', err);
        tripResultsContainer.innerHTML = `
            <div style="text-align: center; padding: 35px; background: var(--bg-card); border-radius: 12px; border: 1px solid #fee2e2;">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 36px; color: #ef4444; margin-bottom: 10px;"></i>
                <p style="color: #b91c1c; font-weight: 700;">Không thể kết nối đến máy chủ Backend!</p>
                <p style="color: var(--text-muted); font-size: 13.5px; margin-top: 4px;">Vui lòng đảm bảo server Node.js đang chạy tại cổng 3000.</p>
            </div>
        `;
    }
}

// Lọc & Sắp xếp chuyến xe
function filterByTimeSlot(slot, e) {
    appState.activeTimeSlot = slot;
    document.querySelectorAll('.time-chip').forEach(el => {
        el.classList.remove('active');
    });
    const target = e?.currentTarget || e?.target || event?.target;
    if (target) target.classList.add('active');
    applyTripFilters();
}

function applyTripFilters() {
    let list = [...appState.cachedTrips];

    // Lọc theo khung giờ
    if (appState.activeTimeSlot !== 'all') {
        list = list.filter(t => {
            const h = new Date(t.departureTime).getHours();
            if (appState.activeTimeSlot === 'early') return h >= 0 && h < 6;
            if (appState.activeTimeSlot === 'morning') return h >= 6 && h < 12;
            if (appState.activeTimeSlot === 'afternoon') return h >= 12 && h < 18;
            if (appState.activeTimeSlot === 'evening') return h >= 18 && h < 24;
            return true;
        });
    }

    // Lọc theo loại xe
    const busType = document.getElementById('filter-bus-type')?.value;
    if (busType && busType !== 'all') {
        list = list.filter(t => t.busType.includes(busType));
    }

    // Sắp xếp
    const sortBy = document.getElementById('sort-trips')?.value;
    if (sortBy === 'price-asc') {
        list.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-desc') {
        list.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'time-asc') {
        list.sort((a, b) => new Date(a.departureTime) - new Date(b.departureTime));
    } else if (sortBy === 'time-desc') {
        list.sort((a, b) => new Date(b.departureTime) - new Date(a.departureTime));
    }

    renderTripsList(list);
}

function renderTripsList(trips) {
    const container = document.getElementById('trip-results');

    if (!trips || trips.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding: 40px 20px; background: var(--bg-card); border-radius: 12px; border: 1.5px dashed var(--yolo-blue-border);">
                <i class="fa-solid fa-bus" style="font-size: 40px; color: var(--yolo-blue); margin-bottom: 12px;"></i>
                <h3 style="font-size: 17px; color: var(--yolo-blue); font-weight: 800; margin-bottom: 8px;">
                    Rất tiếc, không tìm thấy chuyến xe phù hợp!
                </h3>
                <p style="color: var(--text-muted); font-size: 14px; max-width: 500px; margin: 0 auto;">
                    Không có chuyến nào khớp với bộ lọc hiện tại. Bạn hãy thử đổi sang <strong>Ngày khác</strong> hoặc chọn các khung giờ khác xem sao nhé.
                </p>
            </div>
        `;
        return;
    }

    let html = `<div style="margin-bottom: 16px; font-weight: 700; color: var(--text-main);">
        Tìm thấy <span style="color: var(--yolo-blue);">${trips.length}</span> chuyến xe khởi hành:
    </div>`;

    trips.forEach(trip => {
        const depTime = new Date(trip.departureTime);
        const arrTime = new Date(trip.arrivalTime);
        const depTimeStr = depTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const arrTimeStr = arrTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const diffMinutes = Math.round((arrTime - depTime) / (1000 * 60));
        const hours = Math.floor(diffMinutes / 60);
        const mins = diffMinutes % 60;
        const durationStr = `${hours}h${mins > 0 ? mins + 'p' : ''}`;

        const isLowSeats = trip.availableSeats <= 5;

        html += `
            <div class="trip-card" id="card-${trip.tripId}">
                <div class="trip-main-row">
                    <!-- Cột Thời gian & Tuyến -->
                    <div class="trip-timeline">
                        <div class="time-box">
                            <div class="time">${depTimeStr}</div>
                            <div class="station">${trip.departurePoint}</div>
                        </div>

                        <div class="duration-line">
                            <span class="duration-text"><i class="fa-regular fa-clock"></i> ${durationStr}</span>
                            <div class="line-bar">
                                <span class="dot"></span>
                                <i class="fa-solid fa-bus" style="color: var(--yolo-blue); font-size: 14px;"></i>
                                <span class="dot"></span>
                            </div>
                            <span style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Chạy thẳng</span>
                        </div>

                        <div class="time-box">
                            <div class="time">${arrTimeStr}</div>
                            <div class="station">${trip.destinationPoint}</div>
                        </div>
                    </div>

                    <!-- Cột Loại xe & Tiện ích -->
                    <div class="trip-specs">
                        <div class="bus-type-badge">
                            <i class="fa-solid fa-van-shuttle" style="color: var(--yolo-blue);"></i> ${trip.busType}
                        </div>
                        <div class="seats-badge ${isLowSeats ? 'low' : ''}">
                            <i class="fa-solid fa-chair"></i> Còn ${trip.availableSeats} chỗ trống
                        </div>
                        <div class="amenities-list">
                            <span class="amenity-item" title="Wifi miễn phí"><i class="fa-solid fa-wifi"></i> Wifi</span>
                            <span class="amenity-item" title="Nước uống & khăn lạnh"><i class="fa-solid fa-bottle-water"></i> Nước</span>
                            <span class="amenity-item" title="Cổng sạc USB"><i class="fa-solid fa-bolt"></i> Sạc</span>
                            <span class="amenity-item" title="Có xe trung chuyển"><i class="fa-solid fa-arrows-split-up-and-left"></i> Trung chuyển</span>
                        </div>
                    </div>

                    <!-- Cột Giá & Nút chọn -->
                    <div class="trip-action-col">
                        <div class="price-tag">${Number(trip.price).toLocaleString('vi-VN')} đ</div>
                        <button class="btn-select-trip" onclick="selectTrip('${trip.tripId}')">
                            Chọn chuyến <i class="fa-solid fa-chevron-right"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// =======================================================================
// 5. SƠ ĐỒ CHỌN GHẾ 2 TẦNG (SEAT SELECTION WIZARD)
// =======================================================================
async function selectTrip(tripId) {
    document.querySelectorAll('.trip-card').forEach(card => card.classList.remove('selected-card'));
    const targetCard = document.getElementById(`card-${tripId}`);
    if (targetCard) targetCard.classList.add('selected-card');

    try {
        const res = await fetch(`${API_BASE}/trips/${tripId}/seats`);
        const data = await res.json();

        appState.currentTrip = data;
        appState.selectedSeats = [];

        // Khởi tạo wizard
        const wizard = document.getElementById('booking-wizard');
        wizard.style.display = 'block';

        document.getElementById('seat-map-header').innerHTML = `
            <h3 style="font-size: 18px; font-weight: 800; color: var(--text-main);">
                Sơ đồ xe: ${data.busType} - Tuyến ${data.departurePoint} ➔ ${data.destinationPoint}
            </h3>
            <p style="color: var(--text-muted); font-size: 13.5px; margin-top: 4px;">
                Khởi hành lúc: <strong>${formatDateTimeVN(data.departureTime)}</strong> | 
                Giá vé: <strong>${Number(data.price).toLocaleString('vi-VN')} đ/vé</strong>
            </p>
        `;

        document.getElementById('seat-limit-hint').innerText = `(Tối đa ${appState.maxSeats} ghế theo yêu cầu đặt vé)`;

        renderSeatGrid(data.seats);
        updateSeatSummary();
        goToStep(1);

        wizard.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
        console.error('Lỗi lấy sơ đồ ghế:', err);
        showToast('Không thể tải sơ đồ ghế cho chuyến này.', 'error');
    }
}

function renderSeatGrid(seats) {
    const deck1 = document.getElementById('deck-1-seats');
    const deck2 = document.getElementById('deck-2-seats');

    deck1.innerHTML = '';
    deck2.innerHTML = '';

    const deck1Seats = seats.filter(s => s.deck === 1);
    const deck2Seats = seats.filter(s => s.deck === 2);

    deck1Seats.forEach(seat => {
        deck1.appendChild(createSeatElement(seat));
    });

    deck2Seats.forEach(seat => {
        deck2.appendChild(createSeatElement(seat));
    });
}

function createSeatElement(seat) {
    const div = document.createElement('div');
    div.id = `seat-${seat.seatNumber}`;

    if (seat.isBooked) {
        div.className = 'seat-item booked';
        div.innerText = seat.seatNumber;
        div.title = `Ghế ${seat.seatNumber} đã được đặt`;
    } else {
        div.className = 'seat-item available';
        div.innerText = seat.seatNumber;
        div.title = `Ghế ${seat.seatNumber} trống - ${Number(seat.price).toLocaleString('vi-VN')} đ`;

        div.addEventListener('click', () => handleSeatClick(seat.seatNumber));
    }

    return div;
}

function handleSeatClick(seatNum) {
    const idx = appState.selectedSeats.indexOf(seatNum);
    const seatEl = document.getElementById(`seat-${seatNum}`);

    if (idx > -1) {
        // Bỏ chọn ghế
        appState.selectedSeats.splice(idx, 1);
        if (seatEl) {
            seatEl.classList.remove('selected');
            seatEl.classList.add('available');
        }
    } else {
        // Chọn thêm ghế
        if (appState.selectedSeats.length >= appState.maxSeats) {
            showToast(`Bạn chỉ được chọn tối đa ${appState.maxSeats} ghế cho đơn này.`, 'info');
            return;
        }

        appState.selectedSeats.push(seatNum);
        if (seatEl) {
            seatEl.classList.add('selected');
            seatEl.classList.remove('available');
        }
    }

    updateSeatSummary();
}

function updateSeatSummary() {
    const summarySeatsText = document.getElementById('summary-seats-text');
    const summaryPriceText = document.getElementById('summary-price-text');
    const btnNext = document.getElementById('btn-to-step-2');

    if (appState.selectedSeats.length === 0) {
        summarySeatsText.innerText = 'Chưa chọn ghế';
        summaryPriceText.innerText = '0 đ';
        btnNext.disabled = true;
    } else {
        summarySeatsText.innerText = appState.selectedSeats.sort().join(', ');
        const total = appState.selectedSeats.length * (appState.currentTrip?.price || 0);
        summaryPriceText.innerText = `${Number(total).toLocaleString('vi-VN')} đ`;
        btnNext.disabled = false;
    }
}

// =======================================================================
// 6. CHUYỂN BƯỚC WIZARD (STEP NAVIGATION)
// =======================================================================
function goToStep(step) {
    if (step === 2) {
        if (appState.selectedSeats.length === 0) {
            showToast('Vui lòng chọn ít nhất 1 ghế để tiếp tục.', 'error');
            return;
        }
        prepareStep2();
    } else if (step === 3) {
        if (!validateStep2()) {
            return;
        }
        prepareStep3();
    }

    appState.currentStep = step;

    [1, 2, 3].forEach(s => {
        const tab = document.getElementById(`step-tab-${s}`);
        const body = document.getElementById(`wizard-step-${s}`);
        if (tab) {
            if (s === step) tab.classList.add('active');
            else tab.classList.remove('active');
        }
        if (body) {
            body.style.display = (s === step) ? 'block' : 'none';
        }
    });

    const step4Body = document.getElementById('wizard-step-4');
    if (step4Body) step4Body.style.display = (step === 4) ? 'block' : 'none';

    document.getElementById('booking-wizard').scrollIntoView({ behavior: 'smooth' });
}

// Chuẩn bị Bước 2: Tự điền thông tin & Tải bến xe
async function prepareStep2() {
    if (appState.currentUser) {
        const nameInput = document.getElementById('cust-name');
        const phoneInput = document.getElementById('cust-phone');
        const emailInput = document.getElementById('cust-email');
        if (nameInput && !nameInput.value) nameInput.value = appState.currentUser.FullName || '';
        if (phoneInput && !phoneInput.value) phoneInput.value = appState.currentUser.PhoneNumber || '';
        if (emailInput && !emailInput.value) emailInput.value = appState.currentUser.Email || '';
    }

    const trip = appState.currentTrip;
    if (!trip) return;

    try {
        const resDep = await fetch(`${API_BASE}/stations?city=${encodeURIComponent(trip.departurePoint)}`);
        const depStations = await resDep.json();
        const selectPickup = document.getElementById('select-pickup');
        selectPickup.innerHTML = depStations.map(s => `<option value="${s.name}">${s.name} (${s.address})</option>`).join('');

        const resDes = await fetch(`${API_BASE}/stations?city=${encodeURIComponent(trip.destinationPoint)}`);
        const desStations = await resDes.json();
        const selectDropoff = document.getElementById('select-dropoff');
        selectDropoff.innerHTML = desStations.map(s => `<option value="${s.name}">${s.name} (${s.address})</option>`).join('');
    } catch (e) {
        console.error('Lỗi tải bến xe:', e);
    }
}

function validateStep2() {
    const name = document.getElementById('cust-name').value.trim();
    const phone = document.getElementById('cust-phone').value.trim();
    const terms = document.getElementById('accept-terms').checked;

    if (!name) {
        showToast('Vui lòng nhập họ và tên hành khách.', 'error');
        document.getElementById('cust-name').focus();
        return false;
    }

    if (!phone.startsWith('0') || phone.length <= 9 || phone.length >= 12 || !/^\d+$/.test(phone)) {
        showToast('Số điện thoại nhận vé phải bắt đầu bằng số 0 và có từ 10 đến 11 chữ số!', 'error');
        document.getElementById('cust-phone').focus();
        return false;
    }

    if (!terms) {
        showToast('Vui lòng đồng ý với điều khoản dịch vụ của YOLO Bus Lines.', 'error');
        return false;
    }

    return true;
}

// Chuẩn bị Bước 3: Tóm tắt đơn hàng & QR Code
function prepareStep3() {
    const trip = appState.currentTrip;
    const totalAmount = appState.selectedSeats.length * trip.price;

    document.getElementById('sum-route').innerText = `${trip.departurePoint} ➔ ${trip.destinationPoint}`;
    document.getElementById('sum-time').innerText = formatDateTimeVN(trip.departureTime);
    document.getElementById('sum-bus-type').innerText = trip.busType;
    document.getElementById('sum-seats').innerText = appState.selectedSeats.join(', ');
    document.getElementById('sum-pickup').innerText = document.getElementById('select-pickup').value;
    document.getElementById('sum-dropoff').innerText = document.getElementById('select-dropoff').value;
    document.getElementById('sum-total').innerText = `${Number(totalAmount).toLocaleString('vi-VN')} đ`;
}

function selectPayMethod(method, e) {
    appState.selectedPayMethod = method;
    document.querySelectorAll('.pay-method-card').forEach(el => el.classList.remove('active'));
    const target = e?.currentTarget || event?.currentTarget || document.querySelector(`.pay-method-card input[value="${method}"]`)?.closest('.pay-method-card');
    if (target) target.classList.add('active');
}

function startCountdown() {
    if (appState.countdownTimer) clearInterval(appState.countdownTimer);
    appState.countdownSeconds = 300;

    const timerEl = document.getElementById('countdown-text');
    appState.countdownTimer = setInterval(() => {
        appState.countdownSeconds--;
        if (appState.countdownSeconds <= 0) {
            clearInterval(appState.countdownTimer);
            showToast('Hết thời gian giữ chỗ! Vui lòng thao tác lại.', 'error');
            goToStep(1);
            return;
        }

        const m = Math.floor(appState.countdownSeconds / 60);
        const s = appState.countdownSeconds % 60;
        if (timerEl) {
            timerEl.innerText = `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
        }
    }, 1000);
}

// =======================================================================
// 7. XÁC NHẬN ĐẶT VÉ & XUẤT VÉ ĐIỆN TỬ
// =======================================================================
// Hàm tạo phiên thanh toán - hiện QR ngay trong trang
async function startPaymentSession() {
    const trip = appState.currentTrip;
    const name = document.getElementById('cust-name').value.trim();
    const phone = document.getElementById('cust-phone').value.trim();
    const email = document.getElementById('cust-email').value.trim();
    const pickup = document.getElementById('select-pickup').value;
    const dropoff = document.getElementById('select-dropoff').value;

    const payload = {
        tripId: trip.tripId,
        customerName: name,
        customerPhone: phone,
        customerEmail: email,
        seats: appState.selectedSeats,
        pickupPoint: pickup,
        dropoffPoint: dropoff,
        paymentMethod: appState.selectedPayMethod
    };

    try {
        // Disable nút "Thanh toán ngay" để tránh bấm 2 lần
        const btnStart = document.getElementById('btn-start-payment');
        btnStart.disabled = true;
        btnStart.style.opacity = '0.5';
        btnStart.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tạo phiên...';

        const res = await fetch(`${API_BASE}/bookings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok && data.success) {
            if (appState.countdownTimer) clearInterval(appState.countdownTimer);
            
            // Lưu booking hiện tại
            currentSepayBooking = data.booking;

            // Hiện khu vực QR code ngay trong trang
            const qrArea = document.getElementById('payment-qr-area');
            const qrSrc = data.booking.qrUrl || `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent('YOLO-PAYMENT-' + data.booking.bookingCode)}`;
            document.getElementById('payment-qr-img').src = qrSrc;
            document.getElementById('payment-qr-amount').innerText = Number(data.booking.totalAmount).toLocaleString('vi-VN') + ' đ';
            document.getElementById('payment-qr-memo').innerText = data.booking.bookingCode;
            qrArea.style.display = 'block';

            // Ẩn nút "Thanh toán ngay" 
            btnStart.style.display = 'none';

            // Mở khóa nút "Xác nhận & Hoàn tất"
            const btnConfirm = document.getElementById('btn-confirm-payment');
            btnConfirm.disabled = false;
            btnConfirm.style.opacity = '1';
            btnConfirm.style.cursor = 'pointer';
            document.getElementById('confirm-hint').innerText = 'Sau khi chuyển khoản xong, bấm nút này để xác nhận';

            // Bắt đầu polling tự động mỗi 5 giây
            if (sepayInterval) clearInterval(sepayInterval);
            sepayInterval = setInterval(checkSePayStatus, 5000);

            showToast('Đã tạo phiên thanh toán! Quét mã QR để chuyển khoản.', 'success');
        } else {
            showToast(data.message || 'Đặt vé thất bại! Ghế có thể vừa bị giữ.', 'error');
            btnStart.disabled = false;
            btnStart.style.opacity = '1';
            btnStart.innerHTML = '<i class="fa-solid fa-qrcode"></i> Thanh toán ngay';
        }
    } catch (err) {
        console.error('Lỗi đặt vé:', err);
        showToast('Không thể kết nối đến máy chủ.', 'error');
        const btnStart = document.getElementById('btn-start-payment');
        btnStart.disabled = false;
        btnStart.style.opacity = '1';
        btnStart.innerHTML = '<i class="fa-solid fa-qrcode"></i> Thanh toán ngay';
    }
}

// Hàm kiểm tra kết quả thanh toán khi bấm "Xác nhận & Hoàn tất"
async function confirmPaymentResult() {
    if (!currentSepayBooking) {
        showToast('Vui lòng bấm "Thanh toán ngay" trước!', 'error');
        return;
    }
    try {
        showToast('Đang kiểm tra giao dịch với ngân hàng...', 'info');
        const res = await fetch(`${API_BASE}/payment/sepay/check/${currentSepayBooking.bookingCode}`);
        const data = await res.json();
        
        if (res.ok && data.success) {
            // Thanh toán thành công!
            if (sepayInterval) clearInterval(sepayInterval);
            showToast('Thanh toán thành công! Xuất vé điện tử.', 'success');
            currentSepayBooking.paymentStatus = 'Đã thanh toán';
            renderETicket(currentSepayBooking);
            goToStep(4);
        } else {
            showToast('Chưa nhận được thanh toán! Vui lòng quét mã QR và chờ thêm giây lát.', 'error');
        }
    } catch (err) {
        console.error('Lỗi check thanh toán:', err);
        showToast('Lỗi kết nối, vui lòng thử lại.', 'error');
    }
}

function renderETicket(b) {
    document.getElementById('ticket-card-code').innerText = `MÃ VÉ: ${b.bookingCode}`;
    document.getElementById('ticket-card-route').innerText = `${b.departurePoint} ➔ ${b.destinationPoint}`;
    document.getElementById('ticket-card-name').innerText = b.customerName;
    document.getElementById('ticket-card-phone').innerText = b.customerPhone;
    document.getElementById('ticket-card-time').innerText = formatDateTimeVN(b.departureTime);
    document.getElementById('ticket-card-seats').innerText = b.seats.join(', ');
    document.getElementById('ticket-card-pickup').innerText = b.pickupPoint;
    document.getElementById('ticket-card-dropoff').innerText = b.dropoffPoint;
    document.getElementById('ticket-card-bus').innerText = b.busType;
    document.getElementById('ticket-card-total').innerText = `${Number(b.totalAmount).toLocaleString('vi-VN')} đ`;

    const qrData = encodeURIComponent(`YOLO-TICKET|CODE:${b.bookingCode}|PHONE:${b.customerPhone}`);
    document.getElementById('ticket-card-qr').src = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${qrData}`;
}

function resetToHome() {
    appState.currentTrip = null;
    appState.selectedSeats = [];
    document.getElementById('booking-wizard').style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =======================================================================
// 8. TRA CỨU VÉ & HỦY VÉ
// =======================================================================
async function handleLookupTicket(e) {
    e.preventDefault();
    const code = document.getElementById('lookup-code').value.trim();
    const phone = document.getElementById('lookup-phone').value.trim();
    const container = document.getElementById('lookup-result-container');

    container.innerHTML = `
        <div style="text-align: center; padding: 25px;">
            <i class="fa-solid fa-spinner fa-spin" style="font-size: 28px; color: var(--yolo-blue);"></i>
            <p style="margin-top: 8px; color: var(--text-sub);">Đang tra cứu dữ liệu vé...</p>
        </div>
    `;

    try {
        const res = await fetch(`${API_BASE}/bookings/lookup?code=${encodeURIComponent(code)}&phone=${encodeURIComponent(phone)}`);
        const data = await res.json();

        if (res.ok && data.success && data.booking) {
            const b = data.booking;
            const isCancelled = b.paymentStatus === 'Đã hủy';

            container.innerHTML = `
                <div class="eticket-card" style="margin: 0 auto; max-width: 650px;">
                    <div class="eticket-header" style="${isCancelled ? 'background: #64748b;' : ''}">
                        <div class="ticket-brand">
                            <h3>YOLO BUS LINES</h3>
                            <span>${isCancelled ? 'VÉ NÀY ĐÃ BỊ HỦY' : 'VÉ HỢP LỆ'}</span>
                        </div>
                        <div class="ticket-code-tag">
                            ${b.bookingCode}
                        </div>
                    </div>
                    <div class="eticket-body">
                        <div class="ticket-route-banner">
                            <span class="route-text">${b.departurePoint} ➔ ${b.destinationPoint}</span>
                            <span style="background: ${isCancelled ? '#ef4444' : '#10b981'}; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 700;">
                                ${b.paymentStatus || 'Đã xác nhận'}
                            </span>
                        </div>
                        <div class="ticket-details-grid">
                            <div class="ticket-item"><div class="lbl">Hành khách</div><div class="val">${b.customerName}</div></div>
                            <div class="ticket-item"><div class="lbl">Số điện thoại</div><div class="val">${b.customerPhone}</div></div>
                            <div class="ticket-item"><div class="lbl">Thời gian đi</div><div class="val">${formatDateTimeVN(b.departureTime)}</div></div>
                            <div class="ticket-item"><div class="lbl">Ghế đặt</div><div class="val" style="color:var(--yolo-blue);">${b.seats.join(', ')}</div></div>
                            <div class="ticket-item"><div class="lbl">Điểm đón</div><div class="val" style="font-size:12.5px;">${b.pickupPoint}</div></div>
                            <div class="ticket-item"><div class="lbl">Điểm trả</div><div class="val" style="font-size:12.5px;">${b.dropoffPoint}</div></div>
                            <div class="ticket-item"><div class="lbl">Tổng tiền</div><div class="val" style="color:var(--yolo-blue);">${Number(b.totalAmount).toLocaleString('vi-VN')} đ</div></div>
                            <div class="ticket-item"><div class="lbl">Phương thức</div><div class="val">${b.paymentMethod}</div></div>
                        </div>

                        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; border-top: 1px dashed var(--border-color); padding-top: 16px;">
                            ${!isCancelled ? `
                                <button type="button" class="btn-auth btn-login" style="color:#ef4444; border-color:#ef4444;" onclick="requestCancelTicket('${b.bookingCode}')">
                                    <i class="fa-solid fa-ban"></i> Hủy vé
                                </button>
                                <button type="button" class="btn-auth btn-register" onclick="window.print()">
                                    <i class="fa-solid fa-print"></i> In vé
                                </button>
                            ` : `
                                <span style="color: var(--text-muted); font-size: 13px;">Vé đã hủy thành công, các chỗ ngồi đã được mở lại.</span>
                            `}
                        </div>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div style="text-align: center; padding: 30px; background: var(--yolo-blue-light); border-radius: 12px; border: 1px dashed var(--yolo-blue-border); max-width: 500px; margin: 0 auto;">
                    <i class="fa-solid fa-magnifying-glass" style="font-size: 32px; color: var(--yolo-blue); margin-bottom: 8px;"></i>
                    <p style="color: var(--yolo-blue); font-weight: 700;">Không tìm thấy thông tin vé!</p>
                    <p style="color: var(--text-muted); font-size: 13px; margin-top: 4px;">
                        Vui lòng kiểm tra lại chính xác Mã vé (VD: YOLO-101884) và Số điện thoại đã dùng khi đặt vé.
                    </p>
                </div>
            `;
        }
    } catch (err) {
        console.error('Lỗi tra cứu vé:', err);
        container.innerHTML = `<p style="text-align:center; color:red;">Lỗi kết nối máy chủ!</p>`;
    }
}

async function requestCancelTicket(code) {
    if (!confirm(`Bạn có chắc chắn muốn hủy vé ${code} không? Các ghế đã giữ sẽ được hoàn lại hệ thống.`)) {
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/bookings/${code}/cancel`, { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.success) {
            showToast(data.message, 'success');
            document.getElementById('lookup-form').dispatchEvent(new Event('submit'));
        } else {
            showToast(data.message || 'Không thể hủy vé.', 'error');
        }
    } catch (e) {
        console.error('Lỗi hủy vé:', e);
        showToast('Lỗi kết nối máy chủ.', 'error');
    }
}

// =======================================================================
// 9. BẢNG LỊCH TRÌNH & VÉ CỦA TÔI
// =======================================================================
let cachedSchedules = [];

async function loadScheduleData() {
    const tbody = document.getElementById('schedule-table-body');
    if (!tbody) return;

    try {
        const res = await fetch(`${API_BASE}/schedules`);
        const data = await res.json();
        cachedSchedules = data;
        renderScheduleRows(data);
    } catch (e) {
        console.error('Lỗi nạp lịch trình:', e);
    }
}

function renderScheduleRows(list) {
    const tbody = document.getElementById('schedule-table-body');
    if (!tbody) return;

    tbody.innerHTML = list.map(item => {
        const parts = item.route.split('⇄').map(s => s.trim());
        const from = parts[0] || '';
        const to = parts[1] || '';

        return `
            <tr>
                <td class="route-name">${item.route}</td>
                <td>${item.distance}</td>
                <td>${item.duration}</td>
                <td>${item.type}</td>
                <td><span class="seats-badge">${item.frequency}</span></td>
                <td style="color: var(--yolo-blue); font-weight: 700;">${item.price}</td>
                <td>
                    <button class="btn-book-shortcut" onclick="quickSelectRoute('${from.replace('TP. Hồ Chí Minh', 'Sài Gòn')}', '${to.replace('TP. Hồ Chí Minh', 'Sài Gòn')}')">
                        Đặt vé ngay
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function filterScheduleTable() {
    const val = document.getElementById('search-schedule-input').value.toLowerCase().trim();
    const filtered = cachedSchedules.filter(s => s.route.toLowerCase().includes(val));
    renderScheduleRows(filtered);
}

// Vé của tôi
function renderMyTicketsView() {
    const authPrompt = document.getElementById('my-tickets-auth-prompt');
    const listContainer = document.getElementById('my-tickets-list');

    if (appState.currentUser) {
        authPrompt.style.display = 'none';
        fetchAndRenderUserBookings(appState.currentUser.PhoneNumber);
    } else {
        authPrompt.style.display = 'block';
        listContainer.innerHTML = '';
    }
}

function loadMyTicketsByPhone() {
    const phone = document.getElementById('my-tickets-phone-input').value.trim();
    if (!phone) {
        showToast('Vui lòng nhập số điện thoại.', 'error');
        return;
    }
    fetchAndRenderUserBookings(phone);
}

async function fetchAndRenderUserBookings(phone) {
    const container = document.getElementById('my-tickets-list');
    container.innerHTML = `<p style="text-align:center; padding: 20px;">Đang tải danh sách vé...</p>`;

    try {
        const res = await fetch(`${API_BASE}/bookings/user/${encodeURIComponent(phone)}`);
        const data = await res.json();

        if (res.ok && data.success && data.bookings && data.bookings.length > 0) {
            container.innerHTML = data.bookings.map(b => `
                <div class="trip-card" style="margin-bottom: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; margin-bottom: 12px;">
                        <div>
                            <span style="font-size: 15px; font-weight: 800; color: var(--yolo-blue);">${b.bookingCode}</span>
                            <span style="color: var(--text-muted); font-size: 12.5px; margin-left: 10px;">Đặt lúc: ${formatDateTimeVN(b.createdAt)}</span>
                        </div>
                        <span style="background: ${b.paymentStatus === 'Đã hủy' ? '#ef4444' : '#10b981'}; color: white; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 700;">
                            ${b.paymentStatus || 'Đã xác nhận'}
                        </span>
                    </div>
                    <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 14px; align-items: center;">
                        <div>
                            <h4 style="font-size: 16px; color: var(--text-main);">${b.departurePoint} ➔ ${b.destinationPoint}</h4>
                            <p style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">Khởi hành: <strong>${formatDateTimeVN(b.departureTime)}</strong></p>
                            <p style="font-size: 13px; color: var(--text-muted);">Điểm đón: ${b.pickupPoint}</p>
                        </div>
                        <div>
                            <p style="font-size: 13px; color: var(--text-muted);">Ghế ngồi:</p>
                            <p style="font-size: 16px; font-weight: 800; color: var(--yolo-blue);">${b.seats.join(', ')}</p>
                        </div>
                        <div style="text-align: right;">
                            <p style="font-size: 18px; font-weight: 900; color: var(--yolo-blue);">${Number(b.totalAmount).toLocaleString('vi-VN')} đ</p>
                            <button class="btn-auth btn-login" style="margin-top: 8px; font-size: 12.5px;" onclick="quickViewTicket('${b.bookingCode}', '${b.customerPhone}')">
                                Chi tiết vé
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; background: var(--bg-card); border-radius: 12px; border: 1px dashed var(--border-color);">
                    <i class="fa-solid fa-ticket-simple" style="font-size: 36px; color: var(--text-muted); margin-bottom: 10px;"></i>
                    <p style="color: var(--text-muted); font-size: 14px;">Chưa tìm thấy vé xe nào với số điện thoại <strong>${phone}</strong>.</p>
                </div>
            `;
        }
    } catch (e) {
        console.error('Lỗi lấy lịch sử vé:', e);
        container.innerHTML = `<p style="text-align:center; color:red;">Lỗi tải dữ liệu!</p>`;
    }
}

function quickViewTicket(code, phone) {
    switchTab('lookup');
    document.getElementById('lookup-code').value = code;
    document.getElementById('lookup-phone').value = phone;
    document.getElementById('lookup-form').dispatchEvent(new Event('submit'));
}

// =======================================================================
// 10. QUẢN LÝ MODAL (AUTH & GUIDE)
// =======================================================================
function setupModals() {
    const authModal = document.getElementById('auth-modal');
    const guideModal = document.getElementById('guide-modal');

    // Nút mở login/register
    document.getElementById('btn-open-login')?.addEventListener('click', () => openAuthModal('login'));
    document.getElementById('btn-open-register')?.addEventListener('click', () => openAuthModal('register'));

    // Nút tắt X
    document.getElementById('btn-close-modal')?.addEventListener('click', closeAuthModal);
    document.getElementById('btn-close-guide')?.addEventListener('click', closeGuideModal);

    // Chuyển qua lại form login và register
    document.getElementById('link-to-register')?.addEventListener('click', (e) => {
        e.preventDefault();
        openAuthModal('register');
    });
    document.getElementById('link-to-login')?.addEventListener('click', (e) => {
        e.preventDefault();
        openAuthModal('login');
    });

    // Đóng khi click ngoài hộp modal
    window.addEventListener('click', (e) => {
        if (e.target === authModal) closeAuthModal();
        if (e.target === guideModal) closeGuideModal();
    });

    // Submit form đăng nhập
    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const phone = document.getElementById('login-phone').value.trim();
        const password = document.getElementById('login-password').value.trim();

        try {
            const res = await fetch(`${API_BASE}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, password })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                // Kiểm tra quyền nếu người dùng chọn tab Admin
                const selectedRole = document.getElementById('login-role')?.value || 'customer';
                if (selectedRole === 'admin' && !data.user.IsAdmin) {
                    showToast('Tài khoản này không có quyền Quản trị viên (Admin)!', 'error');
                    return;
                }

                appState.currentUser = data.user;
                localStorage.setItem('yolo_user', JSON.stringify(data.user));
                updateAuthUI();
                closeAuthModal();
                showToast(`Đăng nhập thành công! Chào mừng ${data.user.FullName}`, 'success');
                
                // Nếu là Admin, tự động mở trang quản trị luôn
                if (selectedRole === 'admin') {
                    setTimeout(() => {
                        window.location.href = 'admin.html';
                    }, 1000);
                }
            } else {
                showToast(data.message || 'Số điện thoại hoặc mật khẩu không chính xác!', 'error');
            }
        } catch (err) {
            console.error('Lỗi đăng nhập:', err);
            showToast('Không thể kết nối tới server Backend!', 'error');
        }
    });

    // Submit form đăng ký
    document.getElementById('register-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullname = document.getElementById('reg-fullname').value.trim();
        const phone = document.getElementById('reg-phone').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value.trim();

        // 1. Ràng buộc nghiệp vụ Số điện thoại: Bắt đầu từ 0, độ dài > 9 và < 12 (10 hoặc 11 số)
        if (!phone.startsWith('0')) {
            showToast('Số điện thoại phải bắt đầu bằng số 0!', 'error');
            document.getElementById('reg-phone').focus();
            return;
        }
        if (phone.length <= 9 || phone.length >= 12) {
            showToast('Số điện thoại phải có độ dài từ 10 đến 11 chữ số (lớn hơn 9 và nhỏ hơn 12)!', 'error');
            document.getElementById('reg-phone').focus();
            return;
        }
        if (!/^\d+$/.test(phone)) {
            showToast('Số điện thoại chỉ được chứa các ký tự số!', 'error');
            document.getElementById('reg-phone').focus();
            return;
        }

        // 2. Ràng buộc nghiệp vụ Mật khẩu: Phải có chữ, số và chữ viết hoa
        const hasUpper = /[A-Z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        const hasLetter = /[a-zA-Z]/.test(password);

        if (!hasUpper) {
            showToast('Mật khẩu phải chứa ít nhất một chữ cái viết hoa (A-Z)!', 'error');
            document.getElementById('reg-password').focus();
            return;
        }
        if (!hasNumber) {
            showToast('Mật khẩu phải chứa ít nhất một chữ số (0-9)!', 'error');
            document.getElementById('reg-password').focus();
            return;
        }
        if (!hasLetter) {
            showToast('Mật khẩu phải chứa chữ cái!', 'error');
            document.getElementById('reg-password').focus();
            return;
        }
        if (password.length < 6) {
            showToast('Mật khẩu phải có độ dài tối thiểu 6 ký tự!', 'error');
            document.getElementById('reg-password').focus();
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fullname, phone, email, password })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                showToast('Đăng ký tài khoản thành công! Vui lòng đăng nhập.', 'success');
                openAuthModal('login');
                document.getElementById('login-phone').value = phone;
            } else {
                showToast(data.message || 'Đăng ký thất bại!', 'error');
            }
        } catch (err) {
            console.error('Lỗi đăng ký:', err);
            showToast('Không thể kết nối tới server Backend!', 'error');
        }
    });
}

function openAuthModal(mode) {
    const authModal = document.getElementById('auth-modal');
    const loginSec = document.getElementById('login-section');
    const regSec = document.getElementById('register-section');

    if (!authModal) return;
    authModal.classList.add('active');

    if (mode === 'register') {
        if (loginSec) loginSec.style.display = 'none';
        if (regSec) regSec.style.display = 'block';
    } else {
        if (loginSec) loginSec.style.display = 'block';
        if (regSec) regSec.style.display = 'none';
    }
}

function closeAuthModal() {
    const authModal = document.getElementById('auth-modal');
    if (authModal) authModal.classList.remove('active');
}

function openGuideModal() {
    document.getElementById('guide-modal')?.classList.add('active');
}

function closeGuideModal() {
    document.getElementById('guide-modal')?.classList.remove('active');
}

// =======================================================================
// 11. TOAST THÔNG BÁO (NOTIFICATION TOAST)
// =======================================================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = '<i class="fa-solid fa-circle-info" style="color:var(--yolo-blue);"></i>';
    if (type === 'success') icon = '<i class="fa-solid fa-circle-check" style="color:#10b981;"></i>';
    if (type === 'error') icon = '<i class="fa-solid fa-circle-exclamation" style="color:#ef4444;"></i>';

    toast.innerHTML = `
        ${icon}
        <span style="flex: 1;">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.4s';
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

// Hàm chuyển đổi quyền đăng nhập
function switchLoginRole(role) {
    const btnCustomer = document.getElementById('tab-login-customer');
    const btnAdmin = document.getElementById('tab-login-admin');
    const roleInput = document.getElementById('login-role');
    
    if (roleInput) roleInput.value = role;

    if (role === 'admin') {
        // Active Admin
        btnAdmin.style.background = 'var(--yolo-blue)';
        btnAdmin.style.color = 'white';
        btnAdmin.style.borderColor = 'var(--yolo-blue)';
        // Deactive Customer
        btnCustomer.style.background = 'transparent';
        btnCustomer.style.color = 'var(--text-main)';
        btnCustomer.style.borderColor = 'var(--border-color)';
    } else {
        // Active Customer
        btnCustomer.style.background = 'var(--yolo-blue)';
        btnCustomer.style.color = 'white';
        btnCustomer.style.borderColor = 'var(--yolo-blue)';
        // Deactive Admin
        btnAdmin.style.background = 'transparent';
        btnAdmin.style.color = 'var(--text-main)';
        btnAdmin.style.borderColor = 'var(--border-color)';
    }
}

// =======================================================================
// 12. LOGIC THANH TOÁN SEPAY (POLLING)
// =======================================================================

function openSePayModal(booking) {
    currentSepayBooking = booking;
    const modal = document.getElementById('sepay-modal');
    
    // Nếu server trả về qrUrl thì dùng, nếu không thì tạo fallback
    const qrSrc = booking.qrUrl || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent('YOLO-PAYMENT-' + booking.bookingCode)}`;
    document.getElementById('sepay-qr-img').src = qrSrc;
    document.getElementById('sepay-amount').innerText = Number(booking.totalAmount).toLocaleString('vi-VN') + ' đ';
    document.getElementById('sepay-memo').innerText = booking.bookingCode;
    
    modal.style.display = 'block';

    // Bắt đầu polling mỗi 5 giây
    if (sepayInterval) clearInterval(sepayInterval);
    sepayInterval = setInterval(checkSePayStatus, 5000);
}

function cancelSePayPayment() {
    if (sepayInterval) clearInterval(sepayInterval);
    document.getElementById('sepay-modal').style.display = 'none';
    showToast('Bạn đã chọn thanh toán sau. Ghế đã được giữ.', 'info');
    renderETicket(currentSepayBooking);
    goToStep(4);
}

async function manualCheckSePay() {
    if (!currentSepayBooking) return;
    try {
        showToast('Đang kiểm tra giao dịch với ngân hàng...', 'info');
        const res = await fetch(`${API_BASE}/payment/sepay/check/${currentSepayBooking.bookingCode}`);
        const data = await res.json();
        
        if (res.ok && data.success) {
            // Thanh toán thành công!
            clearInterval(sepayInterval);
            document.getElementById('sepay-modal').style.display = 'none';
            showToast('Đã nhận được thanh toán! Xuất vé thành công.', 'success');
            
            // Cập nhật lại trạng thái vé trên UI
            currentSepayBooking.paymentStatus = 'Đã thanh toán';
            renderETicket(currentSepayBooking);
            goToStep(4);
        } else {
            showToast('Giao dịch chưa thành công, vui lòng chờ thêm giây lát!', 'error');
        }
    } catch (err) {
        console.error('Lỗi khi check SePay:', err);
    }
}

async function checkSePayStatus() {
    if (!currentSepayBooking) return;
    try {
        const res = await fetch(`${API_BASE}/payment/sepay/check/${currentSepayBooking.bookingCode}`);
        const data = await res.json();
        
        if (res.ok && data.success) {
            // Thanh toán thành công!
            clearInterval(sepayInterval);
            document.getElementById('sepay-modal').style.display = 'none';
            showToast('Đã nhận được thanh toán! Xuất vé thành công.', 'success');
            
            // Cập nhật lại trạng thái vé trên UI
            currentSepayBooking.paymentStatus = 'Đã thanh toán';
            renderETicket(currentSepayBooking);
            goToStep(4);
        }
    } catch (err) {
        console.error('Lỗi khi polling SePay:', err);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (typeof flatpickr !== 'undefined') {
        flatpickr("input[type='date']", {
            dateFormat: "Y-m-d",
            altInput: true,
            altFormat: "d/m/y",
            locale: "vn"
        });
    }
});
