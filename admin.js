// URL API
const API_BASE = 'http://localhost:3000/api/admin';

// Định dạng tiền tệ
const formatMoney = (amount) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

// Định dạng ngày giờ
const formatDateTime = (isoStr) => {
    const d = new Date(isoStr);
    return d.toLocaleString('vi-VN');
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
                const parts = item.date.split('-');
                return `${parts[2]}/${parts[1]}`;
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
                        <td>${(t.DepartureDate || t.departureDate) ? (t.DepartureDate || t.departureDate) : new Date(t.DepartureTime || t.departureTime).toLocaleDateString('vi-VN')}</td>
                        <td>${t.DeparturePoint || t.departurePoint} ➔ ${t.DestinationPoint || t.destinationPoint}</td>
                        <td>${new Date(t.DepartureTime || t.departureTime).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}</td>
                        <td>${t.BusType || t.busType}</td>
                        <td>${formatMoney(t.Price || t.price)}</td>
                        <td>
                            <button class="action-btn" title="Chỉnh sửa"><i class="fa-solid fa-pen-to-square"></i></button>
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
                        <td style="font-weight: 500;">${code}</td>
                        <td>${b.CustomerName || b.customerName}</td>
                        <td>${b.CustomerPhone || b.customerPhone}</td>
                        <td>${b.DeparturePoint || b.departurePoint} ➔ ${b.DestinationPoint || b.destinationPoint}</td>
                        <td>${Array.isArray(b.seats) ? b.seats.join(', ') : (b.SeatsList || '')}</td>
                        <td style="font-weight: 600;">${formatMoney(b.TotalAmount || b.totalAmount)}</td>
                        <td><span class="status-badge ${badgeClass}">${status}</span></td>
                        <td>
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
