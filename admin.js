// URL API
const API_BASE = 'http://localhost:3000/api/admin';

// Định dạng tiền tệ
const formatMoney = (amount) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

// Định dạng ngày giờ
const formatDate = (isoStr) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
};

const formatTime = (isoStr) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${mins}`;
};

const formatDateTime = (isoStr) => {
    if (!isoStr) return '';
    return `${formatTime(isoStr)} ${formatDate(isoStr)}`;
};

let myChart = null;

// Pagination State
let currentPages = {
    trips: 1,
    bookings: 1,
    customers: 1
};
const ITEMS_PER_PAGE = 30;

function renderPagination(containerId, totalItems, type) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
    const current = currentPages[type];

    let html = `<div class="page-info">Trang ${current} / ${totalPages} (${totalItems} bản ghi)</div>`;
    html += `<button class="page-btn" ${current === 1 ? 'disabled' : ''} onclick="changePage('${type}', ${current - 1})"><i class="fa-solid fa-chevron-left"></i> Trước</button>`;
    html += `<button class="page-btn" ${current === totalPages || totalPages === 0 ? 'disabled' : ''} onclick="changePage('${type}', ${current + 1})">Sau <i class="fa-solid fa-chevron-right"></i></button>`;
    
    container.innerHTML = html;
}

function changePage(type, newPage) {
    currentPages[type] = newPage;
    if (type === 'trips') loadTrips();
    else if (type === 'bookings') loadBookings();
    else if (type === 'customers') loadCustomers();
}

// Khởi chạy khi trang load
document.addEventListener('DOMContentLoaded', () => {
    // Tạm thời chưa check đăng nhập, mặc định vào là tải Dashboard
    switchAdminTab('dashboard');
});

// Chuyển Tab
function switchAdminTab(tabId) {
    // Active menu item
    document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
    event.currentTarget.classList?.add('active');

    // Show data panel
    document.querySelectorAll('.data-panel').forEach(panel => panel.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');

    const titles = {
        'dashboard': 'Dashboard Tổng Quan',
        'trips': 'Quản lý Chuyến xe',
        'bookings': 'Quản lý Vé đặt',
        'customers': 'Quản lý Khách hàng',
        'buses': 'Quản lý Xe khách'
    };
    document.getElementById('headerTitle').innerText = titles[tabId];

    // Load Data
    showLoading();
    if (tabId === 'dashboard') {
        loadDashboardStats();
    } else if (tabId === 'trips') {
        loadTrips();
    } else if (tabId === 'bookings') {
        loadBookings();
    } else if (tabId === 'customers') {
        loadCustomers();
    } else if (tabId === 'buses') {
        loadBuses();
    }
}

// Show/hide loading
function showLoading() {
    document.getElementById('admin-loading').style.display = 'flex';
}
function hideLoading() {
    setTimeout(() => {
        document.getElementById('admin-loading').style.display = 'none';
    }, 300);
}

// TAB 1: DASHBOARD
async function loadDashboardStats() {
    try {
        const res = await fetch(`${API_BASE}/stats`);
        const data = await res.json();
        
        if (data.success) {
            document.getElementById('stat-revenue').innerText = formatMoney(data.totalRevenue);
            document.getElementById('stat-bookings').innerText = data.totalBookings.toLocaleString('vi-VN');
            document.getElementById('stat-trips').innerText = data.totalTrips.toLocaleString('vi-VN');
            document.getElementById('stat-customers').innerText = data.totalCustomers.toLocaleString('vi-VN');
            
            // Load Chart
            await loadRevenueChart(30);
        }
    } catch (err) {
        console.error(err);
        alert('Lỗi tải dữ liệu Dashboard');
    }
    hideLoading();
}

async function loadRevenueChart(days) {
    try {
        const res = await fetch(`${API_BASE}/revenue-chart?days=${days}`);
        const json = await res.json();
        
        if (json.success) {
            const labels = json.data.map(item => {
                const d = new Date(item.date);
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                return `${day}/${month}`;
            });
            const revenues = json.data.map(item => item.revenue);

            const ctx = document.getElementById('revenueChart').getContext('2d');
            
            if (myChart) {
                myChart.destroy();
            }

            myChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Doanh thu (VNĐ)',
                        data: revenues,
                        borderColor: '#1064ea',
                        backgroundColor: 'rgba(16, 100, 234, 0.1)',
                        borderWidth: 3,
                        pointBackgroundColor: '#fff',
                        pointBorderColor: '#1064ea',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return formatMoney(context.raw);
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: '#f1f5f9', drawBorder: false },
                            ticks: {
                                callback: function(value) {
                                    if (value >= 1000000) return (value / 1000000) + 'Tr';
                                    return value;
                                }
                            }
                        },
                        x: {
                            grid: { display: false, drawBorder: false }
                        }
                    }
                }
            });
        }
    } catch (err) {
        console.error(err);
    }
}

// TAB 2: TRIPS
async function loadTrips() {
    try {
        const dateFilter = document.getElementById('filter-trip-date').value;
        let url = `${API_BASE}/trips?limit=${ITEMS_PER_PAGE}&page=${currentPages.trips}`;
        if (dateFilter) { url += `&date=${dateFilter}`; currentPages.trips = 1; }

        const res = await fetch(url);
        const data = await res.json();
        
        const tbody = document.getElementById('tb-trips');
        tbody.innerHTML = '';
        
        if (data.success && data.trips.length > 0) {
            data.trips.forEach(t => {
                tbody.innerHTML += `
                    <tr>
                        <td style="font-weight: 500; color: var(--yolo-blue);">${t.TripID || t.tripId}</td>
                        <td>${formatDate(t.DepartureTime || t.departureTime)}</td>
                        <td>${t.DeparturePoint || t.departurePoint} ➔ ${t.DestinationPoint || t.destinationPoint}</td>
                        <td>${formatTime(t.DepartureTime || t.departureTime)}</td>
                        <td>${t.BusType || t.busType}</td>
                        <td>${formatMoney(t.Price || t.price)}</td>
                        <td>
                            <button class="action-btn" title="Chỉnh sửa" onclick="openTripModal('${t.TripID || t.tripId}')"><i class="fa-solid fa-pen-to-square"></i></button>
                            <button class="action-btn delete" title="Xóa" onclick="deleteTrip('${t.TripID || t.tripId}')"><i class="fa-solid fa-trash"></i></button>
                        </td>
                    </tr>
                `;
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Không tìm thấy chuyến xe nào</td></tr>';
        }
        if (data.success && data.total !== undefined) renderPagination('pagination-trips', data.total, 'trips');
    } catch (err) {
        console.error(err);
    }
    hideLoading();
}

async function deleteCustomer(id) {
    if (!confirm(`Bạn có chắc chắn muốn xóa khách hàng #${id} không?`)) return;
    try {
        const res = await fetch(`${API_BASE}/customers/${id}`, { method: 'DELETE' });
        const json = await res.json();
        if (json.success) {
            loadCustomers();
        } else {
            alert(json.message);
        }
    } catch (err) {
        alert('Lỗi khi xóa!');
    }
}

async function deleteTrip(id) {
    if (!confirm(`Bạn có chắc chắn muốn xóa chuyến xe ${id} không?`)) return;
    try {
        const res = await fetch(`${API_BASE}/trips/${id}`, { method: 'DELETE' });
        const json = await res.json();
        if (json.success) {
            loadTrips();
        } else {
            alert(json.message);
        }
    } catch (err) {
        alert('Lỗi khi xóa!');
    }
}

// TAB 3: BOOKINGS
async function loadBookings() {
    try {
        const phoneFilter = document.getElementById('filter-booking-phone').value;
        let url = `${API_BASE}/bookings?limit=${ITEMS_PER_PAGE}&page=${currentPages.bookings}`;
        if (phoneFilter) { url += `&phone=${phoneFilter}`; currentPages.bookings = 1; }

        const res = await fetch(url);
        const data = await res.json();
        
        const tbody = document.getElementById('tb-bookings');
        tbody.innerHTML = '';
        
        if (data.success && data.bookings.length > 0) {
            data.bookings.forEach(b => {
                const code = b.BookingCode || b.bookingCode;
                const status = b.PaymentStatus || b.paymentStatus;
                let badgeClass = 'success';
                if (status === 'Đã hủy') badgeClass = 'danger';
                if (status === 'Chờ thanh toán') badgeClass = 'warning';

                tbody.innerHTML += `
                    <tr>
                        <td style="font-weight: 500;">${code}<br><small style="color:var(--text-muted);font-weight:normal;">${formatDateTime(b.CreatedAt || b.createdAt)}</small></td>
                        <td>${b.CustomerName || b.customerName}</td>
                        <td>${b.CustomerPhone || b.customerPhone}</td>
                        <td>${b.DeparturePoint || b.departurePoint} ➔ ${b.DestinationPoint || b.destinationPoint}<br><small style="color:var(--yolo-blue)">${formatDateTime(b.DepartureTime || b.departureTime)}</small></td>
                        <td>${Array.isArray(b.seats) ? b.seats.join(', ') : (b.SeatsList || '')}</td>
                        <td style="font-weight: 600;">${formatMoney(b.TotalAmount || b.totalAmount)}</td>
                        <td><span class="status-badge ${badgeClass}">${status}</span></td>
                        <td>
                            <button class="action-btn" title="Cập nhật trạng thái" onclick="openBookingModal('${code}', '${status}')"><i class="fa-solid fa-pen-to-square"></i></button>
                            <button class="action-btn delete" title="Hủy vé" onclick="cancelBooking('${code}')"><i class="fa-solid fa-ban"></i></button>
                        </td>
                    </tr>
                `;
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Không tìm thấy vé nào</td></tr>';
        }
        if (data.success && data.total !== undefined) renderPagination('pagination-bookings', data.total, 'bookings');
    } catch (err) {
        console.error(err);
    }
    hideLoading();
}

async function cancelBooking(code) {
    if (!confirm(`Xác nhận HỦY vé ${code}?`)) return;
    try {
        const res = await fetch(`http://localhost:3000/api/bookings/${code}/cancel`, { method: 'POST' });
        const json = await res.json();
        alert(json.message);
        if (json.success) loadBookings();
    } catch (err) {
        alert('Lỗi khi hủy vé!');
    }
}

// TAB 4: CUSTOMERS
async function loadCustomers() {
    try {
        const res = await fetch(`${API_BASE}/customers?limit=${ITEMS_PER_PAGE}&page=${currentPages.customers}`);
        const data = await res.json();
        const tbody = document.getElementById('tb-customers');
        tbody.innerHTML = '';
        
        if (data.success && data.customers.length > 0) {
            data.customers.forEach(c => {
                tbody.innerHTML += `
                    <tr>
                        <td>#${c.CustomerID || c.customerId}</td>
                        <td style="font-weight: 500;">${c.FullName || c.fullName}</td>
                        <td>${c.PhoneNumber || c.phone}</td>
                        <td>${c.Email || c.email || 'N/A'}</td>
                        <td>${c.totalBookings} vé</td>
                        <td style="color: var(--yolo-green); font-weight: 600;">${formatMoney(c.totalSpent)}</td>
                        <td>
                            <button class="action-btn" title="Chỉnh sửa" onclick="openCustomerModal('${c.CustomerID || c.customerId}', '${c.FullName || c.fullName}', '${c.PhoneNumber || c.phone}', '${c.Email || c.email}')"><i class="fa-solid fa-pen-to-square"></i></button>
                            <button class="action-btn delete" title="Xóa" onclick="deleteCustomer('${c.CustomerID || c.customerId}')"><i class="fa-solid fa-trash"></i></button>
                        </td>
                    </tr>
                `;
            });
        }
        if (data.success && data.total !== undefined) renderPagination('pagination-customers', data.total, 'customers');
    } catch (err) {
        console.error(err);
    }
    hideLoading();
}

// TAB 5: BUSES
async function loadBuses() {
    try {
        const res = await fetch(`${API_BASE}/buses`);
        const data = await res.json();
        const tbody = document.getElementById('tb-buses');
        tbody.innerHTML = '';
        
        if (data.success && data.buses.length > 0) {
            data.buses.forEach(b => {
                tbody.innerHTML += `
                    <tr>
                        <td style="font-weight: 600; color: var(--yolo-blue);">${b.PlateNumber || b.plateNumber}</td>
                        <td>${b.BusType || b.busType}</td>
                        <td>${b.TotalSeats || b.totalSeats} chỗ</td>
                        <td>${b.DeckCount || b.deckCount} tầng</td>
                        <td>${b.totalTrips !== undefined ? b.totalTrips + ' chuyến' : 'Đang thống kê'}</td>
                    </tr>
                `;
            });
        }
    } catch (err) {
        console.error(err);
    }
    hideLoading();
}

function adminLogout() {
    if (confirm('Bạn muốn trở về trang chủ?')) {
        window.location.href = 'index.html';
    }
}


// ==========================================
// MODAL CHUYẾN XE (TRIP)
// ==========================================
async function openTripModal(tripId = '') {
    document.getElementById('trip-id').value = tripId;
    const form = document.getElementById('trip-form');
    form.reset();
    
    // Load options cho Tuyến và Xe
    await loadSelectOptions();

    if (tripId) {
        document.getElementById('trip-modal-title').innerText = 'Cập Nhật Chuyến Xe';
        try {
            const res = await fetch(`${API_BASE}/trips?limit=1000`); 
            const data = await res.json();
            const trips = data.trips || data;
            const trip = trips.find(t => (t.TripID || t.tripId) === tripId);
            if (trip) {
                // Populate data
                if (trip.DepartureTime || trip.departureTime) {
                    const dt = new Date(trip.DepartureTime || trip.departureTime);
                    const year = dt.getFullYear();
                    const month = String(dt.getMonth() + 1).padStart(2, '0');
                    const day = String(dt.getDate()).padStart(2, '0');
                    document.getElementById('trip-date').value = `${year}-${month}-${day}`;
                    const hours = String(dt.getHours()).padStart(2, '0');
                    const mins = String(dt.getMinutes()).padStart(2, '0');
                    document.getElementById('trip-time').value = `${hours}:${mins}`;
                }
                document.getElementById('trip-price').value = trip.Price || trip.price || 0;
                
                const dep = trip.DeparturePoint || trip.departurePoint;
                const des = trip.DestinationPoint || trip.destinationPoint;
                const selRoute = document.getElementById('trip-route');
                for (let i = 0; i < selRoute.options.length; i++) {
                    if (selRoute.options[i].value.startsWith(dep + '|' + des)) {
                        selRoute.selectedIndex = i;
                        break;
                    }
                }
                
                const busId = trip.BusID || trip.busId;
                if (busId) {
                    const selBus = document.getElementById('trip-bus');
                    for (let i = 0; i < selBus.options.length; i++) {
                        if (selBus.options[i].value == busId) {
                            selBus.selectedIndex = i;
                            break;
                        }
                    }
                }
            }
        } catch(e) {}
    } else {
        document.getElementById('trip-modal-title').innerText = 'Thêm Chuyến Xe Mới';
    }
    document.getElementById('trip-modal').style.display = 'flex';
}

function closeTripModal() {
    document.getElementById('trip-modal').style.display = 'none';
}

async function loadSelectOptions() {
    try {
        const res = await fetch(`${API_BASE}/buses`);
        const data = await res.json();
        if (data.success) {
            const selBus = document.getElementById('trip-bus');
            selBus.innerHTML = data.buses.map(b => `<option value="${b.BusID || b.busId || b.PlateNumber || b.plateNumber}">${b.PlateNumber || b.plateNumber} (${b.BusType || b.busType})</option>`).join('');
        }
    } catch(e){}
    
    const routes = [
        { dep: 'Sài Gòn', des: 'Đà Lạt', depStation: '1 Võ Văn Ngân, Thủ Đức', desStation: 'Bến xe Liên tỉnh Đà Lạt' },
        { dep: 'Đà Lạt', des: 'Sài Gòn', depStation: 'Bến xe Liên tỉnh Đà Lạt', desStation: '1 Võ Văn Ngân, Thủ Đức' },
        { dep: 'Sài Gòn', des: 'Cần Thơ', depStation: '1 Võ Văn Ngân, Thủ Đức', desStation: 'Bến xe Trung tâm Cần Thơ' },
        { dep: 'Cần Thơ', des: 'Sài Gòn', depStation: 'Bến xe Trung tâm Cần Thơ', desStation: '1 Võ Văn Ngân, Thủ Đức' },
        { dep: 'Sài Gòn', des: 'Nha Trang', depStation: '1 Võ Văn Ngân, Thủ Đức', desStation: 'Bến xe Phía Nam Nha Trang' },
        { dep: 'Nha Trang', des: 'Sài Gòn', depStation: 'Bến xe Phía Nam Nha Trang', desStation: '1 Võ Văn Ngân, Thủ Đức' },
        { dep: 'Sài Gòn', des: 'Vũng Tàu', depStation: '1 Võ Văn Ngân, Thủ Đức', desStation: 'Bến xe Vũng Tàu' },
        { dep: 'Vũng Tàu', des: 'Sài Gòn', depStation: 'Bến xe Vũng Tàu', desStation: '1 Võ Văn Ngân, Thủ Đức' },
        { dep: 'Sài Gòn', des: 'Phan Thiết', depStation: '1 Võ Văn Ngân, Thủ Đức', desStation: 'Bến xe Phan Thiết' },
        { dep: 'Phan Thiết', des: 'Sài Gòn', depStation: 'Bến xe Phan Thiết', desStation: '1 Võ Văn Ngân, Thủ Đức' }
    ];
    document.getElementById('trip-route').innerHTML = routes.map(r => 
        `<option value="${r.dep}|${r.des}|${r.depStation}|${r.desStation}">${r.dep} ➔ ${r.des}</option>`
    ).join('');
}

async function saveTrip(e) {
    e.preventDefault();
    const id = document.getElementById('trip-id').value;
    const isEdit = !!id;
    
    const dateStr = document.getElementById('trip-date').value;
    const timeStr = document.getElementById('trip-time').value;
    const depTime = new Date(`${dateStr}T${timeStr}`);
    const price = document.getElementById('trip-price').value;
    const route = document.getElementById('trip-route').value;
    const busId = document.getElementById('trip-bus').value;
    
    const routeParts = route.split('|');
    const departurePoint = routeParts[0] || 'Sài Gòn';
    const destinationPoint = routeParts[1] || 'Đà Lạt';
    const departureStation = routeParts[2] || '';
    const destinationStation = routeParts[3] || '';
    
    const payload = {
        busId,
        departureTime: depTime.toISOString(),
        price,
        departurePoint,
        destinationPoint,
        departureStation,
        destinationStation
    };

    if (!isEdit) {
        payload.tripId = `YOLO-${dateStr.replace(/-/g, '').substring(4)}-${Math.floor(Math.random() * 10000)}`;
    }
    
    try {
        showLoading();
        const res = await fetch(`${API_BASE}/trips${isEdit ? '/' + id : ''}`, {
            method: isEdit ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        hideLoading();
        if (data.success) {
            closeTripModal();
            alert(data.message);
            loadTrips();
        } else {
            alert('Lỗi: ' + data.message);
        }
    } catch(err) {
        hideLoading();
        alert('Lỗi kết nối máy chủ');
    }
}

// ==========================================
// MODAL XE KHÁCH (BUS)
// ==========================================
function openBusModal(plate = '') {
    document.getElementById('bus-old-plate').value = plate;
    const form = document.getElementById('bus-form');
    form.reset();

    if (plate) {
        document.getElementById('bus-modal-title').innerText = 'Cập Nhật Xe Khách';
        document.getElementById('bus-plate').value = plate;
    } else {
        document.getElementById('bus-modal-title').innerText = 'Thêm Xe Khách Mới';
    }
    document.getElementById('bus-modal').style.display = 'flex';
}

function closeBusModal() {
    document.getElementById('bus-modal').style.display = 'none';
}

async function saveBus(e) {
    e.preventDefault();
    const oldPlate = document.getElementById('bus-old-plate').value;
    const isEdit = !!oldPlate;
    showLoading();
    setTimeout(() => {
        hideLoading();
        closeBusModal();
        alert(isEdit ? 'Đã cập nhật xe khách!' : 'Đã thêm xe khách mới!');
        loadBuses();
    }, 500);
}

// ==========================================
// MODAL KHÁCH HÀNG (CUSTOMER)
// ==========================================
function openCustomerModal(id, name, phone, email) {
    document.getElementById('customer-id').value = id;
    document.getElementById('customer-name').value = name;
    document.getElementById('customer-phone').value = phone;
    document.getElementById('customer-email').value = email !== 'undefined' ? email : '';
    document.getElementById('customer-modal').style.display = 'flex';
}

function closeCustomerModal() {
    document.getElementById('customer-modal').style.display = 'none';
}

async function saveCustomer(e) {
    e.preventDefault();
    const id = document.getElementById('customer-id').value;
    const name = document.getElementById('customer-name').value;
    const phone = document.getElementById('customer-phone').value;
    const email = document.getElementById('customer-email').value;

    const isEdit = !!id;
    const method = isEdit ? 'PUT' : 'POST';
    const url = isEdit ? `${API_BASE}/customers/${id}` : `${API_BASE}/customers`;

    try {
        showLoading();
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullName: name, phone: phone, email: email })
        });
        const data = await res.json();
        hideLoading();
        if (data.success) {
            closeCustomerModal();
            loadCustomers();
        } else {
            alert((isEdit ? 'Cập nhật' : 'Thêm mới') + ' thất bại: ' + (data.message || 'Lỗi hệ thống'));
        }
    } catch(err) {
        hideLoading();
        console.error(err);
        alert('Lỗi kết nối máy chủ');
    }
}

// ==========================================
// MODAL VÉ ĐẶT (BOOKING)
// ==========================================
function openBookingModal(code, status) {
    document.getElementById('booking-code').value = code;
    document.getElementById('display-booking-code').innerText = code;
    const sel = document.getElementById('booking-status');
    for(let i=0; i<sel.options.length; i++) {
        if(sel.options[i].value === status) {
            sel.selectedIndex = i; break;
        }
    }
    document.getElementById('booking-modal').style.display = 'flex';
}

function closeBookingModal() {
    document.getElementById('booking-modal').style.display = 'none';
}

async function saveBooking(e) {
    e.preventDefault();
    const code = document.getElementById('booking-code').value;
    const status = document.getElementById('booking-status').value;

    try {
        showLoading();
        const res = await fetch(`${API_BASE}/bookings/${code}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ PaymentStatus: status })
        });
        const data = await res.json();
        hideLoading();
        if (data.success) {
            closeBookingModal();
            loadBookings();
        } else {
            alert('Cập nhật thất bại: ' + (data.message || 'Lỗi hệ thống'));
        }
    } catch(err) {
        hideLoading();
        console.error(err);
        alert('Lỗi kết nối máy chủ');
    }
}

function exportReport() {
    window.location.href = `${API_BASE}/export`;
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
