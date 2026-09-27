-- =======================================================================
-- HỆ THỐNG ĐẶT VÉ XE KHÁCH YOLO BUS LINES
-- CƠ SỞ DỮ LIỆU: BusTicketDB
-- Bao gồm: Tạo bảng + Nạp dữ liệu mẫu phong phú (30 ngày lịch sử)
-- =======================================================================

USE master;
GO

IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'BusTicketDB')
BEGIN
    CREATE DATABASE BusTicketDB;
END
GO

USE BusTicketDB;
GO

-- ==========================================
-- 1. XÓA BẢNG CŨ NẾU ĐÃ TỒN TẠI
-- ==========================================
IF OBJECT_ID('dbo.BookingDetail', 'U') IS NOT NULL DROP TABLE dbo.BookingDetail;
IF OBJECT_ID('dbo.Booking', 'U') IS NOT NULL DROP TABLE dbo.Booking;
IF OBJECT_ID('dbo.Trip', 'U') IS NOT NULL DROP TABLE dbo.Trip;
IF OBJECT_ID('dbo.Bus', 'U') IS NOT NULL DROP TABLE dbo.Bus;
IF OBJECT_ID('dbo.Station', 'U') IS NOT NULL DROP TABLE dbo.Station;
IF OBJECT_ID('dbo.Customer', 'U') IS NOT NULL DROP TABLE dbo.Customer;
GO

-- ==========================================
-- 2. TẠO BẢNG
-- ==========================================

-- Bảng Khách hàng
CREATE TABLE Customer (
    CustomerID INT IDENTITY(1,1) PRIMARY KEY,
    FullName NVARCHAR(100) NOT NULL,
    PhoneNumber VARCHAR(15) UNIQUE NOT NULL,
    Password VARCHAR(255) NOT NULL,
    Email VARCHAR(100) NULL,
    IDCard VARCHAR(20) NULL,
    IsAdmin BIT DEFAULT 0,
    CreatedAt DATETIME DEFAULT GETDATE()
);

-- Bảng Xe khách
CREATE TABLE Bus (
    BusID INT IDENTITY(1,1) PRIMARY KEY,
    PlateNumber VARCHAR(20) NOT NULL UNIQUE,
    BusType NVARCHAR(50) NOT NULL,
    TotalSeats INT NOT NULL,
    DeckCount INT DEFAULT 2
);

-- Bảng Bến xe / Điểm đón trả
CREATE TABLE Station (
    StationID INT IDENTITY(1,1) PRIMARY KEY,
    CityName NVARCHAR(50) NOT NULL,
    StationName NVARCHAR(150) NOT NULL,
    Address NVARCHAR(255) NOT NULL
);

-- Bảng Chuyến xe
CREATE TABLE Trip (
    TripID VARCHAR(30) PRIMARY KEY,
    BusID INT FOREIGN KEY REFERENCES Bus(BusID),
    DeparturePoint NVARCHAR(100) NOT NULL,
    DestinationPoint NVARCHAR(100) NOT NULL,
    DepartureStation NVARCHAR(150) NOT NULL,
    DestinationStation NVARCHAR(150) NOT NULL,
    DepartureTime DATETIME NOT NULL,
    ArrivalTime DATETIME NOT NULL,
    Price DECIMAL(18,0) NOT NULL,
    Status NVARCHAR(30) DEFAULT N'Sẵn sàng'
);

-- Bảng Đặt vé
CREATE TABLE Booking (
    BookingID INT IDENTITY(1,1) PRIMARY KEY,
    BookingCode VARCHAR(30) UNIQUE NOT NULL,
    CustomerID INT NULL FOREIGN KEY REFERENCES Customer(CustomerID),
    CustomerName NVARCHAR(100) NOT NULL,
    CustomerPhone VARCHAR(15) NOT NULL,
    CustomerEmail VARCHAR(100) NULL,
    TripID VARCHAR(30) FOREIGN KEY REFERENCES Trip(TripID),
    PickupPoint NVARCHAR(255) NOT NULL,
    DropoffPoint NVARCHAR(255) NOT NULL,
    TotalAmount DECIMAL(18,0) NOT NULL,
    PaymentMethod NVARCHAR(50) NOT NULL,
    PaymentStatus NVARCHAR(50) DEFAULT N'Đã thanh toán',
    CreatedAt DATETIME DEFAULT GETDATE()
);

-- Bảng Chi tiết vé (ghế đã đặt)
CREATE TABLE BookingDetail (
    DetailID INT IDENTITY(1,1) PRIMARY KEY,
    BookingID INT FOREIGN KEY REFERENCES Booking(BookingID) ON DELETE CASCADE,
    SeatNumber VARCHAR(10) NOT NULL,
    Price DECIMAL(18,0) NOT NULL,
    Deck INT DEFAULT 1
);
GO

-- ==========================================
-- 3. NẠP DỮ LIỆU TĨNH
-- ==========================================

-- 3a. Xe khách (8 xe)
INSERT INTO Bus (PlateNumber, BusType, TotalSeats, DeckCount) VALUES
('51B-123.45', N'Giường nằm 40 chỗ', 40, 2),
('51B-678.90', N'Limousine VIP 34 phòng', 34, 2),
('51B-999.88', N'Cabin 22 phòng VIP', 22, 2),
('49B-012.34', N'Giường nằm 40 chỗ', 40, 2),
('79B-555.66', N'Limousine VIP 34 phòng', 34, 2),
('72B-888.99', N'Giường nằm 40 chỗ', 40, 2),
('51B-111.22', N'Cabin 22 phòng VIP', 22, 2),
('49B-333.44', N'Limousine VIP 34 phòng', 34, 2);

-- 3b. Khách hàng (1 admin + 1000 khách)
INSERT INTO Customer (FullName, PhoneNumber, Password, Email, IsAdmin) VALUES
(N'Admin YOLO', '0963076842', 'Admin123', 'hien05082006@gmail.com', 1);

DECLARE @i INT = 1;
DECLARE @Phone VARCHAR(15);
DECLARE @FullName NVARCHAR(100);
DECLARE @Email VARCHAR(100);

WHILE @i <= 1000
BEGIN
    SET @Phone = '09' + RIGHT('00000000' + CAST(10000000 + @i AS VARCHAR), 8);
    SET @FullName = CHOOSE((@i % 6) + 1, N'Nguyễn', N'Trần', N'Lê', N'Phạm', N'Hoàng', N'Vũ') + N' ' + 
                    CHOOSE((@i % 4) + 1, N'Văn', N'Thị', N'Thanh', N'Gia') + N' ' + 
                    CHOOSE((@i % 8) + 1, N'Anh', N'Bảo', N'Chi', N'Dũng', N'Khoa', N'Lan', N'Phúc', N'Tâm');
    SET @Email = 'user' + CAST(@i AS VARCHAR) + '@gmail.com';
    
    INSERT INTO Customer (FullName, PhoneNumber, Password, Email) 
    VALUES (@FullName, @Phone, 'Pass123', @Email);
    
    SET @i = @i + 1;
END
PRINT N'✅ Đã sinh 1.000 khách hàng thành công.';

-- 3c. Bến xe (11 bến)
INSERT INTO Station (CityName, StationName, Address) VALUES
(N'Sài Gòn',   N'Trụ sở chính: 1 Võ Văn Ngân, TP. Thủ Đức', N'1 Võ Văn Ngân, Phường Linh Chiểu, TP. Thủ Đức, TP.HCM'),
(N'Sài Gòn',   N'Bến xe Miền Tây',                           N'395 Kinh Dương Vương, An Lạc, Bình Tân, TP.HCM'),
(N'Sài Gòn',   N'Bến xe Miền Đông Mới',                      N'501 Hoàng Hữu Nam, Long Bình, TP. Thủ Đức, TP.HCM'),
(N'Đà Lạt',    N'Bến xe Liên tỉnh Đà Lạt',                   N'Số 01 Tô Hiến Thành, Phường 3, TP. Đà Lạt'),
(N'Đà Lạt',    N'Trung chuyển nội thành Đà Lạt',              N'Bán kính 5km trung tâm TP. Đà Lạt'),
(N'Cần Thơ',   N'Bến xe Trung tâm Cần Thơ',                  N'Đường dẫn cầu Cần Thơ, Hưng Thạnh, Cái Răng, Cần Thơ'),
(N'Nha Trang',  N'Bến xe Phía Nam Nha Trang',                 N'Km 6 đường 23/10, Vĩnh Trung, TP. Nha Trang'),
(N'Vũng Tàu',  N'Bến xe Vũng Tàu',                           N'192 Nam Kỳ Khởi Nghĩa, Phường Thắng Tam, TP. Vũng Tàu'),
(N'Phan Thiết', N'Bến xe Phan Thiết',                          N'01 Từ Văn Tư, Phú Trinh, TP. Phan Thiết'),
(N'Đà Nẵng',   N'Bến xe Trung tâm Đà Nẵng',                  N'185 Tôn Đức Thắng, Hòa Minh, Liên Chiểu, Đà Nẵng'),
(N'Biên Hòa',  N'Bến xe Biên Hòa',                            N'Số 04 Nguyễn Ái Quốc, Quang Vinh, TP. Biên Hòa');
GO

-- ==========================================
-- 4. SINH DỮ LIỆU ĐỘNG (Chuyến xe & Vé đặt)
-- ==========================================

-- 4a. Bảng tạm: Tuyến đường
CREATE TABLE #Routes (
    RouteIdx INT IDENTITY(1,1) PRIMARY KEY,
    Dep NVARCHAR(50), Des NVARCHAR(50),
    DepStation NVARCHAR(150), DesStation NVARCHAR(150),
    DurationMin INT, BasePrice INT
);

INSERT INTO #Routes VALUES
(N'Sài Gòn',    N'Đà Lạt',    N'1 Võ Văn Ngân, Thủ Đức',       N'Bến xe Liên tỉnh Đà Lạt',   420, 290000),
(N'Đà Lạt',     N'Sài Gòn',   N'Bến xe Liên tỉnh Đà Lạt',      N'1 Võ Văn Ngân, Thủ Đức',    420, 290000),
(N'Sài Gòn',    N'Cần Thơ',   N'1 Võ Văn Ngân, Thủ Đức',       N'Bến xe Trung tâm Cần Thơ',   210, 165000),
(N'Cần Thơ',    N'Sài Gòn',   N'Bến xe Trung tâm Cần Thơ',      N'1 Võ Văn Ngân, Thủ Đức',    210, 165000),
(N'Sài Gòn',    N'Nha Trang',  N'1 Võ Văn Ngân, Thủ Đức',       N'Bến xe Phía Nam Nha Trang',  480, 310000),
(N'Nha Trang',   N'Sài Gòn',  N'Bến xe Phía Nam Nha Trang',      N'1 Võ Văn Ngân, Thủ Đức',    480, 310000),
(N'Sài Gòn',    N'Vũng Tàu',  N'1 Võ Văn Ngân, Thủ Đức',       N'Bến xe Vũng Tàu',            150, 140000),
(N'Vũng Tàu',   N'Sài Gòn',  N'Bến xe Vũng Tàu',                N'1 Võ Văn Ngân, Thủ Đức',    150, 140000),
(N'Sài Gòn',    N'Phan Thiết', N'1 Võ Văn Ngân, Thủ Đức',       N'Bến xe Phan Thiết',           240, 180000),
(N'Phan Thiết',  N'Sài Gòn',  N'Bến xe Phan Thiết',               N'1 Võ Văn Ngân, Thủ Đức',    240, 180000),
(N'Biên Hòa',   N'Đà Lạt',    N'Bến xe Biên Hòa',                N'Bến xe Liên tỉnh Đà Lạt',   390, 290000),
(N'Đà Lạt',     N'Đà Nẵng',   N'Bến xe Liên tỉnh Đà Lạt',      N'Bến xe Trung tâm Đà Nẵng',  840, 390000);

-- 4b. Bảng tạm: Giờ khởi hành
CREATE TABLE #DepTimes (
    TimeIdx INT IDENTITY(1,1) PRIMARY KEY,
    DepHour INT, DepMinute INT
);

INSERT INTO #DepTimes VALUES
(6, 0), (8, 0), (10, 30), (13, 0), (15, 30), (18, 0), (21, 0);

-- 4c. Bảng tạm: Danh sách ngày (-30 đến +7)
CREATE TABLE #Dates (DateVal DATE);

DECLARE @d INT = -30;
WHILE @d <= 7
BEGIN
    INSERT INTO #Dates VALUES (DATEADD(DAY, @d, CAST(GETDATE() AS DATE)));
    SET @d = @d + 1;
END;

-- 4d. SINH CHUYẾN XE bằng CROSS JOIN
--     Tuyến chính (1-10): 7 giờ/ngày, Tuyến phụ (11-12): 3 giờ/ngày
--     Loại xe xoay vòng theo BusID:
--       1,4,6 = Giường nằm | 2,5,8 = Limousine | 3,7 = Cabin
INSERT INTO Trip (TripID, BusID, DeparturePoint, DestinationPoint,
                  DepartureStation, DestinationStation,
                  DepartureTime, ArrivalTime, Price, Status)
SELECT
    'YOLO-' + RIGHT('0' + CAST(MONTH(d.DateVal) AS VARCHAR), 2)
            + RIGHT('0' + CAST(DAY(d.DateVal) AS VARCHAR), 2)
            + '-' + CAST(ROW_NUMBER() OVER (ORDER BY d.DateVal, r.RouteIdx, t.TimeIdx) + 10000 AS VARCHAR),
    ((ROW_NUMBER() OVER (ORDER BY d.DateVal, r.RouteIdx, t.TimeIdx) - 1) % 8) + 1,
    r.Dep, r.Des, r.DepStation, r.DesStation,
    DATEADD(MINUTE, t.DepHour * 60 + t.DepMinute, CAST(d.DateVal AS DATETIME)),
    DATEADD(MINUTE, r.DurationMin + t.DepHour * 60 + t.DepMinute, CAST(d.DateVal AS DATETIME)),
    CASE
        WHEN ((ROW_NUMBER() OVER (ORDER BY d.DateVal, r.RouteIdx, t.TimeIdx) - 1) % 8) + 1 IN (2, 5, 8)
        THEN ROUND(r.BasePrice * 1.15 / 10000, 0) * 10000
        WHEN ((ROW_NUMBER() OVER (ORDER BY d.DateVal, r.RouteIdx, t.TimeIdx) - 1) % 8) + 1 IN (3, 7)
        THEN ROUND(r.BasePrice * 1.45 / 10000, 0) * 10000
        ELSE r.BasePrice
    END,
    N'Sẵn sàng'
FROM #Routes r
CROSS JOIN #DepTimes t
CROSS JOIN #Dates d
WHERE r.RouteIdx <= 10 OR t.TimeIdx <= 3;

PRINT N'✅ Đã sinh chuyến xe thành công.';

-- 4e. SINH VÉ ĐẶT cho chuyến xe trong quá khứ (~150 vé)
;WITH PastTrips AS (
    SELECT TripID, Price, DepartureStation, DestinationStation,
           DeparturePoint, DestinationPoint, DepartureTime,
           ROW_NUMBER() OVER (ORDER BY NEWID()) AS RN
    FROM Trip
    WHERE DepartureTime < GETDATE()
)
INSERT INTO Booking (BookingCode, CustomerID, CustomerName, CustomerPhone, CustomerEmail,
                     TripID, PickupPoint, DropoffPoint, TotalAmount,
                     PaymentMethod, PaymentStatus, CreatedAt)
SELECT
    'YOLO-' + CAST(100000 + pt.RN AS VARCHAR(10)),
    c.CustomerID,
    c.FullName,
    c.PhoneNumber,
    ISNULL(c.Email, ''),
    pt.TripID,
    pt.DepartureStation,
    pt.DestinationStation,
    pt.Price * (1 + (pt.RN % 3)),                                          -- 1, 2 hoặc 3 ghế
    CASE pt.RN % 3 WHEN 0 THEN N'VNPAY-QR' WHEN 1 THEN N'BANKING' ELSE N'CASH' END,
    CASE WHEN pt.RN % 12 = 0 THEN N'Đã hủy' ELSE N'Đã thanh toán' END,
    DATEADD(HOUR, -(pt.RN % 48 + 1), pt.DepartureTime)                    -- Thời điểm đặt vé
FROM PastTrips pt
JOIN Customer c ON c.CustomerID = ((pt.RN % 1000) + 2)
WHERE pt.RN <= 1500;

PRINT N'✅ Đã sinh vé đặt thành công.';

-- 4f. SINH CHI TIẾT VÉ (ghế ngồi)
--     Ghế 1 cho tất cả booking
INSERT INTO BookingDetail (BookingID, SeatNumber, Price, Deck)
SELECT b.BookingID,
       'A' + RIGHT('0' + CAST((b.BookingID % 18) + 1 AS VARCHAR), 2),
       t.Price, 1
FROM Booking b
JOIN Trip t ON b.TripID = t.TripID;

--     Ghế 2 cho booking có >= 2 ghế (RN % 3 >= 1 → BookingID tương ứng)
INSERT INTO BookingDetail (BookingID, SeatNumber, Price, Deck)
SELECT b.BookingID,
       'A' + RIGHT('0' + CAST((b.BookingID % 18) + 2 AS VARCHAR), 2),
       t.Price, 1
FROM Booking b
JOIN Trip t ON b.TripID = t.TripID
WHERE b.TotalAmount >= t.Price * 2;

--     Ghế 3 cho booking có 3 ghế (RN % 3 = 2 → TotalAmount = Price * 3)
INSERT INTO BookingDetail (BookingID, SeatNumber, Price, Deck)
SELECT b.BookingID,
       'B' + RIGHT('0' + CAST((b.BookingID % 10) + 1 AS VARCHAR), 2),
       t.Price, 2
FROM Booking b
JOIN Trip t ON b.TripID = t.TripID
WHERE b.TotalAmount >= t.Price * 3;

-- Dọn dẹp bảng tạm
DROP TABLE #Routes;
DROP TABLE #DepTimes;
DROP TABLE #Dates;

PRINT N'✅ Đã sinh chi tiết vé thành công.';
GO

-- ==========================================
-- 5. KIỂM TRA KẾT QUẢ
-- ==========================================
PRINT N'';
PRINT N'========================================';
PRINT N'  KẾT QUẢ NẠP DỮ LIỆU YOLO BUS LINES';
PRINT N'========================================';

SELECT 'Customer'      AS [Bảng], COUNT(*) AS [Số lượng] FROM Customer
UNION ALL SELECT 'Bus',           COUNT(*) FROM Bus
UNION ALL SELECT 'Station',       COUNT(*) FROM Station
UNION ALL SELECT 'Trip',          COUNT(*) FROM Trip
UNION ALL SELECT 'Booking',       COUNT(*) FROM Booking
UNION ALL SELECT 'BookingDetail', COUNT(*) FROM BookingDetail;

SELECT N'Tổng doanh thu (VNĐ)' AS [Thống kê],
       FORMAT(ISNULL(SUM(TotalAmount), 0), 'N0') AS [Giá trị]
FROM Booking
WHERE PaymentStatus = N'Đã thanh toán';

SELECT N'Số vé đã hủy' AS [Thống kê],
       COUNT(*) AS [Giá trị]
FROM Booking
WHERE PaymentStatus = N'Đã hủy';
GO
