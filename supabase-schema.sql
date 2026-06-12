-- =====================================================
-- SMART LIVING PAKISTAN — SUPABASE SCHEMA v2
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- =====================================================

-- ── PROFILES (one per auth user) ─────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  TEXT        NOT NULL DEFAULT '',
  email      TEXT        UNIQUE,
  phone      TEXT        UNIQUE,
  role       TEXT        NOT NULL DEFAULT 'staff'   CHECK (role IN ('admin','staff')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on sign-up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── PRODUCTS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id             BIGSERIAL   PRIMARY KEY,
  name           TEXT        NOT NULL,
  category       TEXT        NOT NULL DEFAULT '',
  sub_category   TEXT        NOT NULL DEFAULT '',
  sale_price     NUMERIC     NOT NULL DEFAULT 0,
  original_price NUMERIC     NOT NULL DEFAULT 0,
  stock          INTEGER     NOT NULL DEFAULT 0,
  notes          TEXT        NOT NULL DEFAULT '',
  image_url      TEXT,
  woo_id         INTEGER     UNIQUE,        -- WooCommerce product ID (for sync)
  last_synced_at TIMESTAMPTZ,               -- when last auto-synced from store
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_updated_at ON products;
CREATE TRIGGER trg_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── SYNC LOG ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync_log (
  id          BIGSERIAL   PRIMARY KEY,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  added       INTEGER     NOT NULL DEFAULT 0,
  updated     INTEGER     NOT NULL DEFAULT 0,
  total_found INTEGER     NOT NULL DEFAULT 0,
  status      TEXT        NOT NULL DEFAULT 'ok',
  message     TEXT
);

-- ── ROW LEVEL SECURITY ────────────────────────────────
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;

-- Public can READ products (for live storefront)
DROP POLICY IF EXISTS "Public read products" ON products;
CREATE POLICY "Public read products" ON products
  FOR SELECT USING (true);

-- Authenticated users can write products
DROP POLICY IF EXISTS "Auth write products" ON products;
CREATE POLICY "Auth write products" ON products
  FOR ALL USING (auth.role() = 'authenticated');

-- Users can read/write their own profile
DROP POLICY IF EXISTS "Own profile" ON profiles;
CREATE POLICY "Own profile" ON profiles
  FOR ALL USING (auth.uid() = id);

-- Auth users can read sync_log
DROP POLICY IF EXISTS "Auth read sync_log" ON sync_log;
CREATE POLICY "Auth read sync_log" ON sync_log
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth write sync_log" ON sync_log;
CREATE POLICY "Auth write sync_log" ON sync_log
  FOR INSERT USING (auth.role() = 'authenticated');

-- =====================================================
-- SEED DATA — 83 Products
-- =====================================================
INSERT INTO products (name, category, sub_category, sale_price, original_price, stock, notes, image_url) VALUES
('12W Adjustable Ceiling Light – Moon Ice','Lights','Ceiling Lights',349,500,15,'','https://smartlivingpakistan.com/wp-content/uploads/2025/10/12-Watt-LED-Ceiling-Light-in-Pakistan-Moon-Light.webp'),
('12W LED Ceiling Light – Pack of 8 (LUMA Core)','Lights','Ceiling Lights',2320,3200,8,'','https://smartlivingpakistan.com/wp-content/uploads/2025/10/12-Watt-LED-Ceiling-Light-Pack-of-8.webp'),
('12W SMD Ceiling Light – LUMA Core','Lights','Ceiling Lights',299,400,20,'','https://smartlivingpakistan.com/wp-content/uploads/2025/10/12-Watt-SMD-Ceiling-Light-LUMA-Core.webp'),
('12W SMD Ceiling Light – Halo Series','Lights','Ceiling Lights',310,400,12,'','https://smartlivingpakistan.com/wp-content/uploads/2025/10/12-Watt-SMD-Ceiling-Light-Halo-Series.webp'),
('7W/12W SMD Ceiling Light – LUMA CP-1','Lights','Ceiling Lights',270,0,25,'Range Rs.250-290','https://smartlivingpakistan.com/wp-content/uploads/2025/10/7-Watt-LED-Ceiling-Light-Double-Capacitor.webp'),
('7W LED Ceiling Light – Double Capacitor','Lights','Ceiling Lights',210,350,30,'','https://smartlivingpakistan.com/wp-content/uploads/2025/10/7-Watt-LED-Ceiling-Light-Double-Capacitor.webp'),
('7W LED Ceiling Light – Pack of 8','Lights','Ceiling Lights',1600,2800,5,'','https://smartlivingpakistan.com/wp-content/uploads/2025/10/7-Watt-LED-Ceiling-Light-Pack-of-8.webp'),
('1-Way Waterproof Wall Light – Black Metal','Lights','Wall Lights',890,1600,10,'','https://smartlivingpakistan.com/wp-content/uploads/2025/10/1-Way-Wall-Light-Waterproof-LED-Black-Metal-by-smart-living-pakistan-1.webp'),
('2-Way Black Metal Waterproof Wall Light','Lights','Wall Lights',1350,1800,7,'','https://smartlivingpakistan.com/wp-content/uploads/2025/10/2-Way-Black-Metal-Wall-Light.webp'),
('4-Way Metal LED Wall Light – Indoor & Outdoor','Lights','Wall Lights',1799,2400,6,'','https://smartlivingpakistan.com/wp-content/uploads/2025/10/4-Way-Metal-LED-Wall-Light-Smart-living-pakistan-smartlivingpakistan.webp'),
('8-Way LED Waterproof Wall Light','Lights','Wall Lights',1990,3500,4,'','https://smartlivingpakistan.com/wp-content/uploads/2025/10/8-Way-LED-Wall-Light-smart-living-pakistan.webp'),
('Cylinder Wall Light – Up Down Outdoor','Lights','Wall Lights',3150,3800,5,'',''),
('Luxury Wall Light – Indoor & Outdoor','Lights','Wall Lights',2499,3500,3,'','https://smartlivingpakistan.com/wp-content/uploads/2025/10/Luxury-Wall-Light.webp'),
('Modern Hexa Wall Light – Indoor & Outdoor','Lights','Wall Lights',2750,3500,4,'','https://smartlivingpakistan.com/wp-content/uploads/2025/10/Modern-Hexa-Wall-Light.webp'),
('Modern LED Wall Light – Sconce Indoor Outdoor','Lights','Wall Lights',2499,5000,5,'',''),
('Modern LED Wall Light – Golden Bird','Lights','Wall Lights',3250,4500,3,'','https://smartlivingpakistan.com/wp-content/uploads/2025/10/Modern-LED-Wall-Light-Golden-Bird.webp'),
('Modern LED Wall Light – Cylinder','Lights','Wall Lights',2950,3500,5,'',''),
('Modern Waterproof Wall Light Sconce','Lights','Wall Lights',1850,2500,6,'',''),
('Modern Waterproof Wall Light Sconce Premium','Lights','Wall Lights',2999,5000,4,'',''),
('Multicolor RGB LED Wall Light – Indoor','Lights','Wall Lights',2395,3000,5,'',''),
('Premium Golden Spiral LED Wall Light','Lights','Wall Lights',6440,7500,2,'','https://smartlivingpakistan.com/wp-content/uploads/2025/10/Premium-Golden-Spiral-LED-Wall-Light.webp'),
('Square Black Aluminum Wall Light','Lights','Wall Lights',3250,5000,3,'',''),
('Ultra Modern Metal Wall Light','Lights','Wall Lights',2499,3200,4,'',''),
('Waterproof 1-Way LED Wall Light','Lights','Wall Lights',1180,1500,8,'',''),
('Waterproof 3-Way Up & Down Wall Light','Lights','Wall Lights',1449,2500,6,'',''),
('Black Diamond Hanging Light – 18 Inch','Lights','Hanging Lights',2450,4000,4,'',''),
('Black Dome Pendant Light – 18 Inch','Lights','Hanging Lights',2450,4000,4,'',''),
('Fancy Ceiling Hanging Light – 18 Inch','Lights','Hanging Lights',2450,4000,3,'',''),
('Black Antique Gate Lamp – Main Gate','Lights','Pillar Lights',4499,6500,5,'','https://smartlivingpakistan.com/wp-content/uploads/2025/10/Black-Antique-Gate-Lamp.webp'),
('Gate Pillar Light – Black Metal 12 Inch','Lights','Pillar Lights',3350,4500,6,'','https://smartlivingpakistan.com/wp-content/uploads/2025/10/Gate-Pillar-Light-Black-Metal-12-Inch.webp'),
('Gate Pillar Lights – Black Metal Lamp','Lights','Pillar Lights',3350,4500,5,'',''),
('Golden Antique Gate Lamp – Main Gate','Lights','Pillar Lights',4499,6500,4,'','https://smartlivingpakistan.com/wp-content/uploads/2025/10/Golden-Antique-Gate-Lamp.webp'),
('Outdoor Waterproof Pillar Light – Black 12 Inch','Lights','Pillar Lights',3350,4500,5,'',''),
('Automatic Solar Outdoor Light','Lights','Solar Lights',2250,3000,8,'','https://smartlivingpakistan.com/wp-content/uploads/2025/10/Automatic-Solar-Lights.webp'),
('Solar Sensor Waterproof Wall Light – Motion','Lights','Solar Lights',1499,2500,10,'Double LED','https://smartlivingpakistan.com/wp-content/uploads/2025/10/Solar-Sensor-Wall-Light.webp'),
('12W Garden Light – Waterproof LED','Lights','Garden Lights',1450,1800,7,'','https://smartlivingpakistan.com/wp-content/uploads/2025/12/12W-Garden-Light-in-Pakistan-Waterproof-LED-Light-Smart-Living-Pakistan.webp'),
('7W Garden Light – Waterproof LED','Lights','Garden Lights',999,1350,9,'','https://smartlivingpakistan.com/wp-content/uploads/2025/12/7W-Garden-Light-in-Pakistan-Smart-Living-Pakistan.webp'),
('Switch Plates – Galaxy Black Grey Series','Switch Plates','Switch Boards',270,0,50,'Range Rs.270-570',''),
('Switch Board – Antique Black Series','Switch Plates','Switch Boards',320,0,35,'Range Rs.320-1199',''),
('Switch Board – Antique Gray Series','Switch Plates','Switch Boards',320,0,30,'Range Rs.320-1199',''),
('Multi Power Plug 15A – Galaxy Black Grey','Switch Plates','Switch Boards',499,650,20,'',''),
('Digital Volt Meter – Schneider','Switch Plates','Volt Meter',495,650,12,'',''),
('Electric Doorbell – High Quality AC220','Switch Plates','Doorbells',650,800,15,'','https://smartlivingpakistan.com/wp-content/uploads/2025/10/Electric-Doorbell-High-Quality.webp'),
('Long Range Doorbell – 150M, 38 Sounds','Switch Plates','Doorbells',950,1750,10,'','https://smartlivingpakistan.com/wp-content/uploads/2025/10/Long-Range-Doorbell-150M-38-Sounds.webp'),
('Telephone Doorbell Naxan – AC220 NA312','Switch Plates','Doorbells',650,950,8,'2 sounds',''),
('Wireless Door Bell – Electric','Switch Plates','Doorbells',1999,2500,7,'',''),
('Wireless Doorbell – 150M Long Range','Switch Plates','Doorbells',850,1600,9,'',''),
('Wireless Office Doorbell – 32 Sounds','Switch Plates','Doorbells',950,1650,6,'Model 605',''),
('Wireless Office Doorbell – 150M 38 Sounds VOYE','Switch Plates','Doorbells',1950,2750,5,'',''),
('Wireless Doorbell – 200M 38 Sounds Luckarm','Switch Plates','Doorbells',1950,2400,4,'',''),
('Xelent High Quality Doorbell – 2 Bird Tone','Switch Plates','Doorbells',790,800,10,'',''),
('Xelent Hut Shaped Doorbell – 2 Bird Tone','Switch Plates','Doorbells',790,950,8,'',''),
('Electric Insect Killer Machine – 6W','Smart Home','Insect Killers',2499,3500,6,'','https://smartlivingpakistan.com/wp-content/uploads/2025/10/Electric-Insect-Killer-Machine-6W.webp'),
('Insect Killer LED Bulb – Anti Mosquito','Smart Home','Insect Killers',549,0,20,'Range Rs.549-999',''),
('Mosquito Killer Machine – 30W Heavy Duty','Smart Home','Insect Killers',8500,14500,3,'','https://smartlivingpakistan.com/wp-content/uploads/2025/10/Mosquito-Killer-Machine-30W-Heavy-Duty.webp'),
('Rechargeable Mosquito Killer Racket – UV Lamp','Smart Home','Insect Killers',2250,3000,5,'','https://smartlivingpakistan.com/wp-content/uploads/2025/10/Rechargeable-Mosquito-Killer-Racket-UV-Lamp.webp'),
('Electric Dish Heater 300W/600W','Smart Home','Heaters',4000,5500,4,'Energy efficient','https://smartlivingpakistan.com/wp-content/uploads/2025/10/Electric-Dish-Heater-300W-600W.webp'),
('Electric Room Heater 400W/800W – Halogen','Smart Home','Heaters',2550,3000,5,'','https://smartlivingpakistan.com/wp-content/uploads/2025/10/Electric-Room-Heater-400W-800W.webp'),
('Premium Stanley Water Bottle – Black','Smart Home','Kitchen',3850,12000,6,'Stanley Pakistan','https://smartlivingpakistan.com/wp-content/uploads/2025/10/Stanley-Pakistan-Water-Bottle-Black.webp'),
('Stanley Water Bottle – Red','Smart Home','Kitchen',3850,12000,4,'Stanley Pakistan','https://smartlivingpakistan.com/wp-content/uploads/2025/10/Stanley-Water-Bottle-Red.webp'),
('RAF Electric Multifunction Grinder','Smart Home','Kitchen',2695,3500,7,'','https://smartlivingpakistan.com/wp-content/uploads/2025/10/RAF-Electric-High-Speed-Multifunction-Grinder.webp'),
('Solar & Electric Kitchen Stove – 2yr Warranty','Smart Home','Kitchen',17850,19500,2,'','https://smartlivingpakistan.com/wp-content/uploads/2025/12/Solar-Electric-Kitchen-Stove-In-Pakistan-Smart-Living-Pakistan-smartlivingpakistan.cOm.webp'),
('Luxury Dolphin One Piece Commode','Smart Home','Washroom',17950,25000,2,'','https://smartlivingpakistan.com/wp-content/uploads/2025/12/Luxury-Dolphin-One-Piece-Commode-High-quality-material-Smart-living-pakistan.webp'),
('Black Matte Door Handle Lock – Complete Set','Hardware','Door Locks',5499,7000,8,'','https://smartlivingpakistan.com/wp-content/uploads/2025/10/Black-Matte-Modern-Door-Handle-Lock.webp'),
('Brass Door Handle Lock – 3D Cut Luxury','Hardware','Door Locks',5499,7000,6,'','https://smartlivingpakistan.com/wp-content/uploads/2025/10/Brass-Door-Handle-Lock-3D-Cut-Luxury.webp'),
('Modern Door Handle Lock – 2-Piece Set','Hardware','Door Locks',5499,7000,5,'',''),
('Modern Door Handle Lock – Premium Brass','Hardware','Door Locks',5499,7000,4,'',''),
('Smart WiFi Door Lock (5-in-1) – Biometric','Hardware','Door Locks',27500,35000,2,'Fingerprint + App','https://smartlivingpakistan.com/wp-content/uploads/2025/10/Smart-WiFi-Door-Handle-Lock-5-in-1.webp'),
('1-Inch Modern French Wall Moulding','Wall Decor','Wall Moulding',699,900,40,'Per metre','https://smartlivingpakistan.com/wp-content/uploads/2025/10/1-Inch-Modern-French-Wall-Molding.webp'),
('Modern French Wall Moulding','Wall Decor','Wall Moulding',500,700,50,'Per metre',''),
('3D Butterfly Wall Painting – 12x17 Inches','Wall Decor','Paintings',3400,5000,5,'','https://smartlivingpakistan.com/wp-content/uploads/2025/12/3D-Butterfly-Wall-Painting-10x12-Inches-smart-living-pakistan.webp'),
('Handmade Modern Abstract Candle Art Painting','Wall Decor','Paintings',9500,0,3,'','https://smartlivingpakistan.com/wp-content/uploads/2025/12/Handmade-Wall-Painting-Modern-Abstract-Candle-Glass-Art-Smart-living-pakistan-smartlivingpakistan.webp'),
('Handmade Islamic Painting (2x4 Feet)','Wall Decor','Islamic Wall Art',7499,10000,2,'','https://smartlivingpakistan.com/wp-content/uploads/2025/12/Handmade-Islamic-Painting-in-Pakistan-Smart-living-pakistan-www.smartlivingpakistan.com.webp'),
('10mm Yoga Mat – Best Gym Yoga Mat','Gym','Yoga Mat',1450,1600,10,'','https://smartlivingpakistan.com/wp-content/uploads/2025/12/10mm-Yoga-Mat-in-Pakistan-Best-Gym-Yoga-Mat-smart-living-pakistan-www.smartlivingpakistan.com.webp'),
('Adjustable Hand Gripper – Hand Exercise','Gym','Hand Grippers',545,1500,15,'','https://smartlivingpakistan.com/wp-content/uploads/2025/12/Adjustable-hand-gripper-hand-gripper-in-pakistan-Smart-living-pakistan-Smartlivingpakistan.webp'),
('Adjustable Hand Gripper – 5-100KG with Counter','Gym','Hand Grippers',780,1500,12,'','https://smartlivingpakistan.com/wp-content/uploads/2025/12/Adjustable-Hand-Gripper-in-Pakistan-5-100KG-Hand-Grip-Strengthener-with-Counter.webp'),
('Adjustable Hand Gripper – 5-60KG with Counter','Gym','Hand Grippers',695,1450,10,'','https://smartlivingpakistan.com/wp-content/uploads/2025/12/Adjustable-Hand-Gripper-in-Pakistan-5-60KG-With-Counter.webp'),
('Adjustable Spring Hand Gripper','Gym','Hand Grippers',420,500,15,'',''),
('Hand Gripper – 5-100KG with Jump Counter','Gym','Hand Grippers',1450,1950,8,'','https://smartlivingpakistan.com/wp-content/uploads/2025/12/Hand-Gripper-Pakistan-GYM-Hand-Gripper-5-100kg-With-Counting.webp'),
('Multi Exercise Hand Gripper 5-60KG Digital','Gym','Hand Grippers',1250,2000,7,'Black','https://smartlivingpakistan.com/wp-content/uploads/2025/12/Adjustable-dial-on-Black-Hand-Gripper-showing-5kg-to-60kg-range.webp'),
('Adjustable Jumping / Skipping Rope','Gym','Jumping Ropes',550,600,20,'','https://smartlivingpakistan.com/wp-content/uploads/2025/12/Adjustable-Jumping-Rope-in-Pakistan-Skipping-Rope-smart-living-pakistan-www.smartlivingpakistan.com.webp'),
('Adjustable Skipping Rope – 2.5m Wire','Gym','Jumping Ropes',690,1050,15,'Fitness & height','https://smartlivingpakistan.com/wp-content/uploads/2025/12/Adjustable-Skipping-rope-for-fitness-and-Height-increase-2.5m-9ft-Wire-length.webp'),
('Jumping Rope with Counting Meter','Gym','Jumping Ropes',799,1450,12,'','https://smartlivingpakistan.com/wp-content/uploads/2025/12/Jumping-Rope-with-Counting-Meter-Skipping-Rope-in-Pakistan.webp')
ON CONFLICT DO NOTHING;
