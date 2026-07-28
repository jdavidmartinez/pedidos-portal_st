CREATE TABLE IF NOT EXISTS menu_categories (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS menu_products (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  category_slug TEXT NOT NULL REFERENCES menu_categories(slug) ON UPDATE CASCADE,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  individual_price INTEGER NOT NULL CHECK (individual_price >= 0),
  combo_price INTEGER CHECK (combo_price IS NULL OR combo_price >= 0),
  image_url TEXT NOT NULL DEFAULT '/images/hamburguesa-portal.webp',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO menu_categories (slug, name, sort_order)
VALUES
  ('hamburguesas', 'Hamburguesas', 0),
  ('perros-sandwiches', 'Perros y Sándwiches', 1),
  ('papas-especiales', 'Papas y Especiales', 2)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO menu_products
  (id, slug, category_slug, name, description, individual_price, combo_price, sort_order)
VALUES
  ('hamburguesa-portal', 'hamburguesa-portal', 'hamburguesas', 'HAMBURGUESA PORTAL', '150 gramos de carne artesanal, queso, tocineta, lechuga, tomate, cebolla.', 16500, 26000, 0),
  ('hamburguesa-portazo', 'hamburguesa-portazo', 'hamburguesas', 'HAMBURGUESA PORTAZO', 'Dos carnes de 150 gramos artesanal, doble queso, tocineta, lechuga, tomate, cebolla.', 26000, 35500, 1),
  ('hamburguesa-de-pollo', 'hamburguesa-de-pollo', 'hamburguesas', 'HAMBURGUESA DE POLLO', 'Filete de pollo, queso, tocineta, lechuga, tomate, cebolla.', 17000, 26500, 2),
  ('hamburguesa-ranchera', 'hamburguesa-ranchera', 'hamburguesas', 'HAMBURGUESA RANCHERA', '150 gramos de carne artesanal, salchicha ranchera, en salsa BBQ, maicitos, queso, tocineta, lechuga, tomate, cebolla.', 21000, 31500, 3),
  ('arepa-burguer', 'arepa-burguer', 'hamburguesas', 'AREPA BURGUER', '150 gramos de carne artesanal, queso, tocineta, cebolla, en salsa BBQ, tomate, tajada de platano maduro.', 17500, 27000, 4),
  ('hamburguesa-junior', 'hamburguesa-junior', 'hamburguesas', 'HAMBURGUESA JUNIOR', '100 gramos de carne artesanal, queso, tocineta, lechuga, tomate, cebolla.', 14500, 24000, 5),
  ('hamburguesa-de-queso', 'hamburguesa-de-queso', 'hamburguesas', 'HAMBURGUESA DE QUESO', '150 gramos de carne artesanal, Tocineta, triple queso.', 17500, 27000, 6),
  ('hamburguesa-nortena', 'hamburguesa-nortena', 'hamburguesas', 'HAMBURGUESA NORTEÑA', '120 gramos de carne desmechada, un toque de picante, salsa frijol sofrito, Tocineta, queso, aros de cebolla, pepino agridulce, lechuga, tomate, cebolla.', 22000, 31500, 7),
  ('mixta-portal-nortena', 'mixta-portal-nortena', 'hamburguesas', 'MIXTA PORTAL-NORTEÑA', 'Combinación especial de sabores de la casa.', 26500, 36000, 8),
  ('mixta-portal-pollo', 'mixta-portal-pollo', 'hamburguesas', 'MIXTA PORTAL-POLLO', 'Combinación especial de sabores de la casa.', 26500, 36000, 9),
  ('perro-portal', 'perro-portal', 'perros-sandwiches', 'PERRO PORTAL', 'Salchicha Zenu tipo americano, pan artesanal, doble queso, tocineta, cebolla, papa fosforito, salsa tártara Portal.', 13500, 23000, 0),
  ('perra-portal', 'perra-portal', 'perros-sandwiches', 'PERRA PORTAL', 'Tocineta, pan artesanal, doble queso, salsa tártara Portal.', 14500, 24000, 1),
  ('perro-norteno', 'perro-norteno', 'perros-sandwiches', 'PERRO NORTEÑO', 'Salchicha Zenu tipo americano, carne desmechada con salsa de frijol sofrito un toque picante, pan artesanal, doble queso, salsa tártara Portal.', 15500, 25000, 2),
  ('sandwich-de-pollo', 'sandwich-de-pollo', 'perros-sandwiches', 'SANDWICH DE POLLO', 'Pechuga a la plancha, pan, queso, lechuga, tomate, y salsa de ajo Portal.', 12500, 22000, 3),
  ('sandwich-de-jamon', 'sandwich-de-jamon', 'perros-sandwiches', 'SANDWICH DE JAMON', 'Jamón, pan, queso, lechuga, tomate y salsa de ajo Portal.', 11500, 21000, 4),
  ('sandwich-norteno', 'sandwich-norteno', 'perros-sandwiches', 'SANDWICH NORTEÑO', 'Carne desmechada con salsa frijol sofrito algo picante, pan, queso, lechuga, tomate, y salsa de ajo Portal.', 13500, 23000, 5),
  ('pechuga-la-plancha', 'pechuga-la-plancha', 'papas-especiales', 'PECHUGA LA PLANCHA', '', 16500, NULL, 0),
  ('carne-a-la-plancha', 'carne-a-la-plancha', 'papas-especiales', 'CARNE A LA PLANCHA', '', 21500, NULL, 1),
  ('salchi-papas', 'salchi-papas', 'papas-especiales', 'SALCHI PAPAS', '', 11000, NULL, 2),
  ('salchi-papas-queso', 'salchi-papas-queso', 'papas-especiales', 'SALCHI PAPAS QUESO', '', 12500, NULL, 3),
  ('porcion-de-papas', 'porcion-de-papas', 'papas-especiales', 'PORCIÓN DE PAPAS', '', 6000, NULL, 4),
  ('coca-cola-p-400', 'coca-cola-p-400', 'papas-especiales', 'COCA COLA P 400', '', 4500, NULL, 5),
  ('gaseosa-l-1-5', 'gaseosa-l-1-5', 'papas-especiales', 'GASEOSA L 1.5', '', 9000, NULL, 6),
  ('milo-frio', 'milo-frio', 'papas-especiales', 'MILO FRIO', '', 9000, NULL, 7),
  ('jugos-en-leche', 'jugos-en-leche', 'papas-especiales', 'JUGOS EN LECHE', '', 7500, NULL, 8),
  ('jugos-en-agua', 'jugos-en-agua', 'papas-especiales', 'JUGOS EN AGUA', '', 5500, NULL, 9),
  ('club-colombia', 'club-colombia', 'papas-especiales', 'CLUB COLOMBIA', '', 8000, NULL, 10),
  ('aguila-light', 'aguila-light', 'papas-especiales', 'AGUILA LIGHT', '', 6000, NULL, 11),
  ('corona', 'corona', 'papas-especiales', 'CORONA', '', 9000, NULL, 12),
  ('tamarindo', 'tamarindo', 'papas-especiales', 'TAMARINDO', '', 4500, NULL, 13),
  ('postobon', 'postobon', 'papas-especiales', 'POSTOBON', '', 4500, NULL, 14),
  ('limonada-natural', 'limonada-natural', 'papas-especiales', 'LIMONADA NATURAL', '', 5500, NULL, 15),
  ('limonada-de-coco', 'limonada-de-coco', 'papas-especiales', 'LIMONADA DE COCO', '', 10000, NULL, 16),
  ('limonada-de-mango', 'limonada-de-mango', 'papas-especiales', 'LIMONADA DE MANGO', '', 9000, NULL, 17),
  ('limonada-hierbabuena', 'limonada-hierbabuena', 'papas-especiales', 'LIMONADA HIERBABUENA', '', 9000, NULL, 18)
ON CONFLICT (slug) DO NOTHING;
