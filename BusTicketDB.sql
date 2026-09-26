-- =======================================================================
-- HỆ THỐNG ĐẶT VÉ XE KHÁCH PHƯƠNG TRANG (FUTA BUS LINES)
-- CƠ SỞ DỮ LIỆU: BusTicketDB
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

-- 1. XÓA BẢNG CŨ NẾU ĐÃ TỒN TẠI
IF OBJECT_ID('dbo.BookingDetail', 'U') IS NOT NULL DROP TABLE dbo.BookingDetail;
IF OBJECT_ID('dbo.Booking', 'U') IS NOT NULL DROP TABLE dbo.Booking;
IF OBJECT_ID('dbo.Trip', 'U') IS NOT NULL DROP TABLE dbo.Trip;
IF OBJECT_ID('dbo.Bus', 'U') IS NOT NULL DROP TABLE dbo.Bus;
IF OBJECT_ID('dbo.Station', 'U') IS NOT NULL DROP TABLE dbo.Station;
IF OBJECT_ID('dbo.Customer', 'U') IS NOT NULL DROP TABLE dbo.Customer;
GO

-- 2. BẢNG KHÁCH HÀNG (Customer)
CREATE TABLE Customer (
    CustomerID INT IDENTITY(1,1) PRIMARY KEY,
    FullName NVARCHAR(100) NOT NULL,
    PhoneNumber VARCHAR(15) UNIQUE NOT NULL,
    Password VARCHAR(255) NOT NULL,
    Email VARCHAR(100) NULL,
    IDCard VARCHAR(20) NULL,
    CreatedAt DATETIME DEFAULT GETDATE()
);
GO

-- 3. BẢNG XE KHÁCH (Bus)
CREATE TABLE Bus (
    BusID INT IDENTITY(1,1) PRIMARY KEY,
    PlateNumber VARCHAR(20) NOT NULL UNIQUE,
    BusType NVARCHAR(50) NOT NULL, -- 'Giường nằm 40 chỗ', 'Limousine VIP 34 phòng', 'Cabin 22 phòng VIP'
    TotalSeats INT NOT NULL,
    DeckCount INT DEFAULT 2 -- 2 tầng
);
GO

-- 4. BẢNG BẾN XE / ĐIỂM ĐÓN TRẢ (Station)
CREATE TABLE Station (
    StationID INT IDENTITY(1,1) PRIMARY KEY,
    CityName NVARCHAR(50) NOT NULL,
    StationName NVARCHAR(150) NOT NULL,
    Address NVARCHAR(255) NOT NULL
);
GO

-- 5. BẢNG CHUYẾN XE (Trip)
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
GO

-- 6. BẢNG ĐẶT VÉ (Booking)
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
GO

-- 7. BẢNG CHI TIẾT VÉ / GHẾ ĐÃ ĐẶT (BookingDetail)
CREATE TABLE BookingDetail (
    DetailID INT IDENTITY(1,1) PRIMARY KEY,
    BookingID INT FOREIGN KEY REFERENCES Booking(BookingID) ON DELETE CASCADE,
    SeatNumber VARCHAR(10) NOT NULL,
    Price DECIMAL(18,0) NOT NULL,
    Deck INT DEFAULT 1
);
GO

-- =======================================================================
-- NẠP DỮ LIỆU MẪU (SEED DATA)
-- =======================================================================

-- Xe khách FUTA
INSERT INTO Bus (PlateNumber, BusType, TotalSeats, DeckCount) VALUES
('51B-123.45', N'Giường nằm 40 chỗ', 40, 2),
('51B-678.90', N'Limousine VIP 34 phòng', 34, 2),
('51B-999.88', N'Cabin 22 phòng VIP', 22, 2),
('49B-012.34', N'Giường nằm 40 chỗ', 40, 2),
('79B-555.66', N'Limousine VIP 34 phòng', 34, 2),
('72B-888.99', N'Ghế ngồi cao cấp 28 chỗ', 28, 1);

-- Khách hàng
INSERT INTO Customer (FullName, PhoneNumber, Password, Email) VALUES
(N'Nguyễn Văn An', '0901234567', '123456', 'an.nguyen@gmail.com'),
(N'Trần Thị Bích', '0912345678', '123456', 'bich.tran@gmail.com'),
(N'Lê Hoàng Minh', '0988776655', '123456', 'minh.le@gmail.com');

-- Bến xe
INSERT INTO Station (CityName, StationName, Address) VALUES
(N'Sài Gòn', N'Bến xe Miền Tây', N'395 Kinh Dương Vương, An Lạc, Bình Tân, TP.HCM'),
(N'Sài Gòn', N'Bến xe Miền Đông Mới', N'501 Hoàng Hữu Nam, Long Bình, TP. Thủ Đức, TP.HCM'),
(N'Sài Gòn', N'Văn phòng Lê Hồng Phong', N'272 Lê Hồng Phong, Phường 4, Quận 5, TP.HCM'),
(N'Đà Lạt', N'Bến xe Liên tỉnh Đà Lạt', N'Số 01 Tô Hiến Thành, Phường 3, TP. Đà Lạt'),
(N'Đà Lạt', N'Văn phòng FUTA Đà Lạt', N'Số 22 Trần Hưng Đạo, Phường 10, TP. Đà Lạt'),
(N'Nha Trang', N'Bến xe Phía Nam Nha Trang', N'Km 6 đường 23/10, Vĩnh Trung, TP. Nha Trang'),
(N'Cần Thơ', N'Bến xe Trung tâm Cần Thơ', N'Đường dẫn cầu Cần Thơ, Hưng Thạnh, Cái Răng, Cần Thơ'),
(N'Vũng Tàu', N'Bến xe Vũng Tàu', N'192 Nam Kỳ Khởi Nghĩa, Phường Thắng Tam, TP. Vũng Tàu'),
(N'Biên Hòa', N'Bến xe Biên Hòa', N'Số 04 Nguyễn Ái Quốc, Quang Vinh, TP. Biên Hòa');

-- Chuyến xe (Trip)
DECLARE @Today DATE = CAST(GETDATE() AS DATE);

INSERT INTO Trip (TripID, BusID, DeparturePoint, DestinationPoint, DepartureStation, DestinationStation, DepartureTime, ArrivalTime, Price) VALUES
-- Sài Gòn -> Đà Lạt
('FUTA-SG-DL-01', 2, N'Sài Gòn', N'Đà Lạt', N'Bến xe Miền Tây', N'Bến xe Liên tỉnh Đà Lạt', CAST(@Today AS DATETIME) + ' 07:00:00', CAST(@Today AS DATETIME) + ' 14:00:00', 320000),
('FUTA-SG-DL-02', 1, N'Sài Gòn', N'Đà Lạt', N'Văn phòng Lê Hồng Phong', N'Bến xe Liên tỉnh Đà Lạt', CAST(@Today AS DATETIME) + ' 11:30:00', CAST(@Today AS DATETIME) + ' 18:30:00', 290000),
('FUTA-SG-DL-03', 2, N'Sài Gòn', N'Đà Lạt', N'Bến xe Miền Đông Mới', N'Bến xe Liên tỉnh Đà Lạt', CAST(@Today AS DATETIME) + ' 15:00:00', CAST(@Today AS DATETIME) + ' 22:00:00', 320000),
('FUTA-SG-DL-04', 3, N'Sài Gòn', N'Đà Lạt', N'Bến xe Miền Tây', N'Bến xe Liên tỉnh Đà Lạt', CAST(@Today AS DATETIME) + ' 22:30:00', DATEADD(DAY, 1, CAST(@Today AS DATETIME)) + ' 05:30:00', 420000),
('FUTA-SG-DL-05', 1, N'Sài Gòn', N'Đà Lạt', N'Văn phòng Lê Hồng Phong', N'Bến xe Liên tỉnh Đà Lạt', CAST(@Today AS DATETIME) + ' 23:45:00', DATEADD(DAY, 1, CAST(@Today AS DATETIME)) + ' 06:45:00', 290000),

-- Đà Lạt -> Sài Gòn
('FUTA-DL-SG-01', 2, N'Đà Lạt', N'Sài Gòn', N'Bến xe Liên tỉnh Đà Lạt', N'Bến xe Miền Tây', CAST(@Today AS DATETIME) + ' 08:00:00', CAST(@Today AS DATETIME) + ' 15:00:00', 320000),
('FUTA-DL-SG-02', 1, N'Đà Lạt', N'Sài Gòn', N'Bến xe Liên tỉnh Đà Lạt', N'Bến xe Miền Đông Mới', CAST(@Today AS DATETIME) + ' 13:00:00', CAST(@Today AS DATETIME) + ' 20:00:00', 290000),
('FUTA-DL-SG-03', 3, N'Đà Lạt', N'Sài Gòn', N'Bến xe Liên tỉnh Đà Lạt', N'Bến xe Miền Tây', CAST(@Today AS DATETIME) + ' 22:00:00', DATEADD(DAY, 1, CAST(@Today AS DATETIME)) + ' 05:00:00', 420000),

-- Sài Gòn -> Cần Thơ
('FUTA-SG-CT-01', 1, N'Sài Gòn', N'Cần Thơ', N'Bến xe Miền Tây', N'Bến xe Trung tâm Cần Thơ', CAST(@Today AS DATETIME) + ' 06:00:00', CAST(@Today AS DATETIME) + ' 09:30:00', 165000),
('FUTA-SG-CT-02', 2, N'Sài Gòn', N'Cần Thơ', N'Bến xe Miền Tây', N'Bến xe Trung tâm Cần Thơ', CAST(@Today AS DATETIME) + ' 09:00:00', CAST(@Today AS DATETIME) + ' 12:30:00', 190000),
('FUTA-SG-CT-03', 1, N'Sài Gòn', N'Cần Thơ', N'Bến xe Miền Tây', N'Bến xe Trung tâm Cần Thơ', CAST(@Today AS DATETIME) + ' 14:00:00', CAST(@Today AS DATETIME) + ' 17:30:00', 165000),
('FUTA-SG-CT-04', 1, N'Sài Gòn', N'Cần Thơ', N'Bến xe Miền Tây', N'Bến xe Trung tâm Cần Thơ', CAST(@Today AS DATETIME) + ' 18:30:00', CAST(@Today AS DATETIME) + ' 22:00:00', 165000),

-- Sài Gòn -> Nha Trang
('FUTA-SG-NT-01', 2, N'Sài Gòn', N'Nha Trang', N'Bến xe Miền Đông Mới', N'Bến xe Phía Nam Nha Trang', CAST(@Today AS DATETIME) + ' 08:30:00', CAST(@Today AS DATETIME) + ' 16:30:00', 330000),
('FUTA-SG-NT-02', 3, N'Sài Gòn', N'Nha Trang', N'Văn phòng Lê Hồng Phong', N'Bến xe Phía Nam Nha Trang', CAST(@Today AS DATETIME) + ' 21:00:00', DATEADD(DAY, 1, CAST(@Today AS DATETIME)) + ' 05:00:00', 440000),
('FUTA-SG-NT-03', 1, N'Sài Gòn', N'Nha Trang', N'Bến xe Miền Tây', N'Bến xe Phía Nam Nha Trang', CAST(@Today AS DATETIME) + ' 22:15:00', DATEADD(DAY, 1, CAST(@Today AS DATETIME)) + ' 06:15:00', 290000),

-- Sài Gòn -> Vũng Tàu
('FUTA-SG-VT-01', 6, N'Sài Gòn', N'Vũng Tàu', N'Bến xe Miền Tây', N'Bến xe Vũng Tàu', CAST(@Today AS DATETIME) + ' 07:00:00', CAST(@Today AS DATETIME) + ' 09:30:00', 140000),
('FUTA-SG-VT-02', 6, N'Sài Gòn', N'Vũng Tàu', N'Văn phòng Lê Hồng Phong', N'Bến xe Vũng Tàu', CAST(@Today AS DATETIME) + ' 10:30:00', CAST(@Today AS DATETIME) + ' 13:00:00', 140000),
('FUTA-SG-VT-03', 6, N'Sài Gòn', N'Vũng Tàu', N'Bến xe Miền Tây', N'Bến xe Vũng Tàu', CAST(@Today AS DATETIME) + ' 15:00:00', CAST(@Today AS DATETIME) + ' 17:30:00', 140000),

-- Biên Hòa -> Đà Lạt
('FUTA-BH-DL-01', 1, N'Biên Hòa', N'Đà Lạt', N'Bến xe Biên Hòa', N'Bến xe Liên tỉnh Đà Lạt', CAST(@Today AS DATETIME) + ' 08:00:00', CAST(@Today AS DATETIME) + ' 15:00:00', 290000),
('FUTA-BH-DL-02', 2, N'Biên Hòa', N'Đà Lạt', N'Bến xe Biên Hòa', N'Bến xe Liên tỉnh Đà Lạt', CAST(@Today AS DATETIME) + ' 22:30:00', DATEADD(DAY, 1, CAST(@Today AS DATETIME)) + ' 05:30:00', 320000);

-- Mẫu đặt vé ban đầu
INSERT INTO Booking (BookingCode, CustomerID, CustomerName, CustomerPhone, CustomerEmail, TripID, PickupPoint, DropoffPoint, TotalAmount, PaymentMethod, PaymentStatus) VALUES
('FUTA-774921', 1, N'Nguyễn Văn An', '0901234567', 'an.nguyen@gmail.com', 'FUTA-SG-DL-01', N'Bến xe Miền Tây', N'Bến xe Liên tỉnh Đà Lạt', 640000, N'VNPAY-QR', N'Đã thanh toán');

INSERT INTO BookingDetail (BookingID, SeatNumber, Price, Deck) VALUES
(1, 'A01', 320000, 1),
(1, 'A02', 320000, 1);
GO

