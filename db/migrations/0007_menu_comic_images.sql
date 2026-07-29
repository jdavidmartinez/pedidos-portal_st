-- Assign the local comic-style artwork shipped with the application.
-- The files are served from /public/menu-comic-images and therefore use
-- /menu-comic-images/... as their browser-facing URL.

ALTER TABLE menu_products
  ALTER COLUMN image_url SET DEFAULT '/menu-comic-images/hamburguesa-portal-comic.png';

UPDATE menu_products
SET image_url = '/menu-comic-images/' || slug || '-comic.png',
    updated_at = now()
WHERE slug IN (
  'hamburguesa-portal',
  'hamburguesa-portazo',
  'hamburguesa-de-pollo',
  'hamburguesa-ranchera',
  'arepa-burguer',
  'hamburguesa-junior',
  'hamburguesa-de-queso',
  'hamburguesa-nortena',
  'mixta-portal-nortena',
  'mixta-portal-pollo',
  'perro-portal',
  'perra-portal',
  'perro-norteno',
  'sandwich-de-pollo',
  'sandwich-de-jamon',
  'sandwich-norteno',
  'pechuga-la-plancha',
  'carne-a-la-plancha',
  'salchi-papas',
  'salchi-papas-queso',
  'porcion-de-papas',
  'coca-cola-p-400',
  'gaseosa-l-1-5',
  'milo-frio',
  'jugos-en-leche',
  'jugos-en-agua',
  'club-colombia',
  'aguila-light',
  'corona',
  'tamarindo',
  'postobon',
  'limonada-natural',
  'limonada-de-coco',
  'limonada-de-mango',
  'limonada-hierbabuena'
);
