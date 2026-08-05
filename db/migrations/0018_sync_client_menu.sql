-- Synchronize the production catalog with docs/menu-portal-st.json.
-- Existing image URLs and inventory quantities are intentionally preserved.

ALTER TABLE menu_products
  ALTER COLUMN image_url SET DEFAULT
    'https://zdflakunbsel3qht.public.blob.vercel-storage.com/menu-products/hamburguesa-portal-comic.webp';

INSERT INTO menu_categories (slug, name, sort_order, active)
VALUES
  ('hamburguesas', 'Hamburguesas', 0, TRUE),
  ('perros-sandwiches', 'Perros y Sándwiches', 1, TRUE),
  ('papas-especiales', 'Papas y Especiales', 2, TRUE)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  active = TRUE,
  updated_at = now();

INSERT INTO menu_products (
  id, slug, category_slug, name, description, individual_price, combo_price,
  sort_order
)
VALUES
  ('hamburguesa-del-barrio', 'hamburguesa-del-barrio', 'hamburguesas', 'HAMBURGUESA DEL BARRIO', '120 gramos de carne artesanal, queso, tocineta, lechuga, tomate, cebolla, papa fosforito y salsa de la casa.', 16500, 26300, 0),
  ('hamburguesa-portal', 'hamburguesa-portal', 'hamburguesas', 'HAMBURGUESA PORTAL', '150 gramos de carne artesanal, queso, tocineta, lechuga, tomate, cebolla.', 18000, 27800, 1),
  ('hamburguesa-portazo', 'hamburguesa-portazo', 'hamburguesas', 'HAMBURGUESA PORTAZO', 'Dos carnes de 150 gramos artesanal, doble queso, tocineta, lechuga, tomate, cebolla.', 28000, 37800, 2),
  ('hamburguesa-de-pollo', 'hamburguesa-de-pollo', 'hamburguesas', 'HAMBURGUESA DE POLLO', 'Filete de pollo, queso, tocineta, lechuga, tomate, cebolla.', 18500, 28300, 3),
  ('hamburguesa-ranchera', 'hamburguesa-ranchera', 'hamburguesas', 'HAMBURGUESA RANCHERA', '150 gramos de carne artesanal, salchicha ranchera, en salsa BBQ, maicitos, queso, tocineta, lechuga, tomate, cebolla.', 22500, 32300, 4),
  ('arepa-burguer', 'arepa-burguer', 'hamburguesas', 'AREPA BURGUER', '150 gramos de carne artesanal, queso, tocineta, cebolla en salsa BBQ, tomate, tajada de plátano maduro y arepa asada al carbón.', 19000, 28800, 5),
  ('hamburguesa-junior', 'hamburguesa-junior', 'hamburguesas', 'HAMBURGUESA JUNIOR', '100 gramos de carne artesanal, queso, tocineta, lechuga, tomate, cebolla.', 14500, 24300, 6),
  ('hamburguesa-de-queso', 'hamburguesa-de-queso', 'hamburguesas', 'HAMBURGUESA DE QUESO', '150 gramos de carne artesanal, Tocineta, triple queso.', 19500, 28800, 7),
  ('hamburguesa-nortena', 'hamburguesa-nortena', 'hamburguesas', 'HAMBURGUESA NORTEÑA', '120 gramos de carne desmechada, un toque de picante, salsa frijol sofrito, Tocineta, queso, aros de cebolla, pepino agridulce, lechuga, tomate, cebolla.', 23500, 33300, 8),
  ('hamburguesa-italiana', 'hamburguesa-italiana', 'hamburguesas', 'HAMBURGUESA ITALIANA', '150 gramos de carne artesanal, queso, cebolla en salsa italiana con tocineta crocante, tomate, lechuga, pepperoni y pan cubierto de queso fundido con pepperoni.', 23500, 33300, 9),
  ('mixta-portal-nortena', 'mixta-portal-nortena', 'hamburguesas', 'MIXTA PORTAL-NORTEÑA', 'Carne Portal y carne desmechada con un toque picante, doble queso, tocineta, lechuga, tomate y cebolla.', 28000, 37800, 10),
  ('mixta-portal-pollo', 'mixta-portal-pollo', 'hamburguesas', 'MIXTA PORTAL-POLLO', 'Carne Portal y carne de pollo, doble queso, tocineta, lechuga, tomate y cebolla.', 28000, 37800, 11),
  ('perro-portal', 'perro-portal', 'perros-sandwiches', 'PERRO PORTAL', 'Salchicha Zenú tipo americano, pan artesanal, doble queso, tocineta, cebolla, papa fosforito y salsa tártara Portal.', 14500, 24300, 0),
  ('perra-portal', 'perra-portal', 'perros-sandwiches', 'PERRA PORTAL', 'Tocineta, pan artesanal, doble queso, salsa tártara Portal.', 15000, 24800, 1),
  ('perro-norteno', 'perro-norteno', 'perros-sandwiches', 'PERRO NORTEÑO', 'Salchicha Zenú tipo americano, carne desmechada con salsa de frijol sofrito y un toque picante, pan artesanal, doble queso y salsa tártara Portal.', 16500, 26300, 2),
  ('sandwich-de-pollo', 'sandwich-de-pollo', 'perros-sandwiches', 'SÁNDWICH DE POLLO', 'Pechuga a la plancha, pan, queso, lechuga, tomate y salsa de ajo Portal.', 13500, 23300, 3),
  ('sandwich-de-jamon', 'sandwich-de-jamon', 'perros-sandwiches', 'SÁNDWICH DE JAMÓN', 'Jamón, pan, queso, lechuga, tomate y salsa de ajo Portal.', 12500, 22300, 4),
  ('sandwich-norteno', 'sandwich-norteno', 'perros-sandwiches', 'SÁNDWICH NORTEÑO', 'Carne desmechada con salsa de frijol sofrito y un toque picante, pan, queso, lechuga, tomate y salsa de ajo Portal.', 14500, 24300, 5),
  ('pechuga-la-plancha', 'pechuga-a-la-plancha', 'papas-especiales', 'PECHUGA A LA PLANCHA', '180 g de filete de pollo a la plancha, gratinado con queso mozzarella y un toque de finas hierbas. Acompañado de papa a la francesa, tomate y lechuga.', 19500, NULL, 0),
  ('carne-a-la-plancha', 'carne-a-la-plancha', 'papas-especiales', 'CARNE A LA PLANCHA', '180 g de lomo de res a la plancha. Acompañado de papa a la francesa, tomate y lechuga.', 23500, NULL, 1),
  ('alitas', 'alitas', 'papas-especiales', 'ALITAS', '8 piezas de alitas apanadas, acompañadas de papas a la francesa y patacón con queso. Salsa de miel mostaza o salsa BBQ.', 25000, NULL, 2),
  ('salchipapa-portal', 'salchipapa-portal', 'papas-especiales', 'SALCHIPAPA PORTAL', '150 g de papa a la francesa rizada, 90 g de carne desmechada, 90 g de pechuga de pollo, salchicha extralarga Colanta, salsas de la casa y queso mozzarella gratinado.', 24400, NULL, 3),
  ('salchi-papas', 'salchipapa-sencilla', 'papas-especiales', 'SALCHIPAPA SENCILLA', '140 g de papa a la francesa rizada y salchicha Colanta extralarga.', 12000, NULL, 4),
  ('salchi-papas-queso', 'salchipapa-con-queso', 'papas-especiales', 'SALCHIPAPA CON QUESO', '140 g de papa a la francesa rizada, salchicha Colanta extralarga y queso mozzarella gratinado.', 13500, NULL, 5),
  ('porcion-de-papas', 'porcion-de-papas', 'papas-especiales', 'PORCIÓN DE PAPAS', '40 g de papa a la francesa rizada.', 6000, NULL, 6),
  ('la-imaginacion-no-tiene-limite-para-tu-salchipapa', 'la-imaginacion-no-tiene-limite-para-tu-salchipapa', 'papas-especiales', 'LA IMAGINACIÓN NO TIENE LÍMITE PARA TU SALCHIPAPA', 'Papa a la francesa lisa o rizada y salchicha Colanta extralarga como base. Pide la lista de productos adicionales para tu salchipapa.', 12000, NULL, 7),
  ('trocipollo', 'trocipollo', 'papas-especiales', 'TROCIPOLLO', '8 trozos de pollo apanados, acompañados de 120 g de papas a la francesa.', 13000, NULL, 8),
  ('coca-cola-p-400', 'coca-cola-p-400', 'papas-especiales', 'COCA COLA P 400', '', 4800, NULL, 9),
  ('gaseosa-l-1-5', 'coca-cola-1-5l', 'papas-especiales', 'COCA COLA 1.5L', '', 9000, NULL, 10),
  ('milo-frio', 'milo-frio', 'papas-especiales', 'MILO FRÍO', '', 9000, NULL, 11),
  ('jugos-en-leche', 'jugos-en-leche', 'papas-especiales', 'JUGOS EN LECHE', 'Guanábana, mango, maracuyá, mora o lulo.', 8000, NULL, 12),
  ('jugos-en-agua', 'jugos-en-agua', 'papas-especiales', 'JUGOS EN AGUA', 'Guanábana, mango, maracuyá, mora o lulo.', 6000, NULL, 13),
  ('club-colombia', 'club-colombia', 'papas-especiales', 'CLUB COLOMBIA', '', 6000, NULL, 14),
  ('aguila-light', 'aguila-light', 'papas-especiales', 'ÁGUILA LIGHT', '', 6000, NULL, 15),
  ('3-cordilleras', '3-cordilleras', 'papas-especiales', '3 CORDILLERAS', '', 6000, NULL, 16),
  ('corona', 'corona', 'papas-especiales', 'CORONA', '', 9000, NULL, 17),
  ('tamarindo', 'tamarindo', 'papas-especiales', 'TAMARINDO', '', 4800, NULL, 18),
  ('postobon', 'postobon', 'papas-especiales', 'POSTOBÓN', '', 4800, NULL, 19),
  ('postobon-1-5-l', 'postobon-1-5-l', 'papas-especiales', 'POSTOBÓN 1.5 L', '', 8000, NULL, 20),
  ('limonada-natural', 'limonada-natural', 'papas-especiales', 'LIMONADA NATURAL', '', 6000, NULL, 21),
  ('limonada-de-coco', 'limonada-de-coco', 'papas-especiales', 'LIMONADA DE COCO', '', 10000, NULL, 22),
  ('limonada-de-mango', 'limonada-de-mango', 'papas-especiales', 'LIMONADA DE MANGO', '', 9000, NULL, 23),
  ('limonada-hierbabuena', 'limonada-hierbabuena', 'papas-especiales', 'LIMONADA HIERBABUENA', '', 9000, NULL, 24)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category_slug = EXCLUDED.category_slug,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  individual_price = EXCLUDED.individual_price,
  combo_price = EXCLUDED.combo_price,
  sort_order = EXCLUDED.sort_order,
  active = TRUE,
  updated_at = now();

UPDATE menu_products
SET image_url = CASE id
  WHEN 'hamburguesa-del-barrio' THEN 'https://zdflakunbsel3qht.public.blob.vercel-storage.com/menu-products/hamburguesa-portal-comic.webp'
  WHEN 'hamburguesa-italiana' THEN 'https://zdflakunbsel3qht.public.blob.vercel-storage.com/menu-products/hamburguesa-ranchera-comic.webp'
  WHEN 'alitas' THEN 'https://zdflakunbsel3qht.public.blob.vercel-storage.com/menu-products/pechuga-la-plancha-comic.webp'
  WHEN 'salchipapa-portal' THEN 'https://zdflakunbsel3qht.public.blob.vercel-storage.com/menu-products/salchi-papas-queso-comic.webp'
  WHEN 'la-imaginacion-no-tiene-limite-para-tu-salchipapa' THEN 'https://zdflakunbsel3qht.public.blob.vercel-storage.com/menu-products/salchi-papas-comic.webp'
  WHEN 'trocipollo' THEN 'https://zdflakunbsel3qht.public.blob.vercel-storage.com/menu-products/pechuga-la-plancha-comic.webp'
  WHEN '3-cordilleras' THEN 'https://zdflakunbsel3qht.public.blob.vercel-storage.com/menu-products/club-colombia-comic.webp'
  WHEN 'postobon-1-5-l' THEN 'https://zdflakunbsel3qht.public.blob.vercel-storage.com/menu-products/postobon-comic.webp'
  ELSE image_url
END
WHERE id IN (
  'hamburguesa-del-barrio',
  'hamburguesa-italiana',
  'alitas',
  'salchipapa-portal',
  'la-imaginacion-no-tiene-limite-para-tu-salchipapa',
  'trocipollo',
  '3-cordilleras',
  'postobon-1-5-l'
);
