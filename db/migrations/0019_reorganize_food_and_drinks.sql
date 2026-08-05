-- Move prepared food into Perros y Sándwiches and leave drinks in a dedicated section.

UPDATE menu_categories
SET
  slug = 'bebidas',
  name = 'Bebidas',
  sort_order = 2,
  active = TRUE,
  updated_at = now()
WHERE slug = 'papas-especiales';

WITH food_sort_order (id, sort_order) AS (
  VALUES
    ('pechuga-la-plancha', 6),
    ('carne-a-la-plancha', 7),
    ('alitas', 8),
    ('salchipapa-portal', 9),
    ('salchi-papas', 10),
    ('salchi-papas-queso', 11),
    ('porcion-de-papas', 12),
    ('la-imaginacion-no-tiene-limite-para-tu-salchipapa', 13),
    ('trocipollo', 14)
)
UPDATE menu_products AS product
SET
  category_slug = 'perros-sandwiches',
  sort_order = food_sort_order.sort_order,
  updated_at = now()
FROM food_sort_order
WHERE product.id = food_sort_order.id;

WITH drink_sort_order (id, sort_order) AS (
  VALUES
    ('coca-cola-p-400', 0),
    ('gaseosa-l-1-5', 1),
    ('milo-frio', 2),
    ('jugos-en-leche', 3),
    ('jugos-en-agua', 4),
    ('club-colombia', 5),
    ('aguila-light', 6),
    ('3-cordilleras', 7),
    ('corona', 8),
    ('tamarindo', 9),
    ('postobon', 10),
    ('postobon-1-5-l', 11),
    ('limonada-natural', 12),
    ('limonada-de-coco', 13),
    ('limonada-de-mango', 14),
    ('limonada-hierbabuena', 15)
)
UPDATE menu_products AS product
SET
  category_slug = 'bebidas',
  sort_order = drink_sort_order.sort_order,
  updated_at = now()
FROM drink_sort_order
WHERE product.id = drink_sort_order.id;
